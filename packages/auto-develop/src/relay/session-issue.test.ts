import { describe, expect, test } from "vite-plus/test";

import { credentialDigest } from "./digest.ts";
import { GithubRejectionError } from "./github-rejection-error.ts";
import { GithubUnavailableError } from "./github-unavailable-error.ts";
import { createMemorySessionStore } from "./memory-session-store.ts";
import { issueSession } from "./session-issue.ts";
import { UnauthenticatedError } from "./unauthenticated-error.ts";
import { VerifierUnavailableError } from "./verifier-unavailable-error.ts";

describe("issueSession", () => {
  const it = test
    .extend("issuedSession", () =>
      issueSession({
        githubToken: "github-token",
        github: {
          resolveTokenLogin: () => Promise.resolve("octocat"),
          readRepositoryPrivacy: () => Promise.resolve(true),
          listOpenPullRequests: () => Promise.resolve([]),
          resolvePullAuthor: () => Promise.resolve(null),
          listCheckBuckets: () => Promise.resolve([]),
        },
        sessions: createMemorySessionStore(),
        now: () => 1_000_000,
        generateCredential: () => "connection-credential",
      }))
    .extend("storedSessionAfterIssuance", async () => {
      const sessions = createMemorySessionStore();
      await issueSession({
        githubToken: "github-token",
        github: {
          resolveTokenLogin: () => Promise.resolve("octocat"),
          readRepositoryPrivacy: () => Promise.resolve(true),
          listOpenPullRequests: () => Promise.resolve([]),
          resolvePullAuthor: () => Promise.resolve(null),
          listCheckBuckets: () => Promise.resolve([]),
        },
        sessions,
        now: () => 1_000_000,
        generateCredential: () => "connection-credential",
      });
      return sessions.resolve(credentialDigest("connection-credential"));
    })
    .extend("missingTokenFailure", async () => {
      try {
        await issueSession({
          githubToken: undefined,
          github: {
            resolveTokenLogin: () => Promise.resolve("octocat"),
            readRepositoryPrivacy: () => Promise.resolve(true),
            listOpenPullRequests: () => Promise.resolve([]),
            resolvePullAuthor: () => Promise.resolve(null),
            listCheckBuckets: () => Promise.resolve([]),
          },
          sessions: createMemorySessionStore(),
        });
      } catch (missingTokenFailure) {
        return missingTokenFailure;
      }
      throw new Error("GitHub トークンが無いのに発行が通った");
    })
    .extend("publicRepositoryFailure", async () => {
      try {
        await issueSession({
          githubToken: "github-token",
          github: {
            resolveTokenLogin: () => Promise.resolve("octocat"),
            readRepositoryPrivacy: () => Promise.resolve(false),
            listOpenPullRequests: () => Promise.resolve([]),
            resolvePullAuthor: () => Promise.resolve(null),
            listCheckBuckets: () => Promise.resolve([]),
          },
          sessions: createMemorySessionStore(),
        });
      } catch (publicRepositoryFailure) {
        return publicRepositoryFailure;
      }
      throw new Error("public リポジトリの読取で発行が通った");
    })
    .extend("githubRejectionFailure", async () => {
      try {
        await issueSession({
          githubToken: "github-token",
          github: {
            resolveTokenLogin: () => Promise.reject(new GithubRejectionError("bad credentials")),
            readRepositoryPrivacy: () => Promise.resolve(true),
            listOpenPullRequests: () => Promise.resolve([]),
            resolvePullAuthor: () => Promise.resolve(null),
            listCheckBuckets: () => Promise.resolve([]),
          },
          sessions: createMemorySessionStore(),
        });
      } catch (githubRejectionFailure) {
        return githubRejectionFailure;
      }
      throw new Error("GitHub の確定的拒否で発行が通った");
    })
    .extend("githubUnavailableFailure", async () => {
      try {
        await issueSession({
          githubToken: "github-token",
          github: {
            resolveTokenLogin: () => Promise.reject(new GithubUnavailableError("rate limited")),
            readRepositoryPrivacy: () => Promise.resolve(true),
            listOpenPullRequests: () => Promise.resolve([]),
            resolvePullAuthor: () => Promise.resolve(null),
            listCheckBuckets: () => Promise.resolve([]),
          },
          sessions: createMemorySessionStore(),
        });
      } catch (githubUnavailableFailure) {
        return githubUnavailableFailure;
      }
      throw new Error("GitHub 到達不能で発行が通った");
    })
    .extend("unclassifiedFailure", async () => {
      try {
        await issueSession({
          githubToken: "github-token",
          github: {
            resolveTokenLogin: () => Promise.resolve("octocat"),
            readRepositoryPrivacy: () => Promise.reject(new Error("unexpected shape")),
            listOpenPullRequests: () => Promise.resolve([]),
            resolvePullAuthor: () => Promise.resolve(null),
            listCheckBuckets: () => Promise.resolve([]),
          },
          sessions: createMemorySessionStore(),
        });
      } catch (unclassifiedFailure) {
        return unclassifiedFailure;
      }
      throw new Error("分類外の失敗で発行が通った");
    })
    .extend("defaultCredentialIsBase64UrlOf32Bytes", async () => {
      const defaultIssuance = await issueSession({
        githubToken: "github-token",
        github: {
          resolveTokenLogin: () => Promise.resolve("octocat"),
          readRepositoryPrivacy: () => Promise.resolve(true),
          listOpenPullRequests: () => Promise.resolve([]),
          resolvePullAuthor: () => Promise.resolve(null),
          listCheckBuckets: () => Promise.resolve([]),
        },
        sessions: createMemorySessionStore(),
      });
      return /^[A-Za-z0-9_-]{43}$/u.test(defaultIssuance.token);
    });

  it("本人性とリポジトリ読取を確認して短命クレデンシャルを発行する", ({ issuedSession }) => {
    expect(issuedSession).toStrictEqual({
      token: "connection-credential",
      expiresAt: new Date(1_000_000 + 8 * 3_600_000).toISOString(),
    });
  });

  it("発行したクレデンシャルは login と期限つきでストアに残る", ({
    storedSessionAfterIssuance,
  }) => {
    expect(storedSessionAfterIssuance).toStrictEqual({
      login: "octocat",
      expiresAtMs: 1_000_000 + 8 * 3_600_000,
    });
  });

  it("GitHub トークンが無ければ確定的拒否になる", ({ missingTokenFailure }) => {
    expect(missingTokenFailure).toStrictEqual(new UnauthenticatedError("github token missing"));
  });

  it("対象リポジトリが public なら read は証明にならず拒否される", ({
    publicRepositoryFailure,
  }) => {
    expect(publicRepositoryFailure).toStrictEqual(
      new UnauthenticatedError("repository read does not prove membership on a public repository"),
    );
  });

  it("GitHub の確定的拒否は 401 系の型になる", ({ githubRejectionFailure }) => {
    expect(githubRejectionFailure).toStrictEqual(
      new UnauthenticatedError("github rejected the presented token"),
    );
  });

  it("GitHub 到達不能は検証器不能の型になる", ({ githubUnavailableFailure }) => {
    expect(githubUnavailableFailure).toStrictEqual(
      new VerifierUnavailableError("github could not be reached to verify the token"),
    );
  });

  it("どちらでもない失敗は変換されず伝播する", ({ unclassifiedFailure }) => {
    expect(unclassifiedFailure).toStrictEqual(new Error("unexpected shape"));
  });

  it("既定では 32 バイトの暗号乱数を base64url 化したクレデンシャルになる", ({
    defaultCredentialIsBase64UrlOf32Bytes,
  }) => {
    expect(defaultCredentialIsBase64UrlOf32Bytes).toBe(true);
  });
});
