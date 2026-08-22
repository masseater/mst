import { connectionCursorId } from "../contract/cursor.ts";
import { isMode, type Mode } from "../contract/vocabulary.ts";
import { SOCKET_LIFECYCLE_EVENT } from "../runtime/event-names.ts";
import { authFailureStatus } from "./auth-status.ts";
import { runBaseUpdateCheck } from "./base-update-checker.ts";
import { extractBearer } from "./bearer.ts";
import { KEEPALIVE_INTERVAL_MS } from "./durations.ts";
import { authenticateOperator } from "./operator-auth.ts";
import { createOwnerFilter } from "./owner-filter.ts";
import { runPoll } from "./poll.ts";
import { authenticateScheduler, type IdTokenVerifier } from "./scheduler-auth.ts";
import { issueSession } from "./session-issue.ts";
import { sseSinkFor } from "./sse-sink.ts";
import { runEventStream } from "./sse.ts";
import { runStartupDrain } from "./startup-drain.ts";
import { handleWebhook } from "./webhook.ts";

import type { IncomingMessage, ServerResponse } from "node:http";
import type { Logger } from "../logging/logger.ts";
import type { GithubReader } from "./github-reader.ts";
import type { RelayConfig } from "./relay-config.ts";
import type { CursorStore, EventStore, SessionStore } from "./store.ts";

export type RelayDependencies = {
  readonly config: RelayConfig;
  readonly events: EventStore;
  readonly cursors: CursorStore;
  readonly sessions: SessionStore;
  readonly github: GithubReader;
  readonly verifyIdToken: IdTokenVerifier;
  readonly log: Logger;
  readonly now?: () => number;
  readonly keepaliveMs?: number;
};

const clockOf = (deps: RelayDependencies): (() => number) => deps.now ?? Date.now;

export type RouteContext = {
  readonly req: IncomingMessage;
  readonly res: ServerResponse;
  readonly requestUrl: URL;
  readonly deps: RelayDependencies;
};

export const respondJson = (produced: {
  readonly res: ServerResponse;
  readonly status: number;
  readonly body: Readonly<Record<string, unknown>>;
}): void => {
  produced.res.writeHead(produced.status, { "content-type": "application/json" });
  produced.res.end(JSON.stringify(produced.body));
};

const requestBearer = (asked: IncomingMessage): string | undefined =>
  extractBearer(
    typeof asked.headers.authorization === "string" ? asked.headers.authorization : undefined,
  );

const requestBody = async (asked: IncomingMessage): Promise<string> => {
  const writtenChunks: readonly Buffer[] = await Array.fromAsync(asked);
  return Buffer.concat(writtenChunks).toString("utf8");
};

const respondAuthFailure = (rejection: {
  readonly context: RouteContext;
  readonly failure: unknown;
}): void => {
  const heldStatus = authFailureStatus(rejection.failure);
  rejection.context.deps.log.warn(
    { path: rejection.context.requestUrl.pathname, err: rejection.failure },
    "authentication failed",
  );
  respondJson({
    res: rejection.context.res,
    status: heldStatus,
    body: { error: heldStatus === 401 ? "Unauthorized" : "Service Unavailable" },
  });
};

const operatorSubject = async (
  carried: RouteContext,
): Promise<{ readonly login: string; readonly mode: Mode } | null> => {
  const principal = await authenticateOperator({
    credential: requestBearer(carried.req),
    sessions: carried.deps.sessions,
    now: clockOf(carried.deps),
  });
  const modeCandidate = carried.requestUrl.searchParams.get("mode");
  if (modeCandidate === null || !isMode(modeCandidate)) {
    respondJson({ res: carried.res, status: 400, body: { error: "Invalid or missing mode" } });
    return null;
  }
  return { login: principal.login, mode: modeCandidate };
};

export const handleHealthRoute = (carried: RouteContext): void => {
  respondJson({ res: carried.res, status: 200, body: { status: "ok" } });
};

