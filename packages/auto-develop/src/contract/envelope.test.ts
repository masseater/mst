import { describe, expect, test } from "vite-plus/test";

import {
  InvalidEnvelopeError,
  sealEnvelope,
  unwrapEnvelope,
  unwrapPollResponse,
} from "./envelope.ts";

describe("sealEnvelope と unwrapEnvelope", () => {
  test("封筒に包んで展開すると payload が平坦化され封筒メタデータが合成される", () => {
    const envelope = sealEnvelope({
      eventType: "pull_request",
      deliveryId: "delivery-1",
      payload: { action: "closed", pull_request: { number: 7 } },
    });
    expect(unwrapEnvelope(envelope)).toStrictEqual({
      action: "closed",
      pull_request: { number: 7 },
      event_type: "pull_request",
      delivery_id: "delivery-1",
    });
  });

  test("payload 内の同名キーより封筒メタデータが勝つ", () => {
    const envelope = sealEnvelope({
      eventType: "pull_request",
      deliveryId: "delivery-1",
      payload: { event_type: "spoofed", delivery_id: "spoofed" },
    });
    expect(unwrapEnvelope(envelope)).toStrictEqual({
      event_type: "pull_request",
      delivery_id: "delivery-1",
    });
  });
});

describe("unwrapEnvelope の拒否", () => {
  test("schema_version が別の値なら拒否する", () => {
    const envelope = {
      schema_version: 2,
      event_type: "pull_request",
      delivery_id: "d",
      payload: {},
    };
    expect(() => unwrapEnvelope(envelope)).toThrow(InvalidEnvelopeError);
  });

  test("schema_version が欠けていれば拒否する", () => {
    const envelope = { event_type: "pull_request", delivery_id: "d", payload: {} };
    expect(() => unwrapEnvelope(envelope)).toThrow(InvalidEnvelopeError);
  });

  test("event_type が欠けていれば拒否する", () => {
    const envelope = { schema_version: 1, delivery_id: "d", payload: {} };
    expect(() => unwrapEnvelope(envelope)).toThrow(InvalidEnvelopeError);
  });

  test("delivery_id が欠けていれば拒否する", () => {
    const envelope = { schema_version: 1, event_type: "pull_request", payload: {} };
    expect(() => unwrapEnvelope(envelope)).toThrow(InvalidEnvelopeError);
  });

  test("payload が欠けていれば拒否する", () => {
    const envelope = { schema_version: 1, event_type: "pull_request", delivery_id: "d" };
    expect(() => unwrapEnvelope(envelope)).toThrow(InvalidEnvelopeError);
  });

  test("payload が配列なら拒否する", () => {
    const envelope = {
      schema_version: 1,
      event_type: "pull_request",
      delivery_id: "d",
      payload: [],
    };
    expect(() => unwrapEnvelope(envelope)).toThrow(InvalidEnvelopeError);
  });

  test("封筒自体が null なら拒否する", () => {
    expect(() => unwrapEnvelope(null)).toThrow(InvalidEnvelopeError);
  });
});

describe("unwrapPollResponse", () => {
  test("複数の封筒を全て展開して返す", () => {
    const response = {
      events: [
        sealEnvelope({
          eventType: "pull_request",
          deliveryId: "delivery-1",
          payload: { action: "closed" },
        }),
        sealEnvelope({
          eventType: "check_suite",
          deliveryId: "delivery-2",
          payload: { action: "completed" },
        }),
      ],
    };
    expect(unwrapPollResponse(response)).toStrictEqual([
      { action: "closed", event_type: "pull_request", delivery_id: "delivery-1" },
      { action: "completed", event_type: "check_suite", delivery_id: "delivery-2" },
    ]);
  });

  test("空配列は空配列を返す", () => {
    expect(unwrapPollResponse({ events: [] })).toStrictEqual([]);
  });

  test("events が配列でなければ応答全体を拒否する", () => {
    expect(() => unwrapPollResponse({ events: "none" })).toThrow(InvalidEnvelopeError);
  });

  test("1 件でも不正な封筒を含めば応答全体を拒否する", () => {
    const response = {
      events: [
        sealEnvelope({
          eventType: "pull_request",
          deliveryId: "delivery-1",
          payload: { action: "closed" },
        }),
        { schema_version: 2, event_type: "pull_request", delivery_id: "d", payload: {} },
      ],
    };
    expect(() => unwrapPollResponse(response)).toThrow(InvalidEnvelopeError);
  });
});
