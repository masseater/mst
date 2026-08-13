import { readFileSync } from "node:fs";

import { parseTree } from "jsonc-parser";

import {
  listRepositoryFiles,
  type ScannedFile,
} from "../lint/oxlint/lib/canonical-values/source-files.ts";
import { lineOfProperty, propertyValueOf, stringEntriesOf } from "./manifest.ts";
import {
  publishedVersionProblems,
  unexpectedChangelogProblems,
  type SkillPackage,
} from "./shipped-versions.ts";
import { listSkillFiles, skillsDirectoryOf } from "./skill-files.ts";

import type { ScannedProblems } from "@mst/repository-checks";
import type { RepositoryProblem } from "../problem.ts";
import type { IntentSkillsConfig } from "./config.ts";

const shipsSkillFile = (scope: SkillPackage): boolean =>
  listSkillFiles({ directory: skillsDirectoryOf(scope), config: scope.config }).length > 0;

const missingSkillFiles = (scope: SkillPackage): readonly RepositoryProblem[] => {
  const { manifest, config } = scope;
  if (shipsSkillFile(scope)) return [];

  return [
    {
      file: manifest.file.relativePath,
      line: lineOfProperty({ manifest, key: "name" }),
      message: `A package that npm can publish must not ship without a TanStack Intent skill, because an agent that installs it finds nothing to load. Create ${config.skillsDirectory}/<topic>/${config.skillFileName} with npx @tanstack/intent scaffold, or mark the package "private": true.`,
    },
  ];
};

const missingFilesEntry = ({ manifest, config }: SkillPackage): readonly RepositoryProblem[] => {
  const declared = stringEntriesOf(propertyValueOf(manifest.root, "files"));
  if (declared === null || declared.includes(config.requiredFilesEntry)) return [];

  return [
    {
      file: manifest.file.relativePath,
      line: lineOfProperty({ manifest, key: "files" }),
      message: `The files allowlist must not leave out the ${config.requiredFilesEntry} directory, because npm packs only what files names and the published archive would drop every ${config.skillFileName}. Add "${config.requiredFilesEntry}" to files.`,
    },
  ];
};

const missingKeyword = ({ manifest, config }: SkillPackage): readonly RepositoryProblem[] => {
  const declared = stringEntriesOf(propertyValueOf(manifest.root, "keywords")) ?? [];
  if (declared.includes(config.requiredKeyword)) return [];

  return [
    {
      file: manifest.file.relativePath,
      line: lineOfProperty({ manifest, key: "keywords" }),
      message: `The manifest must not omit the ${config.requiredKeyword} keyword, because TanStack Intent detects skill-shipping packages by it. Add "${config.requiredKeyword}" to keywords.`,
    },
  ];
};

const unexpectedSkillFiles = (scope: SkillPackage): readonly RepositoryProblem[] => {
  const { manifest, config } = scope;
  if (!shipsSkillFile(scope)) return [];

  return [
    {
      file: manifest.file.relativePath,
      line: lineOfProperty({ manifest, key: "private" }),
      message: `A workspace-internal package must not carry TanStack Intent skills, because a skill that never ships trains agents on a surface nobody can install. Delete the ${config.skillsDirectory} directory, or let the package publish by removing "private": true.`,
    },
  ];
};

const unexpectedFilesEntry = ({ manifest, config }: SkillPackage): readonly RepositoryProblem[] => {
  const declared = stringEntriesOf(propertyValueOf(manifest.root, "files")) ?? [];
  if (!declared.includes(config.requiredFilesEntry)) return [];

  return [
    {
      file: manifest.file.relativePath,
      line: lineOfProperty({ manifest, key: "files" }),
      message: `The files allowlist of a workspace-internal package must not name the ${config.requiredFilesEntry} directory, because nothing is ever packed from a package that npm cannot publish. Remove "${config.requiredFilesEntry}" from files.`,
    },
  ];
};

const unexpectedKeyword = ({ manifest, config }: SkillPackage): readonly RepositoryProblem[] => {
  const declared = stringEntriesOf(propertyValueOf(manifest.root, "keywords")) ?? [];
  if (!declared.includes(config.requiredKeyword)) return [];

  return [
    {
      file: manifest.file.relativePath,
      line: lineOfProperty({ manifest, key: "keywords" }),
      message: `A workspace-internal package must not carry the ${config.requiredKeyword} keyword, because discovery would announce skills the package never ships. Remove "${config.requiredKeyword}" from keywords.`,
    },
  ];
};

const missingProblems = (scope: SkillPackage): readonly RepositoryProblem[] => [
  ...missingSkillFiles(scope),
  ...missingFilesEntry(scope),
  ...missingKeyword(scope),
  ...publishedVersionProblems(scope),
];

const unexpectedProblems = (scope: SkillPackage): readonly RepositoryProblem[] => [
  ...unexpectedSkillFiles(scope),
  ...unexpectedFilesEntry(scope),
  ...unexpectedKeyword(scope),
  ...unexpectedChangelogProblems(scope),
];

const manifestProblems = ({
  file,
  config,
  repositoryRoot,
}: {
  readonly file: ScannedFile;
  readonly config: IntentSkillsConfig;
  readonly repositoryRoot: string;
}): readonly RepositoryProblem[] => {
  const source = readFileSync(file.absolutePath, "utf8");
  const root = parseTree(source);
  if (root === undefined || typeof propertyValueOf(root, "name") !== "string") return [];

  const scope = { manifest: { file, source, root }, config, repositoryRoot };
  return propertyValueOf(root, "private") === true
    ? unexpectedProblems(scope)
    : missingProblems(scope);
};

export const shippedSkillsProblems = ({
  repositoryRoot,
  config,
}: {
  readonly repositoryRoot: string;
  readonly config: IntentSkillsConfig;
}): ScannedProblems => {
  const manifests = listRepositoryFiles(repositoryRoot).manifests;
  return {
    problems: manifests.flatMap((file) => manifestProblems({ file, config, repositoryRoot })),
    scanned: manifests.length,
  };
};
