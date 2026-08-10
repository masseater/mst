import { basename } from "node:path";

import { createDontReviewItRule } from "../../../create-rule.ts";

import type { ESTree } from "@oxlint/plugins";

const PUBLIC_SURFACE_FILE_NAME = "index.ts";

type TopLevelNode = ESTree.Program["body"][number];

const isReExport = (node: TopLevelNode): boolean =>
  node.type === "ExportAllDeclaration" ||
  (node.type === "ExportNamedDeclaration" && node.source !== null);

const isForwardingWithoutSource = (node: TopLevelNode): boolean =>
  node.type === "ImportDeclaration" ||
  (node.type === "ExportNamedDeclaration" && node.declaration === null);

export const requireReExportOnlyFiles = createDontReviewItRule({
  name: "require-re-export-only-files--move-declaration-to-owning-module",
  meta: {
    type: "problem",
    docs: {
      description:
        "Require a file named index.ts to carry re-exports only, so every declaration keeps a file name that says which module owns it",
      relatedGuidelines: [],
    },
    messages: {
      declarationInPublicSurface:
        'An `index.ts` must carry nothing but re-exports, because a declaration placed on the public surface has no file name left that says which module owns it. Move this statement into the module that owns what it declares, and re-export it from here with `export ... from "..."`.',
      forwardingWithoutSource:
        'An `index.ts` must not carry an import, or an export that leaves out the module it comes from, because the source then has to be recovered from a second statement to know what this surface exposes. State the module in the export itself as `export ... from "..."`; if the statement exposes nothing, move it into the module that needs it.',
    },
    schema: [],
  },
  create(context) {
    return {
      Program(node: ESTree.Program) {
        if (basename(context.filename) !== PUBLIC_SURFACE_FILE_NAME) return;

        for (const statement of node.body) {
          if (isReExport(statement)) continue;
          context.report({
            node: statement,
            messageId: isForwardingWithoutSource(statement)
              ? "forwardingWithoutSource"
              : "declarationInPublicSurface",
          });
        }
      },
    };
  },
});
