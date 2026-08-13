import { join, relative } from "node:path";

import { parse } from "jsonc-parser";

import { fileTextOrNull } from "../file-text.ts";

import type { RepositoryProblem } from "@mst/repository-checks";

const NARROWING_KEYS = ["exclude", "files", "include"];

const narrowedProgram = (named: string): string =>
  `A tsconfig that governs specification tests must not narrow the files it checks with ${named}, because a specs/ directory dropped from the program loses type checking silently while every check stays green. Delete ${named} and let the tsconfig cover the whole workspace.`;

const governingTsconfigOf = async (input: {
  readonly repositoryRoot: string;
  readonly workspaceDirectory: string;
}): Promise<{ readonly path: string; readonly source: string } | null> => {
  const workspacePath = join(input.workspaceDirectory, "tsconfig.json");
  const workspaceSource = await fileTextOrNull(workspacePath);
  if (workspaceSource !== null) return { path: workspacePath, source: workspaceSource };

  const rootPath = join(input.repositoryRoot, "tsconfig.json");
  const rootSource = await fileTextOrNull(rootPath);
  return rootSource === null ? null : { path: rootPath, source: rootSource };
};

export const tsconfigScopeProblemsOf = async (input: {
  readonly repositoryRoot: string;
  readonly workspaceDirectory: string;
}): Promise<readonly RepositoryProblem[]> => {
  const governing = await governingTsconfigOf(input);
  if (governing === null) return [];

  const parsedNode: unknown = parse(governing.source);
  if (typeof parsedNode !== "object" || parsedNode === null || Array.isArray(parsedNode)) return [];

  const file = relative(input.repositoryRoot, governing.path);
  return NARROWING_KEYS.filter((named) => named in parsedNode).map((named) => ({
    file,
    line: null,
    message: narrowedProgram(named),
  }));
};
