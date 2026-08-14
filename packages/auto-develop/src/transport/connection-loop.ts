import { CredentialTerminalError, type CredentialProvider } from "./credential-provider.ts";
import { SseRequestRejectedError } from "./sse-request-rejected-error.ts";

import type { StreamReader } from "./stream-reader.ts";

const INITIAL_BACKOFF_MS = 1000;

const BACKOFF_CAP_MS = 30_000;

export type ConnectionRuntime = {
  readonly streamUrl: string;
  readonly credentials: CredentialProvider;
  readonly reconnectOnClose: boolean;
  readonly retryDeadlineMs: number;
  readonly diagnostics: { readonly write: (chunk: string) => void };
  readonly fetchImpl: typeof fetch;
  readonly random: () => number;
  readonly now: () => number;
  readonly sleep: (delayMs: number, signal: AbortSignal) => Promise<void>;
};

type RetryState = {
  readonly attempt: number;
  readonly backoffMs: number;
  readonly windowStartMs: number | undefined;
};

const isAbortError = (failure: unknown): boolean =>
  failure instanceof Error && failure.name === "AbortError";

const classifyResponse = (produced: Response, credentials: CredentialProvider): void => {
  if (produced.status === 401 || produced.status === 403) {
    credentials.invalidate();
    throw new Error(`SSE connect refused the connection credential: ${produced.status}`);
  }
  if (produced.status === 408 || produced.status === 429 || produced.status >= 500) {
    throw new Error(`SSE connect failed: ${produced.status}`);
  }
  throw new SseRequestRejectedError();
};

export const createConnectionLoop = (wiring: {
  readonly runtime: ConnectionRuntime;
  readonly controllers: Map<string, AbortController>;
  readonly resumePositions: Map<string, string>;
  readonly streamReader: StreamReader;
}): { readonly run: () => Promise<void> } => {
  const { runtime, controllers, resumePositions, streamReader } = wiring;

  const windowElapsedMs = (retry: RetryState): number =>
    retry.windowStartMs === undefined ? 0 : runtime.now() - retry.windowStartMs;

  const jitteredDelayMs = (retry: RetryState): number => {
    const jitteredMs = Math.max(
      1,
      Math.ceil(retry.backoffMs + (runtime.random() * 2 - 1) * retry.backoffMs * 0.5),
    );
    const remainingMs = Number.isFinite(runtime.retryDeadlineMs)
      ? runtime.retryDeadlineMs - windowElapsedMs(retry)
      : jitteredMs;
    return Math.min(jitteredMs, remainingMs);
  };

  const backoffOrRethrow = async (backing: {
    readonly retry: RetryState;
    readonly failure: unknown;
  }): Promise<RetryState | "aborted"> => {
    const { retry, failure } = backing;
    if (windowElapsedMs(retry) >= runtime.retryDeadlineMs) throw failure;
    const delayMs = jitteredDelayMs(retry);
    runtime.diagnostics.write(
      `[sse-transport] Connection attempt ${retry.attempt} failed, backing off ${delayMs}ms: ${String(failure)}\n`,
    );
    try {
      await runtime.sleep(delayMs, (controllers.get("current") as AbortController).signal);
    } catch (sleepFailure) {
      if (isAbortError(sleepFailure)) return "aborted";
      throw sleepFailure;
    }
    return { ...retry, backoffMs: Math.min(retry.backoffMs * 2, BACKOFF_CAP_MS) };
  };

  const requestStream = async (attemptSignal: AbortSignal): Promise<Response> => {
    const authorization = await runtime.credentials.authorizationFor({
      url: runtime.streamUrl,
      signal: attemptSignal,
    });
    const resumeId = resumePositions.get("last");
    return runtime.fetchImpl(runtime.streamUrl, {
      signal: attemptSignal,
      headers: {
        accept: "text/event-stream",
        authorization,
        ...(resumeId === undefined ? {} : { "last-event-id": resumeId }),
      },
    });
  };
  const openStream = async (opening: {
    readonly windowRemainingMs: number;
    readonly disconnectSignal: AbortSignal;
  }): Promise<Response> => {
    const deadlineHalt = new AbortController();
    const deadlineTimer = Number.isFinite(opening.windowRemainingMs)
      ? setTimeout(() => {
          deadlineHalt.abort(new Error("SSE retry deadline reached"));
        }, opening.windowRemainingMs)
      : undefined;
    try {
      const produced = await requestStream(
        AbortSignal.any([opening.disconnectSignal, deadlineHalt.signal]),
      );
      if (!produced.ok) classifyResponse(produced, runtime.credentials);
      return produced;
    } catch (openFailure) {
      if (deadlineHalt.signal.aborted) {
        throw new Error("SSE retry deadline exceeded", { cause: openFailure });
      }
      throw openFailure;
    } finally {
      if (deadlineTimer !== undefined) clearTimeout(deadlineTimer);
    }
  };
  const attemptStream = async (windowRemainingMs: number): Promise<"client" | "server"> => {
    const disconnectHalt = new AbortController();
    controllers.set("current", disconnectHalt);
    const produced = await openStream({
      windowRemainingMs,
      disconnectSignal: disconnectHalt.signal,
    });
    if (produced.body === null) return "server";
    return streamReader.readStream(produced.body);
  };
  const runAttemptCycle = async (
    retry: RetryState,
  ): Promise<"settled" | { readonly retry: RetryState; readonly failure: unknown }> => {
    try {
      const windowRemainingMs = Number.isFinite(runtime.retryDeadlineMs)
        ? runtime.retryDeadlineMs - windowElapsedMs(retry)
        : Number.POSITIVE_INFINITY;
      const closedBy = await attemptStream(windowRemainingMs);
      if (closedBy === "client" || !runtime.reconnectOnClose) return "settled";
      return {
        retry: { attempt: retry.attempt, backoffMs: INITIAL_BACKOFF_MS, windowStartMs: undefined },
        failure: new Error("SSE connection closed by server"),
      };
    } catch (cycleFailure) {
      if (isAbortError(cycleFailure)) return "settled";
      if (cycleFailure instanceof SseRequestRejectedError) throw cycleFailure;
      if (cycleFailure instanceof CredentialTerminalError) throw cycleFailure;
      return { retry, failure: cycleFailure };
    }
  };

  const runFrom = async (retry: RetryState): Promise<void> => {
    const cycleEnding = await runAttemptCycle({
      attempt: retry.attempt + 1,
      backoffMs: retry.backoffMs,
      windowStartMs: retry.windowStartMs ?? runtime.now(),
    });
    if (cycleEnding === "settled") return;
    const backoffEnding = await backoffOrRethrow(cycleEnding);
    if (backoffEnding === "aborted") return;
    return runFrom(backoffEnding);
  };

  return {
    run: () => runFrom({ attempt: 0, backoffMs: INITIAL_BACKOFF_MS, windowStartMs: undefined }),
  };
};
