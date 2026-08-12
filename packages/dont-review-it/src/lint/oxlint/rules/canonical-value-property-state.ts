import {
  joinCandidateSets,
  selectCandidateSet,
  unknownCandidateSet,
  type CandidateSet,
} from "../lib/canonical-values/candidate-set.ts";
import { createCycleMemo } from "../lib/canonical-values/cycle-memo.ts";
import { unwrapExpression } from "../lib/canonical-values/finite-value-syntax.ts";
import { propertyPathHasWildcard } from "../lib/canonical-values/property-path.ts";
import { createCanonicalValueAliasIndex } from "./canonical-value-alias-index.ts";
import {
  canonicalValuePropertyKeyOf,
  type CanonicalValueBindingIndex,
  type CanonicalValueExecutionContext,
} from "./canonical-value-binding-index.ts";
import { canonicalValueDefinitionIsAmbientVariable } from "./canonical-value-node-source-consumer.ts";
import { canonicalValueAsyncResultOrigins } from "./canonical-value-property-async-result.ts";
import { canonicalValueCollectionResultOrigins } from "./canonical-value-property-collection-result.ts";
import { resolveCanonicalValueCollectionExpression } from "./canonical-value-property-collection.ts";
import { canonicalValueObjectResultOrigins } from "./canonical-value-property-object-result.ts";
import {
  canonicalValueOriginKey,
  type CanonicalValueOrigin,
} from "./canonical-value-property-origin.ts";
import {
  canonicalValueExpressionOriginSet,
  canonicalValueNodeExecution,
  canonicalValueQueryWithDefaults,
  memoizedCanonicalValueOrigins,
  type CanonicalValuePropertyInternalQuery,
  type CanonicalValuePropertyInternals,
  type CanonicalValuePropertyQuery,
} from "./canonical-value-property-runtime.ts";
import {
  canonicalValueBranchSelection,
  createCanonicalValueStaticResolver,
  type CanonicalValueGuardExecution,
  type CanonicalValueStaticCondition,
  type CanonicalValueStaticPrimitive,
} from "./canonical-value-property-static.ts";
import { resolveCanonicalValueBindingOrigin } from "./canonical-value-property-write-state.ts";
import { type CanonicalValueStaticCallResolver } from "./canonical-value-static-query.ts";

import type { ESTree } from "@oxlint/plugins";
import type { CanonicalValueInvocationState } from "./canonical-value-invocation-types.ts";

export type CanonicalValuePropertyState = {
  readonly condition: (query: CanonicalValuePropertyQuery) => CanonicalValueStaticCondition | null;
  readonly execution: (node: ESTree.Node) => CanonicalValueGuardExecution;
  readonly origins: (query: CanonicalValuePropertyQuery) => CandidateSet<CanonicalValueOrigin>;
  readonly primitives: (
    query: CanonicalValuePropertyQuery & {
      readonly callResolver?: CanonicalValueStaticCallResolver;
    },
  ) => CandidateSet<CanonicalValueStaticPrimitive>;
  readonly propertyKeys: (query: {
    readonly callResolver?: CanonicalValueStaticCallResolver;
    readonly computed: boolean;
    readonly cutoff?: number;
    readonly executionContext?: CanonicalValueExecutionContext;
    readonly key: ESTree.Node;
  }) => CandidateSet<string>;
};

export const withCanonicalValueStaticCallResolver = (
  state: CanonicalValuePropertyState,
  callResolver: CanonicalValueStaticCallResolver,
): CanonicalValuePropertyState => ({
  ...state,
  primitives: (query) =>
    state.primitives({
      ...query,
      callResolver: query.callResolver ?? callResolver,
    }),
  propertyKeys: (query) =>
    state.propertyKeys({
      ...query,
      callResolver: query.callResolver ?? callResolver,
    }),
});

const resolveBranches = (
  state: CanonicalValuePropertyInternals,
  input: CanonicalValuePropertyInternalQuery & {
    readonly expression: ESTree.ConditionalExpression | ESTree.LogicalExpression;
  },
): CandidateSet<CanonicalValueOrigin> => {
  const test =
    input.expression.type === "ConditionalExpression"
      ? input.expression.test
      : input.expression.left;
  const condition = state.staticResolver.condition({ ...input, expression: test });
  const whenTrue =
    input.expression.type === "ConditionalExpression"
      ? input.expression.consequent
      : input.expression.right;
  const whenFalse =
    input.expression.type === "ConditionalExpression"
      ? input.expression.alternate
      : input.expression.left;
  return selectCandidateSet(canonicalValueBranchSelection(input.expression, condition), {
    candidateKey: canonicalValueOriginKey,
    whenFalse: resolveExpression(state, { ...input, expression: whenFalse }),
    whenTrue: resolveExpression(state, { ...input, expression: whenTrue }),
  });
};

