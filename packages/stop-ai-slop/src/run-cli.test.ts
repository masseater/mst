import { execFileSync } from "node:child_process";

import { describe, expect, it, vi } from "vite-plus/test";

import { runStopAiSlop } from "./run-cli.ts";
import { withTestRepository } from "./test-repository.ts";

describe("runStopAiSlop", () => {
  const invalidArguments = [
    { argv: [] },
    { argv: ["scan"] },
    { argv: ["check", "extra"] },
    { argv: ["check", "--unknown"] },
    { argv: ["check"] },
    { argv: ["check", "--base", ""] },
    { argv: ["check", "--base", "base"] },
    { argv: ["check", "--base", "base", "--head", ""] },
  ];

  it.each(invalidArguments)("rejects invalid arguments $argv", async ({ argv }) => {
    const usageFailure = await runStopAiSlop(argv);

    expect(usageFailure.exitCode).toBe(2);
    expect(usageFailure.out).toBe("");
    expect(usageFailure.error).toContain("Usage: stop-ai-slop check");
  });

  it("is silent when every check passes", async () => {
    await withTestRepository(async (repository) => {
      const base = repository.commit({
        files: { "src/current.ts": "export const current = true;\n" },
      });
      const head = repository.commit({
        files: { "src/current.ts": "export const current = false;\n" },
      });

      const passingCheck = await runStopAiSlop([
        "check",
        "--repository-root",
        repository.root,
        "--base",
        base,
        "--head",
        head,
      ]);

      expect(passingCheck).toStrictEqual({ exitCode: 0, out: "", error: "" });
    });
  });

  it("uses the current working directory when the repository root is omitted", async () => {
    await withTestRepository(async (repository) => {
      const base = repository.commit({
        files: { "src/current.ts": "export const current = true;\n" },
      });
      const head = repository.commit({
        files: { "src/current.ts": "export const current = false;\n" },
      });
      const currentDirectory = vi.spyOn(process, "cwd").mockReturnValue(repository.root);

      const passingCheck = await runStopAiSlop(["check", "--base", base, "--head", head]);
      currentDirectory.mockRestore();

      expect(passingCheck).toStrictEqual({ exitCode: 0, out: "", error: "" });
    });
  });

  it("detects a stale branch removal when the caller supplies its merge base", async () => {
    await withTestRepository(async (repository) => {
      const commonRevision = repository.commit({
        files: {
          "src/legacy.ts": "export const current = true;\nexport const legacyMode = true;\n",
        },
      });
      const baseTip = repository.commit({
        files: { "src/legacy.ts": "export const current = false;\n" },
      });
      const featureTreeCommit = repository.commit({
        files: {
          "src/legacy.ts": "export const current = true;\n",
          "src/legacy-api.test.ts":
            'import * as legacy from "./legacy.ts";\nimport { expect } from "vite-plus/test";\n\nexpect(legacy).not.toHaveProperty("legacyMode");\n',
        },
      });
      const featureTree = execFileSync("git", ["rev-parse", `${featureTreeCommit}^{tree}`], {
        cwd: repository.root,
        encoding: "utf8",
      }).trim();
      const head = execFileSync(
        "git",
        ["commit-tree", featureTree, "-p", commonRevision, "-m", "feature snapshot"],
        { cwd: repository.root, encoding: "utf8" },
      ).trim();
      const mergeBase = execFileSync("git", ["merge-base", baseTip, head], {
        cwd: repository.root,
        encoding: "utf8",
      }).trim();

      const directTipComparison = await runStopAiSlop([
        "check",
        "--repository-root",
        repository.root,
        "--base",
        baseTip,
        "--head",
        head,
      ]);
      const mergeBaseComparison = await runStopAiSlop([
        "check",
        "--repository-root",
        repository.root,
        "--base",
        mergeBase,
        "--head",
        head,
      ]);

      expect(commonRevision).toBe(mergeBase);
      expect(directTipComparison).toStrictEqual({ exitCode: 0, out: "", error: "" });
      expect(mergeBaseComparison).toStrictEqual({
        exitCode: 1,
        out: 'src/legacy-api.test.ts:4 no-removal-verification: Do not assert that removed export "legacyMode" from "src/legacy.ts" remains absent; remove the assertion.\n',
        error: "",
      });
    });
  }, 15_000);

  it("fails closed when the base revision is invalid", async () => {
    await withTestRepository(async (repository) => {
      const head = repository.commit({
        files: { "src/current.ts": "export const current = true;\n" },
      });

      const revisionFailure = await runStopAiSlop([
        "check",
        "--repository-root",
        repository.root,
        "--base",
        "missing-revision",
        "--head",
        head,
      ]);

      expect(revisionFailure.exitCode).toBe(2);
      expect(revisionFailure.out).toBe("");
      expect(revisionFailure.error).not.toBe("");
    });
  });

  it("fails closed when a relevant source cannot be parsed", async () => {
    await withTestRepository(async (repository) => {
      const base = repository.commit({
        files: { "src/legacy.ts": "export const legacyMode = true;\n" },
      });
      const head = repository.commit({
        files: { "src/legacy.ts": "export const current = ;\n" },
      });

      const parseFailure = await runStopAiSlop([
        "check",
        "--repository-root",
        repository.root,
        "--base",
        base,
        "--head",
        head,
      ]);

      expect(parseFailure.exitCode).toBe(2);
      expect(parseFailure.out).toBe("");
      expect(parseFailure.error).toContain("src/legacy.ts");
    });
  });
});
