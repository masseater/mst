import { formatLintRuleIndexProblem, lintRuleIndexProblems } from "@mst/lint-rule-authoring";

import { defaultDependencyCatalogChecksConfig } from "./dependency-catalog/config.ts";
import { formatDependencyCatalogProblem } from "./dependency-catalog/problem.ts";
import { runDependencyCatalogChecks } from "./dependency-catalog/run-dependency-catalog-checks.ts";
import { defaultIntentSkillsConfig } from "./intent-skills/config.ts";
import { shippedSkillsProblems } from "./intent-skills/shipped-skills.ts";
import {
  findEquivalentConcepts,
  formatCanonicalValuesProblem,
  formatEquivalentConceptGroup,
  inspectCanonicalValues,
} from "./lint/oxlint/lib/canonical-values/verify.ts";
import { duplicatedClustersIn } from "./lint/oxlint/lib/duplicated-bodies/body-index.ts";
import { buildRepositoryBodyIndex } from "./lint/oxlint/lib/duplicated-bodies/builder.ts";
import { formatDuplicatedCluster } from "./lint/oxlint/lib/duplicated-bodies/site-report.ts";
import { formatRepositoryProblem } from "./problem.ts";
import { defaultWorkflowChecksConfig } from "./workflows/config.ts";
import { runWorkflowChecks } from "./workflows/run-workflow-checks.ts";

export type CheckReport = {
  readonly problems: readonly string[];
  readonly warnings: readonly string[];
};

export const runChecks = (repositoryRoot: string): CheckReport => {
  const canonicalValues = inspectCanonicalValues({ repositoryRoot });
  const equivalentConceptProblems =
    canonicalValues.problems.length === 0
      ? findEquivalentConcepts(canonicalValues.catalog.entries).map(formatEquivalentConceptGroup)
      : [];
  const dependencyCatalog = runDependencyCatalogChecks({
    repositoryRoot,
    config: defaultDependencyCatalogChecksConfig,
  });
  const ruleIndexProblems = dependencyCatalog.definitionUnreadable
    ? []
    : lintRuleIndexProblems({ repositoryRoot, write: false }).map(formatLintRuleIndexProblem);

  return {
    problems: [
      ...canonicalValues.problems.map(formatCanonicalValuesProblem),
      ...equivalentConceptProblems,
      ...duplicatedClustersIn(buildRepositoryBodyIndex({ repositoryRoot })).map(
        formatDuplicatedCluster,
      ),
      ...runWorkflowChecks({ repositoryRoot, config: defaultWorkflowChecksConfig }).map(
        formatRepositoryProblem,
      ),
      ...ruleIndexProblems,
      ...dependencyCatalog.problems.map(formatDependencyCatalogProblem),
      ...shippedSkillsProblems({ repositoryRoot, config: defaultIntentSkillsConfig }).map(
        formatRepositoryProblem,
      ),
    ].toSorted(),
    warnings: dependencyCatalog.warnings.map(formatDependencyCatalogProblem).toSorted(),
  };
};
