import type { Engine } from "../engine/engine.ts";
import type { LifecycleGate } from "../lifecycle/lifecycle-gate.ts";
import type { Logger } from "../logging/logger.ts";
import type { AcquireContext } from "../worktree/acquire-worktree.ts";

export type WorktreeAcquirer = (request: {
  readonly context: AcquireContext;
  readonly request: {
    readonly headBranch: string;
    readonly baseBranch?: string;
    readonly prNumber: number;
  };
}) => Promise<string>;

export type SessionOrchestrator = {
  readonly runInWorktree: (session: {
    readonly prNumber: number;
    readonly headBranch: string;
    readonly baseBranch?: string;
    readonly buildPrompt: (worktreePath: string) => Promise<string>;
  }) => Promise<void>;
};

export type SessionOrchestratorConfig = {
  readonly acquireWorktree: WorktreeAcquirer;
  readonly acquireContext: AcquireContext;
  readonly setupWorktree: (worktreePath: string) => Promise<void>;
  readonly engine: Engine;
  readonly gate: LifecycleGate;
  readonly serialize: <TaskResult>(task: () => Promise<TaskResult>) => Promise<TaskResult>;
  readonly log: Logger;
};

export const createSessionOrchestrator = (
  config: SessionOrchestratorConfig,
): SessionOrchestrator => ({
  runInWorktree: async (session) => {
    const worktreePath = await config.serialize(() =>
      config.acquireWorktree({
        context: config.acquireContext,
        request: {
          headBranch: session.headBranch,
          ...(session.baseBranch === undefined ? {} : { baseBranch: session.baseBranch }),
          prNumber: session.prNumber,
        },
      }),
    );
    await config.setupWorktree(worktreePath);
    const prompt = await session.buildPrompt(worktreePath);
    const signal = config.gate.openSignal(session.prNumber);
    for await (const chunk of config.engine.execute({
      prompt,
      cwd: worktreePath,
      prNumber: session.prNumber,
      signal,
    })) {
      config.log.info({ prNumber: session.prNumber, chunk }, "engine output");
    }
  },
});
