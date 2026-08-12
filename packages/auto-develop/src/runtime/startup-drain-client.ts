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

  readonly status: number;

  constructor(status: number) {
    super(`the relay rejected the startup drain with status ${status}`);
    this.status = status;
  }
}

const isRetryableStatus = (status: number): boolean =>
  status === 408 || status === 429 || status >= 500;

const rejectUnusableResponse = (rejecting: {
  readonly response: Response;
  readonly credentials: CredentialProvider;
}): void => {
  const { response } = rejecting;
  if (response.status === 401 || response.status === 403) {
    rejecting.credentials.invalidate();
    throw new CredentialTerminalError("the relay rejected the startup drain credential");
  }
  if (response.ok) return;
  if (isRetryableStatus(response.status)) throw new StartupDrainRejectedError(response.status);
  throw new CredentialTerminalError(
    `the relay refused the startup drain with status ${response.status}`,
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
  const response = await drain.fetchImpl(url, { headers: { authorization } });
  rejectUnusableResponse({ response, credentials: drain.credentials });
  const drained = unwrapPollResponse(await response.json());
  drain.log.info({ count: drained.length }, "startup drain completed");
  return drained;
};
