import { describe, expect, test, vi } from "vite-plus/test";

import { silentLogger } from "../logging/logger.ts";
import { CredentialTerminalError } from "../transport/credential-provider.ts";
import { createRelayCredentialProvider, type RelayCredentialConfig } from "./relay-credential.ts";

type SessionIssuer = RelayCredentialConfig["issueSession"];

const ALLOWED_ORIGIN = "https://relay.example";

describe("createRelayCredentialProvider の発行", () => {
  const it = test
    .extend("issuedHeader", () => {
      const relayCredentials = createRelayCredentialProvider({
        allowedOrigin: ALLOWED_ORIGIN,
        issueSession: () =>
          Promise.resolve({ token: "relay-token", expiresAt: "2026-08-11T08:00:00.000Z" }),
        resolveGithubToken: () => Promise.resolve("gh-token"),
        now: () => Date.parse("2026-08-11T00:00:00.000Z"),
        log: silentLogger,
      });
      return relayCredentials.authorizationFor({ url: `${ALLOWED_ORIGIN}/events/stream` });
    })
    .extend("cachedIssueSession", async () => {
      const cachedIssueSession = vi.fn<SessionIssuer>(() =>
        Promise.resolve({ token: "relay-token", expiresAt: "2026-08-11T08:00:00.000Z" }),
      );
      const relayCredentials = createRelayCredentialProvider({
        allowedOrigin: ALLOWED_ORIGIN,
        issueSession: cachedIssueSession,
        resolveGithubToken: () => Promise.resolve("gh-token"),
        now: () => Date.parse("2026-08-11T00:00:00.000Z"),
        log: silentLogger,
      });
      await relayCredentials.authorizationFor({ url: `${ALLOWED_ORIGIN}/events/stream` });
      await relayCredentials.authorizationFor({ url: `${ALLOWED_ORIGIN}/events/stream` });
      return cachedIssueSession;
    })
    .extend("renewedIssueSession", async () => {
      const renewedIssueSession = vi.fn<SessionIssuer>(() =>
        Promise.resolve({ token: "relay-token", expiresAt: "2026-08-11T00:00:30.000Z" }),
      );
      const relayCredentials = createRelayCredentialProvider({
        allowedOrigin: ALLOWED_ORIGIN,
        issueSession: renewedIssueSession,
        resolveGithubToken: () => Promise.resolve("gh-token"),
        now: () => Date.parse("2026-08-11T00:00:00.000Z"),
        log: silentLogger,
      });
      await relayCredentials.authorizationFor({ url: `${ALLOWED_ORIGIN}/events/stream` });
      await relayCredentials.authorizationFor({ url: `${ALLOWED_ORIGIN}/events/stream` });
      return renewedIssueSession;
    })
    .extend("invalidatedIssueSession", async () => {
      const invalidatedIssueSession = vi.fn<SessionIssuer>(() =>
        Promise.resolve({ token: "relay-token", expiresAt: "2026-08-11T08:00:00.000Z" }),
      );
      const relayCredentials = createRelayCredentialProvider({
        allowedOrigin: ALLOWED_ORIGIN,
        issueSession: invalidatedIssueSession,
        resolveGithubToken: () => Promise.resolve("gh-token"),
        now: () => Date.parse("2026-08-11T00:00:00.000Z"),
        log: silentLogger,
      });
      await relayCredentials.authorizationFor({ url: `${ALLOWED_ORIGIN}/events/stream` });
      relayCredentials.invalidate();
      await relayCredentials.authorizationFor({ url: `${ALLOWED_ORIGIN}/events/stream` });
      return invalidatedIssueSession;
    });

  it("発行した token を Bearer ヘッダにして返す", ({ issuedHeader }) => {
    expect(issuedHeader).toBe("Bearer relay-token");
  });

  it("失効まで余裕があれば発行を繰り返さない", ({ cachedIssueSession }) => {
    expect(cachedIssueSession).toHaveBeenCalledTimes(1);
  });

  it("失効 60 秒前を切っていれば発行し直す", ({ renewedIssueSession }) => {
    expect(renewedIssueSession).toHaveBeenCalledTimes(2);
  });

  it("明示的な無効化のあとは発行し直す", ({ invalidatedIssueSession }) => {
    expect(invalidatedIssueSession).toHaveBeenCalledTimes(2);
  });
});

describe("createRelayCredentialProvider の恒久失敗", () => {
  const it = test
    .extend("foreignOriginFailure", async () => {
      const relayCredentials = createRelayCredentialProvider({
        allowedOrigin: ALLOWED_ORIGIN,
        issueSession: () =>
          Promise.resolve({ token: "relay-token", expiresAt: "2026-08-11T08:00:00.000Z" }),
        resolveGithubToken: () => Promise.resolve("gh-token"),
        now: () => Date.parse("2026-08-11T00:00:00.000Z"),
        log: silentLogger,
      });
      try {
        return await relayCredentials.authorizationFor({
          url: "https://attacker.example/events/stream",
        });
      } catch (foreignOriginFailure) {
        return foreignOriginFailure;
      }
    })
    .extend("missingTokenFailure", async () => {
      const relayCredentials = createRelayCredentialProvider({
        allowedOrigin: ALLOWED_ORIGIN,
        issueSession: () =>
          Promise.resolve({ token: "relay-token", expiresAt: "2026-08-11T08:00:00.000Z" }),
        resolveGithubToken: () => Promise.resolve(null),
        now: () => Date.parse("2026-08-11T00:00:00.000Z"),
        log: silentLogger,
      });
      try {
        return await relayCredentials.authorizationFor({
          url: `${ALLOWED_ORIGIN}/events/stream`,
        });
      } catch (missingTokenFailure) {
        return missingTokenFailure;
      }
    })
    .extend("badExpiryFailure", async () => {
      const relayCredentials = createRelayCredentialProvider({
        allowedOrigin: ALLOWED_ORIGIN,
        issueSession: () => Promise.resolve({ token: "relay-token", expiresAt: "not a date" }),
        resolveGithubToken: () => Promise.resolve("gh-token"),
        now: () => Date.parse("2026-08-11T00:00:00.000Z"),
        log: silentLogger,
      });
      try {
        return await relayCredentials.authorizationFor({
          url: `${ALLOWED_ORIGIN}/events/stream`,
        });
      } catch (badExpiryFailure) {
        return badExpiryFailure;
      }
    });

  it("許可オリジン以外へは credential を出さない", ({ foreignOriginFailure }) => {
    expect(foreignOriginFailure).toStrictEqual(
      new CredentialTerminalError(
        "refusing to present the relay credential to https://attacker.example; only https://relay.example is allowed",
      ),
    );
  });

  it("GitHub token が無ければ恒久エラーで止める", ({ missingTokenFailure }) => {
    expect(missingTokenFailure).toStrictEqual(
      new CredentialTerminalError("no GitHub token is available to prove the relay session"),
    );
  });

  it("読めない失効時刻を返されたら恒久エラーで止める", ({ badExpiryFailure }) => {
    expect(badExpiryFailure).toStrictEqual(
      new CredentialTerminalError("the relay returned a session without a usable expiry"),
    );
  });
});