const resolveIdentifier = (
  state: CanonicalValuePropertyInternals,
  input: CanonicalValuePropertyInternalQuery & {
    readonly expression: ESTree.IdentifierReference;
  },
): CandidateSet<CanonicalValueOrigin> => {
  const binding = state.bindingIndex.resolveIdentifier(input.expression);
  const definitions = binding === null ? [] : state.bindingIndex.definitionsOf(binding);
  return binding === null || definitions.every(canonicalValueDefinitionIsAmbientVariable)
    ? canonicalValueExpressionOriginSet(input.expression, input.path)
    : resolveCanonicalValueBindingOrigin(state, { ...input, binding, resolve: resolveExpression });
};

const memberPropertyPaths = (
  state: CanonicalValuePropertyInternals,
  input: CanonicalValuePropertyInternalQuery & { readonly expression: ESTree.MemberExpression },
): CandidateSet<string> =>
  state.staticResolver.propertyKeys(
    canonicalValuePropertyKeyOf(input.expression.property, input.expression.computed),
    input,
  );

const resolveGetterMember = (
  state: CanonicalValuePropertyInternals,
  input: CanonicalValuePropertyInternalQuery & { readonly expression: ESTree.MemberExpression },
): CandidateSet<CanonicalValueOrigin> | null => {
  const results = state.bindingIndex.memberReadResults(input.expression);
  if (results === null) return null;
  if (results.expressions.length === 0) return unknownCandidateSet();
  const origins = joinCandidateSets(
    results.expressions.map((expression) =>
      resolveExpression(state, {
        ...input,
        cutoff: expression.start,
        executionContext: state.bindingIndex.executionContextAt(expression),
        expression,
      }),
    ),
    canonicalValueOriginKey,
  );
  return results.complete ? origins : { ...origins, complete: false };
};

const resolveMember = (
  state: CanonicalValuePropertyInternals,
  input: CanonicalValuePropertyInternalQuery & { readonly expression: ESTree.MemberExpression },
): CandidateSet<CanonicalValueOrigin> => {
  if (input.expression.object.type === "Super") return unknownCandidateSet();
  const getter = resolveGetterMember(state, input);
  if (getter !== null) return getter;
  const keys = memberPropertyPaths(state, input);
  const origins = joinCandidateSets(
    keys.candidates.map((key) =>
      resolveExpression(state, {
        ...input,
        expression: input.expression.object,
        path: [key, ...input.path],
      }),
    ),
    canonicalValueOriginKey,
  );
  return keys.complete ? origins : { ...origins, complete: false };
};

const resolveReferenceExpression = (
  state: CanonicalValuePropertyInternals,
  input: CanonicalValuePropertyInternalQuery,
): CandidateSet<CanonicalValueOrigin> | null => {
  const expression = input.expression;
  if (expression.type === "Identifier") return resolveIdentifier(state, { ...input, expression });
  if (expression.type === "MemberExpression") return resolveMember(state, { ...input, expression });
  return null;
};

const resolveSequence = (
  state: CanonicalValuePropertyInternals,
  input: CanonicalValuePropertyInternalQuery & { readonly expression: ESTree.SequenceExpression },
): CandidateSet<CanonicalValueOrigin> => {
  const last = input.expression.expressions.at(-1);
  return last === undefined
    ? unknownCandidateSet()
    : resolveExpression(state, { ...input, expression: last });
};

const resolveFlowExpression = (
  state: CanonicalValuePropertyInternals,
  input: CanonicalValuePropertyInternalQuery,
): CandidateSet<CanonicalValueOrigin> | null => {
  const expression = input.expression;
  if (expression.type === "ConditionalExpression" || expression.type === "LogicalExpression") {
    return resolveBranches(state, { ...input, expression });
  }
  if (expression.type === "SequenceExpression") {
    return resolveSequence(state, { ...input, expression });
  }
  if (expression.type !== "AssignmentExpression") return null;
  return expression.operator === "="
    ? resolveExpression(state, { ...input, expression: expression.right })
    : unknownCandidateSet();
};

const preservesOpaquePropertyPath = (expression: ESTree.Expression): boolean =>
  expression.type === "AwaitExpression" ||
  expression.type === "CallExpression" ||
  expression.type === "ImportExpression" ||
  expression.type === "MetaProperty" ||
  expression.type === "NewExpression";

const preservesPrimitivePropertyPath = (input: CanonicalValuePropertyInternalQuery): boolean =>
  input.path.length === 1 &&
  (input.path[0] === "flags" ||
    input.path[0] === "length" ||
    input.path[0] === "name" ||
    input.path[0] === "source");

const fallbackExpressionOrigins = (
  input: CanonicalValuePropertyInternalQuery,
): CandidateSet<CanonicalValueOrigin> => {
  if (preservesPrimitivePropertyPath(input)) {
    return canonicalValueExpressionOriginSet(input.expression, input.path);
  }
  if (input.path.length !== 0 && preservesOpaquePropertyPath(input.expression)) {
    return canonicalValueExpressionOriginSet(input.expression, input.path);
  }
  return input.path.length === 0
    ? canonicalValueExpressionOriginSet(input.expression)
    : unknownCandidateSet();
};

