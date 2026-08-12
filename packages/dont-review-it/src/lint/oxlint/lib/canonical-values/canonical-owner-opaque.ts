import * as ts from "typescript-6";

import { IN_PLACE_ARRAY_METHODS } from "../array-mutation-methods.ts";
import { canonicalOwnerFunctionInvocations } from "./canonical-owner-call.ts";
import { canonicalOwnerExpressionIsOwner } from "./canonical-owner-expression.ts";
import {
  canonicalOwnerExpressionIsDefaultLibrary,
  canonicalOwnerExpressionIsStableDefaultLibrary,
  canonicalOwnerGlobalIdentifierIs,
} from "./canonical-owner-standard.ts";
import {
  canonicalOwnerMemberName,
  canonicalOwnerMemberReceiver,
  unwrapCanonicalOwnerExpression,
  type CanonicalOwnerAliasState,
} from "./canonical-owner-state.ts";

const ownerNames = (state: CanonicalOwnerAliasState): ReadonlySet<string> =>
  new Set([...state.aliases].map((symbol) => symbol.getName()));

const evalMemberMutates = (names: ReadonlySet<string>, expression: ts.Expression): boolean => {
  const receiver = canonicalOwnerMemberReceiver(expression);
  const current = receiver === null ? null : unwrapCanonicalOwnerExpression(receiver);
  return (
    current !== null &&
    ts.isIdentifier(current) &&
    names.has(current.text) &&
    IN_PLACE_ARRAY_METHODS.has(canonicalOwnerMemberName(expression) ?? "")
  );
};

const evalNodeMutates = (names: ReadonlySet<string>, node: ts.Node): boolean => {
  if (ts.isCallExpression(node) && evalMemberMutates(names, node.expression)) return true;
  if (
    ts.isBinaryExpression(node) &&
    node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
    node.operatorToken.kind <= ts.SyntaxKind.LastAssignment
  ) {
    return evalMemberMutates(names, node.left);
  }
  if (ts.isDeleteExpression(node)) return evalMemberMutates(names, node.expression);
  return node.getChildren().some((child) => evalNodeMutates(names, child));
};

