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

const reportProgress = (configuration: WaitConfiguration, heldState: PollState): string => {
  const waiting = sweepWaiters(configuration.slotDir);
  const line = `throttle: waiting ${waiting.indexOf(heldState.entryName) + 1}/${waiting.length}`;
  if (configuration.interactive) {
    const elapsedSec = Math.floor((Date.now() - heldState.startedAt) / 1000);
    process.stderr.write(`\r\u001B[K${line} ${elapsedSec}s`);
    return heldState.lastPrinted;
  }
  const printKey = `${line}|${slotStateFingerprint(configuration.slotDir, configuration.limit)}`;
  if (printKey !== heldState.lastPrinted) process.stderr.write(`${line}\n`);
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
  heldState: PollState,
): Promise<SlotHold | "budget-exhausted"> => {
  const lastPrinted = reportProgress(configuration, heldState);
  const hold = await tryAcquireAny(configuration);
  if (hold !== null) {
    closeProgressLine(configuration);
    return hold;
  }
  if (Date.now() - heldState.startedAt >= configuration.waitBudgetMs)
    return budgetExhausted(configuration);
  await delay(configuration.pollMs);
  return pollForSlot(configuration, { ...heldState, lastPrinted });
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
