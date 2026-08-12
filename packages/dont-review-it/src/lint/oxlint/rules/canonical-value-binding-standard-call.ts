import { uniqBy } from "es-toolkit";

import { unwrapExpression } from "../lib/canonical-values/finite-value-syntax.ts";
import {
  canonicalValueAppendCallArgumentSegments,
  canonicalValueDirectCallArgumentSegments,
} from "./canonical-value-binding-call-segments.ts";
import { canonicalValueStaticMemberName } from "./canonical-value-binding-member-call.ts";
import {
  canonicalValueEffectiveCallArgumentExpressions,
  canonicalValueEffectiveCallArgumentsAfter,
} from "./canonical-value-binding-standard-arguments.ts";
import { type CanonicalValueStandardCallRuntime } from "./canonical-value-binding-standard-runtime.ts";
import { canonicalValueArgumentExpression } from "./canonical-value-call-arguments.ts";
import { canonicalValueFlowSources } from "./canonical-value-expression-flow.ts";
import { canonicalValueIsGlobalIdentifier } from "./canonical-value-global-identifier.ts";

import type { ESTree } from "@oxlint/plugins";
import type { CanonicalValueCallArgumentSegment } from "./canonical-value-binding-types.ts";

type InvocationFact = {
  readonly argumentSegments: readonly CanonicalValueCallArgumentSegment[];
  readonly target: ESTree.Expression;
  readonly thisArgument: ESTree.Expression | null;
};

export type CanonicalValueEffectiveCall = Pick<
  InvocationFact,
  "argumentSegments" | "target" | "thisArgument"
>;

type InvocationNormalizer = (
  runtime: CanonicalValueStandardCallRuntime,
  fact: InvocationFact,
) => readonly InvocationFact[];

const memberPath = (
  expression: ESTree.Expression,
): { readonly base: ESTree.Expression; readonly path: readonly string[] } => {
  const unwrapped = unwrapExpression(expression);
  if (unwrapped.type !== "MemberExpression" || unwrapped.object.type === "Super") {
    return { base: unwrapped, path: [] };
  }
  const name = canonicalValueStaticMemberName(unwrapped);
  if (name === null) return { base: unwrapped, path: [] };
  const parent = memberPath(unwrapped.object);
  return { base: parent.base, path: [...parent.path, name] };
};

const globalFunctionPath = (
  runtime: CanonicalValueStandardCallRuntime,
  input: { readonly base: ESTree.Expression; readonly path: readonly string[] },
): readonly string[] | null => {
  if (
    canonicalValueIsGlobalIdentifier(runtime, { expression: input.base, name: "Function" }) &&
    input.path.length === 2 &&
    input.path[0] === "prototype"
  ) {
    return input.path;
  }
  if (
    canonicalValueIsGlobalIdentifier(runtime, {
      expression: input.base,
      name: "globalThis",
    }) &&
    input.path.length === 3 &&
    input.path[0] === "Function" &&
    input.path[1] === "prototype"
  ) {
    return input.path.slice(1);
  }
  return null;
};

const globalReflectApply = (
  runtime: CanonicalValueStandardCallRuntime,
  input: { readonly base: ESTree.Expression; readonly path: readonly string[] },
): boolean =>
  (canonicalValueIsGlobalIdentifier(runtime, { expression: input.base, name: "Reflect" }) &&
    input.path.length === 1 &&
    input.path[0] === "apply") ||
  (canonicalValueIsGlobalIdentifier(runtime, {
    expression: input.base,
    name: "globalThis",
  }) &&
    input.path.length === 2 &&
    input.path[0] === "Reflect" &&
    input.path[1] === "apply");

const directStandardCallNormalizer = (
  runtime: CanonicalValueStandardCallRuntime,
  expression: ESTree.Expression,
): InvocationNormalizer | null => {
  const member = memberPath(expression);
  const functionPath = globalFunctionPath(runtime, member);
  if (functionPath?.[1] === "call") return normalizedFunctionCall;
  if (functionPath?.[1] === "apply") return normalizedFunctionApply;
  return globalReflectApply(runtime, member) ? normalizedReflectApply : null;
};

