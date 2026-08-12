import * as ts from "typescript-6";

import { IN_PLACE_ARRAY_METHODS } from "../array-mutation-methods.ts";
import { canonicalOwnerExpressionIsOwner } from "./canonical-owner-expression.ts";
import {
  canonicalOwnerExpressionIsDefaultLibrary,
  canonicalOwnerGlobalIdentifierIs,
} from "./canonical-owner-standard.ts";
import {
  canonicalOwnerDeclarationInitializer,
  canonicalOwnerMemberName,
  canonicalOwnerMemberReceiver,
  canonicalOwnerSymbolAtExpression,
  unwrapCanonicalOwnerExpression,
  type CanonicalOwnerAliasState,
} from "./canonical-owner-state.ts";
import { resolveTypeScriptSymbol } from "./typescript-symbol.ts";

export const CANONICAL_OWNER_OBJECT_MUTATORS: ReadonlySet<string> = new Set([
  "assign",
  "defineProperties",
  "defineProperty",
  "setPrototypeOf",
]);

export const CANONICAL_OWNER_REFLECT_MUTATORS: ReadonlySet<string> = new Set([
  "defineProperty",
  "deleteProperty",
  "set",
  "setPrototypeOf",
]);

type MutatorOrigin = {
  readonly boundArguments: readonly ts.Expression[];
  readonly boundThis: ts.Expression | null;
  readonly kind: "argument" | "receiver";
};

const expressionResolvesGlobal = (input: {
  readonly expression: ts.Expression;
  readonly name: string;
  readonly seenSymbols: ReadonlySet<ts.Symbol>;
  readonly state: CanonicalOwnerAliasState;
}): boolean => {
  const current = unwrapCanonicalOwnerExpression(input.expression);
  if (
    canonicalOwnerGlobalIdentifierIs({ identifier: current, name: input.name, state: input.state })
  ) {
    return true;
  }
  if (!ts.isIdentifier(current)) return false;
  const symbol = input.state.checker.getSymbolAtLocation(current);
  const resolved =
    symbol === undefined ? null : resolveTypeScriptSymbol(input.state.checker, symbol);
  if (resolved === null || input.seenSymbols.has(resolved)) return false;
  const next = new Set([...input.seenSymbols, resolved]);
  return (resolved.declarations ?? []).some((declaration) => {
    const initializer = canonicalOwnerDeclarationInitializer(declaration);
    return (
      initializer !== null &&
      expressionResolvesGlobal({ ...input, expression: initializer, seenSymbols: next })
    );
  });
};

const directStandardMutator = (input: {
  readonly expression: ts.Expression;
  readonly state: CanonicalOwnerAliasState;
}): MutatorOrigin | null => {
  const name = canonicalOwnerMemberName(input.expression);
  const receiver = canonicalOwnerMemberReceiver(input.expression);
  if (name === null || receiver === null) return null;
  const objectMutator =
    CANONICAL_OWNER_OBJECT_MUTATORS.has(name) &&
    expressionResolvesGlobal({
      expression: receiver,
      name: "Object",
      seenSymbols: new Set(),
      state: input.state,
    });
  const reflectMutator =
    CANONICAL_OWNER_REFLECT_MUTATORS.has(name) &&
    expressionResolvesGlobal({
      expression: receiver,
      name: "Reflect",
      seenSymbols: new Set(),
      state: input.state,
    });
  if (objectMutator || reflectMutator) {
    return { boundArguments: [], boundThis: null, kind: "argument" };
  }
  return IN_PLACE_ARRAY_METHODS.has(name) &&
    canonicalOwnerExpressionIsDefaultLibrary(input.state, input.expression)
    ? { boundArguments: [], boundThis: null, kind: "receiver" }
    : null;
};

