import { dirname, join, normalize, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { attempt, cartesianProduct, uniqBy } from "es-toolkit";
import * as ts from "typescript-6";

import { viteConfigIsUrlConstructor, viteConfigStandardCall } from "./vite-config-binding.ts";
import { viteConfigReturnedExpressions } from "./vite-config-return.ts";
import {
  unwrapViteConfigExpression,
  viteConfigDeclarationInitializers,
  viteConfigFunctionReturns,
  viteStaticPropertyExpressions,
  type ViteStaticConfig,
} from "./vite-config-static.ts";

const directStaticStrings = (input: {
  readonly config: ViteStaticConfig;
  readonly expression: ts.Expression;
  readonly seen: ReadonlySet<ts.Node>;
}): readonly string[] => {
  if (
    ts.isStringLiteralLike(input.expression) ||
    ts.isNoSubstitutionTemplateLiteral(input.expression)
  ) {
    return [input.expression.text];
  }
  if (ts.isIdentifier(input.expression)) {
    return viteConfigDeclarationInitializers(input.config.sourceFile, input.expression).flatMap(
      (initializer) =>
        viteStaticStrings({
          config: input.config,
          expression: initializer,
          seen: input.seen,
        }),
    );
  }
  return ts.isConditionalExpression(input.expression)
    ? [input.expression.whenTrue, input.expression.whenFalse].flatMap((candidate) =>
        viteStaticStrings({ config: input.config, expression: candidate, seen: input.seen }),
      )
    : [];
};

const viteStaticStrings = (input: {
  readonly config: ViteStaticConfig;
  readonly expression: ts.Expression;
  readonly seen?: ReadonlySet<ts.Node>;
}): readonly string[] => {
  const expression = unwrapViteConfigExpression(input.expression);
  const seen = input.seen ?? new Set<ts.Node>();
  if (seen.has(expression)) return [];
  return uniqBy(
    directStaticStrings({
      config: input.config,
      expression,
      seen: new Set([...seen, expression]),
    }),
    String,
  );
};

const importMetaProperty = (expression: ts.Expression, property: string): boolean =>
  ts.isPropertyAccessExpression(expression) &&
  expression.name.text === property &&
  ts.isMetaProperty(expression.expression) &&
  expression.expression.keywordToken === ts.SyntaxKind.ImportKeyword;

const staticNormalizePaths = (input: {
  readonly config: ViteStaticConfig;
  readonly expression: ts.CallExpression;
  readonly seen: ReadonlySet<ts.Node>;
}): readonly string[] => {
  const argument = input.expression.arguments[0];
  return argument === undefined
    ? []
    : viteStaticPaths({ config: input.config, expression: argument, seen: input.seen }).map(
        (path) => normalize(path),
      );
};

const staticLocalCallPaths = (input: {
  readonly config: ViteStaticConfig;
  readonly expression: ts.CallExpression;
  readonly seen: ReadonlySet<ts.Node>;
}): readonly string[] => {
  if (!ts.isIdentifier(input.expression.expression)) return [];
  const callee = input.expression.expression;
  const declarations = viteConfigDeclarationInitializers(input.config.sourceFile, callee).flatMap(
    (initializer) =>
      ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer)
        ? viteConfigReturnedExpressions(initializer.body)
        : [],
  );
  const returns = [
    ...viteConfigFunctionReturns({
      cutoff: input.expression.getStart(input.config.sourceFile),
      identifier: callee,
      sourceFile: input.config.sourceFile,
    }),
    ...declarations,
  ];
  return returns.flatMap((expression) => viteStaticPaths({ ...input, expression }));
};

const staticFileUrlPaths = (input: {
  readonly config: ViteStaticConfig;
  readonly expression: ts.CallExpression;
  readonly seen: ReadonlySet<ts.Node>;
}): readonly string[] => {
  const argument = input.expression.arguments[0];
  if (argument === undefined) return [];
  return viteStaticPaths({ config: input.config, expression: argument, seen: input.seen }).flatMap(
    (url) => {
      const [failure, path] = attempt(() => fileURLToPath(url));
      return failure === null && path !== null ? [path] : [];
    },
  );
};

const staticCallPaths = (input: {
  readonly config: ViteStaticConfig;
  readonly expression: ts.CallExpression;
  readonly seen: ReadonlySet<ts.Node>;
}): readonly string[] => {
  const name = viteConfigStandardCall({
    cutoff: input.expression.getStart(input.config.sourceFile),
    expression: input.expression.expression,
    sourceFile: input.config.sourceFile,
  });
  if (name === "resolve" || name === "join") {
    const segments = input.expression.arguments.map((argument) =>
      viteStaticPaths({ config: input.config, expression: argument, seen: input.seen }),
    );
    return cartesianProduct(...segments).map((parts) =>
      name === "resolve" ? resolve(...parts) : join(...parts),
    );
  }
  if (name === "normalize") return staticNormalizePaths(input);
  if (name === null && ts.isIdentifier(input.expression.expression)) {
    return staticLocalCallPaths(input);
  }
  return name === "fileURLToPath" ? staticFileUrlPaths(input) : [];
};

