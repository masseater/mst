import {
  absentCandidateSet,
  closedCandidateSet,
  flatMapCandidateSet,
  joinCandidateSets,
  selectCandidateSet,
  unknownCandidateSet,
  type CandidateSet,
} from "../lib/canonical-values/candidate-set.ts";
import { unwrapExpression } from "../lib/canonical-values/finite-value-syntax.ts";
import {
  PROPERTY_PATH_WILDCARD,
  propertyPathKey,
  type PropertyPath,
} from "../lib/canonical-values/property-path.ts";
import {
  canonicalValuePropertyKeyOf,
  type CanonicalValueBindingIndex,
  type CanonicalValueIndexedPropertyPath,
  type CanonicalValuePropertyKey,
  type CanonicalValueSourcePath,
} from "./canonical-value-binding-index.ts";
import { canonicalValueBranchSelection } from "./canonical-value-property-static.ts";

import type { ESTree, Variable } from "@oxlint/plugins";
import type {
  CanonicalValuePropertyInternalQuery,
  CanonicalValuePropertyInternals,
} from "./canonical-value-property-runtime.ts";

export type CanonicalValueAliasAddress = {
  readonly binding: Variable;
  readonly path: PropertyPath;
};

export type CanonicalValueAliasedAddress = CanonicalValueAliasAddress & {
  readonly definite: boolean;
};

export type CanonicalValueAliasRuntime = {
  readonly bindingIndex: CanonicalValueBindingIndex;
  readonly propertyState: CanonicalValuePropertyInternals;
};

const bindingKey = (binding: Variable): string => {
  const identifier = binding.identifiers.at(0) ?? binding.defs.at(0)?.name;
  return `${binding.scope.block.start}:${binding.scope.block.end}:${binding.name}:${identifier?.start ?? "implicit"}`;
};

export const canonicalValueAliasAddressKey = (address: CanonicalValueAliasAddress): string =>
  `${bindingKey(address.binding)}:${propertyPathKey(address.path)}`;

export const appendCanonicalValueAliasAddressPath = (
  address: CanonicalValueAliasAddress,
  suffix: PropertyPath,
): CanonicalValueAliasAddress => ({ ...address, path: [...address.path, ...suffix] });

const appendAddressPaths = (input: {
  readonly addresses: CandidateSet<CanonicalValueAliasAddress>;
  readonly paths: CandidateSet<PropertyPath>;
}): CandidateSet<CanonicalValueAliasAddress> =>
  flatMapCandidateSet(input.addresses, {
    candidateKey: canonicalValueAliasAddressKey,
    mapCandidate: (address) =>
      flatMapCandidateSet(input.paths, {
        candidateKey: canonicalValueAliasAddressKey,
        mapCandidate: (path) =>
          closedCandidateSet(
            [appendCanonicalValueAliasAddressPath(address, path)],
            canonicalValueAliasAddressKey,
          ),
      }),
  });

const staticPropertyKeys = (
  runtime: CanonicalValueAliasRuntime,
  input: {
    readonly propertyKey: CanonicalValuePropertyKey;
    readonly query: CanonicalValuePropertyInternalQuery;
  },
): CandidateSet<string> =>
  runtime.propertyState.staticResolver.propertyKeys(input.propertyKey, {
    cutoff: input.query.cutoff,
    executionContext: input.query.executionContext,
  });

const aliasPropertyKeyPaths = (keys: CandidateSet<string>): CandidateSet<PropertyPath> => ({
  candidates: [
    ...keys.candidates.map((key) => [key] as const),
    ...(keys.complete ? [] : [[PROPERTY_PATH_WILDCARD] as const]),
  ],
  complete: keys.complete,
});

const staticCondition = (
  runtime: CanonicalValueAliasRuntime,
  input: {
    readonly expression: ESTree.Expression;
    readonly query: CanonicalValuePropertyInternalQuery;
  },
) =>
  runtime.propertyState.staticResolver.condition({
    cutoff: input.query.cutoff,
    executionContext: input.query.executionContext,
    expression: input.expression,
  });

