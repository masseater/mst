import { describe, expect, test } from "vite-plus/test";

import { sealEnvelope, unwrapEnvelope, unwrapPollResponse } from "./envelope.ts";

const unwrapRejectionOf = (envelope: unknown): string => {
  try {
    unwrapEnvelope(envelope);
    return "no rejection";
  } catch (rejection) {
    return rejection instanceof Error ? rejection.name : typeof rejection;
  }
};

const pollRejectionOf = (produced: unknown): string => {
  try {
    unwrapPollResponse(produced);
    return "no rejection";
  } catch (rejection) {
    return rejection instanceof Error ? rejection.name : typeof rejection;
  }
};

const it = test
  .extend("flattenedPayload", () =>
    unwrapEnvelope(
      sealEnvelope({
        eventType: "pull_request",
        deliveryId: "delivery-1",
        payload: { action: "closed", pull_request: { number: 7 } },
      }),
    ))
  .extend("metadataOverriddenPayload", () =>
    unwrapEnvelope(
      sealEnvelope({
        eventType: "pull_request",
        deliveryId: "delivery-1",
        payload: { event_type: "spoofed", delivery_id: "spoofed" },
      }),
    ),
  )
  .extend("foreignSchemaVersionRejection", () =>
    unwrapRejectionOf({
      schema_version: 2,
      event_type: "pull_request",
      delivery_id: "d",
      payload: {},
    }),
  )
  .extend("schemaVersionLessRejection", () =>
    unwrapRejectionOf({ event_type: "pull_request", delivery_id: "d", payload: {} }),
  )
  .extend("eventTypeLessRejection", () =>
    unwrapRejectionOf({ schema_version: 1, delivery_id: "d", payload: {} }),
  )
  .extend("deliveryIdLessRejection", () =>
    unwrapRejectionOf({ schema_version: 1, event_type: "pull_request", payload: {} }),
  )
  .extend("payloadLessRejection", () =>
    unwrapRejectionOf({ schema_version: 1, event_type: "pull_request", delivery_id: "d" }),
  )
  .extend("arrayPayloadRejection", () =>
    unwrapRejectionOf({
      schema_version: 1,
      event_type: "pull_request",
      delivery_id: "d",
      payload: [],
    }),
  )
  .extend("nullEnvelopeRejection", () => unwrapRejectionOf(null))
  .extend("unwrappedPollEvents", () =>
    unwrapPollResponse({
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
    }),
  )
  .extend("emptyPollEvents", () => unwrapPollResponse({ events: [] }))
  .extend("nonArrayEventsRejection", () => pollRejectionOf({ events: "none" }))
  .extend("taintedPollRejection", () =>
    pollRejectionOf({
      events: [
        sealEnvelope({
          eventType: "pull_request",
          deliveryId: "delivery-1",
          payload: { action: "closed" },
        }),
        { schema_version: 2, event_type: "pull_request", delivery_id: "d", payload: {} },
      ],
    }),
  );

describe("sealEnvelope と unwrapEnvelope", () => {
  it("封筒に包んで展開すると payload が平坦化され封筒メタデータが合成される", ({
    flattenedPayload,
  }) => {
    expect(flattenedPayload).toStrictEqual({
      action: "closed",
      pull_request: { number: 7 },
      event_type: "pull_request",
      delivery_id: "delivery-1",
    });
  });

  it("payload 内の同名キーより封筒メタデータが勝つ", ({ metadataOverriddenPayload }) => {
    expect(metadataOverriddenPayload).toStrictEqual({
      event_type: "pull_request",
      delivery_id: "delivery-1",
    });
  });
});

describe("unwrapEnvelope の拒否", () => {
  it("schema_version が別の値なら拒否する", ({ foreignSchemaVersionRejection }) => {
    expect(foreignSchemaVersionRejection).toStrictEqual("InvalidEnvelopeError");
  });

  it("schema_version が欠けていれば拒否する", ({ schemaVersionLessRejection }) => {
    expect(schemaVersionLessRejection).toStrictEqual("InvalidEnvelopeError");
  });

  it("event_type が欠けていれば拒否する", ({ eventTypeLessRejection }) => {
    expect(eventTypeLessRejection).toStrictEqual("InvalidEnvelopeError");
  });

  it("delivery_id が欠けていれば拒否する", ({ deliveryIdLessRejection }) => {
    expect(deliveryIdLessRejection).toStrictEqual("InvalidEnvelopeError");
  });

  it("payload が欠けていれば拒否する", ({ payloadLessRejection }) => {
    expect(payloadLessRejection).toStrictEqual("InvalidEnvelopeError");
  });

  it("payload が配列なら拒否する", ({ arrayPayloadRejection }) => {
    expect(arrayPayloadRejection).toStrictEqual("InvalidEnvelopeError");
  });

  it("封筒自体が null なら拒否する", ({ nullEnvelopeRejection }) => {
    expect(nullEnvelopeRejection).toStrictEqual("InvalidEnvelopeError");
  });
});

describe("unwrapPollResponse", () => {
  it("複数の封筒を全て展開して返す", ({ unwrappedPollEvents }) => {
    expect(unwrappedPollEvents).toStrictEqual([
      { action: "closed", event_type: "pull_request", delivery_id: "delivery-1" },
      { action: "completed", event_type: "check_suite", delivery_id: "delivery-2" },
    ]);
  });

  it("空配列は空配列を返す", ({ emptyPollEvents }) => {
    expect(emptyPollEvents).toStrictEqual([]);
  });

  it("events が配列でなければ応答全体を拒否する", ({ nonArrayEventsRejection }) => {
    expect(nonArrayEventsRejection).toStrictEqual("InvalidEnvelopeError");
  });

  it("1 件でも不正な封筒を含めば応答全体を拒否する", ({ taintedPollRejection }) => {
    expect(taintedPollRejection).toStrictEqual("InvalidEnvelopeError");
  });
});
