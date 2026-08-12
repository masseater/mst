import {
  closedCandidateSet,
  flatMapCandidateSet,
  selectCandidateSet,
  unknownCandidateSet,
  type CandidateSelection,
  type CandidateSet,
} from "../lib/canonical-values/candidate-set.ts";
import { createCycleMemo } from "../lib/canonical-values/cycle-memo.ts";
import { unwrapExpression } from "../lib/canonical-values/finite-value-syntax.ts";
import { canonicalValueStandardPathIsStable } from "./canonical-value-standard-stability.ts";
import { resolveCanonicalValueBinaryPrimitive } from "./canonical-value-static-binary.ts";
import {
  canonicalValueStaticGuardExecution,
  canonicalValueStaticNodeGuardExecution,
} from "./canonical-value-static-guard.ts";
import { resolveCanonicalValueStaticMemberPrimitive } from "./canonical-value-static-member.ts";
import { resolveCanonicalValueStaticOriginPrimitive } from "./canonical-value-static-origin.ts";
import {
  resolveCanonicalValueLiteralPrimitive,
  canonicalValueStaticPrimitiveKey as staticPrimitiveKey,
  resolveCanonicalValueTemplatePrimitive,
  resolveCanonicalValueUnaryPrimitive,
  type CanonicalValueStaticPrimitive,
} from "./canonical-value-static-primitive.ts";
import { resolveCanonicalValueStaticPropertyKey } from "./canonical-value-static-property-key.ts";
import {
  type CanonicalValueStaticCallResolver,
  type CanonicalValueStaticQuery,
} from "./canonical-value-static-query.ts";

import type { ESTree } from "@oxlint/plugins";
import type {
  CanonicalValueBindingIndex,
  CanonicalValueExecutionContext,
  CanonicalValueGuard,
  CanonicalValuePropertyKey,
} from "./canonical-value-binding-index.ts";
import type { CanonicalValueOrigin } from "./canonical-value-property-origin.ts";

export type { CanonicalValueStaticPrimitive } from "./canonical-value-static-primitive.ts";

export type CanonicalValueStaticCondition = {
  readonly nullish: boolean;
  readonly truthy: boolean;
};

export type CanonicalValueGuardExecution = {
  readonly definite: boolean;
  readonly executes: boolean;
};

export type CanonicalValueStaticResolver = {
  readonly condition: (query: CanonicalValueStaticQuery) => CanonicalValueStaticCondition | null;
  readonly emptyObjectSpread: (query: CanonicalValueStaticQuery) => boolean;
  readonly guardExecution: (
    guard: CanonicalValueGuard,
    executionContext: CanonicalValueExecutionContext,
  ) => CanonicalValueGuardExecution;
  readonly primitives: (
    query: CanonicalValueStaticQuery,
  ) => CandidateSet<CanonicalValueStaticPrimitive>;
  readonly propertyKeys: (
    propertyKey: CanonicalValuePropertyKey,
    query: Omit<CanonicalValueStaticQuery, "expression">,
  ) => CandidateSet<string>;
};

type StaticRuntime = {
  readonly condition: (query: CanonicalValueStaticQuery) => CanonicalValueStaticCondition | null;
  readonly declaredIdentifierCondition: (
    expression: ESTree.IdentifierReference,
  ) => CanonicalValueStaticCondition | null;
  readonly resolve: (
    query: CanonicalValueStaticQuery,
  ) => CandidateSet<CanonicalValueStaticPrimitive>;
  readonly resolveOrigins: (query: CanonicalValueStaticQuery) => CandidateSet<CanonicalValueOrigin>;
  readonly standardPathStable: (input: {
    readonly path: readonly string[];
    readonly query: Omit<CanonicalValueStaticQuery, "expression">;
  }) => boolean;
};

