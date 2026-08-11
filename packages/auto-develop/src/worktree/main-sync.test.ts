import { describe, expect, test } from "vite-plus/test";

import { silentLogger } from "../logging/logger.ts";
import { syncMain } from "./main-sync.ts";

import type { GitRunner } from "./git-runner.ts";

const scriptedGit = (
  outputs: Readonly<Record<string, { readonly stdout?: string; readonly fail?: boolean }>>,
): { readonly git: GitRunner; readonly calls: () => readonly string[] } => {
  const recorded = new Map<number, string>();
  const git: GitRunner = {
    run: (invocation) => {
      const key = invocation.args.join(" ");
      recorded.set(recorded.size, key);
      const scriptedOutput = outputs[key];
      if (scriptedOutput?.fail === true) return Promise.reject(new Error(`git failed: ${key}`));
      return Promise.resolve({ stdout: scriptedOutput?.stdout ?? "", stderr: "" });
    },
  };
  return { git, calls: () => [...recorded.values()] };
};

describe("syncMain", () => {
  test("既に対象ブランチ上ならチェックアウトせず fetch と reset だけ行う", async () => {
    const { git, calls } = scriptedGit({
      "rev-parse --show-toplevel": { stdout: "/repo\n" },
      "rev-parse --abbrev-ref HEAD": { stdout: "main\n" },
    });
    await syncMain({ git, startDir: "/repo/sub", log: silentLogger });
    expect(calls()).toStrictEqual([
      "rev-parse --show-toplevel",
      "rev-parse --abbrev-ref HEAD",
      "fetch origin",
      "reset --hard origin/main",
    ]);
  });

  test("別ブランチ上なら先に強制チェックアウトする", async () => {
    const { git, calls } = scriptedGit({
      "rev-parse --show-toplevel": { stdout: "/repo\n" },
      "rev-parse --abbrev-ref HEAD": { stdout: "topic/x\n" },
    });
    await syncMain({ git, startDir: "/repo", log: silentLogger });
    expect(calls()).toStrictEqual([
      "rev-parse --show-toplevel",
      "rev-parse --abbrev-ref HEAD",
      "checkout --force main",
      "fetch origin",
      "reset --hard origin/main",
    ]);
  });

  test("detached HEAD は不一致となりチェックアウト経由で復帰する", async () => {
    const { git, calls } = scriptedGit({
      "rev-parse --show-toplevel": { stdout: "/repo\n" },
      "rev-parse --abbrev-ref HEAD": { stdout: "HEAD\n" },
    });
    await syncMain({ git, startDir: "/repo", log: silentLogger });
    expect(calls()).toContain("checkout --force main");
  });

  test("対象ブランチは引数で差し替えられる", async () => {
    const { git, calls } = scriptedGit({
      "rev-parse --show-toplevel": { stdout: "/repo\n" },
      "rev-parse --abbrev-ref HEAD": { stdout: "main\n" },
    });
    await syncMain({ git, startDir: "/repo", targetBranch: "develop", log: silentLogger });
    expect(calls()).toStrictEqual([
      "rev-parse --show-toplevel",
      "rev-parse --abbrev-ref HEAD",
      "checkout --force develop",
      "fetch origin",
      "reset --hard origin/develop",
    ]);
  });

  test("チェックアウト失敗なら fetch せず伝播する", async () => {
    const { git, calls } = scriptedGit({
      "rev-parse --show-toplevel": { stdout: "/repo\n" },
      "rev-parse --abbrev-ref HEAD": { stdout: "topic/x\n" },
      "checkout --force main": { fail: true },
    });
    await expect(syncMain({ git, startDir: "/repo", log: silentLogger })).rejects.toThrow(
      "git failed: checkout --force main",
    );
    expect(calls()).not.toContain("fetch origin");
  });

  test("fetch 失敗なら reset せず伝播する", async () => {
    const { git, calls } = scriptedGit({
      "rev-parse --show-toplevel": { stdout: "/repo\n" },
      "rev-parse --abbrev-ref HEAD": { stdout: "main\n" },
      "fetch origin": { fail: true },
    });
    await expect(syncMain({ git, startDir: "/repo", log: silentLogger })).rejects.toThrow(
      "git failed: fetch origin",
    );
    expect(calls()).not.toContain("reset --hard origin/main");
  });
});
