/** @canonical-values ai-native.interrupt-signal */
const INTERRUPT_SIGNALS = ["SIGINT", "SIGTERM"] as const;

export const raiseSignal = (signal: NodeJS.Signals): void => {
  process.kill(process.pid, signal);
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
  signalTree: (input: { pid: number; signal: NodeJS.Signals }) => Error | null;
  reportFailure: (failure: Error) => void;
}): ((signal: NodeJS.Signals) => void) => {
  return (signal) => {
    const failure = dependencies.signalTree({ pid: dependencies.childPid, signal });
    if (failure !== null) dependencies.reportFailure(failure);
  };
};
