import { describe, expect, test } from "vite-plus/test";

import { silentLogger } from "../logging/logger.ts";
import { syncMain } from "./main-sync.ts";

import type { GitRunner } from "./git-runner.ts";

const scriptedGit = (
  producedByCommand: Readonly<
    Record<string, { readonly stdout?: string; readonly fail?: boolean }>
  >,
): { readonly git: GitRunner; readonly calls: () => readonly string[] } => {
  const recorded = new Map<number, string>();
  const git: GitRunner = {
    run: (invocation) => {
      const named = invocation.args.join(" ");
      recorded.set(recorded.size, named);
      const scriptedOutput = producedByCommand[named];
      if (scriptedOutput?.fail === true) return Promise.reject(new Error(`git failed: ${named}`));
      return Promise.resolve({ stdout: scriptedOutput?.stdout ?? "", stderr: "" });
    },
  };
  return { git, calls: () => [...recorded.values()] };
};

const it = test
  .extend("alreadyOnTargetCalls", async () => {
    const { git, calls } = scriptedGit({
      "rev-parse --show-toplevel": { stdout: "/repo\n" },
      "rev-parse --abbrev-ref HEAD": { stdout: "main\n" },
    });
    await syncMain({ git, startDir: "/repo/sub", log: silentLogger });
    return calls();
  })
  .extend("otherBranchCalls", async () => {
    const { git, calls } = scriptedGit({
      "rev-parse --show-toplevel": { stdout: "/repo\n" },
      "rev-parse --abbrev-ref HEAD": { stdout: "topic/x\n" },
    });
    await syncMain({ git, startDir: "/repo", log: silentLogger });
    return calls();
  })
  .extend("detachedHeadCalls", async () => {
    const { git, calls } = scriptedGit({
      "rev-parse --show-toplevel": { stdout: "/repo\n" },
      "rev-parse --abbrev-ref HEAD": { stdout: "HEAD\n" },
    });
    await syncMain({ git, startDir: "/repo", log: silentLogger });
    return calls();
  })
  .extend("customTargetCalls", async () => {
    const { git, calls } = scriptedGit({
      "rev-parse --show-toplevel": { stdout: "/repo\n" },
      "rev-parse --abbrev-ref HEAD": { stdout: "main\n" },
    });
    await syncMain({ git, startDir: "/repo", targetBranch: "develop", log: silentLogger });
    return calls();
  })
  .extend(
    "checkoutFailureRun",
    async (): Promise<{ readonly caught: Error | null; readonly calls: readonly string[] }> => {
      const { git, calls } = scriptedGit({
        "rev-parse --show-toplevel": { stdout: "/repo\n" },
        "rev-parse --abbrev-ref HEAD": { stdout: "topic/x\n" },
        "checkout --force main": { fail: true },
      });
      try {
        await syncMain({ git, startDir: "/repo", log: silentLogger });
        return { caught: null, calls: calls() };
      } catch (syncFailure) {
        return { caught: syncFailure instanceof Error ? syncFailure : null, calls: calls() };
      }
    },
  )
  .extend(
    "fetchFailureRun",
    async (): Promise<{ readonly caught: Error | null; readonly calls: readonly string[] }> => {
      const { git, calls } = scriptedGit({
        "rev-parse --show-toplevel": { stdout: "/repo\n" },
        "rev-parse --abbrev-ref HEAD": { stdout: "main\n" },
        "fetch origin": { fail: true },
      });
      try {
        await syncMain({ git, startDir: "/repo", log: silentLogger });
        return { caught: null, calls: calls() };
      } catch (syncFailure) {
        return { caught: syncFailure instanceof Error ? syncFailure : null, calls: calls() };
      }
    },
  );

describe("syncMain", () => {
  it("既に対象ブランチ上ならチェックアウトせず fetch と reset だけ行う", ({
    alreadyOnTargetCalls,
  }) => {
    expect(alreadyOnTargetCalls).toStrictEqual([
      "rev-parse --show-toplevel",
      "rev-parse --abbrev-ref HEAD",
      "fetch origin",
      "reset --hard origin/main",
    ]);
  });

  it("別ブランチ上なら先に強制チェックアウトする", ({ otherBranchCalls }) => {
    expect(otherBranchCalls).toStrictEqual([
      "rev-parse --show-toplevel",
      "rev-parse --abbrev-ref HEAD",
      "checkout --force main",
      "fetch origin",
      "reset --hard origin/main",
    ]);
  });

  it("detached HEAD は不一致となりチェックアウト経由で復帰する", ({ detachedHeadCalls }) => {
    expect(detachedHeadCalls).toContain("checkout --force main");
  });

  it("対象ブランチは引数で差し替えられる", ({ customTargetCalls }) => {
    expect(customTargetCalls).toStrictEqual([
      "rev-parse --show-toplevel",
      "rev-parse --abbrev-ref HEAD",
      "checkout --force develop",
      "fetch origin",
      "reset --hard origin/develop",
    ]);
  });

  it("チェックアウト失敗は伝播する", ({ checkoutFailureRun }) => {
    expect(checkoutFailureRun.caught?.message).toStrictEqual("git failed: checkout --force main");
  });

  it("チェックアウト失敗なら fetch しない", ({ checkoutFailureRun }) => {
    expect(checkoutFailureRun.calls).not.toContain("fetch origin");
  });

  it("fetch 失敗は伝播する", ({ fetchFailureRun }) => {
    expect(fetchFailureRun.caught?.message).toStrictEqual("git failed: fetch origin");
  });

  it("fetch 失敗なら reset しない", ({ fetchFailureRun }) => {
    expect(fetchFailureRun.calls).not.toContain("reset --hard origin/main");
  });
});
