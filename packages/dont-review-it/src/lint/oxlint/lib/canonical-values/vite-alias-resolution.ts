import { isAbsolute, resolve } from "node:path";

import { attempt, uniqBy } from "es-toolkit";
import * as ts from "typescript-6";

import {
  viteConfigHasUnknownShape,
  loadViteStaticConfig,
  unwrapViteConfigExpression,
  viteConfigPropertyName,
  viteStaticObjectCandidates,
  viteStaticObjectHasUnknownShape,
  viteStaticPropertyExpressions,
  type ViteStaticConfig,
} from "./vite-config-static.ts";
import { viteStaticPaths, viteStaticStringArrayProperty } from "./vite-config-value.ts";

type ViteAlias = {
  readonly find: ViteAliasFind;
  readonly replacement: string;
};

type ViteAliasFind =
  | { readonly kind: "pattern"; readonly flags: string; readonly source: string }
  | { readonly kind: "string"; readonly spelling: string };

const staticFind = (expression: ts.Expression): ViteAliasFind | null => {
  const candidate = unwrapViteConfigExpression(expression);
  if (ts.isStringLiteralLike(candidate)) {
    return { kind: "string", spelling: candidate.text };
  }
  if (!ts.isRegularExpressionLiteral(candidate)) return null;
  const separator = candidate.text.lastIndexOf("/");
  return separator <= 0
    ? null
    : {
        kind: "pattern",
        flags: candidate.text.slice(separator + 1),
        source: candidate.text.slice(1, separator),
      };
};

type ObjectAliasSearch = {
  readonly config: ViteStaticConfig;
  readonly index: number;
  readonly object: ts.ObjectLiteralExpression;
  readonly seen: ReadonlySet<string>;
};

const previousObjectAliases = (
  input: ObjectAliasSearch,
  seen: ReadonlySet<string> = input.seen,
): readonly ViteAlias[] => objectAliasesBefore({ ...input, index: input.index - 1, seen });

const spreadObjectAliases = (
  input: ObjectAliasSearch,
  property: ts.SpreadAssignment,
): readonly ViteAlias[] => {
  const aliases = aliasesFromExpression(input.config, property.expression);
  if (aliases.length === 0) return [];
  const selected = aliases.filter(
    (alias) => alias.find.kind !== "string" || !input.seen.has(alias.find.spelling),
  );
  const spellings = selected.flatMap((alias) =>
    alias.find.kind === "string" ? [alias.find.spelling] : [],
  );
  return [...selected, ...previousObjectAliases(input, new Set([...input.seen, ...spellings]))];
};

const assignedObjectAliases = (
  input: ObjectAliasSearch,
  property: ts.PropertyAssignment,
): readonly ViteAlias[] => {
  const spelling = viteConfigPropertyName(property.name);
  if (spelling === null) return [];
  if (input.seen.has(spelling)) return previousObjectAliases(input);
  const replacements = viteStaticPaths({ config: input.config, expression: property.initializer });
  if (replacements.length === 0) return [];
  const aliases = replacements.map(
    (replacement): ViteAlias => ({ find: { kind: "string", spelling }, replacement }),
  );
  return [...aliases, ...previousObjectAliases(input, new Set([...input.seen, spelling]))];
};

const objectAliasesBefore = (input: ObjectAliasSearch): readonly ViteAlias[] => {
  if (input.index < 0) return [];
  const property = input.object.properties[input.index];
  if (property === undefined) return [];
  if (ts.isSpreadAssignment(property)) return spreadObjectAliases(input, property);
  if (!ts.isPropertyAssignment(property)) return [];
  return assignedObjectAliases(input, property);
};

const objectAliases = (input: {
  readonly config: ViteStaticConfig;
  readonly object: ts.ObjectLiteralExpression;
}): readonly ViteAlias[] =>
  objectAliasesBefore({
    ...input,
    index: input.object.properties.length - 1,
    seen: new Set(),
  });

const combinedAliases = (
  finds: readonly ViteAliasFind[],
  replacements: readonly string[],
): readonly ViteAlias[] =>
  finds.flatMap((find) => replacements.map((replacement) => ({ find, replacement })));

const arrayAlias = (input: {
  readonly config: ViteStaticConfig;
  readonly expression: ts.Expression;
}): readonly ViteAlias[] =>
  viteStaticObjectCandidates({
    expression: input.expression,
    sourceFile: input.config.sourceFile,
  }).flatMap((object) => {
    const finds = viteStaticPropertyExpressions({
      config: input.config,
      name: "find",
      objects: [object],
    }).flatMap((expression) => {
      const find = staticFind(expression);
      return find === null ? [] : [find];
    });
    const replacements = viteStaticPropertyExpressions({
      config: input.config,
      name: "replacement",
      objects: [object],
    }).flatMap((expression) => viteStaticPaths({ config: input.config, expression }));
    return combinedAliases(finds, replacements);
  });

