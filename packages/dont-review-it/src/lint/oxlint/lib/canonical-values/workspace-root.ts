import { readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { attempt } from "es-toolkit";

import { parseJson } from "./read-json-file.ts";

const WORKSPACE_MANIFEST_FILE_NAMES: readonly string[] = [
  "pnpm-workspace.yaml",
  "pnpm-workspace.yml",
];

const MANIFEST_FILE_NAME = "package.json";

const WORKSPACES_FIELD = "workspaces";

const isFile = (path: string): boolean => attempt(() => statSync(path).isFile())[1] === true;

const manifestDeclaresWorkspaces = (directory: string): boolean => {
  const path = join(directory, MANIFEST_FILE_NAME);
  const [, manifest] = attempt(() => parseJson(readFileSync(path, "utf8")));

  if (manifest === null || typeof manifest !== "object") return false;
  return WORKSPACES_FIELD in manifest;
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
