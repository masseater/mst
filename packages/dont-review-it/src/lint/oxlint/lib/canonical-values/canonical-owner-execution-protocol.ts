import * as ts from "typescript-6";

import { canonicalOwnerIdentifierIsGlobal } from "./canonical-owner-alias.ts";
import { canonicalOwnerAliasedCalledFunctions } from "./canonical-owner-call.ts";
import { canonicalOwnerCoercionFunctions } from "./canonical-owner-execution-coercion.ts";
import {
  canonicalOwnerGetterFunctions,
  canonicalOwnerNamedPropertyFunctions,
  canonicalOwnerPropertyExecutionFunctions,
  canonicalOwnerProxyTrapFunctions,
  canonicalOwnerSymbolProtocolFunctions,
} from "./canonical-owner-execution-property.ts";
import {
  canonicalOwnerIsGlobalMethod,
  canonicalOwnerSameReference,
  canonicalOwnerStaticPropertyText,
  type CanonicalOwnerProtocolInput,
} from "./canonical-owner-execution-protocol-state.ts";
import {
  canonicalOwnerMemberName,
  canonicalOwnerMemberReceiver,
  unwrapCanonicalOwnerExpression,
  type ExecutableFunction,
} from "./canonical-owner-state.ts";

const eventNameAtDispatch = (call: ts.CallExpression): string | null => {
  const event = call.arguments[0];
  const current = event === undefined ? null : unwrapCanonicalOwnerExpression(event);
  return current !== null && ts.isNewExpression(current)
    ? canonicalOwnerStaticPropertyText(current.arguments?.[0])
    : null;
};

const eventCallbackFunctions = (
  input: CanonicalOwnerProtocolInput & { readonly call: ts.CallExpression },
): readonly ExecutableFunction[] => {
  if (canonicalOwnerMemberName(input.call.expression) !== "addEventListener") return [];
  const receiver = canonicalOwnerMemberReceiver(input.call.expression);
  const eventName = canonicalOwnerStaticPropertyText(input.call.arguments[0]);
  const callback = input.call.arguments[1];
  if (receiver === null || eventName === null || callback === undefined) return [];
  const dispatched = input.nodes.some(
    (node) =>
      ts.isCallExpression(node) &&
      canonicalOwnerMemberName(node.expression) === "dispatchEvent" &&
      eventNameAtDispatch(node) === eventName &&
      canonicalOwnerMemberReceiver(node.expression) !== null &&
      canonicalOwnerSameReference({
        checker: input.checker,
        left: receiver,
        right: canonicalOwnerMemberReceiver(node.expression) as ts.Expression,
      }),
  );
  return dispatched
    ? canonicalOwnerAliasedCalledFunctions({
        aliases: input.aliases,
        checker: input.checker,
        expression: callback,
      }).filter((function_) => function_.asteriskToken === undefined)
    : [];
};

const directGlobalCall = (input: {
  readonly call: ts.CallExpression;
  readonly checker: ts.TypeChecker;
  readonly names: ReadonlySet<string>;
  readonly program: ts.Program;
}): boolean => {
  const callee = unwrapCanonicalOwnerExpression(input.call.expression);
  return (
    ts.isIdentifier(callee) &&
    input.names.has(callee.text) &&
    canonicalOwnerIdentifierIsGlobal({ ...input, identifier: callee })
  );
};

const primitiveCallProtocolFunctions = (
  input: CanonicalOwnerProtocolInput & { readonly call: ts.CallExpression },
): readonly ExecutableFunction[] => {
  const subject = input.call.arguments[0];
  return subject !== undefined &&
    directGlobalCall({ ...input, names: new Set(["String", "Number"]) })
    ? canonicalOwnerSymbolProtocolFunctions({
        ...input,
        expression: subject,
        protocol: "toPrimitive",
      })
    : [];
};

const jsonProtocolFunctions = (
  input: CanonicalOwnerProtocolInput & { readonly call: ts.CallExpression },
): readonly ExecutableFunction[] => {
  const subject = input.call.arguments[0];
  if (
    subject === undefined ||
    !canonicalOwnerIsGlobalMethod({ ...input, method: "stringify", object: "JSON" })
  ) {
    return [];
  }
  return [
    ...canonicalOwnerNamedPropertyFunctions({ ...input, expression: subject, name: "toJSON" }),
    ...canonicalOwnerGetterFunctions({ ...input, expression: subject }),
    ...canonicalOwnerProxyTrapFunctions({ ...input, expression: subject, trap: "ownKeys" }),
    ...canonicalOwnerProxyTrapFunctions({ ...input, expression: subject, trap: "get" }),
  ];
};

