import { spawnSync } from "node:child_process";

import { attempt } from "es-toolkit";

type TaskkillExecutor = (invocation: {
  executable: string;
  handedArguments: readonly string[];
  spawnConfiguration: { stdio: "ignore"; windowsHide: true };
}) => { error?: Error; status: number | null };

type ProcessTreeDependencies = {
  platform: NodeJS.Platform;
  signalProcess: (pid: number, signal: NodeJS.Signals) => Error | null;
  executeTaskkill: TaskkillExecutor;
};

const signalProcess = (pid: number, signal: NodeJS.Signals): Error | null => {
  const [signalFailure] = attempt<true, Error>(() => {
    process.kill(pid, signal);
    return true;
  });
  return signalFailure;
};

const executeTaskkill: TaskkillExecutor = (invocation) =>
  spawnSync(invocation.executable, [...invocation.handedArguments], invocation.spawnConfiguration);

const runWindowsTaskkill = (pid: number, execute: TaskkillExecutor): Error | null => {
  const taskkillExit = execute({
    executable: "taskkill",
    handedArguments: ["/PID", String(pid), "/T", "/F"],
    spawnConfiguration: { stdio: "ignore", windowsHide: true },
  });
  if (taskkillExit.error !== undefined) return taskkillExit.error;
  return taskkillExit.status === 0
    ? null
    : new Error(`taskkill exited with code ${taskkillExit.status ?? "unknown"}`);
};

const combinedFailure = (primary: Error, fallback: Error | null): Error =>
  fallback === null
    ? primary
    : new AggregateError(
        [primary, fallback],
        "Could not signal the command tree or its root process",
      );

const processIsMissing = (failure: Error): boolean =>
  (failure as NodeJS.ErrnoException).code === "ESRCH";

const resolvedDependencies = (
  input: Partial<ProcessTreeDependencies> | undefined,
): ProcessTreeDependencies => ({
  platform: input?.platform ?? process.platform,
  signalProcess: input?.signalProcess ?? signalProcess,
  executeTaskkill: input?.executeTaskkill ?? executeTaskkill,
});

const treeSignalFailure = (input: {
  pid: number;
  signal: NodeJS.Signals;
  dependencies: ProcessTreeDependencies;
}): Error | null =>
  input.dependencies.platform === "win32"
    ? runWindowsTaskkill(input.pid, input.dependencies.executeTaskkill)
    : input.dependencies.signalProcess(-input.pid, input.signal);

const shutdownCompleted = (input: {
  platform: NodeJS.Platform;
  treeFailure: Error;
  rootFailure: Error | null;
}): boolean =>
  input.platform !== "win32" &&
  processIsMissing(input.treeFailure) &&
  input.rootFailure !== null &&
  processIsMissing(input.rootFailure);

export const signalProcessTree = (input: {
  pid: number;
  signal: NodeJS.Signals;
  dependencies?: Partial<ProcessTreeDependencies>;
}): Error | null => {
  const dependencies = resolvedDependencies(input.dependencies);
  const treeFailure = treeSignalFailure({ ...input, dependencies });
  if (treeFailure === null) return null;
  const rootFailure = dependencies.signalProcess(
    input.pid,
    dependencies.platform === "win32" ? "SIGKILL" : input.signal,
  );
  if (shutdownCompleted({ platform: dependencies.platform, treeFailure, rootFailure })) {
    return null;
  }
  return combinedFailure(treeFailure, rootFailure);
};
