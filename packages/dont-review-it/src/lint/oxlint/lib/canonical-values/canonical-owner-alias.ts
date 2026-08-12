import * as ts from "typescript-6";

import {
  addCanonicalOwnerExpressionAddress,
  canonicalOwnerPropertyName,
} from "./canonical-owner-address.ts";
import { canonicalOwnerFunctionInvocations } from "./canonical-owner-call.ts";
import { addCanonicalOwnerIterationOrigins } from "./canonical-owner-container-iteration.ts";
import { addCanonicalOwnerContainerWriteOrigins } from "./canonical-owner-container-write.ts";
import {
  addCanonicalOwnerBindingAliases,
  addCanonicalOwnerContainerAddresses,
} from "./canonical-owner-container.ts";
import { canonicalOwnerExpressionIsOwner } from "./canonical-owner-expression.ts";
import {
  addCanonicalOwnerSymbol,
  unwrapCanonicalOwnerExpression,
  type CanonicalOwnerAliasState,
} from "./canonical-owner-state.ts";
import { resolveTypeScriptSymbol } from "./typescript-symbol.ts";

const addNamedPropertyAlias = (
  state: CanonicalOwnerAliasState,
  node: ts.PropertyAssignment | ts.PropertyDeclaration,
): boolean => {
  const initializer = node.initializer;
  if (
    initializer === undefined ||
    !canonicalOwnerExpressionIsOwner({ expression: initializer, state })
  ) {
    return false;
  }
  const name = canonicalOwnerPropertyName(node.name);
  const directChanged = addCanonicalOwnerSymbol(
    state,
    state.checker.getSymbolAtLocation(node.name),
  );
  const typeChanged = addCanonicalOwnerSymbol(
    state,
    name === null
      ? undefined
      : state.checker.getPropertyOfType(state.checker.getTypeAtLocation(node.parent), name),
  );
  return directChanged || typeChanged;
};

const addShorthandPropertyAlias = (
  state: CanonicalOwnerAliasState,
  node: ts.ShorthandPropertyAssignment,
): boolean =>
  canonicalOwnerExpressionIsOwner({ expression: node.name, state }) &&
  addCanonicalOwnerSymbol(
    state,
    state.checker.getPropertyOfType(state.checker.getTypeAtLocation(node.parent), node.name.text),
  );

const addPropertyAlias = (state: CanonicalOwnerAliasState, node: ts.Node): boolean => {
  if (ts.isPropertyAssignment(node) || ts.isPropertyDeclaration(node)) {
    return addNamedPropertyAlias(state, node);
  }
  return ts.isShorthandPropertyAssignment(node) ? addShorthandPropertyAlias(state, node) : false;
};

const addDeclarationAlias = (state: CanonicalOwnerAliasState, node: ts.Node): boolean =>
  (ts.isVariableDeclaration(node) || ts.isParameter(node)) && node.initializer !== undefined
    ? addCanonicalOwnerBindingAliases({ name: node.name, source: node.initializer, state })
    : false;

const assignmentTargetAlias = (input: {
  readonly source: ts.Expression;
  readonly state: CanonicalOwnerAliasState;
  readonly target: ts.Expression;
}): boolean => {
  const target =
    ts.isBinaryExpression(input.target) &&
    input.target.operatorToken.kind === ts.SyntaxKind.EqualsToken
      ? input.target.left
      : input.target;
  if (ts.isIdentifier(target)) {
    return canonicalOwnerExpressionIsOwner({ expression: input.source, state: input.state })
      ? addCanonicalOwnerSymbol(input.state, input.state.checker.getSymbolAtLocation(target))
      : false;
  }
  if (!canonicalOwnerExpressionIsOwner({ expression: input.source, state: input.state })) {
    return false;
  }
  return addCanonicalOwnerExpressionAddress({
    expression: target,
    state: input.state,
  });
};