const standardCallNormalizers = (
  runtime: CanonicalValueStandardCallRuntime,
  expression: ESTree.Expression,
): readonly InvocationNormalizer[] => {
  const unwrapped = unwrapExpression(expression);
  const direct = directStandardCallNormalizer(runtime, unwrapped);
  if (direct !== null) return [direct];
  if (unwrapped.type === "Identifier") {
    return uniqBy(
      runtime
        .identifierSources(runtime, unwrapped)
        .flatMap(({ runtime: next, source }) =>
          standardCallNormalizers({ ...runtime, ...next }, source),
        ),
      (normalizer) => normalizer,
    );
  }
  const flows = canonicalValueFlowSources(unwrapped);
  return flows === null
    ? []
    : uniqBy(
        flows.flatMap((flow) => standardCallNormalizers(runtime, flow)),
        (normalizer) => normalizer,
      );
};

const normalizedFunctionCall = (
  runtime: CanonicalValueStandardCallRuntime,
  fact: InvocationFact,
): readonly InvocationFact[] => {
  if (fact.thisArgument === null) return [];
  const thisArguments = canonicalValueEffectiveCallArgumentExpressions(runtime, {
    index: 0,
    invocation: fact,
  });
  return thisArguments.map((thisArgument) => ({
    argumentSegments: canonicalValueEffectiveCallArgumentsAfter(runtime, {
      invocation: fact,
      startIndex: 1,
    }),
    target: fact.thisArgument as ESTree.Expression,
    thisArgument,
  }));
};

const normalizedFunctionApply = (
  runtime: CanonicalValueStandardCallRuntime,
  fact: InvocationFact,
): readonly InvocationFact[] => {
  if (fact.thisArgument === null) return [];
  const thisArguments = canonicalValueEffectiveCallArgumentExpressions(runtime, {
    index: 0,
    invocation: fact,
  });
  const argumentArrays = canonicalValueEffectiveCallArgumentExpressions(runtime, {
    index: 1,
    invocation: fact,
  });
  return thisArguments.flatMap((thisArgument) =>
    argumentArrays.map((argumentArray) => ({
      argumentSegments: [{ expression: argumentArray, kind: "array" }],
      target: fact.thisArgument as ESTree.Expression,
      thisArgument,
    })),
  );
};

const reflectedArgumentArrays = (input: {
  readonly argumentArrays: readonly ESTree.Expression[];
  readonly target: ESTree.Expression;
  readonly thisArgument: ESTree.Expression;
}): readonly InvocationFact[] =>
  input.argumentArrays.map((argumentArray) => ({
    argumentSegments: [{ expression: argumentArray, kind: "array" }],
    target: input.target,
    thisArgument: input.thisArgument,
  }));

const reflectedThisArguments = (input: {
  readonly argumentArrays: readonly ESTree.Expression[];
  readonly target: ESTree.Expression;
  readonly thisArguments: readonly ESTree.Expression[];
}): readonly InvocationFact[] =>
  input.thisArguments.flatMap((thisArgument) =>
    reflectedArgumentArrays({
      argumentArrays: input.argumentArrays,
      target: input.target,
      thisArgument,
    }),
  );

const normalizedReflectApply = (
  runtime: CanonicalValueStandardCallRuntime,
  fact: InvocationFact,
): readonly InvocationFact[] => {
  const targets = canonicalValueEffectiveCallArgumentExpressions(runtime, {
    index: 0,
    invocation: fact,
  });
  const thisArguments = canonicalValueEffectiveCallArgumentExpressions(runtime, {
    index: 1,
    invocation: fact,
  });
  const argumentArrays = canonicalValueEffectiveCallArgumentExpressions(runtime, {
    index: 2,
    invocation: fact,
  });
  return targets.flatMap((target) =>
    reflectedThisArguments({ argumentArrays, target, thisArguments }),
  );
};

const normalizeInvocation = (
  runtime: CanonicalValueStandardCallRuntime,
  input: { readonly fact: InvocationFact; readonly seen: ReadonlySet<string> },
): readonly InvocationFact[] => {
  const normalizers = standardCallNormalizers(runtime, input.fact.target);
  if (normalizers.length === 0) return [input.fact];
  const key = `${input.fact.target.start}:${input.fact.target.end}`;
  if (input.seen.has(key)) return [];
  const nextSeen = new Set([...input.seen, key]);
  return normalizers.flatMap((normalizer) => {
    const normalized = normalizer(runtime, input.fact);
    return normalized.flatMap((fact) => normalizeInvocation(runtime, { fact, seen: nextSeen }));
  });
};

