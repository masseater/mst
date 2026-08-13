import { oxlint as lintRuleAuthoringOxlint } from "@mst/lint-rule-authoring";
import { oxlint as verifiedSpecificationsOxlint } from "@mst/verified-specifications";

import { oxfmt } from "./oxfmt.ts";
import { oxlint } from "./oxlint.ts";
import { withGitExcludes } from "./with-git-excludes.ts";

import type { OxfmtConfig } from "oxfmt";
import type { OxlintConfig } from "oxlint";

/** @public */
export const dontReviewItPreset = {
  fmt: (config: OxfmtConfig = {}): OxfmtConfig => withGitExcludes({ ...oxfmt, ...config }),
  lint: (config: OxlintConfig = {}): OxlintConfig =>
    withGitExcludes({
      ...config,
      extends: [
        lintRuleAuthoringOxlint,
        oxlint,
        verifiedSpecificationsOxlint,
        ...(config.extends ?? []),
      ],
    }),
};
