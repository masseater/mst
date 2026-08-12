import type { GitHubRequest } from "./github-comparison.ts";

const API_ORIGIN = "https://api.github.com";

export const githubRequestFor = (token: string | undefined): GitHubRequest | null =>
  token === undefined || token === ""
    ? null
    : async (path: string) => {
        const answered = await fetch(`${API_ORIGIN}${path}`, {
          headers: {
            accept: "application/vnd.github+json",
            authorization: `Bearer ${token}`,
            "x-github-api-version": "2022-11-28",
          },
        });
        if (!answered.ok) {
          throw new Error(`Do not read past a GitHub API failure: ${answered.status} on ${path}.`);
        }
        return answered.json();
      };
