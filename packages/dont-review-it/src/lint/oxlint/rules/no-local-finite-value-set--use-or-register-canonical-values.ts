import { createDontReviewItRule } from "../../../create-rule.ts";
import { findWorkspaceRoot } from "../lib/canonical-values/workspace-root.ts";
import { isOutOfScopeLintSource } from "../lib/out-of-scope-source.ts";
import {
  createCanonicalValueBindingIndex,
  type CanonicalValueBindingIndex,
} from "./canonical-value-binding-index.ts";
import { createCanonicalValueBindingVisitor } from "./canonical-value-binding-visitor.ts";
import { createCanonicalValueCollectionMutationSink } from "./canonical-value-collection-mutation-sink.ts";
import { createCanonicalValueDomainResolver } from "./canonical-value-domain.ts";
import { createCanonicalValueInvocationSink } from "./canonical-value-invocation-sink.ts";
import { createCanonicalValueRuntimeState } from "./canonical-value-invocation.ts";
import { withCanonicalValueStaticCallResolver } from "./canonical-value-property-state.ts";
import { createCanonicalValueReporter } from "./canonical-value-report.ts";
import { type CanonicalValueImportedRouteClassifier } from "./canonical-value-route-origin.ts";
import {
  CANONICAL_VALUE_RULE_META,
  CANONICAL_VALUE_RULE_NAME,
} from "./canonical-value-rule-meta.ts";
import { createCanonicalValueStaticCallResolver } from "./canonical-value-static-invocation.ts";
import { createCanonicalValueStaticSink } from "./canonical-value-static-sink.ts";
import { createCanonicalValueTypeOriginIndex } from "./canonical-value-type-origin.ts";

import type { WorkspaceLintRule } from "@mst/lint-rule-authoring";
import type { CanonicalValuesCatalogLoader } from "../lib/canonical-values/catalog-loader.ts";
import type { LibraryVocabularyLoader } from "../lib/library-vocabulary/vocabulary-loader.ts";

const createCanonicalValueRuntime = (bindingIndex: CanonicalValueBindingIndex) => {
  const { invocationState, propertyState: basePropertyState } =
    createCanonicalValueRuntimeState(bindingIndex);
  return {
    invocationState,
    propertyState: withCanonicalValueStaticCallResolver(
      basePropertyState,
      createCanonicalValueStaticCallResolver({
        bindingIndex,
        invocationState,
        propertyState: basePropertyState,
      }),
    ),
  };
};

export const createNoLocalFiniteValueSet = ({
  classifyImportedRoute,
  loadCatalog,
  loadLibraryVocabulary,
}: {
  readonly classifyImportedRoute?: CanonicalValueImportedRouteClassifier;
  readonly loadCatalog: CanonicalValuesCatalogLoader;
  readonly loadLibraryVocabulary: LibraryVocabularyLoader;
}): WorkspaceLintRule =>
  createDontReviewItRule({
    name: CANONICAL_VALUE_RULE_NAME,
    meta: CANONICAL_VALUE_RULE_META,
    create(context) {
      if (isOutOfScopeLintSource(context.filename, findWorkspaceRoot(context.cwd))) return {};
      const bindingIndex = createCanonicalValueBindingIndex(context.sourceCode);
      const { invocationState, propertyState } = createCanonicalValueRuntime(bindingIndex);
      const reporter = createCanonicalValueReporter({
        context,
        loadCatalog,
        loadLibraryVocabulary,
      });
      const domain = createCanonicalValueDomainResolver({
        bindingIndex,
        catalog: reporter.catalog,
        classifyImportedRoute,
        filename: context.filename,
        invocationState,
        propertyState,
        repositoryRoot: reporter.repositoryRoot,
      });
      const staticSink = createCanonicalValueStaticSink({
        bindingIndex,
        domain,
        filename: context.filename,
        invocationState,
        propertyState,
        reporter,
        typeOrigins: createCanonicalValueTypeOriginIndex({
          bindingIndex,
          propertyState,
          sourceCode: context.sourceCode,
        }),
      });
      const invocationSink = createCanonicalValueInvocationSink({
        bindingIndex,
        domain,
        invocationState,
        propertyState,
        reporter,
      });
      const collectionMutationSink = createCanonicalValueCollectionMutationSink({
        bindingIndex,
        domain,
        invocationState,
        propertyState,
        reporter,
      });
      const bindingVisitor = createCanonicalValueBindingVisitor(bindingIndex, {
        afterAssignment(node) {
          collectionMutationSink.recordAssignment(node);
          staticSink.recordAssignment(node);
        },
        afterCall(node) {
          collectionMutationSink.recordCall(node);
          invocationSink.record(node);
          staticSink.recordCall(node);
        },
        afterClassDeclaration: staticSink.recordPropertyDeclaration,
        afterNew: invocationSink.record,
        afterUnary: collectionMutationSink.recordUnary,
        afterUpdate: collectionMutationSink.recordUpdate,
        programExit(node) {
          staticSink.evaluate();
          invocationSink.evaluate(node);
          collectionMutationSink.evaluate(node);
        },
      });
      return {
        ...bindingVisitor,
        ObjectExpression: staticSink.recordObject,
        TSIndexedAccessType: staticSink.recordIndexedAccess,
        TSEnumDeclaration: staticSink.recordPropertyDeclaration,
        TSInterfaceDeclaration: staticSink.recordPropertyDeclaration,
        TSModuleDeclaration(node) {
          if (node.kind !== "global") staticSink.recordPropertyDeclaration(node);
        },
        TSTypeOperator: staticSink.recordPropertyNameType,
        TSTypeAliasDeclaration: staticSink.recordTypeAlias,
      };
    },
  });
