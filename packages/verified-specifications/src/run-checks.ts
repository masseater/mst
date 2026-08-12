import { glob, readFile, rm, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";

import { sortBy } from "es-toolkit";

import {
  renderSpecificationsDocument,
  SPECIFICATIONS_FILE_NAME,
  type ListedSubject,
} from "./document/render.ts";
import { extractClaims } from "./extract/claims.ts";
import { fileTextOrNull } from "./file-text.ts";
import { tsconfigScopeProblemsOf } from "./scan/tsconfig-scope.ts";
import { listWorkspaces, type Workspace } from "./scan/workspaces.ts";

import type { RepositoryProblem } from "@mst/repository-checks";

const SPEC_FILE_PATTERN = "specs/*.spec.{ts,tsx}";

const STALE_DOCUMENT = `A specification list must not fall behind the tests it is extracted from, because a reader would review claims the code no longer makes. Run \`verified-specifications check --write\` (wired as \`vp run guard:fix\`) to regenerate ${SPECIFICATIONS_FILE_NAME}.`;

const ORPHAN_DOCUMENT = `A specification list must not outlive the specification tests it was extracted from, because it would keep promising behavior nothing verifies. Run \`verified-specifications check --write\` to delete this ${SPECIFICATIONS_FILE_NAME}, or restore the tests under specs/.`;

const specFilesOf = async (workspaceDirectory: string): Promise<readonly string[]> => {
  const files = await Array.fromAsync(glob(SPEC_FILE_PATTERN, { cwd: workspaceDirectory }));
  return files.toSorted();
};

const claimsOf = async (input: {
  readonly repositoryRoot: string;
  readonly workspace: Workspace;
  readonly specFiles: readonly string[];
}): Promise<{
  readonly subjects: readonly ListedSubject[];
  readonly problems: readonly RepositoryProblem[];
}> => {
  const read = await Promise.all(
    input.specFiles.map(async (file) => {
      const absolutePath = join(input.workspace.directory, file);
      const source = await readFile(absolutePath, "utf-8");
      const extracted = extractClaims({
        file: relative(input.repositoryRoot, absolutePath),
        source,
      });
      return {
        subjects: extracted.subjects.map((subject) => ({ ...subject, sourceFile: file })),
        problems: extracted.problems,
      };
    }),
  );
  return {
    subjects: read.flatMap((entry) => entry.subjects),
    problems: read.flatMap((entry) => entry.problems),
  };
};

const orphanProblemsOf = async (input: {
  readonly documentPath: string;
  readonly file: string;
  readonly published: string | null;
  readonly write: boolean;
}): Promise<readonly RepositoryProblem[]> => {
  if (input.published === null) return [];
  if (!input.write) return [{ file: input.file, line: null, message: ORPHAN_DOCUMENT }];
  await rm(input.documentPath);
  return [];
};

const documentProblemsOf = async (input: {
  readonly repositoryRoot: string;
  readonly workspace: Workspace;
  readonly subjects: readonly ListedSubject[];
  readonly hasSpecFiles: boolean;
  readonly write: boolean;
}): Promise<readonly RepositoryProblem[]> => {
  const documentPath = join(input.workspace.directory, SPECIFICATIONS_FILE_NAME);
  const file = relative(input.repositoryRoot, documentPath);
  const published = await fileTextOrNull(documentPath);
  if (!input.hasSpecFiles) {
    return orphanProblemsOf({ documentPath, file, published, write: input.write });
  }

  const rendered = renderSpecificationsDocument({
    packageName: input.workspace.packageName,
    subjects: input.subjects,
  });
  if (published === rendered) return [];
  if (!input.write) return [{ file, line: null, message: STALE_DOCUMENT }];
  await writeFile(documentPath, rendered, "utf-8");
  return [];
};

const workspaceProblemsOf = async (input: {
  readonly repositoryRoot: string;
  readonly workspace: Workspace;
  readonly write: boolean;
}): Promise<readonly RepositoryProblem[]> => {
  const specFiles = await specFilesOf(input.workspace.directory);
  const scopeProblems =
    specFiles.length === 0
      ? []
      : await tsconfigScopeProblemsOf({
          repositoryRoot: input.repositoryRoot,
          workspaceDirectory: input.workspace.directory,
        });
  const extracted = await claimsOf({
    repositoryRoot: input.repositoryRoot,
    workspace: input.workspace,
    specFiles,
  });
  if (extracted.problems.length > 0) return [...scopeProblems, ...extracted.problems];

  const documentProblems = await documentProblemsOf({
    repositoryRoot: input.repositoryRoot,
    workspace: input.workspace,
    subjects: extracted.subjects,
    hasSpecFiles: specFiles.length > 0,
    write: input.write,
  });
  return [...scopeProblems, ...documentProblems];
};

export const runChecks = async (input: {
  readonly repositoryRoot: string;
  readonly write: boolean;
}): Promise<readonly RepositoryProblem[]> => {
  const { repositoryRoot, write } = input;
  const listed = await listWorkspaces({ repositoryRoot });
  const problems = await Promise.all(
    listed.workspaces.map(async (workspace) =>
      workspaceProblemsOf({ repositoryRoot, workspace, write }),
    ),
  );
  return sortBy(
    [...listed.problems, ...problems.flat()],
    [(problem) => problem.file, (problem) => problem.line ?? 0],
  );
};
