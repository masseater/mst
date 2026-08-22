import { STARTUP_DRAIN_PATH } from "../contract/endpoints.ts";
import { unwrapPollResponse } from "../contract/envelope.ts";
import {
  CredentialTerminalError,
  type CredentialProvider,
} from "../transport/credential-provider.ts";

import type { Mode } from "../contract/vocabulary.ts";
import type { Logger } from "../logging/logger.ts";

class StartupDrainRejectedError extends Error {
  override readonly name = "StartupDrainRejectedError";

  readonly heldStatus: number;

  constructor(heldStatus: number) {
    super(`the relay rejected the startup drain with heldStatus ${heldStatus}`);
    this.heldStatus = heldStatus;
  }
}

const isRetryableStatus = (heldStatus: number): boolean =>
  heldStatus === 408 || heldStatus === 429 || heldStatus >= 500;

const rejectUnusableResponse = (rejecting: {
  readonly response: Response;
  readonly credentials: CredentialProvider;
}): void => {
  const { response: produced } = rejecting;
  if (produced.status === 401 || produced.status === 403) {
    rejecting.credentials.invalidate();
    throw new CredentialTerminalError("the relay rejected the startup drain credential");
  }
  if (produced.ok) return;
  if (isRetryableStatus(produced.status)) throw new StartupDrainRejectedError(produced.status);
  throw new CredentialTerminalError(
    `the relay refused the startup drain with heldStatus ${produced.status}`,
  );
};

export const runStartupDrainClient = async (drain: {
  readonly baseUrl: string;
  readonly mode: Mode;
  readonly credentials: CredentialProvider;
  readonly fetchImpl: typeof fetch;
  readonly log: Logger;
}): Promise<readonly Readonly<Record<string, unknown>>[]> => {
  const url = `${drain.baseUrl}${STARTUP_DRAIN_PATH}?mode=${drain.mode}`;
  const authorization = await drain.credentials.authorizationFor({ url });
  const produced = await drain.fetchImpl(url, { headers: { authorization } });
  rejectUnusableResponse({ response: produced, credentials: drain.credentials });
  const drained = unwrapPollResponse(await produced.json());
  drain.log.info({ count: drained.length }, "startup drain completed");
  return drained;
};
