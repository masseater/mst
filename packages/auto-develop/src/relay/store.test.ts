import { describe, expect, test } from "vite-plus/test";

import { TransientStoreError } from "./store.ts";

const it = test.extend("storeOutage", () => new TransientStoreError("store unavailable"));

describe("TransientStoreError", () => {
  it("一時的なストア障害として名前を持つ", ({ storeOutage }) => {
    expect(storeOutage.name).toStrictEqual("TransientStoreError");
  });

  it("一時的なストア障害として理由を持つ", ({ storeOutage }) => {
    expect(storeOutage.message).toStrictEqual("store unavailable");
  });
});
