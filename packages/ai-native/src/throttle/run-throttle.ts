import { tmpdir } from "node:os";
import { join } from "node:path";

import { runWithSlot } from "./run-command.ts";
import { ensureSlots, tryAcquireAny, type SlotHold } from "./slots.ts";
import { parseInvocation } from "./usage.ts";
import { waitForSlot, type WaitConfiguration } from "./wait-for-slot.ts";

const DEFAULT_LIMIT = 1;
const DEFAULT_STALE_MS = 30_000;
const DEFAULT_WAIT_BUDGET_MS = 900_000;
const DEFAULT_POLL_MS = 1_000;

export type ThrottleSeams = {
  slotDir?: string;
  limit?: number;
  staleMs?: number;
  waitBudgetMs?: number;
  pollMs?: number;
  isInteractive?: boolean;
};

const limitFromEnvironment = (): number => {
  const raw = process.env.MST_THROTTLE_LIMIT;
  return raw !== undefined && /^[0-9]+$/.test(raw) && Number(raw) > 0 ? Number(raw) : DEFAULT_LIMIT;
};

const warnCompromised = (failure: Error): void => {
  process.stderr.write(
    `throttle: slot lease compromised, the limit may be exceeded: ${failure.message}\n`,
  );
};

const resolveConfiguration = (seams: ThrottleSeams): WaitConfiguration => ({
  slotDir: seams.slotDir ?? join(tmpdir(), "mst-throttle", "mst"),
  limit: seams.limit ?? limitFromEnvironment(),
  staleMs: seams.staleMs ?? DEFAULT_STALE_MS,
  waitBudgetMs: seams.waitBudgetMs ?? DEFAULT_WAIT_BUDGET_MS,
  pollMs: seams.pollMs ?? DEFAULT_POLL_MS,
  interactive: seams.isInteractive ?? process.stderr.isTTY,
  onCompromised: warnCompromised,
});

const acquireSlot = async (configuration: WaitConfiguration): Promise<SlotHold | null> => {
  process.stderr.write(`throttle: acquiring a slot (limit ${configuration.limit})\n`);
  try {
    ensureSlots(configuration.slotDir, configuration.limit);
    const immediate = await tryAcquireAny(configuration);
    const hold = immediate ?? (await waitForSlot(configuration));
    return hold === "budget-exhausted" ? null : hold;
  } catch (failure) {
    process.stderr.write(`throttle: ${(failure as Error).message}\n`);
    return null;
  }
};

export const runThrottle = async (
  argv: readonly string[],
  seams: ThrottleSeams = {},
): Promise<number> => {
  const invocation = parseInvocation(argv);
  if (typeof invocation === "string") {
    process.stderr.write(`${invocation}\n`);
    return 2;
  }
  const hold = await acquireSlot(resolveConfiguration(seams));
  return hold === null ? 1 : runWithSlot({ invocation, hold });
};
