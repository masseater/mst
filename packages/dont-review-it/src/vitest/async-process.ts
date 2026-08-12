import { spawn, type ChildProcess, type ChildProcessByStdio } from "node:child_process";
import { text } from "node:stream/consumers";
import { setTimeout as delay } from "node:timers/promises";

import { once } from "es-toolkit";
import { onTestFinished } from "vite-plus/test";

import type { Readable } from "node:stream";

const TERMINATION_GRACE_MS = 200;
const CLOSE_GRACE_MS = 500;

export type AsyncProcessInvocation = Readonly<{
  label: string;
  command: string;
  arguments_: readonly string[];
  cwd: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs: number;
}>;

export type AsyncProcessResult = Readonly<{
  status: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
}>;

type ProcessEnd =
  | Readonly<{ kind: "close"; status: number | null; signal: NodeJS.Signals | null }>
  | Readonly<{ kind: "error"; error: Error }>;

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
    child.once("close", () => {
      resolve();
    });
  });

const endOf = (child: ChildProcess): Promise<ProcessEnd> =>
  new Promise((resolve) => {
    child.once("close", (status, signal) => {
      resolve({ kind: "close", status, signal });
    });
    child.once("error", (error) => {
      resolve({ kind: "error", error });
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
  try {
    process.kill(pid, signal);
    return "delivered";
  } catch (signalDeliveryFailure) {
    return "undeliverable";
  }
};

const signalProcessGroup = (tracked: TrackedProcess, signal: NodeJS.Signals): boolean => {
  const pid = tracked.child.pid;
  return pid !== undefined && groupSignalDelivery(-pid, signal) === "delivered";
};

const terminatePosixTree = async (tracked: TrackedProcess): Promise<void> => {
  if (!signalProcessGroup(tracked, "SIGTERM")) return;
  await delay(TERMINATION_GRACE_MS, undefined, { ref: false });
  if (!signalProcessGroup(tracked, "SIGKILL")) return;
  await delay(CLOSE_GRACE_MS, undefined, { ref: false });
};

const stopTrackedProcess = async (tracked: TrackedProcess): Promise<void> => {
  await terminatePosixTree(tracked);
};

const processFailure = (label: string, failure: Error): Error =>
  new Error(`${label}: ${failure.stack}`, { cause: failure });

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
  end: Extract<ProcessEnd, { kind: "close" }>,
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
  if (end.kind === "error") throw processFailure(invocation.label, end.error);
  return resultOf(tracked, end);
};
