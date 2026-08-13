import { existsSync } from "node:fs";
import { relative, resolve } from "node:path";

import { pathIsInside } from "./path-is-inside.ts";

export const OUT_OF_SCOPE_FILE_NAME =
  /\.(?:fixture|mock|test|spec|stories|story)(?:[.-][^.]+)*\.[cm]?[jt]sx?$/u;

const OUT_OF_SCOPE_DIRECTORIES: ReadonlySet<string> = new Set([
  "__fixtures__",
  "__mocks__",
  "__stories__",
  "__tests__",
  ".cache",
  ".local-agents",
  "coverage",
  "dist",
  "dist-ssr",
  "fixtures",
  "test",
  "tests",
]);

export const isOutOfScopeSource = (filename: string, repositoryRoot?: string): boolean => {
  const absoluteFilename = resolve(filename);
  const absoluteRepositoryRoot = repositoryRoot === undefined ? null : resolve(repositoryRoot);
  const sourcePath =
    absoluteRepositoryRoot !== null && pathIsInside(absoluteRepositoryRoot, absoluteFilename)
      ? relative(absoluteRepositoryRoot, absoluteFilename)
      : filename;
  const segments = sourcePath.split(/[/\\]/u);
  if (segments.includes("node_modules")) return false;
  const fileName = segments.at(-1) as string;
  if (OUT_OF_SCOPE_FILE_NAME.test(fileName)) return true;
  return segments.slice(0, -1).some((segment) => OUT_OF_SCOPE_DIRECTORIES.has(segment));
};

export const isOutOfScopeLintSource = (filename: string, repositoryRoot: string): boolean =>
  isOutOfScopeSource(filename, existsSync(filename) ? repositoryRoot : undefined);
