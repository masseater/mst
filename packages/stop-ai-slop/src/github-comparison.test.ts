import { describe, expect, it } from "vite-plus/test";

import { compareGitHubPullRequest, type GitHubRequest } from "./github-comparison.ts";

const encoded = (source: string): string => Buffer.from(source, "utf8").toString("base64");

const LEGACY_BEFORE = "export const current = true;\nexport const legacyMode = true;\n";

const LEGACY_AFTER = "export const current = true;\n";

const answering = (contents: Readonly<Record<string, string>>): GitHubRequest =>
  async function answer(path: string): Promise<unknown> {
    if (path.startsWith("/repos/owner/name/compare/")) {
      return {
        merge_base_commit: { sha: "basesha" },
        files: [
          {
            filename: "src/legacy.ts",
            status: "modified",
            patch: "@@ -1,2 +1,1 @@\n-export const legacyMode = true;\n",
          },
          {
            filename: "src/legacy-api.test.ts",
            status: "added",
            patch: '@@ -0,0 +1,1 @@\n+expect(legacy).not.toHaveProperty("legacyMode");\n',
          },
        ],
      };
    }
    const content = contents[path];
    if (content === undefined) throw new Error(`unexpected request ${path}`);
    return { content: encoded(content) };
  };

describe("compareGitHubPullRequest", () => {
  it("reads the compared sides through the API instead of the local repository", async () => {
    const comparison = await compareGitHubPullRequest({
      repositoryRoot: "/checkout",
      repository: "owner/name",
      baseRevision: "basetip",
      headRevision: "headsha",
      request: answering({
        "/repos/owner/name/contents/src/legacy.ts?ref=basesha": LEGACY_BEFORE,
        "/repos/owner/name/contents/src/legacy.ts?ref=headsha": LEGACY_AFTER,
        "/repos/owner/name/contents/src/legacy-api.test.ts?ref=headsha": "const added = true;\n",
      }),
    });

    expect(comparison).toStrictEqual({
      repositoryRoot: "/checkout",
      baseRevision: "basesha",
      headRevision: "headsha",
      files: [
        {
          kind: "changed",
          beforePath: "src/legacy.ts",
          afterPath: "src/legacy.ts",
          beforeSource: LEGACY_BEFORE,
          afterSource: LEGACY_AFTER,
          addedLines: [],
          firstAddedLine: null,
        },
        {
          kind: "added",
          beforePath: null,
          afterPath: "src/legacy-api.test.ts",
          beforeSource: null,
          afterSource: "const added = true;\n",
          addedLines: [1],
          firstAddedLine: 1,
        },
      ],
    });
  });

  it("compares a source after removing NUL bytes from its previous API blob", async () => {
    const comparison = await compareGitHubPullRequest({
      repositoryRoot: "/checkout",
      repository: "owner/name",
      baseRevision: "basetip",
      headRevision: "headsha",
      request: answering({
        "/repos/owner/name/contents/src/legacy.ts?ref=basesha": "export const current = \0true;\n",
        "/repos/owner/name/contents/src/legacy.ts?ref=headsha": LEGACY_AFTER,
        "/repos/owner/name/contents/src/legacy-api.test.ts?ref=headsha": "const added = true;\n",
      }),
    });

    expect(comparison.files[0]).toMatchObject({
      kind: "changed",
      beforeSource: null,
      afterSource: LEGACY_AFTER,
    });
  });

  it("rejects a NUL-bearing source in the API head", async () => {
    await expect(
      compareGitHubPullRequest({
        repositoryRoot: "/checkout",
        repository: "owner/name",
        baseRevision: "basetip",
        headRevision: "headsha",
        request: answering({
          "/repos/owner/name/contents/src/legacy.ts?ref=basesha": LEGACY_BEFORE,
          "/repos/owner/name/contents/src/legacy.ts?ref=headsha":
            "export const current = \0true;\n",
          "/repos/owner/name/contents/src/legacy-api.test.ts?ref=headsha": "const added = true;\n",
        }),
      }),
    ).rejects.toThrow("Source blob contains NUL bytes: src/legacy.ts");
  });

  it("reads a removal, a rename and a copy the compare reported", async () => {
    const comparison = await compareGitHubPullRequest({
      repositoryRoot: "/checkout",
      repository: "owner/name",
      baseRevision: "basetip",
      headRevision: "headsha",
      request: async (path: string) =>
        path.startsWith("/repos/owner/name/compare/")
          ? {
              merge_base_commit: { sha: "basesha" },
              files: [
                {
                  filename: "src/gone.ts",
                  status: "removed",
                  patch: "@@ -1,1 +0,0 @@\n-export const gone = true;\n",
                },
                {
                  filename: "src/moved.ts",
                  status: "renamed",
                  previous_filename: "src/was-here.ts",
                },
                {
                  filename: "src/copy.ts",
                  status: "copied",
                  previous_filename: "src/original.ts",
                },
              ],
            }
          : { content: encoded("export const kept = true;\n") },
    });

    expect(
      comparison.files.map((file) => [file.kind, file.beforePath, file.afterPath]),
    ).toStrictEqual([
      ["deleted", "src/gone.ts", null],
      ["renamed", "src/was-here.ts", "src/moved.ts"],
      ["added", null, "src/copy.ts"],
    ]);
  });

  it("refuses a compare status it cannot map to a change", async () => {
    await expect(
      compareGitHubPullRequest({
        repositoryRoot: "/checkout",
        repository: "owner/name",
        baseRevision: "basetip",
        headRevision: "headsha",
        request: async () => ({
          merge_base_commit: { sha: "basesha" },
          files: [{ filename: "src/legacy.ts", status: "unchanged" }],
        }),
      }),
    ).rejects.toThrow('unknown compare status "unchanged"');
  });

  it("refuses a renamed file the compare answered without its former path", async () => {
    await expect(
      compareGitHubPullRequest({
        repositoryRoot: "/checkout",
        repository: "owner/name",
        baseRevision: "basetip",
        headRevision: "headsha",
        request: async () => ({
          merge_base_commit: { sha: "basesha" },
          files: [{ filename: "docs/moved.md", status: "renamed", previous_filename: "" }],
        }),
      }),
    ).rejects.toThrow("without its former path");
  });

  it("refuses a file the contents API answered without content", async () => {
    await expect(
      compareGitHubPullRequest({
        repositoryRoot: "/checkout",
        repository: "owner/name",
        baseRevision: "basetip",
        headRevision: "headsha",
        request: async (path: string) =>
          path.startsWith("/repos/owner/name/compare/")
            ? {
                merge_base_commit: { sha: "basesha" },
                files: [
                  {
                    filename: "src/added.ts",
                    status: "added",
                    patch: "@@ -0,0 +1,1 @@\n+const added = true;\n",
                  },
                ],
              }
            : {},
      }),
    ).rejects.toThrow("without content");
  });

  it("compares nothing when the pull request changed nothing", async () => {
    const comparison = await compareGitHubPullRequest({
      repositoryRoot: "/checkout",
      repository: "owner/name",
      baseRevision: "basetip",
      headRevision: "headsha",
      request: async () => ({ merge_base_commit: { sha: "basesha" } }),
    });

    expect(comparison.files).toStrictEqual([]);
  });
});
