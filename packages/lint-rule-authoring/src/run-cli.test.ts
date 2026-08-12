import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, onTestFinished, test } from "vite-plus/test";

import { runLintRuleAuthoring } from "./run-cli.ts";

const repositoryWith = (files: Readonly<Record<string, string>>): string => {
  const root = mkdtempSync(join(tmpdir(), "lint-rule-authoring-cli-"));
  onTestFinished(() => {
    rmSync(root, { recursive: true, force: true });
  });
  for (const [path, text] of Object.entries(files)) {
    const target = join(root, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, text, "utf8");
  }
  return root;
};

const declaringRepository = (): string =>
  repositoryWith({
    "pnpm-workspace.yaml": "packages:\n  - packages/*\n",
    "packages/example/package.json": JSON.stringify({ lintRules: ["src/rules"] }),
    "packages/example/src/rules/no-thing--allow-it.ts": `export const rule = {
  name: "no-thing--allow-it",
  meta: { docs: { description: "Disallow the thing" }, messages: { report: "No." } },
  create: () => ({}),
};
`,
  });

describe("run-cli", () => {
  test("check stays silent and exits zero when every index is fresh", () => {
    const root = repositoryWith({});

    expect(runLintRuleAuthoring(["check", "--repository-root", root])).toStrictEqual({
      exitCode: 0,
      out: "",
      error: "",
    });
  });

  test("check given no repository root scans the working directory", () => {
    const run = runLintRuleAuthoring(["check"]);

    expect(run.exitCode).toBe(0);
    expect(run.error).toBe("");
  });

  test("check reports a missing index and exits one", () => {
    const run = runLintRuleAuthoring(["check", "--repository-root", declaringRepository()]);

    expect(run.exitCode).toBe(1);
    expect(run.out).toContain("packages/example/docs/lint/index.md");
    expect(run.error).toBe("");
  });

  test("check --write regenerates the indexes and the next check exits zero", () => {
    const root = declaringRepository();

    expect(runLintRuleAuthoring(["check", "--write", "--repository-root", root])).toStrictEqual({
      exitCode: 0,
      out: "",
      error: "",
    });
    expect(runLintRuleAuthoring(["check", "--repository-root", root])).toStrictEqual({
      exitCode: 0,
      out: "",
      error: "",
    });
  });

  test("an unknown command returns the usage as an error and exits two", () => {
    const run = runLintRuleAuthoring(["publish"]);

    expect(run.exitCode).toBe(2);
    expect(run.out).toBe("");
    expect(run.error).toContain(
      "Usage: lint-rule-authoring check [--write] [--repository-root <path>]",
    );
  });

  test("no command at all is answered the same way an unknown command is", () => {
    expect(runLintRuleAuthoring([])).toStrictEqual(runLintRuleAuthoring(["publish"]));
  });

  test("a repository root that is not a directory exits two instead of scanning nothing", () => {
    const root = repositoryWith({});

    const run = runLintRuleAuthoring(["check", "--repository-root", join(root, "missing")]);

    expect(run.exitCode).toBe(2);
    expect(run.out).toBe("");
    expect(run.error).toContain("missing");
  });

  test("an unknown option exits two instead of falling back to a default", () => {
    const run = runLintRuleAuthoring(["check", "--repo-root", "."]);

    expect(run.exitCode).toBe(2);
    expect(run.out).toBe("");
    expect(run.error).not.toBe("");
  });
});
