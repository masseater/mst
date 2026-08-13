import { attemptAsync } from "es-toolkit";
import { describe, expect, test, vi } from "vite-plus/test";

import { githubRequestFor } from "./github-request.ts";

describe("githubRequestFor", () => {
  describe("a token that was never given", () => {
    const it = test.extend("requestForAnAbsentToken", () => githubRequestFor(undefined));

    it("has no request to make without a token", ({ requestForAnAbsentToken }) => {
      expect(requestForAnAbsentToken).toBe(null);
    });
  });

  describe("a token that was given as an empty string", () => {
    const it = test.extend("requestForAnEmptyToken", () => githubRequestFor(""));

    it("has no request to make for an empty token", ({ requestForAnEmptyToken }) => {
      expect(requestForAnEmptyToken).toBe(null);
    });
  });

  describe("a compare the API answered", () => {
    const it = test.extend("decodedCompare", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        Response.json({ merge_base_commit: { sha: "basesha" } }),
      );
      return githubRequestFor("token")?.("/repos/owner/name/compare/a...b");
    });

    it("answers with the decoded body", ({ decodedCompare }) => {
      expect(decodedCompare).toStrictEqual({ merge_base_commit: { sha: "basesha" } });
    });
  });

  describe("the fetch behind a compare the API answered", () => {
    const it = test.extend("githubFetch", async () => {
      const fetched = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(Response.json({ merge_base_commit: { sha: "basesha" } }));
      await githubRequestFor("token")?.("/repos/owner/name/compare/a...b");
      return fetched;
    });

    it("asks the API for the path under the token", ({ githubFetch }) => {
      expect(githubFetch).toHaveBeenCalledExactlyOnceWith(
        "https://api.github.com/repos/owner/name/compare/a...b",
        {
          headers: {
            accept: "application/vnd.github+json",
            authorization: "Bearer token",
            "x-github-api-version": "2022-11-28",
          },
        },
      );
    });
  });

  describe("a failing answer from the API", () => {
    const it = test.extend("failureFromReadingAFailingAnswer", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("no", { status: 404 }));
      const [failure] = await attemptAsync<unknown, Error>(async () =>
        githubRequestFor("token")?.("/repos/owner/name/contents/absent.ts"),
      );
      return failure === null ? null : failure.message;
    });

    it("refuses to read past a failing answer", ({ failureFromReadingAFailingAnswer }) => {
      expect(failureFromReadingAFailingAnswer).toBe(
        "Do not read past a GitHub API failure: 404 on /repos/owner/name/contents/absent.ts.",
      );
    });
  });
});
