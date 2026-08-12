import * as ts from "typescript-6";

import {
  canonicalOwnerMemberName,
  canonicalOwnerMemberReceiver,
  canonicalOwnerResolvedSymbolAtExpression,
  unwrapCanonicalOwnerExpression,
} from "./canonical-owner-state.ts";

type StandardResolution = {
  readonly checker: ts.TypeChecker;
  readonly expression: ts.Expression;
  readonly nodes: readonly ts.Node[];
  readonly program: ts.Program;
};

export const canonicalOwnerDefaultLibraryExpression = (input: {
  readonly checker: ts.TypeChecker;
  readonly expression: ts.Expression;
  readonly program: ts.Program;
}): boolean => {
  const symbol = canonicalOwnerResolvedSymbolAtExpression(input.checker, input.expression);
  return (
    symbol !== null &&
    (symbol.declarations ?? []).some((declaration) =>
      input.program.isSourceFileDefaultLibrary(declaration.getSourceFile()),
    )
  );
};

const globalObjectPath = (input: {
  readonly checker: ts.TypeChecker;
  readonly expression: ts.Expression;
  readonly program: ts.Program;
}): string | null => {
  const current = unwrapCanonicalOwnerExpression(input.expression);
  if (ts.isIdentifier(current) && canonicalOwnerDefaultLibraryExpression(input)) {
    return current.text === "globalThis" ? "global" : `global.${current.text}`;
  }
  const receiver = canonicalOwnerMemberReceiver(current);
  const name = canonicalOwnerMemberName(current);
  if (receiver === null || name === null) return null;
  const base = globalObjectPath({ ...input, expression: receiver });
  return base === null ? null : `${base}.${name}`;
};

const expressionRuntimePath = (input: {
  readonly checker: ts.TypeChecker;
  readonly expression: ts.Expression;
  readonly program: ts.Program;
}): string | null => {
  const current = unwrapCanonicalOwnerExpression(input.expression);
  if (ts.isIdentifier(current)) return globalObjectPath({ ...input, expression: current });
  const receiver = canonicalOwnerMemberReceiver(current);
  if (receiver === null) return null;
  const name = canonicalOwnerMemberName(current);
  const base = globalObjectPath({ ...input, expression: receiver });
  if (base !== null) return `${base}.${name ?? "*"}`;
  if (name === null || !canonicalOwnerDefaultLibraryExpression(input)) return null;
  const type = input.checker.getTypeAtLocation(receiver);
  return input.checker.getIndexTypeOfType(type, ts.IndexKind.Number) === undefined
    ? null
    : `global.Array.prototype.${name}`;
};

const assignmentTarget = (node: ts.Node): ts.Expression | null => {
  if (
    ts.isBinaryExpression(node) &&
    node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
    node.operatorToken.kind <= ts.SyntaxKind.LastAssignment
  ) {
    return node.left;
  }
  if (ts.isDeleteExpression(node)) return node.expression;
  if (
    (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) &&
    (node.operator === ts.SyntaxKind.PlusPlusToken ||
      node.operator === ts.SyntaxKind.MinusMinusToken)
  ) {
    return node.operand;
  }
  return null;
};

const staticPropertyKey = (expression: ts.Expression): string | null => {
  const current = unwrapCanonicalOwnerExpression(expression);
  if (ts.isStringLiteralLike(current) || ts.isNumericLiteral(current)) return current.text;
  return ts.isNoSubstitutionTemplateLiteral(current) ? current.text : null;
};

const objectPropertyKeys = (expression: ts.Expression): readonly string[] | null => {
  const current = unwrapCanonicalOwnerExpression(expression);
  if (!ts.isObjectLiteralExpression(current)) return null;
  const keys = current.properties.flatMap((property) => {
    if (ts.isSpreadAssignment(property)) return [];
    const name = property.name;
    return ts.isIdentifier(name) || ts.isStringLiteralLike(name) || ts.isNumericLiteral(name)
      ? [name.text]
      : [];
  });
  return keys.length === current.properties.length ? keys : null;
};

type MutationCall = {
  readonly call: ts.CallExpression;
  readonly checker: ts.TypeChecker;
  readonly name: string | null;
  readonly program: ts.Program;
  readonly receiverPath: string | null;
  readonly targetPath: string;
};

const mutationCall = (input: {
  readonly call: ts.CallExpression;
  readonly checker: ts.TypeChecker;
  readonly program: ts.Program;
}): MutationCall | null => {
  if (!canonicalOwnerDefaultLibraryExpression({ ...input, expression: input.call.expression })) {
    return null;
  }
  const receiver = canonicalOwnerMemberReceiver(input.call.expression);
  const receiverPath =
    receiver === null ? null : globalObjectPath({ ...input, expression: receiver });
  const name = canonicalOwnerMemberName(input.call.expression);
  const target = input.call.arguments[0];
  const targetPath =
    target === undefined ? null : globalObjectPath({ ...input, expression: target });
  return targetPath === null ? null : { ...input, name, receiverPath, targetPath };
};

