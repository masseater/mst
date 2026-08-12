import {
  closedCandidateSet,
  joinCandidateSets,
  mapCandidateSet,
  openCandidateSet,
  type CandidateSet,
} from "../lib/canonical-values/candidate-set.ts";
import { scalarLiteralValue, unwrapType } from "../lib/canonical-values/finite-value-syntax.ts";
import {
  normalizePropertyPath,
  type PropertyPathInput,
} from "../lib/canonical-values/property-path.ts";
import { resolveCanonicalValuePrimitiveTypeDomain } from "./canonical-value-primitive-type-domain.ts";
import { type CanonicalValuePropertyNameDeclaration } from "./canonical-value-property-name-declaration.ts";
import { type CanonicalValuePropertyNameOrigin } from "./canonical-value-property-name-origin.ts";
import { createCanonicalValuePropertyNameTypeOriginIndex } from "./canonical-value-property-name-type-origin.ts";
import {
  canonicalValueOriginProjectionKey,
  canonicalValueOriginKey,
  type CanonicalValueOrigin,
  type CanonicalValueOriginProjection,
} from "./canonical-value-property-origin.ts";
import {
  canonicalValueGlobalTypeUtility,
  canonicalValueImportQualifierNames,
  canonicalValueTypeAliasSubstitutions,
  canonicalValueTypeQueryExpression,
  canonicalValueTypeReferenceSubstitution,
  createCanonicalValueTypeAliasIndex,
} from "./canonical-value-type-alias.ts";

import type { ESTree, SourceCode } from "@oxlint/plugins";
import type { CanonicalValue } from "../lib/canonical-values/fingerprint.ts";
import type { CanonicalValueBindingIndex } from "./canonical-value-binding-index.ts";
import type { CanonicalValuePropertyState } from "./canonical-value-property-state.ts";

type CanonicalValueTypeOriginQuery = {
  readonly bindingIndex: CanonicalValueBindingIndex;
  readonly propertyState: CanonicalValuePropertyState;
  readonly sourceCode: Pick<SourceCode, "getScope">;
};

type CanonicalValueTypeResolution = {
  readonly path: readonly PropertyPathInput[];
  readonly seenTypes: ReadonlySet<ESTree.TSType>;
  readonly substitutions: ReadonlyMap<string, ESTree.TSType>;
  readonly type: ESTree.TSType;
};

export type CanonicalValueTypeOrigin =
  | {
      readonly importedName: string;
      readonly kind: "import";
      readonly node: ESTree.TSImportType;
      readonly specifier: string;
      readonly valueProjections: readonly CanonicalValueOriginProjection[];
    }
  | { readonly kind: "expression"; readonly origin: CanonicalValueOrigin };

export type CanonicalValueTypeOriginIndex = {
  readonly indexDeclarations: () => void;
  readonly indexedOrigins: (
    node: ESTree.TSIndexedAccessType,
  ) => CandidateSet<CanonicalValueTypeOrigin> | null;
  readonly propertyNameOrigins: (
    node: ESTree.TSTypeOperator,
  ) => CandidateSet<CanonicalValuePropertyNameOrigin> | null;
  readonly primitiveDomain: (node: ESTree.TSType) => CandidateSet<CanonicalValue> | null;
  readonly recordPropertyDeclaration: (node: CanonicalValuePropertyNameDeclaration) => void;
  readonly recordTypeAlias: (node: ESTree.TSTypeAliasDeclaration) => void;
};

type CanonicalValueTypeState = CanonicalValueTypeOriginQuery & {
  readonly aliases: ReturnType<typeof createCanonicalValueTypeAliasIndex>;
};

export type { CanonicalValuePropertyNameDeclaration } from "./canonical-value-property-name-declaration.ts";

const typeOriginKey = (origin: CanonicalValueTypeOrigin): string =>
  origin.kind === "expression"
    ? `expression:${canonicalValueOriginKey(origin.origin)}`
    : `import:${origin.specifier}:${origin.importedName}:${origin.valueProjections
        .map(canonicalValueOriginProjectionKey)
        .join("|")}`;

const expressionTypeOrigins = (
  origins: CandidateSet<CanonicalValueOrigin>,
): CandidateSet<CanonicalValueTypeOrigin> =>
  mapCandidateSet(origins, {
    candidateKey: typeOriginKey,
    mapCandidate: (origin) => ({ kind: "expression", origin }),
  });

const importTypeOrigin = (
  node: ESTree.TSImportType,
  path: readonly PropertyPathInput[],
): CandidateSet<CanonicalValueTypeOrigin> | null => {
  const [importedName, ...valuePath] = [
    ...canonicalValueImportQualifierNames(node.qualifier),
    ...path,
  ];
  if (typeof importedName !== "string") return null;
  const valueProjections: readonly CanonicalValueOriginProjection[] =
    valuePath.length === 0 ? [] : [{ kind: "property", path: normalizePropertyPath(valuePath) }];
  return closedCandidateSet(
    [{ importedName, kind: "import", node, specifier: node.source.value, valueProjections }],
    typeOriginKey,
  );
};

const resolveTypeQuery = (
  state: CanonicalValueTypeState,
  input: CanonicalValueTypeResolution & { readonly type: ESTree.TSTypeQuery },
): CandidateSet<CanonicalValueTypeOrigin> | null => {
  if (input.type.exprName.type === "TSImportType") {
    return importTypeOrigin(input.type.exprName, input.path);
  }
  const query = canonicalValueTypeQueryExpression(input.type.exprName);
  return query === null
    ? null
    : expressionTypeOrigins(
        state.propertyState.origins({
          expression: query.root,
          path: [...query.path, ...input.path],
        }),
      );
};

