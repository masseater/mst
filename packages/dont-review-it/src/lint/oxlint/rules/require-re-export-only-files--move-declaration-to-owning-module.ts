import { resolve, sep } from "node:path";

import { range } from "es-toolkit";

import { createDontReviewItRule } from "../../../create-rule.ts";

import type { ESTree, Options } from "@oxlint/plugins";

type TopLevelNode = ESTree.Program["body"][number];

const ANCHORED_PATTERN_PREFIXES = ["/", "./", "../"];

const isDirectReExport = (node: TopLevelNode): boolean =>
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

const literalsFollowInOrder = (
  segment: string,
  literals: readonly string[],
  cursor: number,
  lastMatchableEnd: number,
): boolean => {
  const [literal, ...remaining] = literals;
  if (literal === undefined) return true;

  const found = segment.indexOf(literal, cursor);
  if (found === -1 || found + literal.length > lastMatchableEnd) return false;
  return literalsFollowInOrder(segment, remaining, found + literal.length, lastMatchableEnd);
};

const matchesSegmentName = (segment: string, pattern: string): boolean => {
  const literals = pattern.split("*");
  if (literals.length === 1) return segment === pattern;

  const head = literals[0];
  const tail = literals[literals.length - 1];
  if (!segment.startsWith(head)) return false;
  if (!segment.endsWith(tail)) return false;
  if (segment.length < head.length + tail.length) return false;

  return literalsFollowInOrder(
    segment,
    literals.slice(1, -1),
    head.length,
    segment.length - tail.length,
  );
};

const matchesSegments = (
  pathSegments: readonly string[],
  patternSegments: readonly string[],
): boolean => {
  if (patternSegments.length === 0) return pathSegments.length === 0;

  const [head, ...remainingPatternSegments] = patternSegments;
  if (head === "**") {
    return range(0, pathSegments.length + 1).some((skipped) =>
      matchesSegments(pathSegments.slice(skipped), remainingPatternSegments),
    );
  }

  if (pathSegments.length === 0) return false;
  if (!matchesSegmentName(pathSegments[0], head)) return false;
  return matchesSegments(pathSegments.slice(1), remainingPatternSegments);
};

const segmentsOf = (path: string, separator: string): readonly string[] =>
  path.split(separator).filter((segment) => segment !== "");

const matchesPattern = (pathSegments: readonly string[], pattern: string, cwd: string): boolean => {
  if (ANCHORED_PATTERN_PREFIXES.some((prefix) => pattern.startsWith(prefix))) {
    return matchesSegments(pathSegments, segmentsOf(resolve(cwd, pattern), sep));
  }

  const patternSegments = segmentsOf(pattern, "/");
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
        'A file the deployment lists as re-export only must carry re-exports and nothing else, and this statement is not one of them. What counts is `export { ... } from "..."`, `export * from "..."` and `export * as Name from "..."`; an import followed by a separate `export { ... }` does not, because the exporting statement names no module. Move what this statement brings in or declares into the module that should own it, and re-export it from here. If this file is meant to own it, the file is not a re-export only file and the listing that named it is what has to change.',
      missingReExport:
        'A file the deployment lists as re-export only must carry at least one re-export, and this one carries none, so the file names a surface that exposes nothing. What counts is `export { ... } from "..."`, `export * from "..."` and `export * as Name from "..."`; an import followed by a separate `export { ... }` does not, because the exporting statement names no module. Re-export from here what the modules beside this file own. If this file is not a surface at all, the listing that named it is what has to change.',
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
        const pathSegments = segmentsOf(resolve(context.cwd, context.filename), sep);
        if (!targets.some((pattern) => matchesPattern(pathSegments, pattern, context.cwd))) return;
        if (exclude.some((pattern) => matchesPattern(pathSegments, pattern, context.cwd))) return;

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
