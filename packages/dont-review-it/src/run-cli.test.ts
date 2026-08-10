import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, expect, test } from "vite-plus/test";

import {
  CANONICAL_VALUES_TAG,
  RETIRED_ANNOTATION_TAGS,
} from "./lint/oxlint/lib/canonical-values/annotation.ts";
import { runDontReviewIt, USAGE } from "./run-cli.ts";

const createdRoots: string[] = [];

afterEach(() => {
  for (const root of createdRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const repositoryWith = (files: Readonly<Record<string, string>>): string => {
  const root = mkdtempSync(join(tmpdir(), "dont-review-it-cli-"));
  createdRoots.push(root);
  for (const [path, text] of Object.entries(files)) {
    const target = join(root, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, text, "utf8");
  }
  return root;
};

type CliRun = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
};

const runCli = (argv: readonly string[]): CliRun => {
  let stdout = "";
  let stderr = "";
  const exitCode = runDontReviewIt(argv, {
    writeOut: (text) => {
      stdout += text;
    },
    writeError: (text) => {
      stderr += text;
    },
  });
  return { exitCode, stdout, stderr };
};

test("verify stays silent and exits zero when every annotation is well formed", () => {
  const root = repositoryWith({
    "src/order.ts": `/** ${CANONICAL_VALUES_TAG} order.status */
export const ORDER_STATUSES = ["draft", "published"] as const;
`,
  });

  expect(runCli(["verify", "--repository-root", root])).toStrictEqual({
    exitCode: 0,
    stdout: "",
    stderr: "",
  });
});

test("verify writes the problem to stdout and exits one", () => {
  const root = repositoryWith({
    "src/order.ts": `/** ${CANONICAL_VALUES_TAG} */
export const ORDER_STATUSES = ["draft"] as const;
`,
  });

  const run = runCli(["verify", "--repository-root", root]);

  expect(run.exitCode).toBe(1);
  expect(run.stdout).toContain("src/order.ts:1");
  expect(run.stderr).toBe("");
});

test("verify reaches a broken annotation that sits in a dot directory", () => {
  const root = repositoryWith({
    ".config/broken.ts": `/** ${CANONICAL_VALUES_TAG} NOT VALID ID */
export const BROKEN_STATUSES = ["draft"] as const;
`,
  });

  const run = runCli(["verify", "--repository-root", root]);

  expect(run.exitCode).toBe(1);
  expect(run.stdout).toContain(".config/broken.ts:1");
});

test("verify rejects a retired annotation tag left in a JavaScript file", () => {
  const retired = RETIRED_ANNOTATION_TAGS[0];
  const root = repositoryWith({
    "scripts/legacy.mjs": `/** ${retired} */
export const LEGACY_STATUSES = ["draft"];
`,
  });

  const run = runCli(["verify", "--repository-root", root]);

  expect(run.exitCode).toBe(1);
  expect(run.stdout).toContain("scripts/legacy.mjs:1");
  expect(run.stdout).toContain(retired);
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

  expect(runCli(["verify", "--repository-root", root])).toStrictEqual({
    exitCode: 0,
    stdout: "",
    stderr: "",
  });
});

test("equivalent-concepts writes the group it found and still exits zero", () => {
  const root = repositoryWith({
    "src/article.ts": `/** ${CANONICAL_VALUES_TAG} article.status */
export const ARTICLE_STATUSES = ["published", "draft"] as const;
`,
    "src/order.ts": `/** ${CANONICAL_VALUES_TAG} order.status */
export const ORDER_STATUSES = ["draft", "published"] as const;
`,
  });

  const run = runCli(["equivalent-concepts", "--repository-root", root]);

  expect(run.exitCode).toBe(0);
  expect(run.stdout).toContain("article.status");
  expect(run.stdout).toContain("order.status");
});

test("an unknown command writes the usage to stderr and exits two", () => {
  expect(runCli(["publish"])).toStrictEqual({ exitCode: 2, stdout: "", stderr: USAGE });
});

test("no command at all writes the usage to stderr and exits two", () => {
  expect(runCli([])).toStrictEqual({ exitCode: 2, stdout: "", stderr: USAGE });
});

test("a repository root that is not a directory exits two instead of scanning nothing", () => {
  const root = repositoryWith({});

  const run = runCli(["verify", "--repository-root", join(root, "missing")]);

  expect(run.exitCode).toBe(2);
  expect(run.stdout).toBe("");
  expect(run.stderr).toContain("missing");
});

test("an unknown option exits two instead of falling back to a default", () => {
  const run = runCli(["verify", "--repo-root", "."]);

  expect(run.exitCode).toBe(2);
  expect(run.stdout).toBe("");
  expect(run.stderr).not.toBe("");
});
