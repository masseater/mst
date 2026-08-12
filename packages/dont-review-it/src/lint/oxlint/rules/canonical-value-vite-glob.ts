import { dirname, matchesGlob, relative, resolve } from "node:path";

import { uniqBy } from "es-toolkit";

import { listRepositoryModuleFiles } from "../lib/canonical-values/source-files.ts";
import { toPosixPath } from "../lib/posix-path.ts";
import { canonicalValueInvocationPropertyPath } from "./canonical-value-invocation-target.ts";
import { canonicalValueModuleSpecifiers } from "./canonical-value-module-specifier.ts";
import {
  type CanonicalValueExpressionOrigin,
  type CanonicalValueOrigin,
} from "./canonical-value-property-origin.ts";
import { resolveCanonicalValueStaticArrayOriginVectors } from "./canonical-value-static-array.ts";

import type { Context, ESTree } from "@oxlint/plugins";
import type { CanonicalValueBindingIndex } from "./canonical-value-binding-index.ts";
import type {
  CanonicalValueInvocationFact,
  CanonicalValueInvocationState,
} from "./canonical-value-invocation.ts";
import type { CanonicalValuePropertyState } from "./canonical-value-property-state.ts";

type ViteGlobEnvironment = {
  readonly bindingIndex: CanonicalValueBindingIndex;
  readonly context: Context;
  readonly invocationState: CanonicalValueInvocationState;
  readonly propertyState: CanonicalValuePropertyState;
  readonly repositoryRoot: string;
};

const targetIsViteGlob = (origin: CanonicalValueExpressionOrigin): boolean => {
  const path = canonicalValueInvocationPropertyPath(origin);
  return (
    path?.length === 1 &&
    path[0] === "glob" &&
    origin.expression.type === "MetaProperty" &&
    origin.expression.meta.name === "import" &&
    origin.expression.property.name === "meta"
  );
};

const staticPatterns = (
  environment: ViteGlobEnvironment,
  origin: CanonicalValueOrigin,
): readonly string[] => {
  if (origin.kind === "absent") return [];
  const expression = origin.expression;
  const query = {
    cutoff: expression.start,
    executionContext: environment.bindingIndex.executionContextAt(expression),
    expression,
  };
  const vectors = resolveCanonicalValueStaticArrayOriginVectors(
    { propertyState: environment.propertyState },
    {
      origin,
      query,
      resolve: (nextQuery) => environment.propertyState.primitives(nextQuery),
      seen: new Set(),
    },
  ).candidates.flatMap((vector) =>
    vector.flatMap((primitive) => (typeof primitive === "string" ? [primitive] : [])),
  );
  const scalars = canonicalValueModuleSpecifiers(environment, expression).map(
    (specifier) => specifier.value,
  );
  return uniqBy([...vectors, ...scalars], String);
};

const candidatePath = (input: {
  readonly baseDirectory: string;
  readonly pattern: string;
  readonly repositoryRoot: string;
  readonly sourcePath: string;
}): string => {
  const pattern = input.pattern.startsWith("!") ? input.pattern.slice(1) : input.pattern;
  if (pattern.startsWith("/")) {
    return `/${toPosixPath(relative(input.repositoryRoot, input.sourcePath))}`;
  }
  const fromConsumer = toPosixPath(relative(input.baseDirectory, input.sourcePath));
  return pattern.startsWith("./") && !fromConsumer.startsWith(".")
    ? `./${fromConsumer}`
    : fromConsumer;
};

const matchesPattern = (candidate: string, pattern: string): boolean =>
  matchesGlob(candidate, pattern.startsWith("!") ? pattern.slice(1) : pattern);

const matchedSourcePaths = (input: {
  readonly baseDirectory: string;
  readonly environment: ViteGlobEnvironment;
  readonly patterns: readonly string[];
}): readonly string[] => {
  const positive = input.patterns.filter((pattern) => !pattern.startsWith("!"));
  const negative = input.patterns.filter((pattern) => pattern.startsWith("!"));
  return listRepositoryModuleFiles(input.environment.repositoryRoot).flatMap((source) => {
    const candidateFor = (pattern: string): string =>
      candidatePath({
        baseDirectory: input.baseDirectory,
        pattern,
        repositoryRoot: input.environment.repositoryRoot,
        sourcePath: source.absolutePath,
      });
    const included = positive.some((pattern) => matchesPattern(candidateFor(pattern), pattern));
    const excluded = negative.some((pattern) => matchesPattern(candidateFor(pattern), pattern));
    return included && !excluded ? [source.absolutePath] : [];
  });
};

const sourcePathsForOrigin = (input: {
  readonly environment: ViteGlobEnvironment;
  readonly fact: CanonicalValueInvocationFact;
  readonly origin: CanonicalValueOrigin;
}): readonly string[] => {
  const patterns = staticPatterns(input.environment, input.origin);
  return baseDirectories(input.environment, input.fact).flatMap((baseDirectory) =>
    matchedSourcePaths({ baseDirectory, environment: input.environment, patterns }),
  );
};

const baseDirectories = (
  environment: ViteGlobEnvironment,
  fact: CanonicalValueInvocationFact,
): readonly string[] => {
  const directories = environment.invocationState
    .argumentOrigins(fact, 1)
    .candidates.flatMap((origin) => {
      if (origin.kind === "absent") return [];
      const path = canonicalValueInvocationPropertyPath(origin);
      if (path === null) return [];
      return environment.propertyState
        .primitives({ expression: origin.expression, path: [...path, "base"] })
        .candidates.flatMap((primitive) =>
          typeof primitive === "string"
            ? [resolve(dirname(environment.context.filename), primitive)]
            : [],
        );
    });
  return directories.length === 0
    ? [dirname(environment.context.filename)]
    : uniqBy(directories, String);
};

export const canonicalValueViteGlobSourcePaths = (
  environment: ViteGlobEnvironment,
  invocation: ESTree.CallExpression,
): readonly string[] =>
  uniqBy(
    environment.invocationState
      .facts(invocation)
      .candidates.flatMap((fact) =>
        targetIsViteGlob(fact.target)
          ? environment.invocationState
              .argumentOrigins(fact, 0)
              .candidates.flatMap((origin) => sourcePathsForOrigin({ environment, fact, origin }))
          : [],
      ),
    String,
  );
