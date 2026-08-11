import { describe, expect, test } from "vite-plus/test";

import { TransientStoreError } from "./store.ts";

describe("TransientStoreError", () => {
  test("一時的なストア障害として名前と理由を持つ", () => {
    const outage = new TransientStoreError("store unavailable");
    expect([outage.name, outage.message]).toStrictEqual([
      "TransientStoreError",
      "store unavailable",
    ]);
  });
});
