import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { runAsyncProcess } from "@mst/dont-review-it/vitest";
import { describe, expect, it, onTestFinished } from "vite-plus/test";

import { runChecks } from "../src/run-checks.ts";

const SUBPROCESS_TIMEOUT_MS = 180_000;
const TEST_TIMEOUT_MS = 240_000;
const TEST_DEADLINE_MARGIN_MS = 5_000;

const runBeforeDeadline = async ({
  label,
  command,
  arguments_,
  deadline,
  options,
}: Readonly<{
  label: string;
  command: string;
  arguments_: readonly string[];
  deadline: number;
  options: Readonly<{ cwd: string; env?: NodeJS.ProcessEnv }>;
}>) => {
  const remaining = deadline - performance.now();
  const invocation: Parameters<typeof runAsyncProcess>[0] = {
    label,
    command,
    arguments_,
    ...options,
    timeoutMs: Math.min(SUBPROCESS_TIMEOUT_MS, remaining),
  };
  return runAsyncProcess(invocation);
};

const coverageFixtureWith = (files: Readonly<Record<string, string>>, prefix: string): string => {
  const root = mkdtempSync(join(tmpdir(), prefix));
  onTestFinished(() => {
    rmSync(root, { recursive: true, force: true });
  });
  symlinkSync(join(process.cwd(), "node_modules"), join(root, "node_modules"), "dir");
  for (const [relativePath, source] of Object.entries(files)) {
    const fixturePath = join(root, relativePath);
    mkdirSync(dirname(fixturePath), { recursive: true });
    writeFileSync(fixturePath, source, "utf8");
  }
  return root;
};

