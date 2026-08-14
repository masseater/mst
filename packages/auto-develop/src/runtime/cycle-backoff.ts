import { carriesHaltDisposition } from "../queue/halt-disposition.ts";
import { CredentialTerminalError } from "../transport/credential-provider.ts";
import { SseRequestRejectedError } from "../transport/sse-request-rejected-error.ts";

const BASE_DELAY_MS = 3_000;

const MAX_DELAY_MS = 5 * 60_000;

export const needsOperatorIntervention = (failure: unknown): boolean =>
  failure instanceof CredentialTerminalError ||
  failure instanceof SseRequestRejectedError ||
  carriesHaltDisposition(failure);

export const backoffAfterFailures = (backing: {
  readonly consecutiveFailures: number;
  readonly random: () => number;
}): number => {
  const capped = Math.min(BASE_DELAY_MS * 2 ** (backing.consecutiveFailures - 1), MAX_DELAY_MS);
  return Math.max(1, Math.ceil(capped * (0.5 + backing.random())));
};
