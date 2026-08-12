import { resolve } from "node:path";

import {
  IMPORT_MODULE_RESOLUTION_MODE,
  REQUIRE_MODULE_RESOLUTION_MODE,
} from "../lib/canonical-values/import-route-resolution.ts";
import { viteConfigPublicDirectoryIsOpen } from "../lib/canonical-values/vite-alias-resolution.ts";
import { resolveViteBuildEntries } from "../lib/canonical-values/vite-build-entry-resolution.ts";
import { resolveVitePublicSpecifier } from "../lib/canonical-values/vite-repository-resolution.ts";
import { isOutOfScopeBoundarySource } from "../lib/out-of-scope-boundary-source.ts";
import {
  createCanonicalValueDeclarationSourceIndex,
  type CanonicalValueDeclarationSourceIndex,
  type CanonicalValueIdentifier,
} from "./canonical-value-declaration-source.ts";
import {
  canonicalValueJsxRuntimeSources,
  type CanonicalValueJsxNode,
} from "./canonical-value-jsx-runtime.ts";
import {
  inspectCanonicalValueModuleSpecifiers,
  reportCanonicalValueRepositoryModule,
  type CanonicalValueModuleBoundaryState,
  type CanonicalValueModuleResolutionMode,
} from "./canonical-value-module-boundary.ts";
import {
  canonicalValueBrowserModuleConsumerOrigins,
  canonicalValueModuleConsumerOrigins,
} from "./canonical-value-module-consumer.ts";
import { canonicalValueModuleLoaderArguments } from "./canonical-value-module-loader.ts";
import {
  canonicalValueModuleSpecifiers,
  type CanonicalValueModuleSpecifier,
} from "./canonical-value-module-specifier.ts";
import { canonicalValueViteGlobSourcePaths } from "./canonical-value-vite-glob.ts";

import type { Context, ESTree, Visitor } from "@oxlint/plugins";
import type { CanonicalValueBindingIndex } from "./canonical-value-binding-index.ts";
import type { CanonicalValueInvocationState } from "./canonical-value-invocation.ts";
import type { CanonicalValueOrigin } from "./canonical-value-property-origin.ts";
import type { CanonicalValuePropertyState } from "./canonical-value-property-state.ts";

export type CanonicalValueOutOfScopeImportSink = {
  readonly evaluate: () => void;
  readonly recordCall: (node: ESTree.CallExpression) => void;
  readonly recordNew: (node: ESTree.NewExpression) => void;
  readonly visitor: Visitor;
};

type CanonicalValueOutOfScopeInspection = {
  readonly bindingIndex: CanonicalValueBindingIndex;
  readonly context: Context;
  readonly invocationState: CanonicalValueInvocationState;
  readonly propertyState: CanonicalValuePropertyState;
  readonly repositoryRootOf: () => string;
  readonly report: (input: { readonly node: ESTree.Node; readonly sourcePath: string }) => void;
};

type CanonicalValueOutOfScopeState = {
  readonly declarationSourceIndex: CanonicalValueDeclarationSourceIndex | null;
  readonly explicitSourcePaths: Set<string>;
  readonly expressions: Map<ESTree.Expression, CanonicalValueModuleResolutionMode>;
  readonly identifiers: Set<CanonicalValueIdentifier>;
  readonly inspection: CanonicalValueOutOfScopeInspection;
  readonly invocations: Set<ESTree.CallExpression | ESTree.NewExpression>;
  readonly jsxNodes: Set<CanonicalValueJsxNode>;
};

const MODULE_SYNTAX_NODE_TYPES: ReadonlySet<ESTree.Node["type"]> = new Set([
  "ExportAllDeclaration",
  "ImportDeclaration",
  "TSExternalModuleReference",
  "TSImportEqualsDeclaration",
  "TSImportType",
]);

const nodeIsModuleSyntax = (node: ESTree.Node | null): boolean =>
  node !== null &&
  node.type !== "Program" &&
  ((node.type === "ExportNamedDeclaration" && node.source !== null) ||
    MODULE_SYNTAX_NODE_TYPES.has(node.type) ||
    nodeIsModuleSyntax(node.parent));

