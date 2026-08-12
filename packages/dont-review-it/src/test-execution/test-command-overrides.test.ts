import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, test, onTestFinished } from "vite-plus/test";

import { runDontReviewIt } from "../run-cli.ts";
import {
  formatTestCommandOverrideProblem,
  testCommandOverrideProblems,
} from "./test-command-overrides.ts";

const repositoryWith = (files: Readonly<Record<string, string>>): string => {
  const root = mkdtempSync(join(tmpdir(), "dont-review-it-test-config-"));
  onTestFinished(() => {
    rmSync(root, { recursive: true, force: true });
  });
  for (const [relativePath, source] of Object.entries(files)) {
    const target = join(root, relativePath);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, source, "utf8");
  }
  return root;
};

describe("testCommandOverrideProblems", () => {
  test("a single-package repository scans its root test script without a workspace definition", () => {
    const root = repositoryWith({
      "package.json": JSON.stringify({ scripts: { test: "vp test -c arbitrary.ts" } }),
    });
    expect(testCommandOverrideProblems(root)).toHaveLength(1);
  });

  test("an invalid workspace definition is left to the workspace parser problem", () => {
    const root = repositoryWith({ "pnpm-workspace.yaml": "packages: [" });
    expect(testCommandOverrideProblems(root)).toStrictEqual([]);
  });

  test("auto-discovered test configs and unrelated config flags pass", () => {
    const root = repositoryWith({
      "pnpm-workspace.yaml": "packages:\n  - packages/*\n",
      "package.json": JSON.stringify({
        scripts: {
          test: "vp test",
          lint: "vp lint --config rules",
          build: "vp run build",
          noop: "CI=1",
        },
      }),
      "packages/app/package.json": JSON.stringify({ scripts: { test: "vp test --coverage" } }),
    });
    expect(testCommandOverrideProblems(root)).toStrictEqual([]);
  });

  test("root and workspace test commands cannot inject a different config", () => {
    const root = repositoryWith({
      "pnpm-workspace.yaml": "packages:\n  - packages/*\n",
      "package.json": JSON.stringify({ scripts: { test: "vp test --config=arbitrary.ts" } }),
      "packages/app/package.json": JSON.stringify({
        scripts: { test: "vitest --coverage --config custom.ts", metadata: 1 },
      }),
    });
    const problems = testCommandOverrideProblems(root);
    expect(problems).toHaveLength(2);
    expect(problems.map(formatTestCommandOverrideProblem)).toStrictEqual([
      "package.json The test script must not select a test config with `--config` or `-c`. Remove that argument and merge the test settings into the auto-discovered `vite.config` or `vitest.config`, so lint and the coverage gate inspect the same source universe.",
      "packages/app/package.json The test script must not select a test config with `--config` or `-c`. Remove that argument and merge the test settings into the auto-discovered `vite.config` or `vitest.config`, so lint and the coverage gate inspect the same source universe.",
    ]);
  });

  test("quoting the config option does not hide test config selection", () => {
    const root = repositoryWith({
      "pnpm-workspace.yaml": "packages:\n  - packages/*\n",
      "package.json": JSON.stringify({
        scripts: { test: "vp test '--config' arbitrary.ts" },
      }),
    });
    expect(testCommandOverrideProblems(root)).toHaveLength(1);
  });

  test("short config options and quoted executables are detected", () => {
    const root = repositoryWith({
      "package.json": JSON.stringify({
        scripts: {
          direct: `'vp' test -c=arbitrary.ts`,
          binary: "./node_modules/.bin/vitest -c arbitrary.ts",
        },
      }),
    });
    expect(testCommandOverrideProblems(root)).toHaveLength(2);
  });

  test("leading environment assignments do not hide the test command", () => {
    const root = repositoryWith({
      "package.json": JSON.stringify({
        scripts: { test: "CI=1 NODE_ENV=test vp test --coverage.exclude=src/**" },
      }),
    });
    expect(testCommandOverrideProblems(root)).toHaveLength(1);
  });

  test("words printed by another command are not treated as executed test commands", () => {
    const root = repositoryWith({
      "package.json": JSON.stringify({ scripts: { explain: "echo vp test --config x.ts" } }),
    });
    expect(testCommandOverrideProblems(root)).toStrictEqual([]);
  });

  test("a later shell command is inspected independently", () => {
    const root = repositoryWith({
      "package.json": JSON.stringify({
        scripts: { test: 'echo preparing && "vp" test --config x.ts' },
      }),
    });
    expect(testCommandOverrideProblems(root)).toHaveLength(1);
  });

  test("coverage CLI overrides are rejected while bare coverage passes", () => {
    const root = repositoryWith({
      "package.json": JSON.stringify({
        scripts: {
          safe: "vp test --coverage",
          exclude: 'vp test --coverage.exclude="src/**"',
          disable: "vp run -r test --coverage=false",
          threshold: "vp run app#test --coverage.thresholds.lines=0",
        },
      }),
    });
    const problems = testCommandOverrideProblems(root);
    expect(problems).toHaveLength(3);
    expect(problems.map(formatTestCommandOverrideProblem)).toStrictEqual([
      expect.stringContaining("only bare `--coverage` may enable"),
      expect.stringContaining("only bare `--coverage` may enable"),
      expect.stringContaining("only bare `--coverage` may enable"),
    ]);
  });

  test("options after a double dash belong to the test process instead of the test runner", () => {
    const root = repositoryWith({
      "package.json": JSON.stringify({
        scripts: { test: "vp test -- --coverage.exclude=fixture --config fixture" },
      }),
    });
    expect(testCommandOverrideProblems(root)).toStrictEqual([]);
  });

  test("recursive workspace patterns include nested packages and apply negations", () => {
    const root = repositoryWith({
      "pnpm-workspace.yaml": "packages:\n  - packages/**\n  - '!packages/ignored/**'\n",
      "package.json": JSON.stringify({}),
      "packages/features/app/package.json": JSON.stringify({
        scripts: { test: "vp test --config app.ts" },
      }),
      "packages/ignored/app/package.json": JSON.stringify({
        scripts: { test: "vp test --config ignored.ts" },
      }),
    });
    const problems = testCommandOverrideProblems(root);
    expect(problems).toHaveLength(1);
    expect(problems[0]?.file).toBe("packages/features/app/package.json");
  });

  test("coverage includes unimported production files and the CLI rejects the override that hides them", () => {
    const cache = join(process.cwd(), ".cache");
    mkdirSync(cache, { recursive: true });
    const root = mkdtempSync(join(cache, "dont-review-it-coverage-"));
    onTestFinished(() => {
      rmSync(root, { recursive: true, force: true });
    });
    const files = {
      "package.json": JSON.stringify({
        type: "module",
        scripts: { test: "vp test --coverage --coverage.exclude=src/**" },
      }),
      "src/covered.ts": "export const covered = (): number => 1;\n",
      "src/uncovered.ts": "export const uncovered = (): number => 2;\n",
      "src/covered.test.ts":
        'import { expect, test } from "vite-plus/test";\nimport { covered } from "./covered.ts";\ntest("covered", () => { expect(covered()).toBe(1); });\n',
      "vite.config.ts":
        'import { defineConfig } from "vite-plus";\nexport default defineConfig({ test: { coverage: { include: ["src/**/*.ts"], thresholds: { 100: true, perFile: true } } } });\n',
    };
    for (const [relativePath, source] of Object.entries(files)) {
      const target = join(root, relativePath);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, source, "utf8");
    }

    const incomplete = spawnSync("vp", ["test", "--coverage"], {
      cwd: root,
      encoding: "utf8",
    });
    expect(incomplete.status, `${incomplete.stdout}\n${incomplete.stderr}`).not.toBe(0);

    const bypassed = spawnSync("vp", ["test", "--coverage", "--coverage.exclude=src/**"], {
      cwd: root,
      encoding: "utf8",
    });
    expect(bypassed.status).toBe(0);

    expect(runDontReviewIt(["check", "--repository-root", root]).exitCode).toBe(1);

    writeFileSync(
      join(root, "src/covered.test.ts"),
      'import { expect, test } from "vite-plus/test";\nimport { covered } from "./covered.ts";\nimport { uncovered } from "./uncovered.ts";\ntest("covered", () => { expect([covered(), uncovered()]).toStrictEqual([1, 2]); });\n',
      "utf8",
    );
    const complete = spawnSync("vp", ["test", "--coverage"], {
      cwd: root,
      encoding: "utf8",
    });
    expect(complete.status).toBe(0);
  }, 30_000);
});
