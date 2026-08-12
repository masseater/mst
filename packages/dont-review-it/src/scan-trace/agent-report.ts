import { counted } from "./pluralized.ts";

import type { CheckOutcome } from "@mst/repository-checks";

const lineOf = (outcome: CheckOutcome): string =>
  outcome.skippedReason === null
    ? `checked ${outcome.check} ${counted({ count: outcome.count, noun: outcome.unit })} ${counted({ count: outcome.problems.length, noun: "problem" })} ${counted({ count: outcome.warnings.length, noun: "warning" })}`
    : `skipped ${outcome.check} ${outcome.skippedReason}`;

export const agentScanTrace = (outcomes: readonly CheckOutcome[]): string =>
  outcomes.map((outcome) => `${lineOf(outcome)}\n`).join("");