const arrayAssignmentAliases = (input: {
  readonly source: ts.Expression;
  readonly state: CanonicalOwnerAliasState;
  readonly target: ts.ArrayLiteralExpression;
}): boolean => {
  const source = unwrapCanonicalOwnerExpression(input.source);
  if (!ts.isArrayLiteralExpression(source)) return false;
  return input.target.elements
    .map((target, index) => {
      const candidate = source.elements[index];
      if (
        ts.isOmittedExpression(target) ||
        candidate === undefined ||
        ts.isOmittedExpression(candidate) ||
        ts.isSpreadElement(candidate)
      ) {
        return false;
      }
      return assignmentTargetAlias({
        source: candidate,
        state: input.state,
        target: ts.isSpreadElement(target) ? target.expression : target,
      });
    })
    .some(Boolean);
};

const assignmentPropertyKey = (property: ts.ObjectLiteralElementLike): string | null => {
  if (!ts.isPropertyAssignment(property) && !ts.isShorthandPropertyAssignment(property)) {
    return null;
  }
  const name = property.name;
  return ts.isIdentifier(name) || ts.isStringLiteralLike(name) || ts.isNumericLiteral(name)
    ? name.text
    : null;
};

const assignmentPropertyExpression = (
  property: ts.ObjectLiteralElementLike,
): ts.Expression | null => {
  if (ts.isPropertyAssignment(property)) return property.initializer;
  return ts.isShorthandPropertyAssignment(property) ? property.name : null;
};

const objectAssignmentAliases = (input: {
  readonly source: ts.Expression;
  readonly state: CanonicalOwnerAliasState;
  readonly target: ts.ObjectLiteralExpression;
}): boolean => {
  const sourceObject = unwrapCanonicalOwnerExpression(input.source);
  if (!ts.isObjectLiteralExpression(sourceObject)) return false;
  return input.target.properties
    .map((target) => {
      const key = assignmentPropertyKey(target);
      const targetExpression = assignmentPropertyExpression(target);
      const source = sourceObject.properties.find(
        (property) => assignmentPropertyKey(property) === key,
      );
      const sourceExpression = source === undefined ? null : assignmentPropertyExpression(source);
      return key !== null && targetExpression !== null && sourceExpression !== null
        ? assignmentTargetAlias({
            source: sourceExpression,
            state: input.state,
            target: targetExpression,
          })
        : false;
    })
    .some(Boolean);
};

const addAssignmentAlias = (state: CanonicalOwnerAliasState, node: ts.Node): boolean => {
  if (
    !ts.isBinaryExpression(node) ||
    ![
      ts.SyntaxKind.EqualsToken,
      ts.SyntaxKind.AmpersandAmpersandEqualsToken,
      ts.SyntaxKind.BarBarEqualsToken,
      ts.SyntaxKind.QuestionQuestionEqualsToken,
    ].includes(node.operatorToken.kind)
  ) {
    return false;
  }
  if (
    node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
    ts.isArrayLiteralExpression(node.left)
  ) {
    return arrayAssignmentAliases({ source: node.right, state, target: node.left });
  }
  if (
    node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
    ts.isObjectLiteralExpression(node.left)
  ) {
    return objectAssignmentAliases({ source: node.right, state, target: node.left });
  }
  if (!canonicalOwnerExpressionIsOwner({ expression: node.right, state })) return false;
  const symbolChanged = ts.isIdentifier(node.left)
    ? addCanonicalOwnerSymbol(state, state.checker.getSymbolAtLocation(node.left))
    : false;
  const addressChanged = addCanonicalOwnerExpressionAddress({ expression: node.left, state });
  return symbolChanged || addressChanged;
};

const addRestParameterAliases = (input: {
  readonly arguments: readonly ts.Expression[];
  readonly parameter: ts.ParameterDeclaration;
  readonly start: number;
  readonly state: CanonicalOwnerAliasState;
}): boolean => {
  const target = input.parameter.name;
  if (!ts.isIdentifier(target)) return false;
  return input.arguments
    .slice(input.start)
    .map((argument, index) =>
      canonicalOwnerExpressionIsOwner({ expression: argument, state: input.state })
        ? addCanonicalOwnerExpressionAddress({
            expression: target,
            state: input.state,
            suffix: [String(index)],
          })
        : false,
    )
    .some(Boolean);
};

