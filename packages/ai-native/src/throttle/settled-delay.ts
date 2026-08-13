import { setTimeout as delay } from "node:timers/promises";

/** @canonical-values ai-native.delay-ending */
const DELAY_ENDINGS = ["elapsed", "cancelled"] as const;

export const DELAY_ENDING = {
  elapsed: DELAY_ENDINGS[0],
  cancelled: DELAY_ENDINGS[1],
} as const;

export const settledDelay = async (
  ms: number,
  cancel: AbortSignal,
): Promise<(typeof DELAY_ENDINGS)[number]> => {
  const [waited] = await Promise.allSettled([delay(ms, undefined, { signal: cancel })]);
  return waited.status === "fulfilled" ? DELAY_ENDING.elapsed : DELAY_ENDING.cancelled;
};
