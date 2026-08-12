import {
  closedCandidateSet,
  openCandidateSet,
  type CandidateSet,
} from "../lib/canonical-values/candidate-set.ts";
import {
  canonicalValuePropertyNameOriginKey,
  combineCanonicalValuePropertyNameOriginSets,
  type CanonicalValuePropertyNameOrigin,
  type CanonicalValuePropertyNameStructure,
} from "./canonical-value-property-name-origin.ts";
import { canonicalValueTypeDeclarationScopeNode } from "./canonical-value-type-alias.ts";

import type { ESTree, Scope, SourceCode } from "@oxlint/plugins";
import type { CanonicalValueBindingIndex } from "./canonical-value-binding-index.ts";

export type CanonicalValuePropertyNameDeclaration =
  | ESTree.Class
  | ESTree.TSEnumDeclaration
  | ESTree.TSInterfaceDeclaration
  | ESTree.TSModuleDeclaration;

export type CanonicalValuePropertyNameDeclarationIndex = {
  readonly indexDeclarations: () => void;
  readonly origins: (query: {
    readonly name: string;
    readonly node: ESTree.TSType;
    readonly reference: ESTree.IdentifierReference;
    readonly seenDeclarations: ReadonlySet<CanonicalValuePropertyNameDeclaration>;
    readonly side: "instance" | "static";
  }) => CandidateSet<CanonicalValuePropertyNameOrigin> | null;
  readonly record: (node: CanonicalValuePropertyNameDeclaration) => void;
};

type DeclarationState = {
  readonly bindingIndex: CanonicalValueBindingIndex;
  readonly declarations: Map<Scope, Map<string, readonly CanonicalValuePropertyNameDeclaration[]>>;
  readonly pending: Set<CanonicalValuePropertyNameDeclaration>;
  readonly sourceCode: Pick<SourceCode, "getScope">;
};

type DeclarationOriginQuery = Parameters<CanonicalValuePropertyNameDeclarationIndex["origins"]>[0];

const declarationsInScope = (
  state: DeclarationState,
  query: { readonly name: string; readonly scope: Scope | null },
): readonly CanonicalValuePropertyNameDeclaration[] => {
  if (query.scope === null) return [];
  return (
    state.declarations.get(query.scope)?.get(query.name) ??
    declarationsInScope(state, { ...query, scope: query.scope.upper })
  );
};

const declarationMatchesBinding = (
  state: DeclarationState,
  input: {
    readonly declaration: CanonicalValuePropertyNameDeclaration;
    readonly reference: ESTree.IdentifierReference;
  },
): boolean => {
  const binding = state.bindingIndex.resolveIdentifier(input.reference);
  if (binding === null) return true;
  return state.bindingIndex
    .definitionsOf(binding)
    .some(
      (definition) =>
        definition.node === input.declaration ||
        (definition.node.start === input.declaration.start &&
          definition.node.end === input.declaration.end),
    );
};

const lexicalDeclarations = (
  state: DeclarationState,
  query: Pick<DeclarationOriginQuery, "name" | "reference">,
): readonly CanonicalValuePropertyNameDeclaration[] =>
  declarationsInScope(state, {
    name: query.name,
    scope: state.sourceCode.getScope(query.reference),
  }).filter((declaration) =>
    declarationMatchesBinding(state, { declaration, reference: query.reference }),
  );

const structureForDeclaration = (
  declaration: CanonicalValuePropertyNameDeclaration,
  side: "instance" | "static",
): CanonicalValuePropertyNameStructure | null => {
  switch (declaration.type) {
    case "TSEnumDeclaration":
      return side === "static" ? { kind: "enum", node: declaration } : null;
    case "TSInterfaceDeclaration":
      return side === "instance" ? { kind: "interface", node: declaration } : null;
    case "TSModuleDeclaration":
      return side === "static" ? { kind: "namespace", node: declaration } : null;
    default:
      return { kind: "class", node: declaration, side };
  }
};