const arrayAliases = (input: {
  readonly array: ts.ArrayLiteralExpression;
  readonly config: ViteStaticConfig;
}): readonly ViteAlias[] =>
  input.array.elements.flatMap((element) =>
    ts.isSpreadElement(element)
      ? aliasesFromExpression(input.config, element.expression)
      : arrayAlias({ config: input.config, expression: element }),
  );

const aliasesFromExpression = (
  config: ViteStaticConfig,
  rawExpression: ts.Expression,
): readonly ViteAlias[] => {
  const expression = unwrapViteConfigExpression(rawExpression);
  if (ts.isArrayLiteralExpression(expression)) return arrayAliases({ array: expression, config });
  return viteStaticObjectCandidates({ expression, sourceFile: config.sourceFile }).flatMap(
    (object) => objectAliases({ config, object }),
  );
};

const resolveObjects = (config: ViteStaticConfig): readonly ts.ObjectLiteralExpression[] =>
  viteStaticPropertyExpressions({ config, name: "resolve" }).flatMap((expression) =>
    viteStaticObjectCandidates({ expression, sourceFile: config.sourceFile }),
  );

const aliasesFromConfig = (config: ViteStaticConfig): readonly ViteAlias[] =>
  viteStaticPropertyExpressions({ config, name: "alias", objects: resolveObjects(config) }).flatMap(
    (expression) => aliasesFromExpression(config, expression),
  );

const patternOf = (find: Extract<ViteAliasFind, { readonly kind: "pattern" }>): RegExp | null => {
  const [failure, pattern] = attempt(() => new RegExp(find.source, find.flags));
  return failure === null ? pattern : null;
};

const applyAlias = (specifier: string, alias: ViteAlias): string | null => {
  if (alias.find.kind === "string") {
    const find = alias.find.spelling;
    return specifier === find || specifier.startsWith(`${find}/`)
      ? `${alias.replacement}${specifier.slice(find.length)}`
      : null;
  }
  const pattern = patternOf(alias.find);
  return pattern?.test(specifier) === true ? specifier.replace(pattern, alias.replacement) : null;
};

export const resolveViteAlias = (input: {
  readonly repositoryRoot: string;
  readonly specifier: string;
}): string | null => {
  const config = loadViteStaticConfig(input.repositoryRoot);
  if (config === null) return null;
  return (
    uniqBy(
      aliasesFromConfig(config).flatMap((alias) => {
        const resolved = applyAlias(input.specifier, alias);
        return resolved === null ? [] : [resolved];
      }),
      String,
    )[0] ?? null
  );
};

const resolveStringArray = (repositoryRoot: string, name: string): readonly string[] => {
  const config = loadViteStaticConfig(repositoryRoot);
  return config === null
    ? []
    : viteStaticStringArrayProperty({ config, name, objects: resolveObjects(config) });
};

const DEFAULT_VITE_EXTENSIONS: readonly string[] = [
  ".mjs",
  ".js",
  ".mts",
  ".ts",
  ".jsx",
  ".tsx",
  ".json",
];

export const resolveViteConditions = (repositoryRoot: string): readonly string[] =>
  resolveStringArray(repositoryRoot, "conditions");

export const resolveViteExtensions = (repositoryRoot: string): readonly string[] => {
  const config = loadViteStaticConfig(repositoryRoot);
  if (config === null) return DEFAULT_VITE_EXTENSIONS;
  const objects = resolveObjects(config);
  const expressions = viteStaticPropertyExpressions({ config, name: "extensions", objects });
  return expressions.length === 0
    ? DEFAULT_VITE_EXTENSIONS
    : viteStaticStringArrayProperty({ config, name: "extensions", objects });
};

export const resolveViteMainFields = (repositoryRoot: string): readonly string[] =>
  resolveStringArray(repositoryRoot, "mainFields");

const configExpressionPaths = (input: {
  readonly basePaths: readonly string[];
  readonly config: ViteStaticConfig;
  readonly expression: ts.Expression;
}): readonly string[] =>
  viteStaticPaths({ config: input.config, expression: input.expression }).flatMap((path) =>
    isAbsolute(path) ? [path] : input.basePaths.map((basePath) => resolve(basePath, path)),
  );

const configPathProperty = (input: {
  readonly basePaths: readonly string[];
  readonly config: ViteStaticConfig;
  readonly name: string;
}): readonly string[] => {
  const expressions = viteStaticPropertyExpressions({ config: input.config, name: input.name });
  return uniqBy(
    expressions.flatMap((expression) => configExpressionPaths({ ...input, expression })),
    String,
  );
};

export const resolveViteRoots = (repositoryRoot: string): readonly string[] => {
  const config = loadViteStaticConfig(repositoryRoot);
  if (config === null) return [repositoryRoot];
  const rootExpressions = viteStaticPropertyExpressions({ config, name: "root" });
  return rootExpressions.length === 0
    ? [repositoryRoot]
    : configPathProperty({ basePaths: [repositoryRoot], config, name: "root" });
};

