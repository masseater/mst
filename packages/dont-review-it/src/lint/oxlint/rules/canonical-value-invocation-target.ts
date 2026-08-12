import {
  closedCandidateSet,
  flatMapCandidateSet,
  unknownCandidateSet,
  type CandidateSet,
} from "../lib/canonical-values/candidate-set.ts";
import {
  SCHEMA_ENUM_MEMBERS,
  SCHEMA_LITERAL_MEMBER,
  SCHEMA_UNION_MEMBER,
} from "../lib/canonical-values/finite-value-syntax.ts";
import { canonicalValueIsGlobalIdentifier } from "./canonical-value-global-identifier.ts";
import { canonicalValueImportedDefinitionName } from "./canonical-value-imported-name.ts";
import {
  canonicalValueInvocationFactKey,
  popCanonicalValueInvocationProperty,
  resolveCanonicalValueCallableOrigins,
  resolveCanonicalValueInvocationFacts,
} from "./canonical-value-invocation-normalization.ts";
import { canonicalValueInvocationPropertyPath } from "./canonical-value-invocation-path.ts";
import {
  canonicalValueExpressionOrigin,
  canonicalValueOriginKey,
  type CanonicalValueExpressionOrigin,
} from "./canonical-value-property-origin.ts";

import type { ESTree } from "@oxlint/plugins";
import type {
  CanonicalValueInvocationFact,
  CanonicalValueInvocationInternals,
  CanonicalValueInvocationTarget,
  CanonicalValueRecognizedInvocation,
  CanonicalValueSchemaMember,
} from "./canonical-value-invocation-types.ts";

export { canonicalValueInvocationPropertyPath } from "./canonical-value-invocation-path.ts";

const isSchemaMember = (candidate: string): candidate is CanonicalValueSchemaMember =>
  SCHEMA_ENUM_MEMBERS.has(candidate) ||
  candidate === SCHEMA_LITERAL_MEMBER ||
  candidate === SCHEMA_UNION_MEMBER;

const schemaMember = (
  state: CanonicalValueInvocationInternals,
  origin: CanonicalValueExpressionOrigin,
): CanonicalValueSchemaMember | null => {
  const member = canonicalValueInvocationPropertyPath(origin)?.at(-1);
  if (member !== undefined && isSchemaMember(member)) return member;
  if (origin.projections.length !== 0 || origin.expression.type !== "Identifier") return null;
  const binding = state.bindingIndex.resolveIdentifier(origin.expression);
  if (binding === null) return null;
  return (
    state.bindingIndex
      .definitionsOf(binding)
      .map(canonicalValueImportedDefinitionName)
      .find((name): name is CanonicalValueSchemaMember => name !== null && isSchemaMember(name)) ??
    null
  );
};

const isSetConstructor = (
  state: CanonicalValueInvocationInternals,
  origin: CanonicalValueExpressionOrigin,
): boolean => {
  const path = canonicalValueInvocationPropertyPath(origin);
  if (path === null) return false;
  if (path.length === 0) {
    return canonicalValueIsGlobalIdentifier(state.bindingIndex, {
      expression: origin.expression,
      name: "Set",
    });
  }
  return (
    path.length === 1 &&
    path[0] === "Set" &&
    canonicalValueIsGlobalIdentifier(state.bindingIndex, {
      expression: origin.expression,
      name: "globalThis",
    })
  );
};

const isSetPrototype = (
  state: CanonicalValueInvocationInternals,
  origin: CanonicalValueExpressionOrigin,
): boolean => {
  const path = canonicalValueInvocationPropertyPath(origin);
  if (path?.length === 1 && path[0] === "prototype") {
    return canonicalValueIsGlobalIdentifier(state.bindingIndex, {
      expression: origin.expression,
      name: "Set",
    });
  }
  return (
    path?.length === 2 &&
    path[0] === "Set" &&
    path[1] === "prototype" &&
    canonicalValueIsGlobalIdentifier(state.bindingIndex, {
      expression: origin.expression,
      name: "globalThis",
    })
  );
};

const targetKey = (target: CanonicalValueInvocationTarget): string =>
  target.kind === "schema"
    ? `schema:${target.member}:${canonicalValueOriginKey(target.origin)}`
    : `${target.kind}:${canonicalValueOriginKey(target.origin)}`;

