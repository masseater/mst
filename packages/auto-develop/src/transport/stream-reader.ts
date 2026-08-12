import { splitFrames } from "./sse-frames.ts";

import type { FrameSink } from "./frame-sink.ts";

export type StreamReader = {
  readonly readStream: (body: ReadableStream<Uint8Array>) => Promise<"client" | "server">;
};

export const createStreamReader = (reading: {
  readonly readTimeoutMs: number;
  readonly isConnected: () => boolean;
  readonly frameSink: FrameSink;
}): StreamReader => {
  const readChunk = async (
    reader: ReadableStreamDefaultReader<Uint8Array>,
  ): Promise<{ readonly done: boolean; readonly value?: Uint8Array }> => {
    const timeoutHalt = new AbortController();
    const timeout = new Promise<never>((_resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("SSE read timeout"));
      }, reading.readTimeoutMs);
      timeoutHalt.signal.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
        },
        { once: true },
      );
    });
    try {
      return await Promise.race([reader.read(), timeout]);
    } finally {
      timeoutHalt.abort();
    }
  };

  const drainChunk = (draining: {
    readonly buffers: Map<string, string>;
    readonly decodedText: string;
  }): void => {
    const buffered = (draining.buffers.get("text") as string) + draining.decodedText;
    const { frames, rest } = splitFrames(buffered);
    draining.buffers.set("text", rest);
    for (const frame of frames) reading.frameSink.process(frame);
  };

  return {
    readStream: async (body) => {
      const reader = body.getReader();
      const decoder = new TextDecoder();
      const buffers = new Map<string, string>([["text", ""]]);
      try {
        for (;;) {
          if (!reading.isConnected()) return "client";
          const chunk = await readChunk(reader);
          if (chunk.done) return "server";
          drainChunk({ buffers, decodedText: decoder.decode(chunk.value, { stream: true }) });
        }
      } finally {
        reader.releaseLock();
      }
    },
  };
};
