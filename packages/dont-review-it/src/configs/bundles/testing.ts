import { forbidExpectlessIt } from "../../lint/oxlint/rules/testing/forbid-expectless-it--assert-or-delete-it.ts";
import { forbidItExtend } from "../../lint/oxlint/rules/testing/forbid-it-extend--use-test-extend.ts";
import { forbidMultiExpectIt } from "../../lint/oxlint/rules/testing/forbid-multi-expect-it--split-into-separate-it.ts";
import { forbidTestAdjacentFile } from "../../lint/oxlint/rules/testing/forbid-test-adjacent-file--inline-its-setup-into-the-test.ts";
import { forbidTestHook } from "../../lint/oxlint/rules/testing/forbid-test-hook--move-setup-into-fixture.ts";
import { forbidWeakMatcher } from "../../lint/oxlint/rules/testing/forbid-weak-matcher--use-exact-matcher.ts";
import { noComputedTestApiMember } from "../../lint/oxlint/rules/testing/no-computed-test-api-member--use-static-member.ts";
import { noCrossSpecAssetsImport } from "../../lint/oxlint/rules/testing/no-cross-spec-assets-import--use-own-assets.ts";
import { noDetachedTestFile } from "../../lint/oxlint/rules/testing/no-detached-test-file--move-beside-source.ts";
import { noDryTestSetup } from "../../lint/oxlint/rules/testing/no-dry-test-setup--inline-owned-setup.ts";
import { noDuplicatedTest } from "../../lint/oxlint/rules/testing/no-duplicated-test--delete-the-copy.ts";
import { noExpectCallExpression } from "../../lint/oxlint/rules/testing/no-expect-call-expression--yield-from-fixture.ts";
import { noExpectForbiddenSubjectName } from "../../lint/oxlint/rules/testing/no-expect-forbidden-subject-name--rename-to-concrete-subject.ts";
import { noExpectMemberSubject } from "../../lint/oxlint/rules/testing/no-expect-member-subject--yield-subject-from-fixture.ts";
import { noExpectMirroredSubject } from "../../lint/oxlint/rules/testing/no-expect-mirrored-subject--assert-observable-contract.ts";
import { noExpectMockCallInspection } from "../../lint/oxlint/rules/testing/no-expect-mock-call-inspection--use-to-have-been-called-family.ts";
import { noExpectOutsideIt } from "../../lint/oxlint/rules/testing/no-expect-outside-it--move-into-it-block.ts";
import { noExpectProjectedSubject } from "../../lint/oxlint/rules/testing/no-expect-projected-subject--use-tostrictequal-on-subject.ts";
import { noExpectSyntheticSubject } from "../../lint/oxlint/rules/testing/no-expect-synthetic-subject--yield-from-fixture.ts";
import { noFixtureConstructInUse } from "../../lint/oxlint/rules/testing/no-fixture-construct-in-use--yield-sut-output.ts";
import { noFixtureCopySubject } from "../../lint/oxlint/rules/testing/no-fixture-copy-subject--yield-sut-output.ts";
import { noFixtureFactoryFunction } from "../../lint/oxlint/rules/testing/no-fixture-factory-function--inline-owned-setup.ts";
import { noFixtureForwardSubject } from "../../lint/oxlint/rules/testing/no-fixture-forward-subject--yield-sut-output.ts";
import { noFixtureOrderingAlias } from "../../lint/oxlint/rules/testing/no-fixture-ordering-alias--use-auto-action-fixture.ts";
import { noHandmadeStandardIoDouble } from "../../lint/oxlint/rules/testing/no-handmade-standard-io-double--use-standard-io-test.ts";
import { noLenientCoverageThreshold } from "../../lint/oxlint/rules/testing/no-lenient-coverage-threshold--demand-full-coverage.ts";
import { noLintSuppressionInSpec } from "../../lint/oxlint/rules/testing/no-lint-suppression-in-spec--fix-the-violation.ts";
import { noLocalFileSystemMock } from "../../lint/oxlint/rules/testing/no-local-file-system-mock--use-shared-fs.ts";
import { noModuleScopeMockConfig } from "../../lint/oxlint/rules/testing/no-module-scope-mock-config--lift-into-fixture.ts";
import { noModuleScopeMutableState } from "../../lint/oxlint/rules/testing/no-module-scope-mutable-state--lift-into-fixture.ts";
import { noNormalizeSutOutput } from "../../lint/oxlint/rules/testing/no-normalize-sut-output--assert-natural-shape.ts";
import { noRedundantMockReset } from "../../lint/oxlint/rules/testing/no-redundant-mock-reset--lift-mocks-into-fixture.ts";
import { noReplacedDoubleBehaviour } from "../../lint/oxlint/rules/testing/no-replaced-double-behaviour--let-the-replaced-module-answer.ts";
import { noSharedDoubleState } from "../../lint/oxlint/rules/testing/no-shared-double-state--reset-doubles-between-tests.ts";
import { noSpecFileHelperFunction } from "../../lint/oxlint/rules/testing/no-spec-file-helper-function--inline-or-use-fixture.ts";
import { noSpecSpecificSharedSetup } from "../../lint/oxlint/rules/testing/no-spec-specific-shared-setup--keep-setup-uniform.ts";
import { noSutIndependentAssertion } from "../../lint/oxlint/rules/testing/no-sut-independent-assertion--assert-fixture-subject.ts";
import { noTautologicalAssertion } from "../../lint/oxlint/rules/testing/no-tautological-assertion--assert-on-a-computed-value.ts";
import { noTestContextEscape } from "../../lint/oxlint/rules/testing/no-test-context-escape--destructure-fixtures-by-name.ts";
import { noUndersizedExternalSnapshot } from "../../lint/oxlint/rules/testing/no-undersized-external-snapshot--use-inline-snapshot.ts";
import { noVacuousHostObjectEquality } from "../../lint/oxlint/rules/testing/no-vacuous-host-object-equality--assert-parsed-value.ts";
import { noVacuousTestRun } from "../../lint/oxlint/rules/testing/no-vacuous-test-run--let-the-empty-run-fail.ts";
import { noViMockFactoryBehavior } from "../../lint/oxlint/rules/testing/no-vi-mock-factory-behavior--use-spy-true-and-fixture.ts";
import { noVitestContextExpect } from "../../lint/oxlint/rules/testing/no-vitest-context-expect--import-expect-from-vitest.ts";
import { requireItOnlyExpect } from "../../lint/oxlint/rules/testing/require-it-only-expect--move-setup-into-fixture.ts";
import { requireMockTypeParameter } from "../../lint/oxlint/rules/testing/require-mock-type-parameter--annotate-vi-fn.ts";
import { requireSpecFileForAssets } from "../../lint/oxlint/rules/testing/require-spec-file-for-assets--create-matching-spec.ts";
import { requireSpecLintCoverage } from "../../lint/oxlint/rules/testing/require-spec-lint-coverage--lint-every-spec-file.ts";
import { requireStandardIoSnapshot } from "../../lint/oxlint/rules/testing/require-standard-io-snapshot--pin-both-streams.ts";
import { requireTestAssetsConstants } from "../../lint/oxlint/rules/testing/require-test-assets-constants--move-setup-to-spec.ts";
import { requireTestBlockForSpecFile } from "../../lint/oxlint/rules/testing/require-test-block-for-spec-file--add-test-or-delete-file.ts";
import { requireTestBlockSpelling } from "../../lint/oxlint/rules/testing/require-test-block-spelling--use-configured-fn.ts";
import { requireVitestExtendBuilder } from "../../lint/oxlint/rules/testing/require-vitest-extend-builder--infer-fixture-type.ts";
import { noNonBoundaryDouble } from "../../plugin.ts";

