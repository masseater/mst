import { describe, expect, test } from "vite-plus/test";

import { createMemorySessionStore } from "./memory-session-store.ts";

describe("createMemorySessionStore", () => {
  const it = test
    .extend("sessionAfterSave", async () => {
      const sessionStore = createMemorySessionStore();
      await sessionStore.save({ digest: "digest-a", login: "octocat", expiresAtMs: 2_000_000 });
      return sessionStore.resolve("digest-a");
    })
    .extend("sessionForMissingDigest", () => createMemorySessionStore().resolve("missing"));

  it("保存したセッションが digest で解決できる", ({ sessionAfterSave }) => {
    expect(sessionAfterSave).toStrictEqual({ login: "octocat", expiresAtMs: 2_000_000 });
  });

  it("不在の digest は null になる", ({ sessionForMissingDigest }) => {
    expect(sessionForMissingDigest).toBe(null);
  });
});
