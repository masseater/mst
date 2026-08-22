import { resolve } from "node:path";

import { formatLintRuleIndexProblem, lintRuleIndexProblems } from "@mst/lint-rule-authoring";

import { defaultDependencyCatalogChecksConfig } from "./dependency-catalog/config.ts";
import { formatDependencyCatalogProblem } from "./dependency-catalog/problem.ts";
import { runDependencyCatalogChecks } from "./dependency-catalog/run-dependency-catalog-checks.ts";
import { defaultEntryCompositionConfig } from "./entry-composition/config.ts";
import { entryCompositionProblems } from "./entry-composition/entry-composition-problems.ts";
import { defaultIntentSkillsConfig } from "./intent-skills/config.ts";
import { shippedSkillsProblems } from "./intent-skills/shipped-skills.ts";
import { listRepositoryFiles } from "./lint/oxlint/lib/canonical-values/source-files.ts";
import {
  findEquivalentConcepts,
  formatCanonicalValuesProblem,
  formatEquivalentConceptGroup,
  inspectCanonicalValues,
} from "./lint/oxlint/lib/canonical-values/verify.ts";
import { duplicatedClustersIn } from "./lint/oxlint/lib/duplicated-bodies/body-index.ts";
import { buildRepositoryBodyIndex } from "./lint/oxlint/lib/duplicated-bodies/builder.ts";
import { formatDuplicatedCluster } from "./lint/oxlint/lib/duplicated-bodies/site-report.ts";
import { defaultPresetAdoptionConfig } from "./preset-adoption/config.ts";
import { runPresetAdoptionChecks } from "./preset-adoption/run-preset-adoption-checks.ts";
import { formatRepositoryProblem } from "./problem.ts";
import { defaultRequiredFileFormConfig } from "./required-file-form/config.ts";
import { runRequiredFileFormChecks } from "./required-file-form/run-required-file-form-checks.ts";
import {
  formatTestCommandOverrideProblem,
  testCommandOverrideProblems,
} from "./test-execution/test-command-overrides.ts";
import { defaultWorkflowChecksConfig } from "./workflows/config.ts";
import { workflowOutcomesOf } from "./workflows/workflow-outcomes.ts";

import type { CheckOutcome } from "@mst/repository-checks";

export type CheckReport = {
  readonly outcomes: readonly CheckOutcome[];
  readonly problems: readonly string[];
  readonly warnings: readonly string[];
  readonly failures: readonly string[];
};

const NO_WORKSPACE_DEFINITION = "no workspace definition";

const NO_WORKFLOW_DEFINITION = "no workflow definition";

const NO_TOOLCHAIN_CONFIG = "no toolchain configuration";

const UNREADABLE_WORKSPACE_DEFINITION = "workspace definition does not parse";

const checkReportFrom = ({
  outcomes,
  failures,
}: {
  readonly outcomes: readonly CheckOutcome[];
  readonly failures: readonly string[];
}): CheckReport => ({
  outcomes,
  problems: outcomes.flatMap((checkRecord) => checkRecord.problems).toSorted(),
  warnings: outcomes.flatMap((checkRecord) => checkRecord.warnings).toSorted(),
  failures: failures.toSorted(),
});

const sourceScanOutcomes = (repositoryRoot: string): readonly CheckOutcome[] => {
  const repositoryFiles = listRepositoryFiles(resolve(repositoryRoot));
  const canonicalValues = inspectCanonicalValues({ repositoryRoot });

  return [
    {
      check: "canonical-values",
      unit: "source file",
      count: repositoryFiles.commentSources.length,
      skippedReason: null,
      problems: canonicalValues.problems.map(formatCanonicalValuesProblem).toSorted(),
      warnings: [],
    },
    {
      check: "equivalent-concepts",
      unit: "concept",
      count: canonicalValues.catalog.entries.length,
      skippedReason: null,
      problems: [],
      warnings:
        canonicalValues.problems.length === 0
          ? findEquivalentConcepts(canonicalValues.catalog.entries)
              .map(formatEquivalentConceptGroup)
              .toSorted()
          : [],
    },
    {
      check: "duplicated-bodies",
      unit: "declaration source",
      count: repositoryFiles.declarationSources.length,
      skippedReason: null,
      problems: duplicatedClustersIn(buildRepositoryBodyIndex({ repositoryRoot }))
        .map(formatDuplicatedCluster)
        .toSorted(),
      warnings: [],
    },
  ];
};