import type { WorkspaceLintRule } from "@mst/lint-rule-authoring";

export const testingBundle: readonly WorkspaceLintRule[] = [
  forbidExpectlessIt,
  forbidItExtend,
  forbidMultiExpectIt,
  forbidTestAdjacentFile,
  forbidTestHook,
  forbidWeakMatcher,
  noComputedTestApiMember,
  noCrossSpecAssetsImport,
  noDetachedTestFile,
  noDryTestSetup,
  noDuplicatedTest,
  noExpectCallExpression,
  noExpectForbiddenSubjectName,
  noExpectMemberSubject,
  noExpectMirroredSubject,
  noExpectMockCallInspection,
  noExpectOutsideIt,
  noExpectProjectedSubject,
  noExpectSyntheticSubject,
  noFixtureConstructInUse,
  noFixtureCopySubject,
  noFixtureFactoryFunction,
  noFixtureForwardSubject,
  noFixtureOrderingAlias,
  noHandmadeStandardIoDouble,
  noLenientCoverageThreshold,
  noLintSuppressionInSpec,
  noLocalFileSystemMock,
  noModuleScopeMockConfig,
  noModuleScopeMutableState,
  noNonBoundaryDouble,
  noNormalizeSutOutput,
  noRedundantMockReset,
  noReplacedDoubleBehaviour,
  noSharedDoubleState,
  noSpecFileHelperFunction,
  noSpecSpecificSharedSetup,
  noSutIndependentAssertion,
  noTautologicalAssertion,
  noTestContextEscape,
  noUndersizedExternalSnapshot,
  noVacuousHostObjectEquality,
  noVacuousTestRun,
  noViMockFactoryBehavior,
  noVitestContextExpect,
  requireItOnlyExpect,
  requireMockTypeParameter,
  requireSpecFileForAssets,
  requireSpecLintCoverage,
  requireStandardIoSnapshot,
  requireTestAssetsConstants,
  requireTestBlockForSpecFile,
  requireTestBlockSpelling,
  requireVitestExtendBuilder,
];
