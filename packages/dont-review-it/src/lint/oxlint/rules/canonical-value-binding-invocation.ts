import { unwrapExpression } from "../lib/canonical-values/finite-value-syntax.ts";
import {
  canonicalValueAdvancedGeneratorFunctions,
  canonicalValueAsyncCallbackFunctions,
  canonicalValueArrayCallbackFunctions,
  canonicalValueCalledFunctions,
  canonicalValueDerivedSuperFunctions,
  canonicalValueExternalCallbackFunctions,
  canonicalValueImplicitlyCalledFunctions,
  canonicalValueMemberAccessors,
  canonicalValuePromiseConstructorFunctions,
  canonicalValueScheduledCallbackFunctions,
  canonicalValueStandardCallbackFunctions,
  canonicalValueStaticClassExecutions,
  canonicalValueWellKnownSymbolFunctions,
  type CanonicalValueCalledFunction,
} from "./canonical-value-binding-call.ts";
import {
  canonicalValueIsInvocableFunction,
  canonicalValueIsFunctionNode,
  canonicalValueNodeContains,
  type CanonicalValueExecutionIndex,
} from "./canonical-value-binding-execution.ts";
import { canonicalValueStaticMemberName } from "./canonical-value-binding-member-call.ts";
import { recordCanonicalValueCalledParameters } from "./canonical-value-binding-parameters.ts";

import type { ESTree, Variable } from "@oxlint/plugins";
import type {
  CanonicalValueBindingWrite,
  CanonicalValueCallArgumentSegment,
  CanonicalValueClassNode,
  CanonicalValueFunctionExpression,
  CanonicalValueIdentifier,
} from "./canonical-value-binding-types.ts";

type InvocationRuntime = {
  readonly bindingWritesOf: (binding: Variable) => readonly CanonicalValueBindingWrite[];
  readonly executionIndex: CanonicalValueExecutionIndex;
  readonly functionReturnResults: (
    node: ESTree.ArrowFunctionExpression | ESTree.Function,
  ) => readonly ESTree.Expression[];
  readonly recordCallArguments: (
    called: CanonicalValueCalledFunction,
    occurrence: ESTree.Node,
  ) => void;
  readonly recordParameter: Parameters<typeof recordCanonicalValueCalledParameters>[0]["record"];
  readonly recordMemberGetter: (
    member: ESTree.MemberExpression,
    getters: readonly CanonicalValueFunctionExpression[],
  ) => void;
  readonly resolveIdentifier: (identifier: CanonicalValueIdentifier) => Variable | null;
};

const callResolution = (runtime: InvocationRuntime) => ({
  bindingWritesOf: runtime.bindingWritesOf,
  resolveIdentifier: runtime.resolveIdentifier,
});

const recordCalledFunctions = (
  runtime: InvocationRuntime,
  input: {
    readonly calledFunctions: readonly CanonicalValueCalledFunction[];
    readonly occurrence: ESTree.Node;
  },
): void => {
  runtime.executionIndex.recordCall({
    callees: input.calledFunctions.map((called) => called.node),
    node: input.occurrence,
  });
  input.calledFunctions.forEach((called) => {
    runtime.recordCallArguments(called, input.occurrence);
    recordCanonicalValueCalledParameters(
      {
        executionContextAt: runtime.executionIndex.contextAt,
        record: runtime.recordParameter,
      },
      { called, occurrence: input.occurrence },
    );
  });
};

const executableFunctions = (
  calledFunctions: readonly CanonicalValueCalledFunction[],
): readonly CanonicalValueCalledFunction[] =>
  calledFunctions.filter(
    (called) => !canonicalValueIsFunctionNode(called.node) || !called.node.generator,
  );

const memberIsRead = (member: ESTree.MemberExpression): boolean => {
  const parent = member.parent;
  if (parent.type === "AssignmentExpression" && canonicalValueNodeContains(parent.left, member)) {
    return parent.operator !== "=";
  }
  if (parent.type === "UnaryExpression" && parent.operator === "delete") return false;
  return true;
};

const advancedExpressionOfCall = (node: ESTree.CallExpression): ESTree.Expression | null => {
  const callee = unwrapExpression(node.callee);
  if (callee.type !== "MemberExpression" || callee.object.type === "Super") return null;
  const key = canonicalValueStaticMemberName(callee);
  return key === "next" || key === "return" || key === "throw" ? callee.object : null;
};

const recordGeneratorAdvancement = (
  runtime: InvocationRuntime,
  input: { readonly expression: ESTree.Expression; readonly occurrence: ESTree.Node },
): void => {
  recordCalledFunctions(runtime, {
    calledFunctions: canonicalValueAdvancedGeneratorFunctions({
      ...callResolution(runtime),
      ...input,
    }),
    occurrence: input.occurrence,
  });
};

const unknownArgumentSegments = [{ kind: "unknown" }] as const;

