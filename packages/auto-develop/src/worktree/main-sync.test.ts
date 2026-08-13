import { describe, expect, test, vi } from "vite-plus/test";

import { silentLogger } from "../logging/logger.ts";
import { syncMain } from "./main-sync.ts";

import type { GitRunner } from "./git-runner.ts";

describe("syncMain", () => {
  const it = test
    .extend("alreadyOnTargetGitRun", async () => {
      const gitRun = vi
        .fn<GitRunner["run"]>()
        .mockResolvedValue({ stdout: "", stderr: "" })
        .mockResolvedValueOnce({ stdout: "/repo\n", stderr: "" })
        .mockResolvedValueOnce({ stdout: "main\n", stderr: "" });
      await syncMain({ git: { run: gitRun }, startDir: "/repo/sub", log: silentLogger });
      return gitRun;
    })
    .extend("otherBranchGitRun", async () => {
      const gitRun = vi
        .fn<GitRunner["run"]>()
        .mockResolvedValue({ stdout: "", stderr: "" })
        .mockResolvedValueOnce({ stdout: "/repo\n", stderr: "" })
        .mockResolvedValueOnce({ stdout: "topic/x\n", stderr: "" });
      await syncMain({ git: { run: gitRun }, startDir: "/repo", log: silentLogger });
      return gitRun;
    })
    .extend("detachedHeadGitRun", async () => {
      const gitRun = vi
        .fn<GitRunner["run"]>()
        .mockResolvedValue({ stdout: "", stderr: "" })
        .mockResolvedValueOnce({ stdout: "/repo\n", stderr: "" })
        .mockResolvedValueOnce({ stdout: "HEAD\n", stderr: "" });
      await syncMain({ git: { run: gitRun }, startDir: "/repo", log: silentLogger });
      return gitRun;
    })
    .extend("customTargetGitRun", async () => {
      const gitRun = vi
        .fn<GitRunner["run"]>()
        .mockResolvedValue({ stdout: "", stderr: "" })
        .mockResolvedValueOnce({ stdout: "/repo\n", stderr: "" })
        .mockResolvedValueOnce({ stdout: "main\n", stderr: "" });
      await syncMain({
        git: { run: gitRun },
        startDir: "/repo",
        targetBranch: "develop",
        log: silentLogger,
      });
      return gitRun;
    })
    .extend("checkoutFailureSettlements", () => {
      const gitRun = vi
        .fn<GitRunner["run"]>()
        .mockResolvedValue({ stdout: "", stderr: "" })
        .mockResolvedValueOnce({ stdout: "/repo\n", stderr: "" })
        .mockResolvedValueOnce({ stdout: "topic/x\n", stderr: "" })
        .mockRejectedValueOnce(new Error("git failed: checkout --force main"));
      return Promise.allSettled([
        syncMain({ git: { run: gitRun }, startDir: "/repo", log: silentLogger }),
      ]);
    })
    .extend("checkoutFailureGitRun", async () => {
      const gitRun = vi
        .fn<GitRunner["run"]>()
        .mockResolvedValue({ stdout: "", stderr: "" })
        .mockResolvedValueOnce({ stdout: "/repo\n", stderr: "" })
        .mockResolvedValueOnce({ stdout: "topic/x\n", stderr: "" })
        .mockRejectedValueOnce(new Error("git failed: checkout --force main"));
      await Promise.allSettled([
        syncMain({ git: { run: gitRun }, startDir: "/repo", log: silentLogger }),
      ]);
      return gitRun;
    })
    .extend("fetchFailureSettlements", () => {
      const gitRun = vi
        .fn<GitRunner["run"]>()
        .mockResolvedValue({ stdout: "", stderr: "" })
        .mockResolvedValueOnce({ stdout: "/repo\n", stderr: "" })
        .mockResolvedValueOnce({ stdout: "main\n", stderr: "" })
        .mockRejectedValueOnce(new Error("git failed: fetch origin"));
      return Promise.allSettled([
        syncMain({ git: { run: gitRun }, startDir: "/repo", log: silentLogger }),
      ]);
    })
    .extend("fetchFailureGitRun", async () => {
      const gitRun = vi
        .fn<GitRunner["run"]>()
        .mockResolvedValue({ stdout: "", stderr: "" })
        .mockResolvedValueOnce({ stdout: "/repo\n", stderr: "" })
        .mockResolvedValueOnce({ stdout: "main\n", stderr: "" })
        .mockRejectedValueOnce(new Error("git failed: fetch origin"));
      await Promise.allSettled([
        syncMain({ git: { run: gitRun }, startDir: "/repo", log: silentLogger }),
      ]);
      return gitRun;
    });

  it("既に対象ブランチ上なら起点ディレクトリでリポジトリルートを問い合わせる", ({
    alreadyOnTargetGitRun,
  }) => {
    expect(alreadyOnTargetGitRun).toHaveBeenNthCalledWith(1, {
      args: ["rev-parse", "--show-toplevel"],
      cwd: "/repo/sub",
    });
  });

  it("既に対象ブランチ上ならリポジトリルートで現在のブランチを問い合わせる", ({
    alreadyOnTargetGitRun,
  }) => {
    expect(alreadyOnTargetGitRun).toHaveBeenNthCalledWith(2, {
      args: ["rev-parse", "--abbrev-ref", "HEAD"],
      cwd: "/repo",
    });
  });

  it("既に対象ブランチ上ならチェックアウトを挟まず fetch へ進む", ({ alreadyOnTargetGitRun }) => {
    expect(alreadyOnTargetGitRun).toHaveBeenNthCalledWith(3, {
      args: ["fetch", "origin"],
      cwd: "/repo",
    });
  });

  it("既に対象ブランチ上なら fetch の次に対象ブランチへ reset する", ({
    alreadyOnTargetGitRun,
  }) => {
    expect(alreadyOnTargetGitRun).toHaveBeenNthCalledWith(4, {
      args: ["reset", "--hard", "origin/main"],
      cwd: "/repo",
    });
  });

  it("既に対象ブランチ上なら git 呼び出しは 4 回で終わる", ({ alreadyOnTargetGitRun }) => {
    expect(alreadyOnTargetGitRun).toHaveBeenCalledTimes(4);
  });

  it("別ブランチ上でも起点ディレクトリでリポジトリルートを問い合わせる", ({
    otherBranchGitRun,
  }) => {
    expect(otherBranchGitRun).toHaveBeenNthCalledWith(1, {
      args: ["rev-parse", "--show-toplevel"],
      cwd: "/repo",
    });
  });

  it("別ブランチ上でもリポジトリルートで現在のブランチを問い合わせる", ({ otherBranchGitRun }) => {
    expect(otherBranchGitRun).toHaveBeenNthCalledWith(2, {
      args: ["rev-parse", "--abbrev-ref", "HEAD"],
      cwd: "/repo",
    });
  });

  it("別ブランチ上なら fetch より先に強制チェックアウトする", ({ otherBranchGitRun }) => {
    expect(otherBranchGitRun).toHaveBeenNthCalledWith(3, {
      args: ["checkout", "--force", "main"],
      cwd: "/repo",
    });
  });

  it("別ブランチ上ならチェックアウトの次に fetch する", ({ otherBranchGitRun }) => {
    expect(otherBranchGitRun).toHaveBeenNthCalledWith(4, {
      args: ["fetch", "origin"],
      cwd: "/repo",
    });
  });

  it("別ブランチ上なら fetch の次に対象ブランチへ reset する", ({ otherBranchGitRun }) => {
    expect(otherBranchGitRun).toHaveBeenNthCalledWith(5, {
      args: ["reset", "--hard", "origin/main"],
      cwd: "/repo",
    });
  });

  it("別ブランチ上なら git 呼び出しは 5 回で終わる", ({ otherBranchGitRun }) => {
    expect(otherBranchGitRun).toHaveBeenCalledTimes(5);
  });

  it("detached HEAD は不一致となりチェックアウト経由で復帰する", ({ detachedHeadGitRun }) => {
    expect(detachedHeadGitRun).toHaveBeenNthCalledWith(3, {
      args: ["checkout", "--force", "main"],
      cwd: "/repo",
    });
  });

  it("対象ブランチを差し替えても起点ディレクトリでリポジトリルートを問い合わせる", ({
    customTargetGitRun,
  }) => {
    expect(customTargetGitRun).toHaveBeenNthCalledWith(1, {
      args: ["rev-parse", "--show-toplevel"],
      cwd: "/repo",
    });
  });

  it("対象ブランチを差し替えてもリポジトリルートで現在のブランチを問い合わせる", ({
    customTargetGitRun,
  }) => {
    expect(customTargetGitRun).toHaveBeenNthCalledWith(2, {
      args: ["rev-parse", "--abbrev-ref", "HEAD"],
      cwd: "/repo",
    });
  });

  it("差し替えた対象ブランチへ強制チェックアウトする", ({ customTargetGitRun }) => {
    expect(customTargetGitRun).toHaveBeenNthCalledWith(3, {
      args: ["checkout", "--force", "develop"],
      cwd: "/repo",
    });
  });

  it("対象ブランチを差し替えてもチェックアウトの次に fetch する", ({ customTargetGitRun }) => {
    expect(customTargetGitRun).toHaveBeenNthCalledWith(4, {
      args: ["fetch", "origin"],
      cwd: "/repo",
    });
  });

  it("差し替えた対象ブランチの上流へ reset する", ({ customTargetGitRun }) => {
    expect(customTargetGitRun).toHaveBeenNthCalledWith(5, {
      args: ["reset", "--hard", "origin/develop"],
      cwd: "/repo",
    });
  });

  it("対象ブランチを差し替えても git 呼び出しは 5 回で終わる", ({ customTargetGitRun }) => {
    expect(customTargetGitRun).toHaveBeenCalledTimes(5);
  });

  it("チェックアウト失敗は呼び出し元へ伝わる", ({ checkoutFailureSettlements }) => {
    expect(checkoutFailureSettlements).toStrictEqual([
      { reason: new Error("git failed: checkout --force main"), status: "rejected" },
    ]);
  });

  it("チェックアウト失敗なら fetch しない", ({ checkoutFailureGitRun }) => {
    expect(checkoutFailureGitRun).not.toHaveBeenCalledWith({
      args: ["fetch", "origin"],
      cwd: "/repo",
    });
  });

  it("fetch 失敗は呼び出し元へ伝わる", ({ fetchFailureSettlements }) => {
    expect(fetchFailureSettlements).toStrictEqual([
      { reason: new Error("git failed: fetch origin"), status: "rejected" },
    ]);
  });

  it("fetch 失敗なら reset しない", ({ fetchFailureGitRun }) => {
    expect(fetchFailureGitRun).not.toHaveBeenCalledWith({
      args: ["reset", "--hard", "origin/main"],
      cwd: "/repo",
    });
  });
});
