import { memoize } from "es-toolkit";
import { parseSync } from "oxc-parser";

import { readTextFile } from "../canonical-values/source-files.ts";
import { segmentsOf } from "../path-segments.ts";
import { toPosixPath } from "../posix-path.ts";
import { isInsideDirectory } from "../setup-modules/package-entries.ts";
import { repositoryFilesFor } from "../setup-modules/specifier-resolution.ts";
import { assetsStemOf } from "./assets-files.ts";

import type { SpecStatement } from "./subject-expressions.ts";

type Reading = {
  readonly specifier: string;
  readonly fromFile: string;
  readonly workspaceRoot: string;
  readonly markers: ReadonlySet<string>;
  readonly visited: ReadonlySet<string>;
};

const isInsideRepository = (path: string, workspaceRoot: string): boolean =>
  isInsideDirectory({ path, directory: workspaceRoot }) &&
  !segmentsOf({ path: toPosixPath(path), separator: "/" }).includes("node_modules");

const forwardingSpecifiersIn = (writtenBody: readonly SpecStatement[]): readonly string[] =>
  writtenBody.flatMap((statement) => {
    if (statement.type === "ExportAllDeclaration") return [statement.source.value];
    if (statement.type === "ExportNamedDeclaration" && statement.source !== null) {
      return [statement.source.value];
    }
    return [];
  });

const forwardedSpecifiersOf = memoize((file: string): readonly string[] => {
  const source = readTextFile(file);
  return source === null
    ? []
    : forwardingSpecifiersIn(
        parseSync(file, source).program.body.map((statement) => statement as SpecStatement),
      );
});

const assetsFrom = (file: string, reading: Reading): string | null => {
  if (reading.visited.has(file)) return null;
  if (!isInsideRepository(file, reading.workspaceRoot)) return null;
  if (assetsStemOf(file, reading.markers) !== null) return file;

  const visited = new Set([...reading.visited, file]);
  return (
    forwardedSpecifiersOf(file)
      .map((specifier) => reachedThrough({ ...reading, specifier, fromFile: file, visited }))
      .find((found) => found !== null) ?? null
  );
};

const reachedThrough = (reading: Reading): string | null =>
  repositoryFilesFor(reading)
    .map((file) => assetsFrom(file, reading))
    .find((found) => found !== null) ?? null;

export const assetsReachedBy = ({
  specifier,
  fromFile,
  workspaceRoot,
  markers,
}: {
  readonly specifier: string;
  readonly fromFile: string;
  readonly workspaceRoot: string;
  readonly markers: ReadonlySet<string>;
}): string | null =>
  reachedThrough({ specifier, fromFile, workspaceRoot, markers, visited: new Set([fromFile]) });
