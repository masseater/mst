import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { gitExecutablePath } from "@mst/repository-checks";
import { attempt } from "es-toolkit";

import { repositoryAgnosticGitEnvironment } from "../lint/oxlint/lib/git-output.ts";

const CHECK_IGNORE_SUCCESS = 0;

const CHECK_IGNORE_NO_MATCH = 1;

const matchedSourcesIn = ({
  matcherRoot,
  patterns,
  sourcePaths,
}: {
  readonly matcherRoot: string;
  readonly patterns: readonly string[];
  readonly sourcePaths: readonly string[];
}): readonly string[] => {
  const gitEnvironment = repositoryAgnosticGitEnvironment(process.env);
  const gitExecutable = gitExecutablePath(gitEnvironment.PATH);
  const excludeFile = join(matcherRoot, "caller-ignore");
  writeFileSync(excludeFile, `${patterns.join("\n")}\n`, "utf8");
  const initialized = spawnSync(gitExecutable, ["init", "--quiet"], {
    cwd: matcherRoot,
    encoding: "utf8",
    env: gitEnvironment,
  });
  if (initialized.status !== 0) throw new Error(initialized.stderr);
  const matched = spawnSync(
    gitExecutable,
    ["-c", `core.excludesFile=${excludeFile}`, "check-ignore", "--no-index", "-z", "--stdin"],
    {
      cwd: matcherRoot,
      encoding: "utf8",
      env: gitEnvironment,
      input: `${sourcePaths.join("\0")}\0`,
    },
  );
  if (matched.status !== CHECK_IGNORE_SUCCESS && matched.status !== CHECK_IGNORE_NO_MATCH) {
    throw new Error(matched.stderr);
  }
  return matched.stdout.split("\0").filter((sourcePath) => sourcePath !== "");
};

export const ignoredLintSources = ({
  patterns,
  sourcePaths,
}: {
  readonly patterns: readonly string[];
  readonly sourcePaths: readonly string[];
}): readonly string[] | null => {
  if (
    patterns.some(
      (pattern) => pattern.includes("\0") || pattern.includes("\n") || pattern.includes("\r"),
    )
  )
    return null;
  if (patterns.length === 0 || sourcePaths.length === 0) return [];
  const [failure, ignored] = attempt(() => {
    const matcherRoot = mkdtempSync(join(tmpdir(), "dont-review-it-ignore-reach-"));
    try {
      return matchedSourcesIn({ matcherRoot, patterns, sourcePaths });
    } finally {
      rmSync(matcherRoot, { force: true, recursive: true });
    }
  });
  return failure === null ? ignored : null;
};
