import { isEqual } from "es-toolkit";

import { createDontReviewItRule } from "../../../create-rule.ts";
import { isExportDeclaration } from "../lib/is-export-declaration.ts";
import { isWithin } from "../lib/is-within.ts";
import { runtimeParametersOf } from "../lib/runtime-parameters.ts";
import { unwrapTransparentExpression } from "../lib/transparent-expression.ts";

import type { ESTree, Reference, Variable } from "@oxlint/plugins";

type ForwardedName = { readonly name: string; readonly spread: boolean };

type OverloadDeclaration = ESTree.Function & { readonly id: ESTree.BindingIdentifier };

type WrapperCandidate = {
  readonly binding: ESTree.BindingIdentifier;
  readonly bindingOwner: ESTree.Node;
  readonly declared: ESTree.Function | ESTree.ArrowFunctionExpression;
  readonly reportNode: ESTree.Node;
};

const directCallOf = (reference: Reference): ESTree.CallExpression | null => {
  const parent = reference.identifier.parent;
  return parent.type === "CallExpression" &&
    !parent.optional &&
    parent.callee === reference.identifier
    ? parent
    : null;
};

const variablesDeclaredBy = ({
  owner,
  binding,
  variablesFor,
}: {
  readonly owner: ESTree.Node;
  readonly binding: ESTree.BindingIdentifier;
  readonly variablesFor: (node: ESTree.Node) => readonly Variable[];
}): readonly Variable[] =>
  variablesFor(owner).filter((variable) => variable.identifiers.includes(binding));

const closedDirectCallsOf = (
  variables: readonly Variable[],
): readonly ESTree.CallExpression[] | null => {
  const calls = variables.flatMap((variable) =>
    variable.references
      .filter((reference) => !(reference.init && reference.isWriteOnly()))
      .map(directCallOf),
  );
  return calls.every((call): call is ESTree.CallExpression => call !== null) ? calls : null;
};

const directCallsPreserveArguments = (
  declared: ESTree.Function | ESTree.ArrowFunctionExpression,
  calls: readonly ESTree.CallExpression[],
): boolean => {
  const parameters = runtimeParametersOf(declared);
  const [parameter] = parameters;
  if (parameters.length === 1 && parameter?.type === "RestElement") return true;
  return calls.every(
    (call) =>
      call.arguments.length === parameters.length &&
      call.arguments.every((argument) => argument.type !== "SpreadElement"),
  );
};

const targetDependsOnVariables = (
  target: ESTree.Expression,
  variables: readonly Variable[],
): boolean =>
  variables.some((variable) =>
    variable.references.some((reference) => isWithin(reference.identifier, target)),
  );

const ancestorUsesWrapperThis = (
  ancestor: ESTree.Node | null,
  declared: ESTree.Function | ESTree.ArrowFunctionExpression,
): boolean =>
  ancestor === declared ||
  (ancestor !== null &&
    ancestor.type !== "FunctionDeclaration" &&
    ancestor.type !== "FunctionExpression" &&
    ancestorUsesWrapperThis(ancestor.parent, declared));

const thisUsesWrapperExecutionContext = (
  expression: ESTree.ThisExpression,
  declared: ESTree.Function | ESTree.ArrowFunctionExpression,
): boolean => ancestorUsesWrapperThis(expression.parent, declared);

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
  if (statement?.type !== "ReturnStatement") return null;
  return statement.argument;
};

const forwardedInvocation = (
  declared: ESTree.Function | ESTree.ArrowFunctionExpression,
): ESTree.CallExpression | ESTree.NewExpression | null => {
  const body = declared.body as ESTree.FunctionBody | ESTree.Expression;

  const forwarded = body.type === "BlockStatement" ? soleReturnedExpression(body) : body;
  if (forwarded?.type !== "CallExpression" && forwarded?.type !== "NewExpression") return null;
  return (forwarded.typeArguments ?? null) === null ? forwarded : null;
};

const rootOfMemberChain = (target: ESTree.Expression): ESTree.Expression =>
  target.type === "MemberExpression" ? rootOfMemberChain(target.object) : target;

const targetIsRootedInOwnParameter = (
  target: ESTree.Expression,
  parameters: readonly (ForwardedName | null)[],
): boolean => {
  const root = rootOfMemberChain(target);
  return root.type === "Identifier" && parameters.some((entry) => entry?.name === root.name);
};

