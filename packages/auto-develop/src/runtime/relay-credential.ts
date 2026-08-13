import {
  CredentialTerminalError,
  type CredentialProvider,
} from "../transport/credential-provider.ts";

import type { Logger } from "../logging/logger.ts";

const RENEW_BEFORE_MS = 60_000;

export type RelayCredentialConfig = {
  readonly allowedOrigin: string;
  readonly issueSession: (issue: {
    readonly githubToken: string;
  }) => Promise<{ readonly token: string; readonly expiresAt: string }>;
  readonly resolveGithubToken: () => Promise<string | null>;
  readonly now: () => number;
  readonly log: Logger;
};

type RelaySession = { readonly token: string; readonly expiresAtMs: number };

const assertAllowedOrigin = (check: {
  readonly url: string;
  readonly allowedOrigin: string;
}): void => {
  const requested = URL.parse(check.url)?.origin;
  if (requested === check.allowedOrigin) return;
  throw new CredentialTerminalError(
    `refusing to present the relay credential to ${String(requested)}; only ${check.allowedOrigin} is allowed`,
  );
};

const issueRelaySession = async (config: RelayCredentialConfig): Promise<RelaySession> => {
  const githubToken = await config.resolveGithubToken();
  if (githubToken === null) {
    throw new CredentialTerminalError("no GitHub token is available to prove the relay session");
  }
  const issued = await config.issueSession({ githubToken });
  const expiresAtMs = Date.parse(issued.expiresAt);
  if (Number.isNaN(expiresAtMs)) {
    throw new CredentialTerminalError("the relay returned a session without a usable expiry");
  }
  config.log.info({ expiresAt: issued.expiresAt }, "relay session issued");
  return { token: issued.token, expiresAtMs };
};

class RelayCredentials implements CredentialProvider {
  readonly #config: RelayCredentialConfig;

  #heldSession: RelaySession | null = null;

  constructor(config: RelayCredentialConfig) {
    this.#config = config;
  }

  readonly authorizationFor = async (asked: { readonly url: string }): Promise<string> => {
    assertAllowedOrigin({ url: asked.url, allowedOrigin: this.#config.allowedOrigin });
    const heldSession = this.#heldSession;
    if (heldSession !== null && heldSession.expiresAtMs - this.#config.now() > RENEW_BEFORE_MS) {
      return `Bearer ${heldSession.token}`;
    }
    const issuedSession = await issueRelaySession(this.#config);
    this.#heldSession = issuedSession;
    return `Bearer ${issuedSession.token}`;
  };

  readonly invalidate = (): void => {
    this.#heldSession = null;
    this.#config.log.info(
      {},
      "relay session invalidated; it will be re-issued on the next attempt",
    );
  };
}

export const createRelayCredentialProvider = (config: RelayCredentialConfig): CredentialProvider =>
  new RelayCredentials(config);
