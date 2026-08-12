import { uniqBy } from "es-toolkit";

import {
  canonicalValueCallReturnResults,
  canonicalValueCallYieldResults,
} from "./canonical-value-binding-call-return.ts";
import {
  canonicalValueArrayCallbackFunctions,
  canonicalValueWellKnownSymbolFunctions,
} from "./canonical-value-binding-call.ts";
import { canonicalValueIsFunctionNode } from "./canonical-value-binding-execution.ts";

import type { ESTree, Variable } from "@oxlint/plugins";
import type { CanonicalValueBindingReturnIndex } from "./canonical-value-binding-return.ts";
import type {
  CanonicalValueBindingWrite,
  CanonicalValueCollectionCallbackResult,
  CanonicalValueIdentifier,
  CanonicalValueYieldResult,
} from "./canonical-value-binding-types.ts";

type BindingResultQueryRuntime = {
  readonly bindingWritesOf: (binding: Variable) => readonly CanonicalValueBindingWrite[];
  readonly resolveIdentifier: (identifier: CanonicalValueIdentifier) => Variable | null;
  readonly returnIndex: CanonicalValueBindingReturnIndex;
};

type BindingCallResultInput = BindingResultQueryRuntime & {
  readonly invocation: ESTree.CallExpression | ESTree.NewExpression;
};

export const canonicalValueBindingCallReturns = (
  input: BindingCallResultInput,
): readonly ESTree.Expression[] =>
  canonicalValueCallReturnResults({
    bindingWritesOf: input.bindingWritesOf,
    invocation: input.invocation,
    resolveIdentifier: input.resolveIdentifier,
    resultsOf: input.returnIndex.functionReturnResults,
  });

export const canonicalValueBindingCallYields = (
  input: BindingCallResultInput,
): readonly CanonicalValueYieldResult[] =>
  canonicalValueCallYieldResults({
    bindingWritesOf: input.bindingWritesOf,
    invocation: input.invocation,
    resolveIdentifier: input.resolveIdentifier,
    resultsOf: input.returnIndex.functionYieldResults,
  });

export const canonicalValueBindingCollectionCallbackResults = (
  input: BindingResultQueryRuntime & { readonly invocation: ESTree.CallExpression },
): readonly CanonicalValueCollectionCallbackResult[] =>
  uniqBy(
    canonicalValueArrayCallbackFunctions({
      bindingWritesOf: input.bindingWritesOf,
      functionReturnResults: input.returnIndex.functionReturnResults,
      invocation: input.invocation,
      resolveIdentifier: input.resolveIdentifier,
    }).flatMap((called) =>
      canonicalValueIsFunctionNode(called.node)
        ? [
            {
              functionNode: called.node,
              returnExpressions: input.returnIndex.functionReturnResults(called.node),
            },
          ]
        : [],
    ),
    (result) => result.functionNode,
  );

export const canonicalValueBindingCollectionCallbackReturns = (
  input: BindingResultQueryRuntime & { readonly invocation: ESTree.CallExpression },
): readonly ESTree.Expression[] =>
  canonicalValueArrayCallbackFunctions({
    bindingWritesOf: input.bindingWritesOf,
    functionReturnResults: input.returnIndex.functionReturnResults,
    invocation: input.invocation,
    resolveIdentifier: input.resolveIdentifier,
  }).flatMap((called) =>
    canonicalValueIsFunctionNode(called.node)
      ? input.returnIndex.functionReturnResults(called.node)
      : [],
  );

export const canonicalValueBindingIterableYields = (
  input: BindingResultQueryRuntime & { readonly expression: ESTree.Expression },
): readonly CanonicalValueYieldResult[] =>
  canonicalValueWellKnownSymbolFunctions({
    argumentSegments: [],
    bindingWritesOf: input.bindingWritesOf,
    expression: input.expression,
    name: "iterator",
    occurrence: input.expression,
    resolveIdentifier: input.resolveIdentifier,
  }).flatMap((called) =>
    canonicalValueIsFunctionNode(called.node)
      ? input.returnIndex.functionYieldResults(called.node)
      : [],
  );
