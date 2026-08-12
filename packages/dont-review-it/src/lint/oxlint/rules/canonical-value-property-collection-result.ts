import {
  closedCandidateSet,
  openCandidateSet,
  type CandidateSet,
} from "../lib/canonical-values/candidate-set.ts";
import { unwrapExpression } from "../lib/canonical-values/finite-value-syntax.ts";
import { canonicalValueArrayResultTransformMethod } from "./canonical-value-array-result-transform.ts";
import { canonicalValueDirectCallArgumentSegments } from "./canonical-value-binding-call-segments.ts";
import { canonicalValueStaticMemberName } from "./canonical-value-binding-member-call.ts";
import { canonicalValueArgumentExpression } from "./canonical-value-call-arguments.ts";
import {
  canonicalValueIsGlobalIdentifier,
  canonicalValueIsGlobalMember,
} from "./canonical-value-global-identifier.ts";
import { canonicalValueStandardCollectionInvocationOrigins } from "./canonical-value-property-collection-invocation.ts";
import {
  canonicalValueExpressionOrigin,
  canonicalValueOriginKey,
  type CanonicalValueOrigin,
} from "./canonical-value-property-origin.ts";
import { canonicalValueSplitVector } from "./canonical-value-property-split.ts";

import type { ESTree } from "@oxlint/plugins";
import type { CanonicalValueCallArgumentSegment } from "./canonical-value-binding-types.ts";
import type {
  CanonicalValuePropertyInternals,
  CanonicalValueResolvedPropertyQuery,
} from "./canonical-value-property-runtime.ts";
import type { CanonicalValueStaticPrimitive } from "./canonical-value-static-primitive.ts";

type CollectionResultInput = CanonicalValueResolvedPropertyQuery;

const isGlobal = (input: {
  readonly expression: ESTree.Expression;
  readonly name: string;
  readonly state: CanonicalValuePropertyInternals;
}): boolean =>
  canonicalValueIsGlobalIdentifier(input.state.bindingIndex, {
    expression: input.expression,
    name: input.name,
  });

const globalMember = (input: {
  readonly member: ESTree.MemberExpression & { readonly object: ESTree.Expression };
  readonly objectName: string;
  readonly state: CanonicalValuePropertyInternals;
}): boolean => {
  return canonicalValueIsGlobalMember(input.state.bindingIndex, input);
};

const resultOrigin = (
  input: CollectionResultInput & {
    readonly segments: readonly CanonicalValueCallArgumentSegment[];
  },
): CandidateSet<CanonicalValueOrigin> =>
  closedCandidateSet(
    [
      canonicalValueExpressionOrigin(input.expression, [
        { kind: "call-arguments", segments: input.segments, startIndex: 0 },
        ...(input.path.length === 0 ? [] : [{ kind: "property" as const, path: input.path }]),
      ]),
    ],
    canonicalValueOriginKey,
  );

const directResultOrigin = (
  input: CollectionResultInput & { readonly arguments: readonly ESTree.Argument[] },
): CandidateSet<CanonicalValueOrigin> =>
  resultOrigin({
    ...input,
    segments: canonicalValueDirectCallArgumentSegments(input.arguments),
  });

const arrayConstructorOrigins = (
  state: CanonicalValuePropertyInternals,
  input: CollectionResultInput & {
    readonly expression: ESTree.CallExpression | ESTree.NewExpression;
  },
): CandidateSet<CanonicalValueOrigin> | null => {
  const callee = unwrapExpression(input.expression.callee);
  if (!isGlobal({ expression: callee, name: "Array", state })) return null;
  return directResultOrigin({ ...input, arguments: input.expression.arguments });
};

const objectValueArguments = (
  object: ESTree.ObjectExpression,
): readonly ESTree.Argument[] | null => {
  const arguments_ = object.properties.flatMap((property) =>
    property.type === "Property" ? [property.value] : [],
  );
  return arguments_.length === object.properties.length ? arguments_ : null;
};

const objectValueOrigins = (
  state: CanonicalValuePropertyInternals,
  input: CollectionResultInput & {
    readonly call: ESTree.CallExpression;
    readonly member: ESTree.MemberExpression & { readonly object: ESTree.Expression };
  },
): CandidateSet<CanonicalValueOrigin> | null => {
  if (
    canonicalValueStaticMemberName(input.member) !== "values" ||
    !globalMember({ member: input.member, objectName: "Object", state })
  ) {
    return null;
  }
  const argument = canonicalValueArgumentExpression(input.call.arguments[0]);
  const object = argument === null ? null : unwrapExpression(argument);
  if (object?.type !== "ObjectExpression") return null;
  const valueArguments = objectValueArguments(object);
  return valueArguments === null
    ? null
    : directResultOrigin({ ...input, arguments: valueArguments });
};

