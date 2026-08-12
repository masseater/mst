import { describe, expect, test, vi } from "vite-plus/test";

import { createLifecycleGate } from "../lifecycle/lifecycle-gate.ts";
import { silentLogger } from "../logging/logger.ts";
import {
  createSessionOrchestrator,
  type SessionOrchestratorConfig,
} from "./session-orchestrator.ts";

import type { Engine } from "../engine/engine.ts";
import type { AcquireContext } from "../worktree/acquire-worktree.ts";

const acquireContext = {
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
} satisfies AcquireContext;

const engineWith = (
  writtenChunks: readonly string[],
): {
  readonly engine: Engine;
  readonly executions: ReturnType<typeof vi.fn<Engine["execute"]>>;
} => {
  const executions = vi.fn<Engine["execute"]>(async function* execute() {
    await Promise.resolve();
    for (const writtenChunk of writtenChunks) yield writtenChunk;
  });
  return { engine: { execute: executions, kill: () => Promise.resolve() }, executions };
};

const runOrchestrator = async (setup: { readonly baseBranch?: string } = {}) => {
  const acquireWorktree = vi.fn<SessionOrchestratorConfig["acquireWorktree"]>(() =>
    Promise.resolve("/tmp/worktree/pr-7"),
  );
  const setupWorktree = vi.fn<(worktreePath: string) => Promise<void>>(() => Promise.resolve());
  const buildPrompt = vi.fn<(worktreePath: string) => Promise<string>>(() =>
    Promise.resolve("prompt text"),
  );
  const { engine, executions } = engineWith(["chunk-1"]);
  const orchestrator = createSessionOrchestrator({
    acquireWorktree,
    acquireContext,
    setupWorktree,
    engine,
    gate: createLifecycleGate(),
    serialize: (task) => task(),
    log: silentLogger,
  });
  await orchestrator.runInWorktree({
    prNumber: 7,
    headBranch: "topic/x",
    ...(setup.baseBranch === undefined ? {} : { baseBranch: setup.baseBranch }),
    buildPrompt,
  });
  return {
    acquired: acquireWorktree.mock.calls,
    setups: setupWorktree.mock.calls,
    prompts: buildPrompt.mock.calls,
    executions: executions.mock.calls,
  };
};

const it = test
  .extend("reviewerRun", () => runOrchestrator({ baseBranch: "main" }))
  .extend("authorRun", () => runOrchestrator())
  .extend("serializedRun", async () => {
    const order = new Map<number, string>();
    const orchestrator = createSessionOrchestrator({
      acquireWorktree: () => {
        order.set(order.size, "acquire");
        return Promise.resolve("/tmp/worktree/pr-7");
      },
      acquireContext,
      setupWorktree: () => {
        order.set(order.size, "setup");
        return Promise.resolve();
      },
      engine: engineWith([]).engine,
      gate: createLifecycleGate(),
      serialize: (task) => {
        order.set(order.size, "serialize");
        return task();
      },
      log: silentLogger,
    });
    await orchestrator.runInWorktree({
      prNumber: 7,
      headBranch: "topic/x",
      buildPrompt: () => {
        order.set(order.size, "prompt");
        return Promise.resolve("prompt text");
      },
    });
    return [...order.values()];
  });

describe("createSessionOrchestrator", () => {
  it("reviewer は base も添えて worktree を確保する", ({ reviewerRun }) => {
    expect(reviewerRun.acquired[0]?.[0].request).toStrictEqual({
      headBranch: "topic/x",
      baseBranch: "main",
      prNumber: 7,
    });
  });

  it("author は base を渡さずに worktree を確保する", ({ authorRun }) => {
    expect(authorRun.acquired[0]?.[0].request).toStrictEqual({
      headBranch: "topic/x",
      prNumber: 7,
    });
  });

  it("確保した worktree のパスでセットアップを 1 回だけ走らせる", ({ reviewerRun }) => {
    expect(reviewerRun.setups).toStrictEqual([["/tmp/worktree/pr-7"]]);
  });

  it("プロンプト準備には worktree のパスを渡す", ({ reviewerRun }) => {
    expect(reviewerRun.prompts).toStrictEqual([["/tmp/worktree/pr-7"]]);
  });

  it("組み立てたプロンプトでエンジンを起動する", ({ reviewerRun }) => {
    expect(reviewerRun.executions[0]?.[0].prompt).toStrictEqual("prompt text");
  });

  it("エンジンには worktree を作業ディレクトリとして渡す", ({ reviewerRun }) => {
    expect(reviewerRun.executions[0]?.[0].cwd).toStrictEqual("/tmp/worktree/pr-7");
  });

  it("確保は直列化ゲートの中で行い、セットアップとプロンプトはその後に続く", ({
    serializedRun,
  }) => {
    expect(serializedRun).toStrictEqual(["serialize", "acquire", "setup", "prompt"]);
  });
});
