import {
  CredentialTerminalError,
  type CredentialProvider,
} from "../transport/credential-provider.ts";

import type { Logger } from "../logging/logger.ts";

const RENEW_BEFORE_MS = 60_000;

export type SessionIssuer = (issue: {
  readonly githubToken: string;
}) => Promise<{ readonly token: string; readonly expiresAt: string }>;

export type RelayCredentialConfig = {
  readonly allowedOrigin: string;
  readonly issueSession: SessionIssuer;
  readonly resolveGithubToken: () => Promise<string | null>;
  readonly now: () => number;
  readonly log: Logger;
};

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

export const createRelayCredentialProvider = (
  config: RelayCredentialConfig,
): CredentialProvider => {
  const cache = new Map<string, { readonly token: string; readonly expiresAtMs: number }>();
  const issue = async (): Promise<string> => {
    const githubToken = await config.resolveGithubToken();
    if (githubToken === null) {
      throw new CredentialTerminalError("no GitHub token is available to prove the relay session");
    }
    const session = await config.issueSession({ githubToken });
    const expiresAtMs = Date.parse(session.expiresAt);
    if (Number.isNaN(expiresAtMs)) {
      throw new CredentialTerminalError("the relay returned a session without a usable expiry");
    }
    cache.set("session", { token: session.token, expiresAtMs });
    config.log.info({ expiresAt: session.expiresAt }, "relay session issued");
    return session.token;
  };
  return {
    authorizationFor: async (request) => {
      assertAllowedOrigin({ url: request.url, allowedOrigin: config.allowedOrigin });
      const cached = cache.get("session");
      if (cached !== undefined && cached.expiresAtMs - config.now() > RENEW_BEFORE_MS) {
        return `Bearer ${cached.token}`;
      }
      return `Bearer ${await issue()}`;
    },
    invalidate: () => {
      cache.delete("session");
      config.log.info({}, "relay session invalidated; it will be re-issued on the next attempt");
    },
  };
};
