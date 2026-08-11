import { readdirSync } from "node:fs";
import { join } from "node:path";

import { readUnlessMissing } from "@mst/repository-checks";
import { parse } from "yaml";

import { textOrNull } from "./read-text.ts";

export type LintRuleWorkspace = {
  readonly workspaceDir: string;
  readonly ruleDirectories: readonly string[];
};

const WORKSPACE_DEFINITION_FILE = "pnpm-workspace.yaml";

const WORKSPACE_PATTERNS_FIELD = "packages";

const RULE_DIRECTORIES_FIELD = "lintRules";

const childDirectoryNamesIn = (parentPath: string): readonly string[] => {
  const dirents = readUnlessMissing(() => readdirSync(parentPath, { withFileTypes: true }));
  return (dirents ?? []).filter((dirent) => dirent.isDirectory()).map((dirent) => dirent.name);
};

const expandedPattern = ({
  repositoryRoot,
  pattern,
}: {
  readonly repositoryRoot: string;
  readonly pattern: string;
}): readonly string[] => {
  if (!pattern.endsWith("/*")) return [pattern];

  const parentDirectory = pattern.slice(0, -"/*".length);
  return childDirectoryNamesIn(join(repositoryRoot, parentDirectory)).map(
    (childName) => `${parentDirectory}/${childName}`,
  );
};

const declaredWorkspaceDirs = (repositoryRoot: string): readonly string[] => {
  const definitionText = textOrNull(join(repositoryRoot, WORKSPACE_DEFINITION_FILE));
  if (definitionText === null) return [];

  const definition: unknown = parse(definitionText);
  if (typeof definition !== "object" || definition === null) return [];

  const patterns = (definition as Record<string, unknown>)[WORKSPACE_PATTERNS_FIELD];
  if (!Array.isArray(patterns)) return [];

  return patterns
    .filter((pattern): pattern is string => typeof pattern === "string")
    .flatMap((pattern) => expandedPattern({ repositoryRoot, pattern }));
};

const ruleDirectoriesDeclaredAt = ({
  repositoryRoot,
  workspaceDir,
}: {
  readonly repositoryRoot: string;
  readonly workspaceDir: string;
}): readonly string[] => {
  const manifestText = textOrNull(join(repositoryRoot, workspaceDir, "package.json"));
  if (manifestText === null) return [];

  const manifest: unknown = JSON.parse(manifestText);
  if (typeof manifest !== "object" || manifest === null) return [];

  const declared = (manifest as Record<string, unknown>)[RULE_DIRECTORIES_FIELD];
  if (!Array.isArray(declared)) return [];

  return declared.filter(
    (ruleDirectory): ruleDirectory is string => typeof ruleDirectory === "string",
  );
};

export const lintRuleWorkspacesIn = (repositoryRoot: string): readonly LintRuleWorkspace[] =>
  declaredWorkspaceDirs(repositoryRoot)
    .map((workspaceDir) => ({
      workspaceDir,
      ruleDirectories: ruleDirectoriesDeclaredAt({ repositoryRoot, workspaceDir }),
    }))
    .filter((workspace) => workspace.ruleDirectories.length > 0)
    .toSorted((left, right) => left.workspaceDir.localeCompare(right.workspaceDir));