const reflectionProtocolFunctions = (
  input: CanonicalOwnerProtocolInput & { readonly call: ts.CallExpression },
): readonly ExecutableFunction[] => {
  const subject = input.call.arguments[0];
  if (subject === undefined) return [];
  if (canonicalOwnerIsGlobalMethod({ ...input, method: "keys", object: "Object" })) {
    return canonicalOwnerProxyTrapFunctions({ ...input, expression: subject, trap: "ownKeys" });
  }
  return canonicalOwnerIsGlobalMethod({
    ...input,
    method: "deleteProperty",
    object: "Reflect",
  })
    ? canonicalOwnerProxyTrapFunctions({ ...input, expression: subject, trap: "deleteProperty" })
    : [];
};

const callProtocolFunctions = (
  input: CanonicalOwnerProtocolInput,
): readonly ExecutableFunction[] =>
  ts.isCallExpression(input.node)
    ? [
        ...primitiveCallProtocolFunctions({ ...input, call: input.node }),
        ...jsonProtocolFunctions({ ...input, call: input.node }),
        ...reflectionProtocolFunctions({ ...input, call: input.node }),
      ]
    : [];

type IterationSource = { readonly expression: ts.Expression; readonly protocol: string };

const forOfIterationSource = (node: ts.Node): readonly IterationSource[] =>
  ts.isForOfStatement(node)
    ? [
        {
          expression: node.expression,
          protocol: node.awaitModifier === undefined ? "iterator" : "asyncIterator",
        },
      ]
    : [];

const spreadIterationSource = (node: ts.Node): readonly IterationSource[] =>
  ts.isSpreadElement(node) &&
  (ts.isArrayLiteralExpression(node.parent) ||
    ts.isCallExpression(node.parent) ||
    ts.isNewExpression(node.parent))
    ? [{ expression: node.expression, protocol: "iterator" }]
    : [];

const destructuringIterationSource = (node: ts.Node): readonly IterationSource[] =>
  ts.isVariableDeclaration(node) &&
  ts.isArrayBindingPattern(node.name) &&
  node.initializer !== undefined
    ? [{ expression: node.initializer, protocol: "iterator" }]
    : [];

const yieldIterationSource = (node: ts.Node): readonly IterationSource[] =>
  ts.isYieldExpression(node) && node.asteriskToken !== undefined && node.expression !== undefined
    ? [{ expression: node.expression, protocol: "iterator" }]
    : [];

const arrayFromIterationSource = (
  input: CanonicalOwnerProtocolInput,
): readonly IterationSource[] =>
  ts.isCallExpression(input.node) &&
  canonicalOwnerIsGlobalMethod({ ...input, call: input.node, method: "from", object: "Array" }) &&
  input.node.arguments[0] !== undefined
    ? [{ expression: input.node.arguments[0], protocol: "iterator" }]
    : [];

const iterationProtocolFunctions = (
  input: CanonicalOwnerProtocolInput,
): readonly ExecutableFunction[] =>
  [
    ...forOfIterationSource(input.node),
    ...spreadIterationSource(input.node),
    ...destructuringIterationSource(input.node),
    ...yieldIterationSource(input.node),
    ...arrayFromIterationSource(input),
  ].flatMap(({ expression, protocol }) =>
    canonicalOwnerSymbolProtocolFunctions({ ...input, expression, protocol }),
  );

const disposalProtocolFunctions = (
  input: CanonicalOwnerProtocolInput,
): readonly ExecutableFunction[] => {
  if (!ts.isVariableDeclaration(input.node) || input.node.initializer === undefined) return [];
  const flags: number = input.node.parent.flags;
  const awaitUsing: number = ts.NodeFlags.AwaitUsing;
  const using: number = ts.NodeFlags.Using;
  const async = (flags & awaitUsing) === awaitUsing;
  if (!async && (flags & using) !== using) return [];
  return canonicalOwnerSymbolProtocolFunctions({
    ...input,
    expression: input.node.initializer,
    protocol: async ? "asyncDispose" : "dispose",
  });
};

export const canonicalOwnerProtocolFunctions = (
  input: CanonicalOwnerProtocolInput,
): readonly ExecutableFunction[] => [
  ...(ts.isCallExpression(input.node)
    ? eventCallbackFunctions({ ...input, call: input.node })
    : []),
  ...canonicalOwnerPropertyExecutionFunctions(input),
  ...callProtocolFunctions(input),
  ...canonicalOwnerCoercionFunctions(input),
  ...iterationProtocolFunctions(input),
  ...disposalProtocolFunctions(input),
];
