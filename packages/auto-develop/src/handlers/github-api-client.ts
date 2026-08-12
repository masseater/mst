import { Octokit } from "octokit";

import type { Review } from "../lifecycle/review-verdict.ts";
import type { HandlerGithubClient, PrSnapshot } from "./github-client.ts";

export const createGithubApiClient = (client: {
  readonly repository: string;
  readonly token: string;
  readonly baseUrl?: string;
}): HandlerGithubClient => {
  const [owner = "", repo = ""] = client.repository.split("/");
  const octokit = new Octokit({
    auth: client.token,
    ...(client.baseUrl === undefined ? {} : { baseUrl: client.baseUrl }),
  });

  return {
    prSnapshot: async (prNumber): Promise<PrSnapshot> => {
      const { data } = await octokit.rest.pulls.get({ owner, repo, pull_number: prNumber });
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
      await octokit.rest.repos.createCommitStatus({
        owner,
        repo,
        sha: asked.sha,
        state: asked.state,
        context: asked.context,
        description: asked.description,
      });
    },
    listReviews: async (prNumber): Promise<readonly Review[]> => {
      const listed = await octokit.paginate(octokit.rest.pulls.listReviews, {
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
      await octokit.rest.pulls.requestReviewers({
        owner,
        repo,
        pull_number: asked.prNumber,
        reviewers: [...asked.logins],
      });
    },
  };
};
