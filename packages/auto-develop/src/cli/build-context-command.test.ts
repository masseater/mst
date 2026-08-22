import { execFile } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { standardIoTest } from "@mst/dont-review-it/vitest";
import { EXIT_MISUSE } from "@mst/repository-checks";
import { runCommand } from "citty";
import { describe, expect, test } from "vite-plus/test";

import { createGitRunner } from "../runtime/node-adapters.ts";
import { createBuildContextCommand, createBuildContextWriter } from "./build-context-command.ts";

const PROCESS_DEADLINE_MS = 30_000;
const TEST_ENVELOPE_MS = 180_000;
const MAX_PROCESS_OUTPUT_BYTES = 64 * 1024 * 1024;
const FIXED_TIME = Date.parse("2026-08-13T00:00:00.000Z");

const runFile = promisify(execFile);

const repositoryHistory = `blob
mark :1
data <<BASE_CONTENT
export const value = 1;
BASE_CONTENT
commit refs/heads/main
mark :2
author auto-develop test <test@example.test> 946684800 +0000
committer auto-develop test <test@example.test> 946684800 +0000
data <<BASE_MESSAGE
base
BASE_MESSAGE
M 100644 :1 src/value.ts

blob
mark :3
data <<HEAD_CONTENT
export const value = 2;
HEAD_CONTENT
commit refs/heads/main
mark :4
author auto-develop test <test@example.test> 946684801 +0000
committer auto-develop test <test@example.test> 946684801 +0000
data <<HEAD_MESSAGE
head
HEAD_MESSAGE
from :2
M 100644 :3 src/value.ts

done
`;

describe("buildContextCommand", () => {
  describe("使用できない引数", () => {
    const it = standardIoTest
      .extend("restoreExitCode", { auto: true }, ({}, { onCleanup }) => {
        onCleanup(() => {
          process.exitCode = 0;
        });
      })
      .extend("invalidBuildContextExitCode", { auto: true }, async () => {
        const command = createBuildContextCommand({
          writeContext: () => Promise.reject(new Error("invalid arguments must stop before write")),
        });
        const invalidArgumentSets = [
          [],
          ["--pr", "0", "--base", "HEAD", "--head", "HEAD"],
          ["--pr", "1.5", "--base", "HEAD", "--head", "HEAD"],
          ["--pr", "7", "--head", "HEAD"],
          ["--pr", "7", "--base", "HEAD"],
        ];
        for (const invalidArguments of invalidArgumentSets) {
          await runCommand(command, { rawArgs: invalidArguments });
        }
        return Reflect.get(process, "exitCode");
      });

    it("usage error の終了コードを設定する", ({ invalidBuildContextExitCode }) => {
      expect(invalidBuildContextExitCode).toBe(EXIT_MISUSE);
    });

    it("標準出力には何も書かない", ({ stdout }) => {
      expect(stdout).toMatchInlineSnapshot(`
        {
          "chunks": [],
        }
      `);
    });

    it("各引数集合の診断を標準エラーへ書く", ({ stderr }) => {
      expect(stderr).toMatchInlineSnapshot(`
        {
          "chunks": [
            "--pr must be a positive integer and --base and --head are required
        ",
            "--pr must be a positive integer and --base and --head are required
        ",
            "--pr must be a positive integer and --base and --head are required
        ",
            "--pr must be a positive integer and --base and --head are required
        ",
            "--pr must be a positive integer and --base and --head are required
        ",
          ],
        }
      `);
    });
  });

  describe("使用できる引数", () => {
    const it = standardIoTest.extend("usableBuildContextRun", { auto: true }, async () => {
      const command = createBuildContextCommand({
        writeContext: (writing) =>
          Promise.resolve([
            `/contexts/${writing.prNumber}-${writing.base}.json`,
            `/contexts/${writing.prNumber}-${writing.head}.md`,
          ]),
      });
      await runCommand(command, {
        rawArgs: ["--pr", "17", "--base", "base-ref", "--head", "head-ref"],
      });
    });

    it("書いたパスを標準出力へ報告する", ({ stdout }) => {
      expect(stdout).toMatchInlineSnapshot(`
        {
          "chunks": [
            "wrote the context for PR #17
        /contexts/17-base-ref.json
        /contexts/17-head-ref.md
        ",
          ],
        }
      `);
    });

    it("標準エラーには何も書かない", ({ stderr }) => {
      expect(stderr).toMatchInlineSnapshot(`
        {
          "chunks": [],
        }
      `);
    });
  });
});

