import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, test, onTestFinished } from "vite-plus/test";

import { repositoryAgnosticGitEnvironment } from "../lint/oxlint/lib/git-output.ts";
import { runChecks } from "../run-checks.ts";
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

  test.each([
    "env -- vp test",
    "env -i TEST_MODE=1 vp test",
    "env -C . vp test",
    'env -S "vp test"',
    "command -- vp test",
    "exec vp test",
    "spool -- vp test",
    "npx --yes vitest",
    "pnpm exec vitest",
    "npm exec -- vitest",
    "npm exec --package=vitest -- vitest",
    "vp exec --filter app -- vitest",
    "vp exec --resume-from app -- vitest",
  ])("the transparent test wrapper is inspectable: %s", (command) => {
    const root = repositoryWith({
      "package.json": JSON.stringify({ scripts: { test: command } }),
    });
    expect(testCommandOverrideProblems(root)).toStrictEqual([]);
  });

  test.each([
    "env -- vp test --changed HEAD",
    "env -i TEST_MODE=1 vp test --changed HEAD",
    'env -S "vp test --changed HEAD"',
    "command vp test --changed HEAD",
    "exec vp test --changed HEAD",
    "spool -- vp test --changed HEAD",
    "npx --yes vitest --changed HEAD",
    "pnpm exec vitest --changed HEAD",
    "npm exec -- vitest --changed HEAD",
    "npm exec --package=vitest -- vitest --changed HEAD",
    "npm exec vitest -- --changed HEAD",
    "vp exec --filter app -- vitest --changed HEAD",
    "vp exec --resume-from app -- vitest --changed HEAD",
  ])("the transparent test wrapper cannot hide changed selection: %s", (command) => {
    const root = repositoryWith({
      "package.json": JSON.stringify({ scripts: { test: command } }),
    });
    expect(testCommandOverrideProblems(root)).toHaveLength(1);
  });

  test.each([
    "env -Z vp test --changed HEAD",
    'env -S "vp test --changed HEAD && echo hidden"',
    "spool vp test --changed HEAD",
    'npx -c "vitest --changed HEAD"',
    'npm exec -c "vitest --changed HEAD"',
    'vp exec -c "vitest --changed HEAD"',
    'sh -c "vp test --changed HEAD"',
    'sh -c "vp test --changed HEAD" && vp test',
  ])("an opaque test wrapper fails closed: %s", (command) => {
    const root = repositoryWith({
      "package.json": JSON.stringify({ scripts: { test: command } }),
    });
    expect(testCommandOverrideProblems(root).map(formatTestCommandOverrideProblem)).toStrictEqual([
      expect.stringContaining("statically inspectable command"),
    ]);
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
          filtered: "vp test --coverage src/feature.test.ts",
          exclude: 'vp test --coverage.exclude="src/**"',
          disable: "vp run -r test --coverage=false",
          negated: "vp test --no-coverage",
          separateFalse: "vitest --coverage false",
          separateTrue: "vp test --coverage true",
          changedFromHead: "vp test --changed HEAD",
          changedFromRef: "vitest --changed=main",
          threshold: "vp run app#test --coverage.thresholds.lines=0",
        },
      }),
    });
    const problems = testCommandOverrideProblems(root);
    expect(problems).toHaveLength(8);
    expect(problems.map(formatTestCommandOverrideProblem)).toStrictEqual([
      expect.stringContaining("only bare `--coverage` may enable"),
      expect.stringContaining("only bare `--coverage` may enable"),
      expect.stringContaining("only bare `--coverage` may enable"),
      expect.stringContaining("only bare `--coverage` may enable"),
      expect.stringContaining("only bare `--coverage` may enable"),
      expect.stringContaining("only bare `--coverage` may enable"),
      expect.stringContaining("only bare `--coverage` may enable"),
      expect.stringContaining("only bare `--coverage` may enable"),
    ]);
  });

  test("a double dash cannot hide options that the workspace guard appends to the test script", () => {
    const root = repositoryWith({
      "package.json": JSON.stringify({
        scripts: { test: "vp test -- --coverage.exclude=fixture --config fixture" },
      }),
    });
    expect(testCommandOverrideProblems(root)).toHaveLength(2);
  });

  test("Vite Plus run option values are not mistaken for the test task selector", () => {
    const root = repositoryWith({
      "package.json": JSON.stringify({
        scripts: {
          filteredBuild: "vp run --filter test build --coverage.exclude=src/**",
          filteredLint: "vp run -F test lint --config arbitrary.ts",
          filteredTest: "vp run --filter app test --changed HEAD",
        },
      }),
    });
    expect(testCommandOverrideProblems(root)).toHaveLength(1);
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
    const root = mkdtempSync(join(tmpdir(), "dont-review-it-coverage-"));
    onTestFinished(() => {
      rmSync(root, { recursive: true, force: true });
    });
    symlinkSync(join(process.cwd(), "node_modules"), join(root, "node_modules"), "dir");
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
        'import { defineConfig } from "vite-plus";\nexport default defineConfig({ test: { coverage: { include: ["src/**/*.ts"], reportsDirectory: ".coverage-unimported-command", thresholds: { 100: true, perFile: true } } } });\n',
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
    expect(bypassed.status, `${bypassed.stdout}\n${bypassed.stderr}`).toBe(0);

    expect(runChecks(root).problems.join("\n")).toContain(
      "must not override coverage settings or reduce the coverage source universe",
    );

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

  test("changed test selection cannot pass the workspace coverage gate with unchanged production files omitted", () => {
    const root = mkdtempSync(join(tmpdir(), "dont-review-it-changed-coverage-"));
    onTestFinished(() => {
      rmSync(root, { recursive: true, force: true });
    });
    symlinkSync(join(process.cwd(), "node_modules"), join(root, "node_modules"), "dir");
    const files = {
      "package.json": JSON.stringify({
        private: true,
        type: "module",
        scripts: { test: "env TEST_MODE=coverage vp test --changed HEAD" },
      }),
      "src/covered.ts": "export const covered = (): number => 1;\n",
      "src/uncovered.ts": "export const uncovered = (): number => 2;\n",
      "src/covered.test.ts":
        'import { expect, test } from "vite-plus/test";\nimport { covered } from "./covered.ts";\ntest("covered", () => { expect(covered()).toBe(1); });\n',
      "vite.config.ts":
        'import { defineConfig } from "vite-plus";\nexport default defineConfig({ test: { coverage: { include: ["src/**/*.ts"], reportsDirectory: ".coverage-changed-command", thresholds: { 100: true, perFile: true } } } });\n',
    };
    for (const [relativePath, source] of Object.entries(files)) {
      const target = join(root, relativePath);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, source, "utf8");
    }
    const globalConfig = join(root, ".fixture-gitconfig");
    writeFileSync(globalConfig, "", "utf8");
    const gitEnvironment = {
      ...repositoryAgnosticGitEnvironment(process.env),
      GIT_CONFIG_GLOBAL: globalConfig,
      GIT_CONFIG_NOSYSTEM: "1",
    };
    const initialized = spawnSync("git", ["init"], {
      cwd: root,
      encoding: "utf8",
      env: gitEnvironment,
    });
    expect(initialized.status, `${initialized.stdout}\n${initialized.stderr}`).toBe(0);
    const configuredEmail = spawnSync("git", ["config", "user.email", "probe@example.invalid"], {
      cwd: root,
      encoding: "utf8",
      env: gitEnvironment,
    });
    expect(configuredEmail.status, `${configuredEmail.stdout}\n${configuredEmail.stderr}`).toBe(0);
    const configuredName = spawnSync("git", ["config", "user.name", "coverage-probe"], {
      cwd: root,
      encoding: "utf8",
      env: gitEnvironment,
    });
    expect(configuredName.status, `${configuredName.stdout}\n${configuredName.stderr}`).toBe(0);
    const added = spawnSync("git", ["add", "."], {
      cwd: root,
      encoding: "utf8",
      env: gitEnvironment,
    });
    expect(added.status, `${added.stdout}\n${added.stderr}`).toBe(0);
    const committed = spawnSync("git", ["commit", "-m", "baseline"], {
      cwd: root,
      encoding: "utf8",
      env: gitEnvironment,
    });
    expect(committed.status, `${committed.stdout}\n${committed.stderr}`).toBe(0);
    writeFileSync(
      join(root, "src/covered.ts"),
      "export const covered = (): number => 1 as const;\n",
      "utf8",
    );

    const bypassed = spawnSync("vp", ["run", "test", "--coverage"], {
      cwd: root,
      encoding: "utf8",
      env: gitEnvironment,
    });
    expect(bypassed.status, `${bypassed.stdout}\n${bypassed.stderr}`).toBe(0);
    expect(runChecks(root).problems.join("\n")).toContain(
      "must not override coverage settings or reduce the coverage source universe",
    );
  }, 30_000);
});
