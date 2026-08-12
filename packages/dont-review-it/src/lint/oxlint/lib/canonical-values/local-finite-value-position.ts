import {
  calleeMemberName,
  propertyKeyName,
  staticArrayValues,
  unwrapExpression,
} from "./finite-value-syntax.ts";

import type { ESTree } from "@oxlint/plugins";
import type { CanonicalValuesCatalog } from "./catalog.ts";
import type { CanonicalValue } from "./fingerprint.ts";

type ImportedBinding = {
  readonly importedName: string;
  readonly specifier: string;
};

export type LocalFiniteValueBindings = {
  readonly arrays: ReadonlyMap<string, ESTree.ArrayExpression>;
  readonly imports: ReadonlyMap<string, ImportedBinding>;
  readonly objects: ReadonlyMap<string, ESTree.ObjectExpression>;
};

export type LocalFiniteValuePosition =
  | {
      readonly kind: "values";
      readonly node: ESTree.Node;
      readonly values: readonly CanonicalValue[];
    }
  | {
      readonly importedName: string;
      readonly kind: "import";
      readonly name: string;
      readonly node: ESTree.Node;
      readonly specifier: string;
    }
  | { readonly kind: "unknown-owner-name"; readonly name: string; readonly node: ESTree.Node };

const importName = (specifier: ESTree.ImportSpecifier): string => {
  const imported = specifier.imported;
  return imported.type === "Identifier" ? imported.name : imported.value;
};

const staticBindingEntries = (
  statement: ESTree.Program["body"][number],
): readonly (
  | { readonly kind: "array"; readonly name: string; readonly node: ESTree.ArrayExpression }
  | { readonly kind: "object"; readonly name: string; readonly node: ESTree.ObjectExpression }
)[] => {
  const variableStatement =
    statement.type === "VariableDeclaration"
      ? statement
      : statement.type === "ExportNamedDeclaration" &&
          statement.declaration?.type === "VariableDeclaration"
        ? statement.declaration
        : null;
  if (variableStatement === null) return [];
  return variableStatement.declarations.flatMap(
    (
      declaration,
    ): readonly (
      | { readonly kind: "array"; readonly name: string; readonly node: ESTree.ArrayExpression }
      | { readonly kind: "object"; readonly name: string; readonly node: ESTree.ObjectExpression }
    )[] => {
      if (declaration.id.type !== "Identifier" || declaration.init === null) return [];
      const initializer = unwrapExpression(declaration.init);
      if (initializer.type === "ArrayExpression") {
        return [{ kind: "array", name: declaration.id.name, node: initializer }];
      }
      return initializer.type === "ObjectExpression"
        ? [{ kind: "object", name: declaration.id.name, node: initializer }]
        : [];
    },
  );
};

const importBindingEntries = (
  statement: ESTree.Program["body"][number],
): readonly (readonly [string, ImportedBinding])[] => {
  if (statement.type !== "ImportDeclaration") return [];
  return statement.specifiers.flatMap((specifier) => {
    if (specifier.type !== "ImportSpecifier") return [];
    const importedName = importName(specifier);
    return [[specifier.local.name, { importedName, specifier: statement.source.value }]] as const;
  });
};

export const localFiniteValueBindings = (program: ESTree.Program): LocalFiniteValueBindings => {
  const staticBindings = program.body.flatMap(staticBindingEntries);
  return {
    arrays: new Map(
      staticBindings.flatMap((binding) =>
        binding.kind === "array" ? [[binding.name, binding.node] as const] : [],
      ),
    ),
    imports: new Map(program.body.flatMap(importBindingEntries)),
    objects: new Map(
      staticBindings.flatMap((binding) =>
        binding.kind === "object" ? [[binding.name, binding.node] as const] : [],
      ),
    ),
  };
};

export const firstFiniteValueArgument = (
  node: ESTree.CallExpression | ESTree.NewExpression,
): ESTree.Expression | null => {
  const [argument] = node.arguments;
  return argument === undefined || argument.type === "SpreadElement" ? null : argument;
};

