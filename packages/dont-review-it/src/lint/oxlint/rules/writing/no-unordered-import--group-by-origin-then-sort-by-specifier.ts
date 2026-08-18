import { createDontReviewItRule } from "../../../../create-rule.ts";

import type { ESTree } from "@oxlint/plugins";
import type { RuleMessage } from "../../lib/rule-message.ts";

const BUILTIN_ORIGIN = Symbol("builtin");

const INSTALLED_ORIGIN = Symbol("installed");

const REPOSITORY_ORIGIN = Symbol("repository");

const TYPE_ONLY_ORIGIN = Symbol("typeOnly");

type ImportOrigin =
  | typeof BUILTIN_ORIGIN
  | typeof INSTALLED_ORIGIN
  | typeof REPOSITORY_ORIGIN
  | typeof TYPE_ONLY_ORIGIN;

type PlacedImport = {
  readonly declaration: ESTree.ImportDeclaration;
  readonly origin: ImportOrigin;
  readonly sortKey: string;
};

const distanceOf = (specifier: string): ImportOrigin => {
  if (specifier.startsWith("node:")) return BUILTIN_ORIGIN;
  return specifier.startsWith(".") ? REPOSITORY_ORIGIN : INSTALLED_ORIGIN;
};

const originOf = (declaration: ESTree.ImportDeclaration): ImportOrigin =>
  declaration.importKind === "type" ? TYPE_ONLY_ORIGIN : distanceOf(declaration.source.value);

const originRank = (origin: ImportOrigin): number => {
  if (origin === BUILTIN_ORIGIN) return 0;
  if (origin === INSTALLED_ORIGIN) return 1;
  if (origin === REPOSITORY_ORIGIN) return 2;
  return 3;
};

const sortKeyOf = (declaration: ESTree.ImportDeclaration): string => {
  const specifier = declaration.source.value.toLowerCase();
  return declaration.importKind === "type"
    ? `${String(originRank(distanceOf(specifier)))}\0${specifier}`
    : specifier;
};

const placedImportsOf = (statements: readonly ESTree.Statement[]): readonly PlacedImport[] =>
  statements.flatMap((statement) =>
    statement.type === "ImportDeclaration" && statement.specifiers.length > 0
      ? [
          {
            declaration: statement,
            origin: originOf(statement),
            sortKey: sortKeyOf(statement),
          },
        ]
      : [],
  );

const blankLinesBetween = (preceding: PlacedImport, placedImport: PlacedImport): number =>
  placedImport.declaration.loc.start.line - preceding.declaration.loc.end.line - 1;

const originNameOf = (origin: ImportOrigin): string => {
  switch (origin) {
    case BUILTIN_ORIGIN:
      return "the runtime built-ins";
    case INSTALLED_ORIGIN:
      return "the installed packages";
    case REPOSITORY_ORIGIN:
      return "this repository";
    case TYPE_ONLY_ORIGIN:
      return "the type-only imports";
  }
};

const crossOriginMisplacement = (
  preceding: PlacedImport,
  placedImport: PlacedImport,
): RuleMessage | null => {
  const origin = originNameOf(placedImport.origin);
  const precedingOrigin = originNameOf(preceding.origin);
  if (originRank(placedImport.origin) < originRank(preceding.origin)) {
    return { messageId: "originOutOfOrder", data: { origin, precedingOrigin } };
  }
  return blankLinesBetween(preceding, placedImport) < 1
    ? { messageId: "missingBlankLineBetweenOrigins", data: { origin, precedingOrigin } }
    : null;
};

const sameOriginMisplacement = (
  preceding: PlacedImport,
  placedImport: PlacedImport,
): RuleMessage | null => {
  if (blankLinesBetween(preceding, placedImport) > 0) {
    return {
      messageId: "blankLineInsideOrigin",
      data: { origin: originNameOf(placedImport.origin) },
    };
  }
  if (placedImport.sortKey >= preceding.sortKey) return null;
  return {
    messageId: "specifierOutOfOrder",
    data: {
      specifier: placedImport.declaration.source.value,
      precedingSpecifier: preceding.declaration.source.value,
    },
  };
};

const misplacementBetween = (
  preceding: PlacedImport | undefined,
  placedImport: PlacedImport,
): RuleMessage | null => {
  if (preceding === undefined) return null;
  return placedImport.origin === preceding.origin
    ? sameOriginMisplacement(preceding, placedImport)
    : crossOriginMisplacement(preceding, placedImport);
};

export const noUnorderedImport = createDontReviewItRule({
  name: "no-unordered-import--group-by-origin-then-sort-by-specifier",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow an import list whose order does not follow origin then specifier, so what a file depends on is read off the block boundaries instead of every specifier",
      relatedGuidelines: ["docs/guidelines/writing-code.md"],
    },
    messages: {
      originOutOfOrder:
        "An import of {{origin}} must not sit after an import of {{precedingOrigin}}. Move it up into an order that runs the runtime built-ins, the installed packages, this repository, then the type-only imports.",
      specifierOutOfOrder:
        "`{{specifier}}` must not sit after `{{precedingSpecifier}}` inside the same block. Sort the block by specifier.",
      missingBlankLineBetweenOrigins:
        "An import of {{origin}} must not sit directly under an import of {{precedingOrigin}}. Put one blank line between the two blocks.",
      blankLineInsideOrigin:
        "A blank line must not split the imports of {{origin}}. Delete the blank line.",
    },
    schema: [],
  },
  create(ruleContext) {
    return {
      Program(node: ESTree.Program) {
        const placed = placedImportsOf(node.body);
        for (const [index, placedImport] of placed.entries()) {
          const misplacement = misplacementBetween(placed[index - 1], placedImport);
          if (misplacement === null) continue;
          ruleContext.report({ node: placedImport.declaration, ...misplacement });
        }
      },
    };
  },
});
