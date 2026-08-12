import { uniqBy } from "es-toolkit";

import { unwrapExpression } from "../lib/canonical-values/finite-value-syntax.ts";
import { canonicalValueStaticMemberName } from "./canonical-value-binding-member-call.ts";
import { canonicalValueEffectiveCalls } from "./canonical-value-binding-standard-call.ts";
import {
  canonicalValueArgumentExpression,
  canonicalValueCallArgumentSources,
  type CanonicalValueCallArgumentSource,
} from "./canonical-value-call-arguments.ts";
import { canonicalValueIsGlobalPromise } from "./canonical-value-promise-global.ts";

import type { ESTree, Variable } from "@oxlint/plugins";
import type {
  CanonicalValueCallableCandidate,
  CanonicalValueCallbackRuntime,
} from "./canonical-value-binding-call-types.ts";
import type {
  CanonicalValueCallArgumentSegment,
  CanonicalValueIdentifier,
} from "./canonical-value-binding-types.ts";

type PromiseExecutorRuntime = CanonicalValueCallbackRuntime;

type CanonicalValuePromiseChannel = readonly (readonly CanonicalValueCallArgumentSegment[])[];

export type CanonicalValuePromiseFlow = {
  readonly fulfilled: CanonicalValuePromiseChannel;
  readonly rejected: CanonicalValuePromiseChannel;
};

export const canonicalValueUnknownPromiseArgumentSet =
  (): readonly CanonicalValueCallArgumentSegment[] => [{ kind: "unknown", width: 1 }];

const unknownChannel = (): CanonicalValuePromiseChannel => [
  canonicalValueUnknownPromiseArgumentSet(),
];

const unknownFlow = (): CanonicalValuePromiseFlow => ({
  fulfilled: unknownChannel(),
  rejected: unknownChannel(),
});

const sourcedArgumentSet = (
  source: CanonicalValueCallArgumentSource,
): readonly CanonicalValueCallArgumentSegment[] => [
  { expression: source.expression, kind: "source", sourcePath: source.sourcePath },
];

const isFunctionCandidate = (
  candidate: CanonicalValueCallableCandidate,
): candidate is CanonicalValueCallableCandidate & {
  readonly node: ESTree.ArrowFunctionExpression | ESTree.Function;
} =>
  candidate.node.type === "ArrowFunctionExpression" ||
  candidate.node.type === "FunctionDeclaration" ||
  candidate.node.type === "FunctionExpression";

type AliasBindingInput = {
  readonly identifier: CanonicalValueIdentifier;
  readonly runtime: PromiseExecutorRuntime;
};

const variableAliasBinding = (input: AliasBindingInput): Variable | null => {
  const parent = input.identifier.parent;
  return parent.type === "VariableDeclarator" &&
    parent.id.type === "Identifier" &&
    parent.init !== null &&
    unwrapExpression(parent.init) === input.identifier
    ? input.runtime.runtime.resolveIdentifier(parent.id)
    : null;
};

const assignmentAliasBinding = (input: AliasBindingInput): Variable | null => {
  const parent = input.identifier.parent;
  return parent.type === "AssignmentExpression" &&
    parent.operator === "=" &&
    parent.left.type === "Identifier" &&
    unwrapExpression(parent.right) === input.identifier
    ? input.runtime.runtime.resolveIdentifier(parent.left)
    : null;
};

const boundAliasBinding = (input: AliasBindingInput): Variable | null => {
  const parent = input.identifier.parent;
  return parent.type === "MemberExpression" &&
    parent.object === input.identifier &&
    canonicalValueStaticMemberName(parent) === "bind" &&
    parent.parent.type === "CallExpression" &&
    parent.parent.callee === parent &&
    parent.parent.parent.type === "VariableDeclarator" &&
    parent.parent.parent.id.type === "Identifier" &&
    parent.parent.parent.init === parent.parent
    ? input.runtime.runtime.resolveIdentifier(parent.parent.parent.id)
    : null;
};

const directAliasBinding = (input: AliasBindingInput): Variable | null =>
  variableAliasBinding(input) ?? assignmentAliasBinding(input) ?? boundAliasBinding(input);

