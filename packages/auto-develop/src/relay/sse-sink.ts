import type { ServerResponse } from "node:http";
import type { SseSink } from "./sse.ts";

export const sseSinkFor = (produced: ServerResponse): SseSink => {
  const writeOrThrow = (frame: string): void => {
    if (produced.destroyed || produced.writableEnded) throw new Error("sse connection is closed");
    produced.write(frame);
  };
  return {
    writeEvent: (frame) => {
      writeOrThrow(
        `event: ${frame.eventType}\ndata: ${frame.envelopeJson}\nid: ${frame.eventId}\n\n`,
      );
    },
    writeKeepalive: () => {
      writeOrThrow("event: ping\ndata:\n\n");
    },
  };
};
