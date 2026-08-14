import { isEqual } from "es-toolkit";

import { createDontReviewItRule } from "../../../create-rule.ts";

import type { ESTree } from "@oxlint/plugins";

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

const soleReturnedExpression = (writtenBody: ESTree.FunctionBody): ESTree.Expression | null => {
  if (writtenBody.body.length !== 1) return null;
  const [statement] = writtenBody.body;
  if (statement?.type !== "ReturnStatement") return null;
  return statement.argument;
};

type FunctionLike = ESTree.Function | ESTree.ArrowFunctionExpression;

const forwardedCall = (declared: FunctionLike): ESTree.CallExpression | null => {
  const writtenBody = declared.body as ESTree.FunctionBody | ESTree.Expression;

  const forwarded =
    writtenBody.type === "BlockStatement" ? soleReturnedExpression(writtenBody) : writtenBody;
  if (forwarded?.type !== "CallExpression") return null;
  return (forwarded.typeArguments ?? null) === null ? forwarded : null;
};

const calleeIsOwnParameter = (
  callee: ESTree.Expression,
  parameters: readonly (ForwardedName | null)[],
): boolean => {
  const checked = callee;
  return (
    checked.type === "Identifier" &&
    parameters.some((parameter) => parameter?.name === checked.name)
  );
};

const declaresOwnTypeContract = (declared: FunctionLike): boolean =>
  (declared.returnType ?? null) !== null || (declared.typeParameters ?? null) !== null;

const isIdentityForwarding = (declared: FunctionLike): boolean => {
  if (declared.async || declared.generator) return false;
  if (declaresOwnTypeContract(declared)) return false;

  const call = forwardedCall(declared);
  if (call === null) return false;

  const parameters = declared.params.map(forwardedParameter);
  if (parameters.some((parameter) => parameter === null)) return false;
  if (calleeIsOwnParameter(call.callee, parameters)) return false;

  return isEqual(parameters, call.arguments.map(forwardedArgument));
};

export const noIdentityWrapper = createDontReviewItRule({
  name: "no-identity-wrapper--call-the-target-directly",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow a named function whose whole writtenBody forwards its own parameters unchanged to one other call and declares no type contract of its own, so a caller reaches the function that does the work instead of a name that only stands in front of it",
      relatedGuidelines: [],
    },
    messages: {
      identityWrapper:
        'A named function must not consist of nothing but a call that passes its own parameters through unchanged. Call the target where this function is being called and delete this one. To publish a name from another module, re-export it: `export { parseUser } from "./parse-user.ts"`.',
    },
    schema: [],
  },
  create(inspection) {
    return {
      FunctionDeclaration(node: ESTree.Function) {
        if (!isIdentityForwarding(node)) return;
        inspection.report({ node, messageId: "identityWrapper" });
      },
      VariableDeclarator(node: ESTree.VariableDeclarator) {
        const { id, init } = node;
        if (id.type !== "Identifier") return;
        if ((id.typeAnnotation ?? null) !== null) return;
        if (init === null) return;

        const declared = init;
        if (declared.type !== "ArrowFunctionExpression" && declared.type !== "FunctionExpression") {
          return;
        }
        if (!isIdentityForwarding(declared)) return;

        inspection.report({ node: declared, messageId: "identityWrapper" });
      },
    };
  },
});
