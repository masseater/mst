import { bindingInScope } from "./scope-resolution.ts";

import type { ESTree, Scope, SourceCode } from "@oxlint/plugins";

export type CanonicalValueTypeAliasIndex = {
  readonly indexDeclarations: () => void;
  readonly lexical: (query: {
    readonly name: string;
    readonly node: ESTree.Node;
  }) => ESTree.TSTypeAliasDeclaration | null;
  readonly record: (node: ESTree.TSTypeAliasDeclaration) => void;
};

type TypeAliasState = {
  readonly aliases: Map<Scope, Map<string, ESTree.TSTypeAliasDeclaration>>;
  readonly pending: Set<ESTree.TSTypeAliasDeclaration>;
  readonly sourceCode: Pick<SourceCode, "getScope">;
};

const aliasInScope = (
  state: TypeAliasState,
  query: { readonly name: string; readonly scope: Scope | null },
): ESTree.TSTypeAliasDeclaration | null => {
  if (query.scope === null) return null;
  return (
    state.aliases.get(query.scope)?.get(query.name) ??
    aliasInScope(state, { ...query, scope: query.scope.upper })
  );
};

export const canonicalValueTypeDeclarationScopeNode = (node: ESTree.Node): ESTree.Node => {
  const parent = node.parent;
  if (parent === null) return node;
  if (parent.type === "ExportNamedDeclaration" || parent.type === "ExportDefaultDeclaration") {
    return parent.parent;
  }
  return parent;
};

export const createCanonicalValueTypeAliasIndex = (
  sourceCode: Pick<SourceCode, "getScope">,
): CanonicalValueTypeAliasIndex => {
  const state: TypeAliasState = { aliases: new Map(), pending: new Set(), sourceCode };
  return {
    indexDeclarations: () => {
      state.aliases.clear();
      for (const node of state.pending) {
        const scope = state.sourceCode.getScope(canonicalValueTypeDeclarationScopeNode(node));
        const aliases =
          state.aliases.get(scope) ?? new Map<string, ESTree.TSTypeAliasDeclaration>();
        aliases.set(node.id.name, node);
        state.aliases.set(scope, aliases);
      }
    },
    lexical: (query) =>
      aliasInScope(state, {
        name: query.name,
        scope: state.sourceCode.getScope(query.node),
      }),
    record: (node) => {
      state.pending.add(node);
    },
  };
};

export const canonicalValueTypeReferenceSubstitution = (input: {
  readonly substitutions: ReadonlyMap<string, ESTree.TSType>;
  readonly type: ESTree.TSTypeReference;
}): ESTree.TSType | null => {
  if (input.type.typeName.type !== "Identifier" || input.type.typeArguments !== null) return null;
  return input.substitutions.get(input.type.typeName.name) ?? null;
};

export const canonicalValueTypeAliasSubstitutions = ({
  alias,
  inherited,
  reference,
}: {
  readonly alias: ESTree.TSTypeAliasDeclaration;
  readonly inherited: ReadonlyMap<string, ESTree.TSType>;
  readonly reference: ESTree.TSTypeReference;
}): ReadonlyMap<string, ESTree.TSType> => {
  const substitutions = new Map(inherited);
  for (const [index, parameter] of alias.typeParameters?.params.entries() ?? []) {
    const argument = reference.typeArguments?.params[index] ?? parameter.default;
    if (argument !== null) substitutions.set(parameter.name.name, argument);
  }
  return substitutions;
};

const qualifiedNamePath = (
  name: ESTree.TSQualifiedName,
): { readonly path: readonly string[]; readonly root: ESTree.Expression } | null => {
  const left =
    name.left.type === "TSQualifiedName"
      ? qualifiedNamePath(name.left)
      : name.left.type === "Identifier"
        ? { path: [], root: name.left }
        : null;
  return left === null ? null : { path: [...left.path, name.right.name], root: left.root };
};

export const canonicalValueTypeQueryExpression = (
  name: Exclude<ESTree.TSTypeQuery["exprName"], ESTree.TSImportType>,
): { readonly path: readonly string[]; readonly root: ESTree.Expression } | null => {
  if (name.type === "Identifier") return { path: [], root: name };
  return name.type === "TSQualifiedName" ? qualifiedNamePath(name) : null;
};

export const canonicalValueImportQualifierNames = (
  qualifier: ESTree.TSImportType["qualifier"],
): readonly string[] => {
  if (qualifier === null) return [];
  return "left" in qualifier
    ? [...canonicalValueImportQualifierNames(qualifier.left), qualifier.right.name]
    : [qualifier.name];
};

export const canonicalValueGlobalTypeUtility = (input: {
  readonly identifier: ESTree.IdentifierReference;
  readonly names: ReadonlySet<string>;
  readonly sourceCode: Pick<SourceCode, "getScope">;
}): boolean =>
  input.names.has(input.identifier.name) &&
  bindingInScope(input.sourceCode.getScope(input.identifier), input.identifier.name) === null;
