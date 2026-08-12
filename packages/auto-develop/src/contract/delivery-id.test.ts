import { describe, expect, test } from "vite-plus/test";

import { carriedDeliveryId } from "./delivery-id.ts";

const it = test
  .extend("carriedFromStringId", () => carriedDeliveryId({ delivery_id: "delivery-1" }))
  .extend("carriedFromAbsentId", () => carriedDeliveryId({}))
  .extend("carriedFromNumericId", () => carriedDeliveryId({ delivery_id: 1 }));

describe("carriedDeliveryId", () => {
  it("delivery_id が文字列なら引き継ぐ", ({ carriedFromStringId }) => {
    expect(carriedFromStringId).toStrictEqual({ deliveryId: "delivery-1" });
  });

  it("delivery_id が無ければ何も引き継がない", ({ carriedFromAbsentId }) => {
    expect(carriedFromAbsentId).toStrictEqual({});
  });

  it("delivery_id が文字列でなければ引き継がない", ({ carriedFromNumericId }) => {
    expect(carriedFromNumericId).toStrictEqual({});
  });
});
