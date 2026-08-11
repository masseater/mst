import { FUNCTION_NODE_TYPES } from "../node-kinds.ts";
import { nodeTypeOf } from "../setup-modules/coupling-edges.ts";
import { chainFrom, fieldOf, innermostOf, kindAt, visitAt, type NodeVisit } from "./node-visits.ts";
import { flowsOutOf } from "./value-outflow.ts";

import type { AstFields } from "../ast-node.ts";

export type Surroundings = {
  readonly visits: readonly NodeVisit[];
  readonly scope: AstFields;
};

type Trace = {
  readonly surroundings: Surroundings;
  readonly followed: ReadonlySet<string>;
};

export const identifierNameOf = (held: unknown): string | null =>
  kindAt(held) === "Identifier" ? String(fieldOf(held, "name")) : null;

export const heldNamesOf = (visit: NodeVisit): readonly string[] => {
  const named =
    nodeTypeOf(visit.node) === "FunctionDeclaration"
      ? [identifierNameOf(visit.node.id)]
      : visit.ancestors
          .slice(-1)
          .flatMap((parent) => (parent.init === visit.node ? [identifierNameOf(parent.id)] : []));
  return named.flatMap((name) => (name === null ? [] : [name]));
};

const nestedScopeOf = ({ scope }: Surroundings, visit: NodeVisit): AstFields | null =>
  innermostOf(chainFrom(visit, scope).slice(1), FUNCTION_NODE_TYPES);

const isReadReference = (visit: NodeVisit): boolean =>
  visit.ancestors.slice(-1).every((parent) => {
    switch (nodeTypeOf(parent)) {
      case "MemberExpression":
        return parent.computed === true || parent.property !== visit.node;
      case "Property":
        return parent.computed === true || parent.key !== visit.node;
      case "VariableDeclarator":
        return parent.id !== visit.node;
      default:
        return true;
    }
  });

const referencesTo = (surroundings: Surroundings, name: string): readonly NodeVisit[] =>
  surroundings.visits.filter(
    (visit) =>
      identifierNameOf(visit.node) === name &&
      visit.ancestors.includes(surroundings.scope) &&
      isReadReference(visit),
  );

const bindingEscapes = (trace: Trace, name: string): boolean =>
  referencesTo(trace.surroundings, name).some((visit) => referenceEscapes(trace, visit));

const capturingScopeEscapes = (trace: Trace, visit: NodeVisit): boolean => {
  const { surroundings, followed } = trace;
  const [held] = heldNamesOf(visit);
  if (held !== undefined) {
    const deeper = { surroundings, followed: new Set([...followed, held]) };
    return followed.has(held) ? false : bindingEscapes(deeper, held);
  }

  const outer = nestedScopeOf(surroundings, visit);
  if (outer === null) return flowsOutOf(visit.node, chainFrom(visit, surroundings.scope));
  if (flowsOutOf(visit.node, chainFrom(visit, outer))) return true;
  return capturingScopeEscapes(trace, visitAt(visit, outer));
};

const referenceEscapes = (trace: Trace, visit: NodeVisit): boolean => {
  const nested = nestedScopeOf(trace.surroundings, visit);
  if (nested === null) {
    return flowsOutOf(visit.node, chainFrom(visit, trace.surroundings.scope));
  }
  if (flowsOutOf(visit.node, chainFrom(visit, nested))) return true;
  return capturingScopeEscapes(trace, visitAt(visit, nested));
};

export const constructedValueEscapes = (
  surroundings: Surroundings,
  construction: NodeVisit,
): boolean => {
  const [held] = heldNamesOf(construction);
  if (held === undefined) {
    return flowsOutOf(construction.node, chainFrom(construction, surroundings.scope));
  }
  return bindingEscapes({ surroundings, followed: new Set([held]) }, held);
};
