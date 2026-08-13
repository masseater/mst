import { ancestorsOf } from "../ast-node.ts";
import { resolveBinding, type BindingResolution } from "../resolved-bindings.ts";
import { unwrapSubject } from "../spec-syntax/subject-expressions.ts";
import { WIDENED_TYPE_NODES } from "../widened-type-nodes.ts";

import type { Definition, ESTree } from "@oxlint/plugins";
import type { ImportedName } from "../spec-syntax/module-declarations.ts";

export type JudgedReceiver =
  | { readonly kind: "named"; readonly type: string }
  | { readonly kind: "collapsed" };

const COLLAPSED_RECEIVER: JudgedReceiver = { kind: "collapsed" };

const IMPORTED_DEFAULT_NAME = "default";

const IMPORTED_NAMESPACE_NAME = "*";

const firstJudged = (judged: readonly (JudgedReceiver | null)[]): JudgedReceiver | null =>
  judged.find((one) => one !== null) ?? null;

const constraintDeclaredFor = (at: ESTree.Node, spelled: string): ESTree.TSType | null => {
  const declared = ancestorsOf(at).flatMap((ancestor) =>
    "typeParameters" in ancestor ? (ancestor.typeParameters?.params ?? []) : [],
  );
  return declared.findLast((parameter) => parameter.name.name === spelled)?.constraint ?? null;
};

const judgedTypeOf = (asked: {
  readonly node: ESTree.TSType;
  readonly at: ESTree.Node;
  readonly seenTypeNames: ReadonlySet<string>;
}): JudgedReceiver | null => {
  const { node, at, seenTypeNames } = asked;
  if (WIDENED_TYPE_NODES.has(node.type)) return COLLAPSED_RECEIVER;

  if (node.type === "TSUnionType" || node.type === "TSIntersectionType") {
    return firstJudged(node.types.map((member) => judgedTypeOf({ ...asked, node: member })));
  }
  if (node.type !== "TSTypeReference" || node.typeName.type !== "Identifier") return null;

  const named = node.typeName.name;
  if (seenTypeNames.has(named)) return null;

  const constraint = constraintDeclaredFor(at, named);
  if (constraint === null) return { kind: "named", type: named };
  return judgedTypeOf({
    node: constraint,
    at,
    seenTypeNames: new Set([...seenTypeNames, named]),
  });
};

const assertedTypeOf = (node: ESTree.Expression): ESTree.TSType | null => {
  switch (node.type) {
    case "TSAsExpression":
    case "TSSatisfiesExpression":
    case "TSTypeAssertion":
      return node.typeAnnotation;
    default:
      return null;
  }
};

const judgedAssertionOf = (node: ESTree.Expression): JudgedReceiver | null => {
  const asserted = assertedTypeOf(node);
  if (asserted === null) return null;
  return judgedTypeOf({ node: asserted, at: node, seenTypeNames: new Set() });
};

const judgedConstructionOf = (node: ESTree.NewExpression): JudgedReceiver | null => {
  const called = unwrapSubject(node.callee);
  return called.type === "Identifier" ? { kind: "named", type: called.name } : null;
};

const judgedDefinitionOf = (asked: {
  readonly definition: Definition;
  readonly at: ESTree.IdentifierReference;
  readonly reading: BindingResolution;
}): JudgedReceiver | null => {
  const { definition, at, reading } = asked;
  const annotation = definition.name.typeAnnotation;
  const judgedAnnotation =
    annotation === null || annotation === undefined
      ? null
      : judgedTypeOf({ node: annotation.typeAnnotation, at, seenTypeNames: new Set() });
  if (judgedAnnotation !== null) return judgedAnnotation;

  const declared = definition.node;
  if (declared.type === "ClassDeclaration") return { kind: "named", type: at.name };
  if (declared.type !== "VariableDeclarator" || declared.init === null) return null;
  return judgedReceiverOf(declared.init, reading);
};

const judgedBindingOf = (
  node: ESTree.IdentifierReference,
  reading: BindingResolution,
): JudgedReceiver | null => {
  const binding = resolveBinding(reading.scopeAt(node), node.name);
  if (binding === null || reading.seenBindings.has(binding)) return null;

  const nested: BindingResolution = {
    scopeAt: reading.scopeAt,
    seenBindings: new Set([...reading.seenBindings, binding]),
  };
  return firstJudged(
    binding.defs.map((definition) => judgedDefinitionOf({ definition, at: node, reading: nested })),
  );
};

const judgedWrittenOf = (
  written: ESTree.Expression,
  reading: BindingResolution,
): JudgedReceiver | null => {
  if (written.type === "NewExpression") return judgedConstructionOf(written);
  if (written.type === "Identifier") return judgedBindingOf(written, reading);
  return null;
};

export const judgedReceiverOf = (
  node: ESTree.Expression,
  reading: BindingResolution,
): JudgedReceiver | null =>
  judgedWrittenOf(unwrapSubject(node), reading) ?? judgedAssertionOf(node);

const declaringStatementOf = (statement: ESTree.Program["body"][number]): ESTree.Node | null =>
  statement.type === "ExportNamedDeclaration" || statement.type === "ExportDefaultDeclaration"
    ? statement.declaration
    : statement;

const declaredNamesOf = (statement: ESTree.Node): readonly string[] => {
  if (
    statement.type === "ClassDeclaration" ||
    statement.type === "TSInterfaceDeclaration" ||
    statement.type === "TSTypeAliasDeclaration"
  ) {
    return statement.id === null ? [] : [statement.id.name];
  }
  if (statement.type !== "VariableDeclaration") return [];

  return statement.declarations.flatMap((declarator) =>
    declarator.id.type === "Identifier" && declarator.init?.type === "ClassExpression"
      ? [declarator.id.name]
      : [],
  );
};

export const declaredTypeNamesIn = (writtenBody: ESTree.Program["body"]): ReadonlySet<string> =>
  new Set(
    writtenBody
      .map(declaringStatementOf)
      .flatMap((statement) => (statement === null ? [] : declaredNamesOf(statement))),
  );

const importedNameOf = (specifier: ESTree.ImportDeclarationSpecifier): string => {
  if (specifier.type === "ImportDefaultSpecifier") return IMPORTED_DEFAULT_NAME;
  if (specifier.type === "ImportNamespaceSpecifier") return IMPORTED_NAMESPACE_NAME;
  const { imported } = specifier;
  return imported.type === "Identifier" ? imported.name : imported.value;
};

export const importedNamesIn = (
  writtenBody: ESTree.Program["body"],
): ReadonlyMap<string, ImportedName> =>
  new Map(
    writtenBody
      .filter((statement) => statement.type === "ImportDeclaration")
      .flatMap((statement) =>
        statement.specifiers.map((specifier): readonly [string, ImportedName] => [
          specifier.local.name,
          { specifier: statement.source.value, exported: importedNameOf(specifier) },
        ]),
      ),
  );
