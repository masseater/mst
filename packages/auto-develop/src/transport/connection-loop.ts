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

  const windowElapsedMs = (retry: Map<string, number>): number => {
    const windowStartMs = retry.get("windowStartMs") as number;
    return windowStartMs === -1 ? 0 : runtime.now() - windowStartMs;
  };

  const jitteredDelayMs = (retry: Map<string, number>): number => {
    const backoffMs = retry.get("backoffMs") as number;
    const jitteredMs = Math.max(
      1,
      Math.ceil(backoffMs + (runtime.random() * 2 - 1) * backoffMs * 0.5),
    );
    const remainingMs = Number.isFinite(runtime.retryDeadlineMs)
      ? runtime.retryDeadlineMs - windowElapsedMs(retry)
      : jitteredMs;
    return Math.min(jitteredMs, remainingMs);
  };

  const backoffOrRethrow = async (backing: {
    readonly retry: Map<string, number>;
    readonly failure: unknown;
  }): Promise<"slept" | "aborted"> => {
    const { retry, failure } = backing;
    if (windowElapsedMs(retry) >= runtime.retryDeadlineMs) throw failure;
    const delayMs = jitteredDelayMs(retry);
    runtime.diagnostics.write(
      `[sse-transport] Connection attempt ${retry.get("attempt")} failed, backing off ${delayMs}ms: ${String(failure)}\n`,
    );
    try {
      await runtime.sleep(delayMs, (controllers.get("current") as AbortController).signal);
    } catch (sleepFailure) {
      if (isAbortError(sleepFailure)) return "aborted";
      throw sleepFailure;
    }
    retry.set("backoffMs", Math.min((retry.get("backoffMs") as number) * 2, BACKOFF_CAP_MS));
    return "slept";
  };

  const runAttemptCycle = async (retry: Map<string, number>): Promise<void> => {
    retry.set("attempt", (retry.get("attempt") as number) + 1);
    if ((retry.get("windowStartMs") as number) === -1) retry.set("windowStartMs", runtime.now());
    const windowRemainingMs = Number.isFinite(runtime.retryDeadlineMs)
      ? runtime.retryDeadlineMs - windowElapsedMs(retry)
      : Number.POSITIVE_INFINITY;
    const closedBy = await attemptStream(windowRemainingMs);
    retry.set("backoffMs", INITIAL_BACKOFF_MS);
    retry.set("windowStartMs", -1);
    if (closedBy === "client" || !runtime.reconnectOnClose) return;
    throw new Error("SSE connection closed by server");
  };

  const run = async (): Promise<void> => {
    const retry = new Map<string, number>([
      ["attempt", 0],
      ["backoffMs", INITIAL_BACKOFF_MS],
      ["windowStartMs", -1],
    ]);
    for (;;) {
      try {
        await runAttemptCycle(retry);
        return;
      } catch (cycleFailure) {
        if (isAbortError(cycleFailure)) return;
        if (cycleFailure instanceof SseRequestRejectedError) throw cycleFailure;
        if (cycleFailure instanceof CredentialTerminalError) throw cycleFailure;
        const backoffEnding = await backoffOrRethrow({ retry, failure: cycleFailure });
        if (backoffEnding === "aborted") return;
      }
    }
  };

  return { run };
};
