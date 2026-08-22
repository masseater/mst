import { dirname, join } from "node:path";

import { isEqual } from "es-toolkit";

import {
  listRepositoryFiles,
  readTextFile,
  type RepositoryFiles,
} from "../lint/oxlint/lib/canonical-values/source-files.ts";
import { matchesAnchoredGlobPath } from "../lint/oxlint/lib/glob-path-match.ts";
import { isGeneratedLintPath } from "../lint/oxlint/lib/lint-suppression/protected-rules.ts";
import { ignoredLintSources } from "./ignored-lint-sources.ts";
import { inspectPresetAdoptionConfig } from "./inspect-preset-adoption-config.ts";
import { presetNativeSuppressionProblems } from "./preset-native-suppressions.ts";

import type { RepositoryProblem } from "@mst/repository-checks";
import type { PresetAdoptionConfig } from "./config.ts";
import type { DisabledRuleDeclaration } from "./inspection-types.ts";

export type PresetAdoptionReport = {
  readonly problems: readonly RepositoryProblem[];
  readonly warnings: readonly RepositoryProblem[];
  readonly scanned: number;
  readonly configMissing: boolean;
};

const workspaceDirectoriesIn = (repositoryFiles: RepositoryFiles): readonly string[] =>
  repositoryFiles.manifests
    .map((manifest) => dirname(manifest.relativePath))
    .filter((directory) => directory !== ".")
    .toSorted();

const callerIgnoreProblems = ({
  inspection,
  repositoryFiles,
  config,
}: {
  readonly inspection: ReturnType<typeof inspectPresetAdoptionConfig>;
  readonly repositoryFiles: RepositoryFiles;
  readonly config: PresetAdoptionConfig;
}): readonly RepositoryProblem[] => {
  if (inspection.ignorePatterns === undefined) return [];
  const ignored = ignoredLintSources({
    patterns: inspection.ignorePatterns.patterns,
    sourcePaths: repositoryFiles.commentSources
      .map((sourceFile) => sourceFile.relativePath)
      .filter((relativePath) => !isGeneratedLintPath(relativePath)),
  });
  if (ignored === null) {
    return [
      {
        file: config.toolchainConfigFileName,
        line: inspection.ignorePatterns.line,
        message: `The root lint.${config.ignorePatternsFieldName} patterns must be verifiable with gitignore semantics before preset lint reach can be accepted.`,
      },
    ];
  }
  return ignored.map((ignoredPath) => ({
    file: config.toolchainConfigFileName,
    line: inspection.ignorePatterns?.line ?? 1,
    message: `The root lint.${config.ignorePatternsFieldName} patterns must not remove repository lint source ${ignoredPath}. Delete or narrow the matching pattern.`,
  }));
};

const nativeSuppressionProblems = ({
  repositoryFiles,
  config,
}: {
  readonly repositoryFiles: RepositoryFiles;
  readonly config: PresetAdoptionConfig;
}): readonly RepositoryProblem[] =>
  repositoryFiles.commentSources
    .filter((sourceFile) => !isGeneratedLintPath(sourceFile.relativePath))
    .flatMap((sourceFile) => {
      const source = readTextFile(sourceFile.absolutePath);
      return source === null
        ? [
            {
              file: sourceFile.relativePath,
              line: 1,
              message:
                "A repository lint source must remain readable while native Oxlint suppressions are inspected.",
            },
          ]
        : presetNativeSuppressionProblems({
            file: sourceFile.relativePath,
            source,
            config,
          });
    });

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

const matchesAllowedDisabledRule = ({
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
  const repositoryFiles = listRepositoryFiles(repositoryRoot);
  const source = readTextFile(join(repositoryRoot, config.toolchainConfigFileName));
  const workspaces = workspaceDirectoriesIn(repositoryFiles);
  if (source === null) {
    return { problems: [], warnings: [], scanned: workspaces.length, configMissing: true };
  }

  const inspection = inspectPresetAdoptionConfig({ source, config });
  const allowedCandidates = inspection.disabledDeclarations.filter((declaration) =>
    matchesAllowedDisabledRule({ declaration, config }),
  );
  const allowed = allowedCandidates.length === 1 ? allowedCandidates : [];
  const prohibited = inspection.disabledDeclarations.filter(
    (declaration) => !allowed.includes(declaration),
  );

  return {
    problems: [
      ...inspection.problems,
      ...callerIgnoreProblems({ inspection, repositoryFiles, config }),
      ...nativeSuppressionProblems({ repositoryFiles, config }),
      ...prohibited.flatMap((declaration) => reportsFor({ declaration, workspaces, config })),
    ],
    warnings: allowed.flatMap((declaration) => reportsFor({ declaration, workspaces, config })),
    scanned: workspaces.length,
    configMissing: false,
  };
};
