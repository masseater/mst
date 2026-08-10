import { resolve, sep } from "node:path";

import { matchesGlobSegment } from "@mst/lint-rule-authoring";
import { range } from "es-toolkit";

import { createDontReviewItRule } from "../../../create-rule.ts";
import { segmentsOf } from "../lib/path-segments.ts";

import type { ESTree, Options } from "@oxlint/plugins";

const ANCHORED_PATTERN_PREFIXES = ["/", "./", "../"];

const isDirectReExport = (node: ESTree.Program["body"][number]): boolean =>
  node.type === "ExportAllDeclaration" ||
  (node.type === "ExportNamedDeclaration" && node.source !== null);

const patternsFrom = (
  options: Readonly<Options>,
  key: "targets" | "exclude",
): readonly string[] => {
  const [first] = options;
  if (typeof first !== "object" || first === null || Array.isArray(first)) return [];
  const patterns = first[key];
  if (!Array.isArray(patterns)) return [];
  return patterns.filter((entry): entry is string => typeof entry === "string");
};

const matchesSegments = (
  pathSegments: readonly string[],
  patternSegments: readonly string[],
): boolean => {
  const [head, ...remainingPatternSegments] = patternSegments;
  if (head === undefined) return pathSegments.length === 0;
  if (head === "**") {
    return range(0, pathSegments.length + 1).some((skipped) =>
      matchesSegments(pathSegments.slice(skipped), remainingPatternSegments),
    );
  }

  const [firstPathSegment, ...remainingPathSegments] = pathSegments;
  if (firstPathSegment === undefined) return false;
  if (!matchesGlobSegment({ segment: firstPathSegment, pattern: head })) return false;
  return matchesSegments(remainingPathSegments, remainingPatternSegments);
};

const matchesPattern = (
  pathSegments: readonly string[],
  { pattern, cwd }: { readonly pattern: string; readonly cwd: string },
): boolean => {
  if (ANCHORED_PATTERN_PREFIXES.some((prefix) => pattern.startsWith(prefix))) {
    return matchesSegments(
      pathSegments,
      segmentsOf({ path: resolve(cwd, pattern), separator: sep }),
    );
  }

  const patternSegments = segmentsOf({ path: pattern, separator: "/" });
  return pathSegments.some((_, index) =>
    matchesSegments(pathSegments.slice(index), patternSegments),
  );
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
  create(context) {
    const targets = patternsFrom(context.options, "targets");
    if (targets.length === 0) return {};

    const exclude = patternsFrom(context.options, "exclude");

    return {
      Program(node: ESTree.Program) {
        const pathSegments = segmentsOf({
          path: resolve(context.cwd, context.filename),
          separator: sep,
        });
        const { cwd } = context;
        if (!targets.some((pattern) => matchesPattern(pathSegments, { pattern, cwd }))) return;
        if (exclude.some((pattern) => matchesPattern(pathSegments, { pattern, cwd }))) return;

        if (!node.body.some(isDirectReExport)) {
          context.report({ node, messageId: "missingReExport" });
        }

        for (const statement of node.body) {
          if (isDirectReExport(statement)) continue;
          context.report({ node: statement, messageId: "extraStatement" });
        }
      },
    };
  },
});
