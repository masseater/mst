import { setTimeout as delay } from "node:timers/promises";

export const settledDelay = async (
  ms: number,
  cancel: AbortSignal,
): Promise<"elapsed" | "cancelled"> => {
  const [waited] = await Promise.allSettled([delay(ms, undefined, { signal: cancel })]);
  return waited.status === "fulfilled" ? "elapsed" : "cancelled";
};
