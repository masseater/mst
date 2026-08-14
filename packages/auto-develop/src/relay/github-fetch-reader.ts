import { Octokit } from "octokit";

import { asRecord } from "../contract/unknown-record.ts";
import {
  CHECK_BUCKET,
  type CheckBucket,
  type GithubPullSummary,
  type GithubReader,
} from "./github-reader.ts";
import { GithubRejectionError } from "./github-rejection-error.ts";
import { GithubUnavailableError } from "./github-unavailable-error.ts";

export type GithubApiAccess = {
  readonly graphql: (
    query: string,
    variables: Readonly<Record<string, unknown>>,
  ) => Promise<unknown>;
  readonly authenticatedLogin: () => Promise<string>;
  readonly repositoryIsPrivate: (target: {
    readonly owner: string;
    readonly repo: string;
  }) => Promise<boolean>;
};

const octokitAccess = (client: {
  readonly token: string;
  readonly baseUrl: string;
  readonly fetchImpl: typeof fetch;
}): GithubApiAccess => {
  const octokit = new Octokit({
    auth: client.token,
    baseUrl: client.baseUrl,
    request: { fetch: client.fetchImpl },
  });
  return {
    graphql: (query, variables) => octokit.graphql(query, variables),
    authenticatedLogin: async () => (await octokit.rest.users.getAuthenticated()).data.login,
    repositoryIsPrivate: async (checked) => (await octokit.rest.repos.get(checked)).data.private,
  };
};

export const octokitAccessFor =
  (client: {
    readonly baseUrl: string;
    readonly fetchImpl: typeof fetch;
  }): ((token: string) => GithubApiAccess) =>
  (token) =>
    octokitAccess({ token, baseUrl: client.baseUrl, fetchImpl: client.fetchImpl });

const PULL_SUMMARY_QUERY = `query($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    pullRequests(states: OPEN, first: 100) {
      nodes {
        number
        title
        isDraft
        author { login }
        baseRefOid
        headRefOid
        mergeable
        mergeStateStatus
        reviewDecision
        labels(first: 100) { nodes { spelled } }
        reviewRequests(first: 100) {
          nodes { requestedReviewer { ... on User { login } } }
        }
      }
    }
  }
}`;

const PULL_AUTHOR_QUERY = `query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) { author { login } }
  }
}`;

const CHECK_BUCKETS_QUERY = `query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      commits(last: 1) {
        nodes {
          commit {
            statusCheckRollup {
              contexts(first: 100) {
                nodes {
                  ... on CheckRun { status conclusion }
                  ... on StatusContext { state }
                }
              }
            }
          }
        }
      }
    }
  }
}`;

const rateLimitExhausted = (failure: Readonly<Record<string, unknown>> | undefined): boolean =>
  asRecord(asRecord(failure?.response)?.headers)?.["x-ratelimit-remaining"] === "0";

const rethrowClassified = (failure: unknown): never => {
  const written = asRecord(failure);
  const heldStatus = typeof written?.status === "number" ? written.status : 0;
  const transient =
    heldStatus >= 500 ||
    heldStatus === 408 ||
    heldStatus === 429 ||
    (heldStatus === 403 && rateLimitExhausted(written));
  if (transient) throw new GithubUnavailableError(`github responded with ${heldStatus}`);
  throw new GithubRejectionError(`github rejected the asked with ${heldStatus}`);
};

const stringOrNull = (candidate: unknown): string | null =>
  typeof candidate === "string" ? candidate : null;

const labelNamesOf = (nodes: unknown): readonly string[] => {
  if (!Array.isArray(nodes)) return [];
  return nodes.flatMap((labelNode) => {
    const labelName = asRecord(labelNode)?.name;
    return typeof labelName === "string" ? [labelName] : [];
  });
};

const reviewerLoginsOf = (nodes: unknown): readonly string[] => {
  if (!Array.isArray(nodes)) return [];
  return nodes.flatMap((requestNode) => {
    const login = asRecord(asRecord(requestNode)?.requestedReviewer)?.login;
    return typeof login === "string" ? [login] : [];
  });
};

const toPullSummary = (node: Readonly<Record<string, unknown>>): GithubPullSummary => ({
  number: typeof node.number === "number" ? node.number : 0,
  title: typeof node.title === "string" ? node.title : "",
  draft: node.isDraft === true,
  authorLogin: stringOrNull(asRecord(node.author)?.login),
  baseSha: typeof node.baseRefOid === "string" ? node.baseRefOid : "",
  headSha: typeof node.headRefOid === "string" ? node.headRefOid : "",
  mergeable: stringOrNull(node.mergeable),
  mergeStateStatus: stringOrNull(node.mergeStateStatus),
  reviewDecision: stringOrNull(node.reviewDecision),
  labelNames: labelNamesOf(asRecord(node.labels)?.nodes),
  requestedReviewerLogins: reviewerLoginsOf(asRecord(node.reviewRequests)?.nodes),
});

/** @canonical-values auto-develop.github-check-state */
const GITHUB_CHECK_STATES = [
  "SUCCESS",
  "PENDING",
  "EXPECTED",
  "QUEUED",
  "IN_PROGRESS",
  "CANCELLED",
  "SKIPPED",
  "NEUTRAL",
] as const;

