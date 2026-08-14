import { FUNCTION_NODE_TYPES, IMPORT_BINDING_NODE_TYPES } from "../node-kinds.ts";
import { nodeTypeOf } from "../setup-modules/coupling-edges.ts";
import { stateFieldsWrittenAfterConstruction } from "./class-state-writes.ts";
import { constructedValueEscapes, heldNamesOf, identifierNameOf } from "./instance-escape.ts";
import { innermostOf, nodeVisitsIn, visitAt, type NodeVisit } from "./node-visits.ts";

import type { AstFields } from "../ast-node.ts";

export type ConstructionSite = {
  readonly name: string;
  readonly scopeKey: string | null;
  readonly scopeName: string | null;
  readonly escapes: boolean;
};

export type DeclaredClass = {
  readonly name: string;
  readonly fields: readonly string[];
  readonly shared: boolean;
};

export type SourceFacts = {
  readonly declaredClasses: readonly DeclaredClass[];
  readonly constructions: readonly ConstructionSite[];
  readonly divertedNames: ReadonlySet<string>;
};

const SHARED_PARENT_KINDS: ReadonlySet<string> = new Set([
  "ExportDefaultDeclaration",
  "ExportNamedDeclaration",
]);

const declaredClassesIn = (visits: readonly NodeVisit[]): readonly DeclaredClass[] =>
  visits
    .filter((visit) => nodeTypeOf(visit.node) === "ClassDeclaration")
    .flatMap((visit) => {
      const declaredClassName = identifierNameOf(visit.node.id);
      if (declaredClassName === null) return [];

      return [
        {
          name: declaredClassName,
          fields: [...stateFieldsWrittenAfterConstruction(visit.node)],
          shared: visit.ancestors
            .slice(-1)
            .some((parent) => SHARED_PARENT_KINDS.has(nodeTypeOf(parent))),
        },
      ];
    });

const scopeNameOf = (visit: NodeVisit): string | null =>
  [
    ...heldNamesOf(visit),
    ...visit.ancestors
      .slice(-1)
      .filter((parent) => parent.value === visit.node)
      .flatMap((parent) => (parent.computed === true ? [] : [identifierNameOf(parent.key)]))
      .flatMap((holderSpelling) => (holderSpelling === null ? [] : [holderSpelling])),
  ][0] ?? null;

const constructionsIn = (visits: readonly NodeVisit[]): readonly ConstructionSite[] =>
  visits
    .filter((visit) => nodeTypeOf(visit.node) === "NewExpression")
    .flatMap((visit): readonly ConstructionSite[] => {
      const constructedClassName = identifierNameOf(visit.node.callee);
      if (constructedClassName === null) return [];

      const scope = innermostOf(visit.ancestors, FUNCTION_NODE_TYPES);
      if (scope === null)
        return [{ name: constructedClassName, scopeKey: null, scopeName: null, escapes: true }];

      return [
        {
          name: constructedClassName,
          scopeKey: String(scope.start),
          scopeName: scopeNameOf(visitAt(visit, scope)),
          escapes: constructedValueEscapes({ visits, scope }, visit),
        },
      ];
    });

const OWN_SPELLING_FIELD: ReadonlyMap<string, string> = new Map([
  ["AccessorProperty", "key"],
  ["MemberExpression", "property"],
  ["MethodDefinition", "key"],
  ["Property", "key"],
  ["PropertyDefinition", "key"],
]);

const OWN_NAME_FIELD: ReadonlyMap<string, string> = new Map([
  ["ClassDeclaration", "id"],
  ["ClassExpression", "id"],
  ["NewExpression", "callee"],
]);

const isDivertedUnder = (parent: AstFields, node: AstFields): boolean => {
  const parentNodeType = nodeTypeOf(parent);
  if (IMPORT_BINDING_NODE_TYPES.has(parentNodeType)) return false;

  const spelling = OWN_SPELLING_FIELD.get(parentNodeType);
  if (spelling !== undefined) return parent.computed === true || parent[spelling] !== node;

  const named = OWN_NAME_FIELD.get(parentNodeType);
  return named === undefined || parent[named] !== node;
};

const isDivertedReference = (visit: NodeVisit): boolean =>
  visit.ancestors.slice(-1).some((parent) => isDivertedUnder(parent, visit.node));

const divertedNamesIn = (visits: readonly NodeVisit[]): ReadonlySet<string> =>
  new Set(
    visits.flatMap((visit) => {
      const referencedSpelling = identifierNameOf(visit.node);
      return referencedSpelling === null || !isDivertedReference(visit) ? [] : [referencedSpelling];
    }),
  );

export const sourceFactsIn = (program: unknown): SourceFacts => {
  const visits = nodeVisitsIn(program);
  return {
    declaredClasses: declaredClassesIn(visits),
    constructions: constructionsIn(visits),
    divertedNames: divertedNamesIn(visits),
  };
};