const settlementBindings = (input: {
  readonly pending: readonly Variable[];
  readonly runtime: PromiseExecutorRuntime;
  readonly seen: ReadonlySet<Variable>;
}): readonly Variable[] => {
  const [binding, ...remaining] = input.pending;
  if (binding === undefined) return [];
  if (input.seen.has(binding)) return settlementBindings({ ...input, pending: remaining });
  const aliases = binding.references.flatMap((reference) => {
    const alias = directAliasBinding({ identifier: reference.identifier, runtime: input.runtime });
    return alias === null ? [] : [alias];
  });
  return [
    binding,
    ...settlementBindings({
      pending: [...remaining, ...aliases],
      runtime: input.runtime,
      seen: new Set([...input.seen, binding]),
    }),
  ];
};

const nearestFunction = (
  node: ESTree.Node,
): ESTree.ArrowFunctionExpression | ESTree.Function | null => {
  const parent = node.parent;
  if (parent === null) return null;
  if (
    parent.type === "ArrowFunctionExpression" ||
    parent.type === "FunctionDeclaration" ||
    parent.type === "FunctionExpression"
  ) {
    return parent;
  }
  return nearestFunction(parent);
};

const callsBeforeOwner = (input: {
  readonly node: ESTree.Node;
  readonly owner: ESTree.ArrowFunctionExpression | ESTree.Function;
}): readonly ESTree.CallExpression[] => {
  if (input.node === input.owner || input.node.parent === null) return [];
  const parent: ESTree.Node = input.node.parent;
  return [
    ...(parent.type === "CallExpression" ? [parent] : []),
    ...callsBeforeOwner({ ...input, node: parent }),
  ];
};

const callableBinding = (
  runtime: PromiseExecutorRuntime,
  node: ESTree.ArrowFunctionExpression | ESTree.Function,
): Variable | null => {
  if (node.type !== "ArrowFunctionExpression" && node.id !== null) {
    return runtime.runtime.resolveIdentifier(node.id);
  }
  const parent = node.parent;
  return parent.type === "VariableDeclarator" &&
    parent.id.type === "Identifier" &&
    parent.init !== null &&
    unwrapExpression(parent.init) === node
    ? runtime.runtime.resolveIdentifier(parent.id)
    : null;
};

const callInvokesFunction = (input: {
  readonly call: ESTree.CallExpression;
  readonly runtime: PromiseExecutorRuntime;
  readonly target: ESTree.ArrowFunctionExpression | ESTree.Function;
}): boolean =>
  canonicalValueEffectiveCalls(
    {
      ...input.runtime.runtime,
      cutoff: input.call.end,
      identifierSources: input.runtime.identifierSources,
    },
    input.call,
  ).some((fact) =>
    input.runtime
      .callable({ ...input.runtime.runtime, cutoff: input.call.end }, fact.target)
      .some((candidate) => candidate.node === input.target),
  );

const functionInvocationCalls = (input: {
  readonly runtime: PromiseExecutorRuntime;
  readonly target: ESTree.ArrowFunctionExpression | ESTree.Function;
}): readonly ESTree.CallExpression[] => {
  const binding = callableBinding(input.runtime, input.target);
  const referenceCalls =
    binding?.references.flatMap((reference) => {
      const owner = nearestFunction(reference.identifier);
      return owner === null ? [] : callsBeforeOwner({ node: reference.identifier, owner });
    }) ?? [];
  const parent = input.target.parent;
  const inlineCalls =
    parent.type === "CallExpression" && unwrapExpression(parent.callee) === input.target
      ? [parent]
      : [];
  return uniqBy([...referenceCalls, ...inlineCalls], (call) => call).filter((call) =>
    callInvokesFunction({ ...input, call }),
  );
};

const functionExecutes = (input: {
  readonly function: ESTree.ArrowFunctionExpression | ESTree.Function;
  readonly root: ESTree.ArrowFunctionExpression | ESTree.Function;
  readonly runtime: PromiseExecutorRuntime;
  readonly seen: ReadonlySet<ESTree.Node>;
}): boolean => {
  if (input.function === input.root) return true;
  if (input.seen.has(input.function)) return false;
  const seen = new Set([...input.seen, input.function]);
  return functionInvocationCalls({ runtime: input.runtime, target: input.function }).some(
    (call) => {
      const caller = nearestFunction(call);
      return caller !== null && functionExecutes({ ...input, function: caller, seen });
    },
  );
};

