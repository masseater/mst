import { execFile } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { omitBy } from "es-toolkit";

import type { CommandExecutor, TailFs } from "../engine/command-executor.ts";
import type { GitRunner } from "../worktree/git-runner.ts";

const repositoryLocalGitVariables = new Set([
  "GIT_ALTERNATE_OBJECT_DIRECTORIES",
  "GIT_COMMON_DIR",
  "GIT_CONFIG",
  "GIT_CONFIG_COUNT",
  "GIT_CONFIG_PARAMETERS",
  "GIT_DIR",
  "GIT_GRAFT_FILE",
  "GIT_IMPLICIT_WORK_TREE",
  "GIT_INDEX_FILE",
  "GIT_NO_REPLACE_OBJECTS",
  "GIT_OBJECT_DIRECTORY",
  "GIT_PREFIX",
  "GIT_REPLACE_REF_BASE",
  "GIT_SHALLOW_FILE",
  "GIT_WORK_TREE",
]);

type FileRunner = (invocation: {
  readonly binary: string;
  readonly args: readonly string[];
  readonly options: {
    readonly cwd?: string;
    readonly env?: NodeJS.ProcessEnv;
    readonly maxBuffer: number;
    readonly timeout?: number;
  };
}) => Promise<{ readonly stdout: string; readonly stderr: string }>;

const executeChildFile = promisify(execFile);

const runFile: FileRunner = (invocation) =>
  executeChildFile(invocation.binary, [...invocation.args], invocation.options);

export const createGitRunner = (
  dependencies: {
    readonly fileRunner?: FileRunner;
    readonly environment?: NodeJS.ProcessEnv;
  } = {},
): GitRunner => {
  const fileRunner = dependencies.fileRunner ?? runFile;
  const environment = dependencies.environment ?? process.env;
  return {
    run: async (invocation) => {
      const configArgs = Object.entries(invocation.configOverrides ?? {}).flatMap(
        ([key, value]) => ["-c", `${key}=${value}`],
      );
      const finished = await fileRunner({
        binary: "git",
        args: [...configArgs, ...invocation.args],
        options: {
          cwd: invocation.cwd,
          env: omitBy(environment, (_, name) => repositoryLocalGitVariables.has(String(name))),
          maxBuffer: 64 * 1024 * 1024,
        },
      });
      return { stdout: finished.stdout, stderr: finished.stderr };
    },
  };
};

export const createCommandExecutor = (
  dependencies: { readonly fileRunner?: FileRunner; readonly timeout?: number } = {},
): CommandExecutor => {
  const fileRunner = dependencies.fileRunner ?? runFile;
  return {
    run: async (invocation) => {
      try {
        const finished = await fileRunner({
          binary: invocation.binary,
          args: invocation.args,
          options: {
            maxBuffer: 64 * 1024 * 1024,
            ...(dependencies.timeout === undefined ? {} : { timeout: dependencies.timeout }),
          },
        });
        return { exitCode: 0, stdout: finished.stdout, stderr: finished.stderr };
      } catch (commandFailure) {
        const failure = commandFailure as { code?: number; stdout?: string; stderr?: string };
        return {
          exitCode: typeof failure.code === "number" ? failure.code : 1,
          stdout: failure.stdout ?? "",
          stderr: failure.stderr ?? "",
        };
      }
    },
  };
};

export const createTailFs = (): TailFs => ({
  makeTempDir: (prefix) => mkdtempSync(join(tmpdir(), prefix)),
  appendTarget: (path) => {
    writeFileSync(path, "");
  },
  readFrom: ({ path, offset }) => {
    try {
      return readFileSync(path).subarray(offset).toString("utf8");
    } catch (readFailure) {
      void readFailure;
      return "";
    }
  },
  readExitCode: (path) => {
    try {
      const parsed = Number(readFileSync(path, "utf8").trim());
      return Number.isFinite(parsed) ? parsed : null;
    } catch (readFailure) {
      void readFailure;
      return null;
    }
  },
  readAll: (path) => {
    try {
      return readFileSync(path, "utf8");
    } catch (readFailure) {
      void readFailure;
      return "";
    }
  },
  removeRecursive: (path) => {
    rmSync(path, { recursive: true, force: true });
  },
});
