import {
  closedCandidateSet,
  mapCandidateSet,
  type CandidateSet,
} from "../lib/canonical-values/candidate-set.ts";
import { unwrapType } from "../lib/canonical-values/finite-value-syntax.ts";
import {
  normalizePropertyPath,
  type PropertyPathInput,
} from "../lib/canonical-values/property-path.ts";
import { canonicalValueImportDeclarationOf } from "./canonical-value-import-definition.ts";
import { CANONICAL_VALUE_NAMESPACE_IMPORTED_NAME } from "./canonical-value-module-import.ts";
import {
  createCanonicalValuePropertyNameDeclarationIndex,
  type CanonicalValuePropertyNameDeclaration,
} from "./canonical-value-property-name-declaration.ts";
import {
  canonicalValuePropertyNameOriginKey,
  combineCanonicalValuePropertyNameOriginSets,
  type CanonicalValuePropertyNameOrigin,
} from "./canonical-value-property-name-origin.ts";
import {
  type CanonicalValueOrigin,
  type CanonicalValueOriginProjection,
} from "./canonical-value-property-origin.ts";
import { canonicalValueImportedSpecifierName } from "./canonical-value-route-origin.ts";
import {
  canonicalValueGlobalTypeUtility,
  canonicalValueImportQualifierNames,
  canonicalValueTypeAliasSubstitutions,
  canonicalValueTypeQueryExpression,
  canonicalValueTypeReferenceSubstitution,
  type CanonicalValueTypeAliasIndex,
} from "./canonical-value-type-alias.ts";

import type { Definition, ESTree, SourceCode } from "@oxlint/plugins";
import type { CanonicalValueBindingIndex } from "./canonical-value-binding-index.ts";
import type { CanonicalValuePropertyState } from "./canonical-value-property-state.ts";

export type CanonicalValuePropertyNameTypeOriginIndex = {
  readonly indexDeclarations: () => void;
  readonly origins: (
    node: ESTree.TSTypeOperator,
  ) => CandidateSet<CanonicalValuePropertyNameOrigin> | null;
  readonly recordDeclaration: (node: CanonicalValuePropertyNameDeclaration) => void;
};

type PropertyNameTypeState = {
  readonly aliases: CanonicalValueTypeAliasIndex;
  readonly bindingIndex: CanonicalValueBindingIndex;
  readonly declarations: ReturnType<typeof createCanonicalValuePropertyNameDeclarationIndex>;
  readonly propertyState: CanonicalValuePropertyState;
  readonly sourceCode: Pick<SourceCode, "getScope">;
};

type PropertyNameTypeResolution = {
  readonly path: readonly PropertyPathInput[];
  readonly seenDeclarations: ReadonlySet<CanonicalValuePropertyNameDeclaration>;
  readonly seenTypes: ReadonlySet<ESTree.TSType>;
  readonly substitutions: ReadonlyMap<string, ESTree.TSType>;
  readonly type: ESTree.TSType;
};

const expressionOrigins = (
  origins: CandidateSet<CanonicalValueOrigin>,
): CandidateSet<CanonicalValuePropertyNameOrigin> =>
  mapCandidateSet(origins, {
    candidateKey: canonicalValuePropertyNameOriginKey,
    mapCandidate: (origin) => ({ kind: "expression", origin }),
  });

const importTypeOrigin = (
  node: ESTree.TSImportType,
  path: readonly PropertyPathInput[],
): CandidateSet<CanonicalValuePropertyNameOrigin> => {
  const names = [...canonicalValueImportQualifierNames(node.qualifier), ...path];
  const [qualifiedName, ...valuePath] = names;
  const importedName =
    typeof qualifiedName === "string" ? qualifiedName : CANONICAL_VALUE_NAMESPACE_IMPORTED_NAME;
  const valueProjections: readonly CanonicalValueOriginProjection[] =
    valuePath.length === 0 ? [] : [{ kind: "property", path: normalizePropertyPath(valuePath) }];
  return closedCandidateSet(
    [{ importedName, kind: "import", node, specifier: node.source.value, valueProjections }],
    canonicalValuePropertyNameOriginKey,
  );
};