const setTargetKind = (method: string): "set-add" | "set-clear" | "set-delete" => {
  if (method === "add") return "set-add";
  if (method === "clear") return "set-clear";
  return "set-delete";
};

const setTarget = (
  state: CanonicalValueInvocationInternals,
  origin: CanonicalValueExpressionOrigin,
): CandidateSet<CanonicalValueInvocationTarget> | null => {
  for (const method of ["add", "clear", "delete"] as const) {
    const receiver = popCanonicalValueInvocationProperty(origin, method);
    if (receiver === null) continue;
    return flatMapCandidateSet(setReceiver(state, receiver), {
      candidateKey: targetKey,
      mapCandidate: (candidate) =>
        closedCandidateSet(
          [{ kind: setTargetKind(method), origin, receiver: candidate }],
          targetKey,
        ),
    });
  }
  return null;
};

const setReceiver = (
  state: CanonicalValueInvocationInternals,
  origin: CanonicalValueExpressionOrigin,
): CandidateSet<CanonicalValueExpressionOrigin> => {
  if (isSetPrototype(state, origin)) return closedCandidateSet([origin], canonicalValueOriginKey);
  if (origin.projections.length !== 0) return unknownCandidateSet();
  if (origin.expression.type === "NewExpression") {
    const directConstructor = canonicalValueExpressionOrigin(origin.expression.callee);
    if (isSetConstructor(state, directConstructor)) {
      return closedCandidateSet([origin], canonicalValueOriginKey);
    }
    return flatMapCandidateSet(resolveCanonicalValueTargets(state, origin.expression.callee), {
      candidateKey: (candidate: CanonicalValueExpressionOrigin) =>
        canonicalValueOriginKey(candidate),
      mapCandidate: (target) =>
        target.kind === "set-constructor"
          ? closedCandidateSet([origin], canonicalValueOriginKey)
          : unknownCandidateSet(),
    });
  }
  if (origin.expression.type !== "CallExpression") return unknownCandidateSet();
  return flatMapCandidateSet(resolveCanonicalValueInvocationFacts(state, origin.expression), {
    candidateKey: (candidate: CanonicalValueExpressionOrigin) => canonicalValueOriginKey(candidate),
    mapCandidate: (fact) =>
      flatMapCandidateSet(resolveCanonicalValueTarget(state, fact.target), {
        candidateKey: (candidate: CanonicalValueExpressionOrigin) =>
          canonicalValueOriginKey(candidate),
        mapCandidate: (target) =>
          target.kind === "set-add"
            ? closedCandidateSet([target.receiver], canonicalValueOriginKey)
            : unknownCandidateSet(),
      }),
  });
};

const resolveCanonicalValueTarget = (
  state: CanonicalValueInvocationInternals,
  origin: CanonicalValueExpressionOrigin,
): CandidateSet<CanonicalValueInvocationTarget> => {
  const member = schemaMember(state, origin);
  if (member !== null) {
    return closedCandidateSet([{ kind: "schema", member, origin }], targetKey);
  }
  if (isSetConstructor(state, origin)) {
    return closedCandidateSet([{ kind: "set-constructor", origin }], targetKey);
  }
  return setTarget(state, origin) ?? unknownCandidateSet();
};

export const resolveCanonicalValueTargets = (
  state: CanonicalValueInvocationInternals,
  expression: ESTree.Expression,
): CandidateSet<CanonicalValueInvocationTarget> =>
  flatMapCandidateSet(resolveCanonicalValueCallableOrigins(state, expression), {
    candidateKey: targetKey,
    mapCandidate: (origin) => resolveCanonicalValueTarget(state, origin),
  });

const recognizedKey = (invocation: CanonicalValueRecognizedInvocation): string =>
  `${targetKey(invocation.target)}:${canonicalValueInvocationFactKey({
    ...invocation,
    target: invocation.target.origin,
  })}`;

export const recognizeCanonicalValueInvocationFacts = (
  state: CanonicalValueInvocationInternals,
  facts: CandidateSet<CanonicalValueInvocationFact>,
): CandidateSet<CanonicalValueRecognizedInvocation> =>
  flatMapCandidateSet(facts, {
    candidateKey: recognizedKey,
    mapCandidate: (fact) =>
      flatMapCandidateSet(resolveCanonicalValueTarget(state, fact.target), {
        candidateKey: recognizedKey,
        mapCandidate: (target) => closedCandidateSet([{ ...fact, target }], recognizedKey),
      }),
  });
