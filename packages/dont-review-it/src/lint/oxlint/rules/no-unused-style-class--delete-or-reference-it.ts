import { dirname, relative, resolve } from "node:path";

import { memoize } from "es-toolkit";

import { createDontReviewItRule } from "../../../create-rule.ts";
import { findWorkspaceRoot } from "../lib/canonical-values/workspace-root.ts";
import { toPosixPath } from "../lib/posix-path.ts";

import type { WorkspaceLintRule } from "@mst/lint-rule-authoring";
import type { ESTree } from "@oxlint/plugins";
import type { StyleClassIndexLoader } from "../lib/style-classes/class-index.ts";
import type { StyleClassSite } from "../lib/style-classes/stylesheet-classes.ts";

const spellClasses = (sites: readonly StyleClassSite[]): string =>
  sites.map((site) => `.${site.name} on line ${String(site.line)}`).join(", ");

export const createNoUnusedStyleClass = ({
  loadIndex,
}: {
  readonly loadIndex: StyleClassIndexLoader;
}): WorkspaceLintRule =>
  createDontReviewItRule({
    name: "no-unused-style-class--delete-or-reference-it",
    meta: {
      type: "problem",
      docs: {
        description:
          "Disallow a style sheet class that no script and no markup in the repository spells, so the style sheet keeps only the classes that reach the rendered page",
        relatedGuidelines: [],
      },
      messages: {
        unusedStyleClass:
          "An imported style sheet must not define a class that nothing in this repository spells. `{{styleSheet}}` defines {{classes}}. Delete each of them from the style sheet, or spell each in the markup that needs it.",
      },
      schema: [],
    },
    create(context) {
      const repositoryRootOf = memoize((): string => findWorkspaceRoot(context.cwd));

      return {
        ImportDeclaration(node: ESTree.ImportDeclaration) {
          const repositoryRoot = repositoryRootOf();
          const styleSheet = toPosixPath(
            relative(repositoryRoot, resolve(dirname(context.filename), node.source.value)),
          );
          const unused = loadIndex({ repositoryRoot }).unusedByStyleSheet.get(styleSheet);
          if (unused === undefined) return;

          context.report({
            node,
            messageId: "unusedStyleClass",
            data: { styleSheet, classes: spellClasses(unused) },
          });
        },
      };
    },
  });
