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
  const heldState = {
    controllers: new Map<number, AbortController>(),
    generations: new Map<number, number>(),
    closed: new Set<number>(),
  };
  const abortWith = (prNumber: number, reason: Error): void => {
    heldState.controllers.get(prNumber)?.abort(reason);
  };
  return {
    openSignal: (prNumber) => {
      const existing = heldState.controllers.get(prNumber);
      if (existing !== undefined && !existing.signal.aborted) return existing.signal;
      const controller = new AbortController();
      heldState.controllers.set(prNumber, controller);
      return controller.signal;
    },
    close: (prNumber) => {
      heldState.closed.add(prNumber);
      abortWith(prNumber, new PrClosedError(prNumber));
    },
    excludeSession: (prNumber) => {
      abortWith(prNumber, new PrExcludedError(prNumber));
    },
    interruptForInputChange: (prNumber) => {
      heldState.generations.set(prNumber, (heldState.generations.get(prNumber) ?? 0) + 1);
      abortWith(prNumber, new ReviewInputChangedError(prNumber));
    },
    generationOf: (prNumber) => heldState.generations.get(prNumber) ?? 0,
    isCurrentGeneration: (check) =>
      (heldState.generations.get(check.prNumber) ?? 0) === check.generation,
    isClosed: (prNumber) => heldState.closed.has(prNumber),
  };
};