const globalBindingElementMutator = (input: {
  readonly property: ts.Identifier;
  readonly seenSymbols: ReadonlySet<ts.Symbol>;
  readonly source: ts.Expression;
  readonly state: CanonicalOwnerAliasState;
}): MutatorOrigin | null => {
  const objectMutator =
    CANONICAL_OWNER_OBJECT_MUTATORS.has(input.property.text) &&
    expressionResolvesGlobal({ ...input, expression: input.source, name: "Object" });
  const reflectMutator =
    CANONICAL_OWNER_REFLECT_MUTATORS.has(input.property.text) &&
    expressionResolvesGlobal({ ...input, expression: input.source, name: "Reflect" });
  return objectMutator || reflectMutator
    ? { boundArguments: [], boundThis: null, kind: "argument" }
    : null;
};

const bindingElementMutator = (input: {
  readonly declaration: ts.BindingElement;
  readonly seenSymbols: ReadonlySet<ts.Symbol>;
  readonly state: CanonicalOwnerAliasState;
}): MutatorOrigin | null => {
  const variable = input.declaration.parent.parent;
  const source = ts.isVariableDeclaration(variable) ? variable.initializer : undefined;
  const property = input.declaration.propertyName ?? input.declaration.name;
  if (source === undefined || !ts.isIdentifier(property)) return null;
  const global = globalBindingElementMutator({ ...input, property, source });
  if (global !== null) return global;
  const sourceType = input.state.checker.getTypeAtLocation(source);
  const member = input.state.checker.getPropertyOfType(sourceType, property.text);
  return IN_PLACE_ARRAY_METHODS.has(property.text) &&
    (member?.declarations ?? []).some((declaration) =>
      input.state.program.isSourceFileDefaultLibrary(declaration.getSourceFile()),
    )
    ? { boundArguments: [], boundThis: null, kind: "receiver" }
    : null;
};

const declaredMutator = (input: {
  readonly declaration: ts.Declaration;
  readonly seenSymbols: ReadonlySet<ts.Symbol>;
  readonly state: CanonicalOwnerAliasState;
}): MutatorOrigin | null => {
  if (ts.isBindingElement(input.declaration)) {
    return bindingElementMutator({ ...input, declaration: input.declaration });
  }
  const initializer = canonicalOwnerDeclarationInitializer(input.declaration);
  return initializer === null ? null : mutatorAtExpression({ ...input, expression: initializer });
};

const boundMutator = (input: {
  readonly call: ts.CallExpression;
  readonly seenSymbols: ReadonlySet<ts.Symbol>;
  readonly state: CanonicalOwnerAliasState;
}): MutatorOrigin | null => {
  if (
    canonicalOwnerMemberName(input.call.expression) !== "bind" ||
    !canonicalOwnerExpressionIsDefaultLibrary(input.state, input.call.expression)
  ) {
    return null;
  }
  const receiver = canonicalOwnerMemberReceiver(input.call.expression);
  const origin = receiver === null ? null : mutatorAtExpression({ ...input, expression: receiver });
  if (origin === null) return null;
  return {
    boundArguments: [...origin.boundArguments, ...input.call.arguments.slice(1)],
    boundThis: input.call.arguments[0] ?? origin.boundThis,
    kind: origin.kind,
  };
};

const mutatorAtExpression = (input: {
  readonly expression: ts.Expression;
  readonly seenSymbols: ReadonlySet<ts.Symbol>;
  readonly state: CanonicalOwnerAliasState;
}): MutatorOrigin | null => {
  const current = unwrapCanonicalOwnerExpression(input.expression);
  const direct = directStandardMutator({ expression: current, state: input.state });
  if (direct !== null) return direct;
  if (ts.isCallExpression(current)) return boundMutator({ ...input, call: current });
  const symbol = canonicalOwnerSymbolAtExpression(input.state.checker, current);
  const resolved = symbol === null ? null : resolveTypeScriptSymbol(input.state.checker, symbol);
  if (resolved === null || input.seenSymbols.has(resolved)) return null;
  const next = new Set([...input.seenSymbols, resolved]);
  return (resolved.declarations ?? []).reduce<MutatorOrigin | null>(
    (origin, declaration) =>
      origin ?? declaredMutator({ declaration, seenSymbols: next, state: input.state }),
    null,
  );
};

