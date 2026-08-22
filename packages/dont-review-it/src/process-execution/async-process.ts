import { spawn, type ChildProcess, type ChildProcessByStdio } from "node:child_process";
import { text } from "node:stream/consumers";
import { setTimeout as delay } from "node:timers/promises";

import { attempt, once } from "es-toolkit";
import { onTestFinished } from "vite-plus/test";

import { CHILD_PROCESS_EVENT } from "../../../ai-native/src/node-event-names.ts";
import { TREE_TERMINATION_SIGNAL } from "../../../ai-native/src/throttle/process-tree.ts";

import type { Readable } from "node:stream";

const TERMINATION_GRACE_MS = 200;
const CLOSE_GRACE_MS = 500;

type AsyncProcessInvocation = Readonly<{
  label: string;
  command: string;
  arguments_: readonly string[];
  cwd: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs: number;
}>;

type AsyncProcessResult = Readonly<{
  status: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
}>;

type ProcessEnd =
  | Readonly<{
      kind: typeof CHILD_PROCESS_EVENT.close;
      status: number | null;
      signal: NodeJS.Signals | null;
    }>
  | Readonly<{ kind: typeof CHILD_PROCESS_EVENT.failure; error: Error }>;

type AwaitedEnd = ProcessEnd | Readonly<{ kind: "timeout" }>;

type TrackedProcess = Readonly<{
  child: ChildProcess;
  close: Promise<void>;
  end: Promise<ProcessEnd>;
  stdout: Promise<string>;
  stderr: Promise<string>;
}>;

const closeOf = (child: ChildProcess): Promise<void> =>
  new Promise((resolve) => {
    child.once(CHILD_PROCESS_EVENT.close, () => {
      resolve();
    });
  });

const endOf = (child: ChildProcess): Promise<ProcessEnd> =>
  new Promise((resolve) => {
    child.once(CHILD_PROCESS_EVENT.close, (exitCode, signal) => {
      resolve({ kind: CHILD_PROCESS_EVENT.close, status: exitCode, signal });
    });
    child.once(CHILD_PROCESS_EVENT.failure, (spawnFailure) => {
      resolve({ kind: CHILD_PROCESS_EVENT.failure, error: spawnFailure });
    });
  });

const trackedProcess = (child: ChildProcessByStdio<null, Readable, Readable>): TrackedProcess => ({
  child,
  close: closeOf(child),
  end: endOf(child),
  stdout: text(child.stdout),
  stderr: text(child.stderr),
});

const groupSignalDelivery = (
  pid: number,
  signal: NodeJS.Signals,
): "delivered" | "undeliverable" => {
  const [signalDeliveryFailure] = attempt(() => process.kill(pid, signal));
  return signalDeliveryFailure === null ? "delivered" : "undeliverable";
};

const signalProcessGroup = (tracked: TrackedProcess, signal: NodeJS.Signals): boolean => {
  const pid = tracked.child.pid;
  return pid !== undefined && groupSignalDelivery(-pid, signal) === "delivered";
};

const terminatePosixTree = async (tracked: TrackedProcess): Promise<void> => {
  if (!signalProcessGroup(tracked, TREE_TERMINATION_SIGNAL.graceful)) return;
  await delay(TERMINATION_GRACE_MS, undefined, { ref: false });
  if (!signalProcessGroup(tracked, TREE_TERMINATION_SIGNAL.forced)) return;
  await delay(CLOSE_GRACE_MS, undefined, { ref: false });
};

const stopTrackedProcess = async (tracked: TrackedProcess): Promise<void> => {
  await terminatePosixTree(tracked);
};

const processFailure = (processLabel: string, failure: Error): Error =>
  new Error(`${processLabel}: ${failure.stack}`, { cause: failure });

const timeoutFailure = (invocation: AsyncProcessInvocation): Error =>
  new Error(
    `${invocation.label}: timed out after ${invocation.timeoutMs}ms and was terminated with SIGTERM followed by SIGKILL`,
  );

const timeoutEnd = (
  invocation: AsyncProcessInvocation,
  cancellation: AbortSignal,
): Promise<AwaitedEnd> =>
  delay(invocation.timeoutMs, { kind: "timeout" } as const, {
    signal: cancellation,
    ref: false,
  });

const spawnTrackedProcess = (invocation: AsyncProcessInvocation): TrackedProcess =>
  trackedProcess(
    spawn(invocation.command, [...invocation.arguments_], {
      cwd: invocation.cwd,
      env: invocation.env,
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    }),
  );

const endBeforeTimeout = async ({
  invocation,
  tracked,
  stop,
}: Readonly<{
  invocation: AsyncProcessInvocation;
  tracked: TrackedProcess;
  stop: () => Promise<void>;
}>): Promise<ProcessEnd> => {
  const timeoutCancellation = new AbortController();
  const end: AwaitedEnd = await Promise.race([
    tracked.end,
    timeoutEnd(invocation, timeoutCancellation.signal),
  ]);
  timeoutCancellation.abort();
  if (end.kind !== "timeout") return end;
  await stop();
  throw timeoutFailure(invocation);
};

const resultOf = async (
  tracked: TrackedProcess,
  end: Extract<ProcessEnd, { kind: typeof CHILD_PROCESS_EVENT.close }>,
): Promise<AsyncProcessResult> => {
  const [stdout, stderr] = await Promise.all([tracked.stdout, tracked.stderr]);
  return { status: end.status, signal: end.signal, stdout, stderr };
};

const assertRunnable = (invocation: AsyncProcessInvocation, platform: NodeJS.Platform): void => {
  if (invocation.timeoutMs <= 0) {
    throw new Error(`${invocation.label}: no wall-clock time remains to start the subprocess`);
  }
  if (platform === "win32") {
    throw new Error(
      `${invocation.label}: Windows test subprocesses are refused because a process-tree hard deadline cannot be guaranteed`,
    );
  }
};

export const runAsyncProcess = async (
  invocation: AsyncProcessInvocation,
  seams: Readonly<{ platform?: NodeJS.Platform }> = {},
): Promise<AsyncProcessResult> => {
  assertRunnable(invocation, seams.platform ?? process.platform);
  const tracked = spawnTrackedProcess(invocation);
  const stop = once(async () => stopTrackedProcess(tracked));
  onTestFinished(stop);
  const end = await endBeforeTimeout({ invocation, tracked, stop });
  await stop();
  if (end.kind === CHILD_PROCESS_EVENT.failure) throw processFailure(invocation.label, end.error);
  return resultOf(tracked, end);
};
