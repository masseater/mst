import { API } from "typescript/unstable/sync";

import { loadCanonicalValuesCatalogSnapshot } from "./lint/oxlint/lib/canonical-values/builder.ts";
import { loadCatalogEntries } from "./lint/oxlint/lib/dependency-catalog/catalog-entries.ts";
import { loadWorkspaceDependencies } from "./lint/oxlint/lib/dependency-catalog/workspace-manifests.ts";
import { loadRepositoryBodyIndex } from "./lint/oxlint/lib/duplicated-bodies/builder.ts";
import { replacedModuleAt } from "./lint/oxlint/lib/external-io-boundary.ts";
import { createLibraryVocabularyLoader } from "./lint/oxlint/lib/library-vocabulary/harvester.ts";
import { loadRepositoryCellClassIndex } from "./lint/oxlint/lib/mutable-cell-classes/builder.ts";
import { loadRepositoryTypeAuthorityIndex } from "./lint/oxlint/lib/split-type-authority/builder.ts";
import { loadStyleClassIndex } from "./lint/oxlint/lib/style-classes/builder.ts";
import { loadRepositoryValueDeclarationIndex } from "./lint/oxlint/lib/value-declarations/builder.ts";
import { forbidNumberedSiblingFile } from "./lint/oxlint/rules/core/forbid-numbered-sibling-file--name-what-each-file-owns.ts";
import { forbidOversizedFile } from "./lint/oxlint/rules/core/forbid-oversized-file--split-by-responsibility.ts";
import { forbidUnresolvableModuleSpecifier } from "./lint/oxlint/rules/core/forbid-unresolvable-module-specifier--write-a-statically-resolvable-specifier.ts";
import { noAmbiguousVariableName } from "./lint/oxlint/rules/core/no-ambiguous-variable-name--rename-to-concrete-noun.ts";
import { noCittyParentRun } from "./lint/oxlint/rules/core/no-citty-parent-run--move-run-into-a-subcommand.ts";
import { noDefaultExport } from "./lint/oxlint/rules/core/no-default-export--use-named-export.ts";
import { noDetachedDeclaration } from "./lint/oxlint/rules/core/no-detached-declaration--declare-it-next-to-its-use.ts";
import { noDetachedRationale } from "./lint/oxlint/rules/core/no-detached-rationale--comment-at-explained-line.ts";
import { noDoubleTypeAssertion } from "./lint/oxlint/rules/core/no-double-type-assertion--declare-the-real-type.ts";
import { noExplanatoryComment } from "./lint/oxlint/rules/core/no-explanatory-comment--delete-or-move-to-commit-message.ts";
import { noHardcodedEndpoint } from "./lint/oxlint/rules/core/no-hardcoded-endpoint--read-from-configuration.ts";
import { noHardcodedProviderId } from "./lint/oxlint/rules/core/no-hardcoded-provider-id--read-from-configuration.ts";
import { noIdentityWrapper } from "./lint/oxlint/rules/core/no-identity-wrapper--call-the-target-directly.ts";
import { noMultiBindingDeclaration } from "./lint/oxlint/rules/core/no-multi-binding-declaration--declare-one-binding-per-statement.ts";
import { noSingleUseLocalType } from "./lint/oxlint/rules/core/no-single-use-local-type--inline-at-the-use-site.ts";
import { noUncheckedCast } from "./lint/oxlint/rules/core/no-unchecked-cast--parse-at-boundary.ts";
import { noUnorderedImport } from "./lint/oxlint/rules/core/no-unordered-import--group-by-origin-then-sort-by-specifier.ts";
import { createNoUnusedStyleClass } from "./lint/oxlint/rules/core/no-unused-style-class--delete-or-reference-it.ts";
import { requireReExportOnlyFiles } from "./lint/oxlint/rules/core/require-re-export-only-files--move-declaration-to-owning-module.ts";
import { forbidDeclaredCommandInvocation } from "./lint/oxlint/rules/governance/forbid-declared-command-invocation--use-designated-replacement.ts";
import { forbidGenericRestrictionRule } from "./lint/oxlint/rules/governance/forbid-generic-restriction-rule--use-the-declared-rule.ts";
import { forbidRestrictedTargetRelay } from "./lint/oxlint/rules/governance/forbid-restricted-target-relay--delete-the-relay.ts";
import { noBlanketSuppression } from "./lint/oxlint/rules/governance/no-blanket-suppression--name-and-record.ts";
import { noInlineSuppressionOfProtectedRule } from "./lint/oxlint/rules/governance/no-inline-suppression-of-protected-rule--register-the-exception-in-configuration.ts";
import { noPartialRuleSet } from "./lint/oxlint/rules/governance/no-partial-rule-set--enable-the-whole-set.ts";
import { noRuleSuppression } from "./lint/oxlint/rules/governance/no-rule-suppression--fix-the-violation.ts";
import { noSilentSuppression } from "./lint/oxlint/rules/governance/no-silent-suppression--fix-or-justify-inline.ts";
import { noUnregisteredRulePlugin } from "./lint/oxlint/rules/governance/no-unregistered-rule-plugin--enable-the-plugin.ts";
import { noUnwrappedToolchainConfig } from "./lint/oxlint/rules/governance/no-unwrapped-toolchain-config--call-the-preset-for-the-block.ts";
import { noBarrelImport } from "./lint/oxlint/rules/no-barrel-import--import-from-the-owning-module.ts";
import { noBarrelModule } from "./lint/oxlint/rules/no-barrel-module--declare-in-the-owning-module.ts";
import { noMixedPackageSurface } from "./lint/oxlint/rules/no-mixed-package-surface--declare-one-surface.ts";
import { requireSpecOrAssetsOnlyInSpecDirectory } from "./lint/oxlint/rules/require-spec-or-assets-only-in-spec-directory--move-out-or-inline.ts";
import { createNoDuplicateValueDeclaration } from "./lint/oxlint/rules/single-ownership/no-duplicate-value-declaration--reuse-authoritative-value.ts";
import { createNoDuplicatedBody } from "./lint/oxlint/rules/single-ownership/no-duplicated-body--import-the-existing-declaration.ts";
import { createNoLocalFiniteValueSet } from "./lint/oxlint/rules/single-ownership/no-local-finite-value-set--use-or-register-canonical-values.ts";
import { createNoSplitTypeAuthority } from "./lint/oxlint/rules/single-ownership/no-split-type-authority--rename-or-unify.ts";
import { createNoStrictCanonicalLiteralUseRule } from "./lint/oxlint/rules/single-ownership/no-strict-canonical-literal-use--use-canonical-import.ts";
import { createNoTwinDeclaration } from "./lint/oxlint/rules/single-ownership/no-twin-declaration--merge-into-one-owner.ts";
import { noArrayMutation } from "./lint/oxlint/rules/state/no-array-mutation--derive-new-array.ts";
import { createNoClassAsMutableCell } from "./lint/oxlint/rules/state/no-class-as-mutable-cell--decide-in-an-iife.ts";
import { noDiscardedFailure } from "./lint/oxlint/rules/state/no-discarded-failure--receive-and-surface-it.ts";
import { noEmptyCatch } from "./lint/oxlint/rules/state/no-empty-catch--throw-or-handle.ts";
import { noFloatingPromise } from "./lint/oxlint/rules/state/no-floating-promise--await-the-result.ts";
import { noLoggedAndContinuedFailure } from "./lint/oxlint/rules/state/no-logged-and-continued-failure--stop-or-recover.ts";
import { noPromiseChain } from "./lint/oxlint/rules/state/no-promise-chain--use-async-await.ts";
import { noReassign } from "./lint/oxlint/rules/state/no-reassign--use-spread-or-iife.ts";
import { noReceiverMutation } from "./lint/oxlint/rules/state/no-receiver-mutation--derive-new-value.ts";
import { noSilentCatch } from "./lint/oxlint/rules/state/no-silent-catch--rethrow-or-handle.ts";
import { forbidExpectlessIt } from "./lint/oxlint/rules/testing/forbid-expectless-it--assert-or-delete-it.ts";
import { forbidItExtend } from "./lint/oxlint/rules/testing/forbid-it-extend--use-test-extend.ts";
import { forbidMultiExpectIt } from "./lint/oxlint/rules/testing/forbid-multi-expect-it--split-into-separate-it.ts";
import { forbidTestAdjacentFile } from "./lint/oxlint/rules/testing/forbid-test-adjacent-file--inline-its-setup-into-the-test.ts";
import { forbidTestHook } from "./lint/oxlint/rules/testing/forbid-test-hook--move-setup-into-fixture.ts";
import { forbidWeakMatcher } from "./lint/oxlint/rules/testing/forbid-weak-matcher--use-exact-matcher.ts";
import { noComputedTestApiMember } from "./lint/oxlint/rules/testing/no-computed-test-api-member--use-static-member.ts";
import { noCrossSpecAssetsImport } from "./lint/oxlint/rules/testing/no-cross-spec-assets-import--use-own-assets.ts";
import { noDetachedTestFile } from "./lint/oxlint/rules/testing/no-detached-test-file--move-beside-source.ts";
import { noDryTestSetup } from "./lint/oxlint/rules/testing/no-dry-test-setup--inline-owned-setup.ts";
import { noDuplicatedTest } from "./lint/oxlint/rules/testing/no-duplicated-test--delete-the-copy.ts";
import { noExpectCallExpression } from "./lint/oxlint/rules/testing/no-expect-call-expression--yield-from-fixture.ts";
import { noExpectForbiddenSubjectName } from "./lint/oxlint/rules/testing/no-expect-forbidden-subject-name--rename-to-concrete-subject.ts";
import { noExpectMemberSubject } from "./lint/oxlint/rules/testing/no-expect-member-subject--yield-subject-from-fixture.ts";
import { noExpectMirroredSubject } from "./lint/oxlint/rules/testing/no-expect-mirrored-subject--assert-observable-contract.ts";
import { noExpectMockCallInspection } from "./lint/oxlint/rules/testing/no-expect-mock-call-inspection--use-to-have-been-called-family.ts";
import { noExpectOutsideIt } from "./lint/oxlint/rules/testing/no-expect-outside-it--move-into-it-block.ts";
import { noExpectProjectedSubject } from "./lint/oxlint/rules/testing/no-expect-projected-subject--use-tostrictequal-on-subject.ts";
import { noExpectSyntheticSubject } from "./lint/oxlint/rules/testing/no-expect-synthetic-subject--yield-from-fixture.ts";
import { noFixtureConstructInUse } from "./lint/oxlint/rules/testing/no-fixture-construct-in-use--yield-sut-output.ts";
import { noFixtureCopySubject } from "./lint/oxlint/rules/testing/no-fixture-copy-subject--yield-sut-output.ts";
import { noFixtureFactoryFunction } from "./lint/oxlint/rules/testing/no-fixture-factory-function--inline-owned-setup.ts";
import { noFixtureForwardSubject } from "./lint/oxlint/rules/testing/no-fixture-forward-subject--yield-sut-output.ts";
import { noFixtureOrderingAlias } from "./lint/oxlint/rules/testing/no-fixture-ordering-alias--use-auto-action-fixture.ts";
import { noHandmadeStandardIoDouble } from "./lint/oxlint/rules/testing/no-handmade-standard-io-double--use-standard-io-test.ts";
import { noLenientCoverageThreshold } from "./lint/oxlint/rules/testing/no-lenient-coverage-threshold--demand-full-coverage.ts";
import { noLintSuppressionInSpec } from "./lint/oxlint/rules/testing/no-lint-suppression-in-spec--fix-the-violation.ts";
import { noLocalFileSystemMock } from "./lint/oxlint/rules/testing/no-local-file-system-mock--use-shared-fs.ts";
import { noModuleScopeMockConfig } from "./lint/oxlint/rules/testing/no-module-scope-mock-config--lift-into-fixture.ts";
import { noModuleScopeMutableState } from "./lint/oxlint/rules/testing/no-module-scope-mutable-state--lift-into-fixture.ts";
import { createNoNonBoundaryDouble } from "./lint/oxlint/rules/testing/no-non-boundary-double--replace-at-the-external-boundary.ts";
import { noNormalizeSutOutput } from "./lint/oxlint/rules/testing/no-normalize-sut-output--assert-natural-shape.ts";
import { noRedundantMockReset } from "./lint/oxlint/rules/testing/no-redundant-mock-reset--lift-mocks-into-fixture.ts";
import { noReplacedDoubleBehaviour } from "./lint/oxlint/rules/testing/no-replaced-double-behaviour--let-the-replaced-module-answer.ts";
import { noSharedDoubleState } from "./lint/oxlint/rules/testing/no-shared-double-state--reset-doubles-between-tests.ts";
import { noSpecFileHelperFunction } from "./lint/oxlint/rules/testing/no-spec-file-helper-function--inline-or-use-fixture.ts";
import { noSpecSpecificSharedSetup } from "./lint/oxlint/rules/testing/no-spec-specific-shared-setup--keep-setup-uniform.ts";
import { noSutIndependentAssertion } from "./lint/oxlint/rules/testing/no-sut-independent-assertion--assert-fixture-subject.ts";
import { noTautologicalAssertion } from "./lint/oxlint/rules/testing/no-tautological-assertion--assert-on-a-computed-value.ts";
import { noTestContextEscape } from "./lint/oxlint/rules/testing/no-test-context-escape--destructure-fixtures-by-name.ts";
import { noUndersizedExternalSnapshot } from "./lint/oxlint/rules/testing/no-undersized-external-snapshot--use-inline-snapshot.ts";
import { noVacuousHostObjectEquality } from "./lint/oxlint/rules/testing/no-vacuous-host-object-equality--assert-parsed-value.ts";
import { noVacuousTestRun } from "./lint/oxlint/rules/testing/no-vacuous-test-run--let-the-empty-run-fail.ts";
import { noViMockFactoryBehavior } from "./lint/oxlint/rules/testing/no-vi-mock-factory-behavior--use-spy-true-and-fixture.ts";
import { noVitestContextExpect } from "./lint/oxlint/rules/testing/no-vitest-context-expect--import-expect-from-vitest.ts";
import { requireItOnlyExpect } from "./lint/oxlint/rules/testing/require-it-only-expect--move-setup-into-fixture.ts";
import { requireMockTypeParameter } from "./lint/oxlint/rules/testing/require-mock-type-parameter--annotate-vi-fn.ts";
import { requireSpecFileForAssets } from "./lint/oxlint/rules/testing/require-spec-file-for-assets--create-matching-spec.ts";
import { requireSpecLintCoverage } from "./lint/oxlint/rules/testing/require-spec-lint-coverage--lint-every-spec-file.ts";
import { requireStandardIoSnapshot } from "./lint/oxlint/rules/testing/require-standard-io-snapshot--pin-both-streams.ts";
import { requireTestAssetsConstants } from "./lint/oxlint/rules/testing/require-test-assets-constants--move-setup-to-spec.ts";
import { requireTestBlockForSpecFile } from "./lint/oxlint/rules/testing/require-test-block-for-spec-file--add-test-or-delete-file.ts";
import { requireTestBlockSpelling } from "./lint/oxlint/rules/testing/require-test-block-spelling--use-configured-fn.ts";
import { requireVitestExtendBuilder } from "./lint/oxlint/rules/testing/require-vitest-extend-builder--infer-fixture-type.ts";
import { forbidTrackedPath } from "./lint/oxlint/rules/workspace/forbid-tracked-path--untrack-and-ignore.ts";
import { noStandaloneTsconfig } from "./lint/oxlint/rules/workspace/no-standalone-tsconfig--extend-shared-preset.ts";
import { noUncheckedAuthoredPath } from "./lint/oxlint/rules/workspace/no-unchecked-authored-path--include-it-in-every-declared-check.ts";
import { createNoVersionRange } from "./lint/oxlint/rules/workspace/no-version-range--pin-the-exact-version.ts";
import { createRequireCatalogEntry } from "./lint/oxlint/rules/workspace/require-catalog-entry--register-shared-dependency.ts";
import { requireRegisteredFile } from "./lint/oxlint/rules/workspace/require-registered-file--restore-it-at-the-registered-path.ts";

