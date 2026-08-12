import { describe, expect, it } from "vite-plus/test";

import { comparisonRangeIn } from "./comparison-range.ts";
import { withTestRepository } from "./test-repository.ts";

describe("comparisonRangeIn", () => {
  it("compares the branch being merged against the point it left", async () => {
    await withTestRepository(async (repository) => {
      const common = repository.commit({
        files: { "src/current.ts": "export const current = true;\n" },
      });
      repository.git(["switch", "--quiet", "--create", "feature", common]);
      const featureTip = repository.commit({
        files: { "src/feature.ts": "export const feature = true;\n" },
      });
      repository.git(["switch", "--quiet", "main"]);
      repository.commit({ files: { "src/main-only.ts": "export const mainOnly = true;\n" } });
      repository.git(["merge", "--quiet", "--no-commit", "--no-ff", "feature"]);

      await expect(comparisonRangeIn(repository.root)).resolves.toStrictEqual({
        baseRevision: common,
        headRevision: featureTip,
      });
    });
  });

  it("compares the checked out history against the point it left the integration branch", async () => {
    await withTestRepository(async (repository) => {
      const common = repository.commit({
        files: { "src/current.ts": "export const current = true;\n" },
      });
      repository.git(["update-ref", "refs/remotes/origin/main", common]);
      repository.commit({ files: { "src/later.ts": "export const later = true;\n" } });

      await expect(comparisonRangeIn(repository.root)).resolves.toStrictEqual({
        baseRevision: common,
        headRevision: "HEAD",
      });
    });
  });

  it("names no range when the integration branch is absent", async () => {
    await withTestRepository(async (repository) => {
      repository.commit({ files: { "src/current.ts": "export const current = true;\n" } });

      await expect(comparisonRangeIn(repository.root)).resolves.toBeNull();
    });
  });
});
