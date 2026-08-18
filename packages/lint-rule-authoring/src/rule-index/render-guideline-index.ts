import { escapePipes } from "./rule-table.ts";

import type { BundledLintRule } from "./rule-bundle.ts";

const TABLE_HEAD = "| Rule | Description |\n| --- | --- |";

const NAMED_BY_NO_RULE =
  "No rule of this repository declares this document as its grounds. What the off-the-shelf rules and the other checks cover is not collected here.";

export type GroundedLintRule = {
  readonly rule: BundledLintRule;
  readonly workspaceDir: string;
};

const documentPathOf = ({ rule, workspaceDir }: GroundedLintRule): string =>
  `${workspaceDir}/docs/lint/${rule.name}.md`;

const rowOf = (grounded: GroundedLintRule): string =>
  `| [${grounded.rule.name}](../${documentPathOf(grounded)}) | ${escapePipes(grounded.rule.description)} |`;

const bodyOf = (grounded: readonly GroundedLintRule[]): readonly string[] =>
  grounded.length === 0
    ? [NAMED_BY_NO_RULE]
    : [
        TABLE_HEAD,
        ...grounded
          .toSorted((left, right) => left.rule.name.localeCompare(right.rule.name))
          .map(rowOf),
      ];

const sectionOf = ({
  normativeDocument,
  grounded,
}: {
  readonly normativeDocument: string;
  readonly grounded: readonly GroundedLintRule[];
}): readonly string[] => [
  `## [${normativeDocument}](../${normativeDocument})`,
  "",
  ...bodyOf(grounded),
  "",
];

export const renderGuidelineIndex = ({
  normativeDocuments,
  grounded,
}: {
  readonly normativeDocuments: readonly string[];
  readonly grounded: readonly GroundedLintRule[];
}): string => {
  const named = grounded.flatMap((one) =>
    one.rule.relatedGuidelines.map((normativeDocument) => ({ normativeDocument, grounded: one })),
  );
  const documents = [
    ...new Set([...normativeDocuments, ...named.map((one) => one.normativeDocument)]),
  ].toSorted();

  return documents
    .flatMap((normativeDocument) =>
      sectionOf({
        normativeDocument,
        grounded: named
          .filter((one) => one.normativeDocument === normativeDocument)
          .map((one) => one.grounded),
      }),
    )
    .join("\n")
    .trimEnd();
};
