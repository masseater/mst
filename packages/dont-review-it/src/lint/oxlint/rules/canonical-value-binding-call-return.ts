import { canonicalValueCalledFunctions } from "./canonical-value-binding-call.ts";

import type { ESTree, Variable } from "@oxlint/plugins";
import type {
  CanonicalValueBindingWrite,
  CanonicalValueIdentifier,
  CanonicalValueYieldResult,
} from "./canonical-value-binding-types.ts";

type CallResultsInput<Result> = {
  readonly bindingWritesOf: (binding: Variable) => readonly CanonicalValueBindingWrite[];
  readonly invocation: ESTree.CallExpression | ESTree.NewExpression;
  readonly resolveIdentifier: (identifier: CanonicalValueIdentifier) => Variable | null;
  readonly resultsOf: (node: ESTree.ArrowFunctionExpression | ESTree.Function) => readonly Result[];
};

const canonicalValueCallResults = <Result>(input: CallResultsInput<Result>): readonly Result[] =>
  canonicalValueCalledFunctions(input).flatMap((called) => {
    const callable = called.node;
    return callable.type === "ArrowFunctionExpression" ||
      callable.type === "FunctionDeclaration" ||
      callable.type === "FunctionExpression"
      ? input.resultsOf(callable)
      : [];
  });

export const canonicalValueCallReturnResults = (
  input: CallResultsInput<ESTree.Expression>,
): readonly ESTree.Expression[] => canonicalValueCallResults(input);

export const canonicalValueCallYieldResults = (
  input: CallResultsInput<CanonicalValueYieldResult>,
): readonly CanonicalValueYieldResult[] => canonicalValueCallResults(input);
