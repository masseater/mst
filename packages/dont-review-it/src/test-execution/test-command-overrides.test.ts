import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import {
  formatTestCommandOverrideProblem,
  testCommandOverrideProblems,
} from "./test-command-overrides.ts";

const CONFIG_MESSAGE =
  "The test script must not select a test config with `--config` or `-c`. Remove that argument and merge the test settings into the auto-discovered `vite.config` or `vitest.config`, so lint and the coverage gate inspect the same source universe.";

const COVERAGE_MESSAGE =
  "The test script must not override coverage settings or reduce the coverage source universe on the command line. Remove every `--coverage.*`, `--coverage=...`, `--no-coverage`, `--changed`, and `--changed=...` argument, and remove any `true` or `false` value after `--coverage`; only bare `--coverage` may enable the statically inspected coverage configuration.";

const RUNNER_ARGUMENT_MESSAGE =
  "The test script must not select a test subset, alternate root or project, non-run mode, or other runner behavior. Remove every test-runner argument except one optional bare `--coverage`, so the recursive guard runs the package's full auto-discovered suite and coverage source universe.";

const UNINSPECTABLE_MESSAGE =
  "The test script must expose exactly one normal test run in the current package through one statically inspectable command. Replace shell control operators, delegation, expansion, environment changes, alternate roots or projects, non-run modes, arbitrary executable paths, and package-manager or Vite Plus exec wrappers with `spool -- vp test`. Only bare `vp test`, explicit `vitest run` or `./node_modules/.bin/vitest run`, and transparent `env --`, `command --`, `exec --`, or `spool --` wrappers preserve the inspected config and coverage source universe.";

const PRETEST_MESSAGE =
  "The `scripts.pretest` lifecycle entry must not run outside the statically inspected test command. Delete this entry and move the required setup or teardown into the auto-discovered Vite/Vitest config or the test implementation, so `vp run ... test` executes only `scripts.test`.";

const POSTTEST_MESSAGE =
  "The `scripts.posttest` lifecycle entry must not run outside the statically inspected test command. Delete this entry and move the required setup or teardown into the auto-discovered Vite/Vitest config or the test implementation, so `vp run ... test` executes only `scripts.test`.";

const MISSING_TEST_ENTRY_MESSAGE =
  "A workspace that owns a Vite/Vitest test config must not omit `scripts.test`, because the recursive coverage gate would skip the workspace. Add `scripts.test` as a string containing exactly one directly invoked test runner, such as `spool -- vp test`.";

const NON_STRING_TEST_ENTRY_MESSAGE =
  "A workspace that owns a Vite/Vitest test config must not declare `scripts.test` as a non-string value, because the recursive coverage gate cannot execute and inspect it. Replace the value with one string containing exactly one directly invoked test runner, such as `spool -- vp test`.";

const ROOT_TEST_COMMAND_MESSAGE =
  "The root `guard:all` script must not omit, delegate, duplicate, or alter the recursive test gate. Keep exactly one `vp run -r --concurrency-limit 1 test --coverage --maxWorkers 2` stage; only `--coverage` and `--maxWorkers 2` may be forwarded to each package test script.";

const EMPTY_REPORT = { problems: [], scanned: 1 } as const;

