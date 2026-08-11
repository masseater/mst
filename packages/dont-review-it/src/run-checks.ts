import { formatLintRuleIndexProblem, lintRuleIndexProblems } from "@mst/lint-rule-authoring";

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

export const runChecks = (repositoryRoot: string): readonly string[] =>
  [
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
    ...lintRuleIndexProblems({ repositoryRoot, write: false }).map(formatLintRuleIndexProblem),
  ].toSorted();
