import { join, resolve } from "node:path";

import {
  formatLintRuleProblem,
  lintRuleDocProblems,
  lintRuleIndexProblems,
} from "@mst/lint-rule-authoring";

import { adoptedBundlesIn } from "./configs/bundles/adopted-bundles.ts";
import { LINT_BUNDLE, LINT_BUNDLE_NAMES, type LintBundle } from "./configs/bundles/bundle-names.ts";
import { defaultDependencyCatalogChecksConfig } from "./dependency-catalog/config.ts";
import { formatDependencyCatalogProblem } from "./dependency-catalog/problem.ts";
import { runDependencyCatalogChecks } from "./dependency-catalog/run-dependency-catalog-checks.ts";
import { defaultEntryCompositionConfig } from "./entry-composition/config.ts";
import { entryCompositionProblems } from "./entry-composition/entry-composition-problems.ts";
import { defaultIntentSkillsConfig } from "./intent-skills/config.ts";
import { shippedSkillsProblems } from "./intent-skills/shipped-skills.ts";
import {
  listRepositoryFiles,
  readTextFile,
} from "./lint/oxlint/lib/canonical-values/source-files.ts";
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
import { defaultShippablePackagesConfig } from "./shippable-packages/config.ts";
import { shippablePackagesProblems } from "./shippable-packages/shippable-packages.ts";
import { defaultTelemetryWiringConfig } from "./telemetry-wiring/config.ts";
import { runTelemetryWiringChecks } from "./telemetry-wiring/run-telemetry-wiring-checks.ts";
import { defaultWorkflowChecksConfig } from "./workflows/config.ts";
import { workflowOutcomesOf } from "./workflows/workflow-outcomes.ts";

import type { CheckOutcome } from "@mst/repository-checks";

export type CheckReport = {
  readonly outcomes: readonly CheckOutcome[];
  readonly problems: readonly string[];
  readonly warnings: readonly string[];
  readonly failures: readonly string[];
};

const adoptedBundlesFor = (repositoryRoot: string): readonly LintBundle[] => {
  const { toolchainConfigFileName } = defaultPresetAdoptionConfig;
  const source = readTextFile(join(repositoryRoot, toolchainConfigFileName));
  const declared = source === null ? null : adoptedBundlesIn({ source, toolchainConfigFileName });
  return declared ?? LINT_BUNDLE_NAMES;
};

const lintRuleOutcomesOf = ({
  repositoryRoot,
  unreadable,
}: {
  readonly repositoryRoot: string;
  readonly unreadable: boolean;
}) => ({
  index: unreadable
    ? { problems: [], scanned: 0 }
    : lintRuleIndexProblems({ repositoryRoot, write: false }),
  docs: unreadable
    ? { problems: [], scanned: 0 }
    : lintRuleDocProblems({ repositoryRoot, write: false }),
});

type ScannedReports = {
  readonly repositoryRoot: string;
  readonly adopted: readonly LintBundle[];
  readonly dependencyCatalog: ReturnType<typeof runDependencyCatalogChecks>;
  readonly entryComposition: ReturnType<typeof entryCompositionProblems>;
  readonly workflows: ReturnType<typeof workflowOutcomesOf>;
  readonly presetAdoption: ReturnType<typeof runPresetAdoptionChecks>;
  readonly requiredFileForm: ReturnType<typeof runRequiredFileFormChecks>;
  readonly telemetryWiring: ReturnType<typeof runTelemetryWiringChecks>;
  readonly lintRules: ReturnType<typeof lintRuleOutcomesOf>;
};

const scannedReportsOf = (repositoryRoot: string): ScannedReports => {
  const dependencyCatalog = runDependencyCatalogChecks({
    repositoryRoot,
    config: defaultDependencyCatalogChecksConfig,
  });
  return {
    repositoryRoot,
    adopted: adoptedBundlesFor(repositoryRoot),
    dependencyCatalog,
    entryComposition: entryCompositionProblems({
      repositoryRoot,
      config: defaultEntryCompositionConfig,
    }),
    workflows: workflowOutcomesOf({ repositoryRoot, config: defaultWorkflowChecksConfig }),
    presetAdoption: runPresetAdoptionChecks({
      repositoryRoot,
      config: defaultPresetAdoptionConfig,
    }),
    requiredFileForm: runRequiredFileFormChecks({
      repositoryRoot,
      config: defaultRequiredFileFormConfig,
    }),
    telemetryWiring: runTelemetryWiringChecks({
      repositoryRoot,
      config: defaultTelemetryWiringConfig,
    }),
    lintRules: lintRuleOutcomesOf({
      repositoryRoot,
      unreadable: dependencyCatalog.definitionUnreadable,
    }),
  };
};

const BUNDLE_NOT_ADOPTED = "bundle not adopted";

const unrunCheck = ({
  check,
  unit,
}: {
  readonly check: string;
  readonly unit: string;
}): CheckOutcome => ({
  check,
  unit,
  count: 0,
  skippedReason: BUNDLE_NOT_ADOPTED,
  problems: [],
  warnings: [],
});

