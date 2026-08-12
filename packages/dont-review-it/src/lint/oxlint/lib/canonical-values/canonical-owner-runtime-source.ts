import { existsSync, realpathSync } from "node:fs";
import { extname, relative, resolve } from "node:path";

import { uniqBy } from "es-toolkit";
import * as ts from "typescript-6";

import { isOutOfScopeSource } from "../out-of-scope-source.ts";
import { pathIsInside } from "../path-is-inside.ts";
import {
  runtimeExpressionSources,
  unwrapRuntimeExpression,
  type RuntimeExpressionSource,
  type RuntimeSequenceResolution,
} from "./canonical-owner-runtime-expression.ts";

export type CanonicalOwnerRuntimeDeclaration = {
  readonly absolutePath: string;
  readonly declarationStart: number;
};

const normalizedPath = (filePath: string): string =>
  existsSync(filePath) ? realpathSync(filePath) : resolve(filePath);

export const canonicalOwnerRuntimeDeclarationKey = (
  declaration: CanonicalOwnerRuntimeDeclaration,
): string => `${normalizedPath(declaration.absolutePath)}:${declaration.declarationStart}`;

const sourceIsEligible = (input: {
  readonly filePath: string;
  readonly repositoryRoot: string;
}): boolean => {
  const repositoryRoot = normalizedPath(input.repositoryRoot);
  const filePath = normalizedPath(input.filePath);
  const segments = relative(repositoryRoot, filePath).split(/[/\\]/u);
  return (
    pathIsInside(repositoryRoot, filePath) &&
    !segments.includes("node_modules") &&
    !isOutOfScopeSource(filePath, repositoryRoot)
  );
};

const arrayDomainSources = (input: {
  readonly array: ts.ArrayLiteralExpression;
  readonly resolution: RuntimeSequenceResolution;
  readonly seen: ReadonlySet<ts.Expression>;
}): readonly RuntimeExpressionSource[] | null => {
  const sources = input.array.elements.flatMap((element) => {
    if (ts.isOmittedExpression(element)) return [null];
    return domainSources({
      expression: ts.isSpreadElement(element) ? element.expression : element,
      resolution: input.resolution,
      seen: input.seen,
    });
  });
  return sources.some((source) => source === null)
    ? null
    : (sources as readonly RuntimeExpressionSource[]);
};

const objectDomainSources = (input: {
  readonly object: ts.ObjectLiteralExpression;
  readonly resolution: RuntimeSequenceResolution;
  readonly seen: ReadonlySet<ts.Expression>;
  readonly source: RuntimeExpressionSource;
}): readonly RuntimeExpressionSource[] | null => {
  const sources = input.object.properties.flatMap((property) => {
    if (ts.isSpreadAssignment(property)) {
      return domainSources({
        expression: property.expression,
        resolution: input.resolution,
        seen: input.seen,
      });
    }
    return ts.isComputedPropertyName(property.name)
      ? domainSources({
          expression: property.name.expression,
          resolution: input.resolution,
          seen: input.seen,
        })
      : [input.source];
  });
  return sources.some((source) => source === null)
    ? null
    : (sources as readonly RuntimeExpressionSource[]);
};

const expandedDomainSources = (input: {
  readonly seen: ReadonlySet<ts.Expression>;
  readonly source: RuntimeExpressionSource;
}): readonly RuntimeExpressionSource[] | null => {
  const expression = unwrapRuntimeExpression(input.source.expression);
  if (input.seen.has(expression)) return null;
  const seen = new Set([...input.seen, expression]);
  if (ts.isArrayLiteralExpression(expression)) {
    return arrayDomainSources({ array: expression, resolution: input.source.resolution, seen });
  }
  return ts.isObjectLiteralExpression(expression)
    ? objectDomainSources({
        object: expression,
        resolution: input.source.resolution,
        seen,
        source: input.source,
      })
    : [input.source];
};

