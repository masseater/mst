import { LINT_SEVERITY } from "@mst/lint-rule-authoring";
import { defineConfig, type OxlintConfig } from "oxlint";

import { forbidNumberedSiblingFile } from "../lint/oxlint/rules/core/forbid-numbered-sibling-file--name-what-each-file-owns.ts";
import { forbidOversizedFile } from "../lint/oxlint/rules/core/forbid-oversized-file--split-by-responsibility.ts";
import { forbidUnresolvableModuleSpecifier } from "../lint/oxlint/rules/core/forbid-unresolvable-module-specifier--write-a-statically-resolvable-specifier.ts";
import { noAmbiguousVariableName } from "../lint/oxlint/rules/core/no-ambiguous-variable-name--rename-to-concrete-noun.ts";
import { noCittyParentRun } from "../lint/oxlint/rules/core/no-citty-parent-run--move-run-into-a-subcommand.ts";
import { noDefaultExport } from "../lint/oxlint/rules/core/no-default-export--use-named-export.ts";
import { noDetachedDeclaration } from "../lint/oxlint/rules/core/no-detached-declaration--declare-it-next-to-its-use.ts";
import { noDetachedRationale } from "../lint/oxlint/rules/core/no-detached-rationale--comment-at-explained-line.ts";
import { noDoubleTypeAssertion } from "../lint/oxlint/rules/core/no-double-type-assertion--declare-the-real-type.ts";
import { noExplanatoryComment } from "../lint/oxlint/rules/core/no-explanatory-comment--delete-or-move-to-commit-message.ts";
import { noHardcodedEndpoint } from "../lint/oxlint/rules/core/no-hardcoded-endpoint--read-from-configuration.ts";
import { noHardcodedProviderId } from "../lint/oxlint/rules/core/no-hardcoded-provider-id--read-from-configuration.ts";
import { noIdentityWrapper } from "../lint/oxlint/rules/core/no-identity-wrapper--call-the-target-directly.ts";
import { noMultiBindingDeclaration } from "../lint/oxlint/rules/core/no-multi-binding-declaration--declare-one-binding-per-statement.ts";
import { noSingleUseLocalType } from "../lint/oxlint/rules/core/no-single-use-local-type--inline-at-the-use-site.ts";
import { noUncheckedCast } from "../lint/oxlint/rules/core/no-unchecked-cast--parse-at-boundary.ts";
import { noUnorderedImport } from "../lint/oxlint/rules/core/no-unordered-import--group-by-origin-then-sort-by-specifier.ts";
import { requireReExportOnlyFiles } from "../lint/oxlint/rules/core/require-re-export-only-files--move-declaration-to-owning-module.ts";
import { forbidDeclaredCommandInvocation } from "../lint/oxlint/rules/governance/forbid-declared-command-invocation--use-designated-replacement.ts";
import { forbidGenericRestrictionRule } from "../lint/oxlint/rules/governance/forbid-generic-restriction-rule--use-the-declared-rule.ts";
import { forbidRestrictedTargetRelay } from "../lint/oxlint/rules/governance/forbid-restricted-target-relay--delete-the-relay.ts";
import { noBlanketSuppression } from "../lint/oxlint/rules/governance/no-blanket-suppression--name-and-record.ts";
import { noInlineSuppressionOfProtectedRule } from "../lint/oxlint/rules/governance/no-inline-suppression-of-protected-rule--register-the-exception-in-configuration.ts";
import { noPartialRuleSet } from "../lint/oxlint/rules/governance/no-partial-rule-set--enable-the-whole-set.ts";
import { noRuleSuppression } from "../lint/oxlint/rules/governance/no-rule-suppression--fix-the-violation.ts";
import { noSilentSuppression } from "../lint/oxlint/rules/governance/no-silent-suppression--fix-or-justify-inline.ts";
import { noUnregisteredRulePlugin } from "../lint/oxlint/rules/governance/no-unregistered-rule-plugin--enable-the-plugin.ts";
import { noUnwrappedToolchainConfig } from "../lint/oxlint/rules/governance/no-unwrapped-toolchain-config--call-the-preset-for-the-block.ts";
import { noArrayMutation } from "../lint/oxlint/rules/state/no-array-mutation--derive-new-array.ts";
import { noDiscardedFailure } from "../lint/oxlint/rules/state/no-discarded-failure--receive-and-surface-it.ts";
import { noEmptyCatch } from "../lint/oxlint/rules/state/no-empty-catch--throw-or-handle.ts";
import { noFloatingPromise } from "../lint/oxlint/rules/state/no-floating-promise--await-the-result.ts";
import { noLoggedAndContinuedFailure } from "../lint/oxlint/rules/state/no-logged-and-continued-failure--stop-or-recover.ts";
import { noPromiseChain } from "../lint/oxlint/rules/state/no-promise-chain--use-async-await.ts";
import { noReassign } from "../lint/oxlint/rules/state/no-reassign--use-spread-or-iife.ts";
import { noReceiverMutation } from "../lint/oxlint/rules/state/no-receiver-mutation--derive-new-value.ts";
import { noSilentCatch } from "../lint/oxlint/rules/state/no-silent-catch--rethrow-or-handle.ts";
import { forbidExpectlessIt } from "../lint/oxlint/rules/testing/forbid-expectless-it--assert-or-delete-it.ts";
import { forbidItExtend } from "../lint/oxlint/rules/testing/forbid-it-extend--use-test-extend.ts";
import { forbidMultiExpectIt } from "../lint/oxlint/rules/testing/forbid-multi-expect-it--split-into-separate-it.ts";
import { forbidTestAdjacentFile } from "../lint/oxlint/rules/testing/forbid-test-adjacent-file--inline-its-setup-into-the-test.ts";
import { forbidTestHook } from "../lint/oxlint/rules/testing/forbid-test-hook--move-setup-into-fixture.ts";
import { forbidWeakMatcher } from "../lint/oxlint/rules/testing/forbid-weak-matcher--use-exact-matcher.ts";
import { noComputedTestApiMember } from "../lint/oxlint/rules/testing/no-computed-test-api-member--use-static-member.ts";
import { noCrossSpecAssetsImport } from "../lint/oxlint/rules/testing/no-cross-spec-assets-import--use-own-assets.ts";
import { noDetachedTestFile } from "../lint/oxlint/rules/testing/no-detached-test-file--move-beside-source.ts";
import { noDryTestSetup } from "../lint/oxlint/rules/testing/no-dry-test-setup--inline-owned-setup.ts";
import { noDuplicatedTest } from "../lint/oxlint/rules/testing/no-duplicated-test--delete-the-copy.ts";
import { noExpectCallExpression } from "../lint/oxlint/rules/testing/no-expect-call-expression--yield-from-fixture.ts";
import { noExpectForbiddenSubjectName } from "../lint/oxlint/rules/testing/no-expect-forbidden-subject-name--rename-to-concrete-subject.ts";
import { noExpectMemberSubject } from "../lint/oxlint/rules/testing/no-expect-member-subject--yield-subject-from-fixture.ts";
import { noExpectMirroredSubject } from "../lint/oxlint/rules/testing/no-expect-mirrored-subject--assert-observable-contract.ts";
import { noExpectMockCallInspection } from "../lint/oxlint/rules/testing/no-expect-mock-call-inspection--use-to-have-been-called-family.ts";
import { noExpectOutsideIt } from "../lint/oxlint/rules/testing/no-expect-outside-it--move-into-it-block.ts";
import { noExpectProjectedSubject } from "../lint/oxlint/rules/testing/no-expect-projected-subject--use-tostrictequal-on-subject.ts";
import { noExpectSyntheticSubject } from "../lint/oxlint/rules/testing/no-expect-synthetic-subject--yield-from-fixture.ts";
import { noFixtureConstructInUse } from "../lint/oxlint/rules/testing/no-fixture-construct-in-use--yield-sut-output.ts";
import { noFixtureCopySubject } from "../lint/oxlint/rules/testing/no-fixture-copy-subject--yield-sut-output.ts";
import { noFixtureFactoryFunction } from "../lint/oxlint/rules/testing/no-fixture-factory-function--inline-owned-setup.ts";
import { noFixtureForwardSubject } from "../lint/oxlint/rules/testing/no-fixture-forward-subject--yield-sut-output.ts";
import { noFixtureOrderingAlias } from "../lint/oxlint/rules/testing/no-fixture-ordering-alias--use-auto-action-fixture.ts";
import { noHandmadeStandardIoDouble } from "../lint/oxlint/rules/testing/no-handmade-standard-io-double--use-standard-io-test.ts";
import { noLenientCoverageThreshold } from "../lint/oxlint/rules/testing/no-lenient-coverage-threshold--demand-full-coverage.ts";
import { noLintSuppressionInSpec } from "../lint/oxlint/rules/testing/no-lint-suppression-in-spec--fix-the-violation.ts";
import { noLocalFileSystemMock } from "../lint/oxlint/rules/testing/no-local-file-system-mock--use-shared-fs.ts";
import { noModuleScopeMockConfig } from "../lint/oxlint/rules/testing/no-module-scope-mock-config--lift-into-fixture.ts";
import { noModuleScopeMutableState } from "../lint/oxlint/rules/testing/no-module-scope-mutable-state--lift-into-fixture.ts";
import { noNormalizeSutOutput } from "../lint/oxlint/rules/testing/no-normalize-sut-output--assert-natural-shape.ts";
import { noRedundantMockReset } from "../lint/oxlint/rules/testing/no-redundant-mock-reset--lift-mocks-into-fixture.ts";
import { noReplacedDoubleBehaviour } from "../lint/oxlint/rules/testing/no-replaced-double-behaviour--let-the-replaced-module-answer.ts";
import { noSharedDoubleState } from "../lint/oxlint/rules/testing/no-shared-double-state--reset-doubles-between-tests.ts";
import { noSpecFileHelperFunction } from "../lint/oxlint/rules/testing/no-spec-file-helper-function--inline-or-use-fixture.ts";
import { noSpecSpecificSharedSetup } from "../lint/oxlint/rules/testing/no-spec-specific-shared-setup--keep-setup-uniform.ts";
import { noSutIndependentAssertion } from "../lint/oxlint/rules/testing/no-sut-independent-assertion--assert-fixture-subject.ts";
import { noTautologicalAssertion } from "../lint/oxlint/rules/testing/no-tautological-assertion--assert-on-a-computed-value.ts";
import { noTestContextEscape } from "../lint/oxlint/rules/testing/no-test-context-escape--destructure-fixtures-by-name.ts";
import { noUndersizedExternalSnapshot } from "../lint/oxlint/rules/testing/no-undersized-external-snapshot--use-inline-snapshot.ts";
import { noVacuousHostObjectEquality } from "../lint/oxlint/rules/testing/no-vacuous-host-object-equality--assert-parsed-value.ts";
import { noVacuousTestRun } from "../lint/oxlint/rules/testing/no-vacuous-test-run--let-the-empty-run-fail.ts";
import { noViMockFactoryBehavior } from "../lint/oxlint/rules/testing/no-vi-mock-factory-behavior--use-spy-true-and-fixture.ts";
import { noVitestContextExpect } from "../lint/oxlint/rules/testing/no-vitest-context-expect--import-expect-from-vitest.ts";
import { requireItOnlyExpect } from "../lint/oxlint/rules/testing/require-it-only-expect--move-setup-into-fixture.ts";
import { requireMockTypeParameter } from "../lint/oxlint/rules/testing/require-mock-type-parameter--annotate-vi-fn.ts";
import { requireSpecFileForAssets } from "../lint/oxlint/rules/testing/require-spec-file-for-assets--create-matching-spec.ts";
import { requireSpecLintCoverage } from "../lint/oxlint/rules/testing/require-spec-lint-coverage--lint-every-spec-file.ts";
import { requireStandardIoSnapshot } from "../lint/oxlint/rules/testing/require-standard-io-snapshot--pin-both-streams.ts";
import { requireTestAssetsConstants } from "../lint/oxlint/rules/testing/require-test-assets-constants--move-setup-to-spec.ts";
import { requireTestBlockForSpecFile } from "../lint/oxlint/rules/testing/require-test-block-for-spec-file--add-test-or-delete-file.ts";
import { requireTestBlockSpelling } from "../lint/oxlint/rules/testing/require-test-block-spelling--use-configured-fn.ts";
import { requireVitestExtendBuilder } from "../lint/oxlint/rules/testing/require-vitest-extend-builder--infer-fixture-type.ts";
import { forbidTrackedPath } from "../lint/oxlint/rules/workspace/forbid-tracked-path--untrack-and-ignore.ts";
import { noStandaloneTsconfig } from "../lint/oxlint/rules/workspace/no-standalone-tsconfig--extend-shared-preset.ts";
import { noUncheckedAuthoredPath } from "../lint/oxlint/rules/workspace/no-unchecked-authored-path--include-it-in-every-declared-check.ts";
import { requireRegisteredFile } from "../lint/oxlint/rules/workspace/require-registered-file--restore-it-at-the-registered-path.ts";
import {
  noClassAsMutableCell,
  noDuplicatedBody,
  noDuplicateValueDeclaration,
  noLocalFiniteValueSet,
  noNonBoundaryDouble,
  noSplitTypeAuthority,
  noStrictCanonicalLiteralUse,
  noTwinDeclaration,
  noUnusedStyleClass,
  requireCatalogEntry,
} from "../plugin.ts";
import { specDirectoryOverrides } from "./spec-directory-overrides.ts";
import { UPSTREAM_PLUGINS, UPSTREAM_RULES, UPSTREAM_TEST_RULES } from "./upstream-rules.ts";

