import { describe, expect, test } from "vite-plus/test";

import { TransientStoreError } from "./store.ts";

describe("TransientStoreError", () => {
  describe("投げられた一時的なストア障害を捕捉する", () => {
    const it = test.extend("caughtStoreOutageIsError", (): boolean => {
      try {
        throw new TransientStoreError("store unavailable");
      } catch (storeFailure) {
        return storeFailure instanceof Error;
      }
    });

    it("捕捉した側の Error による絞り込みに掛かる", ({ caughtStoreOutageIsError }) => {
      expect(caughtStoreOutageIsError).toBe(true);
    });
  });

  describe("一時的なストア障害を記録へ書き出す", () => {
    const it = test.extend("writtenStoreOutage", () =>
      String(new TransientStoreError("store unavailable")));

    it("記録には障害の名前と理由が並ぶ", ({ writtenStoreOutage }) => {
      expect(writtenStoreOutage).toBe("TransientStoreError: store unavailable");
    });
  });
});
