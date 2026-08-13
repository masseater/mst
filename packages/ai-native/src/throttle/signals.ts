import { failedWithCode } from "./failure-codes.ts";

const INTERRUPT_SIGNALS = ["SIGINT", "SIGTERM"] as const;

export const raiseSignal = (signal: NodeJS.Signals): void => {
  process.kill(process.pid, signal);
};

const UNREACHABLE_PROCESS_CODES: ReadonlySet<string> = new Set(["ESRCH", "EPERM"]);

export const safeKill = (pid: number, signal: NodeJS.Signals): boolean => {
  try {
    process.kill(pid, signal);
    return true;
  } catch (undeliverableSignal) {
    if (failedWithCode(undeliverableSignal, UNREACHABLE_PROCESS_CODES)) return false;
    throw undeliverableSignal;
  }
};

export const installInterruptHandler = (handler: (signal: NodeJS.Signals) => void): void => {
  for (const signal of INTERRUPT_SIGNALS) process.once(signal, handler);
};

export const dropInterruptHandler = (handler: (signal: NodeJS.Signals) => void): void => {
  for (const signal of INTERRUPT_SIGNALS) process.removeListener(signal, handler);
};

export const makeWaitingInterruptHandler = (dependencies: {
  entryPath: string;
  removeEntry: (entryPath: string) => void;
  raise: (signal: NodeJS.Signals) => void;
}): ((signal: NodeJS.Signals) => void) => {
  return (signal) => {
    dependencies.removeEntry(dependencies.entryPath);
    dependencies.raise(signal);
  };
};

type HeldDependencies = {
  release: () => Promise<void>;
  raise: (signal: NodeJS.Signals) => void;
  onUnreleased: (failure: Error) => void;
};

const raiseAfterRelease = async (
  dependencies: HeldDependencies,
  arrival: Promise<NodeJS.Signals | null>,
): Promise<void> => {
  const signal = await arrival;
  if (signal === null) return;
  try {
    await dependencies.release();
  } catch (staleLease) {
    dependencies.onUnreleased(
      new Error(`releasing the slot before re-raising ${signal} failed`, { cause: staleLease }),
    );
  }
  dependencies.raise(signal);
};

export const makeHeldInterrupt = (
  dependencies: HeldDependencies,
): {
  readonly handler: (signal: NodeJS.Signals) => void;
  readonly standDown: () => void;
  readonly settled: Promise<void>;
} => {
  const arrival = Promise.withResolvers<NodeJS.Signals | null>();
  return {
    handler: arrival.resolve,
    standDown: (): void => {
      arrival.resolve(null);
    },
    settled: raiseAfterRelease(dependencies, arrival.promise),
  };
};

export const makeRunningInterruptHandler = (dependencies: {
  childPid: number;
  kill: (pid: number, signal: NodeJS.Signals) => boolean;
}): ((signal: NodeJS.Signals) => void) => {
  return (signal) => {
    dependencies.kill(-dependencies.childPid, signal);
  };
};
