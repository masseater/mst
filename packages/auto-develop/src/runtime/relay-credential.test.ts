import { describe, expect, test, vi } from "vite-plus/test";

import { silentLogger } from "../logging/logger.ts";
import { CredentialTerminalError } from "../transport/credential-provider.ts";
import { createRelayCredentialProvider, type RelayCredentialConfig } from "./relay-credential.ts";

type SessionIssuer = RelayCredentialConfig["issueSession"];

const ALLOWED_ORIGIN = "https://relay.example";

const providerWith = (setup: {
  readonly issueSession?: SessionIssuer;
  readonly githubToken?: string | null;
  readonly nowMs?: number;
}) =>
  createRelayCredentialProvider({
    allowedOrigin: ALLOWED_ORIGIN,
    issueSession:
      setup.issueSession ??
      (() => Promise.resolve({ token: "relay-token", expiresAt: "2026-08-11T08:00:00.000Z" })),
    resolveGithubToken: () =>
      Promise.resolve(setup.githubToken === undefined ? "gh-token" : setup.githubToken),
    now: () => setup.nowMs ?? Date.parse("2026-08-11T00:00:00.000Z"),
    log: silentLogger,
  });

const settledValue = async (task: () => Promise<unknown>): Promise<unknown> => {
  try {
    return await task();
  } catch (taskFailure) {
    return taskFailure;
  }
};

const it = test
  .extend("issuedHeader", () => {
    const provider = providerWith({});
    return provider.authorizationFor({ url: `${ALLOWED_ORIGIN}/events/stream` });
  })
  .extend("cachedIssueCount", async () => {
    const issueSession = vi.fn<SessionIssuer>(() =>
      Promise.resolve({ token: "relay-token", expiresAt: "2026-08-11T08:00:00.000Z" }),
    );
    const provider = providerWith({ issueSession });
    await provider.authorizationFor({ url: `${ALLOWED_ORIGIN}/events/stream` });
    await provider.authorizationFor({ url: `${ALLOWED_ORIGIN}/events/stream` });
    return issueSession.mock.calls.length;
  })
  .extend("renewedIssueCount", async () => {
    const issueSession = vi.fn<SessionIssuer>(() =>
      Promise.resolve({ token: "relay-token", expiresAt: "2026-08-11T00:00:30.000Z" }),
    );
    const provider = providerWith({ issueSession });
    await provider.authorizationFor({ url: `${ALLOWED_ORIGIN}/events/stream` });
    await provider.authorizationFor({ url: `${ALLOWED_ORIGIN}/events/stream` });
    return issueSession.mock.calls.length;
  })
  .extend("invalidatedIssueCount", async () => {
    const issueSession = vi.fn<SessionIssuer>(() =>
      Promise.resolve({ token: "relay-token", expiresAt: "2026-08-11T08:00:00.000Z" }),
    );
    const provider = providerWith({ issueSession });
    await provider.authorizationFor({ url: `${ALLOWED_ORIGIN}/events/stream` });
    provider.invalidate();
    await provider.authorizationFor({ url: `${ALLOWED_ORIGIN}/events/stream` });
    return issueSession.mock.calls.length;
  })
  .extend("foreignOriginFailure", () => {
    const provider = providerWith({});
    return settledValue(() =>
      provider.authorizationFor({ url: "https://attacker.example/events/stream" }),
    );
  })
  .extend("missingTokenFailure", () => {
    const provider = providerWith({ githubToken: null });
    return settledValue(() =>
      provider.authorizationFor({ url: `${ALLOWED_ORIGIN}/events/stream` }),
    );
  })
  .extend("badExpiryFailure", () => {
    const provider = providerWith({
      issueSession: () => Promise.resolve({ token: "relay-token", expiresAt: "not a date" }),
    });
    return settledValue(() =>
      provider.authorizationFor({ url: `${ALLOWED_ORIGIN}/events/stream` }),
    );
  });

describe("createRelayCredentialProvider の発行", () => {
  it("発行した token を Bearer ヘッダにして返す", ({ issuedHeader }) => {
    expect(issuedHeader).toStrictEqual("Bearer relay-token");
  });

  it("失効まで余裕があれば発行を繰り返さない", ({ cachedIssueCount }) => {
    expect(cachedIssueCount).toStrictEqual(1);
  });

  it("失効 60 秒前を切っていれば発行し直す", ({ renewedIssueCount }) => {
    expect(renewedIssueCount).toStrictEqual(2);
  });

  it("明示的な無効化のあとは発行し直す", ({ invalidatedIssueCount }) => {
    expect(invalidatedIssueCount).toStrictEqual(2);
  });
});

describe("createRelayCredentialProvider の恒久失敗", () => {
  it("許可オリジン以外へは credential を出さない", ({ foreignOriginFailure }) => {
    expect(foreignOriginFailure).toBeInstanceOf(CredentialTerminalError);
  });

  it("GitHub token が無ければ恒久エラーで止める", ({ missingTokenFailure }) => {
    expect(missingTokenFailure).toBeInstanceOf(CredentialTerminalError);
  });

  it("読めない失効時刻を返されたら恒久エラーで止める", ({ badExpiryFailure }) => {
    expect(badExpiryFailure).toBeInstanceOf(CredentialTerminalError);
  });
});
