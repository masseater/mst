import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { comparisonRangeIn } from "./comparison-range.ts";

describe("comparisonRangeIn", () => {
  const sharedCommitRevision = "2bd9e78c8de105cae8f7e2ee2626041c397fe893";
  const featureTipCommitRevision = "6558ebc69c85f6fe83d0f6324945fe524f5c9ba8";
  const mergedIndexTreeRevision = "34ce6086051fdb587dc8ecac255c7a02b7375c4d";

  describe("a repository holding a merge that has not been committed", () => {
    const it = test.extend("comparisonRangeOfTheMergingRepository", async ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "comparison-range-merging-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      const runGit = (gitArguments: readonly string[]): string =>
        execFileSync("git", [...gitArguments], {
          cwd: repositoryRoot,
          encoding: "utf8",
          env: {
            GIT_AUTHOR_DATE: "@946684800 +0000",
            GIT_AUTHOR_EMAIL: "comparison-range@example.test",
            GIT_AUTHOR_NAME: "Comparison Range",
            GIT_COMMITTER_DATE: "@946684800 +0000",
            GIT_COMMITTER_EMAIL: "comparison-range@example.test",
            GIT_COMMITTER_NAME: "Comparison Range",
            GIT_CONFIG_GLOBAL: "/dev/null",
            GIT_CONFIG_SYSTEM: "/dev/null",
            HOME: repositoryRoot,
            PATH: process.env.PATH,
          },
        });
      runGit(["init", "--quiet", "--initial-branch=main"]);
      writeFileSync(join(repositoryRoot, "shared.ts"), "export const shared = true;\n");
      runGit(["add", "--all"]);
      runGit(["commit", "--quiet", "--message", "shared"]);
      runGit(["switch", "--quiet", "--create", "feature"]);
      writeFileSync(join(repositoryRoot, "feature.ts"), "export const feature = true;\n");
      runGit(["add", "--all"]);
      runGit(["commit", "--quiet", "--message", "feature"]);
      runGit(["switch", "--quiet", "main"]);
      writeFileSync(join(repositoryRoot, "main-only.ts"), "export const mainOnly = true;\n");
      runGit(["add", "--all"]);
      runGit(["commit", "--quiet", "--message", "main only"]);
      runGit(["merge", "--quiet", "--no-commit", "--no-ff", "feature"]);
      return comparisonRangeIn(repositoryRoot);
    });

    it("compares the branch being merged against the point it left", ({
      comparisonRangeOfTheMergingRepository,
    }) => {
      expect(comparisonRangeOfTheMergingRepository).toStrictEqual({
        baseRevision: sharedCommitRevision,
        headRevision: mergedIndexTreeRevision,
      });
    });
  });

  describe("a repository whose merge holds a tree the merged branch never carried", () => {
    const it = test.extend("comparisonRangeOfTheRepositoryMergingTheFeatureTip", async ({}, {
      onCleanup,
    }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "comparison-range-merge-tip-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      const runGit = (gitArguments: readonly string[]): string =>
        execFileSync("git", [...gitArguments], {
          cwd: repositoryRoot,
          encoding: "utf8",
          env: {
            GIT_AUTHOR_DATE: "@946684800 +0000",
            GIT_AUTHOR_EMAIL: "comparison-range@example.test",
            GIT_AUTHOR_NAME: "Comparison Range",
            GIT_COMMITTER_DATE: "@946684800 +0000",
            GIT_COMMITTER_EMAIL: "comparison-range@example.test",
            GIT_COMMITTER_NAME: "Comparison Range",
            GIT_CONFIG_GLOBAL: "/dev/null",
            GIT_CONFIG_SYSTEM: "/dev/null",
            HOME: repositoryRoot,
            PATH: process.env.PATH,
          },
        });
      runGit(["init", "--quiet", "--initial-branch=main"]);
      writeFileSync(join(repositoryRoot, "shared.ts"), "export const shared = true;\n");
      runGit(["add", "--all"]);
      runGit(["commit", "--quiet", "--message", "shared"]);
      runGit(["switch", "--quiet", "--create", "feature"]);
      writeFileSync(join(repositoryRoot, "feature.ts"), "export const feature = true;\n");
      runGit(["add", "--all"]);
      runGit(["commit", "--quiet", "--message", "feature"]);
      runGit(["switch", "--quiet", "main"]);
      writeFileSync(join(repositoryRoot, "main-only.ts"), "export const mainOnly = true;\n");
      runGit(["add", "--all"]);
      runGit(["commit", "--quiet", "--message", "main only"]);
      runGit(["merge", "--quiet", "--no-commit", "--no-ff", "feature"]);
      return comparisonRangeIn(repositoryRoot);
    });

    it("refuses the tip of the branch being merged as the head revision", ({
      comparisonRangeOfTheRepositoryMergingTheFeatureTip,
    }) => {
      expect(comparisonRangeOfTheRepositoryMergingTheFeatureTip).not.toStrictEqual({
        baseRevision: sharedCommitRevision,
        headRevision: featureTipCommitRevision,
      });
    });
  });

  describe("a repository whose checked out history moved past the integration branch", () => {
    const it = test.extend("comparisonRangeOfTheDivergedRepository", async ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "comparison-range-diverged-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      const runGit = (gitArguments: readonly string[]): string =>
        execFileSync("git", [...gitArguments], {
          cwd: repositoryRoot,
          encoding: "utf8",
          env: {
            GIT_AUTHOR_DATE: "@946684800 +0000",
            GIT_AUTHOR_EMAIL: "comparison-range@example.test",
            GIT_AUTHOR_NAME: "Comparison Range",
            GIT_COMMITTER_DATE: "@946684800 +0000",
            GIT_COMMITTER_EMAIL: "comparison-range@example.test",
            GIT_COMMITTER_NAME: "Comparison Range",
            GIT_CONFIG_GLOBAL: "/dev/null",
            GIT_CONFIG_SYSTEM: "/dev/null",
            HOME: repositoryRoot,
            PATH: process.env.PATH,
          },
        });
      runGit(["init", "--quiet", "--initial-branch=main"]);
      writeFileSync(join(repositoryRoot, "shared.ts"), "export const shared = true;\n");
      runGit(["add", "--all"]);
      runGit(["commit", "--quiet", "--message", "shared"]);
      runGit(["update-ref", "refs/remotes/origin/main", "HEAD"]);
      writeFileSync(join(repositoryRoot, "later.ts"), "export const later = true;\n");
      runGit(["add", "--all"]);
      runGit(["commit", "--quiet", "--message", "later"]);
      return comparisonRangeIn(repositoryRoot);
    });

    it("compares the checked out history against the point it left the integration branch", ({
      comparisonRangeOfTheDivergedRepository,
    }) => {
      expect(comparisonRangeOfTheDivergedRepository).toStrictEqual({
        baseRevision: sharedCommitRevision,
        headRevision: "HEAD",
      });
    });
  });

  describe("a repository carrying no integration branch", () => {
    const it = test.extend("comparisonRangeOfTheSoleBranchRepository", async ({}, {
      onCleanup,
    }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "comparison-range-sole-branch-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      const runGit = (gitArguments: readonly string[]): string =>
        execFileSync("git", [...gitArguments], {
          cwd: repositoryRoot,
          encoding: "utf8",
          env: {
            GIT_AUTHOR_DATE: "@946684800 +0000",
            GIT_AUTHOR_EMAIL: "comparison-range@example.test",
            GIT_AUTHOR_NAME: "Comparison Range",
            GIT_COMMITTER_DATE: "@946684800 +0000",
            GIT_COMMITTER_EMAIL: "comparison-range@example.test",
            GIT_COMMITTER_NAME: "Comparison Range",
            GIT_CONFIG_GLOBAL: "/dev/null",
            GIT_CONFIG_SYSTEM: "/dev/null",
            HOME: repositoryRoot,
            PATH: process.env.PATH,
          },
        });
      runGit(["init", "--quiet", "--initial-branch=main"]);
      writeFileSync(join(repositoryRoot, "shared.ts"), "export const shared = true;\n");
      runGit(["add", "--all"]);
      runGit(["commit", "--quiet", "--message", "shared"]);
      return comparisonRangeIn(repositoryRoot);
    });

    it("names no range when the integration branch is absent", ({
      comparisonRangeOfTheSoleBranchRepository,
    }) => {
      expect(comparisonRangeOfTheSoleBranchRepository).toBe(null);
    });
  });
});
