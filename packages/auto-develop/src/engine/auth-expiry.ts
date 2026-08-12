import { HaltQueueKeepJobError } from "../queue/halt-disposition.ts";

import type { EngineKind } from "../config/engine.ts";

const AUTH_EXPIRY_PATTERNS: Readonly<Record<EngineKind, readonly string[]>> = {
  codex: [
    "refresh_token_invalidated",
    "token_invalidated",
    "Your access token could not be refreshed",
    "Please log out and sign in again",
  ],
  claude: [
    "OAuth token has expired",
    "Please run /login",
    "Invalid API key",
    "authentication_error",
  ],
};

export const matchedAuthExpiryPattern = (matching: {
  readonly engine: EngineKind;
  readonly output: string;
}): string | null =>
  AUTH_EXPIRY_PATTERNS[matching.engine].find((pattern) => matching.output.includes(pattern)) ??
  null;

const ENGINE_AUTHENTICATION_CODE = "engine_authentication";

export class EngineAuthExpiredError extends HaltQueueKeepJobError {
  override readonly name = "EngineAuthExpiredError";

  readonly code = ENGINE_AUTHENTICATION_CODE;

  readonly engine: EngineKind;

  readonly matchedPattern: string;

  constructor(details: {
    readonly engine: EngineKind;
    readonly matchedPattern: string;
    readonly cause: unknown;
  }) {
    super(
      `${details.engine} authentication expired (matched "${details.matchedPattern}"); re-login to the ${details.engine} CLI on the host and restart — the next startup drain re-derives work from the current GitHub state`,
      { cause: details.cause },
    );
    this.engine = details.engine;
    this.matchedPattern = details.matchedPattern;
  }
}
