import * as ts from "typescript-6";

import { canonicalOwnerIdentifierIsGlobal } from "./canonical-owner-alias.ts";
import { canonicalOwnerAliasedCalledFunctions } from "./canonical-owner-call.ts";
import {
  canonicalOwnerIsGlobalMethod,
  canonicalOwnerSameReference,
  canonicalOwnerStaticPropertyText,
  type CanonicalOwnerProtocolInput,
} from "./canonical-owner-execution-protocol-state.ts";
import {
  canonicalOwnerMemberName,
  canonicalOwnerMemberReceiver,
  canonicalOwnerSymbolAtExpression,
  unwrapCanonicalOwnerExpression,
  type ExecutableFunction,
} from "./canonical-owner-state.ts";
import { resolveTypeScriptSymbol } from "./typescript-symbol.ts";

const executablePropertyFunctions = (input: {
  readonly aliases: ReadonlyMap<ts.Symbol, ReadonlySet<ExecutableFunction>>;
  readonly checker: ts.TypeChecker;
  readonly property: ts.ObjectLiteralElementLike;
}): readonly ExecutableFunction[] => {
  if (
    (ts.isMethodDeclaration(input.property) ||
      ts.isGetAccessorDeclaration(input.property) ||
      ts.isSetAccessorDeclaration(input.property)) &&
    input.property.body !== undefined
  ) {
    return [input.property as ExecutableFunction];
  }
  return ts.isPropertyAssignment(input.property)
    ? canonicalOwnerAliasedCalledFunctions({
        aliases: input.aliases,
        checker: input.checker,
        expression: input.property.initializer,
      }).filter((function_) => function_.asteriskToken === undefined)
    : [];
};

const objectLiteralsAtExpression = (input: {
  readonly checker: ts.TypeChecker;
  readonly expression: ts.Expression;
  readonly seenSymbols?: ReadonlySet<ts.Symbol>;
}): readonly ts.ObjectLiteralExpression[] => {
  const current = unwrapCanonicalOwnerExpression(input.expression);
  if (ts.isObjectLiteralExpression(current)) return [current];
  const symbol = canonicalOwnerSymbolAtExpression(input.checker, current);
  if (symbol === null) return [];
  const resolved = resolveTypeScriptSymbol(input.checker, symbol);
  const seenSymbols = input.seenSymbols ?? new Set<ts.Symbol>();
  if (seenSymbols.has(resolved)) return [];
  const next = new Set([...seenSymbols, resolved]);
  return (resolved.declarations ?? []).flatMap((declaration) => {
    if (
      (ts.isVariableDeclaration(declaration) ||
        ts.isPropertyDeclaration(declaration) ||
        ts.isPropertyAssignment(declaration)) &&
      declaration.initializer !== undefined
    ) {
      return objectLiteralsAtExpression({
        checker: input.checker,
        expression: declaration.initializer,
        seenSymbols: next,
      });
    }
    return [];
  });
};

const protocolPropertyName = (input: {
  readonly checker: ts.TypeChecker;
  readonly name: ts.PropertyName;
  readonly program: ts.Program;
}): string | null => {
  if (!ts.isComputedPropertyName(input.name)) return null;
  const current = unwrapCanonicalOwnerExpression(input.name.expression);
  const receiver = canonicalOwnerMemberReceiver(current);
  const member = canonicalOwnerMemberName(current);
  const base = receiver === null ? null : unwrapCanonicalOwnerExpression(receiver);
  return base !== null &&
    ts.isIdentifier(base) &&
    base.text === "Symbol" &&
    canonicalOwnerIdentifierIsGlobal({ ...input, identifier: base })
    ? member
    : null;
};

