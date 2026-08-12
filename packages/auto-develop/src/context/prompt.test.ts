import { describe, expect, test } from "vite-plus/test";

import { buildPrompt } from "./prompt.ts";

describe("buildPrompt", () => {
  test("claude reviewer はスラッシュ起動 + review 引数で始まる", () => {
    const prompt = buildPrompt({
      engine: "claude",
      mode: "reviewer",
      prNumber: 7,
      baseRef: "main",
      headRef: "topic/x",
      runContextJsonPath: "/work/run-context.json",
    });
    expect(prompt.split("\n")[0]).toStrictEqual("/auto-develop-review review");
  });

  test("codex はドル記号前置になる", () => {
    const prompt = buildPrompt({
      engine: "codex",
      mode: "reviewer",
      prNumber: 7,
      baseRef: "main",
      headRef: "topic/x",
      runContextJsonPath: "/work/run-context.json",
    });
    expect(prompt.split("\n")[0]).toStrictEqual("$auto-develop-review review");
  });

  test("author は引数なしの起動 + 理由行を持つ", () => {
    const prompt = buildPrompt({
      engine: "claude",
      mode: "author",
      prNumber: 7,
      baseRef: "main",
      headRef: "topic/x",
      runContextJsonPath: "/work/run-context.json",
      reason: "request_changes",
    });
    const lines = prompt.split("\n");
    expect([lines[0], lines.includes("Task: request_changes")]).toStrictEqual([
      "/auto-develop-fix",
      true,
    ]);
  });

  test("PR 番号・base・head・run context のパスを含む", () => {
    const prompt = buildPrompt({
      engine: "claude",
      mode: "reviewer",
      prNumber: 7,
      baseRef: "main",
      headRef: "topic/x",
      runContextJsonPath: "/work/run-context.json",
    });
    expect([
      prompt.includes("PR #7"),
      prompt.includes("(base: main, head: topic/x)"),
      prompt.includes("Run context: /work/run-context.json"),
    ]).toStrictEqual([true, true, true]);
  });

  test("diff やガイドラインは埋め込まない", () => {
    const prompt = buildPrompt({
      engine: "claude",
      mode: "reviewer",
      prNumber: 7,
      baseRef: "main",
      headRef: "topic/x",
      runContextJsonPath: "/work/run-context.json",
    });
    expect(prompt).toContain("not passed inline");
  });
});
