import { describe, expect, test } from "vite-plus/test";

import { credentialDigest } from "./digest.ts";
import { GithubRejectionError } from "./github-rejection-error.ts";
import { GithubUnavailableError } from "./github-unavailable-error.ts";
import { createMemorySessionStore } from "./memory-store.ts";
import { issueSession } from "./session-issue.ts";
import { UnauthenticatedError } from "./unauthenticated-error.ts";
import { VerifierUnavailableError } from "./verifier-unavailable-error.ts";

import type { GithubReader } from "./github-reader.ts";

const stubGithub = (overrides: Partial<GithubReader> = {}): GithubReader => ({
  resolveTokenLogin: () => Promise.resolve("octocat"),
  readRepositoryPrivacy: () => Promise.resolve(true),
  listOpenPullRequests: () => Promise.resolve([]),
  resolvePullAuthor: () => Promise.resolve(null),
  listCheckBuckets: () => Promise.resolve([]),
  ...overrides,
});

describe("issueSession", () => {
  test("本人性とリポジトリ読取を確認して短命クレデンシャルを発行する", async () => {
    const sessions = createMemorySessionStore();
    const issued = await issueSession({
      githubToken: "github-token",
      github: stubGithub(),
      sessions,
      now: () => 1_000_000,
      generateCredential: () => "connection-credential",
    });
    const savedSession = await sessions.resolve(credentialDigest("connection-credential"));
    expect([issued, savedSession]).toStrictEqual([
      {
        token: "connection-credential",
        expiresAt: new Date(1_000_000 + 8 * 3_600_000).toISOString(),
      },
      { login: "octocat", expiresAtMs: 1_000_000 + 8 * 3_600_000 },
    ]);
  });

  test("GitHub トークンが無ければ確定的拒否になる", async () => {
    await expect(
      issueSession({
        githubToken: undefined,
        github: stubGithub(),
        sessions: createMemorySessionStore(),
      }),
    ).rejects.toThrow(UnauthenticatedError);
  });

  test("対象リポジトリが public なら read は証明にならず拒否される", async () => {
    await expect(
      issueSession({
        githubToken: "github-token",
        github: stubGithub({ readRepositoryPrivacy: () => Promise.resolve(false) }),
        sessions: createMemorySessionStore(),
      }),
    ).rejects.toThrow(UnauthenticatedError);
  });

  test("GitHub の確定的拒否は 401 系の型になる", async () => {
    await expect(
      issueSession({
        githubToken: "github-token",
        github: stubGithub({
          resolveTokenLogin: () => Promise.reject(new GithubRejectionError("bad credentials")),
        }),
        sessions: createMemorySessionStore(),
      }),
    ).rejects.toThrow(UnauthenticatedError);
  });

  test("GitHub 到達不能は検証器不能の型になる", async () => {
    await expect(
      issueSession({
        githubToken: "github-token",
        github: stubGithub({
          resolveTokenLogin: () => Promise.reject(new GithubUnavailableError("rate limited")),
        }),
        sessions: createMemorySessionStore(),
      }),
    ).rejects.toThrow(VerifierUnavailableError);
  });

  test("どちらでもない失敗は変換されず伝播する", async () => {
    await expect(
      issueSession({
        githubToken: "github-token",
        github: stubGithub({
          readRepositoryPrivacy: () => Promise.reject(new Error("unexpected shape")),
        }),
        sessions: createMemorySessionStore(),
      }),
    ).rejects.toThrow("unexpected shape");
  });

  test("既定では 32 バイトの暗号乱数を base64url 化したクレデンシャルになる", async () => {
    const issued = await issueSession({
      githubToken: "github-token",
      github: stubGithub(),
      sessions: createMemorySessionStore(),
    });
    expect(issued.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});
