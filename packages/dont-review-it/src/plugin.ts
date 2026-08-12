import { loadCanonicalValuesCatalog } from "./lint/oxlint/lib/canonical-values/loaded-catalog.ts";
import { loadWorkspaceDependencies } from "./lint/oxlint/lib/dependency-catalog/workspace-manifests.ts";
import { loadRepositoryBodyIndex } from "./lint/oxlint/lib/duplicated-bodies/builder.ts";
import { loadLibraryVocabulary } from "./lint/oxlint/lib/library-vocabulary/harvester.ts";
import { loadRepositoryCellClassIndex } from "./lint/oxlint/lib/mutable-cell-classes/builder.ts";
import { loadRepositoryTypeAuthorityIndex } from "./lint/oxlint/lib/split-type-authority/builder.ts";
import { loadRepositoryValueDeclarationIndex } from "./lint/oxlint/lib/value-declarations/builder.ts";
import { forbidDeclaredCommandInvocation } from "./lint/oxlint/rules/forbid-declared-command-invocation--use-designated-replacement.ts";
import { forbidExpectlessIt } from "./lint/oxlint/rules/forbid-expectless-it--assert-or-delete-it.ts";
import { forbidGenericRestrictionRule } from "./lint/oxlint/rules/forbid-generic-restriction-rule--use-the-declared-rule.ts";
import { forbidItExtend } from "./lint/oxlint/rules/forbid-it-extend--use-test-extend.ts";
import { forbidMultiExpectIt } from "./lint/oxlint/rules/forbid-multi-expect-it--split-into-separate-it.ts";
import { forbidNumberedSiblingFile } from "./lint/oxlint/rules/forbid-numbered-sibling-file--name-what-each-file-owns.ts";
import { forbidOversizedFile } from "./lint/oxlint/rules/forbid-oversized-file--split-by-responsibility.ts";
import { forbidRestrictedTargetRelay } from "./lint/oxlint/rules/forbid-restricted-target-relay--delete-the-relay.ts";
import { forbidTestHook } from "./lint/oxlint/rules/forbid-test-hook--move-setup-into-fixture.ts";
import { forbidTrackedPath } from "./lint/oxlint/rules/forbid-tracked-path--untrack-and-ignore.ts";
import { forbidUnresolvableModuleSpecifier } from "./lint/oxlint/rules/forbid-unresolvable-module-specifier--write-a-statically-resolvable-specifier.ts";
import { forbidWeakMatcher } from "./lint/oxlint/rules/forbid-weak-matcher--use-exact-matcher.ts";
import { noAmbiguousVariableName } from "./lint/oxlint/rules/no-ambiguous-variable-name--rename-to-concrete-noun.ts";
import { noArrayMutation } from "./lint/oxlint/rules/no-array-mutation--derive-new-array.ts";
import { noBlanketSuppression } from "./lint/oxlint/rules/no-blanket-suppression--name-and-record.ts";
import { createNoClassAsMutableCell } from "./lint/oxlint/rules/no-class-as-mutable-cell--decide-in-an-iife.ts";
import { noComputedTestApiMember } from "./lint/oxlint/rules/no-computed-test-api-member--use-static-member.ts";
import { noCrossSpecAssetsImport } from "./lint/oxlint/rules/no-cross-spec-assets-import--use-own-assets.ts";
import { noDefaultExport } from "./lint/oxlint/rules/no-default-export--use-named-export.ts";
import { noDetachedRationale } from "./lint/oxlint/rules/no-detached-rationale--comment-at-explained-line.ts";
import { noDetachedTestFile } from "./lint/oxlint/rules/no-detached-test-file--move-beside-source.ts";
import { noDiscardedFailure } from "./lint/oxlint/rules/no-discarded-failure--receive-and-surface-it.ts";
import { noDoubleTypeAssertion } from "./lint/oxlint/rules/no-double-type-assertion--declare-the-real-type.ts";
import { noDryTestSetup } from "./lint/oxlint/rules/no-dry-test-setup--inline-owned-setup.ts";
import { createNoDuplicateValueDeclaration } from "./lint/oxlint/rules/no-duplicate-value-declaration--reuse-authoritative-value.ts";
import { createNoDuplicatedBody } from "./lint/oxlint/rules/no-duplicated-body--import-the-existing-declaration.ts";
import { noEmptyCatch } from "./lint/oxlint/rules/no-empty-catch--throw-or-handle.ts";
import { noExpectCallExpression } from "./lint/oxlint/rules/no-expect-call-expression--yield-from-fixture.ts";
import { noExpectForbiddenSubjectName } from "./lint/oxlint/rules/no-expect-forbidden-subject-name--rename-to-concrete-subject.ts";
import { noExpectMemberSubject } from "./lint/oxlint/rules/no-expect-member-subject--yield-subject-from-fixture.ts";
import { noExpectMirroredSubject } from "./lint/oxlint/rules/no-expect-mirrored-subject--assert-observable-contract.ts";
import { noExpectMockCallInspection } from "./lint/oxlint/rules/no-expect-mock-call-inspection--use-to-have-been-called-family.ts";
import { noExpectOutsideIt } from "./lint/oxlint/rules/no-expect-outside-it--move-into-it-block.ts";
import { noExpectProjectedSubject } from "./lint/oxlint/rules/no-expect-projected-subject--use-tostrictequal-on-subject.ts";
import { noExpectSyntheticSubject } from "./lint/oxlint/rules/no-expect-synthetic-subject--yield-from-fixture.ts";
import { noExplanatoryComment } from "./lint/oxlint/rules/no-explanatory-comment--delete-or-move-to-commit-message.ts";
import { noFixtureConstructInUse } from "./lint/oxlint/rules/no-fixture-construct-in-use--yield-sut-output.ts";
import { noFixtureCopySubject } from "./lint/oxlint/rules/no-fixture-copy-subject--yield-sut-output.ts";
import { noFixtureFactoryFunction } from "./lint/oxlint/rules/no-fixture-factory-function--inline-owned-setup.ts";
import { noFixtureForwardSubject } from "./lint/oxlint/rules/no-fixture-forward-subject--yield-sut-output.ts";
import { noFixtureOrderingAlias } from "./lint/oxlint/rules/no-fixture-ordering-alias--use-auto-action-fixture.ts";
import { noFloatingPromise } from "./lint/oxlint/rules/no-floating-promise--await-the-result.ts";
import { noHardcodedEndpoint } from "./lint/oxlint/rules/no-hardcoded-endpoint--read-from-configuration.ts";
import { noHardcodedProviderId } from "./lint/oxlint/rules/no-hardcoded-provider-id--read-from-configuration.ts";
import { noIdentityWrapper } from "./lint/oxlint/rules/no-identity-wrapper--call-the-target-directly.ts";
import { noInlineSuppressionOfProtectedRule } from "./lint/oxlint/rules/no-inline-suppression-of-protected-rule--register-the-exception-in-configuration.ts";
import { noLenientCoverageThreshold } from "./lint/oxlint/rules/no-lenient-coverage-threshold--demand-full-coverage.ts";
import { noLintSuppressionInSpec } from "./lint/oxlint/rules/no-lint-suppression-in-spec--fix-the-violation.ts";
import { noLocalFileSystemMock } from "./lint/oxlint/rules/no-local-file-system-mock--use-shared-fs.ts";
import { createNoLocalFiniteValueSet } from "./lint/oxlint/rules/no-local-finite-value-set--use-or-register-canonical-values.ts";
import { noLoggedAndContinuedFailure } from "./lint/oxlint/rules/no-logged-and-continued-failure--stop-or-recover.ts";
import { noMixedPackageSurface } from "./lint/oxlint/rules/no-mixed-package-surface--declare-one-surface.ts";
import { noModuleScopeMockConfig } from "./lint/oxlint/rules/no-module-scope-mock-config--lift-into-fixture.ts";
import { noModuleScopeMutableState } from "./lint/oxlint/rules/no-module-scope-mutable-state--lift-into-fixture.ts";
import { noMultiBindingDeclaration } from "./lint/oxlint/rules/no-multi-binding-declaration--declare-one-binding-per-statement.ts";
import { noNormalizeSutOutput } from "./lint/oxlint/rules/no-normalize-sut-output--assert-natural-shape.ts";
import { noPartialRuleSet } from "./lint/oxlint/rules/no-partial-rule-set--enable-the-whole-set.ts";
import { noPromiseChain } from "./lint/oxlint/rules/no-promise-chain--use-async-await.ts";
import { noReassign } from "./lint/oxlint/rules/no-reassign--use-spread-or-iife.ts";
import { noReceiverMutation } from "./lint/oxlint/rules/no-receiver-mutation--derive-new-value.ts";
import { noRedundantMockReset } from "./lint/oxlint/rules/no-redundant-mock-reset--lift-mocks-into-fixture.ts";
import { noRuleSuppression } from "./lint/oxlint/rules/no-rule-suppression--fix-the-violation.ts";
import { noSilentCatch } from "./lint/oxlint/rules/no-silent-catch--rethrow-or-handle.ts";
import { noSilentSuppression } from "./lint/oxlint/rules/no-silent-suppression--fix-or-justify-inline.ts";
import { noSingleUseLocalType } from "./lint/oxlint/rules/no-single-use-local-type--inline-at-the-use-site.ts";
import { noSpecFileHelperFunction } from "./lint/oxlint/rules/no-spec-file-helper-function--inline-or-use-fixture.ts";
import { noSpecSpecificSharedSetup } from "./lint/oxlint/rules/no-spec-specific-shared-setup--keep-setup-uniform.ts";
import { createNoSplitTypeAuthority } from "./lint/oxlint/rules/no-split-type-authority--rename-or-unify.ts";
import { noStandaloneTsconfig } from "./lint/oxlint/rules/no-standalone-tsconfig--extend-shared-preset.ts";
import { createNoStrictCanonicalLiteralUseRule } from "./lint/oxlint/rules/no-strict-canonical-literal-use--use-canonical-import.ts";
import { noSutIndependentAssertion } from "./lint/oxlint/rules/no-sut-independent-assertion--assert-fixture-subject.ts";
import { noTautologicalAssertion } from "./lint/oxlint/rules/no-tautological-assertion--assert-on-a-computed-value.ts";
import { noTestContextEscape } from "./lint/oxlint/rules/no-test-context-escape--destructure-fixtures-by-name.ts";
import { createNoTwinDeclaration } from "./lint/oxlint/rules/no-twin-declaration--merge-into-one-owner.ts";
import { noUncheckedAuthoredPath } from "./lint/oxlint/rules/no-unchecked-authored-path--include-it-in-every-declared-check.ts";
import { noUncheckedCast } from "./lint/oxlint/rules/no-unchecked-cast--parse-at-boundary.ts";
import { noUndersizedExternalSnapshot } from "./lint/oxlint/rules/no-undersized-external-snapshot--use-inline-snapshot.ts";
import { noUnorderedImport } from "./lint/oxlint/rules/no-unordered-import--group-by-origin-then-sort-by-specifier.ts";
import { noUnwrappedToolchainConfig } from "./lint/oxlint/rules/no-unwrapped-toolchain-config--wrap-with-git-excludes.ts";
import { noVacuousHostObjectEquality } from "./lint/oxlint/rules/no-vacuous-host-object-equality--assert-parsed-value.ts";
import { noViMockFactoryBehavior } from "./lint/oxlint/rules/no-vi-mock-factory-behavior--use-spy-true-and-fixture.ts";
import { noVitestContextExpect } from "./lint/oxlint/rules/no-vitest-context-expect--import-expect-from-vitest.ts";
import { createRequireCatalogEntry } from "./lint/oxlint/rules/require-catalog-entry--register-shared-dependency.ts";
import { requireItOnlyExpect } from "./lint/oxlint/rules/require-it-only-expect--move-setup-into-fixture.ts";
import { requireMockTypeParameter } from "./lint/oxlint/rules/require-mock-type-parameter--annotate-vi-fn.ts";
import { requireReExportOnlyFiles } from "./lint/oxlint/rules/require-re-export-only-files--move-declaration-to-owning-module.ts";
import { requireRegisteredFile } from "./lint/oxlint/rules/require-registered-file--restore-it-at-the-registered-path.ts";
import { requireSpecFileForAssets } from "./lint/oxlint/rules/require-spec-file-for-assets--create-matching-spec.ts";
import { requireSpecLintCoverage } from "./lint/oxlint/rules/require-spec-lint-coverage--lint-every-spec-file.ts";
import { requireSpecOrAssetsOnlyInSpecDirectory } from "./lint/oxlint/rules/require-spec-or-assets-only-in-spec-directory--move-out-or-inline.ts";
import { requireTestAssetsConstants } from "./lint/oxlint/rules/require-test-assets-constants--move-setup-to-spec.ts";
import { requireTestBlockForSpecFile } from "./lint/oxlint/rules/require-test-block-for-spec-file--add-test-or-delete-file.ts";
import { requireTestBlockSpelling } from "./lint/oxlint/rules/require-test-block-spelling--use-configured-fn.ts";
import { requireVitestExtendBuilder } from "./lint/oxlint/rules/require-vitest-extend-builder--infer-fixture-type.ts";

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

