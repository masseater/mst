import { noDetachedRationale } from "./lint/oxlint/rules/no-detached-rationale--comment-at-explained-line.ts";
import { noExplanatoryComment } from "./lint/oxlint/rules/no-explanatory-comment--delete-or-move-to-commit-message.ts";

import type { Plugin } from "@oxlint/plugins";

const plugin: Plugin = {
  meta: { name: "dont-review-it" },
  rules: {
    [noDetachedRationale.name]: noDetachedRationale,
    [noExplanatoryComment.name]: noExplanatoryComment,
  },
};

export default plugin;
