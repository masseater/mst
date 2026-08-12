import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { runCommand } from "citty";
import { describe, expect, onTestFinished } from "vite-plus/test";

import { dontReviewItCommand } from "./dont-review-it-command.ts";
import { RETIRED_ANNOTATION_TAGS } from "./lint/oxlint/lib/canonical-values/annotation.ts";
import { standardIoTest } from "./vitest/standard-io-test.ts";

describe("dont-review-it-command", () => {
  const CANONICAL_VALUES_TAG = "@canonical-values";

  const repositoryWith = (files: Readonly<Record<string, string>>): string => {
    const root = mkdtempSync(join(tmpdir(), "dont-review-it-cli-"));
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

  const cliExitCode = async (rawArgs: readonly string[]): Promise<number> => {
    process.exitCode = 0;
    await runCommand(dontReviewItCommand, { rawArgs: [...rawArgs] });
    const exitCode = process.exitCode;
    process.exitCode = 0;
    return typeof exitCode === "number" ? exitCode : 0;
  };

  standardIoTest(
    "check stays silent and exits zero when nothing is found",
    async ({ stdout, stderr }) => {
      const root = repositoryWith({
        "src/order.ts": `/** ${CANONICAL_VALUES_TAG} order.status */
export const ORDER_STATUSES = ["draft", "published"] as const;
`,
      });

      expect(await cliExitCode(["check", "--repository-root", root])).toBe(0);
      expect(stdout.text).toBe("");
      expect(stderr.text).toContain("entry-composition");
    },
  );

  standardIoTest(
    "check given no repository root scans the working directory",
    async ({ stdout, stderr }) => {
      expect(await cliExitCode(["check"])).toBe(1);
      expect(stdout.text).toContain('The required "guard" script must not be missing.');
      expect(stderr.text).toContain("entry-composition");
    },
  );

  standardIoTest("the repository root can arrive glued to the flag", async ({ stdout, stderr }) => {
    const root = repositoryWith({
      "src/order.ts": `/** ${CANONICAL_VALUES_TAG} order.status */
export const ORDER_STATUSES = ["draft", "published"] as const;
`,
    });

    expect(await cliExitCode(["check", `--repository-root=${root}`])).toBe(0);
    expect(stdout.text).toBe("");
    expect(stderr.text).toContain("entry-composition");
  });

  standardIoTest(
    "check prints a version disagreement as a warning and still exits zero",
    async ({ stdout, stderr }) => {
      const root = repositoryWith({
        "pnpm-workspace.yaml": "packages:\n  - packages/*\n",
        "packages/web/package.json": `{"devDependencies": {"typescript": "^5.0.0"}}`,
        "packages/site/package.json": `{"devDependencies": {"typescript": "^5.5.0"}}`,
      });

      expect(await cliExitCode(["check", "--repository-root", root])).toBe(0);
      expect(stdout.text).toContain("warning: ");
      expect(stderr.text).toContain("entry-composition");
    },
  );

  standardIoTest("check reports a broken annotation and exits one", async ({ stdout, stderr }) => {
    const root = repositoryWith({
      "src/order.ts": `/** ${CANONICAL_VALUES_TAG} */
export const ORDER_STATUSES = ["draft"] as const;
`,
    });

    expect(await cliExitCode(["check", "--repository-root", root])).toBe(1);
    expect(stdout.text).toContain("src/order.ts:1");
    expect(stderr.text).toContain("entry-composition");
  });

  standardIoTest("the broken-annotation report matches the stdout snapshot", async ({ stdout }) => {
    const root = repositoryWith({
      "src/order.ts": `/** ${CANONICAL_VALUES_TAG} */
export const ORDER_STATUSES = ["draft"] as const;
`,
    });

    await cliExitCode(["check", "--repository-root", root]);

    expect(stdout.text).toMatchInlineSnapshot(`
      "src/order.ts:1 A canonical values annotation must name the concept it declares. Write the tag followed by a concept id built from lowercase words joined by "-" or ".".
      "
    `);
  });

  standardIoTest(
    "check reaches a broken annotation that sits in a dot directory",
    async ({ stdout }) => {
      const root = repositoryWith({
        ".config/broken.ts": `/** ${CANONICAL_VALUES_TAG} NOT VALID ID */
export const BROKEN_STATUSES = ["draft"] as const;
`,
      });

      await cliExitCode(["check", "--repository-root", root]);

      expect(stdout.text).toContain(".config/broken.ts:1");
    },
  );

  standardIoTest(
    "check rejects a retired annotation tag left in a JavaScript file",
    async ({ stdout }) => {
      const retired = RETIRED_ANNOTATION_TAGS[0];
      const root = repositoryWith({
        "scripts/legacy.mjs": `/** ${retired} */
export const LEGACY_STATUSES = ["draft"];
`,
      });

      expect(await cliExitCode(["check", "--repository-root", root])).toBe(1);
      expect(stdout.text).toContain("scripts/legacy.mjs:1");
      expect(stdout.text).toContain(retired);
    },
  );

  standardIoTest(
    "a concept a test file repeats is never reported against the declaration that owns it",
    async ({ stdout, stderr }) => {
      const root = repositoryWith({
        "src/order.test.ts": `/** ${CANONICAL_VALUES_TAG} order.status */
const FIXTURE_STATUSES = ["draft"] as const;
`,
        "src/order.ts": `/** ${CANONICAL_VALUES_TAG} order.status */
export const ORDER_STATUSES = ["draft"] as const;
`,
      });

      expect(await cliExitCode(["check", "--repository-root", root])).toBe(0);
      expect(stdout.text).toBe("");
      expect(stderr.text).toContain("entry-composition");
    },
  );

  standardIoTest(
    "check fails on a value set that more than one concept declares",
    async ({ stdout }) => {
      const root = repositoryWith({
        "src/article.ts": `/** ${CANONICAL_VALUES_TAG} article.status */
export const ARTICLE_STATUSES = ["published", "draft"] as const;
`,
        "src/order.ts": `/** ${CANONICAL_VALUES_TAG} order.status */
export const ORDER_STATUSES = ["draft", "published"] as const;
`,
      });

      expect(await cliExitCode(["check", "--repository-root", root])).toBe(1);
      expect(stdout.text).toContain("article.status");
      expect(stdout.text).toContain("order.status");
    },
  );

  standardIoTest("an unknown command is rejected by name", async () => {
    await expect(cliExitCode(["publish"])).rejects.toThrow(/Unknown command/u);
  });

  standardIoTest("no command at all is rejected instead of running anything", async () => {
    await expect(cliExitCode([])).rejects.toThrow(/No command specified/u);
  });

  standardIoTest(
    "a repository root that is not a directory exits two instead of scanning nothing",
    async ({ stdout, stderr }) => {
      const root = repositoryWith({});

      expect(await cliExitCode(["check", "--repository-root", join(root, "missing")])).toBe(2);
      expect(stdout.text).toBe("");
      expect(stderr.text).toContain("missing");
    },
  );

  standardIoTest(
    "an unknown option exits two instead of falling back to a default",
    async ({ stdout, stderr }) => {
      expect(await cliExitCode(["check", "--repo-root", "."])).toBe(2);
      expect(stdout.text).toBe("");
      expect(stderr.text).toMatchInlineSnapshot(`
        "Unknown option --repo-root. Run --help for usage.
        "
      `);
    },
  );

  standardIoTest("check stays silent when no body is spelled twice", async ({ stdout, stderr }) => {
    const root = repositoryWith({
      "src/twice.ts": "export const twice = (value: number): number => value * 2;\n",
      "src/thrice.ts": "export const thrice = (value: number): number => value * 3;\n",
    });

    expect(await cliExitCode(["check", "--repository-root", root])).toBe(0);
    expect(stdout.text).toBe("");
    expect(stderr.text).toContain("entry-composition");
  });

  standardIoTest(
    "check fails and names both sites when a body is spelled twice",
    async ({ stdout }) => {
      const root = repositoryWith({
        "src/twice.ts": "export const twice = (value: number): number => value * 2;\n",
        "src/doubled.ts": "export const doubled = (value: number): number => value * 2;\n",
      });

      expect(await cliExitCode(["check", "--repository-root", root])).toBe(1);
      expect(stdout.text).toContain("src/doubled.ts:1 (doubled)");
      expect(stdout.text).toContain("src/twice.ts:1 (twice)");
    },
  );

  standardIoTest("check leaves test files out of the body scan", async ({ stdout }) => {
    const root = repositoryWith({
      "src/twice.ts": "export const twice = (value: number): number => value * 2;\n",
      "src/twice.test.ts": "export const doubled = (value: number): number => value * 2;\n",
    });

    expect(await cliExitCode(["check", "--repository-root", root])).toBe(0);
    expect(stdout.text).toBe("");
  });

  standardIoTest(
    "check --write repairs the entry composition and exits zero",
    async ({ stdout, stderr }) => {
      const root = repositoryWith({
        "package.json": `{ "scripts": { "guard": "vp check" } }`,
        "pnpm-workspace.yaml": "packages:\n  - packages/*\n",
        "packages/web/package.json": `{ "scripts": { "test": "vp test" } }`,
      });

      expect(await cliExitCode(["check", "--write", "--repository-root", root])).toBe(0);
      expect(stdout.text).toBe("");
      expect(stderr.text).toContain("entry-composition");
      expect(readFileSync(join(root, "package.json"), "utf8")).toContain(
        "throttle --timeout 1800 -- spool -- vp check",
      );
    },
  );

  standardIoTest(
    "check --write reports what it must not repair and exits one",
    async ({ stdout, stderr }) => {
      const root = repositoryWith({
        "package.json": `{ "scripts": { "guard": "throttle --timeout 1800 -- spool -- vp check" } }`,
        "pnpm-workspace.yaml": "packages:\n  - packages/*\n",
        "packages/web/package.json": `{ "scripts": { "test": "throttle -- spool -- vp test" } }`,
      });

      expect(await cliExitCode(["check", "--write", "--repository-root", root])).toBe(1);
      expect(stdout.text).toContain("packages/web/package.json");
      expect(stderr.text).toContain("entry-composition");
    },
  );

  standardIoTest(
    "check exits two when a manifest exists but does not parse",
    async ({ stdout, stderr }) => {
      const root = repositoryWith({ "package.json": "{ oops" });

      expect(await cliExitCode(["check", "--repository-root", root])).toBe(2);
      expect(stdout.text).toBe("");
      expect(stderr.text).toContain("package.json exists but does not parse as a JSON object");
    },
  );

  standardIoTest(
    "check --write exits two when a manifest exists but does not parse",
    async ({ stderr }) => {
      const root = repositoryWith({ "package.json": "{ oops" });

      expect(await cliExitCode(["check", "--write", "--repository-root", root])).toBe(2);
      expect(stderr.text).toContain("package.json exists but does not parse as a JSON object");
    },
  );

  standardIoTest(
    "check fails on a workflow definition that narrows its own start",
    async ({ stdout }) => {
      const root = repositoryWith({
        ".github/workflows/ci.yml": `on:
  pull_request:
    paths: [src/**]
permissions:
  contents: read
jobs:
  ready:
    steps:
      - run: vp run guard
`,
      });

      expect(await cliExitCode(["check", "--repository-root", root])).toBe(1);
      expect(stdout.text).toContain(".github/workflows/ci.yml:3");
    },
  );

  standardIoTest(
    "check stays silent on a workflow definition that keeps every discipline",
    async ({ stdout, stderr }) => {
      const root = repositoryWith({
        ".github/workflows/ci.yml": `name: CI
on:
  pull_request:
permissions:
  contents: read
jobs:
  ready:
    steps:
      - run: vp run guard
`,
      });

      expect(await cliExitCode(["check", "--repository-root", root])).toBe(0);
      expect(stdout.text).toBe("");
      expect(stderr.text).toContain("entry-composition");
    },
  );
});
