import { describe, expect, test } from "vite-plus/test";

import {
  createGithubFetchReader,
  octokitAccessFor,
  type GithubApiAccess,
} from "./github-fetch-reader.ts";
import { GithubRejectionError } from "./github-rejection-error.ts";
import { GithubUnavailableError } from "./github-unavailable-error.ts";

class GithubStatusError extends Error {
  readonly status: number;

  readonly response: { readonly headers: Readonly<Record<string, string>> };

  constructor(status: number, headers: Readonly<Record<string, string>>) {
    super(`github responded ${status}`);
    this.status = status;
    this.response = { headers };
  }
}

const accessReturning = (parts: {
  readonly graphqlData?: unknown;
  readonly authenticatedLogin?: string;
  readonly repositoryPrivate?: boolean;
  readonly failure?: Error;
}): GithubApiAccess => {
  const refuse = (): Promise<never> =>
    Promise.reject(parts.failure ?? new Error("no failure configured"));
  return {
    graphql: () => (parts.failure === undefined ? Promise.resolve(parts.graphqlData) : refuse()),
    authenticatedLogin: () =>
      parts.failure === undefined ? Promise.resolve(parts.authenticatedLogin ?? "") : refuse(),
    repositoryIsPrivate: () =>
      parts.failure === undefined ? Promise.resolve(parts.repositoryPrivate ?? false) : refuse(),
  };
};

const readerWith = (parts: Parameters<typeof accessReturning>[0]) =>
  createGithubFetchReader({
    repository: "owner/repo",
    token: "gh-token",
    accessFor: () => accessReturning(parts),
  });

const failureWith = (
  status: number,
  headers: Readonly<Record<string, string>> = {},
): GithubStatusError => new GithubStatusError(status, headers);

const jsonResponse = (body: unknown): Response =>
  Response.json(body, {
    status: 200,
    headers: { "content-type": "application/json" },
  });

const readerOverFetch = (fetchImpl: typeof fetch) =>
  createGithubFetchReader({
    repository: "owner/repo",
    token: "gh-token",
    accessFor: octokitAccessFor({ baseUrl: "https://api.github.test", fetchImpl }),
  });

const rejectionOf = async (task: () => Promise<unknown>): Promise<unknown> => {
  try {
    await task();
    return null;
  } catch (readFailure) {
    return readFailure;
  }
};

const openPullData = {
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
};

const bucketDataFor = (nodes: readonly unknown[]): unknown => ({
  repository: {
    pullRequest: {
      commits: { nodes: [{ commit: { statusCheckRollup: { contexts: { nodes } } } }] },
    },
  },
});

const checkRollupData = {
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
};