const PLUGIN_NAME = "dont-review-it";

const MAX_LINES_PER_FUNCTION = 200;

const SOURCE_FILES = ["**/*.ts", "**/*.tsx"];

const TEST_FILES = ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts", "**/*.spec.tsx"];

const SHARED_TSCONFIG_PRESETS = [
  "dont-review-it/tsconfig/library.json",
  "dont-review-it/tsconfig/app.json",
];

const RE_EXPORT_ONLY_FILES = ["**/index.ts", "**/index.tsx"];

export const oxlint: OxlintConfig = defineConfig({
  categories: { correctness: LINT_SEVERITY.ERROR },
  plugins: [...UPSTREAM_PLUGINS],
  jsPlugins: [{ name: PLUGIN_NAME, specifier: "@mst/dont-review-it/plugin" }],
  options: {
    reportUnusedDisableDirectives: LINT_SEVERITY.ERROR,
    respectEslintDisableDirectives: false,
  },
  overrides: [
    {
      files: SOURCE_FILES,
      excludeFiles: TEST_FILES,
      rules: {
        "max-lines-per-function": [
          LINT_SEVERITY.ERROR,
          { max: MAX_LINES_PER_FUNCTION, skipBlankLines: true, skipComments: true },
        ],
      },
    },
    {
      files: TEST_FILES,
      rules: {
        ...UPSTREAM_TEST_RULES,
        "max-nested-callbacks": LINT_SEVERITY.OFF,
        "max-statements": LINT_SEVERITY.OFF,
      },
    },
    ...specDirectoryOverrides,
  ],
  rules: {
    ...UPSTREAM_RULES,
    [`${PLUGIN_NAME}/${forbidDeclaredCommandInvocation.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${forbidExpectlessIt.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${forbidGenericRestrictionRule.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${forbidItExtend.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${forbidMultiExpectIt.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${forbidNumberedSiblingFile.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${forbidOversizedFile.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${forbidRestrictedTargetRelay.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${forbidTestAdjacentFile.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${forbidTestHook.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${forbidTrackedPath.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${forbidUnresolvableModuleSpecifier.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${forbidWeakMatcher.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noAmbiguousVariableName.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noArrayMutation.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noBlanketSuppression.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noClassAsMutableCell.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noComputedTestApiMember.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noCrossSpecAssetsImport.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noCittyParentRun.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noDefaultExport.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noDetachedDeclaration.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noDetachedRationale.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noDetachedTestFile.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noDiscardedFailure.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noDoubleTypeAssertion.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noDryTestSetup.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noDuplicateValueDeclaration.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noDuplicatedBody.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noDuplicatedTest.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noEmptyCatch.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noExpectCallExpression.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noExpectForbiddenSubjectName.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noExpectMemberSubject.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noExpectMirroredSubject.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noExpectMockCallInspection.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noExpectOutsideIt.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noExpectProjectedSubject.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noExpectSyntheticSubject.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noExplanatoryComment.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noFixtureConstructInUse.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noFixtureCopySubject.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noFixtureFactoryFunction.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noFixtureForwardSubject.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noFixtureOrderingAlias.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noFloatingPromise.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noHandmadeStandardIoDouble.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noHardcodedEndpoint.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noHardcodedProviderId.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noIdentityWrapper.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noInlineSuppressionOfProtectedRule.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noLenientCoverageThreshold.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noLintSuppressionInSpec.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noLocalFileSystemMock.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noLocalFiniteValueSet.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noLoggedAndContinuedFailure.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noModuleScopeMockConfig.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noModuleScopeMutableState.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noMultiBindingDeclaration.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noNonBoundaryDouble.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noNormalizeSutOutput.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noPartialRuleSet.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noPromiseChain.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noReassign.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noReceiverMutation.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noRedundantMockReset.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noReplacedDoubleBehaviour.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noRuleSuppression.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noSharedDoubleState.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noSilentCatch.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noSilentSuppression.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noSingleUseLocalType.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noSpecFileHelperFunction.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noSpecSpecificSharedSetup.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noSplitTypeAuthority.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noStandaloneTsconfig.name}`]: [
      LINT_SEVERITY.ERROR,
      [...SHARED_TSCONFIG_PRESETS],
    ],
    [`${PLUGIN_NAME}/${noStrictCanonicalLiteralUse.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noSutIndependentAssertion.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noTautologicalAssertion.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noTestContextEscape.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noTwinDeclaration.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noUncheckedAuthoredPath.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noUncheckedCast.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noUndersizedExternalSnapshot.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noUnorderedImport.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noUnregisteredRulePlugin.name}`]: [
      LINT_SEVERITY.ERROR,
      { plugins: [...UPSTREAM_PLUGINS, PLUGIN_NAME] },
    ],
    [`${PLUGIN_NAME}/${noUnusedStyleClass.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noUnwrappedToolchainConfig.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noVacuousHostObjectEquality.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noViMockFactoryBehavior.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noVitestContextExpect.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${requireCatalogEntry.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${requireItOnlyExpect.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${requireMockTypeParameter.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noVacuousTestRun.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${requireReExportOnlyFiles.name}`]: [
      LINT_SEVERITY.ERROR,
      { targets: [...RE_EXPORT_ONLY_FILES] },
    ],
    [`${PLUGIN_NAME}/${requireRegisteredFile.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${requireSpecFileForAssets.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${requireSpecLintCoverage.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${requireTestAssetsConstants.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${requireTestBlockForSpecFile.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${requireTestBlockSpelling.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${requireVitestExtendBuilder.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${requireStandardIoSnapshot.name}`]: LINT_SEVERITY.ERROR,
    complexity: [LINT_SEVERITY.ERROR, { max: 10 }],
    "max-classes-per-file": [LINT_SEVERITY.ERROR, { max: 1 }],
    "max-depth": [LINT_SEVERITY.ERROR, { max: 4 }],
    "max-nested-callbacks": [LINT_SEVERITY.ERROR, { max: 2 }],
    "max-params": [LINT_SEVERITY.ERROR, { max: 2 }],
    "max-statements": [LINT_SEVERITY.ERROR, { max: 10 }],
    "no-console": LINT_SEVERITY.ERROR,
    "no-duplicate-imports": LINT_SEVERITY.ERROR,
    "no-empty": LINT_SEVERITY.ERROR,
    "no-empty-function": LINT_SEVERITY.ERROR,
    "typescript/ban-ts-comment": LINT_SEVERITY.ERROR,
    "typescript/no-explicit-any": LINT_SEVERITY.ERROR,
    "typescript/no-unnecessary-type-conversion": LINT_SEVERITY.ERROR,
  },
});
