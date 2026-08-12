import { type UnknownFields } from "@mst/lint-rule-authoring";
import { isPlainObject } from "es-toolkit";
import { type CallExpression } from "oxc-parser";

const objectPatternBindingsIn = (properties: readonly UnknownFields[]): readonly string[] =>
  properties.flatMap((fields) => {
    return fields.type === "RestElement"
      ? namesBoundBy(fields.argument)
      : namesBoundBy(fields.value);
  });

const namesBoundBy = (pattern: unknown): readonly string[] => {
  if (!isPlainObject(pattern)) return [];
  const fields: UnknownFields = pattern;
  if (fields.type === "Identifier") return [fields.name as string];
  if (fields.type === "TSParameterProperty") return namesBoundBy(fields.parameter);
  if (fields.type === "AssignmentPattern") return namesBoundBy(fields.left);
  if (fields.type === "RestElement") return namesBoundBy(fields.argument);
  if (fields.type === "ArrayPattern") {
    return (fields.elements as readonly unknown[]).flatMap(namesBoundBy);
  }
  return fields.type === "ObjectPattern"
    ? objectPatternBindingsIn(fields.properties as readonly UnknownFields[])
    : [];
};

const isFunctionNode = (fields: UnknownFields): boolean =>
  fields.type === "FunctionDeclaration" ||
  fields.type === "FunctionExpression" ||
  fields.type === "ArrowFunctionExpression";

const isClassNode = (fields: UnknownFields): boolean =>
  fields.type === "ClassDeclaration" || fields.type === "ClassExpression";

const isIsolatedVarScope = (fields: UnknownFields): boolean =>
  fields.type === "StaticBlock" || fields.type === "TSModuleBlock";

const functionBindingsOf = (node: UnknownFields): readonly string[] => {
  const functionName = node.type === "ArrowFunctionExpression" ? [] : namesBoundBy(node.id);
  const parameters = (node.params as readonly unknown[]).flatMap(namesBoundBy);
  return [...functionName, ...parameters];
};

const namespaceNamesBoundBy = (fields: UnknownFields): readonly string[] => {
  return fields.type === "TSQualifiedName"
    ? namespaceNamesBoundBy(fields.left as UnknownFields)
    : namesBoundBy(fields);
};

const typescriptValueBindingsOf = (fields: UnknownFields): readonly string[] => {
  if (fields.type === "TSEnumDeclaration") return namesBoundBy(fields.id);
  if (fields.type === "TSModuleDeclaration") {
    return namespaceNamesBoundBy(fields.id as UnknownFields);
  }
  return fields.type === "TSImportEqualsDeclaration" && fields.importKind === "value"
    ? namesBoundBy(fields.id)
    : [];
};

const declarationBindingsIn = (value: unknown): readonly string[] => {
  if (!isPlainObject(value)) return [];
  const fields: UnknownFields = value;
  if (fields.type === "ExportNamedDeclaration" || fields.type === "ExportDefaultDeclaration") {
    return declarationBindingsIn(fields.declaration);
  }
  if (fields.type === "VariableDeclaration") {
    return (fields.declarations as readonly UnknownFields[]).flatMap((declaration) =>
      namesBoundBy(declaration.id),
    );
  }
  if (fields.type === "FunctionDeclaration" || fields.type === "ClassDeclaration") {
    return namesBoundBy(fields.id);
  }
  return typescriptValueBindingsOf(fields);
};

const statementBindingsIn = (statements: readonly unknown[]): readonly string[] =>
  statements.flatMap(declarationBindingsIn);

const varBindingsIn = (value: unknown): readonly string[] => {
  if (Array.isArray(value)) return value.flatMap(varBindingsIn);
  if (!isPlainObject(value)) return [];
  const fields: UnknownFields = value;
  if (isFunctionNode(fields) || isClassNode(fields) || isIsolatedVarScope(fields)) return [];
  if (fields.type === "VariableDeclaration" && fields.kind === "var") {
    return declarationBindingsIn(fields);
  }
  return Object.entries(fields).flatMap(([, nested]) => varBindingsIn(nested));
};

const switchBindingsIn = (fields: UnknownFields): readonly string[] =>
  (fields.cases as readonly UnknownFields[]).flatMap((switchCase) =>
    statementBindingsIn(switchCase.consequent as readonly unknown[]),
  );

const statementScopeBindings = (fields: UnknownFields): readonly string[] =>
  statementBindingsIn(fields.body as readonly unknown[]);

const isolatedVarScopeBindings = (fields: UnknownFields): readonly string[] => [
  ...statementBindingsIn(fields.body as readonly unknown[]),
  ...varBindingsIn(fields.body),
];

const catchScopeBindings = (fields: UnknownFields): readonly string[] => namesBoundBy(fields.param);

const initialScopeBindings = (fields: UnknownFields): readonly string[] =>
  declarationBindingsIn(fields.init);

const leftScopeBindings = (fields: UnknownFields): readonly string[] =>
  declarationBindingsIn(fields.left);

const classScopeBindings = (fields: UnknownFields): readonly string[] => namesBoundBy(fields.id);

const SCOPE_BINDINGS_BY_TYPE: Readonly<
  Record<string, (fields: UnknownFields) => readonly string[]>
> = {
  BlockStatement: statementScopeBindings,
  CatchClause: catchScopeBindings,
  ClassDeclaration: classScopeBindings,
  ClassExpression: classScopeBindings,
  ForInStatement: leftScopeBindings,
  ForOfStatement: leftScopeBindings,
  ForStatement: initialScopeBindings,
  Program: statementScopeBindings,
  StaticBlock: isolatedVarScopeBindings,
  SwitchStatement: switchBindingsIn,
  TSModuleBlock: isolatedVarScopeBindings,
};

const scopeBindingsOf = (fields: UnknownFields): readonly string[] =>
  isFunctionNode(fields)
    ? [...functionBindingsOf(fields), ...varBindingsIn(fields.body)]
    : (SCOPE_BINDINGS_BY_TYPE[fields.type as string]?.(fields) ?? []);

export const scopedCallExpressionsIn = (
  value: unknown,
  inheritedBindings: ReadonlySet<string> = new Set(),
): readonly Readonly<{
  call: CallExpression;
  localBindings: ReadonlySet<string>;
}>[] => {
  if (Array.isArray(value))
    return value.flatMap((nested) => scopedCallExpressionsIn(nested, inheritedBindings));
  if (!isPlainObject(value)) return [];
  const fields: UnknownFields = value;
  const localBindings = new Set([...inheritedBindings, ...scopeBindingsOf(fields)]);
  const nested = Object.entries(fields).flatMap(([, child]) =>
    scopedCallExpressionsIn(child, localBindings),
  );
  return fields.type === "CallExpression"
    ? [{ call: fields as UnknownFields & CallExpression, localBindings }, ...nested]
    : nested;
};
