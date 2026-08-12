import { canonicalValueIsFunctionNode } from "./canonical-value-binding-execution.ts";
import {
  canonicalValueCallArgumentsHaveKnownWidths,
  canonicalValueCallArgumentSources,
  canonicalValueDirectRestSource,
} from "./canonical-value-call-arguments.ts";

import type { ESTree } from "@oxlint/plugins";
import type { CanonicalValueCalledFunction } from "./canonical-value-binding-call.ts";
import type {
  CanonicalValueExecutionContext,
  CanonicalValueSourcePath,
} from "./canonical-value-binding-types.ts";

type ParameterRuntime = {
  readonly executionContextAt: (node: ESTree.Node) => CanonicalValueExecutionContext;
  readonly record: (write: {
    readonly expression: ESTree.Expression;
    readonly invocation: ESTree.Node;
    readonly operator: "parameter";
    readonly sourceContext: {
      readonly cutoff: number;
      readonly executionContext: CanonicalValueExecutionContext;
    };
    readonly sourcePath: CanonicalValueSourcePath;
    readonly start: number;
    readonly target: ESTree.Node;
  }) => void;
};

const recordRestParameter = (
  runtime: ParameterRuntime,
  input: {
    readonly called: CanonicalValueCalledFunction;
    readonly index: number;
    readonly parameter: Extract<ESTree.ParamPattern, { readonly type: "RestElement" }>;
    readonly occurrence: ESTree.Node;
  },
): void => {
  const directSource = canonicalValueDirectRestSource(input.called.argumentSegments, input.index);
  const expression = directSource?.expression ?? input.called.source;
  runtime.record({
    expression,
    invocation: input.occurrence,
    operator: "parameter",
    sourceContext: {
      cutoff: expression.start,
      executionContext: runtime.executionContextAt(expression),
    },
    sourcePath: directSource?.sourcePath ?? [
      {
        kind: "call-rest",
        segments: input.called.argumentSegments,
        startIndex: input.index,
      },
    ],
    start: input.parameter.start,
    target: input.parameter.argument,
  });
};

const recordFixedParameter = (
  runtime: ParameterRuntime,
  input: {
    readonly called: CanonicalValueCalledFunction;
    readonly index: number;
    readonly parameter: Exclude<ESTree.ParamPattern, { readonly type: "RestElement" }>;
    readonly occurrence: ESTree.Node;
  },
): void => {
  const sources = canonicalValueCallArgumentSources(input.called.argumentSegments, input.index);
  for (const source of sources) {
    runtime.record({
      expression: source.expression,
      invocation: input.occurrence,
      operator: "parameter",
      sourceContext: {
        cutoff: source.expression.start,
        executionContext: runtime.executionContextAt(source.expression),
      },
      sourcePath: source.sourcePath,
      start: input.parameter.start,
      target: input.parameter,
    });
  }
  if (
    sources.length !== 0 &&
    canonicalValueCallArgumentsHaveKnownWidths(input.called.argumentSegments)
  ) {
    return;
  }
  runtime.record({
    expression: input.called.source,
    invocation: input.occurrence,
    operator: "parameter",
    sourceContext: {
      cutoff: input.called.source.start,
      executionContext: runtime.executionContextAt(input.called.source),
    },
    sourcePath: [{ kind: "unknown" }],
    start: input.parameter.start,
    target: input.parameter,
  });
};

const recordParameter = (
  runtime: ParameterRuntime,
  input: {
    readonly called: CanonicalValueCalledFunction;
    readonly index: number;
    readonly parameter: ESTree.ParamPattern;
    readonly occurrence: ESTree.Node;
  },
): void => {
  if (input.parameter.type === "RestElement") {
    recordRestParameter(runtime, { ...input, parameter: input.parameter });
  } else {
    recordFixedParameter(runtime, { ...input, parameter: input.parameter });
  }
};

export const recordCanonicalValueCalledParameters = (
  runtime: ParameterRuntime,
  input: { readonly called: CanonicalValueCalledFunction; readonly occurrence: ESTree.Node },
): void => {
  if (!canonicalValueIsFunctionNode(input.called.node)) return;
  input.called.node.params.forEach((parameter, index) => {
    recordParameter(runtime, { ...input, index, parameter });
  });
};
