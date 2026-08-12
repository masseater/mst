import * as ts from "typescript-6";

import { canonicalOwnerExpressionIsFromDefaultLibrary } from "./canonical-owner-default-library.ts";
import { type CanonicalOwnerEffectiveInvocation } from "./canonical-owner-effective-invocation.ts";
import {
  canonicalOwnerMemberReceiver,
  canonicalOwnerSymbolAtExpression,
  unwrapCanonicalOwnerExpression,
} from "./canonical-owner-state.ts";
import { resolveTypeScriptSymbol } from "./typescript-symbol.ts";

const HOLE_SKIPPING_METHODS: ReadonlySet<string> = new Set([
  "every",
  "filter",
  "forEach",
  "map",
  "reduce",
  "reduceRight",
  "some",
]);
const TYPED_ARRAY_CONSTRUCTORS: ReadonlySet<string> = new Set([
  "BigInt64Array",
  "BigUint64Array",
  "Float32Array",
  "Float64Array",
  "Int16Array",
  "Int32Array",
  "Int8Array",
  "Uint16Array",
  "Uint32Array",
  "Uint8Array",
  "Uint8ClampedArray",
]);

const constInitializer = (declaration: ts.Declaration): ts.Expression | null =>
  ts.isVariableDeclaration(declaration) &&
  declaration.initializer !== undefined &&
  (declaration.parent.flags & ts.NodeFlags.Const) !== 0
    ? declaration.initializer
    : null;

const staticSources = (resolution: {
  readonly checker: ts.TypeChecker;
  readonly expression: ts.Expression;
  readonly seenSymbols: ReadonlySet<ts.Symbol>;
}): readonly ts.Expression[] => {
  const current = unwrapCanonicalOwnerExpression(resolution.expression);
  if (ts.isConditionalExpression(current)) {
    return [
      ...staticSources({ ...resolution, expression: current.whenTrue }),
      ...staticSources({ ...resolution, expression: current.whenFalse }),
    ];
  }
  const symbol = canonicalOwnerSymbolAtExpression(resolution.checker, current);
  if (symbol === null) return [current];
  const resolved = resolveTypeScriptSymbol(resolution.checker, symbol);
  if (resolution.seenSymbols.has(resolved)) return [];
  const sources = (resolved.declarations ?? []).flatMap((declaration) => {
    const initializer = constInitializer(declaration);
    return initializer === null ? [] : [initializer];
  });
  const seenSymbols = new Set([...resolution.seenSymbols, resolved]);
  return sources.length === 0
    ? [current]
    : sources.flatMap((source) =>
        staticSources({ ...resolution, expression: source, seenSymbols }),
      );
};

const numericZero = (expression: ts.Expression | undefined): boolean => {
  if (expression === undefined) return false;
  const current = unwrapCanonicalOwnerExpression(expression);
  return ts.isNumericLiteral(current) && Number(current.text) === 0;
};

const arrayLiteralIsEmpty = (
  expression: ts.ArrayLiteralExpression,
  holesAreEmpty: boolean,
): boolean =>
  expression.elements.length === 0 ||
  (holesAreEmpty && expression.elements.every(ts.isOmittedExpression));

const constructorIdentity = (input: {
  readonly checker: ts.TypeChecker;
  readonly expression: ts.Expression;
  readonly program: ts.Program;
}): string | null => {
  const sources = staticSources({ ...input, seenSymbols: new Set() });
  const names = sources.flatMap((source) => {
    const current = unwrapCanonicalOwnerExpression(source);
    return ts.isIdentifier(current) &&
      canonicalOwnerExpressionIsFromDefaultLibrary({ ...input, expression: current })
      ? [current.text]
      : [];
  });
  const first = names[0];
  return first !== undefined &&
    names.length === sources.length &&
    names.every((name) => name === first)
    ? first
    : null;
};

const emptyArrayConstruction = (
  expression: ts.CallExpression | ts.NewExpression,
  name: string,
): boolean =>
  name === "Array" &&
  (expression.arguments === undefined ||
    expression.arguments.length === 0 ||
    (expression.arguments.length === 1 && numericZero(expression.arguments[0])));

