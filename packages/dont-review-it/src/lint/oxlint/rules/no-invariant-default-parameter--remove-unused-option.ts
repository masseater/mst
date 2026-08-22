import { createDontReviewItRule } from "../../../create-rule.ts";
import { hasFunctionOverload } from "../lib/function-overload.ts";
import { isExportDeclaration } from "../lib/is-export-declaration.ts";
import { isWithin } from "../lib/is-within.ts";
import { nodesOfType } from "../lib/nodes-of-type.ts";
import { isOutOfScopeSource } from "../lib/out-of-scope-source.ts";
import { runtimeParametersOf } from "../lib/runtime-parameters.ts";
import { unwrapTransparentExpression } from "../lib/transparent-expression.ts";

import type { ESTree, Reference, Scope, Variable } from "@oxlint/plugins";

type NamedFunction = {
  readonly declared: ESTree.Function | ESTree.ArrowFunctionExpression;
  readonly bindings: readonly {
    readonly bindingOwner: ESTree.Node;
    readonly bindingName: ESTree.BindingIdentifier;
  }[];
};

type StaticValue = {
  readonly key: string;
  readonly text: string;
};

const declaredFunctionOf = (node: ESTree.Function): NamedFunction | null => {
  if (node.body === null || node.id === null) return null;
  if (isExportDeclaration(node.parent)) return null;
  return { declared: node, bindings: [{ bindingOwner: node, bindingName: node.id }] };
};

const boundFunctionOf = (node: ESTree.VariableDeclarator): NamedFunction | null => {
  if (node.id.type !== "Identifier" || node.init === null) return null;
  if (node.init.type !== "ArrowFunctionExpression" && node.init.type !== "FunctionExpression") {
    return null;
  }
  if (isExportDeclaration(node.parent.parent)) return null;
  const innerBinding =
    node.init.type === "FunctionExpression" && node.init.id !== null
      ? [{ bindingOwner: node.init, bindingName: node.init.id }]
      : [];
  return {
    declared: node.init,
    bindings: [{ bindingOwner: node.parent, bindingName: node.id }, ...innerBinding],
  };
};

const variablesDeclaredBy = (
  named: NamedFunction,
  variablesFor: (node: ESTree.Node) => readonly Variable[],
): readonly Variable[] =>
  named.bindings.flatMap(({ bindingOwner, bindingName }) =>
    variablesFor(bindingOwner).filter((variable) => variable.identifiers.includes(bindingName)),
  );

const callOf = (reference: Reference): ESTree.CallExpression | null => {
  const parent = reference.identifier.parent;
  if (parent.type !== "CallExpression") return null;
  return parent.callee === reference.identifier ? parent : null;
};

const referencesFor = (
  scope: Scope,
  identifier: ESTree.IdentifierReference,
): readonly Reference[] =>
  [...scope.references, ...scope.through].filter(
    (candidate) => candidate.identifier === identifier,
  );

const closedCallsOf = (variable: Variable): readonly ESTree.CallExpression[] | null => {
  const calls = variable.references
    .filter((reference) => !(reference.init && reference.isWriteOnly()))
    .map(callOf);
  if (calls.some((call) => call === null)) return null;
  return calls.filter((call): call is ESTree.CallExpression => call !== null);
};

const closedCallsOfVariables = (
  variables: readonly Variable[],
): readonly ESTree.CallExpression[] | null => {
  const callGroups = variables.map(closedCallsOf);
  if (!callGroups.every((calls): calls is readonly ESTree.CallExpression[] => calls !== null)) {
    return null;
  }
  return callGroups.flat();
};

const literalValueOf = (
  expression: ESTree.Expression,
  sourceTextOf: (node: ESTree.Node) => string,
): StaticValue | null => {
  const signedNumberOf = (candidate: ESTree.Expression): number | null => {
    if (candidate.type !== "UnaryExpression") return null;
    if (candidate.operator !== "+" && candidate.operator !== "-") return null;
    const operand = candidate.argument;
    if (operand.type !== "Literal" || typeof operand.value !== "number") return null;
    if (!Number.isFinite(operand.value)) return null;
    return candidate.operator === "-" ? -operand.value : operand.value;
  };
  const signedNumber = signedNumberOf(expression);
  if (signedNumber !== null) {
    return {
      key: Object.is(signedNumber, -0) ? "number:-0" : `number:${String(signedNumber)}`,
      text: sourceTextOf(expression),
    };
  }
  if (expression.type !== "Literal") return null;
  const { value } = expression;
  if (value !== null && !["boolean", "number", "string"].includes(typeof value)) return null;
  if (typeof value === "number" && !Number.isFinite(value)) return null;
  return { key: `${typeof value}:${String(value)}`, text: sourceTextOf(expression) };
};

const effectiveArgumentAt = ({
  call,
  index,
  fallback,
  sourceTextOf,
  isUnshadowedUndefined,
}: {
  readonly call: ESTree.CallExpression;
  readonly index: number;
  readonly fallback: StaticValue;
  readonly sourceTextOf: (node: ESTree.Node) => string;
  readonly isUnshadowedUndefined: (node: ESTree.IdentifierReference) => boolean;
}): StaticValue | null => {
  if (call.arguments.slice(0, index).some((argument) => argument.type === "SpreadElement")) {
    return null;
  }
  const argument = call.arguments[index];
  if (argument === undefined) return fallback;
  if (argument.type === "SpreadElement") return null;
  if (argument.type === "Identifier" && argument.name === "undefined") {
    return isUnshadowedUndefined(argument) ? fallback : null;
  }
  return literalValueOf(argument, sourceTextOf);
};