const declaresOwnTypeContract = (
  declared: ESTree.Function | ESTree.ArrowFunctionExpression,
): boolean => (declared.returnType ?? null) !== null || (declared.typeParameters ?? null) !== null;

const forwardedParameters = (
  declared: ESTree.Function | ESTree.ArrowFunctionExpression,
): readonly ForwardedName[] | null => {
  const parameters = runtimeParametersOf(declared).map(forwardedParameter);
  return parameters.every((entry): entry is ForwardedName => entry !== null) ? parameters : null;
};

const invocationHasFixedTarget = (
  invocation: ESTree.CallExpression | ESTree.NewExpression,
  parameters: readonly ForwardedName[],
): boolean => !targetIsRootedInOwnParameter(invocation.callee, parameters);

const invocationIsIdentity = ({
  invocation,
  parameters,
  variables,
  targetUsesExecutionContext,
  declared,
}: {
  readonly invocation: ESTree.CallExpression | ESTree.NewExpression;
  readonly parameters: readonly ForwardedName[];
  readonly variables: readonly Variable[];
  readonly targetUsesExecutionContext: (
    target: ESTree.Expression,
    declared: ESTree.Function | ESTree.ArrowFunctionExpression,
  ) => boolean;
  readonly declared: ESTree.Function | ESTree.ArrowFunctionExpression;
}): boolean =>
  invocationHasFixedTarget(invocation, parameters) &&
  !targetDependsOnVariables(invocation.callee, variables) &&
  !targetUsesExecutionContext(invocation.callee, declared) &&
  isEqual(parameters, invocation.arguments.map(forwardedArgument));

const identityForwarding = ({
  declared,
  variables,
  targetUsesExecutionContext,
}: {
  readonly declared: ESTree.Function | ESTree.ArrowFunctionExpression;
  readonly variables: readonly Variable[];
  readonly targetUsesExecutionContext: (
    target: ESTree.Expression,
    declared: ESTree.Function | ESTree.ArrowFunctionExpression,
  ) => boolean;
}): "identityCall" | "identityConstruction" | null => {
  if (declared.async || declared.generator || declaresOwnTypeContract(declared)) return null;

  const invocation = forwardedInvocation(declared);
  const parameters = forwardedParameters(declared);
  if (invocation === null || parameters === null) return null;
  if (
    !invocationIsIdentity({
      invocation,
      parameters,
      variables,
      targetUsesExecutionContext,
      declared,
    })
  ) {
    return null;
  }

  return invocation.type === "CallExpression" ? "identityCall" : "identityConstruction";
};

const variableWrapperOf = (node: ESTree.VariableDeclarator): WrapperCandidate | null => {
  const { id, init } = node;
  if (
    id.type !== "Identifier" ||
    isExportDeclaration(node.parent.parent) ||
    (id.typeAnnotation ?? null) !== null ||
    init === null ||
    (init.type !== "ArrowFunctionExpression" && init.type !== "FunctionExpression")
  ) {
    return null;
  }
  return { binding: id, bindingOwner: node.parent, declared: init, reportNode: init };
};

const declarationContainer = (node: ESTree.Function): ESTree.Node => {
  const parent = node.parent;
  return parent.type === "ExportNamedDeclaration" || parent.type === "ExportDefaultDeclaration"
    ? parent.parent
    : parent;
};

