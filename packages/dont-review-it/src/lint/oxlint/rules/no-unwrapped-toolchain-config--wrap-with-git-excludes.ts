import { createDontReviewItRule } from "../../../create-rule.ts";
import { collectBinding, isCallOf, newBinding } from "../lib/imported-binding.ts";
import { propertyKeyOf } from "../lib/object-literal.ts";

import type { ESTree } from "@oxlint/plugins";

const TOOLCHAIN_SPECIFIER = "vite-plus";

const CONFIG_FACTORY_NAME = "defineConfig";

const WRAPPER_SPECIFIER = "@mst/dont-review-it";

const WRAPPER_NAME = "withGitExcludes";

export const noUnwrappedToolchainConfig = createDontReviewItRule({
  name: "no-unwrapped-toolchain-config--wrap-with-git-excludes",
  meta: {
    type: "problem",
    docs: {
      description:
        "Require the lint and fmt blocks of a Vite+ configuration to pass through `withGitExcludes`, so what git is told to ignore stays out of what the linter and the formatter walk",
      relatedGuidelines: [],
    },
    messages: {
      unwrappedLint: `The \`lint\` block handed to Vite+'s \`defineConfig\` must not skip \`${WRAPPER_NAME}\`. Wrap the block, keeping the preset where it is: \`lint: ${WRAPPER_NAME}({ extends: [dontReviewIt.oxlint], ... })\`.`,
      unwrappedFmt: `The \`fmt\` block handed to Vite+'s \`defineConfig\` must not skip \`${WRAPPER_NAME}\`. Wrap the block: \`fmt: ${WRAPPER_NAME}({})\`.`,
    },
    schema: [],
  },
  create(inspection) {
    const factory = { exportedName: CONFIG_FACTORY_NAME, binding: newBinding() };
    const wrapping = { exportedName: WRAPPER_NAME, binding: newBinding() };

    const reportUnwrapped = (property: ESTree.ObjectProperty): void => {
      const spelled = propertyKeyOf(property);
      if (spelled !== "lint" && spelled !== "fmt") return;
      if (property.value.type === "CallExpression" && isCallOf(property.value.callee, wrapping)) {
        return;
      }
      inspection.report({
        node: property,
        messageId: spelled === "lint" ? "unwrappedLint" : "unwrappedFmt",
      });
    };

    return {
      ImportDeclaration(node: ESTree.ImportDeclaration) {
        if (node.source.value === TOOLCHAIN_SPECIFIER) collectBinding(node, factory);
        if (node.source.value === WRAPPER_SPECIFIER) collectBinding(node, wrapping);
      },
      CallExpression(node: ESTree.CallExpression) {
        if (!isCallOf(node.callee, factory)) return;
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
