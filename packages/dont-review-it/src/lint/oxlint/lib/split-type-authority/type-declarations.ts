import { lineAtOffset } from "@mst/utils";
import { uniq } from "es-toolkit";
import { parseSync } from "oxc-parser";

import { isAstFields, NODE_TYPE_FIELD, type AstFields } from "../ast-node.ts";
import {
  canonicalTextOf,
  placeholdersIn,
  referencedTypeNamesIn,
  type TypeParameterPlaceholders,
} from "./canonical-text.ts";

export type TypeStructure = {
  readonly parameters: readonly string[];
  readonly heritage: readonly string[];
  readonly members: readonly string[];
  readonly annotation: readonly string[];
};

export type ScannedTypeDeclaration = {
  readonly name: string;
  readonly line: number;
  readonly kind: string;
  readonly structure: TypeStructure;
  readonly referencesNamedType: boolean;
  readonly referencedNames: readonly string[];
};

type DeclaredShape = {
  readonly parameters: unknown;
  readonly heritage: readonly unknown[];
  readonly memberNodes: readonly unknown[];
  readonly annotationNodes: readonly unknown[];
};

type ExportedTypeDeclaration = {
  readonly statement: AstFields;
  readonly shapeOf: (statement: AstFields) => DeclaredShape;
};

const SOURCE_NAME = "source.ts";

const EXPORT_KIND = "ExportNamedDeclaration";

const TYPE_LITERAL_KIND = "TSTypeLiteral";

const shapeOfInterface = (statement: AstFields): DeclaredShape => ({
  parameters: statement.typeParameters,
  heritage: statement.extends as readonly unknown[],
  memberNodes: (statement.body as AstFields).body as readonly unknown[],
  annotationNodes: [],
});

const shapeOfTypeAlias = (statement: AstFields): DeclaredShape => {
  const annotation = statement.typeAnnotation as AstFields;
  const isObjectShaped = annotation[NODE_TYPE_FIELD] === TYPE_LITERAL_KIND;
  return {
    parameters: statement.typeParameters,
    heritage: [],
    memberNodes: isObjectShaped ? (annotation.members as readonly unknown[]) : [],
    annotationNodes: isObjectShaped ? [] : [annotation],
  };
};

const SHAPE_BY_KIND: ReadonlyMap<string, (statement: AstFields) => DeclaredShape> = new Map([
  ["TSInterfaceDeclaration", shapeOfInterface],
  ["TSTypeAliasDeclaration", shapeOfTypeAlias],
]);

const parameterTextsOf = (
  parameters: unknown,
  placeholders: TypeParameterPlaceholders,
): readonly string[] => (parameters === null ? [] : [canonicalTextOf(parameters, placeholders)]);

const structureOf = (
  shape: DeclaredShape,
  placeholders: TypeParameterPlaceholders,
): TypeStructure => ({
  parameters: parameterTextsOf(shape.parameters, placeholders),
  heritage: shape.heritage.map((node) => canonicalTextOf(node, placeholders)),
  members: shape.memberNodes.map((node) => canonicalTextOf(node, placeholders)),
  annotation: shape.annotationNodes.map((node) => canonicalTextOf(node, placeholders)),
});

const declarationFrom = (
  source: string,
  { statement, shapeOf }: ExportedTypeDeclaration,
): ScannedTypeDeclaration => {
  const shape = shapeOf(statement);
  const placeholders = placeholdersIn(statement);
  const isUnbound = (name: string): boolean => !placeholders.has(name);

  return {
    name: String((statement.id as AstFields).name),
    line: lineAtOffset(source, Number(statement.start)),
    kind: String(statement[NODE_TYPE_FIELD]),
    structure: structureOf(shape, placeholders),
    referencesNamedType: referencedTypeNamesIn(shape.memberNodes).some(isUnbound),
    referencedNames: uniq(referencedTypeNamesIn(statement).filter(isUnbound)),
  };
};

const exportedTypeDeclarationOf = (statement: unknown): ExportedTypeDeclaration | null => {
  if (!isAstFields(statement) || statement[NODE_TYPE_FIELD] !== EXPORT_KIND) return null;

  const { declaration } = statement;
  if (!isAstFields(declaration)) return null;

  const shapeOf = SHAPE_BY_KIND.get(String(declaration[NODE_TYPE_FIELD]));
  return shapeOf === undefined ? null : { statement: declaration, shapeOf };
};

export const typeDeclarationsIn = (source: string): readonly ScannedTypeDeclaration[] => {
  const parsed = parseSync(SOURCE_NAME, source);
  return parsed.program.body.flatMap((statement) => {
    const exported = exportedTypeDeclarationOf(statement);
    return exported === null ? [] : [declarationFrom(source, exported)];
  });
};
