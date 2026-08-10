import { isAbsolute, relative, sep } from "node:path";

import { uniq } from "es-toolkit";

import { createLintRuleAuthoringRule } from "../../../create-rule.ts";

import type { ESTree, Options } from "@oxlint/plugins";

const startsWithAlphanumeric = (segment: string): boolean => /^[a-zA-Z0-9]/u.test(segment);

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

const matchesAllowedName = (segment: string, pattern: string): boolean => {
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

const allowedNamesFrom = (options: Readonly<Options>): readonly string[] => {
  const [first] = options;
  if (typeof first !== "object" || first === null || Array.isArray(first)) return [];
  const { allowedNames } = first;
  if (!Array.isArray(allowedNames)) return [];
  return allowedNames.filter((entry): entry is string => typeof entry === "string");
};

const repositoryRelativePathOf = (cwd: string, filename: string): string | null => {
  const relativePath = relative(cwd, filename);
  if (relativePath === "" || isAbsolute(relativePath)) return null;
  return relativePath.split(sep).includes("..") ? null : relativePath;
};

const offendingSegmentsOf = (
  repositoryRelativePath: string,
  allowedNames: readonly string[],
): readonly string[] =>
  uniq(
    repositoryRelativePath
      .split(sep)
      .filter((segment) => segment !== "" && !startsWithAlphanumeric(segment))
      .filter((segment) => !allowedNames.some((pattern) => matchesAllowedName(segment, pattern))),
  );

export const forbidSymbolPrefixedName = createLintRuleAuthoringRule({
  name: "forbid-symbol-prefixed-name--rename-to-alphanumeric-start",
  meta: {
    type: "problem",
    docs: {
      description:
        "Require every directory and file name on the path of a linted file to start with a letter or a digit, so nothing sits where a glob walk never reaches it",
      relatedGuidelines: [],
    },
    messages: {
      symbolPrefixedSegment:
        "A directory or file name must not start with anything other than a letter or a digit, because a glob walk passes over such a name and whatever is placed under it stays unchecked with nothing reporting the gap. The name `{{segment}}`, on the path `{{path}}`, starts with something else. Rename that one name so it starts with a letter or a digit.",
    },
    schema: [
      {
        type: "object",
        properties: {
          allowedNames: {
            type: "array",
            items: { type: "string", pattern: "^[^/]+$" },
          },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const allowedNames = allowedNamesFrom(context.options);

    return {
      Program(node: ESTree.Program) {
        const repositoryRelativePath = repositoryRelativePathOf(context.cwd, context.filename);
        if (repositoryRelativePath === null) return;

        for (const segment of offendingSegmentsOf(repositoryRelativePath, allowedNames)) {
          context.report({
            node,
            messageId: "symbolPrefixedSegment",
            data: { segment, path: repositoryRelativePath },
          });
        }
      },
    };
  },
});
