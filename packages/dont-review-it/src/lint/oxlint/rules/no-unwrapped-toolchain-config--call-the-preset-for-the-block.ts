import { createDontReviewItRule } from "../../../create-rule.ts";
import { collectBinding, isReferenceTo, newBinding } from "../lib/imported-binding.ts";
import { propertyKeyOf } from "../lib/object-literal.ts";

import type { ESTree } from "@oxlint/plugins";

const TOOLCHAIN_SPECIFIER = "vite-plus";

const CONFIG_FACTORY_NAME = "defineConfig";

const PRESET_SPECIFIER = "@mst/dont-review-it";

const PRESET_NAME = "dontReviewItPreset";

export const noUnwrappedToolchainConfig = createDontReviewItRule({
  name: "no-unwrapped-toolchain-config--call-the-preset-for-the-block",
  meta: {
    type: "problem",
    docs: {
      description:
        "Require the lint and fmt blocks of a Vite+ configuration to be what the matching `dontReviewItPreset` function returns, so the rule set, the formatting decisions, and what git is told to ignore all arrive without the caller restating them",
      relatedGuidelines: [],
    },
    messages: {
      unwrappedLint: `The \`lint\` block handed to Vite+'s \`defineConfig\` must not skip \`${PRESET_NAME}.lint\`. Wrap the block, keeping the additions where they are: \`lint: ${PRESET_NAME}.lint({ rules: { ... } })\`.`,
      unwrappedFmt: `The \`fmt\` block handed to Vite+'s \`defineConfig\` must not skip \`${PRESET_NAME}.fmt\`. Wrap the block: \`fmt: ${PRESET_NAME}.fmt()\`.`,
    },
    schema: [],
  },
  create(inspection) {
    const factory = { exportedName: CONFIG_FACTORY_NAME, binding: newBinding() };
    const preset = { exportedName: PRESET_NAME, binding: newBinding() };

    const callsPresetFor = (writtenBlock: ESTree.Node, block: string): boolean => {
      if (writtenBlock.type !== "CallExpression") return false;
      const called = writtenBlock.callee;
      if (called.type !== "MemberExpression" || called.computed) return false;
      if (called.property.type !== "Identifier" || called.property.name !== block) return false;
      return called.object.type !== "Super" && isReferenceTo(called.object, preset);
    };

    const reportUnwrapped = (property: ESTree.ObjectProperty): void => {
      const spelled = propertyKeyOf(property);
      if (spelled !== "lint" && spelled !== "fmt") return;
      if (callsPresetFor(property.value, spelled)) return;
      inspection.report({
        node: property,
        messageId: spelled === "lint" ? "unwrappedLint" : "unwrappedFmt",
      });
    };

    return {
      ImportDeclaration(node: ESTree.ImportDeclaration) {
        if (node.source.value === TOOLCHAIN_SPECIFIER) collectBinding(node, factory);
        if (node.source.value === PRESET_SPECIFIER) collectBinding(node, preset);
      },
      CallExpression(node: ESTree.CallExpression) {
        if (!isReferenceTo(node.callee, factory)) return;
        const [configuration] = node.arguments;
        if (configuration?.type !== "ObjectExpression") return;
        for (const property of configuration.properties) {
          if (property.type !== "Property") continue;
          reportUnwrapped(property);
        }
      },
    };
  },
});
