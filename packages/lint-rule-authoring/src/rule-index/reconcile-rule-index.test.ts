import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, onTestFinished, test } from "vite-plus/test";

import { formatLintRuleIndexProblem, lintRuleIndexProblems } from "./reconcile-rule-index.ts";

const repositoryWith = (files: Readonly<Record<string, string>>): string => {
  const root = mkdtempSync(join(tmpdir(), "reconcile-rule-index-"));
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

const WORKSPACE_DEFINITION = "packages:\n  - packages/*\n";

const DECLARING_MANIFEST = JSON.stringify({ name: "example", lintRules: ["src/rules"] });

const ruleSource = (name: string): string => `export const rule = {
  name: "${name}",
  meta: { docs: { description: "Disallow the thing" }, messages: { report: "No." } },
  create: () => ({}),
};
`;

const INDEX_PATH = "packages/example/docs/lint/index.md";

const declaringRepository = (extraFiles: Readonly<Record<string, string>> = {}): string =>
  repositoryWith({
    "pnpm-workspace.yaml": WORKSPACE_DEFINITION,
    "packages/example/package.json": DECLARING_MANIFEST,
    "packages/example/src/rules/no-thing--allow-it.ts": ruleSource("no-thing--allow-it"),
    ...extraFiles,
  });

describe("lintRuleIndexProblems", () => {
  test("a repository without declaring workspaces has nothing to reconcile", () => {
    expect(
      lintRuleIndexProblems({ repositoryRoot: repositoryWith({}), write: false }),
    ).toStrictEqual([]);
  });

  test("a missing index is reported and its report spells the path first", () => {
    const problems = lintRuleIndexProblems({ repositoryRoot: declaringRepository(), write: false });

    expect(problems.length).toBe(1);
    expect(formatLintRuleIndexProblem(problems[0] ?? { file: "", message: "" })).toContain(
      `${INDEX_PATH} A workspace that declares lint rules must not go without`,
    );
  });

  test("writing a missing index scaffolds it and the next check stays silent", () => {
    const root = declaringRepository();

    expect(lintRuleIndexProblems({ repositoryRoot: root, write: true })).toStrictEqual([]);

    const written = readFileSync(join(root, INDEX_PATH), "utf8");
    expect(written).toContain("# lint ルール索引");
    expect(written).toContain("<!-- BEGIN GENERATED lint-rules -->");
    expect(written).toContain("[no-thing--allow-it](./no-thing--allow-it.md)");
    expect(written).toContain("<!-- END GENERATED lint-rules -->");
    expect(lintRuleIndexProblems({ repositoryRoot: root, write: false })).toStrictEqual([]);
  });

  test("an index without the generated region is reported until writing inserts one", () => {
    const root = declaringRepository({ [INDEX_PATH]: "# 手書きの索引\n\n散文だけがある。\n" });

    const problems = lintRuleIndexProblems({ repositoryRoot: root, write: false });
    expect(problems[0]?.message).toContain("must not lose its generated region");

    expect(lintRuleIndexProblems({ repositoryRoot: root, write: true })).toStrictEqual([]);
    const written = readFileSync(join(root, INDEX_PATH), "utf8");
    expect(written.indexOf("<!-- BEGIN GENERATED lint-rules -->")).toBeLessThan(
      written.indexOf("# 手書きの索引"),
    );
  });

  test("the inserted region lands after frontmatter when the document opens with one", () => {
    const root = declaringRepository({
      [INDEX_PATH]: "---\ndescription: 索引\n---\n\n# 手書きの索引\n",
    });

    lintRuleIndexProblems({ repositoryRoot: root, write: true });

    const written = readFileSync(join(root, INDEX_PATH), "utf8");
    expect(written.startsWith("---\ndescription: 索引\n---\n")).toBe(true);
    expect(written.indexOf("<!-- BEGIN GENERATED lint-rules -->")).toBeLessThan(
      written.indexOf("# 手書きの索引"),
    );
  });

  test("an opening fence that never closes is treated as prose", () => {
    const root = declaringRepository({ [INDEX_PATH]: "---\nこの行は仕切りではない。\n" });

    lintRuleIndexProblems({ repositoryRoot: root, write: true });

    expect(readFileSync(join(root, INDEX_PATH), "utf8").startsWith("<!-- BEGIN")).toBe(true);
  });

  test("a stale region is reported until writing refreshes it and keeps the prose around it", () => {
    const root = declaringRepository({
      [INDEX_PATH]: `# 索引

前書き。

<!-- BEGIN GENERATED lint-rules -->

古い表

<!-- END GENERATED lint-rules -->

後書き。
`,
    });

    const problems = lintRuleIndexProblems({ repositoryRoot: root, write: false });
    expect(problems[0]?.message).toContain("must not fall behind the rule implementations");

    expect(lintRuleIndexProblems({ repositoryRoot: root, write: true })).toStrictEqual([]);
    const written = readFileSync(join(root, INDEX_PATH), "utf8");
    expect(written).toContain("前書き。");
    expect(written).toContain("後書き。");
    expect(written).toContain("[no-thing--allow-it](./no-thing--allow-it.md)");
    expect(written).not.toContain("古い表");
  });

  test("a region the formatter padded still counts as fresh", () => {
    const root = declaringRepository({
      [INDEX_PATH]: `# 索引

<!-- BEGIN GENERATED lint-rules -->

| ルール                                      | 説明               | ツール | 補足 |
| ------------------------------------------- | ------------------ | ------ | ---- |
| [no-thing--allow-it](./no-thing--allow-it.md) | Disallow the thing | -      |      |

<!-- END GENERATED lint-rules -->
`,
    });

    expect(lintRuleIndexProblems({ repositoryRoot: root, write: false })).toStrictEqual([]);
  });

  test("two rules sharing a name are reported in either mode", () => {
    const root = declaringRepository({
      "packages/example/src/rules/twin.ts": ruleSource("no-thing--allow-it"),
    });

    const checking = lintRuleIndexProblems({ repositoryRoot: root, write: false });
    expect(checking.some((problem) => problem.message.includes("must not share the name"))).toBe(
      true,
    );

    const writing = lintRuleIndexProblems({ repositoryRoot: root, write: true });
    expect(writing.some((problem) => problem.message.includes("must not share the name"))).toBe(
      true,
    );
  });

  test("a workspace with no rules yet still gets an index with an empty table", () => {
    const root = repositoryWith({
      "pnpm-workspace.yaml": WORKSPACE_DEFINITION,
      "packages/example/package.json": DECLARING_MANIFEST,
    });

    expect(lintRuleIndexProblems({ repositoryRoot: root, write: true })).toStrictEqual([]);
    expect(readFileSync(join(root, INDEX_PATH), "utf8")).toContain(
      "| ルール | 説明 | ツール | 補足 |",
    );
  });
});
