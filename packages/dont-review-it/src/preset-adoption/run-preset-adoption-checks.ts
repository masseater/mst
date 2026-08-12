import { dirname, join } from "node:path";

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

  return {
    warnings: disabledRuleDeclarationsIn({ source, config }).flatMap((declaration) =>
      warningsFor({ declaration, workspaces, config }),
    ),
    scanned: workspaces.length,
    configMissing: false,
  };
};
