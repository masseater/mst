import { dirname, join } from "node:path";

import { isEqual } from "es-toolkit";

import {
  listRepositoryFiles,
  readTextFile,
} from "../lint/oxlint/lib/canonical-values/source-files.ts";
import { matchesAnchoredGlobPath } from "../lint/oxlint/lib/glob-path-match.ts";
import { inspectPresetAdoptionConfig } from "./inspect-preset-adoption-config.ts";

import type { RepositoryProblem } from "@mst/repository-checks";
import type { PresetAdoptionConfig } from "./config.ts";
import type { DisabledRuleDeclaration } from "./inspection-types.ts";

export type PresetAdoptionReport = {
  readonly problems: readonly RepositoryProblem[];
  readonly warnings: readonly RepositoryProblem[];
  readonly scanned: number;
  readonly configMissing: boolean;
};

const workspaceDirectoriesIn = (repositoryRoot: string): readonly string[] =>
  listRepositoryFiles(repositoryRoot)
    .manifests.map((manifest) => dirname(manifest.relativePath))
    .filter((directory) => directory !== ".")
    .toSorted();

const coveredWorkspaces = ({
  declaration,
  workspaces,
}: {
  readonly declaration: DisabledRuleDeclaration;
  readonly workspaces: readonly string[];
}): readonly string[] =>
  declaration.filePatterns.length === 0
    ? workspaces
    : workspaces.filter(
        (workspace) =>
          declaration.filePatterns.some((pattern) =>
            matchesAnchoredGlobPath({ relativePath: workspace, pattern }),
          ) &&
          !declaration.excludeFilePatterns.some((pattern) =>
            matchesAnchoredGlobPath({ relativePath: workspace, pattern }),
          ),
      );

const reportsFor = ({
  declaration,
  workspaces,
  config,
}: {
  readonly declaration: DisabledRuleDeclaration;
  readonly workspaces: readonly string[];
  readonly config: PresetAdoptionConfig;
}): readonly RepositoryProblem[] => {
  const covered = coveredWorkspaces({ declaration, workspaces });
  return (
    covered.length === 0
      ? [
          declaration.filePatterns.length === 0
            ? "the repository"
            : declaration.filePatterns.join(", "),
        ]
      : covered
  ).map((workspace) => ({
    file: config.toolchainConfigFileName,
    line: declaration.line,
    message: `The lint configuration must not leave ${declaration.ruleId} switched off for ${workspace}. Delete the override and repair what it reports, or keep only the exact exception recorded by the repository's engineering decision log.`,
  }));
};

const sameStrings = (left: readonly string[], right: readonly string[]): boolean =>
  isEqual(left.toSorted(), right.toSorted());

const isAllowedDisabledRule = ({
  declaration,
  config,
}: {
  readonly declaration: DisabledRuleDeclaration;
  readonly config: PresetAdoptionConfig;
}): boolean =>
  declaration.pathReachInspectable &&
  declaration.ruleId === config.allowedDisabledRule.ruleId &&
  sameStrings(declaration.filePatterns, config.allowedDisabledRule.filePatterns) &&
  declaration.excludeFilePatterns.length === 0;

export const runPresetAdoptionChecks = ({
  repositoryRoot,
  config,
}: {
  readonly repositoryRoot: string;
  readonly config: PresetAdoptionConfig;
}): PresetAdoptionReport => {
  const source = readTextFile(join(repositoryRoot, config.toolchainConfigFileName));
  const workspaces = workspaceDirectoriesIn(repositoryRoot);
  if (source === null) {
    return { problems: [], warnings: [], scanned: workspaces.length, configMissing: true };
  }

  const inspection = inspectPresetAdoptionConfig({ source, config });
  const allowed = inspection.disabledDeclarations.filter((declaration) =>
    isAllowedDisabledRule({ declaration, config }),
  );
  const prohibited = inspection.disabledDeclarations.filter(
    (declaration) => !isAllowedDisabledRule({ declaration, config }),
  );

  return {
    problems: [
      ...inspection.problems,
      ...prohibited.flatMap((declaration) => reportsFor({ declaration, workspaces, config })),
    ],
    warnings: allowed.flatMap((declaration) => reportsFor({ declaration, workspaces, config })),
    scanned: workspaces.length,
    configMissing: false,
  };
};