const SOURCE_SCAN_CHECKS: readonly { readonly check: string; readonly unit: string }[] = [
  { check: "canonical-values", unit: "source file" },
  { check: "equivalent-concepts", unit: "concept" },
  { check: "duplicated-bodies", unit: "declaration source" },
];

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

const manifestScanOutcomes = (repositoryRoot: string): readonly CheckOutcome[] => {
  const shippablePackages = shippablePackagesProblems({
    repositoryRoot,
    config: defaultShippablePackagesConfig,
  });
  const skills = shippedSkillsProblems({ repositoryRoot, config: defaultIntentSkillsConfig });

  return [
    {
      check: "shippable-packages",
      unit: "manifest",
      count: shippablePackages.scanned,
      skippedReason: null,
      problems: shippablePackages.problems.map(formatRepositoryProblem).toSorted(),
      warnings: [],
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
};

const NO_WORKFLOW_DEFINITION = "no workflow definition";

const UNREADABLE_WORKSPACE_DEFINITION = "workspace definition does not parse";

const NO_WORKSPACE_DEFINITION = "no workspace definition";

const NO_TOOLCHAIN_CONFIG = "no toolchain configuration";

const outcomesOf = ({
  repositoryRoot,
  adopted,
  dependencyCatalog,
  entryComposition,
  workflows,
  presetAdoption,
  requiredFileForm,
  telemetryWiring,
  lintRules,
}: ScannedReports): readonly CheckOutcome[] => [
  {
    check: "entry-composition",
    unit: "manifest",
    count: entryComposition.scanned,
    skippedReason: null,
    problems: entryComposition.problems.map(formatRepositoryProblem).toSorted(),
    warnings: [],
  },
  ...(adopted.includes(LINT_BUNDLE.singleOwnership)
    ? sourceScanOutcomes(repositoryRoot)
    : SOURCE_SCAN_CHECKS.map(unrunCheck)),
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
    count: lintRules.index.scanned,
    skippedReason: dependencyCatalog.definitionUnreadable ? UNREADABLE_WORKSPACE_DEFINITION : null,
    problems: lintRules.index.problems.map(formatLintRuleProblem).toSorted(),
    warnings: [],
  },
  {
    check: "lint-rule-docs",
    unit: "rule",
    count: lintRules.docs.scanned,
    skippedReason: dependencyCatalog.definitionUnreadable ? UNREADABLE_WORKSPACE_DEFINITION : null,
    problems: lintRules.docs.problems.map(formatLintRuleProblem).toSorted(),
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
    problems: [],
    warnings: presetAdoption.warnings.map(formatRepositoryProblem).toSorted(),
  },
  {
    check: "telemetry-wiring",
    unit: "package root",
    count: telemetryWiring.scanned,
    skippedReason: null,
    problems: telemetryWiring.problems.map(formatRepositoryProblem).toSorted(),
    warnings: [],
  },
  ...manifestScanOutcomes(repositoryRoot),
];

const CHECK_BUNDLES: Readonly<Record<string, LintBundle>> = {
  "entry-composition": LINT_BUNDLE.publishing,
  "canonical-values": LINT_BUNDLE.singleOwnership,
  "equivalent-concepts": LINT_BUNDLE.singleOwnership,
  "duplicated-bodies": LINT_BUNDLE.singleOwnership,
  "workflow-definitions": LINT_BUNDLE.ci,
  "action-updates": LINT_BUNDLE.ci,
  "lint-rule-index": LINT_BUNDLE.toolchain,
  "lint-rule-docs": LINT_BUNDLE.toolchain,
  "dependency-declarations": LINT_BUNDLE.toolchain,
  "required-file-form": LINT_BUNDLE.toolchain,
  "preset-adoption": LINT_BUNDLE.toolchain,
  "telemetry-wiring": LINT_BUNDLE.toolchain,
  "shippable-packages": LINT_BUNDLE.publishing,
  "intent-skills": LINT_BUNDLE.publishing,
};

const withinAdoption = ({
  outcomes,
  adopted,
}: {
  readonly outcomes: readonly CheckOutcome[];
  readonly adopted: readonly LintBundle[];
}): readonly CheckOutcome[] =>
  outcomes.map((ranCheck) => {
    const bundle = CHECK_BUNDLES[ranCheck.check];
    if (bundle === undefined || adopted.includes(bundle)) return ranCheck;
    return {
      ...ranCheck,
      count: 0,
      skippedReason: BUNDLE_NOT_ADOPTED,
      problems: [],
      warnings: [],
    };
  });

export const runChecks = (repositoryRoot: string): CheckReport => {
  const reports = scannedReportsOf(repositoryRoot);
  const { adopted, entryComposition } = reports;
  const carried = withinAdoption({ outcomes: outcomesOf(reports), adopted });

  return {
    outcomes: carried,
    problems: carried.flatMap((ranCheck) => ranCheck.problems).toSorted(),
    warnings: carried.flatMap((ranCheck) => ranCheck.warnings).toSorted(),
    failures: adopted.includes(LINT_BUNDLE.publishing) ? entryComposition.failures.toSorted() : [],
  };
};