const ownDeclarationOrigins = (
  declarations: readonly CanonicalValuePropertyNameDeclaration[],
  side: "instance" | "static",
): CandidateSet<CanonicalValuePropertyNameOrigin> | null => {
  const structures = declarations.flatMap((declaration) => {
    const structure = structureForDeclaration(declaration, side);
    return structure === null ? [] : [structure];
  });
  return structures.length === 0
    ? null
    : closedCandidateSet([{ kind: "structures", structures }], canonicalValuePropertyNameOriginKey);
};

const heritageExpressions = (
  declaration: CanonicalValuePropertyNameDeclaration,
): readonly ESTree.Expression[] => {
  if (declaration.type === "ClassDeclaration" || declaration.type === "ClassExpression") {
    return declaration.superClass === null ? [] : [declaration.superClass];
  }
  return declaration.type === "TSInterfaceDeclaration"
    ? declaration.extends.map((heritage) => heritage.expression)
    : [];
};

const heritageOrigins = (
  state: DeclarationState,
  input: {
    readonly declaration: CanonicalValuePropertyNameDeclaration;
    readonly query: DeclarationOriginQuery;
  },
): readonly (CandidateSet<CanonicalValuePropertyNameOrigin> | null)[] =>
  heritageExpressions(input.declaration).map((expression) =>
    expression.type === "Identifier"
      ? resolveDeclarationOrigins(state, {
          ...input.query,
          name: expression.name,
          reference: expression,
        })
      : null,
  );

const resolveDeclarationOrigins = (
  state: DeclarationState,
  query: DeclarationOriginQuery,
): CandidateSet<CanonicalValuePropertyNameOrigin> | null => {
  const declarations = lexicalDeclarations(state, query).filter(
    (declaration) => !query.seenDeclarations.has(declaration),
  );
  const own = ownDeclarationOrigins(declarations, query.side);
  if (own === null) return null;
  const next = {
    ...query,
    seenDeclarations: new Set([...query.seenDeclarations, ...declarations]),
  };
  const heritage = declarations.flatMap((declaration) =>
    heritageOrigins(state, { declaration, query: next }),
  );
  const known = heritage.filter(
    (origin): origin is CandidateSet<CanonicalValuePropertyNameOrigin> => origin !== null,
  );
  const combined =
    known.length === 0
      ? own
      : combineCanonicalValuePropertyNameOriginSets([own, ...known], {
          node: query.node,
          operator: "intersection",
        });
  return known.length === heritage.length
    ? combined
    : openCandidateSet(combined.candidates, canonicalValuePropertyNameOriginKey);
};

const declarationName = (declaration: CanonicalValuePropertyNameDeclaration): string | null => {
  if (declaration.type === "ClassDeclaration" || declaration.type === "ClassExpression") {
    return declaration.id?.name ?? null;
  }
  if (declaration.type === "TSModuleDeclaration") {
    return declaration.id.type === "Identifier" ? declaration.id.name : null;
  }
  return declaration.id === null ? null : declaration.id.name;
};

const indexDeclaration = (
  state: DeclarationState,
  declaration: CanonicalValuePropertyNameDeclaration,
): void => {
  const name = declarationName(declaration);
  if (name === null) return;
  const scope = state.sourceCode.getScope(canonicalValueTypeDeclarationScopeNode(declaration));
  const declarations =
    state.declarations.get(scope) ??
    new Map<string, readonly CanonicalValuePropertyNameDeclaration[]>();
  declarations.set(name, [...(declarations.get(name) ?? []), declaration]);
  state.declarations.set(scope, declarations);
};

export const createCanonicalValuePropertyNameDeclarationIndex = (query: {
  readonly bindingIndex: CanonicalValueBindingIndex;
  readonly sourceCode: Pick<SourceCode, "getScope">;
}): CanonicalValuePropertyNameDeclarationIndex => {
  const state: DeclarationState = {
    ...query,
    declarations: new Map(),
    pending: new Set(),
  };
  return {
    indexDeclarations: () => {
      state.declarations.clear();
      for (const declaration of state.pending) indexDeclaration(state, declaration);
    },
    origins: (input) => resolveDeclarationOrigins(state, input),
    record: (node) => {
      state.pending.add(node);
    },
  };
};