export const canonicalOwnerSymbolProtocolFunctions = (input: {
  readonly aliases: ReadonlyMap<ts.Symbol, ReadonlySet<ExecutableFunction>>;
  readonly checker: ts.TypeChecker;
  readonly expression: ts.Expression;
  readonly program: ts.Program;
  readonly protocol: string;
}): readonly ExecutableFunction[] =>
  objectLiteralsAtExpression(input).flatMap((object) =>
    object.properties.flatMap((property) =>
      "name" in property &&
      property.name !== undefined &&
      protocolPropertyName({ ...input, name: property.name }) === input.protocol
        ? executablePropertyFunctions({ ...input, property })
        : [],
    ),
  );

const namedObjectPropertyFunctions = (input: {
  readonly aliases: ReadonlyMap<ts.Symbol, ReadonlySet<ExecutableFunction>>;
  readonly checker: ts.TypeChecker;
  readonly name: string;
  readonly object: ts.ObjectLiteralExpression;
}): readonly ExecutableFunction[] =>
  input.object.properties.flatMap((property) =>
    "name" in property && property.name?.getText().replaceAll(/["']/gu, "") === input.name
      ? executablePropertyFunctions({ ...input, property })
      : [],
  );

const propertyNameText = (name: ts.PropertyName): string | null => {
  if (ts.isIdentifier(name) || ts.isStringLiteralLike(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  return ts.isComputedPropertyName(name) ? canonicalOwnerStaticPropertyText(name.expression) : null;
};

const accessorNameMatches = (name: ts.PropertyName, expected: string | null): boolean =>
  expected === null || propertyNameText(name) === expected;

const getterPropertyFunctions = (
  property: ts.ObjectLiteralElementLike,
  name: string | null,
): readonly ExecutableFunction[] =>
  ts.isGetAccessorDeclaration(property) &&
  property.body !== undefined &&
  accessorNameMatches(property.name, name)
    ? [property as ExecutableFunction]
    : [];

const setterPropertyFunctions = (
  property: ts.ObjectLiteralElementLike,
  name: string | null,
): readonly ExecutableFunction[] =>
  ts.isSetAccessorDeclaration(property) &&
  property.body !== undefined &&
  accessorNameMatches(property.name, name)
    ? [property as ExecutableFunction]
    : [];

const namedAccessorFunctions = (input: {
  readonly accessor: "get" | "set";
  readonly checker: ts.TypeChecker;
  readonly expression: ts.Expression;
  readonly name: string | null;
}): readonly ExecutableFunction[] =>
  objectLiteralsAtExpression(input).flatMap((object) =>
    object.properties.flatMap((property) =>
      input.accessor === "get"
        ? getterPropertyFunctions(property, input.name)
        : setterPropertyFunctions(property, input.name),
    ),
  );

const installedAccessorFunctions = (
  input: CanonicalOwnerProtocolInput & {
    readonly accessor: "get" | "set";
    readonly key: string | null;
    readonly receiver: ts.Expression;
  },
): readonly ExecutableFunction[] =>
  input.nodes.flatMap((node) => {
    if (!ts.isCallExpression(node)) return [];
    const target = node.arguments[0];
    if (
      target === undefined ||
      !canonicalOwnerIsGlobalMethod({
        ...input,
        call: node,
        method: "defineProperty",
        object: "Object",
      }) ||
      !canonicalOwnerSameReference({
        checker: input.checker,
        left: input.receiver,
        right: target,
      }) ||
      (input.key !== null && canonicalOwnerStaticPropertyText(node.arguments[1]) !== input.key)
    ) {
      return [];
    }
    const descriptor = node.arguments[2];
    return descriptor === undefined
      ? []
      : objectLiteralsAtExpression({ checker: input.checker, expression: descriptor }).flatMap(
          (object) => namedObjectPropertyFunctions({ ...input, name: input.accessor, object }),
        );
  });

const declarationInitializer = (declaration: ts.Declaration): ts.Expression | null =>
  (ts.isVariableDeclaration(declaration) || ts.isPropertyDeclaration(declaration)) &&
  declaration.initializer !== undefined
    ? declaration.initializer
    : null;

const proxyHandlerObjects = (input: {
  readonly checker: ts.TypeChecker;
  readonly expression: ts.Expression;
  readonly program: ts.Program;
  readonly seenSymbols?: ReadonlySet<ts.Symbol>;
}): readonly ts.ObjectLiteralExpression[] => {
  const current = unwrapCanonicalOwnerExpression(input.expression);
  if (ts.isNewExpression(current)) return proxyHandlerObjectsAtConstruction(input, current);
  const symbol = canonicalOwnerSymbolAtExpression(input.checker, current);
  if (symbol === null) return [];
  const resolved = resolveTypeScriptSymbol(input.checker, symbol);
  const seenSymbols = input.seenSymbols ?? new Set<ts.Symbol>();
  if (seenSymbols.has(resolved)) return [];
  const next = new Set([...seenSymbols, resolved]);
  return (resolved.declarations ?? []).flatMap((declaration) => {
    const initializer = declarationInitializer(declaration);
    return initializer === null
      ? []
      : proxyHandlerObjects({ ...input, expression: initializer, seenSymbols: next });
  });
};

const proxyHandlerObjectsAtConstruction = (
  input: { readonly checker: ts.TypeChecker; readonly program: ts.Program },
  construction: ts.NewExpression,
): readonly ts.ObjectLiteralExpression[] => {
  const callee = unwrapCanonicalOwnerExpression(construction.expression);
  const handler = construction.arguments?.[1];
  return ts.isIdentifier(callee) &&
    callee.text === "Proxy" &&
    canonicalOwnerIdentifierIsGlobal({ ...input, identifier: callee }) &&
    handler !== undefined
    ? objectLiteralsAtExpression({ checker: input.checker, expression: handler })
    : [];
};

export const canonicalOwnerProxyTrapFunctions = (input: {
  readonly aliases: ReadonlyMap<ts.Symbol, ReadonlySet<ExecutableFunction>>;
  readonly checker: ts.TypeChecker;
  readonly expression: ts.Expression;
  readonly program: ts.Program;
  readonly trap: string;
}): readonly ExecutableFunction[] =>
  proxyHandlerObjects(input).flatMap((object) =>
    namedObjectPropertyFunctions({ ...input, name: input.trap, object }),
  );

export const canonicalOwnerNamedPropertyFunctions = (input: {
  readonly aliases: ReadonlyMap<ts.Symbol, ReadonlySet<ExecutableFunction>>;
  readonly checker: ts.TypeChecker;
  readonly expression: ts.Expression;
  readonly name: string;
}): readonly ExecutableFunction[] =>
  objectLiteralsAtExpression(input).flatMap((object) =>
    namedObjectPropertyFunctions({ ...input, object }),
  );

export const canonicalOwnerGetterFunctions = (input: {
  readonly checker: ts.TypeChecker;
  readonly expression: ts.Expression;
}): readonly ExecutableFunction[] =>
  namedAccessorFunctions({ ...input, accessor: "get", name: null });

const memberTarget = (
  expression: ts.Expression,
): { readonly key: string | null; readonly receiver: ts.Expression } | null => {
  const receiver = canonicalOwnerMemberReceiver(expression);
  return receiver === null ? null : { key: canonicalOwnerMemberName(expression), receiver };
};

const directSetterFunctions = (
  checker: ts.TypeChecker,
  expression: ts.Expression,
): readonly ExecutableFunction[] => {
  const symbol = canonicalOwnerSymbolAtExpression(checker, expression);
  return symbol === null
    ? []
    : (resolveTypeScriptSymbol(checker, symbol).declarations ?? []).flatMap((declaration) =>
        ts.isSetAccessorDeclaration(declaration) && declaration.body !== undefined
          ? [declaration as ExecutableFunction]
          : [],
      );
};

const propertyGetterFunctions = (
  input: CanonicalOwnerProtocolInput,
): readonly ExecutableFunction[] => {
  if (!ts.isPropertyAccessExpression(input.node) && !ts.isElementAccessExpression(input.node)) {
    return [];
  }
  const target = memberTarget(input.node);
  return target === null
    ? []
    : [
        ...installedAccessorFunctions({ ...input, ...target, accessor: "get" }),
        ...canonicalOwnerProxyTrapFunctions({
          ...input,
          expression: target.receiver,
          trap: "get",
        }),
      ];
};

const nodeIsAssignment = (node: ts.Node): node is ts.BinaryExpression =>
  ts.isBinaryExpression(node) &&
  node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
  node.operatorToken.kind <= ts.SyntaxKind.LastAssignment;

type WriteTarget = {
  readonly expression: ts.Expression | null;
  readonly key: string | null;
  readonly receiver: ts.Expression;
};

const assignmentWriteTargets = (node: ts.Node): readonly WriteTarget[] => {
  if (!nodeIsAssignment(node)) return [];
  const target = memberTarget(node.left);
  return target === null ? [] : [{ ...target, expression: node.left }];
};

const updateWriteTargets = (node: ts.Node): readonly WriteTarget[] => {
  const update =
    (ts.isPrefixUnaryExpression(node) &&
      (node.operator === ts.SyntaxKind.PlusPlusToken ||
        node.operator === ts.SyntaxKind.MinusMinusToken)) ||
    ts.isPostfixUnaryExpression(node);
  if (!update) return [];
  const target = memberTarget(node.operand);
  return target === null ? [] : [{ ...target, expression: node.operand }];
};

const reflectWriteTargets = (input: CanonicalOwnerProtocolInput): readonly WriteTarget[] => {
  if (
    ts.isCallExpression(input.node) &&
    canonicalOwnerIsGlobalMethod({ ...input, call: input.node, method: "set", object: "Reflect" })
  ) {
    const receiver = input.node.arguments[0];
    return receiver === undefined
      ? []
      : [
          {
            expression: null,
            key: canonicalOwnerStaticPropertyText(input.node.arguments[1]),
            receiver,
          },
        ];
  }
  return [];
};

const writeTargets = (input: CanonicalOwnerProtocolInput): readonly WriteTarget[] => [
  ...assignmentWriteTargets(input.node),
  ...updateWriteTargets(input.node),
  ...reflectWriteTargets(input),
];

const propertySetterFunctions = (
  input: CanonicalOwnerProtocolInput,
): readonly ExecutableFunction[] =>
  writeTargets(input).flatMap((target) => [
    ...(target.expression === null
      ? namedAccessorFunctions({
          accessor: "set",
          checker: input.checker,
          expression: target.receiver,
          name: target.key,
        })
      : directSetterFunctions(input.checker, target.expression)),
    ...installedAccessorFunctions({ ...input, ...target, accessor: "set" }),
    ...canonicalOwnerProxyTrapFunctions({
      ...input,
      expression: target.receiver,
      trap: "set",
    }),
  ]);

const deleteProtocolFunctions = (
  input: CanonicalOwnerProtocolInput,
): readonly ExecutableFunction[] => {
  if (!ts.isDeleteExpression(input.node)) return [];
  const target = memberTarget(input.node.expression);
  return target === null
    ? []
    : canonicalOwnerProxyTrapFunctions({
        ...input,
        expression: target.receiver,
        trap: "deleteProperty",
      });
};

const objectSpreadProtocolFunctions = (
  input: CanonicalOwnerProtocolInput,
): readonly ExecutableFunction[] =>
  ts.isSpreadAssignment(input.node)
    ? [
        ...canonicalOwnerGetterFunctions({ ...input, expression: input.node.expression }),
        ...canonicalOwnerProxyTrapFunctions({
          ...input,
          expression: input.node.expression,
          trap: "ownKeys",
        }),
        ...canonicalOwnerProxyTrapFunctions({
          ...input,
          expression: input.node.expression,
          trap: "get",
        }),
      ]
    : [];

export const canonicalOwnerPropertyExecutionFunctions = (
  input: CanonicalOwnerProtocolInput,
): readonly ExecutableFunction[] => [
  ...propertyGetterFunctions(input),
  ...propertySetterFunctions(input),
  ...deleteProtocolFunctions(input),
  ...objectSpreadProtocolFunctions(input),
];
