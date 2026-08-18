import { basename } from "node:path";

import { createDontReviewItRule } from "../../../../create-rule.ts";

import type { ESTree, Options } from "@oxlint/plugins";

const DEFAULT_EXPORT_NAME = "default";

const exportedNameOf = (exported: ESTree.ModuleExportName): string =>
  exported.type === "Literal" ? exported.value : exported.name;

const toolRequiredFileNamesFrom = (ruleOptions: Readonly<Options>): readonly string[] => {
  const [first] = ruleOptions;
  if (typeof first !== "object" || first === null || Array.isArray(first)) return [];

  const { toolRequiredFileNames } = first;
  if (!Array.isArray(toolRequiredFileNames)) return [];
  return toolRequiredFileNames.filter(
    (candidate): candidate is string => typeof candidate === "string",
  );
};

export const noDefaultExport = createDontReviewItRule({
  name: "no-default-export--use-named-export",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow every export whose outward name is `default`, so a symbol keeps the name it was defined under all the way to the places that call it",
      relatedGuidelines: ["docs/guidelines/writing-code.md"],
    },
    messages: {
      defaultExport:
        "A module must not put a value out under the name `default`. Name the value and export the name: `export const parseConfig = ...` or `export function parseConfig() {}`.",
      defaultAliasReExport:
        'A re-export must not rename what it forwards to `default`. Forward the name the owning module already gave it: `export { parseConfig } from "./parse-config.ts"`.',
      namespaceDefaultReExport:
        'A namespace re-export must not be bound to the name `default`. Give the namespace a name here: `export * as parseConfig from "./parse-config.ts"`.',
      exportAssignment:
        "An export assignment must not stand in for a named export. Export the value under the name it was declared with: `export { parseConfig }`.",
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
  create(inspection) {
    const isToolRequiredEntry = toolRequiredFileNamesFrom(inspection.options).includes(
      basename(inspection.filename),
    );

    return {
      ExportDefaultDeclaration(node: ESTree.ExportDefaultDeclaration) {
        if (isToolRequiredEntry) return;
        inspection.report({ node, messageId: "defaultExport" });
      },
      ExportNamedDeclaration(node: ESTree.ExportNamedDeclaration) {
        for (const specifier of node.specifiers) {
          if (exportedNameOf(specifier.exported) !== DEFAULT_EXPORT_NAME) continue;
          inspection.report({ node: specifier, messageId: "defaultAliasReExport" });
        }
      },
      ExportAllDeclaration(node: ESTree.ExportAllDeclaration) {
        if (node.exported === null) return;
        if (exportedNameOf(node.exported) !== DEFAULT_EXPORT_NAME) return;
        inspection.report({ node, messageId: "namespaceDefaultReExport" });
      },
      TSExportAssignment(node: ESTree.TSExportAssignment) {
        inspection.report({ node, messageId: "exportAssignment" });
      },
    };
  },
});
