import { dirname, join } from "node:path";

import { adoptedBundlesIn } from "../configs/bundles/adopted-bundles.ts";
import { LINT_BUNDLE_NAMES, type LintBundle } from "../configs/bundles/bundle-names.ts";
import { BUNDLE_RULES } from "../configs/oxlint.ts";
import {
  listRepositoryFiles,
  readTextFile,
} from "../lint/oxlint/lib/canonical-values/source-files.ts";
import { matchesAnchoredGlobPath } from "../lint/oxlint/lib/glob-path-match.ts";
import {
  disabledRuleDeclarationsIn,
  type DisabledRuleDeclaration,
} from "./disabled-rule-declarations.ts";

import type { RepositoryProblem } from "@mst/repository-checks";
import type { PresetAdoptionConfig } from "./config.ts";

export type PresetAdoptionReport = {
  readonly warnings: readonly RepositoryProblem[];
  readonly scanned: number;
  readonly configMissing: boolean;
};

const workspaceDirectoriesIn = (repositoryRoot: string): readonly string[] =>
  listRepositoryFiles(repositoryRoot)
    .manifests.map((manifest) => dirname(manifest.relativePath))
    .filter((directory) => directory !== ".")
    .toSorted();

const bundleCarrying = (ruleId: string): LintBundle | null =>
  LINT_BUNDLE_NAMES.find((bundle) =>
    BUNDLE_RULES[bundle].some((rule) => ruleId.endsWith(rule.name)),
  ) ?? null;

const unreachedWarning = ({
  declaration,
  config,
  bundle,
}: {
  readonly declaration: DisabledRuleDeclaration;
  readonly config: PresetAdoptionConfig;
  readonly bundle: LintBundle;
}): readonly RepositoryProblem[] => [
  {
    file: config.toolchainConfigFileName,
    line: declaration.line,
    message: `The lint configuration must not switch ${declaration.ruleId} off while it does not carry the ${bundle} bundle, because the override stops nothing. Delete the override, or name that bundle where the preset is called.`,
  },
];

const coveredWorkspaces = ({
  declaration,
  workspaces,
}: {
  readonly declaration: DisabledRuleDeclaration;
  readonly workspaces: readonly string[];
}): readonly string[] =>
  declaration.filePatterns.length === 0
    ? workspaces
    : workspaces.filter((workspace) =>
        declaration.filePatterns.some((pattern) =>
          matchesAnchoredGlobPath({ relativePath: workspace, pattern }),
        ),
      );

const warningsFor = ({
  declaration,
  workspaces,
  config,
}: {
  readonly declaration: DisabledRuleDeclaration;
  readonly workspaces: readonly string[];
  readonly config: PresetAdoptionConfig;
}): readonly RepositoryProblem[] =>
  coveredWorkspaces({ declaration, workspaces }).map((workspace) => ({
    file: config.toolchainConfigFileName,
    line: declaration.line,
    message: `The lint configuration must not leave ${declaration.ruleId} switched off for ${workspace}. Delete the override and repair what it reports, or record in an engineering decision log why the rule cannot reach there.`,
  }));

export const runPresetAdoptionChecks = ({
  repositoryRoot,
  config,
}: {
  readonly repositoryRoot: string;
  readonly config: PresetAdoptionConfig;
}): PresetAdoptionReport => {
  const source = readTextFile(join(repositoryRoot, config.toolchainConfigFileName));
  const workspaces = workspaceDirectoriesIn(repositoryRoot);
  if (source === null) return { warnings: [], scanned: workspaces.length, configMissing: true };

  const adopted =
    adoptedBundlesIn({ source, toolchainConfigFileName: config.toolchainConfigFileName }) ??
    LINT_BUNDLE_NAMES;

  return {
    warnings: disabledRuleDeclarationsIn({ source, config }).flatMap((declaration) => {
      const bundle = bundleCarrying(declaration.ruleId);
      return bundle !== null && !adopted.includes(bundle)
        ? unreachedWarning({ declaration, config, bundle })
        : warningsFor({ declaration, workspaces, config });
    }),
    scanned: workspaces.length,
    configMissing: false,
  };
};