export const handleWebhookRoute = async (carried: RouteContext): Promise<void> => {
  const webhookResponse = await handleWebhook({
    rawBody: await requestBody(carried.req),
    eventType: headerValue(carried.req, "x-github-event"),
    deliveryId: headerValue(carried.req, "x-github-delivery"),
    signatureHeader: headerValue(carried.req, "x-hub-signature-256"),
    config: {
      webhookSecret: carried.deps.config.webhookSecret,
      githubRepository: carried.deps.config.githubRepository,
    },
    events: carried.deps.events,
    log: carried.deps.log,
    stampedNow: clockOf(carried.deps),
  });
  respondJson({ res: carried.res, status: webhookResponse.status, body: webhookResponse.body });
};

const headerValue = (asked: IncomingMessage, spelled: string): string | undefined => {
  const header = asked.headers[spelled];
  return typeof header === "string" ? header : undefined;
};

export const handleSessionRoute = async (carried: RouteContext): Promise<void> => {
  try {
    const issued = await issueSession({
      githubToken: requestBearer(carried.req),
      github: carried.deps.github,
      sessions: carried.deps.sessions,
      now: clockOf(carried.deps),
    });
    respondJson({ res: carried.res, status: 200, body: issued });
  } catch (failure) {
    respondAuthFailure({ context: carried, failure });
  }
};

export const handlePollRoute = async (carried: RouteContext): Promise<void> => {
  const subject = await operatorSubjectOrRespond(carried);
  if (subject === null) return;
  const envelopes = await runPoll({
    clientId: connectionCursorId(subject.login, subject.mode),
    subscriberLogin: subject.login,
    events: carried.deps.events,
    cursors: carried.deps.cursors,
    ownerFilter: createOwnerFilter({ events: carried.deps.events, github: carried.deps.github }),
    now: clockOf(carried.deps),
  });
  carried.deps.log.info({ eventCount: envelopes.length }, "poll served");
  respondJson({ res: carried.res, status: 200, body: { events: envelopes } });
};

const operatorSubjectOrRespond = async (
  carried: RouteContext,
): Promise<{ readonly login: string; readonly mode: Mode } | null> => {
  try {
    return await operatorSubject(carried);
  } catch (failure) {
    respondAuthFailure({ context: carried, failure });
    return null;
  }
};

export const handleStartupDrainRoute = async (carried: RouteContext): Promise<void> => {
  const subject = await operatorSubjectOrRespond(carried);
  if (subject === null) return;
  const envelopes = await runStartupDrain({
    login: subject.login,
    mode: subject.mode,
    github: carried.deps.github,
    ciSuppressionLabel: carried.deps.config.ciSuppressionLabel,
  });
  carried.deps.log.info(
    { eventCount: envelopes.length, mode: subject.mode },
    "startup drain served",
  );
  respondJson({ res: carried.res, status: 200, body: { events: envelopes } });
};

export const handleStreamRoute = async (carried: RouteContext): Promise<void> => {
  const subject = await operatorSubjectOrRespond(carried);
  if (subject === null) return;
  carried.res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache",
    connection: "keep-alive",
  });
  carried.res.flushHeaders();
  const clientHangup = new AbortController();
  carried.req.on(SOCKET_LIFECYCLE_EVENT.close, () => {
    clientHangup.abort();
  });
  await runEventStream({
    clientId: connectionCursorId(subject.login, subject.mode),
    subscriberLogin: subject.login,
    lastEventId: headerValue(carried.req, "last-event-id") ?? null,
    events: carried.deps.events,
    cursors: carried.deps.cursors,
    ownerFilter: createOwnerFilter({ events: carried.deps.events, github: carried.deps.github }),
    sink: sseSinkFor(carried.res),
    clientAbort: clientHangup.signal,
    log: carried.deps.log,
    now: clockOf(carried.deps),
    keepaliveMs: carried.deps.keepaliveMs ?? KEEPALIVE_INTERVAL_MS,
  });
  carried.res.end();
};

export const handleCheckBaseUpdatesRoute = async (carried: RouteContext): Promise<void> => {
  try {
    await authenticateScheduler({
      idToken: requestBearer(carried.req),
      audience: carried.deps.config.publicOrigin,
      allowedEmails: carried.deps.config.schedulerServiceAccountEmails,
      verify: carried.deps.verifyIdToken,
    });
  } catch (failure) {
    respondAuthFailure({ context: carried, failure });
    return;
  }
  const report = await runBaseUpdateCheck({
    github: carried.deps.github,
    events: carried.deps.events,
    now: clockOf(carried.deps),
  });
  respondJson({ res: carried.res, status: 200, body: report });
};
