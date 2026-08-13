import { describe, expect, test, vi } from "vite-plus/test";

import { CURSOR_TTL_MS } from "./durations.ts";
import { createMemoryCursorStore } from "./memory-cursor-store.ts";

describe("createMemoryCursorStore", () => {
  const it = test
    .extend("cursorAfterWrite", async () => {
      const cursorStore = createMemoryCursorStore();
      await cursorStore.write({ clientId: "octocat", eventId: "a" });
      return cursorStore.read("octocat");
    })
    .extend("cursorNeverWritten", () => createMemoryCursorStore().read("octocat"))
    .extend("cursorAfterExpiry", async () => {
      const stampedNow = vi
        .fn<() => number>()
        .mockReturnValueOnce(0)
        .mockReturnValue(CURSOR_TTL_MS);
      const cursorStore = createMemoryCursorStore(stampedNow);
      await cursorStore.write({ clientId: "octocat", eventId: "a" });
      return cursorStore.read("octocat");
    });

  it("書いたカーソルが読める", ({ cursorAfterWrite }) => {
    expect(cursorAfterWrite).toBe("a");
  });

  it("不在のカーソルは null になる", ({ cursorNeverWritten }) => {
    expect(cursorNeverWritten).toBe(null);
  });

  it("48 時間の期限が切れたカーソルは null になる", ({ cursorAfterExpiry }) => {
    expect(cursorAfterExpiry).toBe(null);
  });
});
