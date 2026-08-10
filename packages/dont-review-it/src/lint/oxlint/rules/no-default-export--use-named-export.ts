import { basename } from "node:path";

import { createDontReviewItRule } from "../../../create-rule.ts";

import type { ESTree } from "@oxlint/plugins";

const TOOL_REQUIRED_DEFAULT_EXPORT_FILES = new Set(["plugin.ts", "vite.config.ts"]);

export const noDefaultExport = createDontReviewItRule({
  name: "no-default-export--use-named-export",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow default exports, so a symbol keeps the name it was defined under all the way to the places that call it",
      relatedGuidelines: [],
    },
    messages: {
      defaultExport:
        "A default export must not leave the exported value unnamed at the module boundary, because each importing file is free to invent its own name for it and the same thing ends up called something different in every place it is used. Give the value a name and export that name, then import it under the name it was defined with.",
    },
    schema: [],
  },
  create(context) {
    if (TOOL_REQUIRED_DEFAULT_EXPORT_FILES.has(basename(context.filename))) return {};

    return {
      ExportDefaultDeclaration(node: ESTree.ExportDefaultDeclaration) {
        context.report({ node, messageId: "defaultExport" });
      },
    };
  },
});
