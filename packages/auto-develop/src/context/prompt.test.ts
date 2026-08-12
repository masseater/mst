import { describe, expect, test } from "vite-plus/test";

import { buildPrompt } from "./prompt.ts";

const claudeReviewerPrompt = (): string =>
  buildPrompt({
    engine: "claude",
    mode: "reviewer",
    prNumber: 7,
    baseRef: "main",
    headRef: "topic/x",
    runContextJsonPath: "/work/run-context.json",
  });

const it = test
  .extend("reviewerPrompt", () => claudeReviewerPrompt())
  .extend("reviewerPromptLines", () => claudeReviewerPrompt().split("\n"))
  .extend("codexReviewerPromptLines", () =>
    buildPrompt({
      engine: "codex",
      mode: "reviewer",
      prNumber: 7,
      baseRef: "main",
      headRef: "topic/x",
      runContextJsonPath: "/work/run-context.json",
    }).split("\n"),
  )
  .extend("authorPromptLines", () =>
    buildPrompt({
      engine: "claude",
      mode: "author",
      prNumber: 7,
      baseRef: "main",
      headRef: "topic/x",
      runContextJsonPath: "/work/run-context.json",
      reason: "request_changes",
    }).split("\n"),
  );

describe("buildPrompt", () => {
  it("claude reviewer はスラッシュ起動 + review 引数で始まる", ({ reviewerPromptLines }) => {
    expect(reviewerPromptLines[0]).toStrictEqual("/auto-develop-review review");
  });

  it("codex はドル記号前置になる", ({ codexReviewerPromptLines }) => {
    expect(codexReviewerPromptLines[0]).toStrictEqual("$auto-develop-review review");
  });

  it("author は引数なしの起動になる", ({ authorPromptLines }) => {
    expect(authorPromptLines[0]).toStrictEqual("/auto-develop-fix");
  });

  it("author は理由行を持つ", ({ authorPromptLines }) => {
    expect(authorPromptLines).toContain("Task: request_changes");
  });

  it("PR 番号を含む", ({ reviewerPrompt }) => {
    expect(reviewerPrompt).toContain("PR #7");
  });

  it("base と head を含む", ({ reviewerPrompt }) => {
    expect(reviewerPrompt).toContain("(base: main, head: topic/x)");
  });

  it("run context のパスを含む", ({ reviewerPrompt }) => {
    expect(reviewerPrompt).toContain("Run context: /work/run-context.json");
  });

  it("diff やガイドラインは埋め込まない", ({ reviewerPrompt }) => {
    expect(reviewerPrompt).toContain("not passed inline");
  });
});