const implicitDecoratorFunctions = (
  runtime: InvocationRuntime,
  input: { readonly expression: ESTree.Expression; readonly occurrence: ESTree.Decorator },
): readonly CanonicalValueCalledFunction[] =>
  canonicalValueImplicitlyCalledFunctions({
    ...callResolution(runtime),
    argumentSegments: unknownArgumentSegments,
    ...input,
  });

const decoratorFactoryFunctions = (
  runtime: InvocationRuntime,
  decorator: ESTree.Decorator,
): readonly CanonicalValueCalledFunction[] => {
  const expression = unwrapExpression(decorator.expression);
  if (
    expression.type !== "CallExpression" &&
    expression.type !== "NewExpression" &&
    expression.type !== "TaggedTemplateExpression"
  ) {
    return [];
  }
  return canonicalValueCalledFunctions({
    ...callResolution(runtime),
    invocation: expression,
  }).flatMap((factory) => {
    if (!canonicalValueIsFunctionNode(factory.node)) return [];
    return runtime
      .functionReturnResults(factory.node)
      .flatMap((returned) =>
        implicitDecoratorFunctions(runtime, { expression: returned, occurrence: decorator }),
      );
  });
};

const decoratorFunctions = (
  runtime: InvocationRuntime,
  decorator: ESTree.Decorator,
): readonly CanonicalValueCalledFunction[] => {
  const direct = implicitDecoratorFunctions(runtime, {
    expression: decorator.expression,
    occurrence: decorator,
  });
  return direct.length === 0 ? decoratorFactoryFunctions(runtime, decorator) : direct;
};

const setterFunctions = (
  runtime: InvocationRuntime,
  input: {
    readonly assignment: ESTree.AssignmentExpression;
    readonly member: ESTree.MemberExpression;
  },
): readonly CanonicalValueCalledFunction[] =>
  canonicalValueMemberAccessors({
    ...callResolution(runtime),
    kind: "set",
    member: input.member,
  }).map((node) => ({
    argumentSegments:
      input.assignment.operator === "="
        ? [{ elements: [input.assignment.right], kind: "direct" }]
        : [{ kind: "unknown", width: 1 }],
    node,
    source: input.assignment,
  }));

const recordWellKnownSymbol = (
  runtime: InvocationRuntime,
  input: {
    readonly argumentSegments?: readonly CanonicalValueCallArgumentSegment[];
    readonly expression: ESTree.Expression;
    readonly name: string;
    readonly occurrence: ESTree.Node;
  },
): void => {
  recordCalledFunctions(runtime, {
    calledFunctions: canonicalValueWellKnownSymbolFunctions({
      ...callResolution(runtime),
      argumentSegments: input.argumentSegments ?? [],
      ...input,
    }),
    occurrence: input.occurrence,
  });
};

