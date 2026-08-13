import { describe, expect, test } from "vite-plus/test";

import { buildPrompt } from "./prompt.ts";

describe("buildPrompt", () => {
  describe("claude の reviewer 起動", () => {
    const it = test.extend("claudeReviewerPrompt", () =>
      buildPrompt({
        engine: "claude",
        mode: "reviewer",
        prNumber: 7,
        baseRef: "main",
        headRef: "topic/x",
        runContextJsonPath: "/work/run-context.json",
      }));

    it("スラッシュ起動と review 引数で始まる", ({ claudeReviewerPrompt }) => {
      expect(claudeReviewerPrompt).toBe(
        `/auto-develop-review review

PR #7
(base: main, head: topic/x)
Run context: /work/run-context.json

Do not ask the user for confirmation, approval, prioritization, or extra instructions. Complete the workflow from the repository, GitHub, and CI context, or report the failure result the skill defines.

You are already checked out on the PR branch in this worktree. Review the target PR and comment. Use the run context when it is valid; regenerate it with the reviewer CLI subcommand only when it is missing or invalid. The diff and guidelines are not passed inline. Launch the per-review subagents, decide the verdict, and submit the GitHub review as the skill defines.`,
      );
    });
  });

  describe("codex の reviewer 起動", () => {
    const it = test.extend("codexReviewerPrompt", () =>
      buildPrompt({
        engine: "codex",
        mode: "reviewer",
        prNumber: 7,
        baseRef: "main",
        headRef: "topic/x",
        runContextJsonPath: "/work/run-context.json",
      }));

    it("ドル記号前置の起動になる", ({ codexReviewerPrompt }) => {
      expect(codexReviewerPrompt).toBe(
        `$auto-develop-review review

PR #7
(base: main, head: topic/x)
Run context: /work/run-context.json

Do not ask the user for confirmation, approval, prioritization, or extra instructions. Complete the workflow from the repository, GitHub, and CI context, or report the failure result the skill defines.

You are already checked out on the PR branch in this worktree. Review the target PR and comment. Use the run context when it is valid; regenerate it with the reviewer CLI subcommand only when it is missing or invalid. The diff and guidelines are not passed inline. Launch the per-review subagents, decide the verdict, and submit the GitHub review as the skill defines.`,
      );
    });
  });

  describe("理由を伴わない author 起動", () => {
    const it = test.extend("authorPromptWithoutReason", () =>
      buildPrompt({
        engine: "claude",
        mode: "author",
        prNumber: 7,
        baseRef: "main",
        headRef: "topic/x",
        runContextJsonPath: "/work/run-context.json",
      }));

    it("引数なしの起動で始まり理由行を持たない", ({ authorPromptWithoutReason }) => {
      expect(authorPromptWithoutReason).toBe(
        `/auto-develop-fix

PR #7
(base: main, head: topic/x)
Run context: /work/run-context.json

Do not ask the user for confirmation, approval, prioritization, or extra instructions. Complete the workflow from the repository, GitHub, and CI context, or report the failure result the skill defines.

You are already checked out on the PR branch. Use the run context when it is valid; regenerate it with the author CLI subcommand only when it is missing or invalid. Address every review comment, review-summary item, CI failure, base update, and merge conflict, commit and push, and reply on the target PR. The diff is not passed inline.`,
      );
    });
  });

  describe("理由を伴う author 起動", () => {
    const it = test.extend("authorPromptWithChangeRequest", () =>
      buildPrompt({
        engine: "claude",
        mode: "author",
        prNumber: 7,
        baseRef: "main",
        headRef: "topic/x",
        runContextJsonPath: "/work/run-context.json",
        reason: "request_changes",
      }));

    it("参照の後ろに理由行が入る", ({ authorPromptWithChangeRequest }) => {
      expect(authorPromptWithChangeRequest).toBe(
        `/auto-develop-fix

PR #7
(base: main, head: topic/x)
Task: request_changes
Run context: /work/run-context.json

Do not ask the user for confirmation, approval, prioritization, or extra instructions. Complete the workflow from the repository, GitHub, and CI context, or report the failure result the skill defines.

You are already checked out on the PR branch. Use the run context when it is valid; regenerate it with the author CLI subcommand only when it is missing or invalid. Address every review comment, review-summary item, CI failure, base update, and merge conflict, commit and push, and reply on the target PR. The diff is not passed inline.`,
      );
    });
  });

  describe("別の PR 番号を渡した reviewer 起動", () => {
    const it = test.extend("promptForPullRequest4321", () =>
      buildPrompt({
        engine: "claude",
        mode: "reviewer",
        prNumber: 4321,
        baseRef: "main",
        headRef: "topic/x",
        runContextJsonPath: "/work/run-context.json",
      }));

    it("渡した PR 番号が本文に現れる", ({ promptForPullRequest4321 }) => {
      expect(promptForPullRequest4321).toBe(
        `/auto-develop-review review

PR #4321
(base: main, head: topic/x)
Run context: /work/run-context.json

Do not ask the user for confirmation, approval, prioritization, or extra instructions. Complete the workflow from the repository, GitHub, and CI context, or report the failure result the skill defines.

You are already checked out on the PR branch in this worktree. Review the target PR and comment. Use the run context when it is valid; regenerate it with the reviewer CLI subcommand only when it is missing or invalid. The diff and guidelines are not passed inline. Launch the per-review subagents, decide the verdict, and submit the GitHub review as the skill defines.`,
      );
    });
  });

  describe("別の base と head を渡した reviewer 起動", () => {
    const it = test.extend("promptForReleaseBranchPair", () =>
      buildPrompt({
        engine: "claude",
        mode: "reviewer",
        prNumber: 7,
        baseRef: "release/2026-08",
        headRef: "topic/y",
        runContextJsonPath: "/work/run-context.json",
      }));

    it("渡した base と head が本文に現れる", ({ promptForReleaseBranchPair }) => {
      expect(promptForReleaseBranchPair).toBe(
        `/auto-develop-review review

PR #7
(base: release/2026-08, head: topic/y)
Run context: /work/run-context.json

Do not ask the user for confirmation, approval, prioritization, or extra instructions. Complete the workflow from the repository, GitHub, and CI context, or report the failure result the skill defines.

You are already checked out on the PR branch in this worktree. Review the target PR and comment. Use the run context when it is valid; regenerate it with the reviewer CLI subcommand only when it is missing or invalid. The diff and guidelines are not passed inline. Launch the per-review subagents, decide the verdict, and submit the GitHub review as the skill defines.`,
      );
    });
  });

  describe("別の run context のパスを渡した reviewer 起動", () => {
    const it = test.extend("promptForNestedRunContextPath", () =>
      buildPrompt({
        engine: "claude",
        mode: "reviewer",
        prNumber: 7,
        baseRef: "main",
        headRef: "topic/x",
        runContextJsonPath: "/work/nested/other-run-context.json",
      }));

    it("渡した run context のパスが本文に現れる", ({ promptForNestedRunContextPath }) => {
      expect(promptForNestedRunContextPath).toBe(
        `/auto-develop-review review

PR #7
(base: main, head: topic/x)
Run context: /work/nested/other-run-context.json

Do not ask the user for confirmation, approval, prioritization, or extra instructions. Complete the workflow from the repository, GitHub, and CI context, or report the failure result the skill defines.

You are already checked out on the PR branch in this worktree. Review the target PR and comment. Use the run context when it is valid; regenerate it with the reviewer CLI subcommand only when it is missing or invalid. The diff and guidelines are not passed inline. Launch the per-review subagents, decide the verdict, and submit the GitHub review as the skill defines.`,
      );
    });
  });

  describe("codex の author 起動", () => {
    const it = test.extend("codexAuthorPrompt", () =>
      buildPrompt({
        engine: "codex",
        mode: "author",
        prNumber: 7,
        baseRef: "main",
        headRef: "topic/x",
        runContextJsonPath: "/work/run-context.json",
        reason: "ci_failure",
      }));

    it("diff を埋め込まない旨だけを添えて終わる", ({ codexAuthorPrompt }) => {
      expect(codexAuthorPrompt).toBe(
        `$auto-develop-fix

PR #7
(base: main, head: topic/x)
Task: ci_failure
Run context: /work/run-context.json

Do not ask the user for confirmation, approval, prioritization, or extra instructions. Complete the workflow from the repository, GitHub, and CI context, or report the failure result the skill defines.

You are already checked out on the PR branch. Use the run context when it is valid; regenerate it with the author CLI subcommand only when it is missing or invalid. Address every review comment, review-summary item, CI failure, base update, and merge conflict, commit and push, and reply on the target PR. The diff is not passed inline.`,
      );
    });
  });
});