const arrayPosition = (array: ESTree.ArrayExpression): LocalFiniteValuePosition | null => {
  const canonicalItems = staticArrayValues(array);
  return canonicalItems === null ? null : { kind: "values", node: array, values: canonicalItems };
};

export const localFiniteIdentifierPosition = (
  input: {
    readonly bindings: LocalFiniteValueBindings;
    readonly catalog: CanonicalValuesCatalog;
  },
  identifier: ESTree.IdentifierReference,
): LocalFiniteValuePosition | null => {
  const array = input.bindings.arrays.get(identifier.name);
  if (array !== undefined) return arrayPosition(array);
  const imported = input.bindings.imports.get(identifier.name);
  if (imported !== undefined) {
    return { kind: "import", name: identifier.name, node: identifier, ...imported };
  }
  return input.catalog.entries.some((entry) => entry.binding === identifier.name)
    ? { kind: "unknown-owner-name", name: identifier.name, node: identifier }
    : null;
};

export const localFiniteValuePosition = (
  input: {
    readonly bindings: LocalFiniteValueBindings;
    readonly catalog: CanonicalValuesCatalog;
  },
  candidate: ESTree.Expression,
): LocalFiniteValuePosition | null => {
  const expression = unwrapExpression(candidate);
  if (expression.type === "ArrayExpression") return arrayPosition(expression);
  return expression.type === "Identifier" ? localFiniteIdentifierPosition(input, expression) : null;
};

const objectPropertyNames = (object: ESTree.ObjectExpression): readonly string[] | null => {
  const propertyNames = object.properties.map((property) => {
    if (property.type !== "Property" || property.computed) return null;
    return propertyKeyName(property.key);
  });
  return propertyNames.every((propertyName) => propertyName !== null) ? propertyNames : null;
};

const identifierObjectKeysPosition = (
  input: {
    readonly bindings: LocalFiniteValueBindings;
    readonly catalog: CanonicalValuesCatalog;
  },
  candidate: { readonly call: ESTree.CallExpression; readonly source: ESTree.IdentifierReference },
): LocalFiniteValuePosition | null => {
  const imported = input.bindings.imports.get(candidate.source.name);
  if (imported !== undefined) {
    return { kind: "import", name: candidate.source.name, node: candidate.source, ...imported };
  }
  const object = input.bindings.objects.get(candidate.source.name);
  if (object === undefined) return null;
  const canonicalItems = objectPropertyNames(object);
  return canonicalItems === null
    ? null
    : { kind: "values", node: candidate.call, values: canonicalItems };
};

const objectKeysSource = (call: ESTree.CallExpression): ESTree.Expression | null => {
  if (calleeMemberName(call.callee) !== "keys") return null;
  const callee = unwrapExpression(call.callee) as ESTree.MemberExpression;
  const receiver = unwrapExpression(callee.object);
  if (receiver.type !== "Identifier" || receiver.name !== "Object") return null;
  const argument = firstFiniteValueArgument(call);
  return argument === null ? null : unwrapExpression(argument);
};

const objectKeysPosition = (
  input: {
    readonly bindings: LocalFiniteValueBindings;
    readonly catalog: CanonicalValuesCatalog;
  },
  call: ESTree.CallExpression,
): LocalFiniteValuePosition | null => {
  const source = objectKeysSource(call);
  if (source === null) return null;
  if (source.type === "Identifier") return identifierObjectKeysPosition(input, { call, source });
  if (source.type !== "ObjectExpression") return null;
  const canonicalItems = objectPropertyNames(source);
  return canonicalItems === null ? null : { kind: "values", node: call, values: canonicalItems };
};

export const localFiniteSchemaPosition = (
  input: {
    readonly bindings: LocalFiniteValueBindings;
    readonly catalog: CanonicalValuesCatalog;
  },
  argument: ESTree.Expression,
): LocalFiniteValuePosition | null => {
  const expression = unwrapExpression(argument);
  return expression.type === "CallExpression"
    ? objectKeysPosition(input, expression)
    : localFiniteValuePosition(input, expression);
};
