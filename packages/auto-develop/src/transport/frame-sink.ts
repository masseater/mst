import { unwrapEnvelope } from "../contract/envelope.ts";
import { ABSENT_VALUE_PLACEHOLDER } from "../runtime/absent-value-placeholder.ts";

import type { EventQueue } from "./event-queue.ts";
import type { SseFrame } from "./sse-frames.ts";

const parseUnknownJson = (raw: string): unknown => JSON.parse(raw);

export type FrameSink = {
  readonly process: (frame: SseFrame) => void;
};

export const createFrameSink = (sink: {
  readonly eventQueue: EventQueue;
  readonly resumePositions: Map<string, string>;
  readonly diagnostics: { readonly write: (chunk: string) => void };
  readonly knownIdLimit: number;
}): FrameSink => {
  const knownIds = new Set<string>();

  const rememberKnownId = (frameId: string): void => {
    knownIds.add(frameId);
    for (const oldestId of knownIds) {
      if (knownIds.size <= sink.knownIdLimit) break;
      knownIds.delete(oldestId);
    }
  };

  return {
    process: (frame) => {
      if (frame.event === "ping") return;
      if (frame.id !== undefined && knownIds.has(frame.id)) return;
      if (frame.id !== undefined) rememberKnownId(frame.id);
      try {
        const flattened = unwrapEnvelope(parseUnknownJson(frame.data));
        if (frame.id !== undefined) sink.resumePositions.set("last", frame.id);
        sink.eventQueue.enqueue(flattened);
      } catch (frameFailure) {
        sink.diagnostics.write(
          `[sse-transport] Failed to parse or validate frame payload (frameId=${frame.id ?? ABSENT_VALUE_PLACEHOLDER.none}): ${String(frameFailure)}\n`,
        );
      }
    },
  };
};