const conditionFromCandidates = (
  candidates: CandidateSet<CanonicalValueStaticPrimitive>,
): CanonicalValueStaticCondition | null => {
  const conditions = candidates.candidates.map((primitive) => ({
    nullish: primitive === null || primitive === undefined,
    truthy: Boolean(primitive),
  }));
  const first = conditions[0];
  if (!candidates.complete || first === undefined) return null;
  return conditions.every(
    (condition) => condition.nullish === first.nullish && condition.truthy === first.truthy,
  )
    ? first
    : null;
};

export const canonicalValueBranchSelection = (
  expression: ESTree.ConditionalExpression | ESTree.LogicalExpression,
  condition: CanonicalValueStaticCondition | null,
): CandidateSelection => {
  if (condition === null) return "unknown";
  if (expression.type === "ConditionalExpression") return condition.truthy;
  if (expression.operator === "??") return condition.nullish;
  return expression.operator === "&&" ? condition.truthy : !condition.truthy;
};

const branchCandidates = (
  runtime: StaticRuntime,
  input: {
    readonly expression: ESTree.ConditionalExpression | ESTree.LogicalExpression;
    readonly query: CanonicalValueStaticQuery;
  },
): CandidateSet<CanonicalValueStaticPrimitive> => {
  const test =
    input.expression.type === "ConditionalExpression"
      ? input.expression.test
      : input.expression.left;
  const whenTrue =
    input.expression.type === "ConditionalExpression"
      ? input.expression.consequent
      : input.expression.right;
  const whenFalse =
    input.expression.type === "ConditionalExpression"
      ? input.expression.alternate
      : input.expression.left;
  return selectCandidateSet(
    canonicalValueBranchSelection(
      input.expression,
      runtime.condition({ ...input.query, expression: test }),
    ),
    {
      candidateKey: staticPrimitiveKey,
      whenFalse: runtime.resolve({ ...input.query, expression: whenFalse }),
      whenTrue: runtime.resolve({ ...input.query, expression: whenTrue }),
    },
  );
};

const primitivesThroughOrigins = (
  runtime: StaticRuntime,
  query: CanonicalValueStaticQuery,
): CandidateSet<CanonicalValueStaticPrimitive> =>
  flatMapCandidateSet(runtime.resolveOrigins(query), {
    candidateKey: staticPrimitiveKey,
    mapCandidate: (origin) =>
      resolveCanonicalValueStaticOriginPrimitive(runtime, { origin, query }),
  });

const undefinedPrimitive = (
  runtime: StaticRuntime,
  query: CanonicalValueStaticQuery,
): CandidateSet<CanonicalValueStaticPrimitive> => {
  const origins = runtime.resolveOrigins(query);
  if (!origins.complete && origins.candidates.length === 0) return unknownCandidateSet();
  const hasDifferentOrigin = origins.candidates.some(
    (origin) => origin.kind === "expression" && origin.expression !== query.expression,
  );
  return hasDifferentOrigin
    ? primitivesThroughOrigins(runtime, query)
    : closedCandidateSet([undefined], staticPrimitiveKey);
};

const trailingPrimitive = (
  runtime: StaticRuntime,
  query: CanonicalValueStaticQuery,
): CandidateSet<CanonicalValueStaticPrimitive> | null => {
  const expression = query.expression;
  if (expression.type === "SequenceExpression") {
    const last = expression.expressions.at(-1);
    return last === undefined
      ? unknownCandidateSet()
      : runtime.resolve({ ...query, expression: last });
  }
  if (expression.type === "AssignmentExpression" && expression.operator === "=") {
    return runtime.resolve({ ...query, expression: expression.right });
  }
  return null;
};

const directStructuredPrimitive = (
  runtime: StaticRuntime,
  query: CanonicalValueStaticQuery,
): CandidateSet<CanonicalValueStaticPrimitive> | null => {
  const expression = query.expression;
  if (expression.type === "BinaryExpression" && expression.left.type !== "PrivateIdentifier") {
    return resolveCanonicalValueBinaryPrimitive({
      expression: expression as ESTree.BinaryExpression & { readonly left: ESTree.Expression },
      resolve: (operand) => runtime.resolve({ ...query, expression: operand }),
    });
  }
  if (expression.type === "TemplateLiteral") {
    return resolveCanonicalValueTemplatePrimitive({
      expression,
      resolve: (substitution) => runtime.resolve({ ...query, expression: substitution }),
    });
  }
  return null;
};