const propertyNameOrigins = (
  state: CanonicalValuePropertyInternals,
  input: CollectionResultInput & {
    readonly call: ESTree.CallExpression;
    readonly member: ESTree.MemberExpression & { readonly object: ESTree.Expression };
  },
): CandidateSet<CanonicalValueOrigin> | null => {
  const name = canonicalValueStaticMemberName(input.member);
  const supported =
    (name === "getOwnPropertyNames" &&
      globalMember({ member: input.member, objectName: "Object", state })) ||
    (name === "ownKeys" && globalMember({ member: input.member, objectName: "Reflect", state }));
  const argument = supported ? canonicalValueArgumentExpression(input.call.arguments[0]) : null;
  if (argument === null) return null;
  return closedCandidateSet(
    [
      canonicalValueExpressionOrigin(argument, [
        { kind: "property-name" },
        ...(input.path.length === 0 ? [] : [{ kind: "property" as const, path: input.path }]),
      ]),
    ],
    canonicalValueOriginKey,
  );
};

const concatSegments = (
  receiver: ESTree.Expression,
  arguments_: readonly ESTree.Argument[],
): readonly CanonicalValueCallArgumentSegment[] => [
  { expression: receiver, kind: "array" },
  ...arguments_.map((argument): CanonicalValueCallArgumentSegment => {
    if (argument.type === "SpreadElement") return { kind: "unknown" };
    return unwrapExpression(argument).type === "ArrayExpression"
      ? { expression: argument, kind: "array" }
      : { elements: [argument], kind: "direct" };
  }),
];

const receiverCollectionOrigins = (
  state: CanonicalValuePropertyInternals,
  input: CollectionResultInput & {
    readonly call: ESTree.CallExpression;
    readonly member: ESTree.MemberExpression & { readonly object: ESTree.Expression };
  },
): CandidateSet<CanonicalValueOrigin> | null => {
  const name = canonicalValueStaticMemberName(input.member);
  if (name === "split") return splitCollectionOrigins(state, input);
  if (name === "concat") {
    return resultOrigin({
      ...input,
      segments: concatSegments(input.member.object, input.call.arguments),
    });
  }
  const transformMethod = canonicalValueArrayResultTransformMethod(name ?? "");
  if (transformMethod !== null) {
    return closedCandidateSet(
      [
        canonicalValueExpressionOrigin(input.expression, [
          {
            kind: "call-arguments",
            segments: [{ expression: input.member.object, kind: "array" }],
            startIndex: 0,
          },
          {
            arguments: input.call.arguments,
            kind: "array-transform",
            method: transformMethod,
          },
          ...(input.path.length === 0 ? [] : [{ kind: "property" as const, path: input.path }]),
        ]),
      ],
      canonicalValueOriginKey,
    );
  }
  if (name !== "toReversed" && name !== "toSorted") return null;
  return resultOrigin({
    ...input,
    segments: [{ expression: input.member.object, kind: "array" }],
  });
};

const callbackReturnOrigins = (
  state: CanonicalValuePropertyInternals,
  input: CollectionResultInput & {
    readonly call: ESTree.CallExpression;
    readonly flatten: boolean;
  },
): CandidateSet<CanonicalValueOrigin> | null => {
  const returns = state.bindingIndex.collectionCallbackReturnResults(input.call);
  if (returns.length === 0) return null;
  const segments = returns.map(
    (expression): CanonicalValueCallArgumentSegment =>
      input.flatten && unwrapExpression(expression).type === "ArrayExpression"
        ? { expression, kind: "array" }
        : { elements: [expression], kind: "direct" },
  );
  const origins = resultOrigin({ ...input, segments });
  return openCandidateSet(origins.candidates, canonicalValueOriginKey);
};

const reduceResultOrigins = (
  input: CollectionResultInput & {
    readonly call: ESTree.CallExpression;
    readonly member: ESTree.MemberExpression & { readonly object: ESTree.Expression };
    readonly method: "reduce" | "reduce-right";
  },
): CandidateSet<CanonicalValueOrigin> =>
  closedCandidateSet(
    [
      canonicalValueExpressionOrigin(input.expression, [
        {
          kind: "call-arguments",
          segments: [{ expression: input.member.object, kind: "array" }],
          startIndex: 0,
        },
        {
          arguments: input.call.arguments,
          kind: "array-transform",
          method: input.method,
        },
        ...(input.path.length === 0 ? [] : [{ kind: "property" as const, path: input.path }]),
      ]),
    ],
    canonicalValueOriginKey,
  );

const callbackCollectionOrigins = (
  state: CanonicalValuePropertyInternals,
  input: CollectionResultInput & {
    readonly call: ESTree.CallExpression;
    readonly member: ESTree.MemberExpression & { readonly object: ESTree.Expression };
  },
): CandidateSet<CanonicalValueOrigin> | null => {
  const name = canonicalValueStaticMemberName(input.member);
  if (name === "map") return callbackReturnOrigins(state, { ...input, flatten: false });
  if (name === "flatMap") return callbackReturnOrigins(state, { ...input, flatten: true });
  if (name === "reduce" || name === "reduceRight") {
    return reduceResultOrigins({
      ...input,
      method: name === "reduce" ? "reduce" : "reduce-right",
    });
  }
  const arrayFrom =
    name === "from" && globalMember({ member: input.member, objectName: "Array", state });
  return arrayFrom && input.call.arguments.length >= 2
    ? callbackReturnOrigins(state, { ...input, flatten: false })
    : null;
};

