import { describe, expect, test } from "vite-plus/test";

import { createGithubFetchReader, octokitAccessFor } from "./github-fetch-reader.ts";
import { GithubRejectionError } from "./github-rejection-error.ts";
import { GithubUnavailableError } from "./github-unavailable-error.ts";

describe("createGithubFetchReader の読み取り", () => {
  const it = test
    .extend("resolvedLogin", () =>
      createGithubFetchReader({
        repository: "owner/repo",
        token: "gh-token",
        accessFor: () => ({
          graphql: () => Promise.resolve(undefined),
          authenticatedLogin: () => Promise.resolve("review-bot"),
          repositoryIsPrivate: () => Promise.resolve(false),
        }),
      }).resolveTokenLogin("t"))
    .extend("privacyFlag", () =>
      createGithubFetchReader({
        repository: "owner/repo",
        token: "gh-token",
        accessFor: () => ({
          graphql: () => Promise.resolve(undefined),
          authenticatedLogin: () => Promise.resolve(""),
          repositoryIsPrivate: () => Promise.resolve(true),
        }),
      }).readRepositoryPrivacy("t"),
    )
    .extend("openPulls", () =>
      createGithubFetchReader({
        repository: "owner/repo",
        token: "gh-token",
        accessFor: () => ({
          graphql: () =>
            Promise.resolve({
              repository: {
                pullRequests: {
                  nodes: [
                    {
                      number: 7,
                      title: "topic",
                      isDraft: false,
                      author: { login: "human" },
                      baseRefOid: "base-sha",
                      headRefOid: "head-sha",
                      mergeable: "MERGEABLE",
                      mergeStateStatus: "CLEAN",
                      reviewDecision: null,
                      labels: { nodes: [{ name: "keep" }] },
                      reviewRequests: { nodes: [{ requestedReviewer: { login: "review-bot" } }] },
                    },
                  ],
                },
              },
            }),
          authenticatedLogin: () => Promise.resolve(""),
          repositoryIsPrivate: () => Promise.resolve(false),
        }),
      }).listOpenPullRequests(),
    )
    .extend("pullAuthor", () =>
      createGithubFetchReader({
        repository: "owner/repo",
        token: "gh-token",
        accessFor: () => ({
          graphql: () =>
            Promise.resolve({ repository: { pullRequest: { author: { login: "human" } } } }),
          authenticatedLogin: () => Promise.resolve(""),
          repositoryIsPrivate: () => Promise.resolve(false),
        }),
      }).resolvePullAuthor(7),
    )
    .extend("checkBuckets", () =>
      createGithubFetchReader({
        repository: "owner/repo",
        token: "gh-token",
        accessFor: () => ({
          graphql: () =>
            Promise.resolve({
              repository: {
                pullRequest: {
                  commits: {
                    nodes: [
                      {
                        commit: {
                          statusCheckRollup: {
                            contexts: {
                              nodes: [
                                { status: "COMPLETED", conclusion: "SUCCESS" },
                                { status: "IN_PROGRESS" },
                                { state: "FAILURE" },
                              ],
                            },
                          },
                        },
                      },
                    ],
                  },
                },
              },
            }),
          authenticatedLogin: () => Promise.resolve(""),
          repositoryIsPrivate: () => Promise.resolve(false),
        }),
      }).listCheckBuckets(7),
    );

  it("認証済みユーザーのログインを返す", ({ resolvedLogin }) => {
    expect(resolvedLogin).toStrictEqual("review-bot");
  });

  it("リポジトリが private かどうかを返す", ({ privacyFlag }) => {
    expect(privacyFlag).toStrictEqual(true);
  });

  it("開いている PR を要約へ写す", ({ openPulls }) => {
    expect(openPulls).toStrictEqual([
      {
        number: 7,
        title: "topic",
        draft: false,
        authorLogin: "human",
        baseSha: "base-sha",
        headSha: "head-sha",
        mergeable: "MERGEABLE",
        mergeStateStatus: "CLEAN",
        reviewDecision: null,
        labelNames: ["keep"],
        requestedReviewerLogins: ["review-bot"],
      },
    ]);
  });

  it("PR の著者ログインを返す", ({ pullAuthor }) => {
    expect(pullAuthor).toStrictEqual("human");
  });

  it("チェックの状態を分類へ写す", ({ checkBuckets }) => {
    expect(checkBuckets).toStrictEqual(["pass", "pending", "fail"]);
  });
});