const propertyKeyPaths = (
  runtime: CanonicalValueAliasRuntime,
  input: {
    readonly computed: boolean;
    readonly key: ESTree.Node;
    readonly query: CanonicalValuePropertyInternalQuery;
  },
): CandidateSet<PropertyPath> => {
  const keys = staticPropertyKeys(runtime, {
    propertyKey: canonicalValuePropertyKeyOf(input.key, input.computed),
    query: input.query,
  });
  return aliasPropertyKeyPaths(keys);
};

export const canonicalValueAliasIndexedPaths = (
  runtime: CanonicalValueAliasRuntime,
  input: {
    readonly indexedPath: CanonicalValueIndexedPropertyPath;
    readonly query: CanonicalValuePropertyInternalQuery;
  },
): CandidateSet<PropertyPath> =>
  input.indexedPath.reduce<CandidateSet<PropertyPath>>(
    (paths, segment) => {
      const keys = staticPropertyKeys(runtime, { propertyKey: segment, query: input.query });
      return flatMapCandidateSet(paths, {
        candidateKey: propertyPathKey,
        mapCandidate: (path) =>
          flatMapCandidateSet(aliasPropertyKeyPaths(keys), {
            candidateKey: propertyPathKey,
            mapCandidate: (keyPath) => closedCandidateSet([[...path, ...keyPath]], propertyPathKey),
          }),
      });
    },
    closedCandidateSet([[]], propertyPathKey),
  );

const identifierAddresses = (
  runtime: CanonicalValueAliasRuntime,
  expression: ESTree.IdentifierReference,
): CandidateSet<CanonicalValueAliasAddress> => {
  const binding = runtime.bindingIndex.resolveIdentifier(expression);
  return binding === null
    ? unknownCandidateSet()
    : closedCandidateSet([{ binding, path: [] }], canonicalValueAliasAddressKey);
};

const memberAddresses = (
  runtime: CanonicalValueAliasRuntime,
  input: CanonicalValuePropertyInternalQuery & { readonly expression: ESTree.MemberExpression },
): CandidateSet<CanonicalValueAliasAddress> => {
  if (input.expression.object.type === "Super") return unknownCandidateSet();
  return appendAddressPaths({
    addresses: expressionAddresses(runtime, {
      ...input,
      expression: input.expression.object,
    }),
    paths: propertyKeyPaths(runtime, {
      computed: input.expression.computed,
      key: input.expression.property,
      query: input,
    }),
  });
};

const conditionalAddresses = (
  runtime: CanonicalValueAliasRuntime,
  input: CanonicalValuePropertyInternalQuery & {
    readonly expression: ESTree.ConditionalExpression;
  },
): CandidateSet<CanonicalValueAliasAddress> => {
  const condition = staticCondition(runtime, {
    expression: input.expression.test,
    query: input,
  });
  return selectCandidateSet(condition?.truthy ?? "unknown", {
    candidateKey: canonicalValueAliasAddressKey,
    whenFalse: expressionAddresses(runtime, {
      ...input,
      expression: input.expression.alternate,
    }),
    whenTrue: expressionAddresses(runtime, {
      ...input,
      expression: input.expression.consequent,
    }),
  });
};

const logicalAddresses = (
  runtime: CanonicalValueAliasRuntime,
  input: CanonicalValuePropertyInternalQuery & { readonly expression: ESTree.LogicalExpression },
): CandidateSet<CanonicalValueAliasAddress> => {
  const condition = staticCondition(runtime, {
    expression: input.expression.left,
    query: input,
  });
  return selectCandidateSet(canonicalValueBranchSelection(input.expression, condition), {
    candidateKey: canonicalValueAliasAddressKey,
    whenFalse: expressionAddresses(runtime, {
      ...input,
      expression: input.expression.left,
    }),
    whenTrue: expressionAddresses(runtime, {
      ...input,
      expression: input.expression.right,
    }),
  });
};

const referenceAddresses = (
  runtime: CanonicalValueAliasRuntime,
  input: CanonicalValuePropertyInternalQuery,
): CandidateSet<CanonicalValueAliasAddress> | null => {
  if (input.expression.type === "Identifier") {
    return identifierAddresses(runtime, input.expression);
  }
  return input.expression.type === "MemberExpression"
    ? memberAddresses(runtime, { ...input, expression: input.expression })
    : null;
};