const structuredPrimitive = (
  runtime: StaticRuntime,
  query: CanonicalValueStaticQuery,
): CandidateSet<CanonicalValueStaticPrimitive> | null => {
  const direct = directStructuredPrimitive(runtime, query);
  if (direct !== null) return direct;
  const expression = query.expression;
  if (expression.type === "UnaryExpression") {
    const operator = expression.operator;
    return flatMapCandidateSet(runtime.resolve({ ...query, expression: expression.argument }), {
      candidateKey: staticPrimitiveKey,
      mapCandidate: (primitive) => resolveCanonicalValueUnaryPrimitive(operator, primitive),
    });
  }
  if (expression.type === "ConditionalExpression" || expression.type === "LogicalExpression") {
    return branchCandidates(runtime, { expression, query });
  }
  return trailingPrimitive(runtime, query);
};

const alwaysTruthyExpression = (expression: ESTree.Expression): boolean =>
  expression.type === "ArrayExpression" ||
  expression.type === "ArrowFunctionExpression" ||
  expression.type === "ClassExpression" ||
  expression.type === "FunctionExpression" ||
  expression.type === "NewExpression" ||
  expression.type === "ObjectExpression" ||
  (expression.type === "Literal" && "regex" in expression);

const directMemberPrimitive = (
  runtime: StaticRuntime,
  query: CanonicalValueStaticQuery,
): CandidateSet<CanonicalValueStaticPrimitive> | null =>
  query.expression.type === "MemberExpression"
    ? resolveCanonicalValueStaticMemberPrimitive(runtime, {
        ...query,
        expression: query.expression,
      })
    : null;

const directCallPrimitive = (
  query: CanonicalValueStaticQuery,
  resolve: (query: CanonicalValueStaticQuery) => CandidateSet<CanonicalValueStaticPrimitive>,
): CandidateSet<CanonicalValueStaticPrimitive> | null => {
  if (
    (query.expression.type !== "CallExpression" &&
      query.expression.type !== "TaggedTemplateExpression") ||
    query.callResolver === undefined
  ) {
    return null;
  }
  return query.callResolver({ expression: query.expression, query, resolve });
};

const globalConstantPrimitive = (
  bindingIndex: CanonicalValueBindingIndex,
  query: CanonicalValueStaticQuery,
): CandidateSet<CanonicalValueStaticPrimitive> | null => {
  if (query.expression.type !== "Identifier") return null;
  const binding = bindingIndex.resolveIdentifier(query.expression);
  if (binding !== null && bindingIndex.definitionsOf(binding).length !== 0) return null;
  if (query.expression.name === "NaN") {
    return closedCandidateSet([Number.NaN], staticPrimitiveKey);
  }
  if (query.expression.name === "Infinity") {
    return closedCandidateSet([Number.POSITIVE_INFINITY], staticPrimitiveKey);
  }
  return query.expression.name === "undefined"
    ? closedCandidateSet([undefined], staticPrimitiveKey)
    : null;
};

const directlyResolvedPrimitive = (
  runtime: StaticRuntime,
  input: {
    readonly query: CanonicalValueStaticQuery;
    readonly resolve: StaticRuntime["resolve"];
  },
): CandidateSet<CanonicalValueStaticPrimitive> | null => {
  const literal = resolveCanonicalValueLiteralPrimitive(input.query.expression);
  if (literal !== null) return literal;
  const member = directMemberPrimitive(runtime, input.query);
  if (member !== null) return member;
  const structured = structuredPrimitive(runtime, input.query);
  if (structured !== null) return structured;
  return directCallPrimitive(input.query, input.resolve);
};

