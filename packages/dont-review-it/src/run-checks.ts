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
  findEquivalentConcepts,
  formatCanonicalValuesProblem,
  formatEquivalentConceptGroup,
  verifyCanonicalValues,
} from "./lint/oxlint/lib/canonical-values/verify.ts";
import { duplicatedClustersIn } from "./lint/oxlint/lib/duplicated-bodies/body-index.ts";
import { buildRepositoryBodyIndex } from "./lint/oxlint/lib/duplicated-bodies/builder.ts";
import { formatDuplicatedCluster } from "./lint/oxlint/lib/duplicated-bodies/site-report.ts";
import { formatRepositoryProblem } from "./problem.ts";
import {
  formatTestCommandOverrideProblem,
  testCommandOverrideProblems,
} from "./test-execution/test-command-overrides.ts";
import { defaultWorkflowChecksConfig } from "./workflows/config.ts";
import { runWorkflowChecks } from "./workflows/run-workflow-checks.ts";

export type CheckReport = {
  readonly problems: readonly string[];
  readonly failures: readonly string[];
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
  const ruleIndexProblems = dependencyCatalog.definitionUnreadable
    ? []
    : lintRuleIndexProblems({ repositoryRoot, write: false }).map(formatLintRuleIndexProblem);

  return {
    problems: [
      ...entryComposition.problems.map(formatRepositoryProblem),
      ...verifyCanonicalValues({ repositoryRoot }).map(formatCanonicalValuesProblem),
      ...findEquivalentConcepts(buildCanonicalValuesCatalog({ repositoryRoot }).entries).map(
        formatEquivalentConceptGroup,
      ),
      ...duplicatedClustersIn(buildRepositoryBodyIndex({ repositoryRoot })).map(
        formatDuplicatedCluster,
      ),
      ...runWorkflowChecks({ repositoryRoot, config: defaultWorkflowChecksConfig }).map(
        formatRepositoryProblem,
      ),
      ...ruleIndexProblems,
      ...dependencyCatalog.problems.map(formatDependencyCatalogProblem),
      ...testCommandOverrideProblems(repositoryRoot).map(formatTestCommandOverrideProblem),
      ...shippedSkillsProblems({ repositoryRoot, config: defaultIntentSkillsConfig }).map(
        formatRepositoryProblem,
      ),
    ].toSorted(),
    failures: entryComposition.failures.toSorted(),
  };
};
