import * as ts from "typescript-6";

type ImportedBinding = {
  readonly imported: string | null;
  readonly source: string;
};

const moduleSource = (declaration: ts.ImportDeclaration): string | null =>
  ts.isStringLiteralLike(declaration.moduleSpecifier) ? declaration.moduleSpecifier.text : null;

const namedImportBinding = (
  declaration: ts.ImportDeclaration,
  localName: string,
): ImportedBinding | null => {
  const bindings = declaration.importClause?.namedBindings;
  if (bindings === undefined || !ts.isNamedImports(bindings)) return null;
  const element = bindings.elements.find((candidate) => candidate.name.text === localName);
  const source = moduleSource(declaration);
  return element === undefined || source === null
    ? null
    : { imported: element.propertyName?.text ?? element.name.text, source };
};

const namespaceImportBinding = (
  declaration: ts.ImportDeclaration,
  localName: string,
): ImportedBinding | null => {
  const clause = declaration.importClause;
  const source = moduleSource(declaration);
  if (clause === undefined || source === null) return null;
  const namespace =
    clause.namedBindings !== undefined && ts.isNamespaceImport(clause.namedBindings)
      ? clause.namedBindings.name.text === localName
      : clause.name?.text === localName;
  return namespace ? { imported: null, source } : null;
};

const importedBinding = (sourceFile: ts.SourceFile, localName: string): ImportedBinding | null => {
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    const binding =
      namedImportBinding(statement, localName) ?? namespaceImportBinding(statement, localName);
    if (binding !== null) return binding;
  }
  return null;
};

const standardModule = (source: string, names: readonly string[]): boolean =>
  names.includes(source);

const importedFunctionName = (input: {
  readonly expression: ts.LeftHandSideExpression;
  readonly sourceFile: ts.SourceFile;
  readonly sources: readonly string[];
}): string | null => {
  if (ts.isIdentifier(input.expression)) {
    const binding = importedBinding(input.sourceFile, input.expression.text);
    return binding !== null &&
      binding.imported !== null &&
      standardModule(binding.source, input.sources)
      ? binding.imported
      : null;
  }
  if (
    !ts.isPropertyAccessExpression(input.expression) ||
    !ts.isIdentifier(input.expression.expression)
  ) {
    return null;
  }
  const binding = importedBinding(input.sourceFile, input.expression.expression.text);
  return binding?.imported === null && standardModule(binding.source, input.sources)
    ? input.expression.name.text
    : null;
};

export const viteConfigStandardCall = (input: {
  readonly cutoff: number;
  readonly expression: ts.LeftHandSideExpression;
  readonly sourceFile: ts.SourceFile;
}): string | null => {
  const pathFunction = importedFunctionName({
    expression: input.expression,
    sourceFile: input.sourceFile,
    sources: ["node:path", "path"],
  });
  const stable = standardCallBindingIsStable(input);
  if (
    stable &&
    (pathFunction === "join" || pathFunction === "normalize" || pathFunction === "resolve")
  ) {
    return pathFunction;
  }
  return stable &&
    importedFunctionName({
      expression: input.expression,
      sourceFile: input.sourceFile,
      sources: ["node:url", "url"],
    }) === "fileURLToPath"
    ? "fileURLToPath"
    : null;
};

export const viteConfigIsDefineConfig = (
  sourceFile: ts.SourceFile,
  expression: ts.LeftHandSideExpression,
): boolean =>
  importedFunctionName({ expression, sourceFile, sources: ["vite", "vite-plus"] }) ===
  "defineConfig";

const bindingNameContains = (name: ts.BindingName, spelling: string): boolean => {
  if (ts.isIdentifier(name)) return name.text === spelling;
  return name.elements.some(
    (element) => !ts.isOmittedExpression(element) && bindingNameContains(element.name, spelling),
  );
};

const namedDeclarationHasName = (node: ts.Node, spelling: string): boolean => {
  if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)) {
    return node.name?.text === spelling;
  }
  if (ts.isClassDeclaration(node) || ts.isClassExpression(node) || ts.isEnumDeclaration(node)) {
    return node.name?.text === spelling;
  }
  return false;
};

const nodeDeclaresValueName = (node: ts.Node, spelling: string): boolean => {
  if (ts.isVariableDeclaration(node) || ts.isParameter(node) || ts.isBindingElement(node)) {
    return bindingNameContains(node.name, spelling);
  }
  if (namedDeclarationHasName(node, spelling)) return true;
  return ts.isImportClause(node) || ts.isImportSpecifier(node) || ts.isNamespaceImport(node)
    ? node.name?.text === spelling
    : false;
};