const executingContainingCalls = (input: {
  readonly node: ESTree.Node;
  readonly owner: ESTree.ArrowFunctionExpression | ESTree.Function;
  readonly runtime: PromiseExecutorRuntime;
}): readonly ESTree.CallExpression[] => {
  const context = nearestFunction(input.node);
  if (
    context === null ||
    !functionExecutes({
      function: context,
      root: input.owner,
      runtime: input.runtime,
      seen: new Set(),
    })
  ) {
    return [];
  }
  return callsBeforeOwner({ node: input.node, owner: context });
};

const factTargetsBinding = (input: {
  readonly bindings: ReadonlySet<Variable>;
  readonly runtime: PromiseExecutorRuntime;
  readonly target: ESTree.Expression;
}): boolean => {
  const current = unwrapExpression(input.target);
  if (current.type !== "Identifier") return false;
  const binding = input.runtime.runtime.resolveIdentifier(current);
  return binding !== null && input.bindings.has(binding);
};

const settlementArgumentSets = (input: {
  readonly owner: ESTree.ArrowFunctionExpression | ESTree.Function;
  readonly parameterIndex: number;
  readonly runtime: PromiseExecutorRuntime;
}): CanonicalValuePromiseChannel => {
  const parameter = input.owner.params[input.parameterIndex];
  if (parameter?.type !== "Identifier") return [];
  const initial = input.runtime.runtime.resolveIdentifier(parameter);
  if (initial === null) return [];
  const bindings = settlementBindings({
    pending: [initial],
    runtime: input.runtime,
    seen: new Set(),
  });
  const bindingSet = new Set(bindings);
  const calls = uniqBy(
    bindings.flatMap((binding) =>
      binding.references.flatMap((reference) =>
        executingContainingCalls({
          node: reference.identifier,
          owner: input.owner,
          runtime: input.runtime,
        }),
      ),
    ),
    (call) => call,
  );
  return calls.flatMap((call) =>
    canonicalValueEffectiveCalls(
      {
        ...input.runtime.runtime,
        cutoff: call.end,
        identifierSources: input.runtime.identifierSources,
      },
      call,
    ).flatMap((fact) => {
      if (
        !factTargetsBinding({ bindings: bindingSet, runtime: input.runtime, target: fact.target })
      ) {
        return [];
      }
      const sources = canonicalValueCallArgumentSources(fact.argumentSegments, 0);
      return sources.length === 0
        ? [canonicalValueUnknownPromiseArgumentSet()]
        : sources.map(sourcedArgumentSet);
    }),
  );
};

export const canonicalValuePromiseExecutorCandidates = (
  input: PromiseExecutorRuntime & { readonly expression: ESTree.NewExpression },
): readonly CanonicalValueCallableCandidate[] => {
  if (!canonicalValueIsGlobalPromise(input.runtime, input.expression.callee)) return [];
  const executor = canonicalValueArgumentExpression(input.expression.arguments[0]);
  return executor === null ? [] : input.callable(input.runtime, executor);
};

export const canonicalValuePromiseExecutorFlow = (
  input: PromiseExecutorRuntime & { readonly expression: ESTree.NewExpression },
): CanonicalValuePromiseFlow | null => {
  if (!canonicalValueIsGlobalPromise(input.runtime, input.expression.callee)) return null;
  const candidates = canonicalValuePromiseExecutorCandidates(input).filter(isFunctionCandidate);
  if (candidates.length === 0) return unknownFlow();
  return candidates.reduce<CanonicalValuePromiseFlow>(
    (flow, candidate) => ({
      fulfilled: [
        ...flow.fulfilled,
        ...settlementArgumentSets({ owner: candidate.node, parameterIndex: 0, runtime: input }),
      ],
      rejected: [
        ...flow.rejected,
        ...settlementArgumentSets({ owner: candidate.node, parameterIndex: 1, runtime: input }),
        ...unknownChannel(),
      ],
    }),
    { fulfilled: [], rejected: [] },
  );
};
