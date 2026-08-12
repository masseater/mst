import { execFile } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import type { CommandExecutor, TailFs } from "../engine/command-executor.ts";
import type { GitRunner } from "../worktree/git-runner.ts";

const runFile = promisify(execFile);

export const createGitRunner = (): GitRunner => ({
  run: async (invocation) => {
    const configArgs = Object.entries(invocation.configOverrides ?? {}).flatMap(([key, value]) => [
      "-c",
      `${key}=${value}`,
    ]);
    const finished = await runFile("git", [...configArgs, ...invocation.args], {
      cwd: invocation.cwd,
      maxBuffer: 64 * 1024 * 1024,
    });
    return { stdout: finished.stdout, stderr: finished.stderr };
  },
});

export const createCommandExecutor = (): CommandExecutor => ({
  run: async (invocation) => {
    try {
      const finished = await runFile(invocation.binary, [...invocation.args], {
        maxBuffer: 64 * 1024 * 1024,
      });
      return { exitCode: 0, stdout: finished.stdout, stderr: finished.stderr };
    } catch (commandFailure) {
      const failure = commandFailure as { code?: number; stdout?: string; stderr?: string };
      return {
        exitCode: failure.code ?? 1,
        stdout: failure.stdout ?? "",
        stderr: failure.stderr ?? "",
      };
    }
  },
});

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