describe("createGithubFetchReader の失敗分類", () => {
  const it = test
    .extend("serverFailure", async () => {
      const githubStatusFailure: Error & {
        status: number;
        response: { headers: Record<string, string> };
      } = {
        name: "GithubStatusError",
        message: "github responded 503",
        status: 503,
        response: { headers: {} },
      };
      try {
        await createGithubFetchReader({
          repository: "owner/repo",
          token: "gh-token",
          accessFor: () => ({
            graphql: () => Promise.reject(githubStatusFailure),
            authenticatedLogin: () => Promise.resolve(""),
            repositoryIsPrivate: () => Promise.resolve(false),
          }),
        }).listOpenPullRequests();
        throw new Error("a 5xx response was accepted");
      } catch (serverReadFailure) {
        return serverReadFailure;
      }
    })
    .extend("rateLimitFailure", async () => {
      const githubStatusFailure: Error & {
        status: number;
        response: { headers: Record<string, string> };
      } = {
        name: "GithubStatusError",
        message: "github responded 403",
        status: 403,
        response: { headers: { "x-ratelimit-remaining": "0" } },
      };
      try {
        await createGithubFetchReader({
          repository: "owner/repo",
          token: "gh-token",
          accessFor: () => ({
            graphql: () => Promise.reject(githubStatusFailure),
            authenticatedLogin: () => Promise.resolve(""),
            repositoryIsPrivate: () => Promise.resolve(false),
          }),
        }).listOpenPullRequests();
        throw new Error("an exhausted rate limit was accepted");
      } catch (rateLimitReadFailure) {
        return rateLimitReadFailure;
      }
    })
    .extend("forbiddenFailure", async () => {
      const githubStatusFailure: Error & {
        status: number;
        response: { headers: Record<string, string> };
      } = {
        name: "GithubStatusError",
        message: "github responded 403",
        status: 403,
        response: { headers: { "x-ratelimit-remaining": "42" } },
      };
      try {
        await createGithubFetchReader({
          repository: "owner/repo",
          token: "gh-token",
          accessFor: () => ({
            graphql: () => Promise.reject(githubStatusFailure),
            authenticatedLogin: () => Promise.resolve(""),
            repositoryIsPrivate: () => Promise.resolve(false),
          }),
        }).listOpenPullRequests();
        throw new Error("a forbidden response was accepted");
      } catch (forbiddenReadFailure) {
        return forbiddenReadFailure;
      }
    });

  it("5xx は一時的な障害として扱う", ({ serverFailure }) => {
    expect(serverFailure).toStrictEqual(new GithubUnavailableError("github responded with 503"));
  });

  it("残数ゼロの 403 は一時的な障害として扱う", ({ rateLimitFailure }) => {
    expect(rateLimitFailure).toStrictEqual(new GithubUnavailableError("github responded with 403"));
  });

  it("残数のある 403 は拒否として扱う", ({ forbiddenFailure }) => {
    expect(forbiddenFailure).toStrictEqual(
      new GithubRejectionError("github rejected the asked with 403"),
    );
  });
});

