import { runWithSlot } from "./run-command.ts";
import { ensureSlots, tryAcquireAny, type SlotHold } from "./slots.ts";
import { resolveThrottleConfiguration, type ThrottleSeams } from "./throttle-configuration.ts";
import { parseInvocation } from "./usage.ts";
import { waitForSlot, type WaitConfiguration } from "./wait-for-slot.ts";

export type { ThrottleSeams } from "./throttle-configuration.ts";

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
  const hold = await acquireSlot(resolveThrottleConfiguration(seams));
  return hold === null ? 1 : runWithSlot({ invocation, hold });
};
