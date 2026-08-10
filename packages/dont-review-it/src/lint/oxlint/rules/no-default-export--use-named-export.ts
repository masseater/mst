import { basename } from "node:path";

import { createDontReviewItRule } from "../../../create-rule.ts";

import type { ESTree, Options } from "@oxlint/plugins";

const DEFAULT_EXPORT_NAME = "default";

const exportedNameOf = (exported: ESTree.ModuleExportName): string =>
  exported.type === "Literal" ? exported.value : exported.name;

const toolRequiredFileNamesFrom = (options: Readonly<Options>): readonly string[] => {
  const [first] = options;
  if (typeof first !== "object" || first === null || Array.isArray(first)) return [];

  const { toolRequiredFileNames } = first;
  if (!Array.isArray(toolRequiredFileNames)) return [];
  return toolRequiredFileNames.filter((entry): entry is string => typeof entry === "string");
};

export const noDefaultExport = createDontReviewItRule({
  name: "no-default-export--use-named-export",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow every export whose outward name is `default`, so a symbol keeps the name it was defined under all the way to the places that call it",
      relatedGuidelines: [],
    },
    messages: {
      defaultExport:
        "A module must not put a value out under the name `default`, because the name at the module boundary is then left for each importing file to invent, and the same value ends up called something different in every place it is read. Name the value and export the name: `export const parseConfig = ...` or `export function parseConfig() {}`.",
      defaultAliasReExport:
        'A re-export must not rename what it forwards to `default`, because the name at the module boundary is then left for each importing file to invent, and the name the owning module chose stops travelling with the value. Forward the name the owning module already gave it: `export { parseConfig } from "./parse-config.ts"`.',
      namespaceDefaultReExport:
        'A namespace re-export must not be bound to the name `default`, because the name at the module boundary is then left for each importing file to invent. A namespace has no name of its own to forward, so give it one here: `export * as parseConfig from "./parse-config.ts"`.',
      exportAssignment:
        "An export assignment must not stand in for a named export, because it hands the whole module out under no name at all and every importing file writes its own, exactly as `default` does. Export the value under the name it was declared with: `export { parseConfig }`.",
    },
    schema: [
      {
        type: "object",
        properties: {
          toolRequiredFileNames: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const isToolRequiredEntry = toolRequiredFileNamesFrom(context.options).includes(
      basename(context.filename),
    );

    return {
      ExportDefaultDeclaration(node: ESTree.ExportDefaultDeclaration) {
        if (isToolRequiredEntry) return;
        context.report({ node, messageId: "defaultExport" });
      },
      ExportNamedDeclaration(node: ESTree.ExportNamedDeclaration) {
        for (const specifier of node.specifiers) {
          if (exportedNameOf(specifier.exported) !== DEFAULT_EXPORT_NAME) continue;
          context.report({ node: specifier, messageId: "defaultAliasReExport" });
        }
      },
      ExportAllDeclaration(node: ESTree.ExportAllDeclaration) {
        if (node.exported === null) return;
        if (exportedNameOf(node.exported) !== DEFAULT_EXPORT_NAME) return;
        context.report({ node, messageId: "namespaceDefaultReExport" });
      },
      TSExportAssignment(node: ESTree.TSExportAssignment) {
        context.report({ node, messageId: "exportAssignment" });
      },
    };
  },
});