export const noIdentityWrapper = createDontReviewItRule({
  name: "no-identity-wrapper--use-the-target-directly",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow a named function whose whole body forwards its own parameters unchanged to one fixed call or construction and declares no type contract of its own, so callers use the target directly instead of a name that only stands in front of it",
      relatedGuidelines: [],
    },
    messages: {
      identityCall:
        'A named function must not consist of nothing but a call that passes its own parameters through unchanged. Rename every call-site binding that shadows a captured target name and update all of its references as one alpha-renaming. Evaluate the original arguments from left to right into temporary bindings before evaluating and calling the target, then delete this function. To publish a name from another module, re-export it: `export { parseUser } from "./parse-user.ts"`.',
      identityConstruction:
        "A named function must not consist of nothing but constructing a fixed target with its own parameters unchanged. Rename every call-site binding that shadows a captured target name and update all of its references as one alpha-renaming. Evaluate the original arguments from left to right into temporary bindings before evaluating and constructing the target, then delete this function.",
    },
    schema: [],
  },
  create(context) {
    const variablesFor = (node: ESTree.Node): readonly Variable[] =>
      context.sourceCode.getDeclaredVariables(node);
    const executionNodes = {
      directEvalTargets: new Set<ESTree.Expression>(),
      metaProperties: new Set<ESTree.MetaProperty>(),
      superExpressions: new Set<ESTree.Super>(),
      thisExpressions: new Set<ESTree.ThisExpression>(),
    };
    const overloadNamesByContainer = new WeakMap<ESTree.Node, Set<string>>();
    const recordOverload = (node: OverloadDeclaration): void => {
      const container = declarationContainer(node);
      const names = overloadNamesByContainer.get(container) ?? new Set<string>();
      names.add(node.id.name);
      overloadNamesByContainer.set(container, names);
    };
    const hasOverload = (node: ESTree.Function): boolean =>
      node.id !== null &&
      (overloadNamesByContainer.get(declarationContainer(node))?.has(node.id.name) ?? false);
    const targetUsesExecutionContext = (
      target: ESTree.Expression,
      declared: ESTree.Function | ESTree.ArrowFunctionExpression,
    ): boolean => {
      const scope = context.sourceCode.getScope(target);
      return (
        [...executionNodes.directEvalTargets].some((expression) => isWithin(expression, target)) ||
        [...executionNodes.thisExpressions].some(
          (expression) =>
            isWithin(expression, target) && thisUsesWrapperExecutionContext(expression, declared),
        ) ||
        [...executionNodes.superExpressions].some((expression) => isWithin(expression, target)) ||
        [...executionNodes.metaProperties].some((property) => isWithin(property, target)) ||
        [...scope.references, ...scope.through]
          .filter((reference) => isWithin(reference.identifier, target))
          .some((reference) => reference.identifier.name === "arguments")
      );
    };
    const isUnshadowedGlobal = (node: ESTree.IdentifierReference): boolean => {
      const scope = context.sourceCode.getScope(node);
      return [...scope.references, ...scope.through].some(
        (reference) =>
          reference.identifier === node &&
          (reference.resolved === null || reference.resolved.defs.length === 0),
      );
    };
    const inspect = ({ binding, bindingOwner, declared, reportNode }: WrapperCandidate): void => {
      const wrapperVariables = variablesDeclaredBy({ owner: bindingOwner, binding, variablesFor });
      const calls = closedDirectCallsOf(wrapperVariables);
      if (calls === null || calls.length === 0 || !directCallsPreserveArguments(declared, calls)) {
        return;
      }
      const messageId = identityForwarding({
        declared,
        variables: [...wrapperVariables, ...variablesFor(declared)],
        targetUsesExecutionContext,
      });
      if (messageId === null) return;
      context.report({ node: reportNode, messageId });
    };

    return {
      CallExpression(node: ESTree.CallExpression) {
        if (node.optional) return;
        const callee = node.callee;
        if (callee.type === "Super" || callee.type === "V8IntrinsicExpression") return;
        const target = unwrapTransparentExpression(callee);
        if (target.type === "Identifier" && target.name === "eval" && isUnshadowedGlobal(target)) {
          executionNodes.directEvalTargets.add(callee);
        }
      },
      ThisExpression(node: ESTree.ThisExpression) {
        executionNodes.thisExpressions.add(node);
      },
      Super(node: ESTree.Super) {
        executionNodes.superExpressions.add(node);
      },
      MetaProperty(node: ESTree.MetaProperty) {
        if (node.meta.name === "new" && node.property.name === "target") {
          executionNodes.metaProperties.add(node);
        }
      },
      TSDeclareFunction(node: OverloadDeclaration) {
        recordOverload(node);
      },
      "FunctionDeclaration:exit"(node: ESTree.Function) {
        if (node.id === null || isExportDeclaration(node.parent) || hasOverload(node)) return;
        inspect({ binding: node.id, bindingOwner: node, declared: node, reportNode: node });
      },
      "VariableDeclarator:exit"(node: ESTree.VariableDeclarator) {
        const candidate = variableWrapperOf(node);
        if (candidate !== null) inspect(candidate);
      },
    };
  },
});
