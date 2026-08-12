import { join } from "node:path";

import * as ts from "typescript-6";

import { isFile, readTextFile } from "./source-files.ts";
import {
  viteConfigBindingIsStable,
  viteConfigBindingIsStableBefore,
  viteConfigIsDefineConfig,
} from "./vite-config-binding.ts";
import { viteConfigReturnedExpressions } from "./vite-config-return.ts";

export type ViteStaticConfig = {
  readonly configPath: string;
  readonly objects: readonly ts.ObjectLiteralExpression[];
  readonly rootExpressions: readonly ts.Expression[];
  readonly sourceFile: ts.SourceFile;
};

const CONFIG_NAMES = [
  "vite.config.js",
  "vite.config.mjs",
  "vite.config.ts",
  "vite.config.cjs",
  "vite.config.mts",
  "vite.config.cts",
] as const;

const configPathOf = (repositoryRoot: string): string | null =>
  CONFIG_NAMES.map((name) => join(repositoryRoot, name)).find(isFile) ?? null;

export const unwrapViteConfigExpression = (expression: ts.Expression): ts.Expression => {
  if (
    ts.isAsExpression(expression) ||
    ts.isSatisfiesExpression(expression) ||
    ts.isParenthesizedExpression(expression)
  ) {
    return unwrapViteConfigExpression(expression.expression);
  }
  return expression;
};