const primitiveCandidates = (
  state: CanonicalValuePropertyInternals,
  input: CollectionResultInput & { readonly expression: ESTree.Expression },
): CandidateSet<CanonicalValueStaticPrimitive> =>
  state.staticResolver.primitives({
    cutoff: input.cutoff,
    executionContext: input.executionContext,
    expression: input.expression,
  });

const splitArgumentCandidates = (
  state: CanonicalValuePropertyInternals,
  input: CollectionResultInput & {
    readonly argument: ESTree.Argument | undefined;
    readonly fallback: CanonicalValueStaticPrimitive;
  },
): CandidateSet<CanonicalValueStaticPrimitive> | null => {
  if (input.argument === undefined) {
    return closedCandidateSet([input.fallback], (primitive) => `${typeof primitive}:${primitive}`);
  }
  return input.argument.type === "SpreadElement"
    ? null
    : primitiveCandidates(state, { ...input, expression: input.argument });
};

const splitVectorsForSeparator = (input: {
  readonly limits: CandidateSet<CanonicalValueStaticPrimitive>;
  readonly receiver: string;
  readonly separator: CanonicalValueStaticPrimitive;
}): readonly (readonly string[])[] =>
  input.limits.candidates.flatMap((limit) => {
    const splitItems = canonicalValueSplitVector({
      limit,
      receiver: input.receiver,
      separator: input.separator,
    });
    return splitItems === null ? [] : [splitItems];
  });

const splitVectorsForReceiver = (input: {
  readonly limits: CandidateSet<CanonicalValueStaticPrimitive>;
  readonly receiver: CanonicalValueStaticPrimitive;
  readonly separators: CandidateSet<CanonicalValueStaticPrimitive>;
}): readonly (readonly string[])[] =>
  typeof input.receiver !== "string"
    ? []
    : input.separators.candidates.flatMap((separator) =>
        splitVectorsForSeparator({ ...input, receiver: input.receiver as string, separator }),
      );

const splitCollectionOrigins = (
  state: CanonicalValuePropertyInternals,
  input: CollectionResultInput & {
    readonly call: ESTree.CallExpression;
    readonly member: ESTree.MemberExpression & { readonly object: ESTree.Expression };
  },
): CandidateSet<CanonicalValueOrigin> | null => {
  const receivers = primitiveCandidates(state, { ...input, expression: input.member.object });
  const separators = splitArgumentCandidates(state, {
    ...input,
    argument: input.call.arguments[0],
    fallback: undefined,
  });
  const limits = splitArgumentCandidates(state, {
    ...input,
    argument: input.call.arguments[1],
    fallback: undefined,
  });
  if (separators === null || limits === null) return null;
  const vectors = receivers.candidates.flatMap((receiver) =>
    splitVectorsForReceiver({ limits, receiver, separators }),
  );
  if (vectors.length === 0) return null;
  const origins = vectors.map((splitItems) =>
    canonicalValueExpressionOrigin(input.expression, [
      { kind: "static-values", values: splitItems },
      ...(input.path.length === 0 ? [] : [{ kind: "property" as const, path: input.path }]),
    ]),
  );
  const complete = receivers.complete && separators.complete && limits.complete;
  return complete
    ? closedCandidateSet(origins, canonicalValueOriginKey)
    : openCandidateSet(origins, canonicalValueOriginKey);
};

const callOrigins = (
  state: CanonicalValuePropertyInternals,
  input: CollectionResultInput & { readonly expression: ESTree.CallExpression },
): CandidateSet<CanonicalValueOrigin> | null => {
  const standard = canonicalValueStandardCollectionInvocationOrigins(state, input);
  if (standard !== null) return standard;
  const constructor = arrayConstructorOrigins(state, input);
  if (constructor !== null) return constructor;
  const callee = unwrapExpression(input.expression.callee);
  if (callee.type !== "MemberExpression" || callee.object.type === "Super") return null;
  if (
    canonicalValueStaticMemberName(callee) === "of" &&
    globalMember({ member: callee, objectName: "Array", state })
  ) {
    return directResultOrigin({ ...input, arguments: input.expression.arguments });
  }
  return (
    objectValueOrigins(state, { ...input, call: input.expression, member: callee }) ??
    propertyNameOrigins(state, { ...input, call: input.expression, member: callee }) ??
    callbackCollectionOrigins(state, {
      ...input,
      call: input.expression,
      member: callee,
    }) ??
    receiverCollectionOrigins(state, { ...input, call: input.expression, member: callee })
  );
};

export const canonicalValueCollectionResultOrigins = (
  state: CanonicalValuePropertyInternals,
  input: CollectionResultInput,
): CandidateSet<CanonicalValueOrigin> | null => {
  if (input.expression.type === "CallExpression") {
    return callOrigins(state, { ...input, expression: input.expression });
  }
  return input.expression.type === "NewExpression"
    ? arrayConstructorOrigins(state, { ...input, expression: input.expression })
    : null;
};
