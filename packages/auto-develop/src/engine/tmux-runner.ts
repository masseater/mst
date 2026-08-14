import { join } from "node:path";

import { shellQuote, type CommandExecutor, type TailFs } from "./command-executor.ts";
import { ProcessFailedError } from "./process-failed-error.ts";
import { UnresponsiveError } from "./unresponsive-error.ts";

import type { Logger } from "../logging/logger.ts";

const DEFAULT_POLL_INTERVAL_MS = 200;

export type TmuxRunRequest = {
  readonly binary: string;
  readonly args: readonly string[];
  readonly cwd: string;
  readonly sessionName: string;
  readonly timeoutMs: number;
  readonly idleTimeoutMs?: number;
  readonly pollIntervalMs?: number;
  readonly signal?: AbortSignal;
};

export type TmuxRunnerDeps = {
  readonly exec: CommandExecutor;
  readonly fs: TailFs;
  readonly now: () => number;
  readonly sleep: (ms: number) => Promise<void>;
  readonly log: Logger;
};

const innerCommand = (build: {
  readonly binary: string;
  readonly args: readonly string[];
  readonly exitPath: string;
}): string => {
  const quoted = [build.binary, ...build.args].map(shellQuote).join(" ");
  return `${quoted}; printf '%s' "$?" > ${shellQuote(build.exitPath)}`;
};

type TailState = {
  readonly offsets: Map<string, number>;
  readonly flags: Map<string, boolean>;
  readonly times: Map<string, number>;
};

const readExit = (finalize: {
  readonly fs: TailFs;
  readonly exitPath: string;
  readonly outPath: string;
  readonly binary: string;
  readonly log: Logger;
}): number => {
  const exitCode = finalize.fs.readExitCode(finalize.exitPath) ?? -1;
  if (exitCode === 0) return 0;
  const output = finalize.fs.readAll(finalize.outPath);
  if (output !== "") {
    finalize.log.error(
      { command: finalize.binary, exitCode, output },
      "engine process exited non-zero",
    );
  }
  throw new ProcessFailedError({ command: finalize.binary, exitCode, output });
};

const finalizeRun = (settle: {
  readonly state: TailState;
  readonly request: TmuxRunRequest;
  readonly deps: TmuxRunnerDeps;
  readonly exitPath: string;
  readonly outPath: string;
}): number => {
  const { state, request } = settle;
  if (request.signal?.aborted === true) throw request.signal.reason;
  if (state.flags.get("timedOut") === true) {
    throw new Error(`engine run exceeded the ${request.timeoutMs}ms timeout`);
  }
  const idleMs = state.times.get("idleMs");
  if (idleMs !== undefined) {
    throw new UnresponsiveError({ command: request.binary, idleMs });
  }
  return readExit({
    fs: settle.deps.fs,
    exitPath: settle.exitPath,
    outPath: settle.outPath,
    binary: request.binary,
    log: settle.deps.log,
  });
};

const shouldStop = (check: {
  readonly state: TailState;
  readonly request: TmuxRunRequest;
  readonly deps: TmuxRunnerDeps;
  readonly startedAtMs: number;
}): boolean => {
  const { state, request, deps } = check;
  if (request.signal?.aborted === true) return true;
  if (deps.now() - check.startedAtMs > request.timeoutMs) {
    state.flags.set("timedOut", true);
    return true;
  }
  const lastOutputMs = state.times.get("lastOutput") ?? check.startedAtMs;
  if (request.idleTimeoutMs !== undefined && deps.now() - lastOutputMs > request.idleTimeoutMs) {
    state.times.set("idleMs", request.idleTimeoutMs);
    return true;
  }
  return false;
};