const TEST_COMMAND_OVERRIDE_SCENARIOS = [
  {
    title: "a single-package repository with a selected config",
    files: {
      "package.json": JSON.stringify({ scripts: { test: "vp test -c arbitrary.ts" } }),
    },
    expectedReport: {
      problems: [{ file: "package.json", line: null, message: CONFIG_MESSAGE }],
      scanned: 1,
    },
  },
  {
    title: "an invalid workspace definition",
    files: { "pnpm-workspace.yaml": "packages: [" },
    expectedReport: { problems: [], scanned: 0 },
  },
  {
    title: "auto-discovered test configs and unrelated flags",
    files: {
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
    },
    expectedReport: { problems: [], scanned: 2 },
  },
  {
    title: "test lifecycle commands around the inspected entry",
    files: {
      "package.json": JSON.stringify({
        scripts: {
          pretest: "node prepare.mjs",
          test: "vp test",
          posttest: "node cleanup.mjs",
        },
      }),
    },
    expectedReport: {
      problems: [
        { file: "package.json", line: null, message: PRETEST_MESSAGE },
        { file: "package.json", line: null, message: POSTTEST_MESSAGE },
      ],
      scanned: 1,
    },
  },
  {
    title: "test configs with missing and non-string test entries",
    files: {
      "pnpm-workspace.yaml": "packages:\n  - packages/*\n",
      "package.json": JSON.stringify({}),
      "vite.config.ts": "export default {};\n",
      "packages/missing/package.json": JSON.stringify({ scripts: {} }),
      "packages/missing/vite.config.ts": "export default {};\n",
      "packages/non-string/package.json": JSON.stringify({ scripts: { test: false } }),
      "packages/non-string/vitest.config.cts": "export default {};\n",
      "packages/no-config/package.json": JSON.stringify({ scripts: {} }),
    },
    expectedReport: {
      problems: [
        {
          file: "packages/missing/package.json",
          line: null,
          message: MISSING_TEST_ENTRY_MESSAGE,
        },
        {
          file: "packages/non-string/package.json",
          line: null,
          message: NON_STRING_TEST_ENTRY_MESSAGE,
        },
      ],
      scanned: 4,
    },
  },
  ...["vite", "vitest"].flatMap((baseName) =>
    ["js", "cjs", "mjs", "ts", "cts", "mts"].map((extension) => {
      const configName = `${baseName}.config.${extension}`;
      return {
        title: `canonical test config ${configName}`,
        files: {
          "pnpm-workspace.yaml": "packages:\n  - packages/*\n",
          "package.json": JSON.stringify({}),
          "packages/app/package.json": JSON.stringify({}),
          [`packages/app/${configName}`]: "export default {};\n",
        },
        expectedReport: {
          problems: [
            {
              file: "packages/app/package.json",
              line: null,
              message: MISSING_TEST_ENTRY_MESSAGE,
            },
          ],
          scanned: 2,
        },
      };
    }),
  ),
  {
    title: "a near-match test config name",
    files: {
      "pnpm-workspace.yaml": "packages:\n  - packages/*\n",
      "package.json": JSON.stringify({}),
      "packages/app/package.json": JSON.stringify({}),
      "packages/app/vite.config.tsx": "export default {};\n",
    },
    expectedReport: { problems: [], scanned: 2 },
  },
  {
    title: "root and workspace test commands selecting configs",
    files: {
      "pnpm-workspace.yaml": "packages:\n  - packages/*\n",
      "package.json": JSON.stringify({ scripts: { test: "vp test --config=arbitrary.ts" } }),
      "packages/app/package.json": JSON.stringify({
        scripts: { test: "vitest run --coverage --config custom.ts", metadata: 1 },
      }),
    },
    expectedReport: {
      problems: [
        { file: "package.json", line: null, message: CONFIG_MESSAGE },
        { file: "packages/app/package.json", line: null, message: CONFIG_MESSAGE },
      ],
      scanned: 2,
    },
  },
  ...["vp test '--config' arbitrary.ts", "'vp' test -c=arbitrary.ts"].map((command) => ({
    title: `quoted or short config selection: ${command}`,
    files: { "package.json": JSON.stringify({ scripts: { test: command } }) },
    expectedReport: {
      problems: [{ file: "package.json", line: null, message: CONFIG_MESSAGE }],
      scanned: 1,
    },
  })),
  {
    title: "leading environment assignments",
    files: {
      "package.json": JSON.stringify({
        scripts: { test: "CI=1 NODE_ENV=test vp test --coverage.exclude=src" },
      }),
    },
    expectedReport: {
      problems: [{ file: "package.json", line: null, message: UNINSPECTABLE_MESSAGE }],
      scanned: 1,
    },
  },
  {
    title: "a transparent spool wrapper",
    files: {
      "package.json": JSON.stringify({ scripts: { test: "spool -- vp test" } }),
    },
    expectedReport: EMPTY_REPORT,
  },
  ...["vitest", "./node_modules/.bin/vitest", "./node_modules/.bin/vitest -c arbitrary.ts"].map(
    (command) => ({
      title: `a direct runner without an explicit run: ${command}`,
      files: { "package.json": JSON.stringify({ scripts: { test: command } }) },
      expectedReport: {
        problems: [{ file: "package.json", line: null, message: UNINSPECTABLE_MESSAGE }],
        scanned: 1,
      },
    }),
  ),
  ...["vitest run", "./node_modules/.bin/vitest run --coverage"].map((command) => ({
    title: `an explicit direct runner: ${command}`,
    files: { "package.json": JSON.stringify({ scripts: { test: command } }) },
    expectedReport: EMPTY_REPORT,
  })),
  {
    title: "a transparent env wrapper with changed selection",
    files: {
      "package.json": JSON.stringify({ scripts: { test: "env -- vp test --changed HEAD" } }),
    },
    expectedReport: {
      problems: [{ file: "package.json", line: null, message: COVERAGE_MESSAGE }],
      scanned: 1,
    },
  },
  ...[
    "env -Z vp test --changed HEAD",
    "env PATH=./tools vp test",
    String.raw`env -S 'vp test --config\_arbitrary.ts'`,
    "spool vp test --changed HEAD",
    "npx --package=./fake vitest",
    "vp exec --filter other -- vitest",
    'sh -c "vp test --changed HEAD"',
    "vp run app#test",
    "./tools/vp test",
    "vp\u00a0test",
    '"CI=1" vp test',
  ].map((command) => ({
    title: `an opaque test wrapper: ${command}`,
    files: { "package.json": JSON.stringify({ scripts: { test: command } }) },
    expectedReport: {
      problems: [{ file: "package.json", line: null, message: UNINSPECTABLE_MESSAGE }],
      scanned: 1,
    },
  })),
  ...[
    "vp test --help",
    "vp test --root ../other",
    "vp test src/feature.test.ts",
    "vp test --coverage --coverage",
    "vitest run run",
    "./node_modules/.bin/vitest run run",
  ].map((command) => ({
    title: `runner arguments replacing the full run: ${command}`,
    files: { "package.json": JSON.stringify({ scripts: { test: command } }) },
    expectedReport: {
      problems: [{ file: "package.json", line: null, message: RUNNER_ARGUMENT_MESSAGE }],
      scanned: 1,
    },
  })),
  {
    title: "comments and redirection targets containing option spellings",
    files: {
      "package.json": JSON.stringify({
        scripts: {
          test: "vp test # --coverage.exclude=x",
          redirect: "vp test > --config 2> --coverage.exclude=x < --changed",
        },
      }),
    },
    expectedReport: EMPTY_REPORT,
  },
  {
    title: "non-test script names containing runner commands",
    files: {
      "package.json": JSON.stringify({
        scripts: {
          test: "spool -- vp test",
          override: "vp test --coverage=false",
          explain: "echo vp test --config x.ts",
        },
      }),
    },
    expectedReport: EMPTY_REPORT,
  },
  ...["true || vp test", "vp run override"].map((command) => ({
    title: `delegated or shell-controlled test entry: ${command}`,
    files: { "package.json": JSON.stringify({ scripts: { test: command } }) },
    expectedReport: {
      problems: [{ file: "package.json", line: null, message: UNINSPECTABLE_MESSAGE }],
      scanned: 1,
    },
  })),
  ...[
    'vp test --coverage.exclude="src/**"',
    "vp test --no-coverage",
    "vitest run --coverage false",
    "vp test --coverage true",
    "vp test --changed HEAD",
    "vitest run --changed=main",
  ].map((command) => ({
    title: `a coverage command-line override: ${command}`,
    files: { "package.json": JSON.stringify({ scripts: { test: command } }) },
    expectedReport: {
      problems: [{ file: "package.json", line: null, message: COVERAGE_MESSAGE }],
      scanned: 1,
    },
  })),
  {
    title: "a bare coverage option",
    files: {
      "package.json": JSON.stringify({ scripts: { test: "vp test --coverage" } }),
    },
    expectedReport: EMPTY_REPORT,
  },
  {
    title: "config and coverage options after a double dash",
    files: {
      "package.json": JSON.stringify({
        scripts: { test: "vp test -- --coverage.exclude=fixture --config fixture" },
      }),
    },
    expectedReport: {
      problems: [
        { file: "package.json", line: null, message: CONFIG_MESSAGE },
        { file: "package.json", line: null, message: COVERAGE_MESSAGE },
      ],
      scanned: 1,
    },
  },
  {
    title: "the canonical root recursive test gate",
    files: {
      "package.json": JSON.stringify({
        scripts: {
          guard: "throttle --timeout 1800 -- spool -- vp run guard:all",
          "guard:all":
            "vp check && vp run -r --concurrency-limit 1 test --coverage --maxWorkers 2 && vp run -r build",
        },
      }),
    },
    expectedReport: EMPTY_REPORT,
  },
  {
    title: "an unsafe argument forwarded by the root recursive test gate",
    files: {
      "package.json": JSON.stringify({
        scripts: {
          guard: "throttle --timeout 1800 -- spool -- vp run guard:all",
          "guard:all":
            "vp run -r --concurrency-limit 1 test --coverage --maxWorkers 2 --changed HEAD",
        },
      }),
    },
    expectedReport: {
      problems: [{ file: "package.json", line: null, message: ROOT_TEST_COMMAND_MESSAGE }],
      scanned: 1,
    },
  },
  {
    title: "recursive workspace patterns and their negations",
    files: {
      "pnpm-workspace.yaml": "packages:\n  - packages/**\n  - '!packages/ignored/**'\n",
      "package.json": JSON.stringify({}),
      "packages/features/app/package.json": JSON.stringify({
        scripts: { test: "vp test --config app.ts" },
      }),
      "packages/ignored/app/package.json": JSON.stringify({
        scripts: { test: "vp test --config ignored.ts" },
      }),
    },
    expectedReport: {
      problems: [
        {
          file: "packages/features/app/package.json",
          line: null,
          message: CONFIG_MESSAGE,
        },
      ],
      scanned: 2,
    },
  },
] as const;

describe("testCommandOverrideProblems", () => {
  describe.each(TEST_COMMAND_OVERRIDE_SCENARIOS)("$title", (testCommandOverrideScenario) => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "dont-review-it-test-config-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      const files = testCommandOverrideScenario.files as Readonly<Record<string, string>>;
      for (const [relativePath, source] of Object.entries(files)) {
        const filePath = join(repositoryRoot, relativePath);
        mkdirSync(dirname(filePath), { recursive: true });
        writeFileSync(filePath, source, "utf8");
      }
      return testCommandOverrideProblems(repositoryRoot);
    });

    it("returns the exact report", ({ report }) => {
      expect(report).toStrictEqual(testCommandOverrideScenario.expectedReport);
    });
  });
});

describe("formatTestCommandOverrideProblem", () => {
  const it = test.extend("formattedProblem", () =>
    formatTestCommandOverrideProblem({
      file: "packages/app/package.json",
      line: null,
      message: CONFIG_MESSAGE,
    }));

  it("places the manifest before the diagnostic", ({ formattedProblem }) => {
    expect(formattedProblem).toBe(`packages/app/package.json ${CONFIG_MESSAGE}`);
  });
});
