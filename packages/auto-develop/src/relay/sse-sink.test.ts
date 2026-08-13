import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";

import { describe, expect, test, vi } from "vite-plus/test";

import { sseSinkFor } from "./sse-sink.ts";

describe("sseSinkFor", () => {
  const it = test
    .extend("eventFrameWriteSpy", () => {
      const streamResponse = new ServerResponse(new IncomingMessage(new Socket()));
      const writeSpy = vi.spyOn(streamResponse, "write");
      sseSinkFor(streamResponse).writeEvent({
        eventType: "pull_request",
        eventId: "delivery-1",
        envelopeJson: "{}",
      });
      return writeSpy;
    })
    .extend("keepaliveFrameWriteSpy", () => {
      const streamResponse = new ServerResponse(new IncomingMessage(new Socket()));
      const writeSpy = vi.spyOn(streamResponse, "write");
      sseSinkFor(streamResponse).writeKeepalive();
      return writeSpy;
    })
    .extend("keepaliveRejectionAfterDestroy", () => {
      const streamResponse = new ServerResponse(new IncomingMessage(new Socket()));
      streamResponse.destroy();
      try {
        sseSinkFor(streamResponse).writeKeepalive();
      } catch (thrown) {
        return thrown;
      }
      throw new Error("writeKeepalive resolved on a destroyed response");
    });

  it("イベントフレームは event と data と id の並びで書かれる", ({ eventFrameWriteSpy }) => {
    expect(eventFrameWriteSpy).toHaveBeenCalledWith(
      "event: pull_request\ndata: {}\nid: delivery-1\n\n",
    );
  });

  it("keepalive は ping の空データフレームになる", ({ keepaliveFrameWriteSpy }) => {
    expect(keepaliveFrameWriteSpy).toHaveBeenCalledWith("event: ping\ndata:\n\n");
  });

  it("応答が破棄済みなら書き込みは失敗として表面化する", ({ keepaliveRejectionAfterDestroy }) => {
    expect(keepaliveRejectionAfterDestroy).toStrictEqual(new Error("sse connection is closed"));
  });
});
