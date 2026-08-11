import { describe, expect, test } from "vite-plus/test";

import { carriedDeliveryId } from "./delivery-id.ts";

describe("carriedDeliveryId", () => {
  test("delivery_id が文字列なら引き継ぐ", () => {
    expect(carriedDeliveryId({ delivery_id: "delivery-1" })).toStrictEqual({
      deliveryId: "delivery-1",
    });
  });

  test("delivery_id が無ければ何も引き継がない", () => {
    expect(carriedDeliveryId({})).toStrictEqual({});
  });

  test("delivery_id が文字列でなければ引き継がない", () => {
    expect(carriedDeliveryId({ delivery_id: 1 })).toStrictEqual({});
  });
});
