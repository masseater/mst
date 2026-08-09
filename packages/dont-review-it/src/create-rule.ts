import { createWorkspaceLintRule } from "@mst/lint-rule-authoring";

export const createDontReviewItRule = createWorkspaceLintRule({
  workspaceDir: "packages/dont-review-it",
});
