import { join } from "node:path";

import { describe, expect, test, vi } from "vite-plus/test";

import { ignoredLintSources } from "./ignored-lint-sources.ts";

describe("ignoredLintSources", () => {
  const it = test
    .extend("ignoredByDirectoryPattern", () =>
      ignoredLintSources({
        patterns: [".agents/"],
        sourcePaths: [".agents/task.ts", "src/task.ts"],
      }))
    .extend("ignoredBySourcePattern", () =>
      ignoredLintSources({
        patterns: ["**/*.ts", "!src/kept.ts"],
        sourcePaths: ["src/dropped.ts", "src/kept.ts", "docs/readme.md"],
      }),
    )
    .extend("ignoredByDocumentationPattern", () =>
      ignoredLintSources({
        patterns: ["docs/**"],
        sourcePaths: ["src/task.ts"],
      }))
    .extend("ignoredDespiteForeignGitEnvironment", () => {
      vi.stubEnv("GIT_DIR", join(process.cwd(), ".git"));
      vi.stubEnv("GIT_INDEX_FILE", join(process.cwd(), ".git", "index"));
      return ignoredLintSources({
        patterns: [".agents/"],
        sourcePaths: [".agents/task.ts", "src/task.ts"],
      });
    });
    );

  it("applies directory patterns with gitignore semantics", ({ ignoredByDirectoryPattern }) => {
    expect(ignoredByDirectoryPattern).toStrictEqual([".agents/task.ts"]);
  });

  it("applies later negation patterns to matched files", ({ ignoredBySourcePattern }) => {
    expect(ignoredBySourcePattern).toStrictEqual(["src/dropped.ts"]);
  });

  it("leaves lint sources reached by unrelated patterns", ({ ignoredByDocumentationPattern }) => {
    expect(ignoredByDocumentationPattern).toStrictEqual([]);
  });

  it("does not inherit hook repository variables", ({ ignoredDespiteForeignGitEnvironment }) => {
    expect(ignoredDespiteForeignGitEnvironment).toStrictEqual([".agents/task.ts"]);
  });
});
