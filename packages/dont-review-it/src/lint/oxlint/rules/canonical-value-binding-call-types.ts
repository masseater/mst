import type { ESTree, Variable } from "@oxlint/plugins";
import type {
  CanonicalValueBindingWrite,
  CanonicalValueCallArgumentSegment,
  CanonicalValueExecutionNode,
  CanonicalValueIdentifier,
} from "./canonical-value-binding-types.ts";

export type CanonicalValueBindingCallInput = {
  readonly bindingWritesOf: (binding: Variable) => readonly CanonicalValueBindingWrite[];
  readonly invocation:
    | ESTree.CallExpression
    | ESTree.NewExpression
    | ESTree.TaggedTemplateExpression;
  readonly resolveIdentifier: (identifier: CanonicalValueIdentifier) => Variable | null;
};

export type CanonicalValueCallableRuntime = Omit<CanonicalValueBindingCallInput, "invocation"> & {
  readonly cutoff: number;
  readonly seen: ReadonlySet<Variable>;
  readonly seenExpressions?: ReadonlySet<ESTree.Expression>;
};

export type CanonicalValueCallableCandidate = {
  readonly argumentSegments: readonly CanonicalValueCallArgumentSegment[];
  readonly node: CanonicalValueExecutionNode;
};

export type CanonicalValueCalledFunction = CanonicalValueCallableCandidate & {
  readonly source: ESTree.Expression;
};

export type CanonicalValueIdentifierSource = {
  readonly runtime: CanonicalValueCallableRuntime;
  readonly source: ESTree.Expression;
};

export type CanonicalValueCallableResolver = (
  runtime: CanonicalValueCallableRuntime,
  expression: ESTree.Expression,
) => readonly CanonicalValueCallableCandidate[];

export type CanonicalValueIdentifierSourceResolver = (
  runtime: CanonicalValueCallableRuntime,
  identifier: ESTree.IdentifierReference,
) => readonly CanonicalValueIdentifierSource[];

export type CanonicalValueCallbackRuntime = {
  readonly callable: CanonicalValueCallableResolver;
  readonly identifierSources: CanonicalValueIdentifierSourceResolver;
  readonly runtime: CanonicalValueCallableRuntime;
};

export type CanonicalValueResultCallbackRuntime = CanonicalValueCallbackRuntime & {
  readonly functionReturnResults: (
    node: ESTree.ArrowFunctionExpression | ESTree.Function,
  ) => readonly ESTree.Expression[];
};
