import { resolve } from "node:path";

import { formatLintRuleIndexProblem, lintRuleIndexProblems } from "@mst/lint-rule-authoring";

import { defaultDependencyCatalogChecksConfig } from "./dependency-catalog/config.ts";
import { formatDependencyCatalogProblem } from "./dependency-catalog/problem.ts";
import { runDependencyCatalogChecks } from "./dependency-catalog/run-dependency-catalog-checks.ts";
import { defaultEntryCompositionConfig } from "./entry-composition/config.ts";
import { entryCompositionProblems } from "./entry-composition/entry-composition-problems.ts";
import { defaultIntentSkillsConfig } from "./intent-skills/config.ts";
import { shippedSkillsProblems } from "./intent-skills/shipped-skills.ts";
import { buildCanonicalValuesCatalog } from "./lint/oxlint/lib/canonical-values/builder.ts";
import {
  formatCanonicalValuesProblem,
  formatEquivalentConceptGroup,
} from "./lint/oxlint/lib/canonical-values/problem-message.ts";
import { listRepositoryFiles } from "./lint/oxlint/lib/canonical-values/source-files.ts";
import {
  findEquivalentConcepts,
  verifyCanonicalValues,
} from "./lint/oxlint/lib/canonical-values/verify.ts";
import { duplicatedClustersIn } from "./lint/oxlint/lib/duplicated-bodies/body-index.ts";
import { buildRepositoryBodyIndex } from "./lint/oxlint/lib/duplicated-bodies/builder.ts";
import { formatDuplicatedCluster } from "./lint/oxlint/lib/duplicated-bodies/site-report.ts";
import { formatRepositoryProblem } from "./problem.ts";
import { defaultWorkflowChecksConfig } from "./workflows/config.ts";
import { runWorkflowChecks } from "./workflows/run-workflow-checks.ts";

import type { CheckOutcome } from "@mst/repository-checks";

export type CheckReport = {
  readonly outcomes: readonly CheckOutcome[];
  readonly problems: readonly string[];
  readonly warnings: readonly string[];
  readonly failures: readonly string[];
};

const NO_WORKSPACE_DEFINITION = "no workspace definition";

const UNREADABLE_WORKSPACE_DEFINITION = "workspace definition does not parse";

export const runChecks = (repositoryRoot: string): CheckReport => {
  const dependencyCatalog = runDependencyCatalogChecks({
    repositoryRoot,
    config: defaultDependencyCatalogChecksConfig,
  });
  const entryComposition = entryCompositionProblems({
    repositoryRoot,
    config: defaultEntryCompositionConfig,
  });
  const repositoryFiles = listRepositoryFiles(resolve(repositoryRoot));
  const catalog = buildCanonicalValuesCatalog({ repositoryRoot });
  const workflows = runWorkflowChecks({ repositoryRoot, config: defaultWorkflowChecksConfig });
  const skills = shippedSkillsProblems({ repositoryRoot, config: defaultIntentSkillsConfig });
  const ruleIndex = dependencyCatalog.definitionUnreadable
    ? { problems: [], scanned: 0 }
    : lintRuleIndexProblems({ repositoryRoot, write: false });

  const outcomes: readonly CheckOutcome[] = [
    {
      check: "entry-composition",
      unit: "manifest",
      count: entryComposition.scanned,
      skippedReason: null,
      problems: entryComposition.problems.map(formatRepositoryProblem).toSorted(),
      warnings: [],
    },
    {
      check: "canonical-values",
      unit: "source file",
      count: repositoryFiles.commentSources.length,
      skippedReason: null,
      problems: verifyCanonicalValues({ repositoryRoot })
        .map(formatCanonicalValuesProblem)
        .toSorted(),
      warnings: [],
    },
    {
      check: "equivalent-concepts",
      unit: "concept",
      count: catalog.entries.length,
      skippedReason: null,
      problems: findEquivalentConcepts(catalog.entries)
        .map(formatEquivalentConceptGroup)
        .toSorted(),
      warnings: [],
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
    {
      check: "workflow-definitions",
      unit: "definition",
      count: workflows.scanned,
      skippedReason: null,
      problems: workflows.problems.map(formatRepositoryProblem).toSorted(),
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
      warnings: dependencyCatalog.warnings.map(formatDependencyCatalogProblem).toSorted(),
    },
    {
      check: "intent-skills",
      unit: "manifest",
      count: skills.scanned,
      skippedReason: null,
      problems: skills.problems.map(formatRepositoryProblem).toSorted(),
      warnings: [],
    },
  ];

  return {
    outcomes,
    problems: outcomes.flatMap((outcome) => outcome.problems).toSorted(),
    warnings: outcomes.flatMap((outcome) => outcome.warnings).toSorted(),
    failures: entryComposition.failures.toSorted(),
  };
};