const moduleBoundaryState = (
  state: CanonicalValueOutOfScopeState,
): CanonicalValueModuleBoundaryState => ({
  explicitSourcePaths: state.explicitSourcePaths,
  filename: state.inspection.context.filename,
  report: state.inspection.report,
  repositoryRoot: state.inspection.repositoryRootOf(),
});

const inspectModuleSpecifiers = (
  state: CanonicalValueOutOfScopeState,
  input: {
    readonly resolutionMode: CanonicalValueModuleResolutionMode;
    readonly specifiers: readonly CanonicalValueModuleSpecifier[];
  },
): boolean =>
  inspectCanonicalValueModuleSpecifiers({ boundary: moduleBoundaryState(state), ...input });

const moduleSpecifiersFor = (
  state: CanonicalValueOutOfScopeState,
  expression: ESTree.Expression,
): readonly CanonicalValueModuleSpecifier[] =>
  canonicalValueModuleSpecifiers(
    {
      bindingIndex: state.inspection.bindingIndex,
      context: state.inspection.context,
      invocationState: state.inspection.invocationState,
      propertyState: state.inspection.propertyState,
    },
    expression,
  );

const inspectModuleExpression = (
  state: CanonicalValueOutOfScopeState,
  input: {
    readonly expression: ESTree.Expression;
    readonly resolutionMode: CanonicalValueModuleResolutionMode;
  },
): boolean => {
  const specifiers = moduleSpecifiersFor(state, input.expression);
  if (specifiers.length !== 0) {
    return inspectModuleSpecifiers(state, { resolutionMode: input.resolutionMode, specifiers });
  }
  state.inspection.report({
    node: input.expression,
    sourcePath: "an unresolved module specifier",
  });
  return true;
};

const inspectModuleInvocation = (
  state: CanonicalValueOutOfScopeState,
  invocation: ESTree.CallExpression | ESTree.NewExpression,
): void => {
  const argumentsToInspect = canonicalValueModuleLoaderArguments({
    context: state.inspection.context,
    invocation,
    propertyState: state.inspection.propertyState,
  });
  for (const argument of argumentsToInspect) {
    if (
      inspectModuleExpression(state, {
        expression: argument,
        resolutionMode: REQUIRE_MODULE_RESOLUTION_MODE,
      })
    ) {
      return;
    }
  }
};

const specifiersFromOrigins = (
  state: CanonicalValueOutOfScopeState,
  origins: readonly CanonicalValueOrigin[],
): readonly CanonicalValueModuleSpecifier[] =>
  origins.flatMap((origin) =>
    origin.kind === "absent" ? [] : moduleSpecifiersFor(state, origin.expression),
  );

const inspectBrowserPublicSpecifier = (input: {
  readonly publicDirectoryIsOpen: boolean;
  readonly repositoryRoot: string;
  readonly specifier: CanonicalValueModuleSpecifier;
  readonly state: CanonicalValueOutOfScopeState;
}): { readonly regular: boolean; readonly reported: boolean } => {
  if (!input.specifier.value.startsWith("/")) return { regular: true, reported: false };
  const sourcePath = resolveVitePublicSpecifier({
    repositoryRoot: input.repositoryRoot,
    specifier: input.specifier.value,
  });
  if (sourcePath !== null) {
    return {
      regular: false,
      reported: reportCanonicalValueRepositoryModule({
        boundary: moduleBoundaryState(input.state),
        sourcePath,
        specifier: input.specifier,
      }),
    };
  }
  if (!input.publicDirectoryIsOpen) return { regular: true, reported: false };
  input.state.inspection.report({
    node: input.specifier.node,
    sourcePath: `an unresolved Vite public module (${input.specifier.value})`,
  });
  return { regular: false, reported: true };
};

const inspectBrowserPublicSpecifiers = (input: {
  readonly index: number;
  readonly regular: readonly CanonicalValueModuleSpecifier[];
  readonly specifiers: readonly CanonicalValueModuleSpecifier[];
  readonly state: CanonicalValueOutOfScopeState;
}): readonly CanonicalValueModuleSpecifier[] | null => {
  const specifier = input.specifiers[input.index];
  if (specifier === undefined) return input.regular;
  const repositoryRoot = input.state.inspection.repositoryRootOf();
  const publicSpecifierInspection = inspectBrowserPublicSpecifier({
    publicDirectoryIsOpen: viteConfigPublicDirectoryIsOpen(repositoryRoot),
    repositoryRoot,
    specifier,
    state: input.state,
  });
  if (publicSpecifierInspection.reported) return null;
  return inspectBrowserPublicSpecifiers({
    ...input,
    index: input.index + 1,
    regular: publicSpecifierInspection.regular ? [...input.regular, specifier] : input.regular,
  });
};

