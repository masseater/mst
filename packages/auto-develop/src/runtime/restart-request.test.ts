import { describe, expect, test, vi } from "vite-plus/test";

import { codeMovedOn, createRestartRequest } from "./restart-request.ts";

describe("createRestartRequest", () => {
  const it = test
    .extend("freshRequest", () => createRestartRequest({ onRequest: () => undefined }).requested())
    .extend("firstReason", () => {
      const restart = createRestartRequest({ onRequest: () => undefined });
      restart.request("code-updated");
      return restart.requested();
    })
    .extend("reasonAfterSecondRequest", () => {
      const restart = createRestartRequest({ onRequest: () => undefined });
      restart.request("code-updated");
      restart.request("idle");
      return restart.requested();
    })
    .extend("restartAnnouncer", () => {
      const announceRestart = vi.fn<(reason: "code-updated" | "idle") => void>();
      const restart = createRestartRequest({ onRequest: announceRestart });
      restart.request("idle");
      restart.request("code-updated");
      return announceRestart;
    });

  it("要求前は理由を持たない", ({ freshRequest }) => {
    expect(freshRequest).toStrictEqual(null);
  });

  it("最初の要求の理由を保持する", ({ firstReason }) => {
    expect(firstReason).toStrictEqual("code-updated");
  });

  it("2 回目の要求では理由を書き換えない", ({ reasonAfterSecondRequest }) => {
    expect(reasonAfterSecondRequest).toStrictEqual("code-updated");
  });

  it("最初の要求だけを理由つきで一度だけ通知する", ({ restartAnnouncer }) => {
    expect(restartAnnouncer).toHaveBeenCalledExactlyOnceWith("idle");
  });
});

describe("codeMovedOn", () => {
  const it = test
    .extend("movedOn", () => codeMovedOn({ startupCommit: "abc", currentCommit: "def" }))
    .extend("sameCommit", () => codeMovedOn({ startupCommit: "abc", currentCommit: "abc" }))
    .extend("unknownCommit", () => codeMovedOn({ startupCommit: "abc", currentCommit: null }));

  it("起動時と違うコミットなら再起動が要る", ({ movedOn }) => {
    expect(movedOn).toStrictEqual(true);
  });

  it("同じコミットなら再起動は要らない", ({ sameCommit }) => {
    expect(sameCommit).toStrictEqual(false);
  });

  it("現在のコミットが分からなければ再起動しない", ({ unknownCommit }) => {
    expect(unknownCommit).toStrictEqual(false);
  });
});
