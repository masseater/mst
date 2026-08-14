import { existsSync } from "node:fs";

import { describe, expect, it, vi } from "vite-plus/test";

import { withTestRepository } from "./test-repository.ts";

type TestRepositorySeams = NonNullable<Parameters<typeof withTestRepository>[1]>;
type GitExecutor = NonNullable<TestRepositorySeams["executeGit"]>;

const capturedFailure = async (operation: () => Promise<unknown>): Promise<unknown> => {
  try {
    await operation();
  } catch (failure) {
    return failure;
  }
  throw new Error("Expected operation to fail");
};

describe("withTestRepository", () => {
  it("creates commits in an isolated repository and removes it after use", async () => {
    const completedRepository = await withTestRepository(async (repository) => {
      const base = repository.commit({
        files: { "src/legacy.ts": "export const legacy = true;\n" },
      });
      repository.commit({ removed: ["src/legacy.ts"] });
      const head = repository.commit({
        files: { "src/current.ts": "export const current = true;\n" },
      });

      return {
        base,
        head,
        repositoryRoot: repository.root,
        status: repository.git(["status", "--short"]),
      };
    });

    expect(completedRepository.base).not.toBe(completedRepository.head);
    expect(completedRepository.status).toBe("");
    expect(existsSync(completedRepository.repositoryRoot)).toBe(false);
  });

  it("shares one absolute deadline and excludes the parent Git environment", async () => {
    const executeGit = vi.fn<GitExecutor>(() => "");
    const removeDirectory = vi.fn<(path: string) => void>();
    const now = vi
      .fn<() => number>()
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(105)
      .mockReturnValueOnce(125);
    vi.stubEnv("GIT_DIR", "/parent/repository/.git");

    try {
      await withTestRepository(
        async (repository) => {
          repository.git(["status", "--short"]);
        },
        {
          executeGit,
          makeTemporaryDirectory: () => "/fixture",
          now,
          removeDirectory,
          timeoutMs: 40,
        },
      );
    } finally {
      vi.unstubAllEnvs();
    }

    expect(executeGit).toHaveBeenCalledTimes(2);
    expect(executeGit.mock.calls[0]?.[0]).toMatchObject({
      executable: "git",
      args: ["init", "--quiet", "--initial-branch=main"],
      options: {
        cwd: "/fixture",
        encoding: "utf8",
        killSignal: "SIGKILL",
        timeout: 35,
      },
    });
    expect(executeGit.mock.calls[1]?.[0].options).toMatchObject({ timeout: 15 });
    expect(executeGit.mock.calls[0]?.[0].options.env).toStrictEqual({
      GIT_AUTHOR_EMAIL: "stop-ai-slop@example.test",
      GIT_AUTHOR_NAME: "Stop AI Slop",
      GIT_COMMITTER_EMAIL: "stop-ai-slop@example.test",
      GIT_COMMITTER_NAME: "Stop AI Slop",
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_CONFIG_SYSTEM: "/dev/null",
      HOME: "/fixture",
      PATH: process.env.PATH,
    });
    expect(removeDirectory).toHaveBeenCalledExactlyOnceWith("/fixture");
  });

  it("refuses to start another Git child after the shared deadline", async () => {
    const executeGit = vi.fn<GitExecutor>(() => "");
    const removeDirectory = vi.fn<(path: string) => void>();
    const now = vi.fn<() => number>().mockReturnValueOnce(100).mockReturnValueOnce(140);

    await expect(
      withTestRepository(async () => undefined, {
        executeGit,
        makeTemporaryDirectory: () => "/expired-fixture",
        now,
        removeDirectory,
        timeoutMs: 40,
      }),
    ).rejects.toThrow("Test repository Git deadline exceeded before git init");

    expect(executeGit).not.toHaveBeenCalled();
    expect(removeDirectory).toHaveBeenCalledExactlyOnceWith("/expired-fixture");
  });

  it("removes the repository only after a timed-out child has closed", async () => {
    const timeoutFailure = new Error("Git child timed out");
    const executeGit = vi.fn<GitExecutor>(() => {
      throw timeoutFailure;
    });
    const removeDirectory = vi.fn<(path: string) => void>();

    await expect(
      withTestRepository(async () => undefined, {
        executeGit,
        makeTemporaryDirectory: () => "/timed-out-fixture",
        now: () => 0,
        removeDirectory,
        timeoutMs: 40,
      }),
    ).rejects.toBe(timeoutFailure);

    expect(executeGit.mock.invocationCallOrder[0]).toBeLessThan(
      removeDirectory.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it("preserves both the operation failure and cleanup failure", async () => {
    const operationFailure = new Error("Git failed");
    const cleanupFailure = new Error("cleanup failed");
    const failure = await capturedFailure(async () =>
      withTestRepository(async () => undefined, {
        executeGit: () => {
          throw operationFailure;
        },
        makeTemporaryDirectory: () => "/failed-fixture",
        now: () => 0,
        removeDirectory: () => {
          throw cleanupFailure;
        },
        timeoutMs: 40,
      }),
    );

    expect(failure).toBeInstanceOf(AggregateError);
    expect((failure as AggregateError).errors).toStrictEqual([operationFailure, cleanupFailure]);
  });

  it("reports cleanup failure after a successful exercise", async () => {
    const cleanupFailure = new Error("cleanup failed");

    await expect(
      withTestRepository(async () => "completed", {
        executeGit: () => "",
        makeTemporaryDirectory: () => "/cleanup-failure-fixture",
        now: () => 0,
        removeDirectory: () => {
          throw cleanupFailure;
        },
        timeoutMs: 40,
      }),
    ).rejects.toBe(cleanupFailure);
  });
});
