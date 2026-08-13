import { attemptAsync } from "es-toolkit";
import { describe, expect, test } from "vite-plus/test";

import { compareGitHubPullRequest } from "./github-comparison.ts";

const LEGACY_BEFORE = "export const current = true;\nexport const legacyMode = true;\n";

const LEGACY_AFTER = "export const current = true;\n";

describe("compareGitHubPullRequest", () => {
  describe("a pull request whose sides are only reachable through the API", () => {
    const it = test.extend("apiSideComparison", () =>
      compareGitHubPullRequest({
        repositoryRoot: "/checkout",
        repository: "owner/name",
        baseRevision: "basetip",
        headRevision: "headsha",
        request: async (path: string) => {
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
          const writtenContents: Readonly<Record<string, string>> = {
            "/repos/owner/name/contents/src/legacy.ts?ref=basesha": LEGACY_BEFORE,
            "/repos/owner/name/contents/src/legacy.ts?ref=headsha": LEGACY_AFTER,
            "/repos/owner/name/contents/src/legacy-api.test.ts?ref=headsha":
              "const added = true;\n",
          };
          const writtenContent = writtenContents[path];
          if (writtenContent === undefined) throw new Error(`unexpected request ${path}`);
          return { content: Buffer.from(writtenContent, "utf8").toString("base64") };
        },
      }));

    it("reads the compared sides through the API instead of the local repository", ({
      apiSideComparison,
    }) => {
      expect(apiSideComparison).toStrictEqual({
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
  });

  describe("a pull request whose previous source the API answered as undecodable bytes", () => {
    const it = test.extend("undecodablePreviousSourceComparison", () =>
      compareGitHubPullRequest({
        repositoryRoot: "/checkout",
        repository: "owner/name",
        baseRevision: "basetip",
        headRevision: "headsha",
        request: async (path: string) => {
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
          const writtenContents: Readonly<Record<string, Uint8Array>> = {
            "/repos/owner/name/contents/src/legacy.ts?ref=basesha": Uint8Array.from([
              0xff, 0xfe, 0xff,
            ]),
            "/repos/owner/name/contents/src/legacy.ts?ref=headsha": Buffer.from(
              LEGACY_AFTER,
              "utf8",
            ),
            "/repos/owner/name/contents/src/legacy-api.test.ts?ref=headsha": Buffer.from(
              "const added = true;\n",
              "utf8",
            ),
          };
          const writtenContent = writtenContents[path];
          if (writtenContent === undefined) throw new Error(`unexpected request ${path}`);
          return { content: Buffer.from(writtenContent).toString("base64") };
        },
      }));

    it("compares a previous source the API answered as undecodable bytes as no source", ({
      undecodablePreviousSourceComparison,
    }) => {
      expect(undecodablePreviousSourceComparison).toStrictEqual({
        repositoryRoot: "/checkout",
        baseRevision: "basesha",
        headRevision: "headsha",
        files: [
          {
            kind: "changed",
            beforePath: "src/legacy.ts",
            afterPath: "src/legacy.ts",
            beforeSource: null,
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
  });

  describe("a pull request whose head source the API answered as undecodable bytes", () => {
    const it = test.extend("failureFromReadingAnUndecodableHeadSource", async () => {
      const [failure] = await attemptAsync<unknown, Error>(() =>
        compareGitHubPullRequest({
          repositoryRoot: "/checkout",
          repository: "owner/name",
          baseRevision: "basetip",
          headRevision: "headsha",
          request: async (path: string) => {
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
            const writtenContents: Readonly<Record<string, Uint8Array>> = {
              "/repos/owner/name/contents/src/legacy.ts?ref=basesha": Buffer.from(
                LEGACY_BEFORE,
                "utf8",
              ),
              "/repos/owner/name/contents/src/legacy.ts?ref=headsha": Uint8Array.from([
                0xff, 0xfe, 0xff,
              ]),
              "/repos/owner/name/contents/src/legacy-api.test.ts?ref=headsha": Buffer.from(
                "const added = true;\n",
                "utf8",
              ),
            };
            const writtenContent = writtenContents[path];
            if (writtenContent === undefined) throw new Error(`unexpected request ${path}`);
            return { content: Buffer.from(writtenContent).toString("base64") };
          },
        }),
      );
      return failure === null ? null : failure.message;
    });

    it("refuses a head source the API answered as undecodable bytes", ({
      failureFromReadingAnUndecodableHeadSource,
    }) => {
      expect(failureFromReadingAnUndecodableHeadSource).toBe(
        "Source blob does not decode as UTF-8: src/legacy.ts",
      );
    });
  });

  describe("a compare reporting a removal, a rename and a copy", () => {
    const it = test.extend("movedFilesComparison", () =>
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
            : {
                content: Buffer.from("export const kept = true;\n", "utf8").toString("base64"),
              },
      }));

    it("reads a removal, a rename and a copy the compare reported", ({ movedFilesComparison }) => {
      expect(movedFilesComparison).toStrictEqual({
        repositoryRoot: "/checkout",
        baseRevision: "basesha",
        headRevision: "headsha",
        files: [
          {
            kind: "deleted",
            beforePath: "src/gone.ts",
            afterPath: null,
            beforeSource: "export const kept = true;\n",
            afterSource: null,
            addedLines: [],
            firstAddedLine: null,
          },
          {
            kind: "renamed",
            beforePath: "src/was-here.ts",
            afterPath: "src/moved.ts",
            beforeSource: "export const kept = true;\n",
            afterSource: "export const kept = true;\n",
            addedLines: [],
            firstAddedLine: null,
          },
          {
            kind: "added",
            beforePath: null,
            afterPath: "src/copy.ts",
            beforeSource: null,
            afterSource: "export const kept = true;\n",
            addedLines: [],
            firstAddedLine: null,
          },
        ],
      });
    });
  });

  describe("a compare status that maps to no change", () => {
    const it = test.extend("failureFromReadingAnUnknownStatus", async () => {
      const [failure] = await attemptAsync<unknown, Error>(() =>
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
      );
      return failure === null ? null : failure.message;
    });

    it("refuses a compare status it cannot map to a change", ({
      failureFromReadingAnUnknownStatus,
    }) => {
      expect(failureFromReadingAnUnknownStatus).toBe(
        'Do not read past an unknown compare status "unchanged".',
      );
    });
  });

  describe("a renamed file the compare answered without its former path", () => {
    const it = test.extend("failureFromReadingARenameWithoutItsFormerPath", async () => {
      const [failure] = await attemptAsync<unknown, Error>(() =>
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
      );
      return failure === null ? null : failure.message;
    });

    it("refuses a renamed file the compare answered without its former path", ({
      failureFromReadingARenameWithoutItsFormerPath,
    }) => {
      expect(failureFromReadingARenameWithoutItsFormerPath).toBe(
        "Do not read a move the compare answered without its former path: docs/moved.md.",
      );
    });
  });

  describe("a file the contents API answered without content", () => {
    const it = test.extend("failureFromReadingAFileWithoutContent", async () => {
      const [failure] = await attemptAsync<unknown, Error>(() =>
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
      );
      return failure === null ? null : failure.message;
    });

    it("refuses a file the contents API answered without content", ({
      failureFromReadingAFileWithoutContent,
    }) => {
      expect(failureFromReadingAFileWithoutContent).toBe(
        "Do not read a file the contents API answered without content.",
      );
    });
  });

  describe("a compare the API answered as something other than an object", () => {
    const it = test.extend("failureFromReadingACompareThatIsNotAnObject", async () => {
      const [failure] = await attemptAsync<unknown, Error>(() =>
        compareGitHubPullRequest({
          repositoryRoot: "/checkout",
          repository: "owner/name",
          baseRevision: "basetip",
          headRevision: "headsha",
          request: async () => "no compare here",
        }),
      );
      return failure === null ? null : failure.message;
    });

    it("refuses a compare the API answered as something other than an object", ({
      failureFromReadingACompareThatIsNotAnObject,
    }) => {
      expect(failureFromReadingACompareThatIsNotAnObject).toBe(
        "Do not read a compare the API answered as something other than an object.",
      );
    });
  });

  describe("a compare that answered its changed files as something other than a list", () => {
    const it = test.extend("failureFromReadingChangedFilesThatAreNotAList", async () => {
      const [failure] = await attemptAsync<unknown, Error>(() =>
        compareGitHubPullRequest({
          repositoryRoot: "/checkout",
          repository: "owner/name",
          baseRevision: "basetip",
          headRevision: "headsha",
          request: async () => ({
            merge_base_commit: { sha: "basesha" },
            files: { "src/legacy.ts": "modified" },
          }),
        }),
      );
      return failure === null ? null : failure.message;
    });

    it("refuses changed files the compare answered as something other than a list", ({
      failureFromReadingChangedFilesThatAreNotAList,
    }) => {
      expect(failureFromReadingChangedFilesThatAreNotAList).toBe(
        "Do not read the changed files the compare answered as something other than a list.",
      );
    });
  });

  describe("a pull request that changed nothing", () => {
    const it = test.extend("emptyComparison", () =>
      compareGitHubPullRequest({
        repositoryRoot: "/checkout",
        repository: "owner/name",
        baseRevision: "basetip",
        headRevision: "headsha",
        request: async () => ({ merge_base_commit: { sha: "basesha" } }),
      }));

    it("compares nothing when the pull request changed nothing", ({ emptyComparison }) => {
      expect(emptyComparison).toStrictEqual({
        repositoryRoot: "/checkout",
        baseRevision: "basesha",
        headRevision: "headsha",
        files: [],
      });
    });
  });
});
