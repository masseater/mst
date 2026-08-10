import { isEqual } from "es-toolkit";

import { createDontReviewItRule } from "../../../create-rule.ts";

import type { ESTree } from "@oxlint/plugins";

type FunctionLike = ESTree.Function | ESTree.ArrowFunctionExpression;

type ForwardedName = { readonly name: string; readonly spread: boolean };

const forwardedParameter = (parameter: ESTree.ParamPattern): ForwardedName | null => {
  if (parameter.type === "Identifier") return { name: parameter.name, spread: false };
  if (parameter.type !== "RestElement") return null;
  const rested = parameter.argument;
  return rested.type === "Identifier" ? { name: rested.name, spread: true } : null;
};

const forwardedArgument = (argument: ESTree.Argument): ForwardedName | null => {
  if (argument.type === "Identifier") return { name: argument.name, spread: false };
  if (argument.type !== "SpreadElement") return null;
  const spread = argument.argument;
  return spread.type === "Identifier" ? { name: spread.name, spread: true } : null;
};

const soleReturnedExpression = (body: ESTree.FunctionBody): ESTree.Expression | null => {
  if (body.body.length !== 1) return null;
  const [statement] = body.body;
  if (statement.type !== "ReturnStatement") return null;
  return statement.argument;
};

const forwardedCall = (declared: FunctionLike): ESTree.CallExpression | null => {
  const { body } = declared;
  if (body === null) return null;

  const forwarded = body.type === "BlockStatement" ? soleReturnedExpression(body) : body;
  if (forwarded === null || forwarded.type !== "CallExpression") return null;
  if (forwarded.optional) return null;
  return (forwarded.typeArguments ?? null) === null ? forwarded : null;
};

const calleeIsOwnParameter = (
  target: ESTree.Expression,
  parameters: readonly (ForwardedName | null)[],
): boolean =>
  target.type === "Identifier" && parameters.some((entry) => entry?.name === target.name);

const declaresOwnTypeContract = (declared: FunctionLike): boolean =>
  (declared.returnType ?? null) !== null || (declared.typeParameters ?? null) !== null;

const isIdentityForwarding = (declared: FunctionLike): boolean => {
  if (declared.async || declared.generator) return false;
  if (declaresOwnTypeContract(declared)) return false;

  const call = forwardedCall(declared);
  if (call === null) return false;

  const parameters = declared.params.map(forwardedParameter);
  if (parameters.some((entry) => entry === null)) return false;
  if (calleeIsOwnParameter(call.callee, parameters)) return false;

  return isEqual(parameters, call.arguments.map(forwardedArgument));
};

export const noIdentityWrapper = createDontReviewItRule({
  name: "no-identity-wrapper--call-the-target-directly",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow a named function whose whole body forwards its own parameters unchanged to one other call and declares no type contract of its own, so a caller reaches the function that does the work instead of a name that only stands in front of it",
      relatedGuidelines: [],
    },
    messages: {
      identityWrapper:
        'A named function must not consist of nothing but a call that passes its own parameters through unchanged, because the name then adds a second spelling for something that already has one: a reader who looks the name up learns only that another name exists, a search for the callee misses every call routed through here, and the two names drift apart as soon as one of them is renamed. Call the target where this function is being called and delete this one. To publish a name from another module, re-export it (`export { parseUser } from "./parse-user.ts"`) rather than wrapping the call, because a re-export forwards the definition itself and a wrapper only copies its shape. This rule leaves a wrapper alone once it declares a return contract at its own boundary, either as a return type annotation on the function or as a type annotation on the binding it is assigned to, so narrowing the callee\'s type is the way to keep a wrapper that has a reason to exist.',
    },
    schema: [],
  },
  create(context) {
    return {
      FunctionDeclaration(node: ESTree.Function) {
        if (!isIdentityForwarding(node)) return;
        context.report({ node, messageId: "identityWrapper" });
      },
      VariableDeclarator(node: ESTree.VariableDeclarator) {
        const { id, init } = node;
        if (id.type !== "Identifier") return;
        if ((id.typeAnnotation ?? null) !== null) return;
        if (init === null) return;

        if (init.type !== "ArrowFunctionExpression" && init.type !== "FunctionExpression") return;
        if (!isIdentityForwarding(init)) return;

        context.report({ node: init, messageId: "identityWrapper" });
      },
    };
  },
});
