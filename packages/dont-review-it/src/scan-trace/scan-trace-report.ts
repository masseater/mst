import { agentScanTrace } from "./agent-report.ts";
import { humanScanTrace } from "./human-report.ts";

import type { CheckOutcome } from "@mst/repository-checks";

export const scanTraceFor = ({
  outcomes,
  readByAgent,
  colored,
}: {
  readonly outcomes: readonly CheckOutcome[];
  readonly readByAgent: boolean;
  readonly colored: boolean;
}): string => (readByAgent ? agentScanTrace(outcomes) : humanScanTrace({ outcomes, colored }));