const flowAddresses = (
  runtime: CanonicalValueAliasRuntime,
  input: CanonicalValuePropertyInternalQuery,
): CandidateSet<CanonicalValueAliasAddress> | null => {
  if (input.expression.type === "ConditionalExpression") {
    return conditionalAddresses(runtime, { ...input, expression: input.expression });
  }
  if (input.expression.type === "LogicalExpression") {
    return logicalAddresses(runtime, { ...input, expression: input.expression });
  }
  if (input.expression.type === "SequenceExpression") {
    const last = input.expression.expressions.at(-1);
    return last === undefined
      ? absentCandidateSet()
      : expressionAddresses(runtime, { ...input, expression: last });
  }
  if (input.expression.type !== "AssignmentExpression") return null;
  return input.expression.operator === "="
    ? expressionAddresses(runtime, { ...input, expression: input.expression.right })
    : unknownCandidateSet();
};

const freshIdentityExpression = (expression: ESTree.Expression): boolean =>
  expression.type === "ArrayExpression" ||
  expression.type === "ArrowFunctionExpression" ||
  expression.type === "ClassExpression" ||
  expression.type === "FunctionExpression" ||
  expression.type === "Literal" ||
  expression.type === "NewExpression" ||
  expression.type === "ObjectExpression" ||
  expression.type === "TemplateLiteral";

const expressionAddresses = (
  runtime: CanonicalValueAliasRuntime,
  rawInput: CanonicalValuePropertyInternalQuery,
): CandidateSet<CanonicalValueAliasAddress> => {
  const input = { ...rawInput, expression: unwrapExpression(rawInput.expression) };
  const reference = referenceAddresses(runtime, input);
  if (reference !== null) return reference;
  const flow = flowAddresses(runtime, input);
  if (flow !== null) return flow;
  return freshIdentityExpression(input.expression) ? absentCandidateSet() : unknownCandidateSet();
};

const defaultSegmentAddresses = (
  runtime: CanonicalValueAliasRuntime,
  input: {
    readonly addresses: CandidateSet<CanonicalValueAliasAddress>;
    readonly expression: ESTree.Expression;
    readonly query: CanonicalValuePropertyInternalQuery;
  },
): CandidateSet<CanonicalValueAliasAddress> => {
  const fallback = expressionAddresses(runtime, {
    ...input.query,
    expression: input.expression,
  });
  return joinCandidateSets([input.addresses, fallback], canonicalValueAliasAddressKey);
};

const sourceSegmentAddresses = (
  runtime: CanonicalValueAliasRuntime,
  input: {
    readonly addresses: CandidateSet<CanonicalValueAliasAddress>;
    readonly query: CanonicalValuePropertyInternalQuery;
    readonly segment: CanonicalValueSourcePath[number];
  },
): CandidateSet<CanonicalValueAliasAddress> => {
  if (input.segment.kind === "array-index") {
    return appendAddressPaths({
      addresses: input.addresses,
      paths: closedCandidateSet([[String(input.segment.index)]], propertyPathKey),
    });
  }
  if (input.segment.kind === "property") {
    const keys = staticPropertyKeys(runtime, {
      propertyKey: input.segment.key,
      query: input.query,
    });
    return appendAddressPaths({
      addresses: input.addresses,
      paths: aliasPropertyKeyPaths(keys),
    });
  }
  if (
    input.segment.kind === "array-element" ||
    input.segment.kind === "array-rest" ||
    input.segment.kind === "call-rest" ||
    input.segment.kind === "object-rest" ||
    input.segment.kind === "property-name" ||
    input.segment.kind === "static-values" ||
    input.segment.kind === "unknown"
  ) {
    return absentCandidateSet();
  }
  return defaultSegmentAddresses(runtime, {
    addresses: input.addresses,
    expression: input.segment.expression,
    query: input.query,
  });
};

export const canonicalValueAliasSourcePathAddresses = (
  runtime: CanonicalValueAliasRuntime,
  input: CanonicalValuePropertyInternalQuery & {
    readonly sourcePath: CanonicalValueSourcePath;
  },
): CandidateSet<CanonicalValueAliasAddress> =>
  input.sourcePath.reduce(
    (addresses, segment) => sourceSegmentAddresses(runtime, { addresses, query: input, segment }),
    expressionAddresses(runtime, input),
  );
