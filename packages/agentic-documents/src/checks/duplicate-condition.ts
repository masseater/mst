import { isInsideGeneratedRegion } from "../markdown/generated-region.ts";
import {
  descendants,
  flattenTextKeepingCode,
  leadingParagraphOf,
  lineOf,
  offsetOf,
} from "../markdown/nodes.ts";
import { conditionOf } from "./normative-notation.ts";

import type { DocumentProblem } from "../problem.ts";
import type { NormativeDocument } from "../scan/normative-documents.ts";

const message = (condition: string): string =>
  `同じ階層で条件 \`${condition}\` を繰り返すことは禁止されている。条件を 1 度だけ書き、行動をその下に入れ子で並べる。`;

type ConditionSite = {
  readonly condition: string;
  readonly line: number | null;
};

const conditionSitesIn = (list: {
  readonly children: readonly Parameters<typeof leadingParagraphOf>[0][];
}): readonly ConditionSite[] =>
  list.children.flatMap((item): readonly ConditionSite[] => {
    const paragraph = leadingParagraphOf(item);
    if (paragraph === null) return [];

    const condition = conditionOf(flattenTextKeepingCode(paragraph));
    return condition === null ? [] : [{ condition, line: lineOf(item) }];
  });

const firstIndexOfCondition = (sites: readonly ConditionSite[], condition: string): number =>
  sites.findIndex((site) => site.condition === condition);

const repeatedSitesIn = (sites: readonly ConditionSite[]): readonly ConditionSite[] =>
  sites.filter((site, index) => firstIndexOfCondition(sites, site.condition) !== index);

export const repeatedConditions = (document: NormativeDocument): readonly DocumentProblem[] =>
  descendants(document.tree)
    .filter((node) => node.type === "list")
    .filter((node) => !isInsideGeneratedRegion(offsetOf(node), document.generated))
    .flatMap((list): readonly DocumentProblem[] => {
      const sites = conditionSitesIn(list);

      return repeatedSitesIn(sites).map((site) => ({
        file: document.file,
        line: site.line,
        message: message(site.condition),
      }));
    });
