import { readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const WORKSPACE_MANIFEST_FILE_NAMES: readonly string[] = [
  "pnpm-workspace.yaml",
  "pnpm-workspace.yml",
];

const MANIFEST_FILE_NAME = "package.json";

const WORKSPACES_FIELD = "workspaces";

const isFile = (path: string): boolean => {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
};

const parseJson: (text: string) => unknown = JSON.parse;

const manifestDeclaresWorkspaces = (directory: string): boolean => {
  const path = join(directory, MANIFEST_FILE_NAME);
  if (!isFile(path)) return false;
  let manifest: unknown;
  try {
    manifest = parseJson(readFileSync(path, "utf8"));
  } catch {
    return false;
  }
  if (manifest === null || typeof manifest !== "object") return false;
  return WORKSPACES_FIELD in manifest && manifest.workspaces !== undefined;
};

const isWorkspaceRoot = (directory: string): boolean =>
  WORKSPACE_MANIFEST_FILE_NAMES.some((name) => isFile(join(directory, name))) ||
  manifestDeclaresWorkspaces(directory);

export const findWorkspaceRoot = (startDirectory: string): string => {
  const start = resolve(startDirectory);
  let directory = start;
  for (;;) {
    if (isWorkspaceRoot(directory)) return directory;
    const parent = dirname(directory);
    if (parent === directory) return start;
    directory = parent;
  }
};
