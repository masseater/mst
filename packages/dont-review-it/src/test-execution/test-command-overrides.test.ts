import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, test, onTestFinished } from "vite-plus/test";

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

const problemsFor = (repositoryRoot: string) =>
  testCommandOverrideProblems(repositoryRoot).problems;

describe("testCommandOverrideProblems", () => {
  test("a single-package repository scans its root test script without a workspace definition", () => {
    const root = repositoryWith({
      "package.json": JSON.stringify({ scripts: { test: "vp test -c arbitrary.ts" } }),
    });
    const report = testCommandOverrideProblems(root);

    expect(report.problems).toHaveLength(1);
    expect(report.scanned).toBe(1);
  });

  test("an invalid workspace definition is left to the workspace parser problem", () => {
    const root = repositoryWith({ "pnpm-workspace.yaml": "packages: [" });
    expect(problemsFor(root)).toStrictEqual([]);
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
    expect(problemsFor(root)).toStrictEqual([]);
  });

  test("pretest and posttest cannot add lifecycle commands around the inspected test entry", () => {
    const root = repositoryWith({
      "package.json": JSON.stringify({
        scripts: {
          pretest: "node prepare.mjs",
          test: "vp test",
          posttest: "node cleanup.mjs",
        },
      }),
    });

    expect(problemsFor(root).map(formatTestCommandOverrideProblem)).toStrictEqual([
      expect.stringContaining("`scripts.pretest` lifecycle entry must not run"),
      expect.stringContaining("`scripts.posttest` lifecycle entry must not run"),
    ]);
  });

  test("a workspace test config requires an executable string test entry", () => {
    const root = repositoryWith({
      "pnpm-workspace.yaml": "packages:\n  - packages/*\n",
      "package.json": JSON.stringify({}),
      "vite.config.ts": "export default {};\n",
      "packages/missing/package.json": JSON.stringify({ scripts: {} }),
      "packages/missing/vite.config.ts": "export default {};\n",
      "packages/non-string/package.json": JSON.stringify({ scripts: { test: false } }),
      "packages/non-string/vitest.config.cts": "export default {};\n",
      "packages/no-config/package.json": JSON.stringify({ scripts: {} }),
    });

    expect(problemsFor(root).map(formatTestCommandOverrideProblem)).toStrictEqual([
      expect.stringMatching(/^packages\/missing\/package\.json .*must not omit `scripts\.test`/u),
      expect.stringMatching(
        /^packages\/non-string\/package\.json .*must not declare `scripts\.test` as a non-string value/u,
      ),
    ]);
  });

  test.each(
    ["vite", "vitest"].flatMap((baseName) =>
      ["js", "cjs", "mjs", "ts", "cts", "mts"].map(
        (extension) => `${baseName}.config.${extension}`,
      ),
    ),
  )("every canonical test config name makes its workspace a coverage target: %s", (configName) => {
    const root = repositoryWith({
      "pnpm-workspace.yaml": "packages:\n  - packages/*\n",
      "package.json": JSON.stringify({}),
      "packages/app/package.json": JSON.stringify({}),
      [`packages/app/${configName}`]: "export default {};\n",
    });

    expect(problemsFor(root).map(formatTestCommandOverrideProblem)).toStrictEqual([
      expect.stringContaining("must not omit `scripts.test`"),
    ]);
  });

  test("a near-match config name does not create a coverage target", () => {
    const root = repositoryWith({
      "pnpm-workspace.yaml": "packages:\n  - packages/*\n",
      "package.json": JSON.stringify({}),
      "packages/app/package.json": JSON.stringify({}),
      "packages/app/vite.config.tsx": "export default {};\n",
    });

    expect(problemsFor(root)).toStrictEqual([]);
  });

  test("root and workspace test commands cannot inject a different config", () => {
    const root = repositoryWith({
      "pnpm-workspace.yaml": "packages:\n  - packages/*\n",
      "package.json": JSON.stringify({ scripts: { test: "vp test --config=arbitrary.ts" } }),
      "packages/app/package.json": JSON.stringify({
        scripts: { test: "vitest run --coverage --config custom.ts", metadata: 1 },
      }),
    });
    const { problems } = testCommandOverrideProblems(root);
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
    expect(problemsFor(root)).toHaveLength(1);
  });

  test.each([`'vp' test -c=arbitrary.ts`, "./node_modules/.bin/vitest -c arbitrary.ts"])(
    "short config options and quoted executables are detected: %s",
    (command) => {
      const root = repositoryWith({
        "package.json": JSON.stringify({ scripts: { test: command } }),
      });
      expect(problemsFor(root)).toHaveLength(1);
    },
  );

  test("leading environment assignments cannot change the test environment", () => {
    const root = repositoryWith({
      "package.json": JSON.stringify({
        scripts: { test: "CI=1 NODE_ENV=test vp test --coverage.exclude=src" },
      }),
    });
    expect(problemsFor(root).map(formatTestCommandOverrideProblem)).toStrictEqual([
      expect.stringContaining("exactly one normal test run"),
    ]);
  });

  test("a transparent test wrapper is inspectable", () => {
    const root = repositoryWith({
      "package.json": JSON.stringify({ scripts: { test: "spool -- vp test" } }),
    });
    expect(problemsFor(root)).toStrictEqual([]);
  });

  test.each(["vitest", "./node_modules/.bin/vitest"])(
    "a direct Vitest runner must select one run explicitly: %s",
    (command) => {
      const root = repositoryWith({
        "package.json": JSON.stringify({ scripts: { test: command } }),
      });
      expect(problemsFor(root).map(formatTestCommandOverrideProblem)).toStrictEqual([
        expect.stringContaining("exactly one normal test run"),
      ]);
    },
  );

  test.each(["vitest run", "./node_modules/.bin/vitest run --coverage"])(
    "an explicit direct Vitest run preserves the full inspected suite: %s",
    (command) => {
      const root = repositoryWith({
        "package.json": JSON.stringify({ scripts: { test: command } }),
      });
      expect(problemsFor(root)).toStrictEqual([]);
    },
  );

  test("a transparent test wrapper cannot hide changed selection", () => {
    const root = repositoryWith({
      "package.json": JSON.stringify({ scripts: { test: "env -- vp test --changed HEAD" } }),
    });
    expect(problemsFor(root)).toHaveLength(1);
  });

  test.each([
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
  ])("an opaque test wrapper fails closed: %s", (command) => {
    const root = repositoryWith({
      "package.json": JSON.stringify({ scripts: { test: command } }),
    });
    expect(problemsFor(root).map(formatTestCommandOverrideProblem)).toStrictEqual([
      expect.stringContaining("exactly one normal test run"),
    ]);
  });

  test.each([
    "vp test --help",
    "vp test --root ../other",
    "vp test src/feature.test.ts",
    "vp test --coverage --coverage",
    "vitest run run",
    "./node_modules/.bin/vitest run run",
  ])("runner arguments cannot narrow or replace the full run: %s", (command) => {
    const root = repositoryWith({
      "package.json": JSON.stringify({ scripts: { test: command } }),
    });
    expect(problemsFor(root).map(formatTestCommandOverrideProblem)).toStrictEqual([
      expect.stringContaining("must not select a test subset"),
    ]);
  });

  test("comments and redirection targets are not test options", () => {
    const root = repositoryWith({
      "package.json": JSON.stringify({
        scripts: {
          test: "vp test # --coverage.exclude=x",
          redirect: "vp test > --config 2> --coverage.exclude=x < --changed",
        },
      }),
    });

    expect(problemsFor(root)).toStrictEqual([]);
  });

  test("non-test script names are outside the test entry contract", () => {
    const root = repositoryWith({
      "package.json": JSON.stringify({
        scripts: {
          test: "spool -- vp test",
          override: "vp test --coverage=false",
          explain: "echo vp test --config x.ts",
        },
      }),
    });
    expect(problemsFor(root)).toStrictEqual([]);
  });

  test.each(["true || vp test", "vp run override"])(
    "the test entry cannot delegate or use shell control flow: %s",
    (command) => {
      const root = repositoryWith({
        "package.json": JSON.stringify({ scripts: { test: command } }),
      });
      expect(problemsFor(root).map(formatTestCommandOverrideProblem)).toContainEqual(
        expect.stringContaining("statically inspectable command"),
      );
    },
  );

  test.each([
    'vp test --coverage.exclude="src/**"',
    "vp test --no-coverage",
    "vitest run --coverage false",
    "vp test --coverage true",
    "vp test --changed HEAD",
    "vitest run --changed=main",
  ])("coverage CLI overrides are rejected: %s", (command) => {
    const root = repositoryWith({
      "package.json": JSON.stringify({ scripts: { test: command } }),
    });
    expect(problemsFor(root).map(formatTestCommandOverrideProblem)).toStrictEqual([
      expect.stringContaining("only bare `--coverage` may enable"),
    ]);
  });

  test("bare coverage passes", () => {
    const root = repositoryWith({
      "package.json": JSON.stringify({ scripts: { test: "vp test --coverage" } }),
    });
    expect(problemsFor(root)).toStrictEqual([]);
  });

  test("a double dash cannot hide options that the workspace guard appends to the test script", () => {
    const root = repositoryWith({
      "package.json": JSON.stringify({
        scripts: { test: "vp test -- --coverage.exclude=fixture --config fixture" },
      }),
    });
    expect(problemsFor(root)).toHaveLength(2);
  });

  test("the root guard forwards only the canonical coverage and worker budget", () => {
    const root = repositoryWith({
      "package.json": JSON.stringify({
        scripts: {
          guard: "throttle --timeout 1800 -- spool -- vp run guard:all",
          "guard:all":
            "vp check && vp run -r --concurrency-limit 1 test --coverage --maxWorkers 2 && vp run -r build",
        },
      }),
    });

    expect(testCommandOverrideProblems(root)).toStrictEqual({ problems: [], scanned: 1 });
  });

  test("the root guard reports unsafe arguments forwarded after the recursive test task", () => {
    const root = repositoryWith({
      "package.json": JSON.stringify({
        scripts: {
          guard: "throttle --timeout 1800 -- spool -- vp run guard:all",
          "guard:all":
            "vp run -r --concurrency-limit 1 test --coverage --maxWorkers 2 --changed HEAD",
        },
      }),
    });
    const report = testCommandOverrideProblems(root);

    expect(report.scanned).toBe(1);
    expect(report.problems.map(formatTestCommandOverrideProblem)).toStrictEqual([
      expect.stringContaining("only `--coverage` and `--maxWorkers 2` may be forwarded"),
    ]);
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
    const { problems, scanned } = testCommandOverrideProblems(root);
    expect(problems).toHaveLength(1);
    expect(problems[0]?.file).toBe("packages/features/app/package.json");
    expect(scanned).toBe(2);
  });
});
