import { parseSync } from "oxc-parser";

import { readTextFile } from "../canonical-values/source-files.ts";
import {
  astFieldsOf,
  constantSpecifiersIn,
  couplingEdgesUnder,
  type CouplingEdge,
} from "./coupling-edges.ts";
import { isInsideDirectory, publicEntryFilesOf } from "./package-entries.ts";
import { resolveCoupling } from "./specifier-resolution.ts";

import type { AstFields } from "../ast-node.ts";

export const parsedProgramAt = (path: string): AstFields | null => {
  const source = readTextFile(path);
  if (source === null) return null;
  return astFieldsOf(parseSync(path, source).program);
};

const edgesByFile = new Map<string, readonly CouplingEdge[]>();

export const couplingEdgesOf = (file: string): readonly CouplingEdge[] => {
  const remembered = edgesByFile.get(file);
  if (remembered !== undefined) return remembered;

  const program = parsedProgramAt(file);
  const edges =
    program === null ? [] : couplingEdgesUnder(program, constantSpecifiersIn(program.body));
  edgesByFile.set(file, edges);
  return edges;
};

export const couplingTargetsOf = ({
  file,
  workspaceRoot,
}: {
  readonly file: string;
  readonly workspaceRoot: string;
}): readonly string[] =>
  couplingEdgesOf(file)
    .map((edge) => resolveCoupling({ specifier: edge.specifier, fromFile: file, workspaceRoot }))
    .flatMap((resolved) => (resolved?.kind === "repositoryFile" ? [resolved.path] : []));

const reachedFrom = ({
  frontier,
  reached,
  packageDirectory,
  workspaceRoot,
}: {
  readonly frontier: readonly string[];
  readonly reached: ReadonlySet<string>;
  readonly packageDirectory: string;
  readonly workspaceRoot: string;
}): ReadonlySet<string> => {
  const fresh = frontier.filter((file) => !reached.has(file));
  if (fresh.length === 0) return reached;

  const beyond = fresh
    .flatMap((file) => couplingTargetsOf({ file, workspaceRoot }))
    .filter((path) => isInsideDirectory({ path, directory: packageDirectory }));
  return reachedFrom({
    frontier: beyond,
    reached: new Set([...reached, ...fresh]),
    packageDirectory,
    workspaceRoot,
  });
};

const reachableByPackage = new Map<string, ReadonlySet<string> | null>();

export const entryReachableFilesOf = ({
  packageDirectory,
  workspaceRoot,
}: {
  readonly packageDirectory: string;
  readonly workspaceRoot: string;
}): ReadonlySet<string> | null => {
  const remembered = reachableByPackage.get(packageDirectory);
  if (remembered !== undefined) return remembered;

  const entries = publicEntryFilesOf(packageDirectory);
  const reachable =
    entries === null
      ? null
      : reachedFrom({ frontier: entries, reached: new Set(), packageDirectory, workspaceRoot });
  reachableByPackage.set(packageDirectory, reachable);
  return reachable;
};