const it = test
  .extend("resolvedLogin", () =>
    readerWith({ authenticatedLogin: "review-bot" }).resolveTokenLogin("t"))
  .extend("privacyFlag", () => readerWith({ repositoryPrivate: true }).readRepositoryPrivacy("t"))
  .extend("openPulls", () => readerWith({ graphqlData: openPullData }).listOpenPullRequests())
  .extend("pullAuthor", () =>
    readerWith({
      graphqlData: { repository: { pullRequest: { author: { login: "human" } } } },
    }).resolvePullAuthor(7),
  )
  .extend("checkBuckets", () => readerWith({ graphqlData: checkRollupData }).listCheckBuckets(7))
  .extend("serverFailure", () =>
    rejectionOf(() => readerWith({ failure: failureWith(503) }).listOpenPullRequests()),
  )
  .extend("rateLimitFailure", () =>
    rejectionOf(() =>
      readerWith({
        failure: failureWith(403, { "x-ratelimit-remaining": "0" }),
      }).listOpenPullRequests(),
    ),
  )
  .extend("forbiddenFailure", () =>
    rejectionOf(() =>
      readerWith({
        failure: failureWith(403, { "x-ratelimit-remaining": "42" }),
      }).listOpenPullRequests(),
    ),
  )
  .extend("missingRepositoryData", () => readerWith({ graphqlData: {} }).listOpenPullRequests())
  .extend("missingAuthorData", () => readerWith({ graphqlData: {} }).resolvePullAuthor(7))
  .extend("missingCheckData", () => readerWith({ graphqlData: {} }).listCheckBuckets(7))
  .extend("loginOverOctokit", () =>
    readerOverFetch(() => Promise.resolve(jsonResponse({ login: "octo-user" }))).resolveTokenLogin(
      "t",
    ),
  )
  .extend("privacyOverOctokit", () =>
    readerOverFetch(() => Promise.resolve(jsonResponse({ private: true }))).readRepositoryPrivacy(
      "t",
    ),
  )
  .extend("pullsOverOctokit", () =>
    readerOverFetch(() =>
      Promise.resolve(jsonResponse({ data: openPullData })),
    ).listOpenPullRequests(),
  )
  .extend("cancelledBucket", () =>
    readerWith({
      graphqlData: bucketDataFor([{ status: "COMPLETED", conclusion: "CANCELLED" }]),
    }).listCheckBuckets(7),
  )
  .extend("skippedBucket", () =>
    readerWith({
      graphqlData: bucketDataFor([{ status: "COMPLETED", conclusion: "SKIPPED" }]),
    }).listCheckBuckets(7),
  )
  .extend("neutralBucket", () =>
    readerWith({
      graphqlData: bucketDataFor([{ status: "COMPLETED", conclusion: "NEUTRAL" }]),
    }).listCheckBuckets(7),
  )
  .extend("failedRunBucket", () =>
    readerWith({
      graphqlData: bucketDataFor([{ status: "COMPLETED", conclusion: "FAILURE" }]),
    }).listCheckBuckets(7),
  )
  .extend("expectedContextBucket", () =>
    readerWith({ graphqlData: bucketDataFor([{ state: "EXPECTED" }]) }).listCheckBuckets(7),
  )
  .extend("successContextBucket", () =>
    readerWith({ graphqlData: bucketDataFor([{ state: "SUCCESS" }]) }).listCheckBuckets(7),
  )
  .extend("pullWithoutOptionalFields", () =>
    readerWith({
      graphqlData: { repository: { pullRequests: { nodes: [{}] } } },
    }).listOpenPullRequests(),
  )
  .extend("nonRecordNodesSkipped", () =>
    readerWith({
      graphqlData: { repository: { pullRequests: { nodes: ["not a node"] } } },
    }).listOpenPullRequests(),
  )
  .extend("nonRecordContextsSkipped", () =>
    readerWith({ graphqlData: bucketDataFor(["not a node"]) }).listCheckBuckets(7),
  )
  .extend("nonStringLabelsDropped", () =>
    readerWith({
      graphqlData: {
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
      },
    }).listOpenPullRequests(),
  )
  .extend("nonRecordGraphqlData", () =>
    readerWith({ graphqlData: "not a record" }).listOpenPullRequests(),
  )
  .extend("failureWithoutStatus", () =>
    rejectionOf(() =>
      readerWith({ failure: new Error("no status on this failure") }).listOpenPullRequests(),
    ),
  )
  .extend("loginFailureOverDefaultPath", () =>
    rejectionOf(() =>
      readerOverFetch(() =>
        Promise.resolve(new Response("nope", { status: 404 })),
      ).resolveTokenLogin("t"),
    ),
  )
  .extend("privacyFailureOverDefaultPath", () =>
    rejectionOf(() =>
      readerOverFetch(() =>
        Promise.resolve(new Response("nope", { status: 404 })),
      ).readRepositoryPrivacy("t"),
    ),
  );

describe("createGithubFetchReader の読み取り", () => {
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
  it("5xx は一時的な障害として扱う", ({ serverFailure }) => {
    expect(serverFailure).toBeInstanceOf(GithubUnavailableError);
  });

  it("残数ゼロの 403 は一時的な障害として扱う", ({ rateLimitFailure }) => {
    expect(rateLimitFailure).toBeInstanceOf(GithubUnavailableError);
  });

  it("残数のある 403 は拒否として扱う", ({ forbiddenFailure }) => {
    expect(forbiddenFailure).toBeInstanceOf(GithubRejectionError);
  });
});

describe("createGithubFetchReader の分類", () => {
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
    expect(nonStringLabelsDropped[0]?.labelNames).toStrictEqual([]);
  });

  it("状態を持たない失敗は拒否として扱う", ({ failureWithoutStatus }) => {
    expect(failureWithoutStatus).toBeInstanceOf(GithubRejectionError);
  });

  it("既定クライアントのログイン取得の失敗も分類される", ({ loginFailureOverDefaultPath }) => {
    expect(loginFailureOverDefaultPath).toBeInstanceOf(GithubRejectionError);
  });

  it("既定クライアントの公開範囲取得の失敗も分類される", ({ privacyFailureOverDefaultPath }) => {
    expect(privacyFailureOverDefaultPath).toBeInstanceOf(GithubRejectionError);
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
