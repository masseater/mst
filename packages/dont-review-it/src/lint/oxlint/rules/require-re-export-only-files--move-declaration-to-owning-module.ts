import { resolve, sep } from "node:path";

import { createDontReviewItRule } from "../../../create-rule.ts";
import { matchesGlobPath } from "../lib/glob-path-match.ts";
import { segmentsOf } from "../lib/path-segments.ts";

import type { ESTree, Options } from "@oxlint/plugins";

const isDirectReExport = (node: ESTree.Program["body"][number]): boolean =>
  node.type === "ExportAllDeclaration" ||
  (node.type === "ExportNamedDeclaration" && node.source !== null);

const patternsFrom = (
  ruleOptions: Readonly<Options>,
  named: "targets" | "exclude",
): readonly string[] => {
  const [first] = ruleOptions;
  if (typeof first !== "object" || first === null || Array.isArray(first)) return [];
  const patterns = first[named];
  if (!Array.isArray(patterns)) return [];
  return patterns.filter((candidate): candidate is string => typeof candidate === "string");
};

export const requireReExportOnlyFiles = createDontReviewItRule({
  name: "require-re-export-only-files--move-declaration-to-owning-module",
  meta: {
    type: "problem",
    docs: {
      description:
        "Require the files the deployment lists as re-export only to carry re-exports and nothing else, so the surface a module presents can be read off that file without opening what it forwards",
      relatedGuidelines: [],
    },
    messages: {
      extraStatement:
        'A file the deployment lists as re-export only must not carry a statement that is not a re-export. Move what this statement brings in or declares into the module that should own it, and re-export it from here with `export { ... } from "..."`, `export * from "..."` or `export * as Name from "..."`.',
      missingReExport:
        'A file the deployment lists as re-export only must not carry zero re-exports. Re-export from here what the modules beside this file own, with `export { ... } from "..."`, `export * from "..."` or `export * as Name from "..."`.',
    },
    schema: [
      {
        type: "object",
        properties: {
          targets: { type: "array", items: { type: "string" }, minItems: 1 },
          exclude: { type: "array", items: { type: "string" } },
        },
        required: ["targets"],
        additionalProperties: false,
      },
    ],
  },
  create(inspection) {
    const checkedTargets = patternsFrom(inspection.options, "targets");
    if (checkedTargets.length === 0) return {};

    const exclude = patternsFrom(inspection.options, "exclude");

    return {
      Program(node: ESTree.Program) {
        const pathSegments = segmentsOf({
          path: resolve(inspection.cwd, inspection.filename),
          separator: sep,
        });
        const { cwd } = inspection;
        if (!checkedTargets.some((pattern) => matchesGlobPath({ pathSegments, pattern, cwd })))
          return;
        if (exclude.some((pattern) => matchesGlobPath({ pathSegments, pattern, cwd }))) return;

        if (!node.body.some(isDirectReExport)) {
          inspection.report({ node, messageId: "missingReExport" });
        }

        for (const statement of node.body) {
          if (isDirectReExport(statement)) continue;
          inspection.report({ node: statement, messageId: "extraStatement" });
        }
      },
    };
  },
});
