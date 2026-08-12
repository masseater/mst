import { execFileSync } from "node:child_process";
import { dirname, isAbsolute, relative, resolve } from "node:path";

import { attempt } from "es-toolkit";

import { pathIsInside } from "./path-is-inside.ts";

const gitCheckIgnoreStatus = (
  repositoryRoot: string,
  repositoryPath: string,
): "ignored" | "not-ignored" | "unknown" => {
  const [failure] = attempt(() =>
    execFileSync("git", ["check-ignore", "--quiet", "--", repositoryPath], {
      cwd: repositoryRoot,
      stdio: "ignore",
    }),
  );
  if (failure === null) return "ignored";
  if (typeof failure === "object" && "status" in failure) {
    return failure.status === 1 ? "not-ignored" : "unknown";
  }
  return "unknown";
};

const nearestCheckablePath = (repositoryRoot: string, repositoryPath: string): boolean => {
  const status = gitCheckIgnoreStatus(repositoryRoot, repositoryPath);
  if (status !== "unknown") return status === "ignored";
  const parent = dirname(repositoryPath);
  return parent !== "." && parent !== repositoryPath
    ? nearestCheckablePath(repositoryRoot, parent)
    : false;
};

export const isGitIgnoredSource = (sourcePath: string, repositoryRoot: string): boolean => {
  const root = resolve(repositoryRoot);
  const source = resolve(root, isAbsolute(sourcePath) ? relative(root, sourcePath) : sourcePath);
  if (!pathIsInside(root, source)) return false;
  const repositoryPath = relative(root, source);
  return repositoryPath !== "" && nearestCheckablePath(root, repositoryPath);
};
