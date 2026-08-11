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
import { defaultWorkflowChecksConfig } from "./workflows/config.ts";
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
      formatRepositoryProblem,
    ),
    ...shippedSkillsProblems({ repositoryRoot, config: defaultIntentSkillsConfig }).map(
      formatRepositoryProblem,
    ),
  ].toSorted();
