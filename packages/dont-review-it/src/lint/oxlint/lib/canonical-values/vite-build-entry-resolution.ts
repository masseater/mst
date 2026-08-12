import { isAbsolute, resolve } from "node:path";

import * as ts from "typescript-6";

import {
  closedCandidateSet,
  joinCandidateSets,
  openCandidateSet,
  type CandidateSet,
} from "./candidate-set.ts";
import { isFile } from "./source-files.ts";
import { resolveViteRoots } from "./vite-alias-resolution.ts";
import {
  loadViteStaticConfig,
  unwrapViteConfigExpression,
  viteConfigDeclarationInitializers,
  viteConfigHasUnknownShape,
  viteConfigPropertyName,
  viteStaticObjectCandidates,
  viteStaticObjectHasUnknownShape,
  viteStaticPropertyExpressions,
  type ViteStaticConfig,
} from "./vite-config-static.ts";
import { viteStaticPaths } from "./vite-config-value.ts";

export type ViteBuildEntryResolution = {
  readonly configPath: string;
  readonly open: boolean;
  readonly sourcePaths: readonly string[];
};

const joinPaths = (sets: readonly CandidateSet<string>[]): CandidateSet<string> =>
  joinCandidateSets(sets, String);

const structuredEntryPaths = (input: {
  readonly config: ViteStaticConfig;
  readonly expression: ts.Expression;
  readonly seen: ReadonlySet<ts.Node>;
}): CandidateSet<string> | null => {
  if (ts.isIdentifier(input.expression)) {
    const initializers = viteConfigDeclarationInitializers(
      input.config.sourceFile,
      input.expression,
    );
    return initializers.length === 0
      ? openCandidateSet([], String)
      : joinPaths(initializers.map((expression) => entryPaths({ ...input, expression })));
  }
  if (ts.isConditionalExpression(input.expression)) {
    return joinPaths(
      [input.expression.whenTrue, input.expression.whenFalse].map((expression) =>
        entryPaths({ ...input, expression }),
      ),
    );
  }
  if (ts.isArrayLiteralExpression(input.expression)) {
    return joinPaths(
      input.expression.elements.map((element) =>
        ts.isOmittedExpression(element)
          ? closedCandidateSet([], String)
          : entryPaths({
              ...input,
              expression: ts.isSpreadElement(element) ? element.expression : element,
            }),
      ),
    );
  }
  if (!ts.isObjectLiteralExpression(input.expression)) return null;
  return joinPaths(
    input.expression.properties.map((property) => {
      if (ts.isSpreadAssignment(property)) {
        return entryPaths({ ...input, expression: property.expression });
      }
      if (ts.isShorthandPropertyAssignment(property)) {
        return entryPaths({ ...input, expression: property.name });
      }
      if (
        ts.isPropertyAssignment(property) &&
        !(
          viteConfigPropertyName(property.name) === "__proto__" &&
          !ts.isComputedPropertyName(property.name)
        )
      ) {
        return entryPaths({ ...input, expression: property.initializer });
      }
      return openCandidateSet([], String);
    }),
  );
};

const entryPaths = (input: {
  readonly config: ViteStaticConfig;
  readonly expression: ts.Expression;
  readonly seen: ReadonlySet<ts.Node>;
}): CandidateSet<string> => {
  const expression = unwrapViteConfigExpression(input.expression);
  if (input.seen.has(expression)) return openCandidateSet([], String);
  const seen = new Set([...input.seen, expression]);
  const direct = viteStaticPaths({ config: input.config, expression, seen: input.seen });
  if (direct.length !== 0) return closedCandidateSet(direct, String);
  if (
    expression.kind === ts.SyntaxKind.FalseKeyword ||
    expression.kind === ts.SyntaxKind.TrueKeyword ||
    expression.kind === ts.SyntaxKind.NullKeyword
  ) {
    return closedCandidateSet([], String);
  }
  return (
    structuredEntryPaths({ config: input.config, expression, seen }) ?? openCandidateSet([], String)
  );
};

const objectCandidates = (input: {
  readonly config: ViteStaticConfig;
  readonly expressions: readonly ts.Expression[];
}): {
  readonly objects: readonly ts.ObjectLiteralExpression[];
  readonly open: boolean;
} => {
  const candidates = input.expressions.map((expression) =>
    viteStaticObjectCandidates({ expression, sourceFile: input.config.sourceFile }),
  );
  const objects = candidates.flat();
  return {
    objects,
    open:
      candidates.some((candidate) => candidate.length === 0) ||
      objects.some((object) => viteStaticObjectHasUnknownShape({ config: input.config, object })),
  };
};

const nestedEntryPaths = (input: {
  readonly config: ViteStaticConfig;
  readonly entryName: string;
  readonly objectName: string;
  readonly objects: readonly ts.ObjectLiteralExpression[];
}): CandidateSet<string> => {
  const objectExpressions = viteStaticPropertyExpressions({
    config: input.config,
    name: input.objectName,
    objects: input.objects,
  });
  if (objectExpressions.length === 0) return closedCandidateSet([], String);
  const nested = objectCandidates({ config: input.config, expressions: objectExpressions });
  const expressions = viteStaticPropertyExpressions({
    config: input.config,
    name: input.entryName,
    objects: nested.objects,
  });
  const paths = joinPaths(
    expressions.map((expression) =>
      entryPaths({ config: input.config, expression, seen: new Set() }),
    ),
  );
  return nested.open ? openCandidateSet(paths.candidates, String) : paths;
};

const directEntryPaths = (input: {
  readonly config: ViteStaticConfig;
  readonly name: string;
  readonly objects: readonly ts.ObjectLiteralExpression[];
}): CandidateSet<string> =>
  joinPaths(
    viteStaticPropertyExpressions(input).map((expression) =>
      entryPaths({ config: input.config, expression, seen: new Set() }),
    ),
  );

const repositoryEntryPaths = (input: {
  readonly candidates: CandidateSet<string>;
  readonly repositoryRoot: string;
}): CandidateSet<string> => {
  const roots = resolveViteRoots(input.repositoryRoot);
  return {
    candidates: input.candidates.candidates
      .flatMap((path) => (isAbsolute(path) ? [path] : roots.map((root) => resolve(root, path))))
      .filter(isFile),
    complete: input.candidates.complete && roots.length !== 0,
  };
};

export const resolveViteBuildEntries = (
  repositoryRoot: string,
): ViteBuildEntryResolution | null => {
  const config = loadViteStaticConfig(repositoryRoot);
  if (config === null) return null;
  const buildExpressions = viteStaticPropertyExpressions({ config, name: "build" });
  const build = objectCandidates({ config, expressions: buildExpressions });
  const candidates = joinPaths([
    directEntryPaths({ config, name: "ssr", objects: build.objects }),
    nestedEntryPaths({ config, entryName: "entry", objectName: "lib", objects: build.objects }),
    nestedEntryPaths({
      config,
      entryName: "input",
      objectName: "rollupOptions",
      objects: build.objects,
    }),
  ]);
  const sources = repositoryEntryPaths({ candidates, repositoryRoot });
  return {
    configPath: config.configPath,
    open:
      !sources.complete ||
      (config.rootExpressions.length !== 0 && config.objects.length === 0) ||
      viteConfigHasUnknownShape(config) ||
      (buildExpressions.length !== 0 && build.open),
    sourcePaths: sources.candidates,
  };
};
