import { createDontReviewItRule } from "../../../create-rule.ts";

import type { ESTree } from "@oxlint/plugins";

const TOOLCHAIN_SPECIFIER = "vite-plus";

const CONFIG_FACTORY_NAME = "defineConfig";

const WRAPPER_SPECIFIER = "@mst/dont-review-it";

const WRAPPER_NAME = "withGitExcludes";

type ImportedBinding = {
  readonly directNames: Set<string>;
  readonly namespaceNames: Set<string>;
};

const newBinding = (): ImportedBinding => ({
  directNames: new Set<string>(),
  namespaceNames: new Set<string>(),
});

const importedNameOf = (specifier: ESTree.ImportSpecifier): string =>
  specifier.imported.type === "Literal" ? specifier.imported.value : specifier.imported.name;

const collectBinding = (
  node: ESTree.ImportDeclaration,
  target: { readonly exportedName: string; readonly binding: ImportedBinding },
): void => {
  for (const specifier of node.specifiers) {
    if (specifier.type === "ImportNamespaceSpecifier") {
      target.binding.namespaceNames.add(specifier.local.name);
      continue;
    }
    if (specifier.type !== "ImportSpecifier") continue;
    if (importedNameOf(specifier) !== target.exportedName) continue;
    target.binding.directNames.add(specifier.local.name);
  }
};

const isCallOf = (
  callee: ESTree.Expression,
  target: { readonly exportedName: string; readonly binding: ImportedBinding },
): boolean => {
  if (callee.type === "Identifier") return target.binding.directNames.has(callee.name);
  if (callee.type !== "MemberExpression" || callee.computed) return false;
  if (callee.object.type !== "Identifier" || callee.property.type !== "Identifier") return false;
  return (
    target.binding.namespaceNames.has(callee.object.name) &&
    callee.property.name === target.exportedName
  );
};

const propertyNameOf = (property: ESTree.ObjectProperty): string | null => {
  if (property.computed) return null;
  if (property.key.type === "Identifier") return property.key.name;
  if (property.key.type === "Literal") return String(property.key.value);
  return null;
};

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
      unwrappedLint: `The \`lint\` block handed to Vite+'s \`defineConfig\` must be the result of \`${WRAPPER_NAME}\`, because oxlint keeps only the \`ignorePatterns\` written on the configuration that does the extending and drops the ones carried by every configuration named in \`extends\`. A preset therefore cannot deliver them, and without the wrapper nothing tells the linter about the machine-wide excludes file that \`core.excludesFile\` points at: scratch directories that git has been told to ignore are linted anyway. Wrap the block, keeping the preset where it is: \`lint: ${WRAPPER_NAME}({ extends: [dontReviewIt.oxlint], ... })\`.`,
      unwrappedFmt: `The \`fmt\` block handed to Vite+'s \`defineConfig\` must be the result of \`${WRAPPER_NAME}\`, because oxfmt reads ignore patterns only from the block itself and, like oxlint, walks past the machine-wide excludes file that \`core.excludesFile\` points at. Without the wrapper the formatter rewrites files inside scratch directories that git has been told to ignore. Wrap the block: \`fmt: ${WRAPPER_NAME}({})\`.`,
    },
    schema: [],
  },
  create(context) {
    const factory = { exportedName: CONFIG_FACTORY_NAME, binding: newBinding() };
    const wrapper = { exportedName: WRAPPER_NAME, binding: newBinding() };

    const reportUnwrapped = (property: ESTree.ObjectProperty): void => {
      const name = propertyNameOf(property);
      if (name !== "lint" && name !== "fmt") return;
      if (property.value.type === "CallExpression" && isCallOf(property.value.callee, wrapper)) {
        return;
      }
      context.report({
        node: property,
        messageId: name === "lint" ? "unwrappedLint" : "unwrappedFmt",
      });
    };

    return {
      ImportDeclaration(node: ESTree.ImportDeclaration) {
        if (node.source.value === TOOLCHAIN_SPECIFIER) collectBinding(node, factory);
        if (node.source.value === WRAPPER_SPECIFIER) collectBinding(node, wrapper);
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