describe("createGithubFetchReader の分類", () => {
  const it = test
    .extend("cancelledBucket", () =>
      createGithubFetchReader({
        repository: "owner/repo",
        token: "gh-token",
        accessFor: () => ({
          graphql: () =>
            Promise.resolve({
              repository: {
                pullRequest: {
                  commits: {
                    nodes: [
                      {
                        commit: {
                          statusCheckRollup: {
                            contexts: {
                              nodes: [{ status: "COMPLETED", conclusion: "CANCELLED" }],
                            },
                          },
                        },
                      },
                    ],
                  },
                },
              },
            }),
          authenticatedLogin: () => Promise.resolve(""),
          repositoryIsPrivate: () => Promise.resolve(false),
        }),
      }).listCheckBuckets(7))
    .extend("skippedBucket", () =>
      createGithubFetchReader({
        repository: "owner/repo",
        token: "gh-token",
        accessFor: () => ({
          graphql: () =>
            Promise.resolve({
              repository: {
                pullRequest: {
                  commits: {
                    nodes: [
                      {
                        commit: {
                          statusCheckRollup: {
                            contexts: { nodes: [{ status: "COMPLETED", conclusion: "SKIPPED" }] },
                          },
                        },
                      },
                    ],
                  },
                },
              },
            }),
          authenticatedLogin: () => Promise.resolve(""),
          repositoryIsPrivate: () => Promise.resolve(false),
        }),
      }).listCheckBuckets(7),
    )
    .extend("neutralBucket", () =>
      createGithubFetchReader({
        repository: "owner/repo",
        token: "gh-token",
        accessFor: () => ({
          graphql: () =>
            Promise.resolve({
              repository: {
                pullRequest: {
                  commits: {
                    nodes: [
                      {
                        commit: {
                          statusCheckRollup: {
                            contexts: { nodes: [{ status: "COMPLETED", conclusion: "NEUTRAL" }] },
                          },
                        },
                      },
                    ],
                  },
                },
              },
            }),
          authenticatedLogin: () => Promise.resolve(""),
          repositoryIsPrivate: () => Promise.resolve(false),
        }),
      }).listCheckBuckets(7),
    )
    .extend("failedRunBucket", () =>
      createGithubFetchReader({
        repository: "owner/repo",
        token: "gh-token",
        accessFor: () => ({
          graphql: () =>
            Promise.resolve({
              repository: {
                pullRequest: {
                  commits: {
                    nodes: [
                      {
                        commit: {
                          statusCheckRollup: {
                            contexts: { nodes: [{ status: "COMPLETED", conclusion: "FAILURE" }] },
                          },
                        },
                      },
                    ],
                  },
                },
              },
            }),
          authenticatedLogin: () => Promise.resolve(""),
          repositoryIsPrivate: () => Promise.resolve(false),
        }),
      }).listCheckBuckets(7),
    )
    .extend("expectedContextBucket", () =>
      createGithubFetchReader({
        repository: "owner/repo",
        token: "gh-token",
        accessFor: () => ({
          graphql: () =>
            Promise.resolve({
              repository: {
                pullRequest: {
                  commits: {
                    nodes: [
                      {
                        commit: {
                          statusCheckRollup: { contexts: { nodes: [{ state: "EXPECTED" }] } },
                        },
                      },
                    ],
                  },
                },
              },
            }),
          authenticatedLogin: () => Promise.resolve(""),
          repositoryIsPrivate: () => Promise.resolve(false),
        }),
      }).listCheckBuckets(7),
    )
    .extend("successContextBucket", () =>
      createGithubFetchReader({
        repository: "owner/repo",
        token: "gh-token",
        accessFor: () => ({
          graphql: () =>
            Promise.resolve({
              repository: {
                pullRequest: {
                  commits: {
                    nodes: [
                      {
                        commit: {
                          statusCheckRollup: { contexts: { nodes: [{ state: "SUCCESS" }] } },
                        },
                      },
                    ],
                  },
                },
              },
            }),
          authenticatedLogin: () => Promise.resolve(""),
          repositoryIsPrivate: () => Promise.resolve(false),
        }),
      }).listCheckBuckets(7),
    );

  it("取り消しは cancel になる", ({ cancelledBucket }) => {
    expect(cancelledBucket).toStrictEqual(["cancel"]);
  });

  it("スキップは skipping になる", ({ skippedBucket }) => {
    expect(skippedBucket).toStrictEqual(["skipping"]);
  });

  it("中立の結論は pass になる", ({ neutralBucket }) => {
    expect(neutralBucket).toStrictEqual(["pass"]);
  });

  it("失敗した実行は fail になる", ({ failedRunBucket }) => {
    expect(failedRunBucket).toStrictEqual(["fail"]);
  });

  it("待機中の状態は pending になる", ({ expectedContextBucket }) => {
    expect(expectedContextBucket).toStrictEqual(["pending"]);
  });

  it("成功した状態は pass になる", ({ successContextBucket }) => {
    expect(successContextBucket).toStrictEqual(["pass"]);
  });
});