const staticUrls = (relativePath: string, bases: readonly string[]): readonly string[] =>
  bases.flatMap((basePath) => {
    const [failure, url] = attempt(() => new URL(relativePath, basePath).href);
    return failure === null && url !== null ? [url] : [];
  });

const staticNewUrlPaths = (input: {
  readonly config: ViteStaticConfig;
  readonly expression: ts.NewExpression;
  readonly seen: ReadonlySet<ts.Node>;
}): readonly string[] => {
  if (!viteConfigIsUrlConstructor(input.config.sourceFile, input.expression.expression)) return [];
  const [relativeExpression, baseExpression] = input.expression.arguments ?? [];
  if (relativeExpression === undefined || baseExpression === undefined) return [];
  const relatives = viteStaticPaths({ ...input, expression: relativeExpression });
  const bases = viteStaticPaths({ ...input, expression: baseExpression });
  return relatives.flatMap((relativePath) => staticUrls(relativePath, bases));
};

const staticReferencePaths = (input: {
  readonly config: ViteStaticConfig;
  readonly expression: ts.Expression;
  readonly seen: ReadonlySet<ts.Node>;
}): readonly string[] | null => {
  if (ts.isIdentifier(input.expression)) {
    return viteConfigDeclarationInitializers(input.config.sourceFile, input.expression).flatMap(
      (expression) => viteStaticPaths({ ...input, expression }),
    );
  }
  return ts.isConditionalExpression(input.expression)
    ? [input.expression.whenTrue, input.expression.whenFalse].flatMap((expression) =>
        viteStaticPaths({ ...input, expression }),
      )
    : null;
};

const remainingStaticPaths = (input: {
  readonly config: ViteStaticConfig;
  readonly expression: ts.Expression;
  readonly seen: ReadonlySet<ts.Node>;
}): readonly string[] => {
  const reference = staticReferencePaths(input);
  if (reference !== null) return reference;
  if (ts.isCallExpression(input.expression)) {
    return staticCallPaths({ ...input, expression: input.expression });
  }
  if (ts.isNewExpression(input.expression)) {
    return staticNewUrlPaths({ ...input, expression: input.expression });
  }
  const stringSeen = new Set(input.seen);
  stringSeen.delete(input.expression);
  return viteStaticStrings({ ...input, seen: stringSeen });
};

export const viteStaticPaths = (input: {
  readonly config: ViteStaticConfig;
  readonly expression: ts.Expression;
  readonly seen?: ReadonlySet<ts.Node>;
}): readonly string[] => {
  const expression = unwrapViteConfigExpression(input.expression);
  const seen = input.seen ?? new Set<ts.Node>();
  if (seen.has(expression)) return [];
  const nextSeen = new Set([...seen, expression]);
  if (importMetaProperty(expression, "dirname")) return [dirname(input.config.configPath)];
  if (importMetaProperty(expression, "url")) return [pathToFileURL(input.config.configPath).href];
  return remainingStaticPaths({ config: input.config, expression, seen: nextSeen });
};

const staticArrayStrings = (input: {
  readonly config: ViteStaticConfig;
  readonly expression: ts.Expression;
  readonly seen: ReadonlySet<ts.Node>;
}): readonly string[] => {
  const expression = unwrapViteConfigExpression(input.expression);
  if (input.seen.has(expression)) return [];
  const seen = new Set([...input.seen, expression]);
  if (ts.isIdentifier(expression)) {
    return viteConfigDeclarationInitializers(input.config.sourceFile, expression).flatMap(
      (initializer) => staticArrayStrings({ ...input, expression: initializer, seen }),
    );
  }
  if (!ts.isArrayLiteralExpression(expression)) return [];
  return expression.elements.flatMap((element) =>
    ts.isSpreadElement(element)
      ? staticArrayStrings({ ...input, expression: element.expression, seen })
      : viteStaticStrings({ config: input.config, expression: element, seen }),
  );
};

export const viteStaticStringArrayProperty = (input: {
  readonly config: ViteStaticConfig;
  readonly name: string;
  readonly objects: readonly ts.ObjectLiteralExpression[];
}): readonly string[] =>
  uniqBy(
    viteStaticPropertyExpressions(input).flatMap((expression) =>
      staticArrayStrings({ config: input.config, expression, seen: new Set() }),
    ),
    String,
  );