const boundStandardCalls = (
  runtime: CanonicalValueStandardCallRuntime,
  input: CanonicalValueEffectiveCall,
): readonly InvocationFact[] => {
  const target = unwrapExpression(input.target);
  if (target.type === "Identifier") {
    return runtime
      .identifierSources(runtime, target)
      .flatMap(({ runtime: next, source }) =>
        boundStandardCalls({ ...runtime, ...next }, { ...input, target: source }),
      );
  }
  if (target.type !== "CallExpression") return [];
  const callee = unwrapExpression(target.callee);
  if (
    callee.type !== "MemberExpression" ||
    callee.object.type === "Super" ||
    canonicalValueStaticMemberName(callee) !== "bind"
  ) {
    return [];
  }
  const boundThis = canonicalValueArgumentExpression(target.arguments[0]);
  if (boundThis === null) return [];
  return normalizeInvocation(runtime, {
    fact: {
      argumentSegments: canonicalValueAppendCallArgumentSegments(
        canonicalValueDirectCallArgumentSegments(target.arguments.slice(1)),
        input.argumentSegments,
      ),
      target: callee.object,
      thisArgument: boundThis,
    },
    seen: new Set(),
  });
};

const rawApplyCall = (
  call: ESTree.CallExpression,
  callee: ESTree.MemberExpression & { readonly object: ESTree.Expression },
): InvocationFact => {
  const argumentArray = canonicalValueArgumentExpression(call.arguments[1]);
  return {
    argumentSegments:
      argumentArray === null
        ? [{ kind: "unknown" }]
        : [{ expression: argumentArray, kind: "array" }],
    target: callee.object,
    thisArgument: canonicalValueArgumentExpression(call.arguments[0]),
  };
};

const rawMemberCall = (
  runtime: CanonicalValueStandardCallRuntime,
  input: {
    readonly call: ESTree.CallExpression;
    readonly callee: ESTree.MemberExpression & { readonly object: ESTree.Expression };
  },
): InvocationFact => {
  if (standardCallNormalizers(runtime, input.callee).length !== 0) {
    return {
      argumentSegments: canonicalValueDirectCallArgumentSegments(input.call.arguments),
      target: input.callee,
      thisArgument: input.callee.object,
    };
  }
  const name = canonicalValueStaticMemberName(input.callee);
  if (name === "call") {
    return {
      argumentSegments: canonicalValueDirectCallArgumentSegments(input.call.arguments.slice(1)),
      target: input.callee.object,
      thisArgument: canonicalValueArgumentExpression(input.call.arguments[0]),
    };
  }
  return name === "apply"
    ? rawApplyCall(input.call, input.callee)
    : {
        argumentSegments: canonicalValueDirectCallArgumentSegments(input.call.arguments),
        target: input.callee,
        thisArgument: input.callee.object,
      };
};

const rawCall = (
  runtime: CanonicalValueStandardCallRuntime,
  call: ESTree.CallExpression,
): InvocationFact | null => {
  const callee = unwrapExpression(call.callee);
  if (callee.type === "Super") return null;
  if (callee.type !== "MemberExpression" || callee.object.type === "Super") {
    return {
      argumentSegments: canonicalValueDirectCallArgumentSegments(call.arguments),
      target: callee,
      thisArgument: null,
    };
  }
  return rawMemberCall(runtime, { call, callee });
};

export const canonicalValueEffectiveCalls = (
  runtime: CanonicalValueStandardCallRuntime,
  call: ESTree.CallExpression,
): readonly CanonicalValueEffectiveCall[] => {
  const raw = rawCall(runtime, call);
  if (raw === null) return [];
  const bound = boundStandardCalls(runtime, raw);
  const normalized =
    bound.length === 0 ? normalizeInvocation(runtime, { fact: raw, seen: new Set() }) : bound;
  return uniqBy(normalized, (fact) => [fact.target, ...fact.argumentSegments]);
};
