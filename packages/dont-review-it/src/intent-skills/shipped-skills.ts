import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { lineAtOffset, readUnlessMissing } from "@mst/utils";
import { findNodeAtLocation, getNodeValue, parseTree, type Node } from "jsonc-parser";

import {
  listRepositoryFiles,
  type ScannedFile,
} from "../lint/oxlint/lib/canonical-values/source-files.ts";

import type { RepositoryProblem } from "../problem.ts";
import type { IntentSkillsConfig } from "./config.ts";

type PublishedManifest = {
  readonly file: ScannedFile;
  readonly source: string;
  readonly root: Node;
};

const propertyValueOf = (root: Node, key: string): unknown => {
  const node = findNodeAtLocation(root, [key]);
  return node === undefined ? undefined : getNodeValue(node);
};

const lineOfProperty = ({
  manifest,
  key,
}: {
  manifest: PublishedManifest;
  key: string;
}): number => {
  const node = findNodeAtLocation(manifest.root, [key]);
  return lineAtOffset(manifest.source, node?.offset ?? manifest.root.offset);
};

const stringEntriesOf = (declared: unknown): readonly string[] | null =>
  Array.isArray(declared)
    ? declared.filter((entry): entry is string => typeof entry === "string")
    : null;

const containsSkillFile = ({
  directory,
  config,
}: {
  readonly directory: string;
  readonly config: IntentSkillsConfig;
}): boolean => {
  const entries = readUnlessMissing(() => readdirSync(directory, { withFileTypes: true })) ?? [];
  return entries.some((entry) =>
    entry.isDirectory()
      ? containsSkillFile({ directory: join(directory, entry.name), config })
      : entry.isFile() && entry.name === config.skillFileName,
  );
};

const missingSkillFiles = ({
  manifest,
  config,
}: {
  readonly manifest: PublishedManifest;
  readonly config: IntentSkillsConfig;
}): readonly RepositoryProblem[] => {
  const skillsDirectory = join(dirname(manifest.file.absolutePath), config.skillsDirectory);
  if (containsSkillFile({ directory: skillsDirectory, config })) return [];

  return [
    {
      file: manifest.file.relativePath,
      line: lineOfProperty({ manifest, key: "name" }),
      message: `A package that npm can publish must not ship without a TanStack Intent skill, because an agent that installs it finds nothing to load. Create ${config.skillsDirectory}/<topic>/${config.skillFileName} with npx @tanstack/intent scaffold, or mark the package "private": true.`,
    },
  ];
};

const missingFilesEntry = ({
  manifest,
  config,
}: {
  readonly manifest: PublishedManifest;
  readonly config: IntentSkillsConfig;
}): readonly RepositoryProblem[] => {
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

const missingKeyword = ({
  manifest,
  config,
}: {
  readonly manifest: PublishedManifest;
  readonly config: IntentSkillsConfig;
}): readonly RepositoryProblem[] => {
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

const unexpectedSkillFiles = ({
  manifest,
  config,
}: {
  readonly manifest: PublishedManifest;
  readonly config: IntentSkillsConfig;
}): readonly RepositoryProblem[] => {
  const skillsDirectory = join(dirname(manifest.file.absolutePath), config.skillsDirectory);
  if (!containsSkillFile({ directory: skillsDirectory, config })) return [];

  return [
    {
      file: manifest.file.relativePath,
      line: lineOfProperty({ manifest, key: "private" }),
      message: `A workspace-internal package must not carry TanStack Intent skills, because a skill that never ships trains agents on a surface nobody can install. Delete the ${config.skillsDirectory} directory, or let the package publish by removing "private": true.`,
    },
  ];
};

const unexpectedFilesEntry = ({
  manifest,
  config,
}: {
  readonly manifest: PublishedManifest;
  readonly config: IntentSkillsConfig;
}): readonly RepositoryProblem[] => {
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

const unexpectedKeyword = ({
  manifest,
  config,
}: {
  readonly manifest: PublishedManifest;
  readonly config: IntentSkillsConfig;
}): readonly RepositoryProblem[] => {
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

const missingProblems = ({
  manifest,
  config,
}: {
  readonly manifest: PublishedManifest;
  readonly config: IntentSkillsConfig;
}): readonly RepositoryProblem[] => [
  ...missingSkillFiles({ manifest, config }),
  ...missingFilesEntry({ manifest, config }),
  ...missingKeyword({ manifest, config }),
];

const unexpectedProblems = ({
  manifest,
  config,
}: {
  readonly manifest: PublishedManifest;
  readonly config: IntentSkillsConfig;
}): readonly RepositoryProblem[] => [
  ...unexpectedSkillFiles({ manifest, config }),
  ...unexpectedFilesEntry({ manifest, config }),
  ...unexpectedKeyword({ manifest, config }),
];

const manifestProblems = ({
  file,
  config,
}: {
  readonly file: ScannedFile;
  readonly config: IntentSkillsConfig;
}): readonly RepositoryProblem[] => {
  const source = readFileSync(file.absolutePath, "utf8");
  const root = parseTree(source);
  if (root === undefined || typeof propertyValueOf(root, "name") !== "string") return [];

  const manifest = { file, source, root };
  return propertyValueOf(root, "private") === true
    ? unexpectedProblems({ manifest, config })
    : missingProblems({ manifest, config });
};

export const shippedSkillsProblems = ({
  repositoryRoot,
  config,
}: {
  readonly repositoryRoot: string;
  readonly config: IntentSkillsConfig;
}): readonly RepositoryProblem[] =>
  listRepositoryFiles(repositoryRoot).manifests.flatMap((file) =>
    manifestProblems({ file, config }),
  );