const invariantValueFor = ({
  calls,
  index,
  fallback,
  sourceTextOf,
  isUnshadowedUndefined,
}: {
  readonly calls: readonly ESTree.CallExpression[];
  readonly index: number;
  readonly fallback: StaticValue;
  readonly sourceTextOf: (node: ESTree.Node) => string;
  readonly isUnshadowedUndefined: (node: ESTree.IdentifierReference) => boolean;
}): StaticValue | null => {
  const effectiveArguments = calls.map((call) =>
    effectiveArgumentAt({ call, index, fallback, sourceTextOf, isUnshadowedUndefined }),
  );
  const [first, ...remaining] = effectiveArguments;
  if (first === undefined || first === null) return null;
  if (
    remaining.some(
      (effectiveArgument) => effectiveArgument === null || effectiveArgument.key !== first.key,
    )
  )
    return null;
  return first;
};

const parameterIsReadFromEarlierInitializer = ({
  declared,
  binding,
  index,
  variablesFor,
}: {
  readonly declared: ESTree.Function | ESTree.ArrowFunctionExpression;
  readonly binding: ESTree.BindingIdentifier;
  readonly index: number;
  readonly variablesFor: (node: ESTree.Node) => readonly Variable[];
}): boolean => {
  const earlierParameters = runtimeParametersOf(declared).slice(0, index);
  const references = variablesFor(declared)
    .filter((variable) => variable.identifiers.includes(binding))
    .flatMap((variable) => variable.references);
  return references.some(
    (reference) =>
      reference.isRead() &&
      earlierParameters.some((earlier) => isWithin(reference.identifier, earlier)),
  );
};

const usesOwnArguments = (
  declared: ESTree.Function | ESTree.ArrowFunctionExpression,
  scopeFor: (node: ESTree.Function | ESTree.ArrowFunctionExpression) => Scope,
): boolean => {
  if (declared.type === "ArrowFunctionExpression" || declared.body === null) return false;
  const scope = scopeFor(declared);
  return (
    scope.variables.some(
      (variable) => variable.name === "arguments" && variable.references.length > 0,
    ) ||
    scope.references.some(
      (reference) => reference.identifier.name === "arguments" && reference.resolved === null,
    )
  );
};

export const noInvariantDefaultParameter = createDontReviewItRule({
  name: "no-invariant-default-parameter--remove-unused-option",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow a local function parameter with a literal default when every resolvable call site supplies the same effective value and the function never escapes those calls",
      relatedGuidelines: [],
    },
    messages: {
      invariantDefaultParameter:
        "A defaulted parameter with one effective value across every closed call site must not remain configurable. Replace every reference resolved to `{{name}}` in the remaining parameter initializers and function body with `{{value}}`, then remove the parameter and its corresponding actual argument from every call site.",
    },
    schema: [],
  },
  create(inspection) {
    if (isOutOfScopeSource(inspection.filename)) return {};
    const variablesFor = (node: ESTree.Node): readonly Variable[] =>
      inspection.sourceCode.getDeclaredVariables(node);
    const sourceTextOf = (node: ESTree.Node): string => inspection.sourceCode.getText(node);
    const isUnshadowedUndefined = (node: ESTree.IdentifierReference): boolean =>
      referencesFor(inspection.sourceCode.getScope(node), node).some(
        (reference) => reference.resolved === null || reference.resolved.defs.length === 0,
      );
    const containsDirectEval = (
      declared: ESTree.Function | ESTree.ArrowFunctionExpression,
    ): boolean =>
      nodesOfType(declared, "CallExpression").some((call) => {
        if (call.optional) return false;
        const evalTarget = unwrapTransparentExpression(call.callee);
        if (evalTarget.type !== "Identifier" || evalTarget.name !== "eval") return false;
        return referencesFor(inspection.sourceCode.getScope(evalTarget), evalTarget).some(
          (reference) => reference.resolved === null || reference.resolved.defs.length === 0,
        );
      });

    const inspect = (named: NamedFunction | null): void => {
      if (named === null) return;
      if (
        usesOwnArguments(named.declared, (node) =>
          inspection.sourceCode.getScope(node.params[0] ?? node),
        )
      ) {
        return;
      }
      if (containsDirectEval(named.declared)) return;
      const calls = closedCallsOfVariables(variablesDeclaredBy(named, variablesFor));
      if (calls === null) return;

      runtimeParametersOf(named.declared).forEach((parameter, index) => {
        if (parameter.type !== "AssignmentPattern") return;
        if (parameter.left.type !== "Identifier") return;
        if (
          parameterIsReadFromEarlierInitializer({
            declared: named.declared,
            binding: parameter.left,
            index,
            variablesFor,
          })
        ) {
          return;
        }
        const fallback = literalValueOf(parameter.right, sourceTextOf);
        if (fallback === null) return;
        const invariant = invariantValueFor({
          calls,
          index,
          fallback,
          sourceTextOf,
          isUnshadowedUndefined,
        });
        if (invariant === null) return;
        inspection.report({
          node: parameter,
          messageId: "invariantDefaultParameter",
          data: { name: parameter.left.name, value: invariant.text },
        });
      });
    };

    return {
      "FunctionDeclaration:exit"(node: ESTree.Function) {
        if (hasFunctionOverload(node)) return;
        inspect(declaredFunctionOf(node));
      },
      "VariableDeclarator:exit"(node: ESTree.VariableDeclarator) {
        inspect(boundFunctionOf(node));
      },
    };
  },
});