describe("createGithubFetchReader の既定クライアント", () => {
  const it = test
    .extend("loginOverOctokit", () =>
      createGithubFetchReader({
        repository: "owner/repo",
        token: "gh-token",
        accessFor: octokitAccessFor({
          baseUrl: "https://api.github.test",
          fetchImpl: () =>
            Promise.resolve(
              new Response(JSON.stringify({ login: "octo-user" }), {
                status: 200,
                headers: { "content-type": "application/json" },
              }),
            ),
        }),
      }).resolveTokenLogin("t"))
    .extend("privacyOverOctokit", () =>
      createGithubFetchReader({
        repository: "owner/repo",
        token: "gh-token",
        accessFor: octokitAccessFor({
          baseUrl: "https://api.github.test",
          fetchImpl: () =>
            Promise.resolve(
              new Response(JSON.stringify({ private: true }), {
                status: 200,
                headers: { "content-type": "application/json" },
              }),
            ),
        }),
      }).readRepositoryPrivacy("t"),
    )
    .extend("pullsOverOctokit", () =>
      createGithubFetchReader({
        repository: "owner/repo",
        token: "gh-token",
        accessFor: octokitAccessFor({
          baseUrl: "https://api.github.test",
          fetchImpl: () =>
            Promise.resolve(
              new Response(
                JSON.stringify({
                  data: {
                    repository: {
                      pullRequests: {
                        nodes: [
                          {
                            number: 7,
                            title: "topic",
                            isDraft: false,
                            author: { login: "human" },
                            baseRefOid: "base-sha",
                            headRefOid: "head-sha",
                            mergeable: "MERGEABLE",
                            mergeStateStatus: "CLEAN",
                            reviewDecision: null,
                            labels: { nodes: [{ name: "keep" }] },
                            reviewRequests: {
                              nodes: [{ requestedReviewer: { login: "review-bot" } }],
                            },
                          },
                        ],
                      },
                    },
                  },
                }),
                { status: 200, headers: { "content-type": "application/json" } },
              ),
            ),
        }),
      }).listOpenPullRequests(),
    );

  it("注入なしでもログインを読む", ({ loginOverOctokit }) => {
    expect(loginOverOctokit).toStrictEqual("octo-user");
  });

  it("注入なしでも公開範囲を読む", ({ privacyOverOctokit }) => {
    expect(privacyOverOctokit).toStrictEqual(true);
  });

  it("注入なしでも PR 一覧を読む", ({ pullsOverOctokit }) => {
    expect(pullsOverOctokit).toStrictEqual([
      {
        number: 7,
        title: "topic",
        draft: false,
        authorLogin: "human",
        baseSha: "base-sha",
        headSha: "head-sha",
        mergeable: "MERGEABLE",
        mergeStateStatus: "CLEAN",
        reviewDecision: null,
        labelNames: ["keep"],
        requestedReviewerLogins: ["review-bot"],
      },
    ]);
  });
});

