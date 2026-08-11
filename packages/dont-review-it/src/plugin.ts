import { loadCanonicalValuesCatalog } from "./lint/oxlint/lib/canonical-values/builder.ts";
import { loadRepositoryBodyIndex } from "./lint/oxlint/lib/duplicated-bodies/builder.ts";
import { loadLibraryVocabulary } from "./lint/oxlint/lib/library-vocabulary/harvester.ts";
import { loadStyleClassIndex } from "./lint/oxlint/lib/style-classes/builder.ts";
import { forbidNumberedSiblingFile } from "./lint/oxlint/rules/forbid-numbered-sibling-file--name-what-each-file-owns.ts";
import { forbidOversizedFile } from "./lint/oxlint/rules/forbid-oversized-file--split-by-responsibility.ts";
import { noAmbiguousVariableName } from "./lint/oxlint/rules/no-ambiguous-variable-name--rename-to-concrete-noun.ts";
import { noArrayMutation } from "./lint/oxlint/rules/no-array-mutation--derive-new-array.ts";
import { noCittyParentRun } from "./lint/oxlint/rules/no-citty-parent-run--move-run-into-a-subcommand.ts";
import { noDefaultExport } from "./lint/oxlint/rules/no-default-export--use-named-export.ts";
import { noDetachedRationale } from "./lint/oxlint/rules/no-detached-rationale--comment-at-explained-line.ts";
import { noDetachedTestFile } from "./lint/oxlint/rules/no-detached-test-file--move-beside-source.ts";
import { noDiscardedFailure } from "./lint/oxlint/rules/no-discarded-failure--receive-and-surface-it.ts";
import { noDoubleTypeAssertion } from "./lint/oxlint/rules/no-double-type-assertion--declare-the-real-type.ts";
import { createNoDuplicatedBody } from "./lint/oxlint/rules/no-duplicated-body--import-the-existing-declaration.ts";
import { noExplanatoryComment } from "./lint/oxlint/rules/no-explanatory-comment--delete-or-move-to-commit-message.ts";
import { noHandmadeStandardIoDouble } from "./lint/oxlint/rules/no-handmade-standard-io-double--use-standard-io-test.ts";
import { noHardcodedEndpoint } from "./lint/oxlint/rules/no-hardcoded-endpoint--read-from-configuration.ts";
import { noHardcodedProviderId } from "./lint/oxlint/rules/no-hardcoded-provider-id--read-from-configuration.ts";
import { noIdentityWrapper } from "./lint/oxlint/rules/no-identity-wrapper--call-the-target-directly.ts";
import { noLenientCoverageThreshold } from "./lint/oxlint/rules/no-lenient-coverage-threshold--demand-full-coverage.ts";
import { createNoLocalFiniteValueSet } from "./lint/oxlint/rules/no-local-finite-value-set--use-or-register-canonical-values.ts";
import { noLoggedAndContinuedFailure } from "./lint/oxlint/rules/no-logged-and-continued-failure--stop-or-recover.ts";
import { noMultiBindingDeclaration } from "./lint/oxlint/rules/no-multi-binding-declaration--declare-one-binding-per-statement.ts";
import { noPromiseChain } from "./lint/oxlint/rules/no-promise-chain--use-async-await.ts";
import { noReassign } from "./lint/oxlint/rules/no-reassign--use-spread-or-iife.ts";
import { noSingleUseLocalType } from "./lint/oxlint/rules/no-single-use-local-type--inline-at-the-use-site.ts";
import { noStandaloneTsconfig } from "./lint/oxlint/rules/no-standalone-tsconfig--extend-shared-preset.ts";
import { createNoStrictCanonicalLiteralUseRule } from "./lint/oxlint/rules/no-strict-canonical-literal-use--use-canonical-import.ts";
import { noTautologicalAssertion } from "./lint/oxlint/rules/no-tautological-assertion--assert-on-a-computed-value.ts";
import { createNoTwinDeclaration } from "./lint/oxlint/rules/no-twin-declaration--merge-into-one-owner.ts";
import { noUnorderedImport } from "./lint/oxlint/rules/no-unordered-import--group-by-origin-then-sort-by-specifier.ts";
import { createNoUnusedStyleClass } from "./lint/oxlint/rules/no-unused-style-class--delete-or-reference-it.ts";
import { noUnwrappedToolchainConfig } from "./lint/oxlint/rules/no-unwrapped-toolchain-config--wrap-with-git-excludes.ts";
import { requireReExportOnlyFiles } from "./lint/oxlint/rules/require-re-export-only-files--move-declaration-to-owning-module.ts";
import { requireStandardIoSnapshot } from "./lint/oxlint/rules/require-standard-io-snapshot--pin-both-streams.ts";

