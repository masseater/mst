import type { ServerResponse } from "node:http";
import type { SseSink } from "./sse.ts";

export const sseSinkFor = (res: ServerResponse): SseSink => {
  const writeOrThrow = (frame: string): void => {
    if (res.destroyed || res.writableEnded) throw new Error("sse connection is closed");
    res.write(frame);
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