const READONLY_TYPE_UTILITY: ReadonlySet<string> = new Set(["Readonly"]);

const resolveTypeReference = (
  state: CanonicalValueTypeState,
  input: CanonicalValueTypeResolution & { readonly type: ESTree.TSTypeReference },
): CandidateSet<CanonicalValueTypeOrigin> | null => {
  const substitution = canonicalValueTypeReferenceSubstitution(input);
  if (substitution !== null) return resolveType(state, { ...input, type: substitution });
  if (input.type.typeName.type !== "Identifier") return null;
  const alias = state.aliases.lexical({ name: input.type.typeName.name, node: input.type });
  if (alias !== null) {
    return resolveType(state, {
      ...input,
      substitutions: canonicalValueTypeAliasSubstitutions({
        alias,
        inherited: input.substitutions,
        reference: input.type,
      }),
      type: alias.typeAnnotation,
    });
  }
  const [argument] = input.type.typeArguments?.params ?? [];
  if (argument === undefined) return null;
  return canonicalValueGlobalTypeUtility({
    identifier: input.type.typeName,
    names: READONLY_TYPE_UTILITY,
    sourceCode: state.sourceCode,
  })
    ? resolveType(state, { ...input, type: argument })
    : null;
};

const tupleElementType = (element: ESTree.TSTupleElement): ESTree.TSType => {
  if (element.type === "TSOptionalType" || element.type === "TSRestType") {
    return element.typeAnnotation;
  }
  return element.type === "TSNamedTupleMember" ? tupleElementType(element.elementType) : element;
};

const resolveTupleType = (
  state: CanonicalValueTypeState,
  input: CanonicalValueTypeResolution & { readonly type: ESTree.TSTupleType },
): CandidateSet<CanonicalValueTypeOrigin> | null => {
  const resolved = input.type.elementTypes.map((element) =>
    resolveType(state, { ...input, type: tupleElementType(element) }),
  );
  const known = resolved.filter(
    (origins): origins is CandidateSet<CanonicalValueTypeOrigin> => origins !== null,
  );
  if (known.length === 0) return null;
  const joined = joinCandidateSets(known, typeOriginKey);
  return known.length === resolved.length
    ? joined
    : openCandidateSet(joined.candidates, typeOriginKey);
};

const indexedPropertyName = (type: ESTree.TSType): string | null => {
  const index = unwrapType(type);
  if (index.type !== "TSLiteralType") return null;
  const spelling = scalarLiteralValue(index.literal);
  return typeof spelling === "string" || typeof spelling === "number" ? String(spelling) : null;
};

const resolveNestedIndexedType = (
  state: CanonicalValueTypeState,
  input: CanonicalValueTypeResolution & { readonly type: ESTree.TSIndexedAccessType },
): CandidateSet<CanonicalValueTypeOrigin> | null => {
  const propertyName = indexedPropertyName(input.type.indexType);
  return propertyName === null
    ? null
    : resolveType(state, {
        ...input,
        path: [propertyName, ...input.path],
        type: input.type.objectType,
      });
};

const resolveDirectType = (
  state: CanonicalValueTypeState,
  input: CanonicalValueTypeResolution,
): CandidateSet<CanonicalValueTypeOrigin> | null => {
  const type = input.type;
  if (type.type === "TSTypeQuery") return resolveTypeQuery(state, { ...input, type });
  if (type.type === "TSTypeReference") return resolveTypeReference(state, { ...input, type });
  if (type.type === "TSTupleType") return resolveTupleType(state, { ...input, type });
  return type.type === "TSIndexedAccessType"
    ? resolveNestedIndexedType(state, { ...input, type })
    : null;
};

const resolveType = (
  state: CanonicalValueTypeState,
  rawInput: CanonicalValueTypeResolution,
): CandidateSet<CanonicalValueTypeOrigin> | null => {
  const type = unwrapType(rawInput.type);
  if (rawInput.seenTypes.has(type)) return null;
  return resolveDirectType(state, {
    ...rawInput,
    seenTypes: new Set([...rawInput.seenTypes, type]),
    type,
  });
};

const indexedOrigins = (
  state: CanonicalValueTypeState,
  node: ESTree.TSIndexedAccessType,
): CandidateSet<CanonicalValueTypeOrigin> | null => {
  if (unwrapType(node.indexType).type !== "TSNumberKeyword") return null;
  return resolveType(state, {
    path: [],
    seenTypes: new Set(),
    substitutions: new Map(),
    type: node.objectType,
  });
};

export const createCanonicalValueTypeOriginIndex = (
  query: CanonicalValueTypeOriginQuery,
): CanonicalValueTypeOriginIndex => {
  const aliases = createCanonicalValueTypeAliasIndex(query.sourceCode);
  const state = { ...query, aliases };
  const propertyNames = createCanonicalValuePropertyNameTypeOriginIndex({ ...query, aliases });
  return {
    indexDeclarations: () => {
      aliases.indexDeclarations();
      propertyNames.indexDeclarations();
    },
    indexedOrigins: (node) => indexedOrigins(state, node),
    propertyNameOrigins: propertyNames.origins,
    primitiveDomain: (node) =>
      resolveCanonicalValuePrimitiveTypeDomain({
        aliases,
        bindingIndex: query.bindingIndex,
        sourceCode: query.sourceCode,
        type: node,
      }),
    recordPropertyDeclaration: propertyNames.recordDeclaration,
    recordTypeAlias: aliases.record,
  };
};