export const noClassAsMutableCell = createNoClassAsMutableCell({
  loadIndex: loadRepositoryCellClassIndex,
});

export const noDuplicateValueDeclaration = createNoDuplicateValueDeclaration({
  loadIndex: loadRepositoryValueDeclarationIndex,
});

export const noSplitTypeAuthority = createNoSplitTypeAuthority({
  loadIndex: loadRepositoryTypeAuthorityIndex,
});

export const requireCatalogEntry = createRequireCatalogEntry({
  loadWorkspaces: loadWorkspaceDependencies,
});

const plugin: Plugin = {
  meta: { name: "dont-review-it" },
  rules: {
    [forbidDeclaredCommandInvocation.name]: forbidDeclaredCommandInvocation,
    [forbidExpectlessIt.name]: forbidExpectlessIt,
    [forbidGenericRestrictionRule.name]: forbidGenericRestrictionRule,
    [forbidItExtend.name]: forbidItExtend,
    [forbidMultiExpectIt.name]: forbidMultiExpectIt,
    [forbidNumberedSiblingFile.name]: forbidNumberedSiblingFile,
    [forbidOversizedFile.name]: forbidOversizedFile,
    [forbidRestrictedTargetRelay.name]: forbidRestrictedTargetRelay,
    [forbidTestHook.name]: forbidTestHook,
    [forbidTrackedPath.name]: forbidTrackedPath,
    [forbidUnresolvableModuleSpecifier.name]: forbidUnresolvableModuleSpecifier,
    [forbidWeakMatcher.name]: forbidWeakMatcher,
    [noAmbiguousVariableName.name]: noAmbiguousVariableName,
    [noArrayMutation.name]: noArrayMutation,
    [noBlanketSuppression.name]: noBlanketSuppression,
    [noClassAsMutableCell.name]: noClassAsMutableCell,
    [noComputedTestApiMember.name]: noComputedTestApiMember,
    [noCrossSpecAssetsImport.name]: noCrossSpecAssetsImport,
    [noDefaultExport.name]: noDefaultExport,
    [noDetachedRationale.name]: noDetachedRationale,
    [noDetachedTestFile.name]: noDetachedTestFile,
    [noDiscardedFailure.name]: noDiscardedFailure,
    [noDoubleTypeAssertion.name]: noDoubleTypeAssertion,
    [noDryTestSetup.name]: noDryTestSetup,
    [noDuplicateValueDeclaration.name]: noDuplicateValueDeclaration,
    [noDuplicatedBody.name]: noDuplicatedBody,
    [noEmptyCatch.name]: noEmptyCatch,
    [noExpectCallExpression.name]: noExpectCallExpression,
    [noExpectForbiddenSubjectName.name]: noExpectForbiddenSubjectName,
    [noExpectMemberSubject.name]: noExpectMemberSubject,
    [noExpectMirroredSubject.name]: noExpectMirroredSubject,
    [noExpectMockCallInspection.name]: noExpectMockCallInspection,
    [noExpectOutsideIt.name]: noExpectOutsideIt,
    [noExpectProjectedSubject.name]: noExpectProjectedSubject,
    [noExpectSyntheticSubject.name]: noExpectSyntheticSubject,
    [noExplanatoryComment.name]: noExplanatoryComment,
    [noFixtureConstructInUse.name]: noFixtureConstructInUse,
    [noFixtureCopySubject.name]: noFixtureCopySubject,
    [noFixtureFactoryFunction.name]: noFixtureFactoryFunction,
    [noFixtureForwardSubject.name]: noFixtureForwardSubject,
    [noFixtureOrderingAlias.name]: noFixtureOrderingAlias,
    [noFloatingPromise.name]: noFloatingPromise,
    [noHardcodedEndpoint.name]: noHardcodedEndpoint,
    [noHardcodedProviderId.name]: noHardcodedProviderId,
    [noIdentityWrapper.name]: noIdentityWrapper,
    [noInlineSuppressionOfProtectedRule.name]: noInlineSuppressionOfProtectedRule,
    [noLenientCoverageThreshold.name]: noLenientCoverageThreshold,
    [noLintSuppressionInSpec.name]: noLintSuppressionInSpec,
    [noLocalFileSystemMock.name]: noLocalFileSystemMock,
    [noLocalFiniteValueSet.name]: noLocalFiniteValueSet,
    [noLoggedAndContinuedFailure.name]: noLoggedAndContinuedFailure,
    [noMixedPackageSurface.name]: noMixedPackageSurface,
    [noModuleScopeMockConfig.name]: noModuleScopeMockConfig,
    [noModuleScopeMutableState.name]: noModuleScopeMutableState,
    [noMultiBindingDeclaration.name]: noMultiBindingDeclaration,
    [noNormalizeSutOutput.name]: noNormalizeSutOutput,
    [noPartialRuleSet.name]: noPartialRuleSet,
    [noPromiseChain.name]: noPromiseChain,
    [noReassign.name]: noReassign,
    [noReceiverMutation.name]: noReceiverMutation,
    [noRedundantMockReset.name]: noRedundantMockReset,
    [noRuleSuppression.name]: noRuleSuppression,
    [noSilentCatch.name]: noSilentCatch,
    [noSilentSuppression.name]: noSilentSuppression,
    [noSingleUseLocalType.name]: noSingleUseLocalType,
    [noSpecFileHelperFunction.name]: noSpecFileHelperFunction,
    [noSpecSpecificSharedSetup.name]: noSpecSpecificSharedSetup,
    [noSplitTypeAuthority.name]: noSplitTypeAuthority,
    [noStandaloneTsconfig.name]: noStandaloneTsconfig,
    [noStrictCanonicalLiteralUse.name]: noStrictCanonicalLiteralUse,
    [noSutIndependentAssertion.name]: noSutIndependentAssertion,
    [noTautologicalAssertion.name]: noTautologicalAssertion,
    [noTestContextEscape.name]: noTestContextEscape,
    [noTwinDeclaration.name]: noTwinDeclaration,
    [noUncheckedAuthoredPath.name]: noUncheckedAuthoredPath,
    [noUncheckedCast.name]: noUncheckedCast,
    [noUndersizedExternalSnapshot.name]: noUndersizedExternalSnapshot,
    [noUnorderedImport.name]: noUnorderedImport,
    [noUnwrappedToolchainConfig.name]: noUnwrappedToolchainConfig,
    [noVacuousHostObjectEquality.name]: noVacuousHostObjectEquality,
    [noViMockFactoryBehavior.name]: noViMockFactoryBehavior,
    [noVitestContextExpect.name]: noVitestContextExpect,
    [requireCatalogEntry.name]: requireCatalogEntry,
    [requireItOnlyExpect.name]: requireItOnlyExpect,
    [requireMockTypeParameter.name]: requireMockTypeParameter,
    [requireReExportOnlyFiles.name]: requireReExportOnlyFiles,
    [requireRegisteredFile.name]: requireRegisteredFile,
    [requireSpecFileForAssets.name]: requireSpecFileForAssets,
    [requireSpecLintCoverage.name]: requireSpecLintCoverage,
    [requireSpecOrAssetsOnlyInSpecDirectory.name]: requireSpecOrAssetsOnlyInSpecDirectory,
    [requireTestAssetsConstants.name]: requireTestAssetsConstants,
    [requireTestBlockForSpecFile.name]: requireTestBlockForSpecFile,
    [requireTestBlockSpelling.name]: requireTestBlockSpelling,
    [requireVitestExtendBuilder.name]: requireVitestExtendBuilder,
  },
};

/** @public */
export default plugin;