describe("createGithubFetchReader の欠損応答", () => {
  const it = test
    .extend("nonRecordGraphqlData", () =>
      createGithubFetchReader({
        repository: "owner/repo",
        token: "gh-token",
        accessFor: () => ({
          graphql: () => Promise.resolve("not a record"),
          authenticatedLogin: () => Promise.resolve(""),
          repositoryIsPrivate: () => Promise.resolve(false),
        }),
      }).listOpenPullRequests())
    .extend("nonRecordNodesSkipped", () =>
      createGithubFetchReader({
        repository: "owner/repo",
        token: "gh-token",
        accessFor: () => ({
          graphql: () =>
            Promise.resolve({ repository: { pullRequests: { nodes: ["not a node"] } } }),
          authenticatedLogin: () => Promise.resolve(""),
          repositoryIsPrivate: () => Promise.resolve(false),
        }),
      }).listOpenPullRequests(),
    )
    .extend("nonRecordContextsSkipped", () =>
      createGithubFetchReader({
        repository: "owner/repo",
        token: "gh-token",
        accessFor: () => ({
          graphql: () =>
            Promise.resolve({
              repository: {
                pullRequest: {
                  commits: {
                    nodes: [
                      {
                        commit: {
                          statusCheckRollup: { contexts: { nodes: ["not a node"] } },
                        },
                      },
                    ],
                  },
                },
              },
            }),
          authenticatedLogin: () => Promise.resolve(""),
          repositoryIsPrivate: () => Promise.resolve(false),
        }),
      }).listCheckBuckets(7),
    )
    .extend("nonStringLabelsDropped", () =>
      createGithubFetchReader({
        repository: "owner/repo",
        token: "gh-token",
        accessFor: () => ({
          graphql: () =>
            Promise.resolve({
              repository: {
                pullRequests: {
                  nodes: [
                    {
                      labels: { nodes: [{ name: 7 }] },
                      reviewRequests: { nodes: [{ requestedReviewer: { login: 7 } }] },
                    },
                  ],
                },
              },
            }),
          authenticatedLogin: () => Promise.resolve(""),
          repositoryIsPrivate: () => Promise.resolve(false),
        }),
      }).listOpenPullRequests(),
    )
    .extend("failureWithoutStatus", async () => {
      try {
        await createGithubFetchReader({
          repository: "owner/repo",
          token: "gh-token",
          accessFor: () => ({
            graphql: () => Promise.reject(new Error("no heldStatus on this failure")),
            authenticatedLogin: () => Promise.resolve(""),
            repositoryIsPrivate: () => Promise.resolve(false),
          }),
        }).listOpenPullRequests();
        throw new Error("a statusless failure was accepted");
      } catch (statuslessReadFailure) {
        return statuslessReadFailure;
      }
    })
    .extend("loginFailureOverDefaultPath", async () => {
      try {
        await createGithubFetchReader({
          repository: "owner/repo",
          token: "gh-token",
          accessFor: octokitAccessFor({
            baseUrl: "https://api.github.test",
            fetchImpl: () => Promise.resolve(new Response("nope", { status: 404 })),
          }),
        }).resolveTokenLogin("t");
        throw new Error("a 404 login response was accepted");
      } catch (loginReadFailure) {
        return loginReadFailure;
      }
    })
    .extend("privacyFailureOverDefaultPath", async () => {
      try {
        await createGithubFetchReader({
          repository: "owner/repo",
          token: "gh-token",
          accessFor: octokitAccessFor({
            baseUrl: "https://api.github.test",
            fetchImpl: () => Promise.resolve(new Response("nope", { status: 404 })),
          }),
        }).readRepositoryPrivacy("t");
        throw new Error("a 404 privacy response was accepted");
      } catch (privacyReadFailure) {
        return privacyReadFailure;
      }
    })
    .extend("pullWithoutOptionalFields", () =>
      createGithubFetchReader({
        repository: "owner/repo",
        token: "gh-token",
        accessFor: () => ({
          graphql: () => Promise.resolve({ repository: { pullRequests: { nodes: [{}] } } }),
          authenticatedLogin: () => Promise.resolve(""),
          repositoryIsPrivate: () => Promise.resolve(false),
        }),
      }).listOpenPullRequests(),
    )
    .extend("missingRepositoryData", () =>
      createGithubFetchReader({
        repository: "owner/repo",
        token: "gh-token",
        accessFor: () => ({
          graphql: () => Promise.resolve({}),
          authenticatedLogin: () => Promise.resolve(""),
          repositoryIsPrivate: () => Promise.resolve(false),
        }),
      }).listOpenPullRequests(),
    )
    .extend("missingAuthorData", () =>
      createGithubFetchReader({
        repository: "owner/repo",
        token: "gh-token",
        accessFor: () => ({
          graphql: () => Promise.resolve({}),
          authenticatedLogin: () => Promise.resolve(""),
          repositoryIsPrivate: () => Promise.resolve(false),
        }),
      }).resolvePullAuthor(7),
    )
    .extend("missingCheckData", () =>
      createGithubFetchReader({
        repository: "owner/repo",
        token: "gh-token",
        accessFor: () => ({
          graphql: () => Promise.resolve({}),
          authenticatedLogin: () => Promise.resolve(""),
          repositoryIsPrivate: () => Promise.resolve(false),
        }),
      }).listCheckBuckets(7),
    );

  it("応答そのものがレコードでなければ空を返す", ({ nonRecordGraphqlData }) => {
    expect(nonRecordGraphqlData).toStrictEqual([]);
  });

  it("要素がレコードでない PR 一覧は読み飛ばす", ({ nonRecordNodesSkipped }) => {
    expect(nonRecordNodesSkipped).toStrictEqual([]);
  });

  it("要素がレコードでないチェックは読み飛ばす", ({ nonRecordContextsSkipped }) => {
    expect(nonRecordContextsSkipped).toStrictEqual([]);
  });

  it("文字列でないラベルとレビュアーは落とす", ({ nonStringLabelsDropped }) => {
    expect(nonStringLabelsDropped).toStrictEqual([
      {
        number: 0,
        title: "",
        draft: false,
        authorLogin: null,
        baseSha: "",
        headSha: "",
        mergeable: null,
        mergeStateStatus: null,
        reviewDecision: null,
        labelNames: [],
        requestedReviewerLogins: [],
      },
    ]);
  });

  it("状態を持たない失敗は拒否として扱う", ({ failureWithoutStatus }) => {
    expect(failureWithoutStatus).toStrictEqual(
      new GithubRejectionError("github rejected the asked with 0"),
    );
  });

  it("既定クライアントのログイン取得の失敗も分類される", ({ loginFailureOverDefaultPath }) => {
    expect(loginFailureOverDefaultPath).toStrictEqual(
      new GithubRejectionError("github rejected the asked with 404"),
    );
  });

  it("既定クライアントの公開範囲取得の失敗も分類される", ({ privacyFailureOverDefaultPath }) => {
    expect(privacyFailureOverDefaultPath).toStrictEqual(
      new GithubRejectionError("github rejected the asked with 404"),
    );
  });

  it("任意項目を欠く PR も既定値で写す", ({ pullWithoutOptionalFields }) => {
    expect(pullWithoutOptionalFields).toStrictEqual([
      {
        number: 0,
        title: "",
        draft: false,
        authorLogin: null,
        baseSha: "",
        headSha: "",
        mergeable: null,
        mergeStateStatus: null,
        reviewDecision: null,
        labelNames: [],
        requestedReviewerLogins: [],
      },
    ]);
  });

  it("PR 一覧が欠けていれば空を返す", ({ missingRepositoryData }) => {
    expect(missingRepositoryData).toStrictEqual([]);
  });

  it("著者が欠けていれば null を返す", ({ missingAuthorData }) => {
    expect(missingAuthorData).toStrictEqual(null);
  });

  it("チェックが欠けていれば空を返す", ({ missingCheckData }) => {
    expect(missingCheckData).toStrictEqual([]);
  });
});
