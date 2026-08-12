import { connectionCursorId } from "../contract/cursor.ts";
import { isMode, type Mode } from "../contract/vocabulary.ts";
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

export const respondJson = (response: {
  readonly res: ServerResponse;
  readonly status: number;
  readonly body: Readonly<Record<string, unknown>>;
}): void => {
  response.res.writeHead(response.status, { "content-type": "application/json" });
  response.res.end(JSON.stringify(response.body));
};

const requestBearer = (req: IncomingMessage): string | undefined =>
  extractBearer(
    typeof req.headers.authorization === "string" ? req.headers.authorization : undefined,
  );

const requestBody = async (req: IncomingMessage): Promise<string> => {
  const chunks: readonly Buffer[] = await Array.fromAsync(req);
  return Buffer.concat(chunks).toString("utf8");
};

const respondAuthFailure = (rejection: {
  readonly context: RouteContext;
  readonly failure: unknown;
}): void => {
  const status = authFailureStatus(rejection.failure);
  rejection.context.deps.log.warn(
    { path: rejection.context.requestUrl.pathname, err: rejection.failure },
    "authentication failed",
  );
  respondJson({
    res: rejection.context.res,
    status,
    body: { error: status === 401 ? "Unauthorized" : "Service Unavailable" },
  });
};

const operatorSubject = async (
  context: RouteContext,
): Promise<{ readonly login: string; readonly mode: Mode } | null> => {
  const principal = await authenticateOperator({
    credential: requestBearer(context.req),
    sessions: context.deps.sessions,
    now: clockOf(context.deps),
  });
  const modeCandidate = context.requestUrl.searchParams.get("mode");
  if (modeCandidate === null || !isMode(modeCandidate)) {
    respondJson({ res: context.res, status: 400, body: { error: "Invalid or missing mode" } });
    return null;
  }
  return { login: principal.login, mode: modeCandidate };
};

export const handleHealthRoute = (context: RouteContext): void => {
  respondJson({ res: context.res, status: 200, body: { status: "ok" } });
};

export const handleWebhookRoute = async (context: RouteContext): Promise<void> => {
  const webhookResponse = await handleWebhook({
    rawBody: await requestBody(context.req),
    eventType: headerValue(context.req, "x-github-event"),
    deliveryId: headerValue(context.req, "x-github-delivery"),
    signatureHeader: headerValue(context.req, "x-hub-signature-256"),
    config: {
      webhookSecret: context.deps.config.webhookSecret,
      githubRepository: context.deps.config.githubRepository,
    },
    events: context.deps.events,
    log: context.deps.log,
    now: clockOf(context.deps),
  });
  respondJson({ res: context.res, status: webhookResponse.status, body: webhookResponse.body });
};

const headerValue = (req: IncomingMessage, name: string): string | undefined => {
  const header = req.headers[name];
  return typeof header === "string" ? header : undefined;
};

export const handleSessionRoute = async (context: RouteContext): Promise<void> => {
  try {
    const issued = await issueSession({
      githubToken: requestBearer(context.req),
      github: context.deps.github,
      sessions: context.deps.sessions,
      now: clockOf(context.deps),
    });
    respondJson({ res: context.res, status: 200, body: issued });
  } catch (failure) {
    respondAuthFailure({ context, failure });
  }
};

export const handlePollRoute = async (context: RouteContext): Promise<void> => {
  const subject = await operatorSubjectOrRespond(context);
  if (subject === null) return;
  const envelopes = await runPoll({
    clientId: connectionCursorId(subject.login, subject.mode),
    subscriberLogin: subject.login,
    events: context.deps.events,
    cursors: context.deps.cursors,
    ownerFilter: createOwnerFilter({ events: context.deps.events, github: context.deps.github }),
    now: clockOf(context.deps),
  });
  context.deps.log.info({ eventCount: envelopes.length }, "poll served");
  respondJson({ res: context.res, status: 200, body: { events: envelopes } });
};

const operatorSubjectOrRespond = async (
  context: RouteContext,
): Promise<{ readonly login: string; readonly mode: Mode } | null> => {
  try {
    return await operatorSubject(context);
  } catch (failure) {
    respondAuthFailure({ context, failure });
    return null;
  }
};

export const handleStartupDrainRoute = async (context: RouteContext): Promise<void> => {
  const subject = await operatorSubjectOrRespond(context);
  if (subject === null) return;
  const envelopes = await runStartupDrain({
    login: subject.login,
    mode: subject.mode,
    github: context.deps.github,
    ciSuppressionLabel: context.deps.config.ciSuppressionLabel,
  });
  context.deps.log.info(
    { eventCount: envelopes.length, mode: subject.mode },
    "startup drain served",
  );
  respondJson({ res: context.res, status: 200, body: { events: envelopes } });
};

export const handleStreamRoute = async (context: RouteContext): Promise<void> => {
  const subject = await operatorSubjectOrRespond(context);
  if (subject === null) return;
  context.res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache",
    connection: "keep-alive",
  });
  context.res.flushHeaders();
  const clientHangup = new AbortController();
  context.req.on("close", () => {
    clientHangup.abort();
  });
  await runEventStream({
    clientId: connectionCursorId(subject.login, subject.mode),
    subscriberLogin: subject.login,
    lastEventId: headerValue(context.req, "last-event-id") ?? null,
    events: context.deps.events,
    cursors: context.deps.cursors,
    ownerFilter: createOwnerFilter({ events: context.deps.events, github: context.deps.github }),
    sink: sseSinkFor(context.res),
    clientAbort: clientHangup.signal,
    log: context.deps.log,
    now: clockOf(context.deps),
    keepaliveMs: context.deps.keepaliveMs ?? KEEPALIVE_INTERVAL_MS,
  });
  context.res.end();
};

export const handleCheckBaseUpdatesRoute = async (context: RouteContext): Promise<void> => {
  try {
    await authenticateScheduler({
      idToken: requestBearer(context.req),
      audience: context.deps.config.publicOrigin,
      allowedEmails: context.deps.config.schedulerServiceAccountEmails,
      verify: context.deps.verifyIdToken,
    });
  } catch (failure) {
    respondAuthFailure({ context, failure });
    return;
  }
  const report = await runBaseUpdateCheck({
    github: context.deps.github,
    events: context.deps.events,
    now: clockOf(context.deps),
  });
  respondJson({ res: context.res, status: 200, body: report });
};
