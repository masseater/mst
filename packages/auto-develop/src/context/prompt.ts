import { CLAUDE_ENGINE, type EngineKind } from "../config/engine.ts";

import type { Mode } from "./run-context.ts";

const SKILL_NAMES: Readonly<Record<Mode, string>> = {
  reviewer: "auto-develop-review",
  author: "auto-develop-fix",
};

const skillInvocation = (invoke: { readonly engine: EngineKind; readonly mode: Mode }): string => {
  const prefix = invoke.engine === CLAUDE_ENGINE ? "/" : "$";
  const skill = `${prefix}${SKILL_NAMES[invoke.mode]}`;
  return invoke.mode === "reviewer" ? `${skill} review` : skill;
};

const NON_INTERACTIVE_INSTRUCTION =
  "Do not ask the user for confirmation, approval, prioritization, or extra instructions. Complete the workflow from the repository, GitHub, and CI context, or report the failure result the skill defines.";

const REVIEWER_CLOSING =
  "You are already checked out on the PR branch in this worktree. Review the target PR and comment. Use the run context when it is valid; regenerate it with the reviewer CLI subcommand only when it is missing or invalid. The diff and guidelines are not passed inline. Launch the per-review subagents, decide the verdict, and submit the GitHub review as the skill defines.";

const AUTHOR_CLOSING =
  "You are already checked out on the PR branch. Use the run context when it is valid; regenerate it with the author CLI subcommand only when it is missing or invalid. Address every review comment, review-summary item, CI failure, base update, and merge conflict, commit and push, and reply on the target PR. The diff is not passed inline.";

export const buildPrompt = (build: {
  readonly engine: EngineKind;
  readonly mode: Mode;
  readonly prNumber: number;
  readonly baseRef: string;
  readonly headRef: string;
  readonly runContextJsonPath: string;
  readonly reason?: string;
}): string => {
  const lines = [
    skillInvocation({ engine: build.engine, mode: build.mode }),
    "",
    `PR #${build.prNumber}`,
    `(base: ${build.baseRef}, head: ${build.headRef})`,
    ...(build.reason === undefined ? [] : [`Task: ${build.reason}`]),
    `Run context: ${build.runContextJsonPath}`,
    "",
    NON_INTERACTIVE_INSTRUCTION,
    "",
    build.mode === "reviewer" ? REVIEWER_CLOSING : AUTHOR_CLOSING,
  ];
  return lines.join("\n");
};
