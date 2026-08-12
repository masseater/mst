import * as ts from "typescript-6";

import { IN_PLACE_ARRAY_METHODS } from "../array-mutation-methods.ts";
import {
  canonicalOwnerAliases,
  completeCanonicalOwnerAliases,
  canonicalOwnerIdentifierIsGlobal,
} from "./canonical-owner-alias.ts";
import { canonicalOwnerBindingWriteMutates } from "./canonical-owner-binding-write.ts";
import { canonicalOwnerExpressionIsOwner } from "./canonical-owner-expression.ts";
import {
  CANONICAL_OWNER_OBJECT_MUTATORS,
  CANONICAL_OWNER_REFLECT_MUTATORS,
  canonicalOwnerNormalizedMutatorCallMutates,
} from "./canonical-owner-mutator.ts";
import {
  canonicalOwnerOpaqueCallMutates,
  canonicalOwnerOpaqueConstructionMutates,
} from "./canonical-owner-opaque.ts";
import { addCanonicalOwnerSourceAliases } from "./canonical-owner-source.ts";
import {
  canonicalOwnerMemberName,
  canonicalOwnerMemberReceiver,
  unwrapCanonicalOwnerExpression,
  type CanonicalOwnerAliasState,
} from "./canonical-owner-state.ts";

const isGlobalMember = (input: {
  readonly expression: ts.Expression;
  readonly globalName: string;
  readonly names: ReadonlySet<string>;
  readonly program: ts.Program;
  readonly checker: ts.TypeChecker;
}): boolean => {
  const receiver = canonicalOwnerMemberReceiver(input.expression);
  const current = receiver === null ? null : unwrapCanonicalOwnerExpression(receiver);
  const name = canonicalOwnerMemberName(input.expression);
  return (
    name !== null &&
    input.names.has(name) &&
    current !== null &&
    ts.isIdentifier(current) &&
    current.text === input.globalName &&
    canonicalOwnerIdentifierIsGlobal({
      checker: input.checker,
      identifier: current,
      program: input.program,
    })
  );
};

const isArrayPrototype = (input: {
  readonly checker: ts.TypeChecker;
  readonly expression: ts.Expression;
  readonly program: ts.Program;
}): boolean => {
  const current = unwrapCanonicalOwnerExpression(input.expression);
  const receiver = canonicalOwnerMemberReceiver(current);
  const base = receiver === null ? null : unwrapCanonicalOwnerExpression(receiver);
  return (
    canonicalOwnerMemberName(current) === "prototype" &&
    base !== null &&
    ts.isIdentifier(base) &&
    base.text === "Array" &&
    canonicalOwnerIdentifierIsGlobal({ ...input, identifier: base })
  );
};

const bindingElementIsArrayMutator = (input: {
  readonly checker: ts.TypeChecker;
  readonly declaration: ts.BindingElement;
  readonly program: ts.Program;
}): boolean => {
  const variable = input.declaration.parent.parent;
  const propertyName = input.declaration.propertyName ?? input.declaration.name;
  return (
    ts.isVariableDeclaration(variable) &&
    variable.initializer !== undefined &&
    ts.isIdentifier(propertyName) &&
    IN_PLACE_ARRAY_METHODS.has(propertyName.text) &&
    isArrayPrototype({ ...input, expression: variable.initializer })
  );
};

const arrayMutatorExpression = (input: {
  readonly checker: ts.TypeChecker;
  readonly expression: ts.Expression;
  readonly program: ts.Program;
}): boolean => {
  const current = unwrapCanonicalOwnerExpression(input.expression);
  const receiver = canonicalOwnerMemberReceiver(current);
  const name = canonicalOwnerMemberName(current);
  if (receiver !== null && name !== null && IN_PLACE_ARRAY_METHODS.has(name)) {
    return isArrayPrototype({ ...input, expression: receiver });
  }
  if (!ts.isIdentifier(current)) return false;
  const symbol = input.checker.getSymbolAtLocation(current);
  return (symbol?.declarations ?? []).some((declaration) => {
    if (ts.isVariableDeclaration(declaration) && declaration.initializer !== undefined) {
      return arrayMutatorExpression({ ...input, expression: declaration.initializer });
    }
    return (
      ts.isBindingElement(declaration) && bindingElementIsArrayMutator({ ...input, declaration })
    );
  });
};

