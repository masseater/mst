import { describe, expect, test, vi } from "vite-plus/test";

import { createLifecycleGate } from "../lifecycle/lifecycle-gate.ts";
import { silentLogger } from "../logging/logger.ts";
import { createSessionOrchestrator } from "./session-orchestrator.ts";

import type { AcquireRequest } from "../worktree/acquire-worktree.ts";

describe("createSessionOrchestrator", () => {
  describe("reviewer のセッションが出す worktree 確保の依頼", () => {
    const it = test.extend("reviewerAcquireRequest", async () => {
      const reviewerAcquireRequest = vi.fn<(acquisition: AcquireRequest) => void>();
      const orchestrator = createSessionOrchestrator({
        acquireWorktree: (acquisition) => {
          reviewerAcquireRequest(acquisition.request);
          return Promise.resolve("/tmp/worktree/pr-7");
        },
        acquireContext: {
          git: { run: () => Promise.resolve({ stdout: "", stderr: "" }) },
          repoDir: "/repo",
          sharedGitDir: "/repo/.git",
          fs: {
            exists: () => false,
            removeRecursive: () => undefined,
            writeMarker: () => undefined,
            markerMtimeMs: () => null,
          },
          log: silentLogger,
          now: () => new Date("2026-08-11T00:00:00.000Z"),
        },
        setupWorktree: () => Promise.resolve(),
        engine: {
          execute: async function* execute() {
            await Promise.resolve();
            yield "chunk-1";
          },
          kill: () => Promise.resolve(),
        },
        gate: createLifecycleGate(),
        serialize: (task) => task(),
        log: silentLogger,
      });
      await orchestrator.runInWorktree({
        prNumber: 7,
        headBranch: "topic/x",
        baseBranch: "main",
        buildPrompt: () => Promise.resolve("prompt text"),
      });
      return reviewerAcquireRequest;
    });

    it("base も添えて届く", ({ reviewerAcquireRequest }) => {
      expect(reviewerAcquireRequest).toHaveBeenCalledExactlyOnceWith({
        headBranch: "topic/x",
        baseBranch: "main",
        prNumber: 7,
      });
    });
  });

  describe("author のセッションが出す worktree 確保の依頼", () => {
    const it = test.extend("authorAcquireRequest", async () => {
      const authorAcquireRequest = vi.fn<(acquisition: AcquireRequest) => void>();
      const orchestrator = createSessionOrchestrator({
        acquireWorktree: (acquisition) => {
          authorAcquireRequest(acquisition.request);
          return Promise.resolve("/tmp/worktree/pr-7");
        },
        acquireContext: {
          git: { run: () => Promise.resolve({ stdout: "", stderr: "" }) },
          repoDir: "/repo",
          sharedGitDir: "/repo/.git",
          fs: {
            exists: () => false,
            removeRecursive: () => undefined,
            writeMarker: () => undefined,
            markerMtimeMs: () => null,
          },
          log: silentLogger,
          now: () => new Date("2026-08-11T00:00:00.000Z"),
        },
        setupWorktree: () => Promise.resolve(),
        engine: {
          execute: async function* execute() {
            await Promise.resolve();
            yield "chunk-1";
          },
          kill: () => Promise.resolve(),
        },
        gate: createLifecycleGate(),
        serialize: (task) => task(),
        log: silentLogger,
      });
      await orchestrator.runInWorktree({
        prNumber: 7,
        headBranch: "topic/x",
        buildPrompt: () => Promise.resolve("prompt text"),
      });
      return authorAcquireRequest;
    });

    it("base を伴わずに届く", ({ authorAcquireRequest }) => {
      expect(authorAcquireRequest).toHaveBeenCalledExactlyOnceWith({
        headBranch: "topic/x",
        prNumber: 7,
      });
    });
  });

  describe("worktree のセットアップ", () => {
    const it = test.extend("worktreeSetup", async () => {
      const worktreeSetup = vi.fn<(worktreePath: string) => Promise<void>>(() => Promise.resolve());
      const orchestrator = createSessionOrchestrator({
        acquireWorktree: () => Promise.resolve("/tmp/worktree/pr-7"),
        acquireContext: {
          git: { run: () => Promise.resolve({ stdout: "", stderr: "" }) },
          repoDir: "/repo",
          sharedGitDir: "/repo/.git",
          fs: {
            exists: () => false,
            removeRecursive: () => undefined,
            writeMarker: () => undefined,
            markerMtimeMs: () => null,
          },
          log: silentLogger,
          now: () => new Date("2026-08-11T00:00:00.000Z"),
        },
        setupWorktree: worktreeSetup,
        engine: {
          execute: async function* execute() {
            await Promise.resolve();
            yield "chunk-1";
          },
          kill: () => Promise.resolve(),
        },
        gate: createLifecycleGate(),
        serialize: (task) => task(),
        log: silentLogger,
      });
      await orchestrator.runInWorktree({
        prNumber: 7,
        headBranch: "topic/x",
        baseBranch: "main",
        buildPrompt: () => Promise.resolve("prompt text"),
      });
      return worktreeSetup;
    });

    it("確保した worktree のパスで 1 回だけ走る", ({ worktreeSetup }) => {
      expect(worktreeSetup).toHaveBeenCalledExactlyOnceWith("/tmp/worktree/pr-7");
    });
  });

  describe("プロンプトを組み立てる呼び出し", () => {
    const it = test.extend("promptBuilder", async () => {
      const promptBuilder = vi.fn<(worktreePath: string) => Promise<string>>(() =>
        Promise.resolve("prompt text"),
      );
      const orchestrator = createSessionOrchestrator({
        acquireWorktree: () => Promise.resolve("/tmp/worktree/pr-7"),
        acquireContext: {
          git: { run: () => Promise.resolve({ stdout: "", stderr: "" }) },
          repoDir: "/repo",
          sharedGitDir: "/repo/.git",
          fs: {
            exists: () => false,
            removeRecursive: () => undefined,
            writeMarker: () => undefined,
            markerMtimeMs: () => null,
          },
          log: silentLogger,
          now: () => new Date("2026-08-11T00:00:00.000Z"),
        },
        setupWorktree: () => Promise.resolve(),
        engine: {
          execute: async function* execute() {
            await Promise.resolve();
            yield "chunk-1";
          },
          kill: () => Promise.resolve(),
        },
        gate: createLifecycleGate(),
        serialize: (task) => task(),
        log: silentLogger,
      });
      await orchestrator.runInWorktree({
        prNumber: 7,
        headBranch: "topic/x",
        baseBranch: "main",
        buildPrompt: promptBuilder,
      });
      return promptBuilder;
    });

    it("worktree のパスを受け取る", ({ promptBuilder }) => {
      expect(promptBuilder).toHaveBeenCalledExactlyOnceWith("/tmp/worktree/pr-7");
    });
  });

  describe("エンジンの起動", () => {
    const it = test
      .extend("enginePrompt", async () => {
        const enginePrompt = vi.fn<(prompt: string) => void>();
        const orchestrator = createSessionOrchestrator({
          acquireWorktree: () => Promise.resolve("/tmp/worktree/pr-7"),
          acquireContext: {
            git: { run: () => Promise.resolve({ stdout: "", stderr: "" }) },
            repoDir: "/repo",
            sharedGitDir: "/repo/.git",
            fs: {
              exists: () => false,
              removeRecursive: () => undefined,
              writeMarker: () => undefined,
              markerMtimeMs: () => null,
            },
            log: silentLogger,
            now: () => new Date("2026-08-11T00:00:00.000Z"),
          },
          setupWorktree: () => Promise.resolve(),
          engine: {
            execute: async function* execute(execution) {
              enginePrompt(execution.prompt);
              await Promise.resolve();
              yield "chunk-1";
            },
            kill: () => Promise.resolve(),
          },
          gate: createLifecycleGate(),
          serialize: (task) => task(),
          log: silentLogger,
        });
        await orchestrator.runInWorktree({
          prNumber: 7,
          headBranch: "topic/x",
          baseBranch: "main",
          buildPrompt: () => Promise.resolve("prompt text"),
        });
        return enginePrompt;
      })
      .extend("engineWorkingDirectory", async () => {
        const engineWorkingDirectory = vi.fn<(cwd: string) => void>();
        const orchestrator = createSessionOrchestrator({
          acquireWorktree: () => Promise.resolve("/tmp/worktree/pr-7"),
          acquireContext: {
            git: { run: () => Promise.resolve({ stdout: "", stderr: "" }) },
            repoDir: "/repo",
            sharedGitDir: "/repo/.git",
            fs: {
              exists: () => false,
              removeRecursive: () => undefined,
              writeMarker: () => undefined,
              markerMtimeMs: () => null,
            },
            log: silentLogger,
            now: () => new Date("2026-08-11T00:00:00.000Z"),
          },
          setupWorktree: () => Promise.resolve(),
          engine: {
            execute: async function* execute(execution) {
              engineWorkingDirectory(execution.cwd);
              await Promise.resolve();
              yield "chunk-1";
            },
            kill: () => Promise.resolve(),
          },
          gate: createLifecycleGate(),
          serialize: (task) => task(),
          log: silentLogger,
        });
        await orchestrator.runInWorktree({
          prNumber: 7,
          headBranch: "topic/x",
          baseBranch: "main",
          buildPrompt: () => Promise.resolve("prompt text"),
        });
        return engineWorkingDirectory;
      });

    it("組み立てたプロンプトで始まる", ({ enginePrompt }) => {
      expect(enginePrompt).toHaveBeenCalledExactlyOnceWith("prompt text");
    });

    it("確保した worktree を作業ディレクトリにする", ({ engineWorkingDirectory }) => {
      expect(engineWorkingDirectory).toHaveBeenCalledExactlyOnceWith("/tmp/worktree/pr-7");
    });
  });

  describe("段取りが踏まれる順序", () => {
    const it = test.extend("orchestrationStage", async () => {
      const orchestrationStage = vi.fn<(stage: string) => void>();
      const orchestrator = createSessionOrchestrator({
        acquireWorktree: () => {
          orchestrationStage("acquire");
          return Promise.resolve("/tmp/worktree/pr-7");
        },
        acquireContext: {
          git: { run: () => Promise.resolve({ stdout: "", stderr: "" }) },
          repoDir: "/repo",
          sharedGitDir: "/repo/.git",
          fs: {
            exists: () => false,
            removeRecursive: () => undefined,
            writeMarker: () => undefined,
            markerMtimeMs: () => null,
          },
          log: silentLogger,
          now: () => new Date("2026-08-11T00:00:00.000Z"),
        },
        setupWorktree: () => {
          orchestrationStage("setup");
          return Promise.resolve();
        },
        engine: {
          execute: async function* execute() {
            await Promise.resolve();
            yield "chunk-1";
          },
          kill: () => Promise.resolve(),
        },
        gate: createLifecycleGate(),
        serialize: (task) => {
          orchestrationStage("serialize");
          return task();
        },
        log: silentLogger,
      });
      await orchestrator.runInWorktree({
        prNumber: 7,
        headBranch: "topic/x",
        buildPrompt: () => {
          orchestrationStage("prompt");
          return Promise.resolve("prompt text");
        },
      });
      return orchestrationStage;
    });

    it("直列化ゲートを最初に踏む", ({ orchestrationStage }) => {
      expect(orchestrationStage).toHaveBeenNthCalledWith(1, "serialize");
    });

    it("worktree の確保をゲートの中で踏む", ({ orchestrationStage }) => {
      expect(orchestrationStage).toHaveBeenNthCalledWith(2, "acquire");
    });

    it("セットアップを確保のあとに踏む", ({ orchestrationStage }) => {
      expect(orchestrationStage).toHaveBeenNthCalledWith(3, "setup");
    });

    it("プロンプトの組み立てをセットアップのあとに踏む", ({ orchestrationStage }) => {
      expect(orchestrationStage).toHaveBeenNthCalledWith(4, "prompt");
    });
  });
});