const domainSources = (input: {
  readonly expression: ts.Expression;
  readonly resolution: RuntimeSequenceResolution;
  readonly seen: ReadonlySet<ts.Expression>;
}): readonly RuntimeExpressionSource[] | null => {
  const sources = runtimeExpressionSources(input.resolution, input.expression);
  if (sources === null) return null;
  const expanded = sources.flatMap((source) => expandedDomainSources({ seen: input.seen, source }));
  return expanded.some((source) => source === null)
    ? null
    : (expanded as readonly RuntimeExpressionSource[]);
};

const enclosingVariableStatement = (node: ts.Node): ts.VariableStatement | null =>
  ts.isVariableStatement(node)
    ? node
    : ts.isSourceFile(node)
      ? null
      : enclosingVariableStatement(node.parent);

const declarationForSource = (input: {
  readonly declarations: readonly CanonicalOwnerRuntimeDeclaration[];
  readonly source: RuntimeExpressionSource;
}): CanonicalOwnerRuntimeDeclaration | null => {
  const sourceFile = input.source.expression.getSourceFile();
  const statement = enclosingVariableStatement(input.source.expression);
  if (statement === null) return null;
  const filePath = normalizedPath(sourceFile.fileName);
  const start = statement.getStart(sourceFile);
  return (
    input.declarations.find(
      (declaration) =>
        normalizedPath(declaration.absolutePath) === filePath &&
        declaration.declarationStart === start,
    ) ?? null
  );
};

const sourceIsWithinOwner = (input: {
  readonly declaration: ts.VariableDeclaration;
  readonly source: RuntimeExpressionSource;
}): boolean => {
  const initializer = input.declaration.initializer;
  if (initializer === undefined) return false;
  const sourceFile = input.source.expression.getSourceFile();
  if (sourceFile !== input.declaration.getSourceFile()) return false;
  return (
    input.source.expression.getStart(sourceFile) >= initializer.getStart(sourceFile) &&
    input.source.expression.end <= initializer.end
  );
};

const dependencyForSource = (input: {
  readonly declaration: ts.VariableDeclaration;
  readonly declarations: readonly CanonicalOwnerRuntimeDeclaration[];
  readonly repositoryRoot: string;
  readonly source: RuntimeExpressionSource;
}): string | null => {
  const filePath = input.source.expression.getSourceFile().fileName;
  if (!sourceIsEligible({ filePath, repositoryRoot: input.repositoryRoot })) {
    throw new Error(`${filePath}: canonical owner runtime source must be in scope`);
  }
  if (sourceIsWithinOwner(input) || extname(filePath) === ".json") return null;
  const declaration = declarationForSource(input);
  if (declaration === null) {
    throw new Error(`${filePath}: canonical owner runtime source must be registered`);
  }
  return canonicalOwnerRuntimeDeclarationKey(declaration);
};

export const validateCanonicalOwnerRuntimeSource = (input: {
  readonly checker: ts.TypeChecker;
  readonly declaration: ts.VariableDeclaration;
  readonly declarations: readonly CanonicalOwnerRuntimeDeclaration[];
  readonly nodes: readonly ts.Node[];
  readonly program: ts.Program;
  readonly repositoryRoot: string;
}): readonly string[] => {
  const initializer = input.declaration.initializer;
  if (initializer === undefined) return [];
  const sources = domainSources({
    expression: initializer,
    resolution: {
      checker: input.checker,
      nodes: input.nodes,
      program: input.program,
      seenFunctions: new Set(),
      seenSymbols: new Set(),
    },
    seen: new Set(),
  });
  if (sources === null) {
    throw new Error(`${input.declaration.name.getText()}: canonical owner runtime source is open`);
  }
  return uniqBy(
    sources.flatMap((source) => {
      const dependency = dependencyForSource({ ...input, source });
      return dependency === null ? [] : [dependency];
    }),
    (dependency) => dependency,
  );
};
