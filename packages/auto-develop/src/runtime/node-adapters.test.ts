import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test, vi } from "vite-plus/test";

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
type CommandFileRunner = NonNullable<
  NonNullable<Parameters<typeof createCommandExecutor>[0]>["fileRunner"]
>;

describe("createGitRunner", () => {
  const it = test
    .extend("defaultGitRunType", () => typeof createGitRunner().run)
    .extend("completedGitCommand", async () => {
      const gitFileRun = vi.fn<GitFileRunner>(() =>
        Promise.resolve({ stdout: "revision\n", stderr: "" }),
      );
      return createGitRunner({
        fileRunner: gitFileRun,
        environment: {
          ...Object.fromEntries(
            repositoryLocalGitVariables.map((gitVariable) => [
              gitVariable,
              `parent-${gitVariable}`,
            ]),
          ),
          GIT_SSH_COMMAND: "ssh -i /credentials/deploy-key",
        },
      }).run({
        args: ["rev-parse", "HEAD"],
        cwd: "/repository",
        configOverrides: { "user.name": "test user" },
      });
    })
    .extend("configuredGitFileRun", async () => {
      const configuredGitFileRun = vi.fn<GitFileRunner>(() =>
        Promise.resolve({ stdout: "revision\n", stderr: "" }),
      );
      await createGitRunner({
        fileRunner: configuredGitFileRun,
        environment: {
          ...Object.fromEntries(
            repositoryLocalGitVariables.map((gitVariable) => [
              gitVariable,
              `parent-${gitVariable}`,
            ]),
          ),
          GIT_SSH_COMMAND: "ssh -i /credentials/deploy-key",
        },
      }).run({
        args: ["rev-parse", "HEAD"],
        cwd: "/repository",
        configOverrides: { "user.name": "test user" },
      });
      return configuredGitFileRun;
    })
    .extend("unconfiguredGitFileRun", async () => {
      const unconfiguredGitFileRun = vi.fn<GitFileRunner>(() =>
        Promise.resolve({ stdout: "", stderr: "" }),
      );
      await createGitRunner({ fileRunner: unconfiguredGitFileRun, environment: {} }).run({
        args: ["status", "--short"],
        cwd: "/repository",
      });
      return unconfiguredGitFileRun;
    });

  it("constructs the process-backed default without starting a child", ({ defaultGitRunType }) => {
    expect(defaultGitRunType).toBe("function");
  });

  it("returns the completed Git command", ({ completedGitCommand }) => {
    expect(completedGitCommand).toStrictEqual({ stdout: "revision\n", stderr: "" });
  });

  it("removes repository-local Git variables while preserving transport settings", ({
    configuredGitFileRun,
  }) => {
    expect(configuredGitFileRun).toHaveBeenCalledExactlyOnceWith({
      binary: "git",
      args: ["-c", "user.name=test user", "rev-parse", "HEAD"],
      options: {
        cwd: "/repository",
        env: { GIT_SSH_COMMAND: "ssh -i /credentials/deploy-key" },
        maxBuffer: 64 * 1024 * 1024,
      },
    });
  });

  it("omits Git config flags when overrides are absent", ({ unconfiguredGitFileRun }) => {
    expect(unconfiguredGitFileRun).toHaveBeenCalledExactlyOnceWith({
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
  const it = test
    .extend("nodeVersionCommand", () =>
      createCommandExecutor({ timeout: 30_000 }).run({
        binary: process.execPath,
        args: ["--version"],
      }))
    .extend("completedCommand", () => {
      const commandFileRun = vi.fn<CommandFileRunner>(() =>
        Promise.resolve({ stdout: "out", stderr: "err" }),
      );
      return createCommandExecutor({ fileRunner: commandFileRun, timeout: 30_000 }).run({
        binary: "command",
        args: ["argument"],
      });
    })
    .extend("successfulCommandFileRun", async () => {
      const successfulCommandFileRun = vi.fn<CommandFileRunner>(() =>
        Promise.resolve({ stdout: "out", stderr: "err" }),
      );
      await createCommandExecutor({
        fileRunner: successfulCommandFileRun,
        timeout: 30_000,
      }).run({
        binary: "command",
        args: ["argument"],
      });
      return successfulCommandFileRun;
    })
    .extend("nonzeroCommand", () => {
      const processFailure = new CommandFailure({ code: 7, stderr: "err", stdout: "out" });
      return createCommandExecutor({
        fileRunner: () => Promise.reject(processFailure),
      }).run({
        binary: "command",
        args: [],
      });
    })
    .extend("missingCommand", () =>
      createCommandExecutor({
        fileRunner: () => Promise.reject(new CommandFailure({ code: "ENOENT" })),
      }).run({ binary: "missing", args: [] }),
    );

  it(
    "runs the process-backed default with the requested binary and arguments",
    { timeout: 40_000 },
    ({ nodeVersionCommand }) => {
      expect(nodeVersionCommand).toStrictEqual({
        exitCode: 0,
        stdout: `${process.version}\n`,
        stderr: "",
      });
    },
  );

  it("returns standard streams and the successful exit code", ({ completedCommand }) => {
    expect(completedCommand).toStrictEqual({ exitCode: 0, stdout: "out", stderr: "err" });
  });

  it("passes the requested command to the file runner", ({ successfulCommandFileRun }) => {
    expect(successfulCommandFileRun).toHaveBeenCalledExactlyOnceWith({
      binary: "command",
      args: ["argument"],
      options: { maxBuffer: 64 * 1024 * 1024, timeout: 30_000 },
    });
  });

  it("returns output from a nonzero child", ({ nonzeroCommand }) => {
    expect(nonzeroCommand).toStrictEqual({ exitCode: 7, stdout: "out", stderr: "err" });
  });

  it("fills absent output from a rejected file runner", ({ missingCommand }) => {
    expect(missingCommand).toStrictEqual({ exitCode: 1, stdout: "", stderr: "" });
  });
});

describe("createTailFs", () => {
  const it = test
    .extend("completeTranscript", ({}, { onCleanup }) => {
      const tailFs = createTailFs();
      const directory = tailFs.makeTempDir("auto-develop-tail-fs-");
      onCleanup(() => {
        tailFs.removeRecursive(directory);
      });
      const transcriptPath = join(directory, "output.txt");
      tailFs.appendTarget(transcriptPath);
      writeFileSync(transcriptPath, "first-second");
      return tailFs.readAll(transcriptPath);
    })
    .extend("transcriptSuffix", ({}, { onCleanup }) => {
      const tailFs = createTailFs();
      const directory = tailFs.makeTempDir("auto-develop-tail-fs-");
      onCleanup(() => {
        tailFs.removeRecursive(directory);
      });
      const transcriptPath = join(directory, "output.txt");
      tailFs.appendTarget(transcriptPath);
      writeFileSync(transcriptPath, "first-second");
      return tailFs.readFrom({ path: transcriptPath, offset: 6 });
    })
    .extend("missingTranscriptSuffix", ({}, { onCleanup }) => {
      const tailFs = createTailFs();
      const directory = tailFs.makeTempDir("auto-develop-tail-fs-");
      onCleanup(() => {
        tailFs.removeRecursive(directory);
      });
      return tailFs.readFrom({ path: join(directory, "missing"), offset: 0 });
    })
    .extend("completedExitCode", ({}, { onCleanup }) => {
      const tailFs = createTailFs();
      const directory = tailFs.makeTempDir("auto-develop-tail-fs-");
      onCleanup(() => {
        tailFs.removeRecursive(directory);
      });
      const exitCodePath = join(directory, "exit-code.txt");
      writeFileSync(exitCodePath, "7\n");
      return tailFs.readExitCode(exitCodePath);
    })
    .extend("invalidExitCode", ({}, { onCleanup }) => {
      const tailFs = createTailFs();
      const directory = tailFs.makeTempDir("auto-develop-tail-fs-");
      onCleanup(() => {
        tailFs.removeRecursive(directory);
      });
      const exitCodePath = join(directory, "invalid-exit-code.txt");
      writeFileSync(exitCodePath, "not-a-number\n");
      return tailFs.readExitCode(exitCodePath);
    })
    .extend("missingExitCode", ({}, { onCleanup }) => {
      const tailFs = createTailFs();
      const directory = tailFs.makeTempDir("auto-develop-tail-fs-");
      onCleanup(() => {
        tailFs.removeRecursive(directory);
      });
      return tailFs.readExitCode(join(directory, "missing"));
    })
    .extend("missingTranscript", ({}, { onCleanup }) => {
      const tailFs = createTailFs();
      const directory = tailFs.makeTempDir("auto-develop-tail-fs-");
      onCleanup(() => {
        tailFs.removeRecursive(directory);
      });
      return tailFs.readAll(join(directory, "missing"));
    })
    .extend("removedDirectoryPresence", () => {
      const tailFs = createTailFs();
      const directory = tailFs.makeTempDir("auto-develop-tail-fs-");
      tailFs.removeRecursive(directory);
      return existsSync(directory);
    });

  it("reads the complete transcript", ({ completeTranscript }) => {
    expect(completeTranscript).toBe("first-second");
  });

  it("reads a transcript from an offset", ({ transcriptSuffix }) => {
    expect(transcriptSuffix).toBe("second");
  });

  it("returns an empty suffix for a missing transcript", ({ missingTranscriptSuffix }) => {
    expect(missingTranscriptSuffix).toBe("");
  });

  it("reads a completed exit code", ({ completedExitCode }) => {
    expect(completedExitCode).toBe(7);
  });

  it("returns null for an invalid exit code", ({ invalidExitCode }) => {
    expect(invalidExitCode).toBe(null);
  });

  it("returns null for a missing exit code", ({ missingExitCode }) => {
    expect(missingExitCode).toBe(null);
  });

  it("returns an empty transcript for a missing file", ({ missingTranscript }) => {
    expect(missingTranscript).toBe("");
  });

  it("removes a transcript directory recursively", ({ removedDirectoryPresence }) => {
    expect(removedDirectoryPresence).toBe(false);
  });
});
