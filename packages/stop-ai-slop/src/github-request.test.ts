import { describe, expect, it, vi } from "vite-plus/test";

import { githubRequestFor } from "./github-request.ts";

describe("githubRequestFor", () => {
  it("has no request to make without a token", () => {
    expect(githubRequestFor(undefined)).toBeNull();
    expect(githubRequestFor("")).toBeNull();
  });

  it("asks the API with the token and answers with the decoded body", async () => {
    const answered = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(Response.json({ merge_base_commit: { sha: "basesha" } }));

    await expect(
      githubRequestFor("token")?.("/repos/owner/name/compare/a...b"),
    ).resolves.toStrictEqual({
      merge_base_commit: { sha: "basesha" },
    });
    expect(answered).toHaveBeenCalledWith("https://api.github.com/repos/owner/name/compare/a...b", {
      headers: {
        accept: "application/vnd.github+json",
        authorization: "Bearer token",
        "x-github-api-version": "2022-11-28",
      },
    });

    answered.mockRestore();
  });

  it("refuses to read past a failing answer", async () => {
    const answered = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("no", { status: 404 }));

    await expect(
      githubRequestFor("token")?.("/repos/owner/name/contents/absent.ts"),
    ).rejects.toThrow("404 on /repos/owner/name/contents/absent.ts");

    answered.mockRestore();
  });
});