import type { Plugin } from "@oxlint/plugins";

export const noLocalFiniteValueSet = createNoLocalFiniteValueSet({
  loadCatalog: loadCanonicalValuesCatalog,
  loadLibraryVocabulary,
});

export const noStrictCanonicalLiteralUse = createNoStrictCanonicalLiteralUseRule({
  loadCatalog: loadCanonicalValuesCatalog,
});

export const noDuplicatedBody = createNoDuplicatedBody({ loadIndex: loadRepositoryBodyIndex });

export const noTwinDeclaration = createNoTwinDeclaration({ loadIndex: loadRepositoryBodyIndex });

export const noUnusedStyleClass = createNoUnusedStyleClass({ loadIndex: loadStyleClassIndex });

const plugin: Plugin = {
  meta: { name: "dont-review-it" },
  rules: {
    [forbidNumberedSiblingFile.name]: forbidNumberedSiblingFile,
    [forbidOversizedFile.name]: forbidOversizedFile,
    [noAmbiguousVariableName.name]: noAmbiguousVariableName,
    [noArrayMutation.name]: noArrayMutation,
    [noCittyParentRun.name]: noCittyParentRun,
    [noDefaultExport.name]: noDefaultExport,
    [noDetachedRationale.name]: noDetachedRationale,
    [noDetachedTestFile.name]: noDetachedTestFile,
    [noDiscardedFailure.name]: noDiscardedFailure,
    [noDoubleTypeAssertion.name]: noDoubleTypeAssertion,
    [noDuplicatedBody.name]: noDuplicatedBody,
    [noExplanatoryComment.name]: noExplanatoryComment,
    [noHandmadeStandardIoDouble.name]: noHandmadeStandardIoDouble,
    [noHardcodedEndpoint.name]: noHardcodedEndpoint,
    [noHardcodedProviderId.name]: noHardcodedProviderId,
    [noIdentityWrapper.name]: noIdentityWrapper,
    [noLenientCoverageThreshold.name]: noLenientCoverageThreshold,
    [noLocalFiniteValueSet.name]: noLocalFiniteValueSet,
    [noLoggedAndContinuedFailure.name]: noLoggedAndContinuedFailure,
    [noMultiBindingDeclaration.name]: noMultiBindingDeclaration,
    [noPromiseChain.name]: noPromiseChain,
    [noReassign.name]: noReassign,
    [noSingleUseLocalType.name]: noSingleUseLocalType,
    [noStandaloneTsconfig.name]: noStandaloneTsconfig,
    [noStrictCanonicalLiteralUse.name]: noStrictCanonicalLiteralUse,
    [noTautologicalAssertion.name]: noTautologicalAssertion,
    [noTwinDeclaration.name]: noTwinDeclaration,
    [noUnorderedImport.name]: noUnorderedImport,
    [noUnusedStyleClass.name]: noUnusedStyleClass,
    [noUnwrappedToolchainConfig.name]: noUnwrappedToolchainConfig,
    [requireReExportOnlyFiles.name]: requireReExportOnlyFiles,
    [requireStandardIoSnapshot.name]: requireStandardIoSnapshot,
  },
};

/** @public */
export default plugin;