import type { Plugin } from "@oxlint/plugins";

export const noLocalFiniteValueSet = createNoLocalFiniteValueSet({
  loadCatalog: loadCanonicalValuesCatalogSnapshot,
  loadLibraryVocabulary: createLibraryVocabularyLoader({
    openApi: (packageDirectory) => new API({ cwd: packageDirectory }),
  }),
});

export const noStrictCanonicalLiteralUse = createNoStrictCanonicalLiteralUseRule({
  loadCatalog: loadCanonicalValuesCatalogSnapshot,
});

export const noDuplicatedBody = createNoDuplicatedBody({ loadIndex: loadRepositoryBodyIndex });

export const noTwinDeclaration = createNoTwinDeclaration({ loadIndex: loadRepositoryBodyIndex });

export const noNonBoundaryDouble = createNoNonBoundaryDouble({ readBoundary: replacedModuleAt });

export const noUnusedStyleClass = createNoUnusedStyleClass({ loadIndex: loadStyleClassIndex });

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

const noVersionRange = createNoVersionRange({
  loadWorkspaces: loadWorkspaceDependencies,
  loadCatalog: loadCatalogEntries,
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
    [forbidTestAdjacentFile.name]: forbidTestAdjacentFile,
    [forbidRestrictedTargetRelay.name]: forbidRestrictedTargetRelay,
    [forbidTestHook.name]: forbidTestHook,
    [forbidTrackedPath.name]: forbidTrackedPath,
    [forbidUnresolvableModuleSpecifier.name]: forbidUnresolvableModuleSpecifier,
    [forbidWeakMatcher.name]: forbidWeakMatcher,
    [noAmbiguousVariableName.name]: noAmbiguousVariableName,
    [noArrayMutation.name]: noArrayMutation,
    [noBarrelImport.name]: noBarrelImport,
    [noBarrelModule.name]: noBarrelModule,
    [noBlanketSuppression.name]: noBlanketSuppression,
    [noCittyParentRun.name]: noCittyParentRun,
    [noClassAsMutableCell.name]: noClassAsMutableCell,
    [noComputedTestApiMember.name]: noComputedTestApiMember,
    [noCrossSpecAssetsImport.name]: noCrossSpecAssetsImport,
    [noDefaultExport.name]: noDefaultExport,
    [noDetachedDeclaration.name]: noDetachedDeclaration,
    [noDetachedRationale.name]: noDetachedRationale,
    [noDetachedTestFile.name]: noDetachedTestFile,
    [noDiscardedFailure.name]: noDiscardedFailure,
    [noDoubleTypeAssertion.name]: noDoubleTypeAssertion,
    [noDryTestSetup.name]: noDryTestSetup,
    [noDuplicateValueDeclaration.name]: noDuplicateValueDeclaration,
    [noDuplicatedBody.name]: noDuplicatedBody,
    [noDuplicatedTest.name]: noDuplicatedTest,
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
    [noHandmadeStandardIoDouble.name]: noHandmadeStandardIoDouble,
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
    [noNonBoundaryDouble.name]: noNonBoundaryDouble,
    [noNormalizeSutOutput.name]: noNormalizeSutOutput,
    [noPartialRuleSet.name]: noPartialRuleSet,
    [noPromiseChain.name]: noPromiseChain,
    [noReassign.name]: noReassign,
    [noReceiverMutation.name]: noReceiverMutation,
    [noRedundantMockReset.name]: noRedundantMockReset,
    [noReplacedDoubleBehaviour.name]: noReplacedDoubleBehaviour,
    [noRuleSuppression.name]: noRuleSuppression,
    [noSharedDoubleState.name]: noSharedDoubleState,
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
    [noUnregisteredRulePlugin.name]: noUnregisteredRulePlugin,
    [noUnusedStyleClass.name]: noUnusedStyleClass,
    [noUnwrappedToolchainConfig.name]: noUnwrappedToolchainConfig,
    [noVacuousHostObjectEquality.name]: noVacuousHostObjectEquality,
    [noVacuousTestRun.name]: noVacuousTestRun,
    [noViMockFactoryBehavior.name]: noViMockFactoryBehavior,
    [noVersionRange.name]: noVersionRange,
    [noVitestContextExpect.name]: noVitestContextExpect,
    [requireCatalogEntry.name]: requireCatalogEntry,
    [requireItOnlyExpect.name]: requireItOnlyExpect,
    [requireMockTypeParameter.name]: requireMockTypeParameter,
    [requireReExportOnlyFiles.name]: requireReExportOnlyFiles,
    [requireRegisteredFile.name]: requireRegisteredFile,
    [requireSpecFileForAssets.name]: requireSpecFileForAssets,
    [requireSpecLintCoverage.name]: requireSpecLintCoverage,
    [requireSpecOrAssetsOnlyInSpecDirectory.name]: requireSpecOrAssetsOnlyInSpecDirectory,
    [requireStandardIoSnapshot.name]: requireStandardIoSnapshot,
    [requireTestAssetsConstants.name]: requireTestAssetsConstants,
    [requireTestBlockForSpecFile.name]: requireTestBlockForSpecFile,
    [requireTestBlockSpelling.name]: requireTestBlockSpelling,
    [requireVitestExtendBuilder.name]: requireVitestExtendBuilder,
  },
};

/** @public */
export default plugin;