const reportUnknownModuleOrigin = (
  state: CanonicalValueOutOfScopeState,
  origins: readonly CanonicalValueOrigin[],
): boolean => {
  const unknownOrigin = origins.find(
    (origin) =>
      origin.kind !== "absent" && moduleSpecifiersFor(state, origin.expression).length === 0,
  );
  if (unknownOrigin === undefined || unknownOrigin.kind === "absent") return false;
  state.inspection.report({
    node: unknownOrigin.expression,
    sourcePath: "an unresolved module specifier",
  });
  return true;
};

const inspectModuleConsumerInvocation = (
  state: CanonicalValueOutOfScopeState,
  invocation: ESTree.CallExpression | ESTree.NewExpression,
): void => {
  const browserOrigins = canonicalValueBrowserModuleConsumerOrigins({
    bindingIndex: state.inspection.bindingIndex,
    invocation,
    invocationState: state.inspection.invocationState,
    propertyState: state.inspection.propertyState,
  });
  const origins = canonicalValueModuleConsumerOrigins({
    bindingIndex: state.inspection.bindingIndex,
    invocation,
    invocationState: state.inspection.invocationState,
    propertyState: state.inspection.propertyState,
  });
  if (reportUnknownModuleOrigin(state, origins)) return;
  const browserExpressions = new Set(
    browserOrigins.flatMap((origin) => (origin.kind === "absent" ? [] : [origin.expression])),
  );
  const otherOrigins = origins.filter(
    (origin) => origin.kind === "absent" || !browserExpressions.has(origin.expression),
  );
  const publicSpecifiers = inspectBrowserPublicSpecifiers({
    index: 0,
    regular: [],
    specifiers: specifiersFromOrigins(state, browserOrigins),
    state,
  });
  if (publicSpecifiers === null) return;
  inspectModuleSpecifiers(state, {
    resolutionMode: IMPORT_MODULE_RESOLUTION_MODE,
    specifiers: [...publicSpecifiers, ...specifiersFromOrigins(state, otherOrigins)],
  });
};

const inspectViteGlobInvocation = (
  state: CanonicalValueOutOfScopeState,
  invocation: ESTree.CallExpression | ESTree.NewExpression,
): void => {
  if (invocation.type !== "CallExpression") return;
  const sources = canonicalValueViteGlobSourcePaths(
    {
      bindingIndex: state.inspection.bindingIndex,
      context: state.inspection.context,
      invocationState: state.inspection.invocationState,
      propertyState: state.inspection.propertyState,
      repositoryRoot: state.inspection.repositoryRootOf(),
    },
    invocation,
  );
  const outOfScopeSource = sources.find((sourcePath) =>
    isOutOfScopeBoundarySource(sourcePath, state.inspection.repositoryRootOf()),
  );
  if (outOfScopeSource === undefined) return;
  state.explicitSourcePaths.add(outOfScopeSource);
  state.inspection.report({ node: invocation, sourcePath: outOfScopeSource });
};

const inspectDeclarationSources = (state: CanonicalValueOutOfScopeState): void => {
  const index = state.declarationSourceIndex;
  if (index === null) return;
  inspectModuleSpecifiers(state, {
    resolutionMode: REQUIRE_MODULE_RESOLUTION_MODE,
    specifiers: index.amdDependencySpecifiers.map((value) => ({
      node: state.inspection.context.sourceCode.ast,
      value,
    })),
  });
  for (const identifier of state.identifiers) {
    const source = index.outOfScopeSource(identifier);
    if (source === null || state.explicitSourcePaths.has(source.absolutePath)) continue;
    state.inspection.report({ node: identifier, sourcePath: source.sourcePath });
  }
};

