import { execFile } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { standardIoTest } from "@mst/dont-review-it/vitest";
import { EXIT_MISUSE } from "@mst/repository-checks";
import { runCommand } from "citty";
import { describe, expect, onTestFinished, test, vi } from "vite-plus/test";

import { createGitRunner } from "../runtime/node-adapters.ts";
import { createBuildContextCommand, createBuildContextWriter } from "./build-context-command.ts";

const PROCESS_DEADLINE_MS = 30_000;
const TEST_ENVELOPE_MS = 180_000;
const MAX_PROCESS_OUTPUT_BYTES = 64 * 1024 * 1024;
const FIXED_TIME = Date.parse("2026-08-13T00:00:00.000Z");

type GitFileRunner = NonNullable<NonNullable<Parameters<typeof createGitRunner>[0]>["fileRunner"]>;

const runFile = promisify(execFile);

const runFileWithDeadline: GitFileRunner = (invocation) =>
  runFile(invocation.binary, [...invocation.args], {
    ...invocation.options,
    timeout: PROCESS_DEADLINE_MS,
  });

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

const importRepositoryHistory = (root: string, environment: NodeJS.ProcessEnv): Promise<void> =>
  new Promise((resolve, reject) => {
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

const createRepository = async (): Promise<{
  readonly root: string;
  readonly environment: NodeJS.ProcessEnv;
}> => {
  const root = mkdtempSync(join(tmpdir(), "auto-develop-build-context-"));
  onTestFinished(() => {
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
  await runFileWithDeadline({
    binary: "git",
    args: ["init", "--initial-branch", "main"],
    options: {
      cwd: root,
      env: environment,
      maxBuffer: MAX_PROCESS_OUTPUT_BYTES,
    },
  });
  await importRepositoryHistory(root, environment);
  return { root, environment };
};

const writeContext = vi.fn<Parameters<typeof createBuildContextCommand>[0]["writeContext"]>(
  ({
    prNumber,
    base,
    head,
  }: {
    readonly prNumber: number;
    readonly base: string;
    readonly head: string;
  }) => Promise.resolve([`/contexts/${prNumber}-${base}.json`, `/contexts/${prNumber}-${head}.md`]),
);

const command = createBuildContextCommand({
  writeContext,
});

describe("buildContextCommand", () => {
  standardIoTest("rejects unusable arguments", async ({ stdout, stderr }) => {
    onTestFinished(() => {
      process.exitCode = 0;
    });
    const invalidArguments = [
      [],
      ["--pr", "0", "--base", "HEAD", "--head", "HEAD"],
      ["--pr", "1.5", "--base", "HEAD", "--head", "HEAD"],
      ["--pr", "7", "--head", "HEAD"],
      ["--pr", "7", "--base", "HEAD"],
    ];

    for (const rawArgs of invalidArguments) {
      process.exitCode = 0;
      await runCommand(command, { rawArgs });
      expect(process.exitCode).toBe(EXIT_MISUSE);
    }

    expect(stdout.text).toMatchInlineSnapshot(`""`);
    expect(stderr.text).toMatchInlineSnapshot(`
      "--pr must be a positive integer and --base and --head are required
      --pr must be a positive integer and --base and --head are required
      --pr must be a positive integer and --base and --head are required
      --pr must be a positive integer and --base and --head are required
      --pr must be a positive integer and --base and --head are required
      "
    `);
  });

  standardIoTest(
    "passes usable arguments to the writer and reports its paths",
    async ({ stdout, stderr }) => {
      await runCommand(command, {
        rawArgs: ["--pr", "17", "--base", "base-ref", "--head", "head-ref"],
      });

      expect(writeContext).toHaveBeenCalledExactlyOnceWith({
        prNumber: 17,
        base: "base-ref",
        head: "head-ref",
      });
      expect(stdout.text).toMatchInlineSnapshot(`
        "wrote the context for PR #17
        /contexts/17-base-ref.json
        /contexts/17-head-ref.md
        "
      `);
      expect(stderr.text).toMatchInlineSnapshot(`""`);
    },
  );
});

describe("createBuildContextWriter", () => {
  test(
    "writes context JSON and Markdown from a real Git repository",
    { timeout: TEST_ENVELOPE_MS },
    async () => {
      const repository = await createRepository();
      const writeContext = createBuildContextWriter({
        currentDirectory: () => repository.root,
        git: createGitRunner({
          fileRunner: runFileWithDeadline,
          environment: repository.environment,
        }),
        now: () => FIXED_TIME,
      });

      const [jsonPath, markdownPath] = await writeContext({
        prNumber: 17,
        base: "HEAD^",
        head: "HEAD",
      });
      const expectedDirectory = join(
        repository.root,
        ".repo-workflow",
        "review-context",
        "17-2026-08-13T00-00-00-000Z",
      );
      expect([jsonPath, markdownPath]).toStrictEqual([
        join(expectedDirectory, "review-context.json"),
        join(expectedDirectory, "review-context.md"),
      ]);
      const context = JSON.parse(readFileSync(jsonPath as string, "utf8")) as {
        readonly prNumber: number;
        readonly base: string;
        readonly head: string;
        readonly diff: string;
        readonly changedFiles: readonly {
          readonly path: string;
          readonly content: string | null;
        }[];
        readonly comments: Readonly<Record<string, readonly unknown[]>>;
        readonly ci: Readonly<Record<string, readonly unknown[]>>;
      };
      expect(context).toMatchObject({
        prNumber: 17,
        base: "HEAD^",
        head: "HEAD",
        changedFiles: [{ path: "src/value.ts", content: "export const value = 2;\n" }],
        comments: { reviews: [], prComments: [], inlineComments: [], threads: [] },
        ci: { checks: [], failedLogPaths: [] },
      });
      expect(context.diff).toContain("-export const value = 1;");
      expect(context.diff).toContain("+export const value = 2;");
      const markdown = readFileSync(markdownPath as string, "utf8");
      expect(markdown).toContain("# PR Context\n");
      expect(markdown).toContain("- PR: #17\n");
      expect(markdown).toContain("| M | src/value.ts | included |");
      expect(markdown).toContain("No failed CI logs were downloaded.\n");
    },
  );
});
