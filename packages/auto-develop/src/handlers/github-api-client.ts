import { Octokit } from "octokit";

import type { CommitStatusState, Review } from "../lifecycle/review-verdict.ts";
import type { HandlerGithubClient, PrSnapshot } from "./github-client.ts";

type RepositoryParameters = {
  readonly owner: string;
  readonly repo: string;
};

type PullRequestParameters = RepositoryParameters & { readonly pull_number: number };

type GithubApi = {
  readonly getPull: (asked: PullRequestParameters) => Promise<{
    readonly data: {
      readonly title: string;
      readonly body: string | null;
      readonly state: string;
      readonly head: { readonly ref: string; readonly sha: string };
      readonly base: { readonly ref: string };
      readonly draft?: boolean;
      readonly requested_reviewers?: readonly { readonly login: string }[] | null;
    };
  }>;
  readonly createCommitStatus: (
    asked: RepositoryParameters & {
      readonly sha: string;
      readonly state: CommitStatusState;
      readonly context: string;
      readonly description: string;
    },
  ) => Promise<unknown>;
  readonly listReviews: (asked: PullRequestParameters & { readonly per_page: number }) => Promise<
    readonly {
      readonly state: string;
      readonly body: string;
      readonly submitted_at?: string;
      readonly commit_id: string | null;
      readonly user: { readonly login: string } | null;
    }[]
  >;
  readonly requestReviewers: (
    asked: PullRequestParameters & { readonly reviewers: string[] },
  ) => Promise<unknown>;
};

type ReviewParameters = Parameters<GithubApi["listReviews"]>[0];

type ReviewResponses = Awaited<ReturnType<GithubApi["listReviews"]>>;

type PaginatedReviewEndpoint = (
  asked: ReviewParameters,
) => Promise<{ readonly data: ReviewResponses }>;

export type GithubOctokit = {
  readonly rest: {
    readonly pulls: {
      readonly get: GithubApi["getPull"];
      readonly listReviews: PaginatedReviewEndpoint;
      readonly requestReviewers: GithubApi["requestReviewers"];
    };
    readonly repos: { readonly createCommitStatus: GithubApi["createCommitStatus"] };
  };
  readonly paginate: (
    endpoint: PaginatedReviewEndpoint,
    asked: ReviewParameters,
  ) => Promise<ReviewResponses>;
};

const createOctokitApi = (client: {
  readonly token: string;
  readonly baseUrl?: string;
  readonly octokit?: GithubOctokit;
}): GithubApi => {
  const octokit: GithubOctokit =
    client.octokit ??
    new Octokit({
      auth: client.token,
      ...(client.baseUrl === undefined ? {} : { baseUrl: client.baseUrl }),
    });
  return {
    getPull: octokit.rest.pulls.get.bind(octokit.rest.pulls),
    createCommitStatus: octokit.rest.repos.createCommitStatus.bind(octokit.rest.repos),
    listReviews: (asked) => octokit.paginate(octokit.rest.pulls.listReviews, asked),
    requestReviewers: octokit.rest.pulls.requestReviewers.bind(octokit.rest.pulls),
  };
};

export const createGithubApiClient = (client: {
  readonly repository: string;
  readonly token: string;
  readonly baseUrl?: string;
  readonly octokit?: GithubOctokit;
}): HandlerGithubClient => {
  const repositoryCoordinates = client.repository.split("/");
  const owner = repositoryCoordinates.slice(0, 1).join("");
  const repo = repositoryCoordinates.slice(1, 2).join("");
  const api = createOctokitApi(client);

  return {
    prSnapshot: async (prNumber): Promise<PrSnapshot> => {
      const { data } = await api.getPull({ owner, repo, pull_number: prNumber });
      return {
        prNumber,
        title: data.title,
        body: data.body ?? "",
        state: data.state,
        headRefName: data.head.ref,
        headRefOid: data.head.sha,
        baseRefName: data.base.ref,
        draft: data.draft ?? false,
        requestedReviewerLogins: (data.requested_reviewers ?? []).map((reviewer) => reviewer.login),
      };
    },
    createCommitStatus: async (asked) => {
      await api.createCommitStatus({
        owner,
        repo,
        sha: asked.sha,
        state: asked.state,
        context: asked.context,
        description: asked.description,
      });
    },
    listReviews: async (prNumber): Promise<readonly Review[]> => {
      const listed = await api.listReviews({
        owner,
        repo,
        pull_number: prNumber,
        per_page: 100,
      });
      return listed.map((review) => ({
        state: review.state as Review["state"],
        body: review.body,
        submittedAt: review.submitted_at ?? "",
        commitSha: review.commit_id ?? "",
        authorLogin: review.user?.login ?? "",
      }));
    },
    requestReviewers: async (asked) => {
      await api.requestReviewers({
        owner,
        repo,
        pull_number: asked.prNumber,
        reviewers: [...asked.logins],
      });
    },
  };
};