const directEvalMutates = (input: {
  readonly call: ts.CallExpression;
  readonly state: CanonicalOwnerAliasState;
}): boolean => {
  const callee = unwrapCanonicalOwnerExpression(input.call.expression);
  const source = input.call.arguments[0];
  if (
    source === undefined ||
    !ts.isStringLiteralLike(source) ||
    !canonicalOwnerGlobalIdentifierIs({ identifier: callee, name: "eval", state: input.state })
  ) {
    return false;
  }
  const parsed = ts.createSourceFile(
    "canonical-owner-eval.ts",
    source.text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  return evalNodeMutates(ownerNames(input.state), parsed);
};

const functionConstructor = (input: {
  readonly expression: ts.Expression;
  readonly state: CanonicalOwnerAliasState;
}): boolean => {
  const current = unwrapCanonicalOwnerExpression(input.expression);
  const constructor =
    ts.isCallExpression(current) || ts.isNewExpression(current)
      ? unwrapCanonicalOwnerExpression(current.expression)
      : null;
  return (
    constructor !== null &&
    canonicalOwnerGlobalIdentifierIs({
      identifier: constructor,
      name: "Function",
      state: input.state,
    })
  );
};

const functionConstructorReceivesOwner = (input: {
  readonly call: ts.CallExpression;
  readonly state: CanonicalOwnerAliasState;
}): boolean =>
  functionConstructor({ expression: input.call.expression, state: input.state }) &&
  input.call.arguments.some((argument) =>
    canonicalOwnerExpressionIsOwner({ expression: argument, state: input.state }),
  );

const typePropertiesAreReadonly = (checker: ts.TypeChecker, type: ts.Type): boolean => {
  const properties = checker.getPropertiesOfType(type);
  return (
    properties.length > 0 &&
    properties.every(
      (property) =>
        property.declarations?.some(
          (declaration) =>
            (ts.getCombinedModifierFlags(declaration) & ts.ModifierFlags.Readonly) !== 0,
        ) === true,
    )
  );
};

const typeIsReadonly = (checker: ts.TypeChecker, type: ts.Type): boolean => {
  if ((type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) !== 0) return false;
  if (type.isUnion()) return type.types.every((part) => typeIsReadonly(checker, part));
  if (checker.isTupleType(type)) return (type as ts.TupleTypeReference).target.readonly;
  const numericIndex = checker.getIndexInfoOfType(type, ts.IndexKind.Number);
  if (numericIndex !== undefined) return numericIndex.isReadonly;
  return typePropertiesAreReadonly(checker, type);
};

const declarationHasBody = (declaration: ts.Declaration): boolean =>
  ts.isFunctionLike(declaration) && "body" in declaration && declaration.body !== undefined;

const signatureIsOpaque = (signature: ts.Signature): boolean =>
  !declarationHasBody(signature.getDeclaration());

const typeIsCanonicalPrimitive = (type: ts.Type): boolean =>
  (type.flags &
    (ts.TypeFlags.StringLiteral |
      ts.TypeFlags.NumberLiteral |
      ts.TypeFlags.BooleanLiteral |
      ts.TypeFlags.Null)) !==
  0;

const expressionIsPrimitiveArray = (
  state: CanonicalOwnerAliasState,
  expression: ts.Expression,
): boolean => {
  const type = state.checker.getTypeAtLocation(expression);
  const element = state.checker.getIndexTypeOfType(type, ts.IndexKind.Number);
  if (element === undefined) return false;
  const members = element.isUnion() ? element.types : [element];
  return members.length > 0 && members.every(typeIsCanonicalPrimitive);
};

const standardMemberCall = (input: {
  readonly call: ts.CallExpression;
  readonly globalName: string;
  readonly names: ReadonlySet<string>;
  readonly state: CanonicalOwnerAliasState;
}): boolean => {
  const receiver = canonicalOwnerMemberReceiver(input.call.expression);
  const name = canonicalOwnerMemberName(input.call.expression);
  return (
    receiver !== null &&
    name !== null &&
    input.names.has(name) &&
    canonicalOwnerGlobalIdentifierIs({
      identifier: receiver,
      name: input.globalName,
      state: input.state,
    }) &&
    canonicalOwnerExpressionIsStableDefaultLibrary(input.state, input.call.expression)
  );
};

const PURE_OBJECT_READS: ReadonlySet<string> = new Set([
  "entries",
  "getOwnPropertyNames",
  "keys",
  "values",
]);

const pureStandardOwnerArrayCall = (input: {
  readonly call: ts.CallExpression;
  readonly state: CanonicalOwnerAliasState;
}): boolean => {
  const owner = input.call.arguments[0];
  if (
    owner === undefined ||
    !canonicalOwnerExpressionIsOwner({ expression: owner, state: input.state }) ||
    !expressionIsPrimitiveArray(input.state, owner)
  ) {
    return false;
  }
  return [
    standardMemberCall({
      ...input,
      globalName: "Object",
      names: PURE_OBJECT_READS,
    }),
    standardMemberCall({ ...input, globalName: "Reflect", names: new Set(["ownKeys"]) }),
    standardMemberCall({ ...input, globalName: "Array", names: new Set(["from", "isArray"]) }),
    input.call.arguments.length === 1 &&
      standardMemberCall({ ...input, globalName: "JSON", names: new Set(["stringify"]) }),
  ].some(Boolean);
};

const pureFunctionBinding = (input: {
  readonly call: ts.CallExpression;
  readonly state: CanonicalOwnerAliasState;
}): boolean =>
  canonicalOwnerMemberName(input.call.expression) === "bind" &&
  canonicalOwnerExpressionIsStableDefaultLibrary(input.state, input.call.expression);

const callReceivesOwner = (input: {
  readonly call: ts.CallExpression;
  readonly state: CanonicalOwnerAliasState;
}): boolean => {
  const receiver = canonicalOwnerMemberReceiver(input.call.expression);
  return (
    (receiver !== null &&
      canonicalOwnerExpressionIsOwner({ expression: receiver, state: input.state })) ||
    input.call.arguments.some((argument) =>
      canonicalOwnerExpressionIsOwner({ expression: argument, state: input.state }),
    )
  );
};

const unstableStandardCallReceivesOwner = (input: {
  readonly call: ts.CallExpression;
  readonly state: CanonicalOwnerAliasState;
}): boolean =>
  canonicalOwnerExpressionIsDefaultLibrary(input.state, input.call.expression) &&
  !canonicalOwnerExpressionIsStableDefaultLibrary(input.state, input.call.expression) &&
  callReceivesOwner(input);

const OWNER_PRESERVING_DEFAULT_CONSTRUCTORS: ReadonlySet<string> = new Set(["Object", "Proxy"]);

const ownerPreservingDefaultConstruction = (input: {
  readonly expression: ts.NewExpression;
  readonly state: CanonicalOwnerAliasState;
}): boolean => {
  const constructor = unwrapCanonicalOwnerExpression(input.expression.expression);
  const name = ts.isIdentifier(constructor)
    ? constructor.text
    : canonicalOwnerMemberName(constructor);
  return (
    name !== null &&
    OWNER_PRESERVING_DEFAULT_CONSTRUCTORS.has(name) &&
    (input.expression.arguments ?? []).some((argument) =>
      canonicalOwnerExpressionIsOwner({ expression: argument, state: input.state }),
    )
  );
};

const parameterAcceptsMutation = (input: {
  readonly call: ts.CallLikeExpression;
  readonly index: number;
  readonly signature: ts.Signature;
  readonly state: CanonicalOwnerAliasState;
}): boolean => {
  const parameter = input.signature.parameters[input.index];
  if (parameter === undefined) return true;
  const type = input.state.checker.getTypeOfSymbolAtLocation(parameter, input.call);
  return !typeIsReadonly(input.state.checker, type);
};

const opaqueCallReceivesOwner = (input: {
  readonly call: ts.CallExpression;
  readonly state: CanonicalOwnerAliasState;
}): boolean => {
  if (unstableStandardCallReceivesOwner(input)) return true;
  if (
    pureStandardOwnerArrayCall(input) ||
    pureFunctionBinding(input) ||
    canonicalOwnerFunctionInvocations({
      call: input.call,
      checker: input.state.checker,
      program: input.state.program,
    }).length > 0
  ) {
    return false;
  }
  const signature = input.state.checker.getResolvedSignature(input.call);
  return (
    signature !== undefined &&
    signatureIsOpaque(signature) &&
    input.call.arguments.some(
      (argument, index) =>
        canonicalOwnerExpressionIsOwner({ expression: argument, state: input.state }) &&
        parameterAcceptsMutation({ ...input, index, signature }),
    )
  );
};

export const canonicalOwnerOpaqueCallMutates = (input: {
  readonly call: ts.CallExpression;
  readonly state: CanonicalOwnerAliasState;
}): boolean =>
  directEvalMutates(input) ||
  functionConstructorReceivesOwner(input) ||
  opaqueCallReceivesOwner(input);

export const canonicalOwnerOpaqueConstructionMutates = (input: {
  readonly expression: ts.NewExpression;
  readonly state: CanonicalOwnerAliasState;
}): boolean => {
  const arguments_ = input.expression.arguments ?? [];
  if (canonicalOwnerExpressionIsDefaultLibrary(input.state, input.expression.expression)) {
    return (
      ownerPreservingDefaultConstruction(input) ||
      (!canonicalOwnerExpressionIsStableDefaultLibrary(input.state, input.expression.expression) &&
        arguments_.some((argument) =>
          canonicalOwnerExpressionIsOwner({ expression: argument, state: input.state }),
        ))
    );
  }
  const signature = input.state.checker.getResolvedSignature(input.expression);
  return (
    signature !== undefined &&
    signatureIsOpaque(signature) &&
    arguments_.some(
      (argument, index) =>
        canonicalOwnerExpressionIsOwner({ expression: argument, state: input.state }) &&
        parameterAcceptsMutation({ call: input.expression, index, signature, state: input.state }),
    )
  );
};