const drainNewOutput = function* (draining: {
  readonly state: TailState;
  readonly deps: TmuxRunnerDeps;
  readonly outPath: string;
  readonly stampLastOutput: boolean;
}): Generator<string, void, undefined> {
  const { state, deps } = draining;
  const chunk = deps.fs.readFrom({ path: draining.outPath, offset: state.offsets.get("out") ?? 0 });
  if (chunk === "") return;
  state.offsets.set("out", (state.offsets.get("out") ?? 0) + Buffer.byteLength(chunk));
  if (draining.stampLastOutput) state.times.set("lastOutput", deps.now());
  yield chunk;
};

const sessionEnded = async (checking: {
  readonly state: TailState;
  readonly request: TmuxRunRequest;
  readonly deps: TmuxRunnerDeps;
  readonly startedAtMs: number;
}): Promise<boolean> => {
  const { request, deps } = checking;
  if (shouldStop(checking)) {
    await deps.exec.run({ binary: "tmux", args: ["kill-session", "-t", request.sessionName] });
    return true;
  }
  const alive = await deps.exec.run({
    binary: "tmux",
    args: ["has-session", "-t", request.sessionName],
  });
  return alive.exitCode !== 0;
};

const tailLoop = async function* (loop: {
  readonly state: TailState;
  readonly request: TmuxRunRequest;
  readonly deps: TmuxRunnerDeps;
  readonly outPath: string;
  readonly startedAtMs: number;
}): AsyncGenerator<string, void, undefined> {
  const { state, request, deps, outPath } = loop;
  for (;;) {
    yield* drainNewOutput({ state, deps, outPath, stampLastOutput: true });
    if (await sessionEnded(loop)) {
      yield* drainNewOutput({ state, deps, outPath, stampLastOutput: false });
      return;
    }
    await deps.sleep(request.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS);
  }
};

const killStaleSession = async (killing: {
  readonly deps: TmuxRunnerDeps;
  readonly sessionName: string;
}): Promise<void> => {
  const existing = await killing.deps.exec.run({
    binary: "tmux",
    args: ["has-session", "-t", killing.sessionName],
  });
  if (existing.exitCode !== 0) return;
  const killed = await killing.deps.exec.run({
    binary: "tmux",
    args: ["kill-session", "-t", killing.sessionName],
  });
  if (killed.exitCode !== 0) {
    killing.deps.log.warn(
      { sessionName: killing.sessionName },
      "killing a stale tmux session failed",
    );
  }
};

const startSession = async (starting: {
  readonly deps: TmuxRunnerDeps;
  readonly request: TmuxRunRequest;
  readonly outPath: string;
  readonly exitPath: string;
}): Promise<void> => {
  starting.deps.fs.appendTarget(starting.outPath);
  await starting.deps.exec.run({
    binary: "tmux",
    args: [
      "new-session",
      "-d",
      "-s",
      starting.request.sessionName,
      "-c",
      starting.request.cwd,
      "sh",
      "-c",
      innerCommand({
        binary: starting.request.binary,
        args: starting.request.args,
        exitPath: starting.exitPath,
      }),
    ],
  });
  await starting.deps.exec.run({
    binary: "tmux",
    args: [
      "pipe-pane",
      "-t",
      starting.request.sessionName,
      "-o",
      `cat >> ${shellQuote(starting.outPath)}`,
    ],
  });
};

export const runInTmux = (deps: TmuxRunnerDeps) =>
  async function* run(request: TmuxRunRequest): AsyncGenerator<string, void, undefined> {
    await killStaleSession({ deps, sessionName: request.sessionName });
    const tempDir = deps.fs.makeTempDir(`auto-develop-tmux-${request.sessionName}-`);
    try {
      const outPath = join(tempDir, "out.log");
      const exitPath = join(tempDir, "exit");
      await startSession({ deps, request, outPath, exitPath });
      const state: TailState = { offsets: new Map(), flags: new Map(), times: new Map() };
      yield* tailLoop({ state, request, deps, outPath, startedAtMs: deps.now() });
      finalizeRun({ state, request, deps, exitPath, outPath });
    } finally {
      deps.fs.removeRecursive(tempDir);
    }
  };