const importedDefinitionOrigin = (
  definition: Definition,
  input: {
    readonly path: readonly string[];
    readonly reference: ESTree.IdentifierReference;
  },
): CanonicalValuePropertyNameOrigin | null => {
  const declaration = canonicalValueImportDeclarationOf(definition);
  if (declaration === null) return null;
  const node = definition.node;
  const named = node.type === "ImportSpecifier" ? canonicalValueImportedSpecifierName(node) : null;
  const namespace = node.type === "ImportNamespaceSpecifier";
  const importedName = namespace
    ? (input.path[0] ?? CANONICAL_VALUE_NAMESPACE_IMPORTED_NAME)
    : node.type === "ImportDefaultSpecifier"
      ? "default"
      : named;
  if (importedName === null) return null;
  const valuePath = namespace ? input.path.slice(1) : input.path;
  return {
    importedName,
    kind: "import",
    node: input.reference,
    specifier: declaration.source.value,
    valueProjections:
      valuePath.length === 0 ? [] : [{ kind: "property", path: normalizePropertyPath(valuePath) }],
  };
};

const entityNamePath = (
  name: ESTree.TSTypeReference["typeName"],
): { readonly path: readonly string[]; readonly root: ESTree.IdentifierReference } | null => {
  if (name.type === "Identifier") return { path: [], root: name };
  if (name.type !== "TSQualifiedName") return null;
  const left = entityNamePath(name.left);
  return left === null ? null : { path: [...left.path, name.right.name], root: left.root };
};

const importedReferenceOrigin = (
  state: PropertyNameTypeState,
  type: ESTree.TSTypeReference,
): CandidateSet<CanonicalValuePropertyNameOrigin> | null => {
  const reference = entityNamePath(type.typeName);
  if (reference === null) return null;
  const binding = state.bindingIndex.resolveIdentifier(reference.root);
  if (binding === null) return null;
  const origins = state.bindingIndex.definitionsOf(binding).flatMap((definition) => {
    const origin = importedDefinitionOrigin(definition, {
      path: reference.path,
      reference: reference.root,
    });
    return origin === null ? [] : [origin];
  });
  return origins.length === 0
    ? null
    : closedCandidateSet(origins, canonicalValuePropertyNameOriginKey);
};

const resolveDeclaredTypeReference = (
  state: PropertyNameTypeState,
  input: PropertyNameTypeResolution & { readonly type: ESTree.TSTypeReference },
): CandidateSet<CanonicalValuePropertyNameOrigin> | null => {
  if (input.type.typeName.type !== "Identifier") return null;
  const declared = state.declarations.origins({
    name: input.type.typeName.name,
    node: input.type,
    reference: input.type.typeName,
    seenDeclarations: input.seenDeclarations,
    side: "instance",
  });
  return declared ?? resolveKeyPreservingUtility(state, input);
};

const resolveTypeQuery = (
  state: PropertyNameTypeState,
  input: PropertyNameTypeResolution & { readonly type: ESTree.TSTypeQuery },
): CandidateSet<CanonicalValuePropertyNameOrigin> | null => {
  if (input.type.exprName.type === "TSImportType") {
    return importTypeOrigin(input.type.exprName, input.path);
  }
  const query = canonicalValueTypeQueryExpression(input.type.exprName);
  if (query === null) return null;
  if (query.root.type === "Identifier" && query.path.length === 0 && input.path.length === 0) {
    const declared = state.declarations.origins({
      name: query.root.name,
      node: input.type,
      reference: query.root,
      seenDeclarations: input.seenDeclarations,
      side: "static",
    });
    if (declared !== null) return declared;
  }
  return expressionOrigins(
    state.propertyState.origins({ expression: query.root, path: [...query.path, ...input.path] }),
  );
};

const resolveTypeReference = (
  state: PropertyNameTypeState,
  input: PropertyNameTypeResolution & { readonly type: ESTree.TSTypeReference },
): CandidateSet<CanonicalValuePropertyNameOrigin> | null => {
  const substitution = canonicalValueTypeReferenceSubstitution(input);
  if (substitution !== null)
    return resolvePropertyNameType(state, { ...input, type: substitution });
  const imported = importedReferenceOrigin(state, input.type);
  if (imported !== null) return imported;
  if (input.type.typeName.type !== "Identifier") return null;
  const alias = state.aliases.lexical({ name: input.type.typeName.name, node: input.type });
  if (alias !== null) {
    return resolvePropertyNameType(state, {
      ...input,
      substitutions: canonicalValueTypeAliasSubstitutions({
        alias,
        inherited: input.substitutions,
        reference: input.type,
      }),
      type: alias.typeAnnotation,
    });
  }
  return resolveDeclaredTypeReference(state, input);
};

