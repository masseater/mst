const INTERRUPT_SIGNALS = ["SIGINT", "SIGTERM"] as const;

export const raiseSignal = (signal: NodeJS.Signals): void => {
  process.kill(process.pid, signal);
};

export const safeKill = (pid: number, signal: NodeJS.Signals): boolean => {
  try {
    process.kill(pid, signal);
    return true;
  } catch (undeliverableSignal) {
    return false;
  }
};

export const installInterruptHandler = (takenHandler: (signal: NodeJS.Signals) => void): void => {
  for (const signal of INTERRUPT_SIGNALS) process.once(signal, takenHandler);
};

export const dropInterruptHandler = (takenHandler: (signal: NodeJS.Signals) => void): void => {
  for (const signal of INTERRUPT_SIGNALS) process.removeListener(signal, takenHandler);
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
};

const releaseThenRaise = async (
  dependencies: HeldDependencies,
  signal: NodeJS.Signals,
): Promise<void> => {
  try {
    await dependencies.release();
  } catch (staleLease) {
    dependencies.raise(signal);
    return;
  }
  dependencies.raise(signal);
};

export const makeHeldInterruptHandler = (
  dependencies: HeldDependencies,
): ((signal: NodeJS.Signals) => void) => {
  return (signal) => {
    void releaseThenRaise(dependencies, signal);
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
