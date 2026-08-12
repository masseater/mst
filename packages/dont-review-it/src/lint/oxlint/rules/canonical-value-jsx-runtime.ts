import * as ts from "typescript-6";

import {
  configuredJsxRuntime,
  repositoryModulePath,
} from "../lib/canonical-values/import-route-resolution.ts";

import type { Context, ESTree } from "@oxlint/plugins";

type JsxPragma = { readonly arguments: { readonly factory?: string } };
type JsxSourceFile = ts.SourceFile & {
  readonly pragmas: ReadonlyMap<string, JsxPragma | readonly JsxPragma[]>;
};

const jsxPragma = (sourceFile: JsxSourceFile, name: string): string | null => {
  const pragma = sourceFile.pragmas.get(name);
  if (pragma === undefined) return null;
  const entries: readonly JsxPragma[] = Array.isArray(pragma)
    ? (pragma as readonly JsxPragma[])
    : [pragma as JsxPragma];
  const latest = entries.at(-1);
  return latest?.arguments.factory ?? null;
};

const jsxImportSource = (input: {
  readonly context: Context;
  readonly repositoryRoot: string;
}): { readonly importSource: string; readonly runtime: string } | null => {
  const configured = configuredJsxRuntime({
    filename: input.context.filename,
    repositoryRoot: input.repositoryRoot,
  });
  const sourceFile = ts.createSourceFile(
    input.context.filename,
    input.context.sourceCode.text,
    ts.ScriptTarget.Latest,
    true,
  ) as JsxSourceFile;
  const runtimePragma = jsxPragma(sourceFile, "jsxruntime");
  const runtime =
    runtimePragma === "classic"
      ? null
      : runtimePragma === "automatic"
        ? "jsx-runtime"
        : configured.runtime;
  if (runtime === null) return null;
  const importSource = jsxPragma(sourceFile, "jsximportsource") ?? configured.importSource;
  return importSource === null ? null : { importSource, runtime };
};

export const canonicalValueJsxRuntimeSources = (input: {
  readonly context: Context;
  readonly repositoryRoot: string;
}): readonly string[] => {
  const jsx = jsxImportSource(input);
  if (jsx === null) return [];
  const sourcePath = repositoryModulePath({
    filename: input.context.filename,
    importedName: "<namespace>",
    repositoryRoot: input.repositoryRoot,
    specifier: `${jsx.importSource.replace(/\/$/u, "")}/${jsx.runtime}`,
  });
  return sourcePath === null ? [] : [sourcePath];
};

export type CanonicalValueJsxNode = ESTree.JSXElement | ESTree.JSXFragment;
