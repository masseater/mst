import { groupBy } from "es-toolkit";

import { isInsideGeneratedRegion } from "../markdown/generated-region.ts";
import { flattenTextKeepingCode, lineOf, offsetOf } from "../markdown/nodes.ts";

import type { Nodes } from "mdast";
import type { AgenticDocumentsConfig } from "../config.ts";
import type { DocumentProblem } from "../problem.ts";
import type { NormativeDocument } from "../scan/normative-documents.ts";

const message = ({
  files,
  unit,
}: {
  readonly files: readonly string[];
  readonly unit: string;
}): string =>
  `同じ規範が ${files.length} つの文書に逐語で写されている（${files.join(", ")}）: "${unit}"。持ち主を 1 つ決めてそこに残し、他の文書は本文を消して持ち主を指す案内に置き換える。言い回しを変えて一致を外すことは解決ではない。`;

const truncate = (text: string, limit: number): string =>
  text.length > limit ? `${text.slice(0, limit)}…` : text;

const normalize = (text: string): string => text.trim().replaceAll(/\s+/gu, " ");

const unitNodesOf = (node: Nodes): readonly Nodes[] => {
  if (node.type === "heading") return [];
  if (node.type === "list") return node.children;
  if (node.type === "root") return node.children.flatMap(unitNodesOf);
  if (node.type === "blockquote") return node.children.flatMap(unitNodesOf);
  return [node];
};

const unitsOf = ({
  document,
  config,
}: {
  readonly document: NormativeDocument;
  readonly config: AgenticDocumentsConfig;
}): readonly {
  readonly file: string;
  readonly line: number | null;
  readonly text: string;
}[] =>
  unitNodesOf(document.tree)
    .filter((node) => !isInsideGeneratedRegion(offsetOf(node), document.generated))
    .map((node) => ({
      file: document.file,
      line: lineOf(node),
      text: normalize(flattenTextKeepingCode(node)),
    }))
    .filter((unit) => unit.text.length >= config.duplicateUnitMinimumLength)
    .filter((unit) => !config.pointerUnitPrefixes.some((prefix) => unit.text.startsWith(prefix)));

export const duplicatedNormativeUnits = ({
  documents,
  config,
}: {
  readonly documents: readonly NormativeDocument[];
  readonly config: AgenticDocumentsConfig;
}): readonly DocumentProblem[] => {
  const units = documents.flatMap((document) => unitsOf({ document, config }));

  const byText = groupBy(units, (unit) => unit.text);

  return Object.entries(byText).flatMap(([text, sites]): readonly DocumentProblem[] => {
    const files = [...new Set(sites.map((site) => site.file))].toSorted();
    if (files.length < 2) return [];

    return sites.slice(0, 1).map((first) => ({
      file: first.file,
      line: first.line,
      message: message({ files, unit: truncate(text, 120) }),
    }));
  });
};