const directCallMutatesOwner = (input: {
  readonly call: ts.CallExpression;
  readonly ownerIsArray: boolean;
  readonly program: ts.Program;
  readonly state: CanonicalOwnerAliasState;
}): boolean => {
  const receiver = canonicalOwnerMemberReceiver(input.call.expression);
  const name = canonicalOwnerMemberName(input.call.expression);
  if (
    input.ownerIsArray &&
    receiver !== null &&
    name !== null &&
    IN_PLACE_ARRAY_METHODS.has(name) &&
    canonicalOwnerExpressionIsOwner({ expression: receiver, state: input.state })
  ) {
    return true;
  }
  const first = input.call.arguments[0];
  if (
    first === undefined ||
    !canonicalOwnerExpressionIsOwner({ expression: first, state: input.state })
  ) {
    return false;
  }
  return (
    isGlobalMember({
      checker: input.state.checker,
      expression: input.call.expression,
      globalName: "Object",
      names: CANONICAL_OWNER_OBJECT_MUTATORS,
      program: input.program,
    }) ||
    isGlobalMember({
      checker: input.state.checker,
      expression: input.call.expression,
      globalName: "Reflect",
      names: CANONICAL_OWNER_REFLECT_MUTATORS,
      program: input.program,
    })
  );
};

const forwardedCallMutatesOwner = (input: {
  readonly call: ts.CallExpression;
  readonly program: ts.Program;
  readonly state: CanonicalOwnerAliasState;
}): boolean => {
  const name = canonicalOwnerMemberName(input.call.expression);
  const mutator = canonicalOwnerMemberReceiver(input.call.expression);
  if ((name === "call" || name === "apply") && mutator !== null) {
    const thisArgument = input.call.arguments[0];
    return (
      thisArgument !== undefined &&
      arrayMutatorExpression({
        checker: input.state.checker,
        expression: mutator,
        program: input.program,
      }) &&
      canonicalOwnerExpressionIsOwner({ expression: thisArgument, state: input.state })
    );
  }
  const reflectApply = isGlobalMember({
    checker: input.state.checker,
    expression: input.call.expression,
    globalName: "Reflect",
    names: new Set(["apply"]),
    program: input.program,
  });
  if (!reflectApply) return false;
  const target = input.call.arguments[0];
  const thisArgument = input.call.arguments[1];
  return (
    target !== undefined &&
    thisArgument !== undefined &&
    arrayMutatorExpression({
      checker: input.state.checker,
      expression: target,
      program: input.program,
    }) &&
    canonicalOwnerExpressionIsOwner({ expression: thisArgument, state: input.state })
  );
};

const memberWriteMutatesOwner = (
  state: CanonicalOwnerAliasState,
  expression: ts.Expression,
): boolean => {
  const receiver = canonicalOwnerMemberReceiver(expression);
  return receiver !== null && canonicalOwnerExpressionIsOwner({ expression: receiver, state });
};

const callMutatesOwner = (input: {
  readonly call: ts.CallExpression;
  readonly ownerIsArray: boolean;
  readonly program: ts.Program;
  readonly state: CanonicalOwnerAliasState;
}): boolean =>
  directCallMutatesOwner(input) ||
  forwardedCallMutatesOwner(input) ||
  canonicalOwnerNormalizedMutatorCallMutates({ call: input.call, state: input.state }) ||
  canonicalOwnerOpaqueCallMutates({ call: input.call, state: input.state });

const nodeMutatesOwner = (input: {
  readonly node: ts.Node;
  readonly ownerIsArray: boolean;
  readonly program: ts.Program;
  readonly state: CanonicalOwnerAliasState;
}): boolean => {
  if (ts.isCallExpression(input.node)) {
    return callMutatesOwner({ ...input, call: input.node });
  }
  if (ts.isNewExpression(input.node)) {
    return canonicalOwnerOpaqueConstructionMutates({ expression: input.node, state: input.state });
  }
  if (ts.isDeleteExpression(input.node)) {
    return memberWriteMutatesOwner(input.state, input.node.expression);
  }
  if (
    ts.isBinaryExpression(input.node) &&
    input.node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
    input.node.operatorToken.kind <= ts.SyntaxKind.LastAssignment
  ) {
    return memberWriteMutatesOwner(input.state, input.node.left);
  }
  return ts.isPrefixUnaryExpression(input.node) || ts.isPostfixUnaryExpression(input.node)
    ? memberWriteMutatesOwner(input.state, input.node.operand)
    : false;
};

export const canonicalOwnerIsMutated = (input: {
  readonly checker: ts.TypeChecker;
  readonly declaration: ts.VariableDeclaration;
  readonly nodes: readonly ts.Node[];
  readonly owner: ts.Symbol;
  readonly ownerIsArray: boolean;
  readonly program: ts.Program;
}): boolean => {
  const state = canonicalOwnerAliases({
    checker: input.checker,
    nodes: input.nodes,
    owner: input.owner,
    program: input.program,
  });
  if (input.declaration.initializer !== undefined) {
    addCanonicalOwnerSourceAliases(state, input.declaration.initializer);
    completeCanonicalOwnerAliases(state);
  }
  return input.nodes.some(
    (node) =>
      canonicalOwnerBindingWriteMutates({ declaration: input.declaration, node, state }) ||
      nodeMutatesOwner({ ...input, node, state }),
  );
};
