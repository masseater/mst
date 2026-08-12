import { basename } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import {
  dropInterruptHandler,
  installInterruptHandler,
  makeWaitingInterruptHandler,
  raiseSignal,
} from "./signals.ts";
import {
  enqueueWaiter,
  removeWaiter,
  slotStateFingerprint,
  sweepWaiters,
  tryAcquireAny,
  type AcquireConfiguration,
  type SlotHold,
} from "./slots.ts";

export type WaitConfiguration = AcquireConfiguration & {
  waitBudgetMs: number;
  pollMs: number;
  interactive: boolean;
};

type PollState = {
  entryName: string;
  startedAt: number;
  lastPrinted: string;
};

const reportProgress = (configuration: WaitConfiguration, state: PollState): string => {
  const waiting = sweepWaiters(configuration.slotDir);
  const line = `throttle: waiting ${waiting.indexOf(state.entryName) + 1}/${waiting.length}`;
  if (configuration.interactive) {
    const elapsedSec = Math.floor((Date.now() - state.startedAt) / 1000);
    process.stderr.write(`\r\u001B[K${line} ${elapsedSec}s`);
    return state.lastPrinted;
  }
  const printKey = `${line}|${slotStateFingerprint(configuration.slotDir, configuration.limit)}`;
  if (printKey !== state.lastPrinted) process.stderr.write(`${line}\n`);
  return printKey;
};

const closeProgressLine = (configuration: WaitConfiguration): void => {
  if (configuration.interactive) process.stderr.write("\n");
};

const budgetExhausted = (configuration: WaitConfiguration): "budget-exhausted" => {
  closeProgressLine(configuration);
  process.stderr.write(
    `throttle: gave up: every slot stayed held for the whole ${configuration.waitBudgetMs}ms wait budget\n`,
  );
  return "budget-exhausted";
};

const pollForSlot = async (
  configuration: WaitConfiguration,
  state: PollState,
): Promise<SlotHold | "budget-exhausted"> => {
  const lastPrinted = reportProgress(configuration, state);
  const hold = await tryAcquireAny(configuration);
  if (hold !== null) {
    closeProgressLine(configuration);
    return hold;
  }
  if (Date.now() - state.startedAt >= configuration.waitBudgetMs)
    return budgetExhausted(configuration);
  await delay(configuration.pollMs);
  return pollForSlot(configuration, { ...state, lastPrinted });
};

export const waitForSlot = async (
  configuration: WaitConfiguration,
): Promise<SlotHold | "budget-exhausted"> => {
  const entryPath = enqueueWaiter(configuration.slotDir);
  const interruptHandler = makeWaitingInterruptHandler({
    entryPath,
    removeEntry: removeWaiter,
    raise: raiseSignal,
  });
  installInterruptHandler(interruptHandler);
  try {
    return await pollForSlot(configuration, {
      entryName: basename(entryPath),
      startedAt: Date.now(),
      lastPrinted: "",
    });
  } finally {
    removeWaiter(entryPath);
    dropInterruptHandler(interruptHandler);
  }
};
