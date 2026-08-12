import { resolveBinding, type ScopeLookup } from "../resolved-bindings.ts";
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
  readonly definition: ESTree.ImportSpecifier;
  readonly importedName: string;
  readonly specifier: string;
};

type ArrayBinding = {
  readonly definition: ESTree.VariableDeclarator;
  readonly value: ESTree.ArrayExpression;
};

type ObjectBinding = {
  readonly definition: ESTree.VariableDeclarator;
  readonly value: ESTree.ObjectExpression;
};

export type LocalFiniteValueBindings = {
  readonly arrays: ReadonlyMap<string, ArrayBinding>;
  readonly imports: ReadonlyMap<string, ImportedBinding>;
  readonly objects: ReadonlyMap<string, ObjectBinding>;
};

type PositionInput = {
  readonly bindings: LocalFiniteValueBindings;
  readonly catalog: CanonicalValuesCatalog;
  readonly scopeAt: ScopeLookup;
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

const bindingAt = <Binding extends { readonly definition: ESTree.Node }>(input: {
  readonly bindings: ReadonlyMap<string, Binding>;
  readonly identifier: ESTree.IdentifierReference;
  readonly position: PositionInput;
}): Binding | null => {
  const candidate = input.bindings.get(input.identifier.name);
  if (candidate === undefined) return null;
  const resolved = resolveBinding(input.position.scopeAt(input.identifier), input.identifier.name);
  return resolved?.defs.some((definition) => definition.node === candidate.definition) === true
    ? candidate
    : null;
};

const catalogOwnsImport = (catalog: CanonicalValuesCatalog, imported: ImportedBinding): boolean =>
  catalog.entries.some(
    (declaration) =>
      declaration.binding === imported.importedName ||
      declaration.importRoutes.some((route) => route.exportName === imported.importedName),
  );

const unknownOwnerPosition = (
  input: PositionInput,
  identifier: ESTree.IdentifierReference,
): Extract<LocalFiniteValuePosition, { readonly kind: "unknown-owner-name" }> | null => {
  const shadowedImport = input.bindings.imports.get(identifier.name);
  return input.catalog.entries.some((declaration) => declaration.binding === identifier.name) ||
    (shadowedImport !== undefined && catalogOwnsImport(input.catalog, shadowedImport))
    ? { kind: "unknown-owner-name", name: identifier.name, node: identifier }
    : null;
};

const importName = (specifier: ESTree.ImportSpecifier): string => {
  const imported = specifier.imported;
  return imported.type === "Identifier" ? imported.name : imported.value;
};

const staticBindingEntries = (
  statement: ESTree.Program["body"][number],
): readonly (
  | { readonly kind: "array"; readonly name: string; readonly binding: ArrayBinding }
  | { readonly kind: "object"; readonly name: string; readonly binding: ObjectBinding }
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
      | { readonly kind: "array"; readonly name: string; readonly binding: ArrayBinding }
      | { readonly kind: "object"; readonly name: string; readonly binding: ObjectBinding }
    )[] => {
      if (declaration.id.type !== "Identifier" || declaration.init === null) return [];
      const initializer = unwrapExpression(declaration.init);
      if (initializer.type === "ArrayExpression") {
        return [
          {
            kind: "array",
            name: declaration.id.name,
            binding: { definition: declaration, value: initializer },
          },
        ];
      }
      return initializer.type === "ObjectExpression"
        ? [
            {
              kind: "object",
              name: declaration.id.name,
              binding: { definition: declaration, value: initializer },
            },
          ]
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
    return [
      [
        specifier.local.name,
        { definition: specifier, importedName, specifier: statement.source.value },
      ],
    ] as const;
  });
};

export const localFiniteValueBindings = (program: ESTree.Program): LocalFiniteValueBindings => {
  const staticBindings = program.body.flatMap(staticBindingEntries);
  return {
    arrays: new Map(
      staticBindings.flatMap((binding) =>
        binding.kind === "array" ? [[binding.name, binding.binding] as const] : [],
      ),
    ),
    imports: new Map(program.body.flatMap(importBindingEntries)),
    objects: new Map(
      staticBindings.flatMap((binding) =>
        binding.kind === "object" ? [[binding.name, binding.binding] as const] : [],
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

const arrayPosition = (
  arrayExpression: ESTree.ArrayExpression,
): LocalFiniteValuePosition | null => {
  const canonicalItems = staticArrayValues(arrayExpression);
  return canonicalItems === null
    ? null
    : { kind: "values", node: arrayExpression, values: canonicalItems };
};

export const localFiniteIdentifierPosition = (
  input: PositionInput,
  identifier: ESTree.IdentifierReference,
): LocalFiniteValuePosition | null => {
  const arrayBinding = bindingAt({ bindings: input.bindings.arrays, identifier, position: input });
  if (arrayBinding !== null) return arrayPosition(arrayBinding.value);
  const imported = localFiniteImportPosition(input, identifier);
  if (imported !== null) return imported;
  return unknownOwnerPosition(input, identifier);
};

export const localFiniteValuePosition = (
  input: PositionInput,
  candidate: ESTree.Expression,
): LocalFiniteValuePosition | null => {
  const expression = unwrapExpression(candidate);
  if (expression.type === "ArrayExpression") return arrayPosition(expression);
  return expression.type === "Identifier" ? localFiniteIdentifierPosition(input, expression) : null;
};

const objectPropertyNames = (
  objectExpression: ESTree.ObjectExpression,
): readonly string[] | null => {
  const propertyNames = objectExpression.properties.map((property) => {
    if (property.type !== "Property" || property.computed) return null;
    return propertyKeyName(property.key);
  });
  return propertyNames.every((propertyName) => propertyName !== null) ? propertyNames : null;
};

const identifierObjectKeysPosition = (
  input: PositionInput,
  candidate: { readonly call: ESTree.CallExpression; readonly source: ESTree.IdentifierReference },
): LocalFiniteValuePosition | null => {
  const imported = localFiniteImportPosition(input, candidate.source);
  if (imported !== null) return imported;
  const objectBinding = bindingAt({
    bindings: input.bindings.objects,
    identifier: candidate.source,
    position: input,
  });
  if (objectBinding === null) return unknownOwnerPosition(input, candidate.source);
  const canonicalItems = objectPropertyNames(objectBinding.value);
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
  input: PositionInput,
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
  input: PositionInput,
  argument: ESTree.Expression,
): LocalFiniteValuePosition | null => {
  const expression = unwrapExpression(argument);
  return expression.type === "CallExpression"
    ? objectKeysPosition(input, expression)
    : localFiniteValuePosition(input, expression);
};

const localFiniteImportPosition = (
  input: PositionInput,
  identifier: ESTree.IdentifierReference,
): Extract<LocalFiniteValuePosition, { readonly kind: "import" }> | null => {
  const imported = bindingAt({ bindings: input.bindings.imports, identifier, position: input });
  return imported === null
    ? null
    : {
        importedName: imported.importedName,
        kind: "import",
        name: identifier.name,
        node: identifier,
        specifier: imported.specifier,
      };
};
