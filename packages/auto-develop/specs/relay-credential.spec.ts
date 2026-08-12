import { describe, expect, it, vi } from "vite-plus/test";

import { silentLogger } from "../src/logging/logger.ts";
import {
  createRelayCredentialProvider,
  type RelayCredentialConfig,
} from "../src/runtime/relay-credential.ts";
import { CredentialTerminalError } from "../src/transport/credential-provider.ts";

type SessionIssuer = RelayCredentialConfig["issueSession"];

const ALLOWED_ORIGIN = "https://relay.example";

const providerWith = (setup: {
  readonly issueSession?: SessionIssuer;
  readonly githubToken?: string | null;
}) =>
  createRelayCredentialProvider({
    allowedOrigin: ALLOWED_ORIGIN,
    issueSession:
      setup.issueSession ??
      (() => Promise.resolve({ token: "relay-token", expiresAt: "2026-08-11T08:00:00.000Z" })),
    resolveGithubToken: () =>
      Promise.resolve(setup.githubToken === undefined ? "gh-token" : setup.githubToken),
    now: () => Date.parse("2026-08-11T00:00:00.000Z"),
    log: silentLogger,
  });

describe("GitHub の credential はリレーの発行口だけに渡る", () => {
  it("契約したオリジン以外へは credential を出さない", async () => {
    const provider = providerWith({});
    await expect(
      provider.authorizationFor({ url: "https://attacker.example/events/stream" }),
    ).rejects.toBeInstanceOf(CredentialTerminalError);
  });

  it("GitHub token を解決できなければ恒久エラーで止まる", async () => {
    const provider = providerWith({ githubToken: null });
    await expect(
      provider.authorizationFor({ url: `${ALLOWED_ORIGIN}/events/stream` }),
    ).rejects.toBeInstanceOf(CredentialTerminalError);
  });

  it("購読にはリレーが発行した短寿命の credential を提示する", async () => {
    const provider = providerWith({});
    expect(
      await provider.authorizationFor({ url: `${ALLOWED_ORIGIN}/events/stream` }),
    ).toStrictEqual("Bearer relay-token");
  });

  it("失効まで余裕があれば GitHub の証明をやり直さない", async () => {
    const issueSession = vi.fn<SessionIssuer>(() =>
      Promise.resolve({ token: "relay-token", expiresAt: "2026-08-11T08:00:00.000Z" }),
    );
    const provider = providerWith({ issueSession });
    await provider.authorizationFor({ url: `${ALLOWED_ORIGIN}/events/stream` });
    await provider.authorizationFor({ url: `${ALLOWED_ORIGIN}/events/stream` });
    expect(issueSession.mock.calls.length).toStrictEqual(1);
  });

  it("失効が近づけば発行し直す", async () => {
    const issueSession = vi.fn<SessionIssuer>(() =>
      Promise.resolve({ token: "relay-token", expiresAt: "2026-08-11T00:00:30.000Z" }),
    );
    const provider = providerWith({ issueSession });
    await provider.authorizationFor({ url: `${ALLOWED_ORIGIN}/events/stream` });
    await provider.authorizationFor({ url: `${ALLOWED_ORIGIN}/events/stream` });
    expect(issueSession.mock.calls.length).toStrictEqual(2);
  });
});