export const runChecks = (repositoryRoot: string): CheckReport => {
  const dependencyCatalog = runDependencyCatalogChecks({
    repositoryRoot,
    config: defaultDependencyCatalogChecksConfig,
  });
  const entryComposition = entryCompositionProblems({
    repositoryRoot,
    config: defaultEntryCompositionConfig,
  });
  const workflows = workflowOutcomesOf({
    repositoryRoot,
    config: defaultWorkflowChecksConfig,
  });
  const skills = shippedSkillsProblems({ repositoryRoot, config: defaultIntentSkillsConfig });
  const testExecution = testCommandOverrideProblems(repositoryRoot);
  const presetAdoption = runPresetAdoptionChecks({
    repositoryRoot,
    config: defaultPresetAdoptionConfig,
  });
  const requiredFileForm = runRequiredFileFormChecks({
    repositoryRoot,
    config: defaultRequiredFileFormConfig,
  });
  const ruleIndex = dependencyCatalog.definitionUnreadable
    ? { problems: [], scanned: 0 }
    : lintRuleIndexProblems({ repositoryRoot, write: false });

  return checkReportFrom({
    outcomes: [
      {
        check: "entry-composition",
        unit: "manifest",
        count: entryComposition.scanned,
        skippedReason: null,
        problems: entryComposition.problems.map(formatRepositoryProblem).toSorted(),
        warnings: [],
      },
      ...sourceScanOutcomes(repositoryRoot),
      {
        check: "workflow-definitions",
        unit: "definition",
        count: workflows.definitions.scanned,
        skippedReason: null,
        problems: workflows.definitions.problems.map(formatRepositoryProblem).toSorted(),
        warnings: [],
      },
      {
        check: "action-updates",
        unit: "update configuration",
        count: workflows.updates.scanned,
        skippedReason: workflows.definitions.scanned === 0 ? NO_WORKFLOW_DEFINITION : null,
        problems: workflows.updates.problems.map(formatRepositoryProblem).toSorted(),
        warnings: [],
      },
      {
        check: "lint-rule-index",
        unit: "workspace",
        count: ruleIndex.scanned,
        skippedReason: dependencyCatalog.definitionUnreadable
          ? UNREADABLE_WORKSPACE_DEFINITION
          : null,
        problems: ruleIndex.problems.map(formatLintRuleIndexProblem).toSorted(),
        warnings: [],
      },
      {
        check: "dependency-declarations",
        unit: "manifest",
        count: dependencyCatalog.scanned,
        skippedReason: dependencyCatalog.definitionMissing ? NO_WORKSPACE_DEFINITION : null,
        problems: dependencyCatalog.problems.map(formatDependencyCatalogProblem).toSorted(),
        warnings: [],
      },
      {
        check: "test-execution",
        unit: "manifest",
        count: testExecution.scanned,
        skippedReason: null,
        problems: testExecution.problems.map(formatTestCommandOverrideProblem).toSorted(),
        warnings: [],
      },
      {
        check: "required-file-form",
        unit: "package root",
        count: requiredFileForm.scanned,
        skippedReason: null,
        problems: requiredFileForm.problems.map(formatRepositoryProblem).toSorted(),
        warnings: [],
      },
      {
        check: "preset-adoption",
        unit: "workspace",
        count: presetAdoption.scanned,
        skippedReason: presetAdoption.configMissing ? NO_TOOLCHAIN_CONFIG : null,
        problems: presetAdoption.problems.map(formatRepositoryProblem).toSorted(),
        warnings: presetAdoption.warnings.map(formatRepositoryProblem).toSorted(),
      },
      {
        check: "intent-skills",
        unit: "manifest",
        count: skills.scanned,
        skippedReason: null,
        problems: skills.problems.map(formatRepositoryProblem).toSorted(),
        warnings: [],
      },
    ],
    failures: entryComposition.failures,
  });
};