const addInvocationParameterAliases = (input: {
  readonly arguments: readonly ts.Expression[];
  readonly function_: ts.FunctionLikeDeclaration;
  readonly state: CanonicalOwnerAliasState;
}): boolean =>
  input.function_.parameters
    .map((parameter, index) => {
      if (parameter.dotDotDotToken !== undefined) {
        return addRestParameterAliases({ ...input, parameter, start: index });
      }
      const source = input.arguments[index] ?? parameter.initializer;
      return source === undefined
        ? false
        : addCanonicalOwnerBindingAliases({ name: parameter.name, source, state: input.state });
    })
    .some(Boolean);

const addCallParameterAliases = (
  state: CanonicalOwnerAliasState,
  node: ts.CallExpression,
): boolean =>
  canonicalOwnerFunctionInvocations({ call: node, checker: state.checker, program: state.program })
    .map((invocation) => addInvocationParameterAliases({ ...invocation, state }))
    .some(Boolean);

const resolvedConstructorImplementations = (
  checker: ts.TypeChecker,
  node: ts.NewExpression,
): readonly ts.ConstructorDeclaration[] => {
  const declaration = checker.getResolvedSignature(node)?.getDeclaration();
  if (declaration === undefined || !ts.isConstructorDeclaration(declaration)) return [];
  if (declaration.body !== undefined) return [declaration];
  return ts.isClassLike(declaration.parent)
    ? declaration.parent.members.flatMap((member) =>
        ts.isConstructorDeclaration(member) && member.body !== undefined ? [member] : [],
      )
    : [];
};

const addConstructionParameterAliases = (
  state: CanonicalOwnerAliasState,
  node: ts.NewExpression,
): boolean =>
  resolvedConstructorImplementations(state.checker, node)
    .map((function_) =>
      addInvocationParameterAliases({
        arguments: node.arguments ?? [],
        function_,
        state,
      }),
    )
    .some(Boolean);

const addParameterAliases = (state: CanonicalOwnerAliasState, node: ts.Node): boolean =>
  ts.isCallExpression(node)
    ? addCallParameterAliases(state, node)
    : ts.isNewExpression(node)
      ? addConstructionParameterAliases(state, node)
      : false;

const addAliasesForNode = (state: CanonicalOwnerAliasState, node: ts.Node): boolean =>
  [
    addPropertyAlias(state, node),
    addCanonicalOwnerContainerAddresses(state, node),
    addCanonicalOwnerContainerWriteOrigins(state, node),
    addCanonicalOwnerIterationOrigins(state, node),
    addDeclarationAlias(state, node),
    addAssignmentAlias(state, node),
    addParameterAliases(state, node),
  ].some(Boolean);

export const completeCanonicalOwnerAliases = (
  state: CanonicalOwnerAliasState,
): CanonicalOwnerAliasState =>
  state.nodes.map((node) => addAliasesForNode(state, node)).some(Boolean)
    ? completeCanonicalOwnerAliases(state)
    : state;

export const canonicalOwnerAliases = (input: {
  readonly checker: ts.TypeChecker;
  readonly nodes: readonly ts.Node[];
  readonly owner: ts.Symbol;
  readonly program: ts.Program;
}): CanonicalOwnerAliasState =>
  completeCanonicalOwnerAliases({
    addresses: new Map(),
    aliases: new Set([input.owner, resolveTypeScriptSymbol(input.checker, input.owner)]),
    checker: input.checker,
    nodes: input.nodes,
    owner: resolveTypeScriptSymbol(input.checker, input.owner),
    program: input.program,
    sourceAliases: new Set(),
  });

export const canonicalOwnerIdentifierIsGlobal = (input: {
  readonly checker: ts.TypeChecker;
  readonly identifier: ts.Identifier;
  readonly program: ts.Program;
}): boolean => {
  const symbol = input.checker.getSymbolAtLocation(input.identifier);
  return (
    symbol !== undefined &&
    (symbol.declarations ?? []).some((declaration) =>
      input.program.isSourceFileDefaultLibrary(declaration.getSourceFile()),
    )
  );
};
