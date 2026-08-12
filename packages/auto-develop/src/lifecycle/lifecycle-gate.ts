import { PrClosedError } from "./pr-closed-error.ts";
import { PrExcludedError } from "./pr-excluded-error.ts";
import { ReviewInputChangedError } from "./review-input-changed-error.ts";

export type LifecycleGate = {
  readonly openSignal: (prNumber: number) => AbortSignal;
  readonly close: (prNumber: number) => void;
  readonly excludeSession: (prNumber: number) => void;
  readonly interruptForInputChange: (prNumber: number) => void;
  readonly generationOf: (prNumber: number) => number;
  readonly isCurrentGeneration: (check: {
    readonly prNumber: number;
    readonly generation: number;
  }) => boolean;
  readonly isClosed: (prNumber: number) => boolean;
};

export const createLifecycleGate = (): LifecycleGate => {
  const state = {
    controllers: new Map<number, AbortController>(),
    generations: new Map<number, number>(),
    closed: new Set<number>(),
  };
  const abortWith = (prNumber: number, reason: Error): void => {
    state.controllers.get(prNumber)?.abort(reason);
  };
  return {
    openSignal: (prNumber) => {
      const existing = state.controllers.get(prNumber);
      if (existing !== undefined && !existing.signal.aborted) return existing.signal;
      const controller = new AbortController();
      state.controllers.set(prNumber, controller);
      return controller.signal;
    },
    close: (prNumber) => {
      state.closed.add(prNumber);
      abortWith(prNumber, new PrClosedError(prNumber));
    },
    excludeSession: (prNumber) => {
      abortWith(prNumber, new PrExcludedError(prNumber));
    },
    interruptForInputChange: (prNumber) => {
      state.generations.set(prNumber, (state.generations.get(prNumber) ?? 0) + 1);
      abortWith(prNumber, new ReviewInputChangedError(prNumber));
    },
    generationOf: (prNumber) => state.generations.get(prNumber) ?? 0,
    isCurrentGeneration: (check) =>
      (state.generations.get(check.prNumber) ?? 0) === check.generation,
    isClosed: (prNumber) => state.closed.has(prNumber),
  };
};