const arrayArguments = (expression: ts.Expression | undefined): readonly ts.Expression[] => {
  if (expression === undefined) return [];
  const current = unwrapCanonicalOwnerExpression(expression);
  return ts.isArrayLiteralExpression(current)
    ? current.elements.flatMap((element) =>
        ts.isOmittedExpression(element) || ts.isSpreadElement(element) ? [] : [element],
      )
    : [];
};

const reflectApplyInvocation = (input: {
  readonly call: ts.CallExpression;
  readonly state: CanonicalOwnerAliasState;
}): {
  readonly arguments: readonly ts.Expression[];
  readonly origin: MutatorOrigin;
  readonly thisArg: ts.Expression | null;
} | null => {
  const receiver = canonicalOwnerMemberReceiver(input.call.expression);
  if (
    canonicalOwnerMemberName(input.call.expression) !== "apply" ||
    receiver === null ||
    !canonicalOwnerGlobalIdentifierIs({ identifier: receiver, name: "Reflect", state: input.state })
  ) {
    return null;
  }
  const target = input.call.arguments[0];
  const origin =
    target === undefined
      ? null
      : mutatorAtExpression({ expression: target, seenSymbols: new Set(), state: input.state });
  return origin === null
    ? null
    : {
        arguments: [...origin.boundArguments, ...arrayArguments(input.call.arguments[2])],
        origin,
        thisArg: input.call.arguments[1] ?? origin.boundThis,
      };
};

const forwardedInvocation = (input: {
  readonly call: ts.CallExpression;
  readonly state: CanonicalOwnerAliasState;
}): {
  readonly arguments: readonly ts.Expression[];
  readonly origin: MutatorOrigin;
  readonly thisArg: ts.Expression | null;
} | null => {
  const name = canonicalOwnerMemberName(input.call.expression);
  const receiver = canonicalOwnerMemberReceiver(input.call.expression);
  if ((name !== "call" && name !== "apply") || receiver === null) return null;
  const origin = mutatorAtExpression({
    expression: receiver,
    seenSymbols: new Set(),
    state: input.state,
  });
  if (origin === null) return null;
  const forwarded =
    name === "call" ? input.call.arguments.slice(1) : arrayArguments(input.call.arguments[1]);
  return {
    arguments: [...origin.boundArguments, ...forwarded],
    origin,
    thisArg: input.call.arguments[0] ?? origin.boundThis,
  };
};

const directInvocation = (input: {
  readonly call: ts.CallExpression;
  readonly state: CanonicalOwnerAliasState;
}): {
  readonly arguments: readonly ts.Expression[];
  readonly origin: MutatorOrigin;
  readonly thisArg: ts.Expression | null;
} | null => {
  const origin = mutatorAtExpression({
    expression: input.call.expression,
    seenSymbols: new Set(),
    state: input.state,
  });
  return origin === null
    ? null
    : {
        arguments: [...origin.boundArguments, ...input.call.arguments],
        origin,
        thisArg: origin.boundThis,
      };
};

export const canonicalOwnerNormalizedMutatorCallMutates = (input: {
  readonly call: ts.CallExpression;
  readonly state: CanonicalOwnerAliasState;
}): boolean => {
  const invocation =
    reflectApplyInvocation(input) ?? forwardedInvocation(input) ?? directInvocation(input);
  if (invocation === null) return false;
  const target =
    invocation.origin.kind === "argument" ? invocation.arguments[0] : invocation.thisArg;
  return (
    target !== null &&
    target !== undefined &&
    canonicalOwnerExpressionIsOwner({ expression: target, state: input.state })
  );
};