type EmptyExpressionInput = {
  readonly checker: ts.TypeChecker;
  readonly expression: ts.Expression;
  readonly program: ts.Program;
};

type CollectionConstruction = ts.CallExpression | ts.NewExpression;

const emptySetOrMapConstruction = (
  input: EmptyExpressionInput & {
    readonly construction: CollectionConstruction;
    readonly name: string;
  },
): boolean => {
  if (input.name !== "Set" && input.name !== "Map") return false;
  const argument = input.construction.arguments?.[0];
  return argument === undefined || emptyIterable({ ...input, expression: argument });
};

const emptyTypedArrayConstruction = (
  input: EmptyExpressionInput & {
    readonly construction: CollectionConstruction;
    readonly name: string;
  },
): boolean => {
  if (!TYPED_ARRAY_CONSTRUCTORS.has(input.name)) return false;
  const argument = input.construction.arguments?.[0];
  return (
    argument === undefined ||
    numericZero(argument) ||
    emptyIterable({ ...input, expression: argument })
  );
};

const emptySearchParamsConstruction = (
  expression: CollectionConstruction,
  name: string,
): boolean => {
  if (name !== "URLSearchParams") return false;
  const argument = expression.arguments?.[0];
  if (argument === undefined) return true;
  const source = unwrapCanonicalOwnerExpression(argument);
  return (
    (ts.isStringLiteralLike(source) && source.text.length === 0) ||
    (ts.isArrayLiteralExpression(source) && arrayLiteralIsEmpty(source, false)) ||
    (ts.isObjectLiteralExpression(source) && source.properties.length === 0)
  );
};

const emptyConstruction = (
  input: EmptyExpressionInput,
  expression: CollectionConstruction,
): boolean => {
  const name = constructorIdentity({ ...input, expression: expression.expression });
  return (
    name !== null &&
    (emptyArrayConstruction(expression, name) ||
      emptySetOrMapConstruction({ ...input, construction: expression, name }) ||
      emptyTypedArrayConstruction({ ...input, construction: expression, name }) ||
      emptySearchParamsConstruction(expression, name))
  );
};

const emptyIterableExpression = (input: EmptyExpressionInput): boolean => {
  const current = unwrapCanonicalOwnerExpression(input.expression);
  if (ts.isArrayLiteralExpression(current)) return arrayLiteralIsEmpty(current, false);
  if (ts.isStringLiteralLike(current)) return current.text.length === 0;
  return (
    (ts.isNewExpression(current) || ts.isCallExpression(current)) &&
    emptyConstruction(input, current)
  );
};

const emptyIterable = (input: EmptyExpressionInput): boolean => {
  const sources = staticSources({ ...input, seenSymbols: new Set() });
  return (
    sources.length !== 0 &&
    sources.every((source) => emptyIterableExpression({ ...input, expression: source }))
  );
};

const emptyReceiver = (input: {
  readonly checker: ts.TypeChecker;
  readonly invocation: CanonicalOwnerEffectiveInvocation;
  readonly method: string;
  readonly program: ts.Program;
}): boolean => {
  const receiver = canonicalOwnerMemberReceiver(input.invocation.target);
  if (receiver === null) return false;
  const sources = staticSources({
    checker: input.checker,
    expression: receiver,
    seenSymbols: new Set(),
  });
  return (
    sources.length !== 0 &&
    sources.every((source) => {
      const current = unwrapCanonicalOwnerExpression(source);
      return ts.isArrayLiteralExpression(current)
        ? arrayLiteralIsEmpty(current, HOLE_SKIPPING_METHODS.has(input.method))
        : emptyIterableExpression({ ...input, expression: current });
    })
  );
};

export const canonicalOwnerCallbackHasZeroCardinality = (input: {
  readonly checker: ts.TypeChecker;
  readonly invocation: CanonicalOwnerEffectiveInvocation;
  readonly method: string;
  readonly program: ts.Program;
}): boolean =>
  input.method === "from"
    ? input.invocation.arguments[0] !== undefined &&
      emptyIterable({ ...input, expression: input.invocation.arguments[0] })
    : emptyReceiver(input);
