import { tmpdir } from "node:os";
import { join } from "node:path";

import { DEFAULT_WAIT_BUDGET_MS } from "./usage.ts";

import type { WaitConfiguration } from "./wait-for-slot.ts";

const DEFAULT_LIMIT = 1;
const DEFAULT_POLL_MS = 1_000;

export type ThrottleSeams = {
  slotDir?: string;
  limit?: number;
  waitBudgetMs?: number;
  pollMs?: number;
  isInteractive?: boolean;
};

const limitFromEnvironment = (): number => {
  const raw = process.env.MST_THROTTLE_LIMIT;
  return raw !== undefined && /^[0-9]+$/.test(raw) && Number(raw) > 0 ? Number(raw) : DEFAULT_LIMIT;
};

export const resolveThrottleConfiguration = (seams: ThrottleSeams): WaitConfiguration => ({
  slotDir: seams.slotDir ?? join(tmpdir(), "mst-throttle", "mst"),
  limit: seams.limit ?? limitFromEnvironment(),
  waitBudgetMs: seams.waitBudgetMs ?? DEFAULT_WAIT_BUDGET_MS,
  pollMs: seams.pollMs ?? DEFAULT_POLL_MS,
  interactive: seams.isInteractive ?? process.stderr.isTTY,
});