describe("カバレッジのソース集合", () => {
  it(
    "canonical test config の top-level root は値を評価する形でも報告し、副作用を自動削除しない",
    async () => {
      const deadline = performance.now() + TEST_TIMEOUT_MS - TEST_DEADLINE_MARGIN_MS;
      const fixtureRoot = mkdtempSync(join(tmpdir(), "dont-review-it-config-root-spec-"));
      onTestFinished(() => {
        rmSync(fixtureRoot, { recursive: true, force: true });
      });
      const fixture = join(fixtureRoot, "vitest.config.ts");
      const source = `const configuredRoot = () => "../other";\nexport default { root: configuredRoot(), test: { coverage: { include: ["src/**/*.{js,cjs,mjs,jsx,ts,cts,mts,tsx}"], thresholds: { 100: true, perFile: true } } } };\n`;
      writeFileSync(fixture, source, "utf8");

      const lintRun = await runBeforeDeadline({
        label: "vp lint --fix vitest.config.ts",
        command: "vp",
        arguments_: ["lint", "--fix", fixture, "--format", "json"],
        deadline,
        options: { cwd: process.cwd() },
      });
      const lintOutput = JSON.parse(lintRun.stdout) as {
        readonly diagnostics: readonly { readonly code: string; readonly message: string }[];
      };
      const rootDiagnostics = lintOutput.diagnostics.filter(
        ({ code }) =>
          code === "dont-review-it(no-partial-coverage-source-universe--include-production-files)",
      );

      expect(lintRun.status).toBe(1);
      expect(rootDiagnostics).toHaveLength(1);
      expect(rootDiagnostics[0]?.message).toContain("must not move config and source discovery");
      expect(readFileSync(fixture, "utf8")).toBe(source);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "重複した top-level root は先行値を露出させず診断だけを返す",
    async () => {
      const deadline = performance.now() + TEST_TIMEOUT_MS - TEST_DEADLINE_MARGIN_MS;
      const fixtureRoot = mkdtempSync(join(tmpdir(), "dont-review-it-duplicate-config-root-spec-"));
      onTestFinished(() => {
        rmSync(fixtureRoot, { recursive: true, force: true });
      });
      const fixture = join(fixtureRoot, "vite.config.ts");
      const source = `const configuredRoot = () => "../other";\nexport default { root: configuredRoot(), root: ".", test: { coverage: { include: ["src/**/*.{js,cjs,mjs,jsx,ts,cts,mts,tsx}"], thresholds: { 100: true, perFile: true } } } };\n`;
      writeFileSync(fixture, source, "utf8");

      const lintRun = await runBeforeDeadline({
        label: "vp lint --fix vite.config.ts",
        command: "vp",
        arguments_: ["lint", "--fix", fixture, "--format", "json"],
        deadline,
        options: { cwd: process.cwd() },
      });
      const lintOutput = JSON.parse(lintRun.stdout) as {
        readonly diagnostics: readonly { readonly code: string }[];
      };

      expect(lintRun.status).toBe(1);
      expect(
        lintOutput.diagnostics.filter(
          ({ code }) =>
            code ===
            "dont-review-it(no-partial-coverage-source-universe--include-production-files)",
        ),
      ).toHaveLength(1);
      expect(readFileSync(fixture, "utf8")).toBe(source);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "未importのproduction sourceを分母へ含め、CLIによる除外を問題にする",
    async () => {
      const deadline = performance.now() + TEST_TIMEOUT_MS - TEST_DEADLINE_MARGIN_MS;
      const root = coverageFixtureWith(
        {
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
        },
        "dont-review-it-coverage-",
      );

      const incomplete = await runBeforeDeadline({
        label: "vp test --coverage",
        command: "vp",
        arguments_: ["test", "--coverage"],
        deadline,
        options: { cwd: root },
      });
      expect(incomplete.status, `${incomplete.stdout}\n${incomplete.stderr}`).not.toBe(0);

      const bypassed = await runBeforeDeadline({
        label: "vp test --coverage --coverage.exclude=src/**",
        command: "vp",
        arguments_: ["test", "--coverage", "--coverage.exclude=src/**"],
        deadline,
        options: { cwd: root },
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
      const complete = await runBeforeDeadline({
        label: "vp test --coverage",
        command: "vp",
        arguments_: ["test", "--coverage"],
        deadline,
        options: { cwd: root },
      });
      expect(complete.status).toBe(0);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "changed選択では未変更のproduction sourceをcoverage gateから除外できない",
    async () => {
      const deadline = performance.now() + TEST_TIMEOUT_MS - TEST_DEADLINE_MARGIN_MS;
      const root = coverageFixtureWith(
        {
          "package.json": JSON.stringify({
            private: true,
            type: "module",
            scripts: { test: "vp test --changed HEAD" },
          }),
          "src/covered.ts": "export const covered = (): number => 1;\n",
          "src/uncovered.ts": "export const uncovered = (): number => 2;\n",
          "src/covered.test.ts":
            'import { expect, test } from "vite-plus/test";\nimport { covered } from "./covered.ts";\ntest("covered", () => { expect(covered()).toBe(1); });\n',
          "vite.config.ts":
            'import { defineConfig } from "vite-plus";\nexport default defineConfig({ test: { coverage: { include: ["src/**/*.ts"], reportsDirectory: ".coverage-changed-command", thresholds: { 100: true, perFile: true } } } });\n',
        },
        "dont-review-it-changed-coverage-",
      );
      const globalConfig = join(root, ".fixture-gitconfig");
      writeFileSync(globalConfig, "", "utf8");
      const {
        GIT_ALTERNATE_OBJECT_DIRECTORIES,
        GIT_COMMON_DIR,
        GIT_CONFIG,
        GIT_CONFIG_COUNT,
        GIT_CONFIG_PARAMETERS,
        GIT_DIR,
        GIT_GRAFT_FILE,
        GIT_IMPLICIT_WORK_TREE,
        GIT_INDEX_FILE,
        GIT_NO_REPLACE_OBJECTS,
        GIT_OBJECT_DIRECTORY,
        GIT_PREFIX,
        GIT_REPLACE_REF_BASE,
        GIT_SHALLOW_FILE,
        GIT_WORK_TREE,
        ...repositoryAgnosticEnvironment
      } = process.env;
      const gitEnvironment = {
        ...repositoryAgnosticEnvironment,
        GIT_CONFIG_GLOBAL: globalConfig,
        GIT_CONFIG_NOSYSTEM: "1",
      };
      for (const [command, arguments_] of [
        ["git", ["init", "--template="]],
        ["git", ["config", "user.email", "probe@example.invalid"]],
        ["git", ["config", "user.name", "coverage-probe"]],
        ["git", ["add", "."]],
        ["git", ["commit", "-m", "baseline"]],
      ] as const) {
        const commandRun = await runBeforeDeadline({
          label: `${command} ${arguments_.join(" ")}`,
          command,
          arguments_,
          deadline,
          options: { cwd: root, env: gitEnvironment },
        });
        expect(commandRun.status, `${commandRun.stdout}\n${commandRun.stderr}`).toBe(0);
      }
      writeFileSync(
        join(root, "src/covered.ts"),
        "export const covered = (): number => 1 as const;\n",
        "utf8",
      );

      const bypassed = await runBeforeDeadline({
        label: "vp run test --coverage",
        command: "vp",
        arguments_: ["run", "test", "--coverage"],
        deadline,
        options: { cwd: root, env: gitEnvironment },
      });
      expect(bypassed.status, `${bypassed.stdout}\n${bypassed.stderr}`).toBe(0);
      expect(runChecks(root).problems.join("\n")).toContain(
        "must not override coverage settings or reduce the coverage source universe",
      );
    },
    TEST_TIMEOUT_MS,
  );
});
