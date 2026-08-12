import { spellSites } from "../duplicated-bodies/site-report.ts";
import {
  carriesNonTrivialStructure,
  workspaceNameKeyOf,
  type IndexedType,
  type TypeAuthorityIndex,
} from "./authority-index.ts";

import type { RuleMessage } from "../rule-message.ts";

export type SplitTypeReport = RuleMessage & { readonly line: number };

export const SPLIT_SHAPE_MESSAGE_ID = "splitTypeShape";

export const SPLIT_NAME_MESSAGE_ID = "splitTypeName";

const withinWorkspace = (workspacePath: string, relativePath: string): string =>
  workspacePath === "" ? relativePath : relativePath.slice(workspacePath.length + 1);

const spellWorkspaceSites = (workspacePath: string, sites: readonly IndexedType[]): string =>
  sites
    .map((site) => `${withinWorkspace(workspacePath, site.relativePath)}:${site.line}`)
    .join(", ");

const differentlyShapedSites = (
  index: TypeAuthorityIndex,
  unit: IndexedType,
): readonly IndexedType[] =>
  (index.sitesByWorkspaceName.get(workspaceNameKeyOf(unit)) ?? []).filter(
    (site) =>
      site.relativePath !== unit.relativePath && site.declarationForm !== unit.declarationForm,
  );

const isDerivedFrom = (one: IndexedType, other: IndexedType): boolean =>
  one.referencedNames.includes(other.name) || other.referencedNames.includes(one.name);

const differentlyNamedSites = (
  index: TypeAuthorityIndex,
  unit: IndexedType,
): readonly IndexedType[] => {
  if (!carriesNonTrivialStructure(unit)) return [];
  return (index.sitesByStructure.get(unit.structureForm) ?? []).filter(
    (site) => site.name !== unit.name && !isDerivedFrom(unit, site),
  );
};

const reportsFor = (index: TypeAuthorityIndex, unit: IndexedType): readonly SplitTypeReport[] => {
  const shaped = differentlyShapedSites(index, unit);
  const named = differentlyNamedSites(index, unit);

  return [
    ...(shaped.length === 0
      ? []
      : [
          {
            line: unit.line,
            messageId: SPLIT_SHAPE_MESSAGE_ID,
            data: { name: unit.name, sites: spellWorkspaceSites(unit.workspacePath, shaped) },
          },
        ]),
    ...(named.length === 0
      ? []
      : [
          {
            line: unit.line,
            messageId: SPLIT_NAME_MESSAGE_ID,
            data: { name: unit.name, sites: spellSites(named) },
          },
        ]),
  ];
};

export const splitTypeReportsIn = ({
  index,
  relativePath,
}: {
  readonly index: TypeAuthorityIndex;
  readonly relativePath: string;
}): readonly SplitTypeReport[] =>
  (index.typesByPath.get(relativePath) ?? []).flatMap((unit) => reportsFor(index, unit));
