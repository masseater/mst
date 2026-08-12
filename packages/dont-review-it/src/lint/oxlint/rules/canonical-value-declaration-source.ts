import { dirname, relative, resolve } from "node:path";

import * as ts from "typescript-6";

import { listRepositoryFiles, readTextFile } from "../lib/canonical-values/source-files.ts";
import {
  canonicalValuesTypeScriptConfigPath,
  createCanonicalValuesTypeScriptProgram,
} from "../lib/canonical-values/typescript-program.ts";
import { isOutOfScopeBoundarySource } from "../lib/out-of-scope-boundary-source.ts";
import { pathIsInside } from "../lib/path-is-inside.ts";
import { toPosixPath } from "../lib/posix-path.ts";

import type { ESTree } from "@oxlint/plugins";

export type CanonicalValueIdentifier = Extract<ESTree.Node, { readonly type: "Identifier" }>;

type CanonicalValueDeclarationSource = {
  readonly absolutePath: string;
  readonly sourcePath: string;
};

export type CanonicalValueDeclarationSourceIndex = {
  readonly amdDependencySpecifiers: readonly string[];
  readonly outOfScopeSource: (
    node: Pick<CanonicalValueIdentifier, "end" | "start">,
  ) => CanonicalValueDeclarationSource | null;
};

type RepositoryProgramSnapshot = {
  readonly program: ts.Program;
  readonly rootNames: readonly string[];
};

const programByConfiguration = new Map<string, RepositoryProgramSnapshot>();
const rootNamesByRepository = new Map<string, readonly string[]>();

const rangeKey = (node: { readonly end: number; readonly start: number }): string =>
  `${node.start}:${node.end}`;

const identifiersByRange = (sourceFile: ts.SourceFile): ReadonlyMap<string, ts.Identifier> => {
  const identifiers = new Map<string, ts.Identifier>();
  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node)) {
      identifiers.set(rangeKey({ end: node.getEnd(), start: node.getStart(sourceFile) }), node);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return identifiers;
};

const sourceFileIn = (program: ts.Program, filename: string): ts.SourceFile | null =>
  program.getSourceFile(filename) ??
  program.getSourceFiles().find((sourceFile) => resolve(sourceFile.fileName) === filename) ??
  null;

const outOfScopeDeclarationSource = (input: {
  readonly checker: ts.TypeChecker;
  readonly identifier: ts.Identifier;
  readonly repositoryRoot: string;
}): CanonicalValueDeclarationSource | null => {
  const symbol = input.checker.getSymbolAtLocation(input.identifier);
  const declarationPaths = [
    ...new Set(
      (symbol?.declarations ?? []).map((declaration) =>
        resolve(declaration.getSourceFile().fileName),
      ),
    ),
  ]
    .filter(
      (path) =>
        pathIsInside(input.repositoryRoot, path) &&
        isOutOfScopeBoundarySource(path, input.repositoryRoot),
    )
    .toSorted();
  const [absolutePath] = declarationPaths;
  return absolutePath === undefined
    ? null
    : {
        absolutePath,
        sourcePath: toPosixPath(relative(input.repositoryRoot, absolutePath)),
      };
};

const declarationSourceIndex = (input: {
  readonly checker: ts.TypeChecker;
  readonly repositoryRoot: string;
  readonly sourceFile: ts.SourceFile;
}): CanonicalValueDeclarationSourceIndex => {
  const identifiers = identifiersByRange(input.sourceFile);
  const sources = new Map<string, CanonicalValueDeclarationSource>();
  identifiers.forEach((identifier, key) => {
    const source = outOfScopeDeclarationSource({
      checker: input.checker,
      identifier,
      repositoryRoot: input.repositoryRoot,
    });
    if (source !== null) sources.set(key, source);
  });
  return {
    amdDependencySpecifiers: input.sourceFile.amdDependencies.map((dependency) => dependency.path),
    outOfScopeSource: (node) => sources.get(rangeKey(node)) ?? null,
  };
};

const repositoryRootNames = (repositoryRoot: string): readonly string[] => {
  const cached = rootNamesByRepository.get(repositoryRoot);
  if (cached !== undefined) return cached;
  const rootNames = listRepositoryFiles(repositoryRoot).commentSources.map(
    (source) => source.absolutePath,
  );
  rootNamesByRepository.set(repositoryRoot, rootNames);
  return rootNames;
};

const repositoryProgram = (input: {
  readonly repositoryRoot: string;
  readonly searchDirectory: string;
}): RepositoryProgramSnapshot => {
  const configPath = canonicalValuesTypeScriptConfigPath(input);
  const cacheKey = `${input.repositoryRoot}\0${configPath ?? "<default>"}`;
  const cached = programByConfiguration.get(cacheKey);
  if (cached !== undefined) return cached;
  const rootNames = repositoryRootNames(input.repositoryRoot);
  const created = {
    program: createCanonicalValuesTypeScriptProgram({
      repositoryRoot: input.repositoryRoot,
      rootNames,
      searchDirectory: input.searchDirectory,
    }),
    rootNames,
  };
  programByConfiguration.set(cacheKey, created);
  return created;
};

const programForSource = (input: {
  readonly filename: string;
  readonly onDisk: string;
  readonly repositoryRoot: string;
  readonly sourceText: string;
}): ts.Program | null => {
  const searchDirectory = dirname(input.filename);
  const snapshot = repositoryProgram({ repositoryRoot: input.repositoryRoot, searchDirectory });
  if (!snapshot.rootNames.some((rootName) => resolve(rootName) === input.filename)) return null;
  return input.onDisk === input.sourceText
    ? snapshot.program
    : createCanonicalValuesTypeScriptProgram({
        repositoryRoot: input.repositoryRoot,
        rootNames: snapshot.rootNames,
        searchDirectory,
        sourceOverrides: new Map([[input.filename, input.sourceText]]),
      });
};

export const createCanonicalValueDeclarationSourceIndex = (input: {
  readonly filename: string;
  readonly repositoryRoot: string;
  readonly sourceText: string;
}): CanonicalValueDeclarationSourceIndex | null => {
  const repositoryRoot = resolve(input.repositoryRoot);
  const filename = resolve(input.filename);
  if (!pathIsInside(repositoryRoot, filename)) return null;
  const onDisk = readTextFile(filename);
  if (onDisk === null) return null;
  const program = programForSource({ ...input, filename, onDisk, repositoryRoot });
  if (program === null) return null;
  const sourceFile = sourceFileIn(program, filename);
  return sourceFile === null
    ? null
    : declarationSourceIndex({
        checker: program.getTypeChecker(),
        repositoryRoot,
        sourceFile,
      });
};