const singlePropertyMutationPaths = (input: MutationCall): readonly string[] => {
  const objectMutation =
    input.receiverPath === "global.Object" &&
    (input.name === "defineProperty" || input.name === "deleteProperty");
  const reflectMutation =
    input.receiverPath === "global.Reflect" &&
    (input.name === "defineProperty" || input.name === "deleteProperty" || input.name === "set");
  if (!objectMutation && !reflectMutation) return [];
  const key = input.call.arguments[1];
  const spelling = key === undefined ? null : staticPropertyKey(key);
  return [`${input.targetPath}.${spelling ?? "*"}`];
};

const prototypeMutationPaths = (input: MutationCall): readonly string[] => {
  const receiverIsStandard =
    input.receiverPath === "global.Object" || input.receiverPath === "global.Reflect";
  return receiverIsStandard && input.name === "setPrototypeOf" ? [`${input.targetPath}.*`] : [];
};

const objectPropertiesMutationPaths = (input: MutationCall): readonly string[] => {
  if (input.receiverPath !== "global.Object" || input.name !== "defineProperties") return [];
  const descriptors = input.call.arguments[1];
  const keys = descriptors === undefined ? null : objectPropertyKeys(descriptors);
  return keys === null
    ? [`${input.targetPath}.*`]
    : keys.map((key) => `${input.targetPath}.${key}`);
};

const objectAssignMutationPaths = (input: MutationCall): readonly string[] => {
  if (input.receiverPath !== "global.Object" || input.name !== "assign") return [];
  return input.call.arguments.slice(1).flatMap((source) => {
    const keys = objectPropertyKeys(source);
    return keys === null
      ? [`${input.targetPath}.*`]
      : keys.map((key) => `${input.targetPath}.${key}`);
  });
};

const mutationCallPaths = (input: {
  readonly call: ts.CallExpression;
  readonly checker: ts.TypeChecker;
  readonly program: ts.Program;
}): readonly string[] => {
  const mutation = mutationCall(input);
  return mutation === null
    ? []
    : [
        ...singlePropertyMutationPaths(mutation),
        ...prototypeMutationPaths(mutation),
        ...objectPropertiesMutationPaths(mutation),
        ...objectAssignMutationPaths(mutation),
      ];
};

const executionContext = (node: ts.Node): ts.Node =>
  ts.isSourceFile(node) || ts.isFunctionLike(node) ? node : executionContext(node.parent);

const nodeCanExecuteBefore = (node: ts.Node, expression: ts.Expression): boolean => {
  if (node.getSourceFile() !== expression.getSourceFile()) return true;
  const nodeContext = executionContext(node);
  const expressionContext = executionContext(expression);
  return nodeContext !== expressionContext || node.getStart() < expression.getStart();
};

const runtimeWriteAffects = (expected: string, write: string): boolean => {
  if (expected === write || expected.startsWith(`${write}.`)) return true;
  if (write.endsWith(".*")) return expected.startsWith(write.slice(0, -1));
  return write.endsWith(".__proto__") && expected.startsWith(`${write.slice(0, -10)}.`);
};

const expressionAncestorSymbols = (
  checker: ts.TypeChecker,
  expression: ts.Expression,
): readonly ts.Symbol[] => {
  const receiver = canonicalOwnerMemberReceiver(expression);
  if (receiver === null) return [];
  const symbol = canonicalOwnerResolvedSymbolAtExpression(checker, receiver);
  return [...(symbol === null ? [] : [symbol]), ...expressionAncestorSymbols(checker, receiver)];
};

const directWriteMatches = (
  input: StandardResolution & { readonly target: ts.Expression },
): boolean => {
  const expectedSymbol = canonicalOwnerResolvedSymbolAtExpression(input.checker, input.expression);
  const targetSymbol = canonicalOwnerResolvedSymbolAtExpression(input.checker, input.target);
  if (
    targetSymbol !== null &&
    (targetSymbol === expectedSymbol ||
      expressionAncestorSymbols(input.checker, input.expression).includes(targetSymbol))
  ) {
    return true;
  }
  const expectedPath = expressionRuntimePath(input);
  const targetPath = expressionRuntimePath({ ...input, expression: input.target });
  return (
    expectedPath !== null && targetPath !== null && runtimeWriteAffects(expectedPath, targetPath)
  );
};

const nodeWritesExpression = (input: StandardResolution & { readonly node: ts.Node }): boolean => {
  const target = assignmentTarget(input.node);
  if (target !== null && directWriteMatches({ ...input, target })) return true;
  if (!ts.isCallExpression(input.node)) return false;
  const expectedPath = expressionRuntimePath(input);
  return (
    expectedPath !== null &&
    mutationCallPaths({ ...input, call: input.node }).some((path) =>
      runtimeWriteAffects(expectedPath, path),
    )
  );
};

export const canonicalOwnerDefaultLibraryExpressionIsStable = (
  input: StandardResolution,
): boolean =>
  canonicalOwnerDefaultLibraryExpression(input) &&
  !input.nodes.some(
    (node) =>
      nodeCanExecuteBefore(node, input.expression) && nodeWritesExpression({ ...input, node }),
  );
