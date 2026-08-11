import { asRecord } from "../contract/unknown-record.ts";
import { GithubRejectionError } from "./github-rejection-error.ts";
import { GithubUnavailableError } from "./github-unavailable-error.ts";

import type { CheckBucket, GithubPullSummary, GithubReader } from "./github-reader.ts";

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
        labels(first: 100) { nodes { name } }
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

const isRateLimited = (response: Response): boolean =>
  response.headers.get("x-ratelimit-remaining") === "0";

const classifyStatus = (response: Response): never => {
  const transient =
    response.status >= 500 ||
    response.status === 408 ||
    response.status === 429 ||
    (response.status === 403 && isRateLimited(response));
  if (transient) {
    throw new GithubUnavailableError(`github responded with ${response.status}`);
  }
  throw new GithubRejectionError(`github rejected the request with ${response.status}`);
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

const statusContextBucket = (state: string): readonly CheckBucket[] => {
  if (state === "SUCCESS") return ["pass"];
  if (state === "PENDING" || state === "EXPECTED") return ["pending"];
  return ["fail"];
};

const checkRunBucket = (node: Readonly<Record<string, unknown>>): readonly CheckBucket[] => {
  if (node.status === "QUEUED" || node.status === "IN_PROGRESS" || node.status === "PENDING") {
    return ["pending"];
  }
  if (node.conclusion === "CANCELLED") return ["cancel"];
  if (node.conclusion === "SKIPPED") return ["skipping"];
  if (node.conclusion === "SUCCESS" || node.conclusion === "NEUTRAL") return ["pass"];
  return ["fail"];
};

const toCheckBucket = (node: Readonly<Record<string, unknown>>): readonly CheckBucket[] =>
  typeof node.state === "string" ? statusContextBucket(node.state) : checkRunBucket(node);

export const createGithubFetchReader = (access: {
  readonly apiOrigin: string;
  readonly repository: string;
  readonly token: string;
  readonly fetchImpl?: typeof fetch;
}): GithubReader => {
  const fetchImpl = access.fetchImpl ?? fetch;
  const [owner, name] = access.repository.split("/");

  const restGet = async (request: {
    readonly path: string;
    readonly token: string;
  }): Promise<Readonly<Record<string, unknown>>> => {
    const response = await fetchImpl(new URL(request.path, access.apiOrigin), {
      headers: { accept: "application/vnd.github+json", authorization: `Bearer ${request.token}` },
    });
    if (!response.ok) classifyStatus(response);
    return asRecord(await response.json()) ?? {};
  };

  const graphql = async (request: {
    readonly query: string;
    readonly variables: Readonly<Record<string, unknown>>;
  }): Promise<Readonly<Record<string, unknown>>> => {
    const response = await fetchImpl(new URL("/graphql", access.apiOrigin), {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${access.token}` },
      body: JSON.stringify({ query: request.query, variables: request.variables }),
    });
    if (!response.ok) classifyStatus(response);
    return asRecord(asRecord(await response.json())?.data) ?? {};
  };

  return {
    resolveTokenLogin: async (githubToken) => {
      const viewer = await restGet({ path: "/user", token: githubToken });
      if (typeof viewer.login !== "string") {
        throw new GithubRejectionError("github user response has no login");
      }
      return viewer.login;
    },
    readRepositoryPrivacy: async (githubToken) => {
      const repository = await restGet({ path: `/repos/${access.repository}`, token: githubToken });
      return repository.private === true;
    },
    listOpenPullRequests: async () => {
      const responseData = await graphql({
        query: PULL_SUMMARY_QUERY,
        variables: { owner, name },
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
        variables: { owner, name, number: prNumber },
      });
      const login = asRecord(
        asRecord(asRecord(responseData.repository)?.pullRequest)?.author,
      )?.login;
      return typeof login === "string" ? login : null;
    },
    listCheckBuckets: async (prNumber) => {
      const responseData = await graphql({
        query: CHECK_BUCKETS_QUERY,
        variables: { owner, name, number: prNumber },
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