export const createCanonicalValueBindingInvocationRecorder = (runtime: InvocationRuntime) => ({
  recordBinaryExpression: (node: ESTree.BinaryExpression): void => {
    if (node.operator !== "instanceof") return;
    recordWellKnownSymbol(runtime, {
      argumentSegments: [{ elements: [node.left], kind: "direct" }],
      expression: node.right,
      name: "hasInstance",
      occurrence: node,
    });
  },
  recordAssignmentSetter: (
    assignment: ESTree.AssignmentExpression,
    member: ESTree.MemberExpression,
  ): void => {
    recordCalledFunctions(runtime, {
      calledFunctions: setterFunctions(runtime, { assignment, member }),
      occurrence: assignment,
    });
  },
  recordCallExpression: (node: ESTree.CallExpression): void => {
    const directFunctions =
      node.callee.type === "Super"
        ? canonicalValueDerivedSuperFunctions({ ...callResolution(runtime), call: node })
        : canonicalValueCalledFunctions({ ...callResolution(runtime), invocation: node });
    const callbackFunctions = canonicalValueArrayCallbackFunctions({
      ...callResolution(runtime),
      functionReturnResults: runtime.functionReturnResults,
      invocation: node,
    });
    const asyncCallbackFunctions = canonicalValueAsyncCallbackFunctions({
      ...callResolution(runtime),
      functionReturnResults: runtime.functionReturnResults,
      invocation: node,
    });
    const scheduledCallbackFunctions = canonicalValueScheduledCallbackFunctions({
      ...callResolution(runtime),
      functionReturnResults: runtime.functionReturnResults,
      invocation: node,
    });
    const standardCallbackFunctions = canonicalValueStandardCallbackFunctions({
      ...callResolution(runtime),
      functionReturnResults: runtime.functionReturnResults,
      invocation: node,
    });
    const externalCallbackFunctions = canonicalValueExternalCallbackFunctions({
      ...callResolution(runtime),
      invocation: node,
    });
    recordCalledFunctions(runtime, {
      calledFunctions: executableFunctions([
        ...directFunctions,
        ...callbackFunctions,
        ...asyncCallbackFunctions,
        ...scheduledCallbackFunctions,
        ...standardCallbackFunctions,
        ...externalCallbackFunctions,
      ]),
      occurrence: node,
    });
    const advanced = advancedExpressionOfCall(node);
    if (advanced !== null) {
      recordGeneratorAdvancement(runtime, { expression: advanced, occurrence: node });
    }
  },
  recordExternalExpression: (expression: ESTree.Expression, occurrence: ESTree.Node): void => {
    recordCalledFunctions(runtime, {
      calledFunctions: canonicalValueImplicitlyCalledFunctions({
        ...callResolution(runtime),
        argumentSegments: unknownArgumentSegments,
        expression,
        occurrence,
      }),
      occurrence,
    });
  },
  recordExternalFunction: (
    node: ESTree.ArrowFunctionExpression | ESTree.Function,
    occurrence: ESTree.Node,
  ): void => {
    if (!canonicalValueIsInvocableFunction(node)) return;
    recordCalledFunctions(runtime, {
      calledFunctions: [
        {
          argumentSegments: unknownArgumentSegments,
          node,
          source: node,
        },
      ],
      occurrence,
    });
  },
  recordClass: (node: CanonicalValueClassNode): void => {
    runtime.executionIndex.recordCall({
      callees: canonicalValueStaticClassExecutions(node),
      node,
    });
  },
  recordDecorator: (node: ESTree.Decorator): void => {
    recordCalledFunctions(runtime, {
      calledFunctions: executableFunctions(decoratorFunctions(runtime, node)),
      occurrence: node,
    });
  },
  recordGeneratorAdvancement: (expression: ESTree.Expression, occurrence: ESTree.Node): void => {
    recordGeneratorAdvancement(runtime, { expression, occurrence });
  },
  recordIteratorAdvancement: (expression: ESTree.Expression, occurrence: ESTree.Node): void => {
    recordWellKnownSymbol(runtime, { expression, name: "iterator", occurrence });
  },
  recordMemberExpression: (node: ESTree.MemberExpression): void => {
    if (!memberIsRead(node)) return;
    const accessors = canonicalValueMemberAccessors({
      ...callResolution(runtime),
      kind: "get",
      member: node,
    });
    if (accessors.length !== 0) runtime.recordMemberGetter(node, accessors);
    const calledFunctions = accessors.map((accessor) => ({
      argumentSegments: [],
      node: accessor,
      source: node,
    }));
    recordCalledFunctions(runtime, { calledFunctions, occurrence: node });
  },
  recordNewExpression: (node: ESTree.NewExpression): void => {
    const direct = canonicalValueCalledFunctions({ ...callResolution(runtime), invocation: node });
    const callbacks = canonicalValuePromiseConstructorFunctions({
      ...callResolution(runtime),
      functionReturnResults: runtime.functionReturnResults,
      invocation: node,
    });
    recordCalledFunctions(runtime, {
      calledFunctions: executableFunctions([...direct, ...callbacks]),
      occurrence: node,
    });
  },
  recordSpreadElement: (node: ESTree.SpreadElement): void => {
    if (node.parent.type === "ObjectExpression") return;
    recordGeneratorAdvancement(runtime, { expression: node.argument, occurrence: node });
    recordWellKnownSymbol(runtime, {
      expression: node.argument,
      name: "iterator",
      occurrence: node,
    });
  },
  recordTemplateLiteral: (node: ESTree.TemplateLiteral): void => {
    node.expressions.forEach((expression) => {
      recordWellKnownSymbol(runtime, {
        argumentSegments: [{ kind: "unknown", width: 1 }],
        expression,
        name: "toPrimitive",
        occurrence: node,
      });
    });
  },
  recordUsingResource: (input: {
    readonly asynchronous: boolean;
    readonly expression: ESTree.Expression;
    readonly occurrence: ESTree.VariableDeclarator;
  }): void => {
    recordWellKnownSymbol(runtime, {
      expression: input.expression,
      name: input.asynchronous ? "asyncDispose" : "dispose",
      occurrence: input.occurrence,
    });
  },
  recordTaggedTemplateExpression: (node: ESTree.TaggedTemplateExpression): void => {
    recordCalledFunctions(runtime, {
      calledFunctions: executableFunctions(
        canonicalValueCalledFunctions({ ...callResolution(runtime), invocation: node }),
      ),
      occurrence: node,
    });
  },
  recordUpdateSetter: (node: ESTree.UpdateExpression, member: ESTree.MemberExpression): void => {
    const calledFunctions = canonicalValueMemberAccessors({
      ...callResolution(runtime),
      kind: "set",
      member,
    }).map<CanonicalValueCalledFunction>((accessor) => ({
      argumentSegments: [{ kind: "unknown", width: 1 }],
      node: accessor,
      source: node,
    }));
    recordCalledFunctions(runtime, { calledFunctions, occurrence: node });
  },
});
