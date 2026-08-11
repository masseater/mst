import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";

import { describe, expect, test, vi } from "vite-plus/test";

import { sseSinkFor } from "./sse-sink.ts";

const detachedResponse = (): ServerResponse =>
  new ServerResponse(new IncomingMessage(new Socket()));

describe("sseSinkFor", () => {
  test("イベントフレームは event と data と id の並びで書かれる", () => {
    const streamResponse = detachedResponse();
    const writeSpy = vi.spyOn(streamResponse, "write");
    sseSinkFor(streamResponse).writeEvent({
      eventType: "pull_request",
      eventId: "delivery-1",
      envelopeJson: "{}",
    });
    expect(writeSpy).toHaveBeenCalledWith("event: pull_request\ndata: {}\nid: delivery-1\n\n");
  });

  test("keepalive は ping の空データフレームになる", () => {
    const streamResponse = detachedResponse();
    const writeSpy = vi.spyOn(streamResponse, "write");
    sseSinkFor(streamResponse).writeKeepalive();
    expect(writeSpy).toHaveBeenCalledWith("event: ping\ndata:\n\n");
  });

  test("応答が破棄済みなら書き込みは失敗として表面化する", () => {
    const streamResponse = detachedResponse();
    streamResponse.destroy();
    const sink = sseSinkFor(streamResponse);
    expect(() => {
      sink.writeKeepalive();
    }).toThrow("sse connection is closed");
  });
});
