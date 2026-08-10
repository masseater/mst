import { type AstNodeFields } from "@mst/utils";
import { isPlainObject } from "es-toolkit";

const objectPatternBindingsIn = (value: unknown): readonly string[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((property) => {
    if (!isPlainObject(property)) return [];
    const fields: AstNodeFields = property;
    return fields.type === "RestElement"
      ? namesBoundBy(fields.argument)
      : namesBoundBy(fields.value);
  });
};

const namesBoundBy = (pattern: unknown): readonly string[] => {
  if (!isPlainObject(pattern)) return [];
  const fields: AstNodeFields = pattern;
  if (fields.type === "Identifier" && typeof fields.name === "string") return [fields.name];
  if (fields.type === "TSParameterProperty") return namesBoundBy(fields.parameter);
  if (fields.type === "AssignmentPattern") return namesBoundBy(fields.left);
  if (fields.type === "RestElement") return namesBoundBy(fields.argument);
  if (fields.type === "ArrayPattern" && Array.isArray(fields.elements)) {
    return fields.elements.flatMap(namesBoundBy);
  }
  return fields.type === "ObjectPattern" ? objectPatternBindingsIn(fields.properties) : [];
};

const isFunctionNode = (fields: AstNodeFields): boolean =>
  fields.type === "FunctionDeclaration" ||
  fields.type === "FunctionExpression" ||
  fields.type === "ArrowFunctionExpression";

const isClassNode = (fields: AstNodeFields): boolean =>
  fields.type === "ClassDeclaration" || fields.type === "ClassExpression";

const isIsolatedVarScope = (fields: AstNodeFields): boolean =>
  fields.type === "StaticBlock" || fields.type === "TSModuleBlock";

const functionBindingsOf = (node: AstNodeFields): readonly string[] => {
  const functionName = node.type === "ArrowFunctionExpression" ? [] : namesBoundBy(node.id);
  const parameters = Array.isArray(node.params) ? node.params.flatMap(namesBoundBy) : [];
  return [...functionName, ...parameters];
};

const namespaceNamesBoundBy = (value: unknown): readonly string[] => {
  if (!isPlainObject(value)) return [];
  const fields: AstNodeFields = value;
  return fields.type === "TSQualifiedName"
    ? namespaceNamesBoundBy(fields.left)
    : namesBoundBy(fields);
};

const typescriptValueBindingsOf = (fields: AstNodeFields): readonly string[] => {
  if (fields.type === "TSEnumDeclaration") return namesBoundBy(fields.id);
  if (fields.type === "TSModuleDeclaration") return namespaceNamesBoundBy(fields.id);
  return fields.type === "TSImportEqualsDeclaration" && fields.importKind === "value"
    ? namesBoundBy(fields.id)
    : [];
};

const declarationBindingsIn = (value: unknown): readonly string[] => {
  if (!isPlainObject(value)) return [];
  const fields: AstNodeFields = value;
  if (fields.type === "ExportNamedDeclaration" || fields.type === "ExportDefaultDeclaration") {
    return declarationBindingsIn(fields.declaration);
  }
  if (fields.type === "VariableDeclaration" && Array.isArray(fields.declarations)) {
    return fields.declarations.flatMap((declaration) =>
      isPlainObject(declaration) ? namesBoundBy(declaration.id) : [],
    );
  }
  if (fields.type === "FunctionDeclaration" || fields.type === "ClassDeclaration") {
    return namesBoundBy(fields.id);
  }
  return typescriptValueBindingsOf(fields);
};

const statementBindingsIn = (value: unknown): readonly string[] =>
  Array.isArray(value) ? value.flatMap(declarationBindingsIn) : [];

const varBindingsIn = (value: unknown): readonly string[] => {
  if (Array.isArray(value)) return value.flatMap(varBindingsIn);
  if (!isPlainObject(value)) return [];
  const fields: AstNodeFields = value;
  if (isFunctionNode(fields) || isClassNode(fields) || isIsolatedVarScope(fields)) return [];
  if (fields.type === "VariableDeclaration" && fields.kind === "var") {
    return declarationBindingsIn(fields);
  }
  return Object.entries(fields).flatMap(([, nested]) => varBindingsIn(nested));
};

const switchBindingsIn = (fields: AstNodeFields): readonly string[] =>
  Array.isArray(fields.cases)
    ? fields.cases.flatMap((switchCase) =>
        isPlainObject(switchCase) ? statementBindingsIn(switchCase.consequent) : [],
      )
    : [];

const statementScopeBindings = (fields: AstNodeFields): readonly string[] =>
  statementBindingsIn(fields.body);

const isolatedVarScopeBindings = (fields: AstNodeFields): readonly string[] => [
  ...statementBindingsIn(fields.body),
  ...varBindingsIn(fields.body),
];

const catchScopeBindings = (fields: AstNodeFields): readonly string[] => namesBoundBy(fields.param);

const initialScopeBindings = (fields: AstNodeFields): readonly string[] =>
  declarationBindingsIn(fields.init);

const leftScopeBindings = (fields: AstNodeFields): readonly string[] =>
  declarationBindingsIn(fields.left);

const classScopeBindings = (fields: AstNodeFields): readonly string[] => namesBoundBy(fields.id);

const SCOPE_BINDINGS_BY_TYPE: Readonly<
  Record<string, (fields: AstNodeFields) => readonly string[]>
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

const scopeBindingsOf = (fields: AstNodeFields): readonly string[] =>
  isFunctionNode(fields)
    ? [...functionBindingsOf(fields), ...varBindingsIn(fields.body)]
    : (SCOPE_BINDINGS_BY_TYPE[typeof fields.type === "string" ? fields.type : ""]?.(fields) ?? []);

export const scopedCallExpressionsIn = (
  value: unknown,
  inheritedBindings: ReadonlySet<string> = new Set(),
): readonly Readonly<{
  call: AstNodeFields;
  localBindings: ReadonlySet<string>;
}>[] => {
  if (Array.isArray(value))
    return value.flatMap((nested) => scopedCallExpressionsIn(nested, inheritedBindings));
  if (!isPlainObject(value)) return [];
  const fields: AstNodeFields = value;
  const localBindings = new Set([...inheritedBindings, ...scopeBindingsOf(fields)]);
  const nested = Object.entries(fields).flatMap(([, child]) =>
    scopedCallExpressionsIn(child, localBindings),
  );
  return fields.type === "CallExpression" ? [{ call: fields, localBindings }, ...nested] : nested;
};