const inspectJsxRuntime = (state: CanonicalValueOutOfScopeState): void => {
  const node = state.jsxNodes.values().next().value;
  if (node === undefined) return;
  const repositoryRoot = state.inspection.repositoryRootOf();
  const sourcePath = canonicalValueJsxRuntimeSources({
    context: state.inspection.context,
    repositoryRoot,
  }).find((candidate) => isOutOfScopeBoundarySource(candidate, repositoryRoot));
  if (sourcePath !== undefined) state.inspection.report({ node, sourcePath });
};

const inspectViteBuildEntries = (state: CanonicalValueOutOfScopeState): void => {
  const repositoryRoot = state.inspection.repositoryRootOf();
  const entries = resolveViteBuildEntries(repositoryRoot);
  if (
    entries === null ||
    resolve(entries.configPath) !== resolve(state.inspection.context.filename)
  ) {
    return;
  }
  for (const sourcePath of entries.sourcePaths) {
    if (!isOutOfScopeBoundarySource(sourcePath, repositoryRoot)) continue;
    state.explicitSourcePaths.add(sourcePath);
    state.inspection.report({
      node: state.inspection.context.sourceCode.ast,
      sourcePath,
    });
  }
  if (entries.open) {
    state.inspection.report({
      node: state.inspection.context.sourceCode.ast,
      sourcePath: "an unresolved Vite build entry",
    });
  }
};

const evaluateOutOfScopeSources = (state: CanonicalValueOutOfScopeState): void => {
  for (const [expression, resolutionMode] of state.expressions) {
    inspectModuleExpression(state, { expression, resolutionMode });
  }
  for (const invocation of state.invocations) {
    inspectModuleInvocation(state, invocation);
    inspectModuleConsumerInvocation(state, invocation);
    inspectViteGlobInvocation(state, invocation);
  }
  inspectDeclarationSources(state);
  inspectJsxRuntime(state);
  inspectViteBuildEntries(state);
};

export const createCanonicalValueOutOfScopeImportSink = (
  inspection: CanonicalValueOutOfScopeInspection,
): CanonicalValueOutOfScopeImportSink => {
  const state: CanonicalValueOutOfScopeState = {
    declarationSourceIndex: createCanonicalValueDeclarationSourceIndex({
      filename: inspection.context.filename,
      repositoryRoot: inspection.repositoryRootOf(),
      sourceText: inspection.context.sourceCode.text,
    }),
    explicitSourcePaths: new Set(),
    expressions: new Map(),
    identifiers: new Set(),
    inspection,
    invocations: new Set(),
    jsxNodes: new Set(),
  };
  const recordSource = (
    source: ESTree.Expression | null,
    resolutionMode: CanonicalValueModuleResolutionMode,
  ): void => {
    if (source !== null) state.expressions.set(source, resolutionMode);
  };
  return {
    evaluate: () => {
      evaluateOutOfScopeSources(state);
    },
    recordCall: (node) => {
      state.invocations.add(node);
    },
    recordNew: (node) => {
      state.invocations.add(node);
    },
    visitor: {
      ExportAllDeclaration: (node: ESTree.ExportAllDeclaration) => {
        recordSource(node.source, IMPORT_MODULE_RESOLUTION_MODE);
      },
      ExportNamedDeclaration: (node: ESTree.ExportNamedDeclaration) => {
        recordSource(node.source, IMPORT_MODULE_RESOLUTION_MODE);
      },
      ImportDeclaration: (node: ESTree.ImportDeclaration) => {
        recordSource(node.source, IMPORT_MODULE_RESOLUTION_MODE);
      },
      ImportExpression: (node: ESTree.ImportExpression) => {
        recordSource(node.source, IMPORT_MODULE_RESOLUTION_MODE);
      },
      Identifier: (node) => {
        if (!nodeIsModuleSyntax(node.parent)) state.identifiers.add(node);
      },
      JSXElement: (node) => {
        state.jsxNodes.add(node);
      },
      JSXFragment: (node) => {
        state.jsxNodes.add(node);
      },
      TSExternalModuleReference: (node: ESTree.TSExternalModuleReference) => {
        recordSource(node.expression, REQUIRE_MODULE_RESOLUTION_MODE);
      },
      TSImportType: (node: ESTree.TSImportType) => {
        recordSource(node.source, IMPORT_MODULE_RESOLUTION_MODE);
      },
    },
  };
};
