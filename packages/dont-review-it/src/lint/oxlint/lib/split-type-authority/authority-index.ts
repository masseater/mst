import { groupBy, sortBy, uniq } from "es-toolkit";

import type { ScannedTypeDeclaration, TypeStructure } from "./type-declarations.ts";

export type IndexedType = {
  readonly relativePath: string;
  readonly workspacePath: string;
  readonly name: string;
  readonly line: number;
  readonly declarationForm: string;
  readonly structureForm: string;
  readonly memberCount: number;
  readonly referencesNamedType: boolean;
  readonly referencedNames: readonly string[];
};

export type ScannedTypeFile = {
  readonly relativePath: string;
  readonly workspacePath: string;
  readonly declarations: readonly ScannedTypeDeclaration[];
};

export type TypeAuthorityIndex = {
  readonly typesByPath: ReadonlyMap<string, readonly IndexedType[]>;
  readonly sitesByWorkspaceName: ReadonlyMap<string, readonly IndexedType[]>;
  readonly sitesByStructure: ReadonlyMap<string, readonly IndexedType[]>;
};

export type TypeAuthorityIndexLoader = (options: {
  readonly repositoryRoot: string;
}) => TypeAuthorityIndex;

export const EMPTY_TYPE_AUTHORITY_INDEX: TypeAuthorityIndex = {
  typesByPath: new Map(),
  sitesByWorkspaceName: new Map(),
  sitesByStructure: new Map(),
};

const MINIMUM_STRUCTURE_MEMBERS = 3;

export const carriesNonTrivialStructure = (unit: {
  readonly memberCount: number;
  readonly referencesNamedType: boolean;
}): boolean => unit.memberCount >= MINIMUM_STRUCTURE_MEMBERS && unit.referencesNamedType;

export const workspaceNameKeyOf = (site: {
  readonly workspacePath: string;
  readonly name: string;
}): string => JSON.stringify([site.workspacePath, site.name]);

const mergedStructureOf = (declared: readonly ScannedTypeDeclaration[]): TypeStructure => ({
  parameters: uniq(declared.flatMap((declaration) => declaration.structure.parameters)),
  heritage: uniq(declared.flatMap((declaration) => declaration.structure.heritage)),
  members: uniq(declared.flatMap((declaration) => declaration.structure.members)),
  annotation: uniq(declared.flatMap((declaration) => declaration.structure.annotation)),
});

const structureFormOf = (structure: TypeStructure): string =>
  JSON.stringify([
    structure.parameters.toSorted(),
    structure.heritage.toSorted(),
    structure.members.toSorted(),
    structure.annotation.toSorted(),
  ]);

const unitOf = (
  file: ScannedTypeFile,
  named: readonly [string, readonly ScannedTypeDeclaration[]],
): IndexedType => {
  const [spelled, declared] = named;
  const structure = mergedStructureOf(declared);
  const structureForm = structureFormOf(structure);
  const nodeKinds = uniq(declared.map((declaration) => declaration.kind)).toSorted();

  return {
    relativePath: file.relativePath,
    workspacePath: file.workspacePath,
    name: spelled,
    line: Math.min(...declared.map((declaration) => declaration.line)),
    declarationForm: JSON.stringify([nodeKinds, structureForm]),
    structureForm,
    memberCount: structure.members.length,
    referencesNamedType: declared.some((declaration) => declaration.referencesNamedType),
    referencedNames: uniq(declared.flatMap((declaration) => declaration.referencedNames)),
  };
};

const unitsIn = (file: ScannedTypeFile): readonly IndexedType[] =>
  Object.entries(groupBy(file.declarations, (declaration) => declaration.name)).map((named) =>
    unitOf(file, named),
  );

const sitesKeyedBy = (
  units: readonly IndexedType[],
  keyOf: (unit: IndexedType) => string,
): ReadonlyMap<string, readonly IndexedType[]> =>
  new Map(
    Object.entries(groupBy(units, keyOf)).map(([namedKey, grouped]) => [
      namedKey,
      sortBy(grouped, ["relativePath", "line"]),
    ]),
  );

export const buildTypeAuthorityIndex = (files: readonly ScannedTypeFile[]): TypeAuthorityIndex => {
  const indexed = files.map((file) => ({ relativePath: file.relativePath, units: unitsIn(file) }));
  const units = indexed.flatMap((listed) => listed.units);

  return {
    typesByPath: new Map(indexed.map((listed) => [listed.relativePath, listed.units])),
    sitesByWorkspaceName: sitesKeyedBy(units, workspaceNameKeyOf),
    sitesByStructure: sitesKeyedBy(
      units.filter(carriesNonTrivialStructure),
      (unit) => unit.structureForm,
    ),
  };
};