export const viteConfigPropertyName = (name: ts.PropertyName): string | null => {
  if (ts.isIdentifier(name) || ts.isStringLiteralLike(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  const expression = ts.isComputedPropertyName(name)
    ? unwrapViteConfigExpression(name.expression)
    : null;
  return expression !== null && ts.isStringLiteralLike(expression) ? expression.text : null;
};

export const viteConfigDeclarationInitializers = (
  sourceFile: ts.SourceFile,
  identifier: ts.Identifier,
): readonly ts.Expression[] =>
  sourceFile.statements.flatMap((statement) =>
    ts.isVariableStatement(statement)
      ? statement.declarationList.declarations.flatMap((declaration) =>
          ts.isIdentifier(declaration.name) &&
          declaration.name.text === identifier.text &&
          viteConfigBindingIsStable(sourceFile, identifier) &&
          declaration.initializer !== undefined
            ? [declaration.initializer]
            : [],
        )
      : [],
  );

export const viteConfigFunctionReturns = (input: {
  readonly cutoff: number;
  readonly identifier: ts.Identifier;
  readonly sourceFile: ts.SourceFile;
}): readonly ts.Expression[] =>
  input.sourceFile.statements.flatMap((statement) =>
    ts.isFunctionDeclaration(statement) &&
    statement.name?.text === input.identifier.text &&
    statement.body !== undefined &&
    viteConfigBindingIsStableBefore(input.sourceFile, {
      cutoff: input.cutoff,
      identifier: input.identifier,
    })
      ? viteConfigReturnedExpressions(statement.body)
      : [],
  );

const objectSourceExpressions = (
  sourceFile: ts.SourceFile,
  expression: ts.Expression,
): readonly ts.Expression[] => {
  if (ts.isIdentifier(expression)) {
    return [
      ...viteConfigDeclarationInitializers(sourceFile, expression),
      ...viteConfigFunctionReturns({ cutoff: sourceFile.end, identifier: expression, sourceFile }),
    ];
  }
  if (ts.isArrowFunction(expression) || ts.isFunctionExpression(expression)) {
    return viteConfigReturnedExpressions(expression.body);
  }
  if (ts.isCallExpression(expression)) {
    if (viteConfigIsDefineConfig(sourceFile, expression.expression)) {
      return expression.arguments.slice(0, 1);
    }
    return ts.isIdentifier(expression.expression)
      ? viteConfigFunctionReturns({
          cutoff: expression.getStart(sourceFile),
          identifier: expression.expression,
          sourceFile,
        })
      : [];
  }
  return ts.isConditionalExpression(expression) ? [expression.whenTrue, expression.whenFalse] : [];
};

export const viteStaticObjectCandidates = (input: {
  readonly expression: ts.Expression;
  readonly seen?: ReadonlySet<ts.Node>;
  readonly sourceFile: ts.SourceFile;
}): readonly ts.ObjectLiteralExpression[] => {
  const expression = unwrapViteConfigExpression(input.expression);
  const seen = input.seen ?? new Set<ts.Node>();
  if (seen.has(expression)) return [];
  if (ts.isObjectLiteralExpression(expression)) return [expression];
  const nextSeen = new Set([...seen, expression]);
  return objectSourceExpressions(input.sourceFile, expression).flatMap((candidate) =>
    viteStaticObjectCandidates({ ...input, expression: candidate, seen: nextSeen }),
  );
};

const isModuleExportsAssignment = (expression: ts.Expression): expression is ts.BinaryExpression =>
  ts.isBinaryExpression(expression) &&
  expression.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
  ts.isPropertyAccessExpression(expression.left) &&
  expression.left.name.text === "exports" &&
  ts.isIdentifier(expression.left.expression) &&
  expression.left.expression.text === "module";

const configurationExpressions = (sourceFile: ts.SourceFile): readonly ts.Expression[] =>
  sourceFile.statements.flatMap((statement) =>
    ts.isExportAssignment(statement)
      ? [statement.expression]
      : ts.isExpressionStatement(statement) && isModuleExportsAssignment(statement.expression)
        ? [statement.expression.right]
        : [],
  );

export const loadViteStaticConfig = (repositoryRoot: string): ViteStaticConfig | null => {
  const configPath = configPathOf(repositoryRoot);
  if (configPath === null) return null;
  const sourceText = readTextFile(configPath);
  if (sourceText === null) return null;
  const sourceFile = ts.createSourceFile(configPath, sourceText, ts.ScriptTarget.Latest, true);
  const rootExpressions = configurationExpressions(sourceFile);
  const objects = rootExpressions.flatMap((expression) =>
    viteStaticObjectCandidates({ expression, sourceFile }),
  );
  return { configPath, objects, rootExpressions, sourceFile };
};

type PropertySearch = {
  readonly index: number;
  readonly name: string;
  readonly object: ts.ObjectLiteralExpression;
  readonly seen: ReadonlySet<ts.ObjectLiteralExpression>;
  readonly sourceFile: ts.SourceFile;
};

const spreadPropertyExpressions = (
  input: PropertySearch & { readonly property: ts.SpreadAssignment },
): readonly ts.Expression[] => {
  const previous = (): readonly ts.Expression[] =>
    propertyExpressionsBefore({ ...input, index: input.index - 1 });
  const objects = viteStaticObjectCandidates({
    expression: input.property.expression,
    sourceFile: input.sourceFile,
  }).filter((object) => !input.seen.has(object));
  if (objects.length === 0) return previous();
  const nextSeen = new Set([...input.seen, ...objects]);
  const candidates = objects.map((object) =>
    propertyExpressions({ ...input, object, seen: nextSeen }),
  );
  const spread = candidates.flat();
  return candidates.every((candidate) => candidate.length !== 0)
    ? spread
    : [...spread, ...previous()];
};

const propertyExpressionsBefore = (input: PropertySearch): readonly ts.Expression[] => {
  if (input.index < 0) return [];
  const property = input.object.properties[input.index];
  if (property === undefined) return [];
  if (ts.isPropertyAssignment(property) && viteConfigPropertyName(property.name) === input.name) {
    return [property.initializer];
  }
  if (ts.isShorthandPropertyAssignment(property) && property.name.text === input.name) {
    return viteConfigDeclarationInitializers(input.sourceFile, property.name);
  }
  const previous = (): readonly ts.Expression[] =>
    propertyExpressionsBefore({ ...input, index: input.index - 1 });
  if (!ts.isSpreadAssignment(property)) return previous();
  return spreadPropertyExpressions({ ...input, property });
};

const propertyExpressions = (input: {
  readonly name: string;
  readonly object: ts.ObjectLiteralExpression;
  readonly seen?: ReadonlySet<ts.ObjectLiteralExpression>;
  readonly sourceFile: ts.SourceFile;
}): readonly ts.Expression[] => {
  const seen = input.seen ?? new Set<ts.ObjectLiteralExpression>([input.object]);
  return propertyExpressionsBefore({
    ...input,
    index: input.object.properties.length - 1,
    seen,
  });
};

export const viteStaticPropertyExpressions = (input: {
  readonly config: ViteStaticConfig;
  readonly name: string;
  readonly objects?: readonly ts.ObjectLiteralExpression[];
}): readonly ts.Expression[] =>
  (input.objects ?? input.config.objects).flatMap((object) =>
    propertyExpressions({ name: input.name, object, sourceFile: input.config.sourceFile }),
  );

const objectShapeIsUnknown = (input: {
  readonly object: ts.ObjectLiteralExpression;
  readonly seen: ReadonlySet<ts.ObjectLiteralExpression>;
  readonly sourceFile: ts.SourceFile;
}): boolean =>
  input.object.properties.some((property) => {
    if (ts.isPropertyAssignment(property) || ts.isMethodDeclaration(property)) {
      return viteConfigPropertyName(property.name) === null;
    }
    if (!ts.isSpreadAssignment(property)) return false;
    const objects = viteStaticObjectCandidates({
      expression: property.expression,
      sourceFile: input.sourceFile,
    }).filter((object) => !input.seen.has(object));
    if (objects.length === 0) return true;
    const nextSeen = new Set([...input.seen, ...objects]);
    return objects.some((object) =>
      objectShapeIsUnknown({ object, seen: nextSeen, sourceFile: input.sourceFile }),
    );
  });

export const viteStaticObjectHasUnknownShape = (input: {
  readonly config: ViteStaticConfig;
  readonly object: ts.ObjectLiteralExpression;
}): boolean =>
  objectShapeIsUnknown({
    object: input.object,
    seen: new Set([input.object]),
    sourceFile: input.config.sourceFile,
  });

export const viteConfigHasUnknownShape = (config: ViteStaticConfig): boolean =>
  config.objects.some((object) => viteStaticObjectHasUnknownShape({ config, object }));
