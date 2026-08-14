import { ABORT_SIGNAL_EVENT } from "../runtime/event-names.ts";
import { createConnectionLoop, type ConnectionRuntime } from "./connection-loop.ts";
import { createEventQueue } from "./event-queue.ts";
import { createFrameSink } from "./frame-sink.ts";
import { createStreamReader } from "./stream-reader.ts";

import type { Mode } from "../contract/vocabulary.ts";
import type { CredentialProvider } from "./credential-provider.ts";

const DEFAULT_READ_TIMEOUT_MS = 60_000;

const KNOWN_ID_LIMIT = 10_000;

export type SseTransport = {
  readonly connect: () => Promise<void>;
  readonly disconnect: () => void;
  readonly events: () => AsyncGenerator<Readonly<Record<string, unknown>>, void, undefined>;
};

class SleepAbortedError extends Error {
  override readonly name = "AbortError";

  constructor() {
    super("sse backoff sleep aborted");
  }
}

const defaultSleep = (delayMs: number, signal: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      resolve();
    }, delayMs);
    signal.addEventListener(
      ABORT_SIGNAL_EVENT.abort,
      () => {
        clearTimeout(timer);
        reject(new SleepAbortedError());
      },
      { once: true },
    );
  });

const DEFAULT_RETRY_DEADLINE_MS = 60_000;

export type SseTransportConfig = {
  readonly url: string;
  readonly credentials: CredentialProvider;
  readonly mode: Mode;
  readonly reconnectOnClose?: boolean;
  readonly readTimeoutMs?: number;
  readonly retryDeadlineMs?: number;
  readonly diagnostics?: { readonly write: (chunk: string) => void };
  readonly fetchImpl?: typeof fetch;
  readonly random?: () => number;
  readonly now?: () => number;
  readonly sleep?: (delayMs: number, signal: AbortSignal) => Promise<void>;
  readonly knownIdLimit?: number;
};

const resolveRuntime = (config: SseTransportConfig): ConnectionRuntime => {
  const streamUrl = new URL(config.url);
  streamUrl.searchParams.set("mode", config.mode);
  return {
    streamUrl: streamUrl.toString(),
    credentials: config.credentials,
    reconnectOnClose: config.reconnectOnClose !== false,
    retryDeadlineMs: config.retryDeadlineMs ?? DEFAULT_RETRY_DEADLINE_MS,
    diagnostics: config.diagnostics ?? process.stderr,
    fetchImpl: config.fetchImpl ?? fetch,
    random: config.random ?? Math.random,
    now: config.now ?? Date.now,
    sleep: config.sleep ?? defaultSleep,
  };
};

export const createSseTransport = (transportConfig: SseTransportConfig): SseTransport => {
  const runtime = resolveRuntime(transportConfig);
  const session = {
    flags: new Map<string, boolean>([["connected", false]]),
    controllers: new Map<string, AbortController>(),
    resumePositions: new Map<string, string>(),
  };
  const eventQueue = createEventQueue();
  const frameSink = createFrameSink({
    eventQueue,
    resumePositions: session.resumePositions,
    diagnostics: runtime.diagnostics,
    knownIdLimit: transportConfig.knownIdLimit ?? KNOWN_ID_LIMIT,
  });
  const streamReader = createStreamReader({
    readTimeoutMs: transportConfig.readTimeoutMs ?? DEFAULT_READ_TIMEOUT_MS,
    isConnected: () => session.flags.get("connected") === true,
    frameSink,
  });
  const connectionLoop = createConnectionLoop({
    runtime,
    controllers: session.controllers,
    resumePositions: session.resumePositions,
    streamReader,
  });

  const connect = async (): Promise<void> => {
    if (session.flags.get("connected") === true) return;
    session.flags.set("connected", true);
    try {
      await connectionLoop.run();
    } finally {
      session.flags.set("connected", false);
      eventQueue.wake();
    }
  };

  const disconnect = (): void => {
    session.flags.set("connected", false);
    session.controllers.get("current")?.abort();
    eventQueue.wake();
  };

  const streamed = async function* (): AsyncGenerator<
    Readonly<Record<string, unknown>>,
    void,
    undefined
  > {
    for (;;) {
      const queued = eventQueue.take();
      if (queued !== null) {
        yield queued;
        continue;
      }
      if (session.flags.get("connected") !== true) return;
      await eventQueue.waitForWake();
    }
  };

  return { connect, disconnect, events: streamed };
};
