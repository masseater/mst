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

  test("verify stays silent and exits zero when every annotation is well formed", () => {
    const root = repositoryWith({
      "src/order.ts": `/** ${CANONICAL_VALUES_TAG} order.status */
export const ORDER_STATUSES = ["draft", "published"] as const;
`,
    });

    expect(runDontReviewIt(["verify", "--repository-root", root])).toStrictEqual({
      exitCode: 0,
      out: "",
      error: "",
    });
  });

  test("verify returns the problem as output and exits one", () => {
    const root = repositoryWith({
      "src/order.ts": `/** ${CANONICAL_VALUES_TAG} */
export const ORDER_STATUSES = ["draft"] as const;
`,
    });

    const run = runDontReviewIt(["verify", "--repository-root", root]);

    expect(run.exitCode).toBe(1);
    expect(run.out).toContain("src/order.ts:1");
    expect(run.error).toBe("");
  });

  test("verify reaches a broken annotation that sits in a dot directory", () => {
    const root = repositoryWith({
      ".config/broken.ts": `/** ${CANONICAL_VALUES_TAG} NOT VALID ID */
export const BROKEN_STATUSES = ["draft"] as const;
`,
    });

    const run = runDontReviewIt(["verify", "--repository-root", root]);

    expect(run.exitCode).toBe(1);
    expect(run.out).toContain(".config/broken.ts:1");
  });

  test("verify rejects a retired annotation tag left in a JavaScript file", () => {
    const retired = RETIRED_ANNOTATION_TAGS[0];
    const root = repositoryWith({
      "scripts/legacy.mjs": `/** ${retired} */
export const LEGACY_STATUSES = ["draft"];
`,
    });

    const run = runDontReviewIt(["verify", "--repository-root", root]);

    expect(run.exitCode).toBe(1);
    expect(run.out).toContain("scripts/legacy.mjs:1");
    expect(run.out).toContain(retired);
  });

  test("verify rejects a test annotation without treating it as a duplicate owner", () => {
    const root = repositoryWith({
      "src/order.test.ts": `/** ${CANONICAL_VALUES_TAG} order.status */
const FIXTURE_STATUSES = ["draft"] as const;
`,
      "src/order.ts": `/** ${CANONICAL_VALUES_TAG} order.status */
export const ORDER_STATUSES = ["draft"] as const;
`,
    });

    const run = runDontReviewIt(["verify", "--repository-root", root]);

    expect(run.exitCode).toBe(1);
    expect(run.out).toContain(
      "src/order.test.ts:1 order.status is annotated in a non-production source",
    );
    expect(run.out).not.toContain("already declared");
    expect(run.error).toBe("");
  });

  test("verify rejects a lint directive that suppresses a canonical rule", () => {
    const root = repositoryWith({
      "src/consumer.ts":
        '// eslint-disable-next-line dont-review-it/no-strict-canonical-literal-use--use-canonical-import -- forbidden escape\nexport const status = "draft";\n',
    });

    const run = runDontReviewIt(["verify", "--repository-root", root]);

    expect(run.exitCode).toBe(1);
    expect(run.out).toContain(
      "src/consumer.ts:1 Canonical vocabulary rules must not be suppressed with a lint-disable directive",
    );
    expect(run.error).toBe("");
  });

  test("equivalent-concepts returns the group it found and still exits zero", () => {
    const root = repositoryWith({
      "src/article.ts": `/** ${CANONICAL_VALUES_TAG} article.status */
export const ARTICLE_STATUSES = ["published", "draft"] as const;
`,
      "src/order.ts": `/** ${CANONICAL_VALUES_TAG} order.status */
export const ORDER_STATUSES = ["draft", "published"] as const;
`,
    });

    const run = runDontReviewIt(["equivalent-concepts", "--repository-root", root]);

    expect(run.exitCode).toBe(0);
    expect(run.out).toContain("article.status");
    expect(run.out).toContain("order.status");
  });

  test("equivalent-concepts fails closed when strict analysis finds a problem", () => {
    const root = repositoryWith({
      "src/article.ts": `/** ${CANONICAL_VALUES_TAG} article.status */
export const ARTICLE_STATUSES = ["published", "draft"] as const;
`,
      "src/broken.ts": `/** ${CANONICAL_VALUES_TAG} fake.owner */
if (true) consume("draft");
`,
      "src/order.ts": `/** ${CANONICAL_VALUES_TAG} order.status */
export const ORDER_STATUSES = ["draft", "published"] as const;
`,
    });

    const run = runDontReviewIt(["equivalent-concepts", "--repository-root", root]);

    expect(run.exitCode).toBe(1);
    expect(run.out).toContain("src/broken.ts:1");
    expect(run.out).not.toContain("is declared by more than one concept");
    expect(run.error).toBe("");
  });

  test("an unknown command returns the usage as an error and exits two", () => {
    const run = runDontReviewIt(["publish"]);

    expect(run.exitCode).toBe(2);
    expect(run.out).toBe("");
    expect(run.error).toContain("Usage: dont-review-it <command> [--repository-root <path>]");
    expect(run.error).toContain("verify");
    expect(run.error).toContain("equivalent-concepts");
    expect(run.error).toContain("--repository-root <path>");
  });

  test("no command at all is answered the same way an unknown command is", () => {
    expect(runDontReviewIt([])).toStrictEqual(runDontReviewIt(["publish"]));
  });

  test("an extra positional argument is misuse instead of a successful verification", () => {
    const root = repositoryWith({});

    const run = runDontReviewIt(["verify", "unexpected", "--repository-root", root]);

    expect(run.exitCode).toBe(2);
    expect(run.out).toBe("");
    expect(run.error).toContain("Usage: dont-review-it");
  });

  test("a repository root that is not a directory exits two instead of scanning nothing", () => {
    const root = repositoryWith({});

    const run = runDontReviewIt(["verify", "--repository-root", join(root, "missing")]);

    expect(run.exitCode).toBe(2);
    expect(run.out).toBe("");
    expect(run.error).toContain("missing");
  });

  test("an unknown option exits two instead of falling back to a default", () => {
    const run = runDontReviewIt(["verify", "--repo-root", "."]);

    expect(run.exitCode).toBe(2);
    expect(run.out).toBe("");
    expect(run.error).not.toBe("");
  });

  test("duplicated-bodies stays silent when no body is spelled twice", () => {
    const root = repositoryWith({
      "src/twice.ts": "export const twice = (value: number): number => value * 2;\n",
      "src/thrice.ts": "export const thrice = (value: number): number => value * 3;\n",
    });

    expect(runDontReviewIt(["duplicated-bodies", "--repository-root", root])).toStrictEqual({
      exitCode: 0,
      out: "",
      error: "",
    });
  });

  test("duplicated-bodies names both sites when a body is spelled twice", () => {
    const root = repositoryWith({
      "src/twice.ts": "export const twice = (value: number): number => value * 2;\n",
      "src/doubled.ts": "export const doubled = (value: number): number => value * 2;\n",
    });

    expect(runDontReviewIt(["duplicated-bodies", "--repository-root", root])).toStrictEqual({
      exitCode: 0,
      out: "src/doubled.ts:1 doubled == src/twice.ts:1 twice\n",
      error: "",
    });
  });

  test("duplicated-bodies leaves test files out of the scan", () => {
    const root = repositoryWith({
      "src/twice.ts": "export const twice = (value: number): number => value * 2;\n",
      "src/twice.test.ts": "export const doubled = (value: number): number => value * 2;\n",
    });

    expect(runDontReviewIt(["duplicated-bodies", "--repository-root", root])).toStrictEqual({
      exitCode: 0,
      out: "",
      error: "",
    });
  });
});
