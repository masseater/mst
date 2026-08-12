import { readdirSync } from "node:fs";
import { join, relative } from "node:path";

import { readUnlessMissing } from "@mst/repository-checks";

import type { LintRuleWorkspace } from "./lint-rule-workspaces.ts";

const EXCLUDED_DIRECTORY_NAMES: readonly string[] = ["node_modules", "dist", "coverage", "lib"];

const SOURCE_FILE_SUFFIXES: readonly string[] = [".ts", ".tsx", ".js", ".jsx"];

const TEST_FILE_MARKER = ".test.";

const TYPE_DECLARATION_SUFFIX = ".d.ts";

const isRuleSourceFileName = (fileName: string): boolean =>
  SOURCE_FILE_SUFFIXES.some((suffix) => fileName.endsWith(suffix)) &&
  !fileName.includes(TEST_FILE_MARKER) &&
  !fileName.endsWith(TYPE_DECLARATION_SUFFIX);

const sourceFilesUnder = (directory: string): readonly string[] => {
  const dirents = readUnlessMissing(() => readdirSync(directory, { withFileTypes: true }));
  return (dirents ?? []).flatMap((dirent) => {
    if (dirent.isDirectory()) {
      return EXCLUDED_DIRECTORY_NAMES.includes(dirent.name)
        ? []
        : sourceFilesUnder(join(directory, dirent.name));
    }
    return isRuleSourceFileName(dirent.name) ? [join(directory, dirent.name)] : [];
  });
};

export const ruleSourceFilesIn = ({
  repositoryRoot,
  workspace,
}: {
  readonly repositoryRoot: string;
  readonly workspace: LintRuleWorkspace;
}): readonly string[] => {
  const workspaceRoot = join(repositoryRoot, workspace.workspaceDir);
  return workspace.ruleDirectories
    .flatMap((ruleDirectory) => sourceFilesUnder(join(workspaceRoot, ruleDirectory)))
    .map((absolutePath) => relative(workspaceRoot, absolutePath))
    .toSorted();
};