const KEY_PRESERVING_UTILITIES: ReadonlySet<string> = new Set(["Partial", "Readonly", "Required"]);

const resolveKeyPreservingUtility = (
  state: PropertyNameTypeState,
  input: PropertyNameTypeResolution & { readonly type: ESTree.TSTypeReference },
): CandidateSet<CanonicalValuePropertyNameOrigin> | null => {
  if (input.type.typeName.type !== "Identifier") return null;
  const [argument] = input.type.typeArguments?.params ?? [];
  if (argument === undefined) return null;
  return canonicalValueGlobalTypeUtility({
    identifier: input.type.typeName,
    names: KEY_PRESERVING_UTILITIES,
    sourceCode: state.sourceCode,
  })
    ? resolvePropertyNameType(state, { ...input, type: argument })
    : null;
};

const resolveCompositeType = (
  state: PropertyNameTypeState,
  input: PropertyNameTypeResolution & {
    readonly type: ESTree.TSIntersectionType | ESTree.TSUnionType;
  },
): CandidateSet<CanonicalValuePropertyNameOrigin> | null => {
  const members = input.type.types.map((type) =>
    resolvePropertyNameType(state, { ...input, type }),
  );
  const known = members.filter(
    (member): member is CandidateSet<CanonicalValuePropertyNameOrigin> => member !== null,
  );
  if (known.length !== members.length) return null;
  return combineCanonicalValuePropertyNameOriginSets(known, {
    node: input.type,
    operator: input.type.type === "TSIntersectionType" ? "intersection" : "union",
  });
};

const directTypeOrigin = (
  state: PropertyNameTypeState,
  input: PropertyNameTypeResolution,
): CandidateSet<CanonicalValuePropertyNameOrigin> | null => {
  const type = input.type;
  if (type.type === "TSImportType") return importTypeOrigin(type, input.path);
  if (type.type === "TSTypeQuery") return resolveTypeQuery(state, { ...input, type });
  if (type.type === "TSTypeReference") return resolveTypeReference(state, { ...input, type });
  if (type.type === "TSIntersectionType" || type.type === "TSUnionType") {
    return resolveCompositeType(state, { ...input, type });
  }
  if (type.type === "TSTypeLiteral") {
    return closedCandidateSet(
      [{ kind: "structures", structures: [{ kind: "type-literal", node: type }] }],
      canonicalValuePropertyNameOriginKey,
    );
  }
  return type.type === "TSTypeOperator" && type.operator === "readonly"
    ? resolvePropertyNameType(state, { ...input, type: type.typeAnnotation })
    : null;
};

const resolvePropertyNameType = (
  state: PropertyNameTypeState,
  rawInput: PropertyNameTypeResolution,
): CandidateSet<CanonicalValuePropertyNameOrigin> | null => {
  const type = unwrapType(rawInput.type);
  if (rawInput.seenTypes.has(type)) return null;
  return directTypeOrigin(state, {
    ...rawInput,
    seenTypes: new Set([...rawInput.seenTypes, type]),
    type,
  });
};

const propertyNameOrigins = (
  state: PropertyNameTypeState,
  node: ESTree.TSTypeOperator,
): CandidateSet<CanonicalValuePropertyNameOrigin> | null =>
  node.operator !== "keyof"
    ? null
    : resolvePropertyNameType(state, {
        path: [],
        seenDeclarations: new Set(),
        seenTypes: new Set(),
        substitutions: new Map(),
        type: node.typeAnnotation,
      });

export const createCanonicalValuePropertyNameTypeOriginIndex = (query: {
  readonly aliases: CanonicalValueTypeAliasIndex;
  readonly bindingIndex: CanonicalValueBindingIndex;
  readonly propertyState: CanonicalValuePropertyState;
  readonly sourceCode: Pick<SourceCode, "getScope">;
}): CanonicalValuePropertyNameTypeOriginIndex => {
  const declarations = createCanonicalValuePropertyNameDeclarationIndex(query);
  const state = { ...query, declarations };
  return {
    indexDeclarations: declarations.indexDeclarations,
    origins: (node) => propertyNameOrigins(state, node),
    recordDeclaration: declarations.record,
  };
};
