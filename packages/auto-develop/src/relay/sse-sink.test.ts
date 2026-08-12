import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";

import { describe, expect, test, vi } from "vite-plus/test";

import { sseSinkFor } from "./sse-sink.ts";

const detachedResponse = (): ServerResponse =>
  new ServerResponse(new IncomingMessage(new Socket()));

const it = test
  .extend("eventFrameWriteSpy", () => {
    const streamResponse = detachedResponse();
    const writeSpy = vi.spyOn(streamResponse, "write");
    sseSinkFor(streamResponse).writeEvent({
      eventType: "pull_request",
      eventId: "delivery-1",
      envelopeJson: "{}",
    });
    return writeSpy;
  })
  .extend("keepaliveFrameWriteSpy", () => {
    const streamResponse = detachedResponse();
    const writeSpy = vi.spyOn(streamResponse, "write");
    sseSinkFor(streamResponse).writeKeepalive();
    return writeSpy;
  })
  .extend("rejectionForDestroyedResponse", (): Error | undefined => {
    const streamResponse = detachedResponse();
    streamResponse.destroy();
    const sink = sseSinkFor(streamResponse);
    try {
      sink.writeKeepalive();
      return undefined;
    } catch (thrown) {
      return thrown instanceof Error ? thrown : undefined;
    }
  });

describe("sseSinkFor", () => {
  it("イベントフレームは event と data と id の並びで書かれる", ({ eventFrameWriteSpy }) => {
    expect(eventFrameWriteSpy).toHaveBeenCalledWith(
      "event: pull_request\ndata: {}\nid: delivery-1\n\n",
    );
  });

  it("keepalive は ping の空データフレームになる", ({ keepaliveFrameWriteSpy }) => {
    expect(keepaliveFrameWriteSpy).toHaveBeenCalledWith("event: ping\ndata:\n\n");
  });

  it("応答が破棄済みなら書き込みは失敗として表面化する", ({ rejectionForDestroyedResponse }) => {
    expect(rejectionForDestroyedResponse?.message).toContain("sse connection is closed");
  });
});