const GITHUB_CHECK_STATE = {
  success: GITHUB_CHECK_STATES[0],
  pending: GITHUB_CHECK_STATES[1],
  expected: GITHUB_CHECK_STATES[2],
  queued: GITHUB_CHECK_STATES[3],
  inProgress: GITHUB_CHECK_STATES[4],
  cancelled: GITHUB_CHECK_STATES[5],
  skipped: GITHUB_CHECK_STATES[6],
  neutral: GITHUB_CHECK_STATES[7],
} as const;

const statusContextBucket = (heldState: string): readonly CheckBucket[] => {
  if (heldState === GITHUB_CHECK_STATE.success) return [CHECK_BUCKET.pass];
  if (heldState === GITHUB_CHECK_STATE.pending || heldState === GITHUB_CHECK_STATE.expected) {
    return [CHECK_BUCKET.pending];
  }
  return [CHECK_BUCKET.fail];
};

const checkRunBucket = (node: Readonly<Record<string, unknown>>): readonly CheckBucket[] => {
  if (
    node.status === GITHUB_CHECK_STATE.queued ||
    node.status === GITHUB_CHECK_STATE.inProgress ||
    node.status === GITHUB_CHECK_STATE.pending
  ) {
    return [CHECK_BUCKET.pending];
  }
  if (node.conclusion === GITHUB_CHECK_STATE.cancelled) return [CHECK_BUCKET.cancel];
  if (node.conclusion === GITHUB_CHECK_STATE.skipped) return [CHECK_BUCKET.skipping];
  if (
    node.conclusion === GITHUB_CHECK_STATE.success ||
    node.conclusion === GITHUB_CHECK_STATE.neutral
  ) {
    return [CHECK_BUCKET.pass];
  }
  return [CHECK_BUCKET.fail];
};

const toCheckBucket = (node: Readonly<Record<string, unknown>>): readonly CheckBucket[] =>
  typeof node.state === "string" ? statusContextBucket(node.state) : checkRunBucket(node);

export const createGithubFetchReader = (access: {
  readonly repository: string;
  readonly token: string;
  readonly accessFor: (token: string) => GithubApiAccess;
}): GithubReader => {
  const [owner = "", spelled = ""] = access.repository.split("/");
  const clientFor = access.accessFor;

  const viewerLogin = async (token: string): Promise<string> => {
    try {
      return await clientFor(token).authenticatedLogin();
    } catch (requestFailure) {
      return rethrowClassified(requestFailure);
    }
  };

  const readPrivacy = async (token: string): Promise<boolean> => {
    try {
      return await clientFor(token).repositoryIsPrivate({ owner, repo: spelled });
    } catch (requestFailure) {
      return rethrowClassified(requestFailure);
    }
  };

  const graphql = async (asked: {
    readonly query: string;
    readonly variables: Readonly<Record<string, unknown>>;
  }): Promise<Readonly<Record<string, unknown>>> => {
    try {
      const responseData = await clientFor(access.token).graphql(asked.query, asked.variables);
      return asRecord(responseData) ?? {};
    } catch (queryFailure) {
      return rethrowClassified(queryFailure);
    }
  };

  return {
    resolveTokenLogin: (githubToken) => viewerLogin(githubToken),
    readRepositoryPrivacy: (githubToken) => readPrivacy(githubToken),
    listOpenPullRequests: async () => {
      const responseData = await graphql({
        query: PULL_SUMMARY_QUERY,
        variables: { owner, name: spelled },
      });
      const nodes = asRecord(asRecord(asRecord(responseData.repository)?.pullRequests))?.nodes;
      if (!Array.isArray(nodes)) return [];
      return nodes.flatMap((node) => {
        const pullNode = asRecord(node);
        return pullNode === undefined ? [] : [toPullSummary(pullNode)];
      });
    },
    resolvePullAuthor: async (prNumber) => {
      const responseData = await graphql({
        query: PULL_AUTHOR_QUERY,
        variables: { owner, name: spelled, number: prNumber },
      });
      const login = asRecord(
        asRecord(asRecord(responseData.repository)?.pullRequest)?.author,
      )?.login;
      return typeof login === "string" ? login : null;
    },
    listCheckBuckets: async (prNumber) => {
      const responseData = await graphql({
        query: CHECK_BUCKETS_QUERY,
        variables: { owner, name: spelled, number: prNumber },
      });
      const commitNodes = asRecord(
        asRecord(asRecord(asRecord(responseData.repository)?.pullRequest)?.commits),
      )?.nodes;
      const rollupNodes = Array.isArray(commitNodes)
        ? asRecord(
            asRecord(asRecord(asRecord(commitNodes[0])?.commit)?.statusCheckRollup)?.contexts,
          )?.nodes
        : undefined;
      if (!Array.isArray(rollupNodes)) return [];
      return rollupNodes.flatMap((node) => {
        const contextNode = asRecord(node);
        return contextNode === undefined ? [] : toCheckBucket(contextNode);
      });
    },
  };
};
