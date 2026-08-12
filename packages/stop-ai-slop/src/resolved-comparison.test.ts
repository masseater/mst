import { describe, expect, it, vi } from "vite-plus/test";

import { resolvedComparison } from "./resolved-comparison.ts";
import { withTestRepository } from "./test-repository.ts";

import type { GitHubRequest } from "./github-comparison.ts";

const WITHOUT_GITHUB = { repository: undefined, request: null };

describe("resolvedComparison", () => {
  it("reads the local repository when it holds the integration branch", async () => {
    await withTestRepository(async (repository) => {
      const common = repository.commit({
        files: { "src/current.ts": "export const current = true;\n" },
      });
      repository.git(["update-ref", "refs/remotes/origin/main", common]);
      repository.commit({ files: { "src/current.ts": "export const current = false;\n" } });

      await expect(resolvedComparison(repository.root, WITHOUT_GITHUB)).resolves.toMatchObject({
        baseRevision: common,
        headRevision: "HEAD",
        files: [{ kind: "changed", afterPath: "src/current.ts" }],
      });
    });
  });

  it("reads the pull request through the API when the checkout holds only its merge", async () => {
    await withTestRepository(async (repository) => {
      const base = repository.commit({
        files: { "src/current.ts": "export const current = true;\n" },
      });
      repository.git(["branch", "feature", base]);
      const head = repository.commit({
        files: { "src/current.ts": "export const current = false;\n" },
      });
      const tree = repository.git(["rev-parse", `${head}^{tree}`]).trim();
      const merged = repository
        .git(["commit-tree", tree, "-p", base, "-p", head, "-m", "pull request merge"])
        .trim();
      repository.git(["reset", "--hard", "--quiet", merged]);

      const requested = vi.fn<GitHubRequest>(async () => ({
        merge_base_commit: { sha: base },
        files: [],
      }));
      await expect(
        resolvedComparison(repository.root, { repository: "owner/name", request: requested }),
      ).resolves.toMatchObject({ baseRevision: base, headRevision: head, files: [] });

      expect(requested).toHaveBeenCalledExactlyOnceWith(
        `/repos/owner/name/compare/${base}...${head}`,
      );
    });
  });

  it("refuses a checkout that holds neither the integration branch nor a merge", async () => {
    await withTestRepository(async (repository) => {
      repository.commit({ files: { "src/current.ts": "export const current = true;\n" } });

      await expect(resolvedComparison(repository.root, WITHOUT_GITHUB)).rejects.toThrow(
        "neither origin/main nor a pull request merge",
      );
    });
  });
});
