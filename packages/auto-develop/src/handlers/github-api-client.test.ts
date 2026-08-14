import { describe, expect, test, vi } from "vite-plus/test";

import { createGithubApiClient, type GithubOctokit } from "./github-api-client.ts";

const octokitWith = (responses: {
  readonly pull?: Awaited<ReturnType<GithubOctokit["rest"]["pulls"]["get"]>>["data"];
  readonly reviews?: Awaited<ReturnType<GithubOctokit["rest"]["pulls"]["listReviews"]>>["data"];
}) => {
  const getPull = vi.fn<GithubOctokit["rest"]["pulls"]["get"]>(() =>
    Promise.resolve({
      data: responses.pull ?? {
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
  const listReviews = vi.fn<GithubOctokit["rest"]["pulls"]["listReviews"]>(() =>
    Promise.resolve({ data: responses.reviews ?? [] }),
  );
  const paginate = vi.fn<GithubOctokit["paginate"]>(
    async (endpoint, request) => (await endpoint(request)).data,
  );
  const createCommitStatus = vi.fn<GithubOctokit["rest"]["repos"]["createCommitStatus"]>(() =>
    Promise.resolve(),
  );
  const requestReviewers = vi.fn<GithubOctokit["rest"]["pulls"]["requestReviewers"]>(() =>
    Promise.resolve(),
  );
  return {
    octokit: {
      rest: {
        pulls: { get: getPull, listReviews, requestReviewers },
        repos: { createCommitStatus },
      },
      paginate,
    } satisfies GithubOctokit,
    getPull,
    listReviews,
    paginate,
    createCommitStatus,
    requestReviewers,
  };
};

describe("createGithubApiClient", () => {
  test("maps a complete pull response into a snapshot", async () => {
    const github = octokitWith({});
    const client = createGithubApiClient({
      repository: "owner/repository/ignored",
      token: "token",
      octokit: github.octokit,
    });

    const snapshot = await client.prSnapshot(17);

    expect(snapshot).toStrictEqual({
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
    expect(github.getPull).toHaveBeenCalledExactlyOnceWith({
      owner: "owner",
      repo: "repository",
      pull_number: 17,
    });
  });

  test("defaults nullable and omitted pull fields", async () => {
    const github = octokitWith({
      pull: {
        title: "Pull title",
        body: null,
        state: "closed",
        head: { ref: "topic", sha: "head-sha" },
        base: { ref: "main" },
        requested_reviewers: null,
      },
    });
    const client = createGithubApiClient({
      repository: "",
      token: "token",
      octokit: github.octokit,
    });

    const snapshot = await client.prSnapshot(3);

    expect(snapshot).toMatchObject({ body: "", draft: false, requestedReviewerLogins: [] });
    expect(github.getPull).toHaveBeenCalledExactlyOnceWith({
      owner: "",
      repo: "",
      pull_number: 3,
    });
  });

  test("passes a commit status through with repository coordinates", async () => {
    const github = octokitWith({});
    const client = createGithubApiClient({
      repository: "owner/repository",
      token: "token",
      octokit: github.octokit,
    });

    await client.createCommitStatus({
      sha: "head-sha",
      state: "pending",
      context: "auto-develop/reviewer",
      description: "reviewing",
    });

    expect(github.createCommitStatus).toHaveBeenCalledExactlyOnceWith({
      owner: "owner",
      repo: "repository",
      sha: "head-sha",
      state: "pending",
      context: "auto-develop/reviewer",
      description: "reviewing",
    });
  });

  test("paginates reviews and maps complete and absent fields", async () => {
    const github = octokitWith({
      reviews: [
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
    });
    const client = createGithubApiClient({
      repository: "owner/repository",
      token: "token",
      octokit: github.octokit,
    });

    const reviews = await client.listReviews(17);

    expect(reviews).toStrictEqual([
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
    const request = {
      owner: "owner",
      repo: "repository",
      pull_number: 17,
      per_page: 100,
    };
    expect(github.paginate).toHaveBeenCalledExactlyOnceWith(github.listReviews, request);
    expect(github.listReviews).toHaveBeenCalledExactlyOnceWith(request);
  });

  test("requests each named reviewer", async () => {
    const github = octokitWith({});
    const client = createGithubApiClient({
      repository: "owner/repository",
      token: "token",
      octokit: github.octokit,
    });

    await client.requestReviewers({ prNumber: 17, logins: ["reviewer-one", "reviewer-two"] });

    expect(github.requestReviewers).toHaveBeenCalledExactlyOnceWith({
      owner: "owner",
      repo: "repository",
      pull_number: 17,
      reviewers: ["reviewer-one", "reviewer-two"],
    });
  });

  test.each([{}, { baseUrl: "https://github.example.test/api/v3" }])(
    "constructs its production Octokit adapter for $baseUrl",
    (configuration) => {
      const client = createGithubApiClient({
        repository: "owner/repository",
        token: "token",
        ...configuration,
      });

      expect(Object.keys(client).toSorted()).toStrictEqual([
        "createCommitStatus",
        "listReviews",
        "prSnapshot",
        "requestReviewers",
      ]);
    },
  );
});
