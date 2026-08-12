import { dirname, resolve } from "node:path";

import { uniqBy } from "es-toolkit";
import * as ts from "typescript-6";

import { pathIsInside } from "../path-is-inside.ts";

type ProgramInput = {
  readonly repositoryRoot: string;
  readonly rootNames: readonly string[];
  readonly searchDirectory: string;
  readonly sourceOverrides?: ReadonlyMap<string, string>;
};

export const canonicalValuesTypeScriptConfigPath = (
  input: Pick<ProgramInput, "repositoryRoot" | "searchDirectory">,
): string | null =>
  ts.findConfigFile(input.searchDirectory, (candidate) => {
    const absoluteCandidate = resolve(candidate);
    return (
      pathIsInside(input.repositoryRoot, absoluteCandidate) && ts.sys.fileExists(absoluteCandidate)
    );
  }) ?? null;

const diagnosticText = (diagnostic: ts.Diagnostic): string =>
  ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");

const parsedConfigAt = (input: {
  readonly configPath: string;
  readonly repositoryRoot: string;
}): ts.ParsedCommandLine => {
  const source = ts.readJsonConfigFile(input.configPath, (fileName) => ts.sys.readFile(fileName));
  const parsedConfig = ts.parseJsonSourceFileConfigFileContent(
    source,
    ts.sys,
    dirname(input.configPath),
    undefined,
    input.configPath,
  );
  const [firstError] = parsedConfig.errors;
  if (firstError !== undefined) throw new Error(diagnosticText(firstError));
  const externalConfig = source.extendedSourceFiles?.find(
    (fileName) => !pathIsInside(input.repositoryRoot, resolve(fileName)),
  );
  if (externalConfig !== undefined) {
    throw new Error(`TypeScript config extends outside the repository: ${externalConfig}`);
  }
  return parsedConfig;
};

const requiredOptions = (configured: ts.CompilerOptions): ts.CompilerOptions => ({
  ...configured,
  allowImportingTsExtensions: true,
  module: configured.module ?? ts.ModuleKind.NodeNext,
  moduleResolution: configured.moduleResolution ?? ts.ModuleResolutionKind.NodeNext,
  noEmit: true,
  resolveJsonModule: true,
  skipLibCheck: true,
  target: configured.target ?? ts.ScriptTarget.ESNext,
});

const assertCacheBoundedSources = (repositoryRoot: string, program: ts.Program): void => {
  const externalSource = program
    .getSourceFiles()
    .find(
      (sourceFile) =>
        !program.isSourceFileDefaultLibrary(sourceFile) &&
        !pathIsInside(repositoryRoot, resolve(sourceFile.fileName)),
    );
  if (externalSource !== undefined) {
    throw new Error(`TypeScript dependency is outside the repository: ${externalSource.fileName}`);
  }
};

export const createCanonicalValuesTypeScriptProgram = (input: ProgramInput): ts.Program => {
  const configPath = canonicalValuesTypeScriptConfigPath(input);
  const parsedConfig =
    configPath === null
      ? null
      : parsedConfigAt({ configPath, repositoryRoot: input.repositoryRoot });
  const rootNames = uniqBy(
    [...(parsedConfig?.fileNames ?? []), ...input.rootNames].map((fileName) => resolve(fileName)),
    (fileName) => fileName,
  );
  const compilerOptions = requiredOptions(parsedConfig?.options ?? {});
  const baseHost = ts.createCompilerHost(compilerOptions);
  const host: ts.CompilerHost = {
    ...baseHost,
    getSourceFile: (...sourceFileArguments: Parameters<ts.CompilerHost["getSourceFile"]>) => {
      const [fileName, languageVersion] = sourceFileArguments;
      const sourceText = input.sourceOverrides?.get(resolve(fileName));
      if (sourceText === undefined) return baseHost.getSourceFile(...sourceFileArguments);
      const scriptKind = fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
      return ts.createSourceFile(fileName, sourceText, languageVersion, true, scriptKind);
    },
  };
  const program = ts.createProgram({
    host,
    options: compilerOptions,
    projectReferences: parsedConfig?.projectReferences,
    rootNames,
  });
  assertCacheBoundedSources(input.repositoryRoot, program);
  return program;
};
