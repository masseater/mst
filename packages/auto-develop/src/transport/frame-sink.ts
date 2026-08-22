import { unwrapEnvelope } from "../contract/envelope.ts";
import { ABSENT_VALUE_PLACEHOLDER } from "../runtime/absent-value-placeholder.ts";

import type { EventQueue } from "./event-queue.ts";
import type { SseFrame } from "./sse-frames.ts";

const parseUnknownJson = (raw: string): unknown => JSON.parse(raw);

export type FrameSink = {
  readonly process: (frame: SseFrame) => void;
};

type FrameSinkWiring = {
  readonly eventQueue: EventQueue;
  readonly resumePositions: Map<string, string>;
  readonly diagnostics: { readonly write: (chunk: string) => void };
  readonly knownIdLimit: number;
};

class DedupingFrameSink {
  #knownIds: ReadonlySet<string> = new Set<string>();

  readonly #sink: FrameSinkWiring;

  constructor(sink: FrameSinkWiring) {
    this.#sink = sink;
  }

  #rememberKnownId(frameId: string): void {
    const remembered = [...this.#knownIds, frameId];
    this.#knownIds = new Set(remembered.slice(remembered.length - this.#sink.knownIdLimit));
  }

  process(frame: SseFrame): void {
    if (frame.event === "ping") return;
    if (frame.id !== undefined && this.#knownIds.has(frame.id)) return;
    if (frame.id !== undefined) this.#rememberKnownId(frame.id);
    try {
      const flattened = unwrapEnvelope(parseUnknownJson(frame.data));
      if (frame.id !== undefined) this.#sink.resumePositions.set("last", frame.id);
      this.#sink.eventQueue.enqueue(flattened);
    } catch (frameFailure) {
      this.#sink.diagnostics.write(
        `[sse-transport] Failed to parse or validate frame payload (frameId=${frame.id ?? ABSENT_VALUE_PLACEHOLDER.none}): ${String(frameFailure)}\n`,
      );
    }
  }
}

export const createFrameSink = (sink: FrameSinkWiring): FrameSink => new DedupingFrameSink(sink);
