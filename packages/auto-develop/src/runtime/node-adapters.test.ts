import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, onTestFinished, test, vi } from "vite-plus/test";

import { createCommandExecutor, createGitRunner, createTailFs } from "./node-adapters.ts";

class CommandFailure extends Error {
  readonly code: number | string;
  readonly stderr: string | undefined;
  readonly stdout: string | undefined;

  constructor({
    code,
    stderr,
    stdout,
  }: Readonly<{ code: number | string; stderr?: string; stdout?: string }>) {
    super("command failed");
    this.code = code;
    this.stderr = stderr;
    this.stdout = stdout;
  }
}

const repositoryLocalGitVariables = [
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
] as const;

type GitFileRunner = NonNullable<NonNullable<Parameters<typeof createGitRunner>[0]>["fileRunner"]>;

describe("createGitRunner", () => {
  test("constructs the process-backed default without starting a child", () => {
    expect(createGitRunner().run).toBeTypeOf("function");
  });

  test("removes repository-local Git variables while preserving transport settings", async () => {
    const fileRunner = vi.fn<GitFileRunner>(() =>
      Promise.resolve({ stdout: "revision\n", stderr: "" }),
    );

    const completedGitCommand = await createGitRunner({
      fileRunner,
      environment: {
        ...Object.fromEntries(repositoryLocalGitVariables.map((name) => [name, `parent-${name}`])),
        GIT_SSH_COMMAND: "ssh -i /credentials/deploy-key",
      },
    }).run({
      args: ["rev-parse", "HEAD"],
      cwd: "/repository",
      configOverrides: { "user.name": "test user" },
    });

    expect(completedGitCommand).toStrictEqual({ stdout: "revision\n", stderr: "" });
    expect(fileRunner).toHaveBeenCalledExactlyOnceWith({
      binary: "git",
      args: ["-c", "user.name=test user", "rev-parse", "HEAD"],
      options: {
        cwd: "/repository",
        env: { GIT_SSH_COMMAND: "ssh -i /credentials/deploy-key" },
        maxBuffer: 64 * 1024 * 1024,
      },
    });
  });

  test("omits Git config flags when overrides are absent", async () => {
    const fileRunner = vi.fn<GitFileRunner>(() => Promise.resolve({ stdout: "", stderr: "" }));

    await createGitRunner({ fileRunner, environment: {} }).run({
      args: ["status", "--short"],
      cwd: "/repository",
    });

    expect(fileRunner).toHaveBeenCalledExactlyOnceWith({
      binary: "git",
      args: ["status", "--short"],
      options: {
        cwd: "/repository",
        env: {},
        maxBuffer: 64 * 1024 * 1024,
      },
    });
  });
});

describe("createCommandExecutor", () => {
  test(
    "runs the process-backed default with the requested binary and arguments",
    { timeout: 40_000 },
    async () => {
      const gitVersion = await createCommandExecutor({ timeout: 30_000 }).run({
        binary: "git",
        args: ["--version"],
      });

      expect(gitVersion.exitCode).toBe(0);
      expect(gitVersion.stdout).toMatch(/^git version \d+\.\d+\.\d+/u);
      expect(gitVersion.stderr).toBe("");
    },
  );

  test("returns standard streams and the successful exit code", async () => {
    const fileRunner = vi.fn<
      NonNullable<NonNullable<Parameters<typeof createCommandExecutor>[0]>["fileRunner"]>
    >(() => Promise.resolve({ stdout: "out", stderr: "err" }));
    const completedCommand = await createCommandExecutor({ fileRunner, timeout: 30_000 }).run({
      binary: "command",
      args: ["argument"],
    });

    expect(completedCommand).toStrictEqual({ exitCode: 0, stdout: "out", stderr: "err" });
    expect(fileRunner).toHaveBeenCalledExactlyOnceWith({
      binary: "command",
      args: ["argument"],
      options: { maxBuffer: 64 * 1024 * 1024, timeout: 30_000 },
    });
  });

  test("returns output from a nonzero child", async () => {
    const processFailure = new CommandFailure({ code: 7, stderr: "err", stdout: "out" });
    const failed = await createCommandExecutor({
      fileRunner: () => Promise.reject(processFailure),
    }).run({
      binary: "command",
      args: [],
    });

    expect(failed).toStrictEqual({ exitCode: 7, stdout: "out", stderr: "err" });
  });

  test("fills absent output from a rejected file runner", async () => {
    const failedStart = await createCommandExecutor({
      fileRunner: () => Promise.reject(new CommandFailure({ code: "ENOENT" })),
    }).run({ binary: "missing", args: [] });

    expect(failedStart).toStrictEqual({ exitCode: 1, stdout: "", stderr: "" });
  });
});

describe("createTailFs", () => {
  test("creates, reads and removes command transcript files", () => {
    const fs = createTailFs();
    const directory = fs.makeTempDir("auto-develop-tail-fs-");
    onTestFinished(() => {
      rmSync(directory, { recursive: true, force: true });
    });
    const output = join(directory, "output.txt");
    const exitCode = join(directory, "exit-code.txt");
    const invalidExitCode = join(directory, "invalid-exit-code.txt");
    fs.appendTarget(output);
    writeFileSync(output, "first-second");
    writeFileSync(exitCode, "7\n");
    writeFileSync(invalidExitCode, "not-a-number\n");

    expect(readFileSync(output, "utf8")).toBe("first-second");
    expect(fs.readFrom({ path: output, offset: 6 })).toBe("second");
    expect(fs.readFrom({ path: join(directory, "missing"), offset: 0 })).toBe("");
    expect(fs.readExitCode(exitCode)).toBe(7);
    expect(fs.readExitCode(invalidExitCode)).toBeNull();
    expect(fs.readExitCode(join(directory, "missing"))).toBeNull();
    expect(fs.readAll(output)).toBe("first-second");
    expect(fs.readAll(join(directory, "missing"))).toBe("");

    fs.removeRecursive(directory);
    expect(existsSync(directory)).toBe(false);
  });
});
