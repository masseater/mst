import { oxlint as lintRuleAuthoringOxlint } from "@mst/lint-rule-authoring";

import { oxfmt } from "./oxfmt.ts";
import { oxlintFor } from "./oxlint.ts";
import { withGitExcludes } from "./with-git-excludes.ts";

import type { OxfmtConfig } from "oxfmt";
import type { OxlintConfig } from "oxlint";
import type { LintBundleSelection } from "./bundles/bundle-names.ts";

/** @public */
export type DontReviewItLintConfig = OxlintConfig & {
  readonly bundles: LintBundleSelection;
};

/** @public */
export const dontReviewItPreset = {
  fmt: (config: OxfmtConfig = {}): OxfmtConfig => withGitExcludes({ ...oxfmt, ...config }),
  lint: ({ bundles, ...config }: DontReviewItLintConfig): OxlintConfig =>
    withGitExcludes({
      ...config,
      extends: [lintRuleAuthoringOxlint, oxlintFor(bundles), ...(config.extends ?? [])],
    }),
};
