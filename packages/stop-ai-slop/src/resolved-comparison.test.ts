import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test, vi } from "vite-plus/test";

import { resolvedComparison } from "./resolved-comparison.ts";

import type { GitHubRequest } from "./github-comparison.ts";

describe("resolvedComparison", () => {
  describe("a checkout that holds the integration branch", () => {
    const it = test.extend("integrationBranchComparison", async ({}, { onCleanup }) => {
      const repositoryRoot = join(tmpdir(), "stop-ai-slop-resolved-comparison-integration");
      rmSync(repositoryRoot, { recursive: true, force: true });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      const git = (gitArguments: readonly string[]): string =>
        execFileSync("git", [...gitArguments], {
          cwd: repositoryRoot,
          encoding: "utf8",
          env: {
            GIT_AUTHOR_DATE: "1700000000 +0000",
            GIT_AUTHOR_EMAIL: "stop-ai-slop@example.test",
            GIT_AUTHOR_NAME: "Stop AI Slop",
            GIT_COMMITTER_DATE: "1700000000 +0000",
            GIT_COMMITTER_EMAIL: "stop-ai-slop@example.test",
            GIT_COMMITTER_NAME: "Stop AI Slop",
            GIT_CONFIG_GLOBAL: "/dev/null",
            GIT_CONFIG_SYSTEM: "/dev/null",
            HOME: repositoryRoot,
            PATH: process.env.PATH,
          },
        });

      git(["init", "--quiet", "--initial-branch=main"]);
      writeFileSync(join(repositoryRoot, "src/current.ts"), "export const current = true;\n");
      git(["add", "--all"]);
      git(["commit", "--quiet", "--message", "snapshot"]);
      git(["update-ref", "refs/remotes/origin/main", "HEAD"]);
      writeFileSync(join(repositoryRoot, "src/current.ts"), "export const current = false;\n");
      git(["add", "--all"]);
      git(["commit", "--quiet", "--message", "snapshot"]);

      return resolvedComparison(repositoryRoot, { repository: undefined, request: null });
    });

    it("reads the local repository when it holds the integration branch", ({
      integrationBranchComparison,
    }) => {
      expect(integrationBranchComparison).toStrictEqual({
        repositoryRoot: join(tmpdir(), "stop-ai-slop-resolved-comparison-integration"),
        baseRevision: "2f9ca1284d91be6c277f0b4baf015234f3bfc8d1",
        headRevision: "HEAD",
        files: [
          {
            kind: "changed",
            beforePath: "src/current.ts",
            afterPath: "src/current.ts",
            beforeSource: "export const current = true;\n",
            afterSource: "export const current = false;\n",
            addedLines: [1],
            firstAddedLine: 1,
          },
        ],
      });
    });
  });

  describe("a checkout that holds only the merge of a pull request", () => {
    const it = test
      .extend("pullRequestComparison", async ({}, { onCleanup }) => {
        const repositoryRoot = join(tmpdir(), "stop-ai-slop-resolved-comparison-merge");
        rmSync(repositoryRoot, { recursive: true, force: true });
        mkdirSync(join(repositoryRoot, "src"), { recursive: true });
        onCleanup(() => {
          rmSync(repositoryRoot, { recursive: true, force: true });
        });
        const git = (gitArguments: readonly string[]): string =>
          execFileSync("git", [...gitArguments], {
            cwd: repositoryRoot,
            encoding: "utf8",
            env: {
              GIT_AUTHOR_DATE: "1700000000 +0000",
              GIT_AUTHOR_EMAIL: "stop-ai-slop@example.test",
              GIT_AUTHOR_NAME: "Stop AI Slop",
              GIT_COMMITTER_DATE: "1700000000 +0000",
              GIT_COMMITTER_EMAIL: "stop-ai-slop@example.test",
              GIT_COMMITTER_NAME: "Stop AI Slop",
              GIT_CONFIG_GLOBAL: "/dev/null",
              GIT_CONFIG_SYSTEM: "/dev/null",
              HOME: repositoryRoot,
              PATH: process.env.PATH,
            },
          });

        git(["init", "--quiet", "--initial-branch=main"]);
        writeFileSync(join(repositoryRoot, "src/current.ts"), "export const current = true;\n");
        git(["add", "--all"]);
        git(["commit", "--quiet", "--message", "snapshot"]);
        const baseCommit = git(["rev-parse", "HEAD"]).trim();
        git(["branch", "feature", baseCommit]);
        writeFileSync(join(repositoryRoot, "src/current.ts"), "export const current = false;\n");
        git(["add", "--all"]);
        git(["commit", "--quiet", "--message", "snapshot"]);
        const headCommit = git(["rev-parse", "HEAD"]).trim();
        const mergeCommit = git([
          "commit-tree",
          git(["rev-parse", `${headCommit}^{tree}`]).trim(),
          "-p",
          baseCommit,
          "-p",
          headCommit,
          "-m",
          "pull request merge",
        ]).trim();
        git(["reset", "--hard", "--quiet", mergeCommit]);
        const compare = vi.fn<GitHubRequest>(async () => ({
          merge_base_commit: { sha: baseCommit },
          files: [],
        }));

        return resolvedComparison(repositoryRoot, {
          repository: "owner/name",
          request: compare,
        });
      })
      .extend("pullRequestCompareCall", async ({}, { onCleanup }) => {
        const repositoryRoot = join(tmpdir(), "stop-ai-slop-resolved-comparison-merge-call");
        rmSync(repositoryRoot, { recursive: true, force: true });
        mkdirSync(join(repositoryRoot, "src"), { recursive: true });
        onCleanup(() => {
          rmSync(repositoryRoot, { recursive: true, force: true });
        });
        const git = (gitArguments: readonly string[]): string =>
          execFileSync("git", [...gitArguments], {
            cwd: repositoryRoot,
            encoding: "utf8",
            env: {
              GIT_AUTHOR_DATE: "1700000000 +0000",
              GIT_AUTHOR_EMAIL: "stop-ai-slop@example.test",
              GIT_AUTHOR_NAME: "Stop AI Slop",
              GIT_COMMITTER_DATE: "1700000000 +0000",
              GIT_COMMITTER_EMAIL: "stop-ai-slop@example.test",
              GIT_COMMITTER_NAME: "Stop AI Slop",
              GIT_CONFIG_GLOBAL: "/dev/null",
              GIT_CONFIG_SYSTEM: "/dev/null",
              HOME: repositoryRoot,
              PATH: process.env.PATH,
            },
          });

        git(["init", "--quiet", "--initial-branch=main"]);
        writeFileSync(join(repositoryRoot, "src/current.ts"), "export const current = true;\n");
        git(["add", "--all"]);
        git(["commit", "--quiet", "--message", "snapshot"]);
        const baseCommit = git(["rev-parse", "HEAD"]).trim();
        git(["branch", "feature", baseCommit]);
        writeFileSync(join(repositoryRoot, "src/current.ts"), "export const current = false;\n");
        git(["add", "--all"]);
        git(["commit", "--quiet", "--message", "snapshot"]);
        const headCommit = git(["rev-parse", "HEAD"]).trim();
        const mergeCommit = git([
          "commit-tree",
          git(["rev-parse", `${headCommit}^{tree}`]).trim(),
          "-p",
          baseCommit,
          "-p",
          headCommit,
          "-m",
          "pull request merge",
        ]).trim();
        git(["reset", "--hard", "--quiet", mergeCommit]);
        const compare = vi.fn<GitHubRequest>(async () => ({
          merge_base_commit: { sha: baseCommit },
          files: [],
        }));
        await resolvedComparison(repositoryRoot, {
          repository: "owner/name",
          request: compare,
        });

        return compare;
      });

    it("reads the pull request through the API when the checkout holds only its merge", ({
      pullRequestComparison,
    }) => {
      expect(pullRequestComparison).toStrictEqual({
        repositoryRoot: join(tmpdir(), "stop-ai-slop-resolved-comparison-merge"),
        baseRevision: "2f9ca1284d91be6c277f0b4baf015234f3bfc8d1",
        headRevision: "d8fde84998100e7b6119bddff27a36a2e20e9ad6",
        files: [],
      });
    });

    it("asks the compare endpoint for the range spanned by the merged parents", ({
      pullRequestCompareCall,
    }) => {
      expect(pullRequestCompareCall).toHaveBeenCalledExactlyOnceWith(
        "/repos/owner/name/compare/2f9ca1284d91be6c277f0b4baf015234f3bfc8d1...d8fde84998100e7b6119bddff27a36a2e20e9ad6",
      );
    });
  });

  describe("a checkout that holds neither the integration branch nor a merge", () => {
    const it = test.extend("guessworkRefusal", async ({}, { onCleanup }) => {
      const repositoryRoot = join(tmpdir(), "stop-ai-slop-resolved-comparison-orphan");
      rmSync(repositoryRoot, { recursive: true, force: true });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      const git = (gitArguments: readonly string[]): string =>
        execFileSync("git", [...gitArguments], {
          cwd: repositoryRoot,
          encoding: "utf8",
          env: {
            GIT_AUTHOR_DATE: "1700000000 +0000",
            GIT_AUTHOR_EMAIL: "stop-ai-slop@example.test",
            GIT_AUTHOR_NAME: "Stop AI Slop",
            GIT_COMMITTER_DATE: "1700000000 +0000",
            GIT_COMMITTER_EMAIL: "stop-ai-slop@example.test",
            GIT_COMMITTER_NAME: "Stop AI Slop",
            GIT_CONFIG_GLOBAL: "/dev/null",
            GIT_CONFIG_SYSTEM: "/dev/null",
            HOME: repositoryRoot,
            PATH: process.env.PATH,
          },
        });

      git(["init", "--quiet", "--initial-branch=main"]);
      writeFileSync(join(repositoryRoot, "src/current.ts"), "export const current = true;\n");
      git(["add", "--all"]);
      git(["commit", "--quiet", "--message", "snapshot"]);

      try {
        await resolvedComparison(repositoryRoot, { repository: undefined, request: null });
      } catch (refusal) {
        return refusal;
      }
      throw new Error("resolvedComparison named a range in a checkout that holds neither end");
    });

    it("refuses a checkout that holds neither the integration branch nor a merge", ({
      guessworkRefusal,
    }) => {
      expect(guessworkRefusal).toStrictEqual(
        new Error(
          "Do not leave the compared change to guesswork: this checkout holds neither origin/main nor a pull request merge to read. Fetch the integration branch, or name both ends with --base and --head.",
        ),
      );
    });
  });
});