const resolveStructuredExpression = (
  state: CanonicalValuePropertyInternals,
  input: CanonicalValuePropertyInternalQuery,
): CandidateSet<CanonicalValueOrigin> | null => {
  const collectionOrigins = canonicalValueCollectionResultOrigins(state, {
    ...input,
    resolve: resolveExpression,
  });
  if (collectionOrigins !== null) return collectionOrigins;
  const objectOrigins = canonicalValueObjectResultOrigins(state, {
    ...input,
    resolve: resolveExpression,
  });
  if (objectOrigins !== null) return objectOrigins;
  const asyncOrigins = canonicalValueAsyncResultOrigins(state, {
    ...input,
    resolve: resolveExpression,
  });
  if (asyncOrigins !== null) return asyncOrigins;
  if (input.expression.type !== "ArrayExpression" && input.expression.type !== "ObjectExpression") {
    return null;
  }
  return resolveCanonicalValueCollectionExpression(state, {
    ...input,
    expression: input.expression,
    resolve: resolveExpression,
  });
};

const resolveExpressionUncached = (
  state: CanonicalValuePropertyInternals,
  input: CanonicalValuePropertyInternalQuery,
): CandidateSet<CanonicalValueOrigin> => {
  const referenceOrigins = resolveReferenceExpression(state, input);
  if (referenceOrigins !== null) return referenceOrigins;
  const flowOrigins = resolveFlowExpression(state, input);
  if (flowOrigins !== null) return flowOrigins;
  const structuredOrigins = resolveStructuredExpression(state, input);
  if (structuredOrigins !== null) return structuredOrigins;
  return fallbackExpressionOrigins(input);
};

const resolveExpression = (
  state: CanonicalValuePropertyInternals,
  input: CanonicalValuePropertyInternalQuery,
): CandidateSet<CanonicalValueOrigin> => {
  const expression = unwrapExpression(input.expression);
  if (propertyPathHasWildcard(input.path)) return unknownCandidateSet();
  const query = { ...input, expression };
  return memoizedCanonicalValueOrigins({
    compute: () => resolveExpressionUncached(state, query),
    domain: false,
    identity: expression,
    query,
    state,
  });
};

const publicPropertyKeys = (
  state: CanonicalValuePropertyInternals,
  input: {
    readonly bindingIndex: CanonicalValueBindingIndex;
    readonly query: Parameters<CanonicalValuePropertyState["propertyKeys"]>[0];
  },
): CandidateSet<string> =>
  state.staticResolver.propertyKeys(
    canonicalValuePropertyKeyOf(input.query.key, input.query.computed),
    {
      callResolver: input.query.callResolver,
      cutoff: input.query.cutoff ?? input.query.key.start,
      executionContext:
        input.query.executionContext ?? input.bindingIndex.executionContextAt(input.query.key),
    },
  );

const declaredIdentifierCondition = (
  bindingIndex: CanonicalValueBindingIndex,
  expression: ESTree.IdentifierReference,
): CanonicalValueStaticCondition | null => {
  const binding = bindingIndex.resolveIdentifier(expression);
  if (binding === null) return null;
  const declared = bindingIndex
    .definitionsOf(binding)
    .some(
      (definition) =>
        definition.node.type === "ClassDeclaration" ||
        definition.node.type === "FunctionDeclaration",
    );
  return declared ? { nullish: false, truthy: true } : null;
};

export const createCanonicalValuePropertyState = (
  bindingIndex: CanonicalValueBindingIndex,
  invocationState?: Pick<CanonicalValueInvocationState, "argumentOrigins" | "facts">,
): CanonicalValuePropertyState => {
  const activeBindingQueries = new Set<string>();
  const aliasIndex = createCanonicalValueAliasIndex(bindingIndex);
  const memo = createCycleMemo<
    CandidateSet<CanonicalValueOrigin>,
    object,
    boolean,
    CanonicalValueExecutionContext
  >();
  const origins = (query: CanonicalValuePropertyQuery): CandidateSet<CanonicalValueOrigin> =>
    resolveExpression(state, canonicalValueQueryWithDefaults(bindingIndex, query));
  const staticResolver = createCanonicalValueStaticResolver({
    bindingIndex,
    declaredIdentifierCondition: (expression) =>
      declaredIdentifierCondition(bindingIndex, expression),
    resolveOrigins: origins,
  });
  const state: CanonicalValuePropertyInternals = {
    activeBindingQueries,
    aliasIndex,
    bindingIndex,
    invocationArgumentOrigins: (invocation, index) =>
      invocationState?.argumentOrigins(invocation, index) ?? unknownCandidateSet(),
    invocationFacts: (invocation) => invocationState?.facts(invocation) ?? unknownCandidateSet(),
    memo,
    staticResolver,
  };
  return {
    condition: (query) =>
      staticResolver.condition(canonicalValueQueryWithDefaults(bindingIndex, query)),
    execution: (node) => canonicalValueNodeExecution(state, node),
    origins,
    primitives: (query) =>
      staticResolver.primitives({
        ...canonicalValueQueryWithDefaults(bindingIndex, query),
        callResolver: query.callResolver,
      }),
    propertyKeys: (query) => publicPropertyKeys(state, { bindingIndex, query }),
  };
};