const fallbackPrimitive = (
  runtime: StaticRuntime,
  input: {
    readonly bindingIndex: CanonicalValueBindingIndex;
    readonly query: CanonicalValueStaticQuery;
  },
): CandidateSet<CanonicalValueStaticPrimitive> => {
  const globalConstant = globalConstantPrimitive(input.bindingIndex, input.query);
  if (globalConstant !== null) return globalConstant;
  return input.query.expression.type === "Identifier" && input.query.expression.name === "undefined"
    ? undefinedPrimitive(runtime, input.query)
    : primitivesThroughOrigins(runtime, input.query);
};

export const createCanonicalValueStaticResolver = ({
  bindingIndex,
  declaredIdentifierCondition,
  resolveOrigins,
}: {
  readonly bindingIndex: CanonicalValueBindingIndex;
  readonly declaredIdentifierCondition: (
    expression: ESTree.IdentifierReference,
  ) => CanonicalValueStaticCondition | null;
  readonly resolveOrigins: (query: CanonicalValueStaticQuery) => CandidateSet<CanonicalValueOrigin>;
}): CanonicalValueStaticResolver => {
  const memo = createCycleMemo<
    CandidateSet<CanonicalValueStaticPrimitive>,
    ESTree.Expression,
    CanonicalValueStaticCallResolver | boolean,
    CanonicalValueExecutionContext
  >();
  const runtime: StaticRuntime = {
    condition: (query) => condition(query),
    declaredIdentifierCondition,
    resolve: (query) => resolve(query),
    resolveOrigins,
    standardPathStable: (input) =>
      canonicalValueStandardPathIsStable(
        {
          bindingIndex,
          execution: (node) =>
            canonicalValueStaticNodeGuardExecution(runtime, { bindingIndex, node }),
        },
        { ...input.query, path: input.path },
      ),
  };

  const resolveUncached = (
    query: CanonicalValueStaticQuery,
  ): CandidateSet<CanonicalValueStaticPrimitive> => {
    const direct = directlyResolvedPrimitive(runtime, { query, resolve });
    return direct ?? fallbackPrimitive(runtime, { bindingIndex, query });
  };

  const resolve = (
    query: CanonicalValueStaticQuery,
  ): CandidateSet<CanonicalValueStaticPrimitive> => {
    const expression = unwrapExpression(query.expression);
    const entry = memo.enter({
      cutoff: query.cutoff,
      domain: query.callResolver ?? true,
      executionContext: query.executionContext,
      identity: expression,
      path: [],
    });
    if (entry.kind === "cycle") return unknownCandidateSet();
    if (entry.kind === "cached") return entry.value;
    const primitives = resolveUncached({ ...query, expression });
    entry.complete(primitives);
    return primitives;
  };

  const condition = (query: CanonicalValueStaticQuery): CanonicalValueStaticCondition | null => {
    const expression = unwrapExpression(query.expression);
    if (alwaysTruthyExpression(expression)) return { nullish: false, truthy: true };
    if (expression.type === "Identifier") {
      const declared = runtime.declaredIdentifierCondition(expression);
      if (declared !== null) return declared;
    }
    return conditionFromCandidates(resolve({ ...query, expression }));
  };

  const propertyKeys: CanonicalValueStaticResolver["propertyKeys"] = (propertyKey, query) =>
    resolveCanonicalValueStaticPropertyKey(
      { bindingIndex, resolveOrigins: runtime.resolveOrigins, resolvePrimitives: resolve },
      { propertyKey, query },
    );

  const guardExecution: CanonicalValueStaticResolver["guardExecution"] = (
    guard,
    executionContext,
  ) => canonicalValueStaticGuardExecution(runtime, { executionContext, guard });

  return {
    condition,
    emptyObjectSpread: (query) => {
      const primitives = resolve(query);
      return (
        primitives.complete &&
        primitives.candidates.length !== 0 &&
        primitives.candidates.every(
          (primitive) => typeof primitive !== "string" || primitive === "",
        )
      );
    },
    guardExecution,
    primitives: resolve,
    propertyKeys,
  };
};
