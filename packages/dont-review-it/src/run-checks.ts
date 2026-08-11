import { formatLintRuleIndexProblem, lintRuleIndexProblems } from "@mst/lint-rule-authoring";

import { defaultDependencyCatalogChecksConfig } from "./dependency-catalog/config.ts";
import { formatDependencyCatalogProblem } from "./dependency-catalog/problem.ts";
import { runDependencyCatalogChecks } from "./dependency-catalog/run-dependency-catalog-checks.ts";
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
import { defaultWorkflowChecksConfig } from "./workflows/config.ts";
import { formatWorkflowProblem } from "./workflows/problem.ts";
import { runWorkflowChecks } from "./workflows/run-workflow-checks.ts";

export type CheckReport = {
  readonly problems: readonly string[];
  readonly warnings: readonly string[];
};

export const runChecks = (repositoryRoot: string): CheckReport => {
  const dependencyCatalog = runDependencyCatalogChecks({
    repositoryRoot,
    config: defaultDependencyCatalogChecksConfig,
  });
  const ruleIndexProblems = dependencyCatalog.definitionUnreadable
    ? []
    : lintRuleIndexProblems({ repositoryRoot, write: false }).map(formatLintRuleIndexProblem);

  return {
    problems: [
      ...verifyCanonicalValues({ repositoryRoot }).map(formatCanonicalValuesProblem),
      ...findEquivalentConcepts(buildCanonicalValuesCatalog({ repositoryRoot }).entries).map(
        formatEquivalentConceptGroup,
      ),
      ...duplicatedClustersIn(buildRepositoryBodyIndex({ repositoryRoot })).map(
        formatDuplicatedCluster,
      ),
      ...runWorkflowChecks({ repositoryRoot, config: defaultWorkflowChecksConfig }).map(
        formatWorkflowProblem,
      ),
      ...ruleIndexProblems,
      ...dependencyCatalog.problems.map(formatDependencyCatalogProblem),
    ].toSorted(),
    warnings: dependencyCatalog.warnings.map(formatDependencyCatalogProblem).toSorted(),
  };
};
