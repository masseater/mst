import { CLAUDE_ENGINE, type EngineKind } from "../config/engine.ts";
import { EngineAuthExpiredError, matchedAuthExpiryPattern } from "./auth-expiry.ts";
import { buildClaudeArgs, buildCodexArgs } from "./build-args.ts";
import { parseLaunchOverride } from "./launch-override.ts";
import { ProcessFailedError } from "./process-failed-error.ts";
import { engineSessionName } from "./session-name.ts";

import type { Logger } from "../logging/logger.ts";
import type { TmuxRunRequest } from "./tmux-runner.ts";

const IDLE_TIMEOUT_MS = 30 * 60_000;

export type GitPathResolver = (cwd: string) => Promise<{
  readonly repoRoot: string | null;
  readonly sharedGitDir: string | null;
}>;

export type EngineRunner = (request: TmuxRunRequest) => AsyncGenerator<string, void, undefined>;

export type Engine = {
  readonly execute: (execution: {
    readonly prompt: string;
    readonly cwd: string;
    readonly prNumber: number;
    readonly signal?: AbortSignal;
  }) => AsyncGenerator<string, void, undefined>;
  readonly kill: (prNumber: number) => Promise<void>;
};

export type EngineConfig = {
  readonly kind: EngineKind;
  readonly resolveGitPaths: GitPathResolver;
  readonly launchOverride?: string;
  readonly timeoutMs: number;
  readonly bypassPermissions: boolean;
  readonly runner: EngineRunner;
  readonly killSession: (sessionName: string) => Promise<void>;
  readonly log: Logger;
};

const argsFor = async (
  config: EngineConfig,
  build: {
    readonly prompt: string;
    readonly cwd: string;
    readonly prNumber: number;
  },
): Promise<readonly string[]> => {
  if (config.kind === CLAUDE_ENGINE) {
    return buildClaudeArgs({
      prompt: build.prompt,
      prNumber: build.prNumber,
      bypassPermissions: config.bypassPermissions,
    });
  }
  const gitPaths = await config.resolveGitPaths(build.cwd);
  return buildCodexArgs({
    prompt: build.prompt,
    cwd: build.cwd,
    repoRoot: gitPaths.repoRoot,
    sharedGitDir: gitPaths.sharedGitDir,
    bypassPermissions: config.bypassPermissions,
  });
};

const reclassifyFailure = (config: EngineConfig, failure: unknown): unknown => {
  if (!(failure instanceof ProcessFailedError)) return failure;
  const matched = matchedAuthExpiryPattern({ engine: config.kind, output: failure.output });
  if (matched === null) return failure;
  const authError = new EngineAuthExpiredError({
    engine: config.kind,
    matchedPattern: matched,
    cause: failure,
  });
  config.log.error(
    { engine: config.kind, matchedPattern: matched },
    "engine authentication expired; halting the queue",
  );
  return authError;
};

const buildRunRequest = async (build: {
  readonly config: EngineConfig;
  readonly override: ReturnType<typeof parseLaunchOverride>;
  readonly execution: {
    readonly prompt: string;
    readonly cwd: string;
    readonly prNumber: number;
    readonly signal?: AbortSignal;
  };
  readonly sessionName: string;
}): Promise<TmuxRunRequest> => {
  const engineArgs = await argsFor(build.config, build.execution);
  return {
    binary: build.override?.binary ?? build.config.kind,
    args: [...(build.override?.prefixArgs ?? []), ...engineArgs],
    cwd: build.execution.cwd,
    sessionName: build.sessionName,
    timeoutMs: build.config.timeoutMs,
    idleTimeoutMs: IDLE_TIMEOUT_MS,
    ...(build.execution.signal === undefined ? {} : { signal: build.execution.signal }),
  };
};

export const createEngine = (config: EngineConfig): Engine => {
  if (config.bypassPermissions) {
    config.log.warn({ engine: config.kind }, "engine permission bypass is enabled");
  }
  const override = parseLaunchOverride(config.launchOverride);
  return {
    execute: async function* execute(execution) {
      const sessionName = engineSessionName(execution.prNumber);
      const request = await buildRunRequest({ config, override, execution, sessionName });
      config.log.info(
        {
          prNumber: execution.prNumber,
          engine: config.kind,
          command: request.binary,
          sessionName,
          timeoutMs: config.timeoutMs,
        },
        "engine execution started",
      );
      try {
        yield* config.runner(request);
        config.log.info(
          { prNumber: execution.prNumber, engine: config.kind, sessionName },
          "engine execution completed",
        );
      } catch (executionFailure) {
        const reclassified = reclassifyFailure(config, executionFailure);
        if (reclassified === executionFailure) {
          config.log.error(
            { prNumber: execution.prNumber, engine: config.kind, err: executionFailure },
            "engine execution failed",
          );
        }
        throw reclassified;
      }
    },
    kill: async (prNumber) => {
      try {
        await config.killSession(engineSessionName(prNumber));
      } catch (killFailure) {
        config.log.warn({ prNumber, err: killFailure }, "killing the engine session failed");
      }
    },
  };
};
