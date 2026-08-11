import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, onTestFinished, test } from "vite-plus/test";

import { RETIRED_ANNOTATION_TAGS } from "./lint/oxlint/lib/canonical-values/annotation.ts";
import { runDontReviewIt } from "./run-cli.ts";

describe("run-cli", () => {
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

  test("check stays silent and exits zero when nothing is found", () => {
    const root = repositoryWith({
      "src/order.ts": `/** ${CANONICAL_VALUES_TAG} order.status */
export const ORDER_STATUSES = ["draft", "published"] as const;
`,
    });

    expect(runDontReviewIt(["check", "--repository-root", root])).toStrictEqual({
      exitCode: 0,
      out: "",
      error: "",
    });
  });

  test("check given no repository root scans the working directory", () => {
    const run = runDontReviewIt(["check"]);

    expect(run.exitCode).toBe(0);
    expect(run.error).toBe("");
  });

  test("check reports a broken annotation and exits one", () => {
    const root = repositoryWith({
      "src/order.ts": `/** ${CANONICAL_VALUES_TAG} */
export const ORDER_STATUSES = ["draft"] as const;
`,
    });

    const run = runDontReviewIt(["check", "--repository-root", root]);

    expect(run.exitCode).toBe(1);
    expect(run.out).toContain("src/order.ts:1");
    expect(run.error).toBe("");
  });

  test("check reaches a broken annotation that sits in a dot directory", () => {
    const root = repositoryWith({
      ".config/broken.ts": `/** ${CANONICAL_VALUES_TAG} NOT VALID ID */
export const BROKEN_STATUSES = ["draft"] as const;
`,
    });

    expect(runDontReviewIt(["check", "--repository-root", root]).out).toContain(
      ".config/broken.ts:1",
    );
  });

  test("check rejects a retired annotation tag left in a JavaScript file", () => {
    const retired = RETIRED_ANNOTATION_TAGS[0];
    const root = repositoryWith({
      "scripts/legacy.mjs": `/** ${retired} */
export const LEGACY_STATUSES = ["draft"];
`,
    });

    const run = runDontReviewIt(["check", "--repository-root", root]);

    expect(run.exitCode).toBe(1);
    expect(run.out).toContain("scripts/legacy.mjs:1");
    expect(run.out).toContain(retired);
  });

  test("a concept a test file repeats is never reported against the declaration that owns it", () => {
    const root = repositoryWith({
      "src/order.test.ts": `/** ${CANONICAL_VALUES_TAG} order.status */
const FIXTURE_STATUSES = ["draft"] as const;
`,
      "src/order.ts": `/** ${CANONICAL_VALUES_TAG} order.status */
export const ORDER_STATUSES = ["draft"] as const;
`,
    });

    expect(runDontReviewIt(["check", "--repository-root", root])).toStrictEqual({
      exitCode: 0,
      out: "",
      error: "",
    });
  });

  test("check fails on a value set that more than one concept declares", () => {
    const root = repositoryWith({
      "src/article.ts": `/** ${CANONICAL_VALUES_TAG} article.status */
export const ARTICLE_STATUSES = ["published", "draft"] as const;
`,
      "src/order.ts": `/** ${CANONICAL_VALUES_TAG} order.status */
export const ORDER_STATUSES = ["draft", "published"] as const;
`,
    });

    const run = runDontReviewIt(["check", "--repository-root", root]);

    expect(run.exitCode).toBe(1);
    expect(run.out).toContain("article.status");
    expect(run.out).toContain("order.status");
  });

  test("an unknown command returns the usage as an error and exits two", () => {
    const run = runDontReviewIt(["publish"]);

    expect(run.exitCode).toBe(2);
    expect(run.out).toBe("");
    expect(run.error).toContain("Usage: dont-review-it check [--repository-root <path>]");
    expect(run.error).toContain("--repository-root <path>");
  });

  test("no command at all is answered the same way an unknown command is", () => {
    expect(runDontReviewIt([])).toStrictEqual(runDontReviewIt(["publish"]));
  });

  test("a repository root that is not a directory exits two instead of scanning nothing", () => {
    const root = repositoryWith({});

    const run = runDontReviewIt(["check", "--repository-root", join(root, "missing")]);

    expect(run.exitCode).toBe(2);
    expect(run.out).toBe("");
    expect(run.error).toContain("missing");
  });

  test("an unknown option exits two instead of falling back to a default", () => {
    const run = runDontReviewIt(["check", "--repo-root", "."]);

    expect(run.exitCode).toBe(2);
    expect(run.out).toBe("");
    expect(run.error).not.toBe("");
  });

  test("check stays silent when no body is spelled twice", () => {
    const root = repositoryWith({
      "src/twice.ts": "export const twice = (value: number): number => value * 2;\n",
      "src/thrice.ts": "export const thrice = (value: number): number => value * 3;\n",
    });

    expect(runDontReviewIt(["check", "--repository-root", root])).toStrictEqual({
      exitCode: 0,
      out: "",
      error: "",
    });
  });

  test("check fails and names both sites when a body is spelled twice", () => {
    const root = repositoryWith({
      "src/twice.ts": "export const twice = (value: number): number => value * 2;\n",
      "src/doubled.ts": "export const doubled = (value: number): number => value * 2;\n",
    });

    const run = runDontReviewIt(["check", "--repository-root", root]);

    expect(run.exitCode).toBe(1);
    expect(run.out).toContain("src/doubled.ts:1 (doubled)");
    expect(run.out).toContain("src/twice.ts:1 (twice)");
  });

  test("check leaves test files out of the body scan", () => {
    const root = repositoryWith({
      "src/twice.ts": "export const twice = (value: number): number => value * 2;\n",
      "src/twice.test.ts": "export const doubled = (value: number): number => value * 2;\n",
    });

    expect(runDontReviewIt(["check", "--repository-root", root])).toStrictEqual({
      exitCode: 0,
      out: "",
      error: "",
    });
  });

  test("check fails on a workflow definition that narrows its own start", () => {
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

    const run = runDontReviewIt(["check", "--repository-root", root]);

    expect(run.exitCode).toBe(1);
    expect(run.out).toContain(".github/workflows/ci.yml:3");
  });

  test("check stays silent on a workflow definition that keeps every discipline", () => {
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

    expect(runDontReviewIt(["check", "--repository-root", root])).toStrictEqual({
      exitCode: 0,
      out: "",
      error: "",
    });
  });
});
