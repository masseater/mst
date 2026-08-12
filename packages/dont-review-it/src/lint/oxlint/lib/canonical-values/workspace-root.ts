import { dirname, join, resolve } from "node:path";

import { MANIFEST_FILE_NAME } from "./package-manifest.ts";
import { readJsonFile } from "./read-json-file.ts";
import { isFile } from "./source-files.ts";

const WORKSPACE_MANIFEST_FILE_NAMES: readonly string[] = [
  "pnpm-workspace.yaml",
  "pnpm-workspace.yml",
];

const WORKSPACES_FIELD = "workspaces";

const manifestDeclaresWorkspaces = (directory: string): boolean => {
  const manifest = readJsonFile(join(directory, MANIFEST_FILE_NAME));
  if (manifest === null || typeof manifest !== "object") return false;
  return WORKSPACES_FIELD in manifest;
};

const isWorkspaceRoot = (directory: string): boolean =>
  WORKSPACE_MANIFEST_FILE_NAMES.some((spelled) => isFile(join(directory, spelled))) ||
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