const nodeTreeDeclaresValueName = (node: ts.Node, spelling: string): boolean =>
  nodeDeclaresValueName(node, spelling) ||
  node.forEachChild((child) => (nodeTreeDeclaresValueName(child, spelling) ? true : undefined)) ===
    true;

const sourceDeclaresValueName = (sourceFile: ts.SourceFile, spelling: string): boolean =>
  sourceFile.statements.some((statement) => nodeTreeDeclaresValueName(statement, spelling));

const writeTargetContains = (expression: ts.Expression, spelling: string): boolean => {
  if (ts.isIdentifier(expression)) return expression.text === spelling;
  if (ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression)) {
    return writeTargetContains(expression.expression, spelling);
  }
  if (ts.isArrayLiteralExpression(expression)) {
    return expression.elements.some(
      (element) =>
        !ts.isOmittedExpression(element) &&
        writeTargetContains(ts.isSpreadElement(element) ? element.expression : element, spelling),
    );
  }
  if (!ts.isObjectLiteralExpression(expression)) return false;
  return expression.properties.some((property) =>
    ts.isShorthandPropertyAssignment(property)
      ? property.name.text === spelling
      : ts.isPropertyAssignment(property)
        ? writeTargetContains(property.initializer, spelling)
        : ts.isSpreadAssignment(property)
          ? writeTargetContains(property.expression, spelling)
          : false,
  );
};

const callMayWriteBinding = (call: ts.CallExpression, spelling: string): boolean => {
  const callee = call.expression;
  if (
    (ts.isPropertyAccessExpression(callee) || ts.isElementAccessExpression(callee)) &&
    writeTargetContains(callee.expression, spelling)
  ) {
    return true;
  }
  return call.arguments.some((argument) => writeTargetContains(argument, spelling));
};

const nodeWritesBinding = (node: ts.Node, spelling: string): boolean => {
  if (
    ts.isBinaryExpression(node) &&
    node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
    node.operatorToken.kind <= ts.SyntaxKind.LastAssignment
  ) {
    return writeTargetContains(node.left, spelling);
  }
  if (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) {
    return writeTargetContains(node.operand, spelling);
  }
  if (ts.isCallExpression(node) && callMayWriteBinding(node, spelling)) return true;
  return node.getChildren().some((child) => nodeWritesBinding(child, spelling));
};

const nodeWritesBindingBefore = (
  node: ts.Node,
  input: { readonly cutoff: number; readonly spelling: string },
): boolean => {
  if (node.getStart() >= input.cutoff) return false;
  if (
    ts.isBinaryExpression(node) &&
    node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
    node.operatorToken.kind <= ts.SyntaxKind.LastAssignment
  ) {
    return writeTargetContains(node.left, input.spelling);
  }
  if (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) {
    return writeTargetContains(node.operand, input.spelling);
  }
  if (
    ts.isCallExpression(node) &&
    node.arguments.some((argument) => writeTargetContains(argument, input.spelling))
  ) {
    return true;
  }
  return node.getChildren().some((child) => nodeWritesBindingBefore(child, input));
};

export const viteConfigBindingIsStableBefore = (
  sourceFile: ts.SourceFile,
  input: { readonly cutoff: number; readonly identifier: ts.Identifier },
): boolean =>
  !sourceFile.statements.some((statement) =>
    nodeWritesBindingBefore(statement, {
      cutoff: input.cutoff,
      spelling: input.identifier.text,
    }),
  );

const standardCallBindingIsStable = (input: {
  readonly cutoff: number;
  readonly expression: ts.LeftHandSideExpression;
  readonly sourceFile: ts.SourceFile;
}): boolean => {
  const expression = input.expression;
  const identifier = ts.isIdentifier(expression)
    ? expression
    : ts.isPropertyAccessExpression(expression) && ts.isIdentifier(expression.expression)
      ? expression.expression
      : null;
  return (
    identifier === null ||
    viteConfigBindingIsStableBefore(input.sourceFile, {
      cutoff: input.cutoff,
      identifier,
    })
  );
};

export const viteConfigBindingIsStable = (
  sourceFile: ts.SourceFile,
  identifier: ts.Identifier,
): boolean =>
  !sourceFile.statements.some((statement) => nodeWritesBinding(statement, identifier.text));

export const viteConfigIsUrlConstructor = (
  sourceFile: ts.SourceFile,
  expression: ts.LeftHandSideExpression,
): boolean => {
  if (!ts.isIdentifier(expression)) return false;
  const binding = importedBinding(sourceFile, expression.text);
  if (binding !== null) {
    return binding.imported === "URL" && standardModule(binding.source, ["node:url", "url"]);
  }
  return expression.text === "URL" && !sourceDeclaresValueName(sourceFile, "URL");
};
