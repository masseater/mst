import { createDontReviewItRule } from "../../../create-rule.ts";
import { extendsOneOf, nearestTsconfigExtends } from "../lib/nearest-tsconfig.ts";

import type { ESTree } from "@oxlint/plugins";

const allowedSuffixesOf = (options: readonly unknown[]): readonly string[] =>
  options.length === 0 ? [] : (options[0] as readonly string[]);

export const noStandaloneTsconfig = createDontReviewItRule({
  name: "no-standalone-tsconfig--extend-shared-preset",
  meta: {
    type: "problem",
    docs: {
      description:
        "Require the tsconfig.json that governs a file to extend one of the shared presets, so compiler options are decided in one place instead of being copied into every workspace",
      relatedGuidelines: [],
    },
    messages: {
      standaloneTsconfig:
        "The tsconfig.json that governs this file must not decide compiler options on its own. `{{tsconfigPath}}` extends none of {{allowedSuffixes}}. Replace its compilerOptions with an `extends` naming the preset that matches how the workspace runs, and keep only what is particular to the workspace, such as `include`.",
    },
    schema: [
      {
        type: "array",
        items: { type: "string" },
      },
    ],
  },
  create(context) {
    const allowedSuffixes = allowedSuffixesOf(context.options);
    if (allowedSuffixes.length === 0) return {};

    return {
      Program(node: ESTree.Program) {
        const nearest = nearestTsconfigExtends(context.filename);
        if (nearest === null) return;
        if (extendsOneOf(nearest.specifiers, allowedSuffixes)) return;

        context.report({
          node,
          messageId: "standaloneTsconfig",
          data: {
            tsconfigPath: nearest.tsconfigPath,
            allowedSuffixes: allowedSuffixes.map((suffix) => `\`${suffix}\``).join(" or "),
          },
        });
      },
    };
  },
});
