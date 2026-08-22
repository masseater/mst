import { counted } from "./pluralized.ts";

import type { CheckOutcome } from "@mst/repository-checks";

const lineOf = (ranCheck: CheckOutcome): string =>
  ranCheck.skippedReason === null
    ? `checked ${ranCheck.check} ${counted({ count: ranCheck.count, noun: ranCheck.unit })} ${counted({ count: ranCheck.problems.length, noun: "problem" })} ${counted({ count: ranCheck.warnings.length, noun: "warning" })}`
    : `skipped ${ranCheck.check} ${ranCheck.skippedReason}`;

export const agentScanTrace = (outcomes: readonly CheckOutcome[]): string =>
  outcomes.map((ranCheck) => `${lineOf(ranCheck)}\n`).join("");
