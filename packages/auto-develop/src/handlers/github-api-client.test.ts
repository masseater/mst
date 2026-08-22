import { describe, expect, test, vi } from "vite-plus/test";

import { createGithubApiClient, type GithubOctokit } from "./github-api-client.ts";

describe("createGithubApiClient", () => {
  const it = test
    .extend("completePullSnapshot", async () => {
      const octokit = {
        rest: {
          pulls: {
            get: vi.fn<GithubOctokit["rest"]["pulls"]["get"]>(() =>
              Promise.resolve({
                data: {
                  title: "Pull title",
                  body: "Pull body",
                  state: "open",
                  head: { ref: "topic", sha: "head-sha" },
                  base: { ref: "main" },
                  draft: true,
                  requested_reviewers: [{ login: "reviewer-one" }, { login: "reviewer-two" }],
                },
              }),
            ),
            listReviews: vi.fn<GithubOctokit["rest"]["pulls"]["listReviews"]>(() =>
              Promise.resolve({ data: [] }),
            ),
            requestReviewers: vi.fn<GithubOctokit["rest"]["pulls"]["requestReviewers"]>(() =>
              Promise.resolve(),
            ),
          },
          repos: {
            createCommitStatus: vi.fn<GithubOctokit["rest"]["repos"]["createCommitStatus"]>(() =>
              Promise.resolve(),
            ),
          },
        },
        paginate: vi.fn<GithubOctokit["paginate"]>(
          async (endpoint, pullRequest) => (await endpoint(pullRequest)).data,
        ),
      } satisfies GithubOctokit;
      return createGithubApiClient({
        repository: "owner/repository/ignored",
        token: "token",
        octokit,
      }).prSnapshot(17);
    })
    .extend("completePullRequest", async () => {
      const getPull = vi.fn<GithubOctokit["rest"]["pulls"]["get"]>(() =>
        Promise.resolve({
          data: {
            title: "Pull title",
            body: "Pull body",
            state: "open",
            head: { ref: "topic", sha: "head-sha" },
            base: { ref: "main" },
            draft: true,
            requested_reviewers: [{ login: "reviewer-one" }, { login: "reviewer-two" }],
          },
        }),
      );
      const octokit = {
        rest: {
          pulls: {
            get: getPull,
            listReviews: vi.fn<GithubOctokit["rest"]["pulls"]["listReviews"]>(() =>
              Promise.resolve({ data: [] }),
            ),
            requestReviewers: vi.fn<GithubOctokit["rest"]["pulls"]["requestReviewers"]>(() =>
              Promise.resolve(),
            ),
          },
          repos: {
            createCommitStatus: vi.fn<GithubOctokit["rest"]["repos"]["createCommitStatus"]>(() =>
              Promise.resolve(),
            ),
          },
        },
        paginate: vi.fn<GithubOctokit["paginate"]>(
          async (endpoint, pullRequest) => (await endpoint(pullRequest)).data,
        ),
      } satisfies GithubOctokit;
      await createGithubApiClient({
        repository: "owner/repository/ignored",
        token: "token",
        octokit,
      }).prSnapshot(17);
      return getPull;
    })
    .extend("defaultedPullSnapshot", async () => {
      const octokit = {
        rest: {
          pulls: {
            get: vi.fn<GithubOctokit["rest"]["pulls"]["get"]>(() =>
              Promise.resolve({
                data: {
                  title: "Pull title",
                  body: null,
                  state: "closed",
                  head: { ref: "topic", sha: "head-sha" },
                  base: { ref: "main" },
                  requested_reviewers: null,
                },
              }),
            ),
            listReviews: vi.fn<GithubOctokit["rest"]["pulls"]["listReviews"]>(() =>
              Promise.resolve({ data: [] }),
            ),
            requestReviewers: vi.fn<GithubOctokit["rest"]["pulls"]["requestReviewers"]>(() =>
              Promise.resolve(),
            ),
          },
          repos: {
            createCommitStatus: vi.fn<GithubOctokit["rest"]["repos"]["createCommitStatus"]>(() =>
              Promise.resolve(),
            ),
          },
        },
        paginate: vi.fn<GithubOctokit["paginate"]>(
          async (endpoint, pullRequest) => (await endpoint(pullRequest)).data,
        ),
      } satisfies GithubOctokit;
      return createGithubApiClient({ repository: "", token: "token", octokit }).prSnapshot(3);
    })
    .extend("defaultedPullRequest", async () => {
      const getPull = vi.fn<GithubOctokit["rest"]["pulls"]["get"]>(() =>
        Promise.resolve({
          data: {
            title: "Pull title",
            body: null,
            state: "closed",
            head: { ref: "topic", sha: "head-sha" },
            base: { ref: "main" },
            requested_reviewers: null,
          },
        }),
      );
      const octokit = {
        rest: {
          pulls: {
            get: getPull,
            listReviews: vi.fn<GithubOctokit["rest"]["pulls"]["listReviews"]>(() =>
              Promise.resolve({ data: [] }),
            ),
            requestReviewers: vi.fn<GithubOctokit["rest"]["pulls"]["requestReviewers"]>(() =>
              Promise.resolve(),
            ),
          },
          repos: {
            createCommitStatus: vi.fn<GithubOctokit["rest"]["repos"]["createCommitStatus"]>(() =>
              Promise.resolve(),
            ),
          },
        },
        paginate: vi.fn<GithubOctokit["paginate"]>(
          async (endpoint, pullRequest) => (await endpoint(pullRequest)).data,
        ),
      } satisfies GithubOctokit;
      await createGithubApiClient({ repository: "", token: "token", octokit }).prSnapshot(3);
      return getPull;
    })
    .extend("commitStatusRequest", async () => {
      const createCommitStatus = vi.fn<GithubOctokit["rest"]["repos"]["createCommitStatus"]>(() =>
        Promise.resolve(),
      );
      const octokit = {
        rest: {
          pulls: {
            get: vi.fn<GithubOctokit["rest"]["pulls"]["get"]>(),
            listReviews: vi.fn<GithubOctokit["rest"]["pulls"]["listReviews"]>(),
            requestReviewers: vi.fn<GithubOctokit["rest"]["pulls"]["requestReviewers"]>(),
          },
          repos: { createCommitStatus },
        },
        paginate: vi.fn<GithubOctokit["paginate"]>(),
      } satisfies GithubOctokit;
      await createGithubApiClient({
        repository: "owner/repository",
        token: "token",
        octokit,
      }).createCommitStatus({
        sha: "head-sha",
        state: "pending",
        context: "auto-develop/reviewer",
        description: "reviewing",
      });
      return createCommitStatus;
    })
    .extend("mappedReviews", async () => {
      const listReviews = vi.fn<GithubOctokit["rest"]["pulls"]["listReviews"]>(() =>
        Promise.resolve({
          data: [
            {
              state: "APPROVED",
              body: "looks good",
              submitted_at: "2026-08-11T00:00:00.000Z",
              commit_id: "reviewed-sha",
              user: { login: "reviewer" },
            },
            {
              state: "PENDING",
              body: "draft review",
              commit_id: null,
              user: null,
            },
          ],
        }),
      );
      const octokit = {
        rest: {
          pulls: {
            get: vi.fn<GithubOctokit["rest"]["pulls"]["get"]>(),
            listReviews,
            requestReviewers: vi.fn<GithubOctokit["rest"]["pulls"]["requestReviewers"]>(),
          },
          repos: {
            createCommitStatus: vi.fn<GithubOctokit["rest"]["repos"]["createCommitStatus"]>(),
          },
        },
        paginate: vi.fn<GithubOctokit["paginate"]>(
          async (endpoint, pullRequest) => (await endpoint(pullRequest)).data,
        ),
      } satisfies GithubOctokit;
      return createGithubApiClient({
        repository: "owner/repository",
        token: "token",
        octokit,
      }).listReviews(17);
    })
    .extend("paginateReviewsRequest", async () => {
      const listReviews = vi.fn<GithubOctokit["rest"]["pulls"]["listReviews"]>(() =>
        Promise.resolve({ data: [] }),
      );
      const paginate = vi.fn<GithubOctokit["paginate"]>(
        async (endpoint, pullRequest) => (await endpoint(pullRequest)).data,
      );
      const octokit = {
        rest: {
          pulls: {
            get: vi.fn<GithubOctokit["rest"]["pulls"]["get"]>(),
            listReviews,
            requestReviewers: vi.fn<GithubOctokit["rest"]["pulls"]["requestReviewers"]>(),
          },
          repos: {
            createCommitStatus: vi.fn<GithubOctokit["rest"]["repos"]["createCommitStatus"]>(),
          },
        },
        paginate,
      } satisfies GithubOctokit;
      await createGithubApiClient({
        repository: "owner/repository",
        token: "token",
        octokit,
      }).listReviews(17);
      return paginate;
    })
    .extend("listReviewsRequest", async () => {
      const listReviews = vi.fn<GithubOctokit["rest"]["pulls"]["listReviews"]>(() =>
        Promise.resolve({ data: [] }),
      );
      const octokit = {
        rest: {
          pulls: {
            get: vi.fn<GithubOctokit["rest"]["pulls"]["get"]>(),
            listReviews,
            requestReviewers: vi.fn<GithubOctokit["rest"]["pulls"]["requestReviewers"]>(),
          },
          repos: {
            createCommitStatus: vi.fn<GithubOctokit["rest"]["repos"]["createCommitStatus"]>(),
          },
        },
        paginate: vi.fn<GithubOctokit["paginate"]>(
          async (endpoint, pullRequest) => (await endpoint(pullRequest)).data,
        ),
      } satisfies GithubOctokit;
      await createGithubApiClient({
        repository: "owner/repository",
        token: "token",
        octokit,
      }).listReviews(17);
      return listReviews;
    })
    .extend("reviewerRequest", async () => {
      const requestReviewers = vi.fn<GithubOctokit["rest"]["pulls"]["requestReviewers"]>(() =>
        Promise.resolve(),
      );
      const octokit = {
        rest: {
          pulls: {
            get: vi.fn<GithubOctokit["rest"]["pulls"]["get"]>(),
            listReviews: vi.fn<GithubOctokit["rest"]["pulls"]["listReviews"]>(),
            requestReviewers,
          },
          repos: {
            createCommitStatus: vi.fn<GithubOctokit["rest"]["repos"]["createCommitStatus"]>(),
          },
        },
        paginate: vi.fn<GithubOctokit["paginate"]>(),
      } satisfies GithubOctokit;
      await createGithubApiClient({
        repository: "owner/repository",
        token: "token",
        octokit,
      }).requestReviewers({ prNumber: 17, logins: ["reviewer-one", "reviewer-two"] });
      return requestReviewers;
    })
    .extend("defaultAdapter", () =>
      createGithubApiClient({ repository: "owner/repository", token: "token" }),
    )
    .extend("enterpriseAdapter", () =>
      createGithubApiClient({
        repository: "owner/repository",
        token: "token",
        baseUrl: "https://github.example.test/api/v3",
      }),
    );

  it("maps a complete pull response into a snapshot", ({ completePullSnapshot }) => {
    expect(completePullSnapshot).toStrictEqual({
      prNumber: 17,
      title: "Pull title",
      body: "Pull body",
      state: "open",
      headRefName: "topic",
      headRefOid: "head-sha",
      baseRefName: "main",
      draft: true,
      requestedReviewerLogins: ["reviewer-one", "reviewer-two"],
    });
  });

  it("passes pull coordinates to GitHub", ({ completePullRequest }) => {
    expect(completePullRequest).toHaveBeenCalledExactlyOnceWith({
      owner: "owner",
      repo: "repository",
      pull_number: 17,
    });
  });

  it("defaults nullable and omitted pull fields", ({ defaultedPullSnapshot }) => {
    expect(defaultedPullSnapshot).toStrictEqual({
      prNumber: 3,
      title: "Pull title",
      body: "",
      state: "closed",
      headRefName: "topic",
      headRefOid: "head-sha",
      baseRefName: "main",
      draft: false,
      requestedReviewerLogins: [],
    });
  });

  it("passes empty repository coordinates through", ({ defaultedPullRequest }) => {
    expect(defaultedPullRequest).toHaveBeenCalledExactlyOnceWith({
      owner: "",
      repo: "",
      pull_number: 3,
    });
  });

  it("passes a commit status through with repository coordinates", ({ commitStatusRequest }) => {
    expect(commitStatusRequest).toHaveBeenCalledExactlyOnceWith({
      owner: "owner",
      repo: "repository",
      sha: "head-sha",
      state: "pending",
      context: "auto-develop/reviewer",
      description: "reviewing",
    });
  });

  it("paginates reviews and maps complete and absent fields", ({ mappedReviews }) => {
    expect(mappedReviews).toStrictEqual([
      {
        state: "APPROVED",
        body: "looks good",
        submittedAt: "2026-08-11T00:00:00.000Z",
        commitSha: "reviewed-sha",
        authorLogin: "reviewer",
      },
      {
        state: "PENDING",
        body: "draft review",
        submittedAt: "",
        commitSha: "",
        authorLogin: "",
      },
    ]);
  });

  it("paginates the review endpoint exactly once", ({ paginateReviewsRequest }) => {
    expect(paginateReviewsRequest).toHaveBeenCalledOnce();
  });

  it("passes review coordinates to the review endpoint", ({ listReviewsRequest }) => {
    expect(listReviewsRequest).toHaveBeenCalledExactlyOnceWith({
      owner: "owner",
      repo: "repository",
      pull_number: 17,
      per_page: 100,
    });
  });

  it("requests each named reviewer", ({ reviewerRequest }) => {
    expect(reviewerRequest).toHaveBeenCalledExactlyOnceWith({
      owner: "owner",
      repo: "repository",
      pull_number: 17,
      reviewers: ["reviewer-one", "reviewer-two"],
    });
  });

  it("constructs its production Octokit adapter with the default origin", ({ defaultAdapter }) => {
    expect(defaultAdapter).toStrictEqual({
      prSnapshot: defaultAdapter.prSnapshot,
      createCommitStatus: defaultAdapter.createCommitStatus,
      listReviews: defaultAdapter.listReviews,
      requestReviewers: defaultAdapter.requestReviewers,
    });
  });

  it("constructs its production Octokit adapter with an enterprise origin", ({
    enterpriseAdapter,
  }) => {
    expect(enterpriseAdapter).toStrictEqual({
      prSnapshot: enterpriseAdapter.prSnapshot,
      createCommitStatus: enterpriseAdapter.createCommitStatus,
      listReviews: enterpriseAdapter.listReviews,
      requestReviewers: enterpriseAdapter.requestReviewers,
    });
  });
});