const expressionIsFalse = (expression: ts.Expression): boolean =>
  unwrapViteConfigExpression(expression).kind === ts.SyntaxKind.FalseKeyword;

export const resolveVitePublicDirectories = (repositoryRoot: string): readonly string[] => {
  const config = loadViteStaticConfig(repositoryRoot);
  const roots = resolveViteRoots(repositoryRoot);
  if (config === null) return roots.map((root) => resolve(root, "public"));
  const expressions = viteStaticPropertyExpressions({ config, name: "publicDir" });
  if (expressions.length === 0) return roots.map((root) => resolve(root, "public"));
  if (expressions.every(expressionIsFalse)) return [];
  return configPathProperty({ basePaths: roots, config, name: "publicDir" });
};

const expressionIsProvablyEmptyArray = (input: {
  readonly config: ViteStaticConfig;
  readonly expression: ts.Expression;
  readonly seen: ReadonlySet<ts.Node>;
}): boolean => {
  const expression = unwrapViteConfigExpression(input.expression);
  if (input.seen.has(expression)) return false;
  if (ts.isArrayLiteralExpression(expression)) return expression.elements.length === 0;
  if (!ts.isIdentifier(expression)) return false;
  const initializers = input.config.sourceFile.statements.flatMap((statement) =>
    ts.isVariableStatement(statement)
      ? statement.declarationList.declarations.flatMap((declaration) =>
          ts.isIdentifier(declaration.name) &&
          declaration.name.text === expression.text &&
          declaration.initializer !== undefined
            ? [declaration.initializer]
            : [],
        )
      : [],
  );
  const seen = new Set([...input.seen, expression]);
  return (
    initializers.length !== 0 &&
    initializers.every((initializer) =>
      expressionIsProvablyEmptyArray({ config: input.config, expression: initializer, seen }),
    )
  );
};

const vitePluginsMayResolveModules = (config: ViteStaticConfig): boolean =>
  viteStaticPropertyExpressions({ config, name: "plugins" }).some(
    (expression) =>
      !expressionIsProvablyEmptyArray({ config, expression, seen: new Set<ts.Node>() }),
  );

const nodeContainsProperty = (node: ts.Node, name: string): boolean => {
  if (
    (ts.isPropertyAssignment(node) || ts.isMethodDeclaration(node)) &&
    viteConfigPropertyName(node.name) === name
  ) {
    return true;
  }
  return (
    node.forEachChild((child) => (nodeContainsProperty(child, name) ? true : undefined)) === true
  );
};

const viteAliasResolutionIsOpen = (config: ViteStaticConfig): boolean =>
  viteStaticPropertyExpressions({ config, name: "alias", objects: resolveObjects(config) }).some(
    (expression) => nodeContainsProperty(expression, "customResolver"),
  );

const viteResolveConfigurationIsOpen = (config: ViteStaticConfig): boolean => {
  const expressions = viteStaticPropertyExpressions({ config, name: "resolve" });
  if (expressions.length === 0) return false;
  const objects = resolveObjects(config);
  return (
    objects.length === 0 ||
    objects.some((object) => viteStaticObjectHasUnknownShape({ config, object })) ||
    viteAliasResolutionIsOpen(config)
  );
};

export const viteConfigResolutionIsOpen = (repositoryRoot: string): boolean => {
  const config = loadViteStaticConfig(repositoryRoot);
  if (config === null) return false;
  return (
    (config.rootExpressions.length !== 0 && config.objects.length === 0) ||
    viteConfigHasUnknownShape(config) ||
    viteResolveConfigurationIsOpen(config) ||
    vitePluginsMayResolveModules(config)
  );
};

const viteConfigRootIsOpen = (repositoryRoot: string): boolean => {
  const config = loadViteStaticConfig(repositoryRoot);
  if (config === null) return false;
  const expressions = viteStaticPropertyExpressions({ config, name: "root" });
  return expressions.length !== 0 && resolveViteRoots(repositoryRoot).length === 0;
};

export const viteConfigPublicDirectoryIsOpen = (repositoryRoot: string): boolean => {
  const config = loadViteStaticConfig(repositoryRoot);
  if (config === null) return false;
  const expressions = viteStaticPropertyExpressions({ config, name: "publicDir" });
  if (expressions.every(expressionIsFalse)) {
    return viteConfigRootIsOpen(repositoryRoot);
  }
  return resolveVitePublicDirectories(repositoryRoot).length === 0;
};

export const viteConfigMayResolveModules = (repositoryRoot: string): boolean => {
  const config = loadViteStaticConfig(repositoryRoot);
  if (config === null) return false;
  if (
    (config.rootExpressions.length !== 0 && config.objects.length === 0) ||
    viteConfigHasUnknownShape(config)
  ) {
    return true;
  }
  return viteConfigResolutionIsOpen(repositoryRoot) || resolveObjects(config).length !== 0;
};
