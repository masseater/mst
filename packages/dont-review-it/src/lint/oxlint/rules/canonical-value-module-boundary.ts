import { isBuiltin } from "node:module";
import { resolve } from "node:path";

import {
  repositoryModulePath,
  repositoryModuleResolutionKind,
  type ImportRouteQuery,
} from "../lib/canonical-values/import-route-resolution.ts";
import {
  viteConfigMayResolveModules,
  viteConfigResolutionIsOpen,
} from "../lib/canonical-values/vite-alias-resolution.ts";
import { loadViteStaticConfig } from "../lib/canonical-values/vite-config-static.ts";
import { resolveViteRepositorySpecifier } from "../lib/canonical-values/vite-repository-resolution.ts";
import { isOutOfScopeBoundarySource } from "../lib/out-of-scope-boundary-source.ts";

import type { ESTree } from "@oxlint/plugins";
import type { CanonicalValueModuleSpecifier } from "./canonical-value-module-specifier.ts";

export type CanonicalValueModuleResolutionMode = NonNullable<ImportRouteQuery["resolutionMode"]>;

export type CanonicalValueModuleBoundaryState = {
  readonly explicitSourcePaths: Set<string>;
  readonly filename: string;
  readonly report: (input: { readonly node: ESTree.Node; readonly sourcePath: string }) => void;
  readonly repositoryRoot: string;
};

const moduleRouteQuery = (input: {
  readonly boundary: CanonicalValueModuleBoundaryState;
  readonly resolutionMode: CanonicalValueModuleResolutionMode;
  readonly specifier: string;
}): ImportRouteQuery => ({
  filename: input.boundary.filename,
  importedName: "<namespace>",
  repositoryRoot: input.boundary.repositoryRoot,
  resolutionMode: input.resolutionMode,
  specifier: input.specifier,
});

const unresolvedViteModule = (input: {
  readonly boundary: CanonicalValueModuleBoundaryState;
  readonly resolutionMode: CanonicalValueModuleResolutionMode;
  readonly specifier: string;
}): boolean => {
  const config = loadViteStaticConfig(input.boundary.repositoryRoot);
  if (config !== null && resolve(config.configPath) === resolve(input.boundary.filename)) {
    return false;
  }
  return (
    !isBuiltin(input.specifier) &&
    !/^https?:/u.test(input.specifier) &&
    (viteConfigResolutionIsOpen(input.boundary.repositoryRoot) ||
      (repositoryModuleResolutionKind(moduleRouteQuery(input)) === "unresolved" &&
        viteConfigMayResolveModules(input.boundary.repositoryRoot)))
  );
};

const reportUnresolvedViteModule = (input: {
  readonly boundary: CanonicalValueModuleBoundaryState;
  readonly resolutionMode: CanonicalValueModuleResolutionMode;
  readonly specifier: CanonicalValueModuleSpecifier;
}): boolean => {
  if (!unresolvedViteModule({ ...input, specifier: input.specifier.value })) return false;
  input.boundary.report({
    node: input.specifier.node,
    sourcePath: `an unresolved Vite module (${input.specifier.value})`,
  });
  return true;
};

export const reportCanonicalValueRepositoryModule = (input: {
  readonly boundary: CanonicalValueModuleBoundaryState;
  readonly sourcePath: string;
  readonly specifier: CanonicalValueModuleSpecifier;
}): boolean => {
  if (!isOutOfScopeBoundarySource(input.sourcePath, input.boundary.repositoryRoot)) return false;
  input.boundary.explicitSourcePaths.add(input.sourcePath);
  input.boundary.report({ node: input.specifier.node, sourcePath: input.sourcePath });
  return true;
};

const inspectModuleSpecifier = (input: {
  readonly boundary: CanonicalValueModuleBoundaryState;
  readonly resolutionMode: CanonicalValueModuleResolutionMode;
  readonly specifier: CanonicalValueModuleSpecifier;
}): boolean => {
  if (input.specifier.value.startsWith("data:")) {
    input.boundary.report({ node: input.specifier.node, sourcePath: "a data: URL" });
    return true;
  }
  const lexicalSourcePath = resolveViteRepositorySpecifier({
    containingFile: resolve(input.boundary.repositoryRoot, input.boundary.filename),
    repositoryRoot: input.boundary.repositoryRoot,
    specifier: input.specifier.value,
  });
  if (
    lexicalSourcePath !== null &&
    reportCanonicalValueRepositoryModule({ ...input, sourcePath: lexicalSourcePath })
  ) {
    return true;
  }
  const sourcePath = repositoryModulePath(
    moduleRouteQuery({ ...input, specifier: input.specifier.value }),
  );
  if (sourcePath !== null && reportCanonicalValueRepositoryModule({ ...input, sourcePath })) {
    return true;
  }
  return reportUnresolvedViteModule(input);
};

export const inspectCanonicalValueModuleSpecifiers = (input: {
  readonly boundary: CanonicalValueModuleBoundaryState;
  readonly resolutionMode: CanonicalValueModuleResolutionMode;
  readonly specifiers: readonly CanonicalValueModuleSpecifier[];
}): boolean => {
  for (const specifier of input.specifiers) {
    if (inspectModuleSpecifier({ ...input, specifier })) return true;
  }
  return false;
};