describe("createBuildContextWriter", () => {
  const it = test
    .extend("repositoryRoot", async ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "auto-develop-build-context-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      const emptyGitConfig = join(root, "empty-git-config");
      writeFileSync(emptyGitConfig, "");
      const environment = {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        GIT_CONFIG_GLOBAL: emptyGitConfig,
        GIT_CONFIG_SYSTEM: emptyGitConfig,
      };
      await runFile("git", ["init", "--initial-branch", "main"], {
        cwd: root,
        env: environment,
        maxBuffer: MAX_PROCESS_OUTPUT_BYTES,
        timeout: PROCESS_DEADLINE_MS,
      });
      await new Promise<void>((resolve, reject) => {
        const child = execFile(
          "git",
          ["fast-import", "--quiet", "--done"],
          {
            cwd: root,
            env: environment,
            encoding: "utf8",
            maxBuffer: MAX_PROCESS_OUTPUT_BYTES,
            timeout: PROCESS_DEADLINE_MS,
          },
          (failure) => {
            if (failure === null) resolve();
            else reject(new Error("git fast-import failed", { cause: failure }));
          },
        );
        child.stdin?.on("error", (failure) => {
          reject(new Error("writing Git history failed", { cause: failure }));
        });
        child.stdin?.end(repositoryHistory);
      });
      return root;
    })
    .extend("writtenContextPaths", async ({ repositoryRoot }) => {
      const emptyGitConfig = join(repositoryRoot, "empty-git-config");
      const writer = createBuildContextWriter({
        currentDirectory: () => repositoryRoot,
        git: createGitRunner({
          fileRunner: (invocation) =>
            runFile(invocation.binary, [...invocation.args], {
              ...invocation.options,
              timeout: PROCESS_DEADLINE_MS,
            }),
          environment: {
            PATH: process.env.PATH,
            HOME: process.env.HOME,
            GIT_CONFIG_GLOBAL: emptyGitConfig,
            GIT_CONFIG_SYSTEM: emptyGitConfig,
          },
        }),
        now: () => FIXED_TIME,
      });
      return writer({ prNumber: 17, base: "HEAD^", head: "HEAD" });
    })
    .extend("writtenContextJson", async ({ repositoryRoot }) => {
      const emptyGitConfig = join(repositoryRoot, "empty-git-config");
      const writer = createBuildContextWriter({
        currentDirectory: () => repositoryRoot,
        git: createGitRunner({
          fileRunner: (invocation) =>
            runFile(invocation.binary, [...invocation.args], {
              ...invocation.options,
              timeout: PROCESS_DEADLINE_MS,
            }),
          environment: {
            PATH: process.env.PATH,
            HOME: process.env.HOME,
            GIT_CONFIG_GLOBAL: emptyGitConfig,
            GIT_CONFIG_SYSTEM: emptyGitConfig,
          },
        }),
        now: () => FIXED_TIME,
      });
      const [jsonPath] = await writer({ prNumber: 17, base: "HEAD^", head: "HEAD" });
      if (jsonPath === undefined) throw new Error("context JSON path was not returned");
      return JSON.parse(readFileSync(jsonPath, "utf8")) as unknown;
    })
    .extend("writtenContextMarkdown", async ({ repositoryRoot }) => {
      const emptyGitConfig = join(repositoryRoot, "empty-git-config");
      const writer = createBuildContextWriter({
        currentDirectory: () => repositoryRoot,
        git: createGitRunner({
          fileRunner: (invocation) =>
            runFile(invocation.binary, [...invocation.args], {
              ...invocation.options,
              timeout: PROCESS_DEADLINE_MS,
            }),
          environment: {
            PATH: process.env.PATH,
            HOME: process.env.HOME,
            GIT_CONFIG_GLOBAL: emptyGitConfig,
            GIT_CONFIG_SYSTEM: emptyGitConfig,
          },
        }),
        now: () => FIXED_TIME,
      });
      const [, markdownPath] = await writer({ prNumber: 17, base: "HEAD^", head: "HEAD" });
      if (markdownPath === undefined) throw new Error("context Markdown path was not returned");
      return readFileSync(markdownPath, "utf8");
    });

  it(
    "writes the context files under the timestamped review-context directory",
    { timeout: TEST_ENVELOPE_MS },
    ({ repositoryRoot, writtenContextPaths }) => {
      expect(writtenContextPaths).toStrictEqual([
        join(
          repositoryRoot,
          ".repo-workflow",
          "review-context",
          "17-2026-08-13T00-00-00-000Z",
          "review-carried.json",
        ),
        join(
          repositoryRoot,
          ".repo-workflow",
          "review-context",
          "17-2026-08-13T00-00-00-000Z",
          "review-carried.md",
        ),
      ]);
    },
  );

  it(
    "writes the complete context JSON from the repository",
    { timeout: TEST_ENVELOPE_MS },
    ({ writtenContextJson }) => {
      expect(writtenContextJson).toMatchInlineSnapshot(`
        {
          "base": "HEAD^",
          "changedFiles": [
            {
              "content": "export const value = 2;
        ",
              "omissionReason": null,
              "path": "src/value.ts",
              "previousPath": null,
              "statusCode": "M",
            },
          ],
          "ci": {
            "checks": [],
            "failedLogPaths": [],
          },
          "comments": {
            "inlineComments": [],
            "prComments": [],
            "reviews": [],
            "threads": [],
          },
          "diff": "diff --git a/src/value.ts b/src/value.ts
        index efeee5d..44439d5 100644
        --- a/src/value.ts
        +++ b/src/value.ts
        @@ -1 +1 @@
        -export const value = 1;
        +export const value = 2;
        ",
          "head": "HEAD",
          "prNumber": 17,
        }
      `);
    },
  );

  it(
    "writes the complete context Markdown from the repository",
    { timeout: TEST_ENVELOPE_MS },
    ({ writtenContextMarkdown }) => {
      expect(writtenContextMarkdown).toMatchInlineSnapshot(`
        "# PR Context

        ## Pull Request

        - PR: #17
        - Base: HEAD^
        - Head: HEAD

        ## Changed Files

        | Status | Path | Content |
        | --- | --- | --- |
        | M | src/value.ts | included |

        ## Existing Comments

        - Reviews: 0
        - PR-level comments: 0
        - Inline comments: 0
        - Threads: 0
        - Unresolved threads: 0
        - Outdated threads: 0
        - Outdated and unresolved threads: 0

        ## CI

        | Name | State | Bucket | Details |
        | --- | --- | --- | --- |

        No failed CI logs were downloaded.
        "
      `);
    },
  );
});
