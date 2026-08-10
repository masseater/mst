import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { attempt } from "es-toolkit";

import { MANIFEST_FILE_NAME } from "./package-manifest.ts";
import { parseJson } from "./read-json-file.ts";
import { isFile } from "./source-files.ts";

const WORKSPACE_MANIFEST_FILE_NAMES: readonly string[] = [
  "pnpm-workspace.yaml",
  "pnpm-workspace.yml",
];

const WORKSPACES_FIELD = "workspaces";

const manifestDeclaresWorkspaces = (directory: string): boolean => {
  const path = join(directory, MANIFEST_FILE_NAME);
  const [, manifest] = attempt(() => parseJson(readFileSync(path, "utf8")));

  if (manifest === null || typeof manifest !== "object") return false;
  return WORKSPACES_FIELD in manifest && manifest.workspaces !== undefined;
};

const isWorkspaceRoot = (directory: string): boolean =>
  WORKSPACE_MANIFEST_FILE_NAMES.some((name) => isFile(join(directory, name))) ||
  manifestDeclaresWorkspaces(directory);

const nearestWorkspaceRoot = (directory: string): string | null => {
  if (isWorkspaceRoot(directory)) return directory;
  const parent = dirname(directory);
  return parent === directory ? null : nearestWorkspaceRoot(parent);
};

export const findWorkspaceRoot = (startDirectory: string): string => {
  const start = resolve(startDirectory);
  return nearestWorkspaceRoot(start) ?? start;
};
