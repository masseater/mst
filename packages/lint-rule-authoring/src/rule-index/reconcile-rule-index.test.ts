import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { formatLintRuleProblem } from "../lint-rule-problem.ts";
import { lintRuleIndexProblems } from "./reconcile-rule-index.ts";

const WORKSPACE_DEFINITION = "packages:\n  - packages/*\n";

const DECLARING_MANIFEST = JSON.stringify({ name: "example", lintRules: ["src/rules"] });

const INDEX_PATH = "packages/example/docs/lint/index.md";

const RULE_SOURCE = `export const rule = {
  name: "no-thing--allow-it",
  meta: { docs: { description: "Disallow the thing" }, messages: { report: "No." } },
  create: () => ({}),
};
`;

const MISSING_INDEX = `A workspace that declares lint rules must not go without \`${INDEX_PATH}\`. Generate it with \`vp run guard:fix\`.`;

const MISSING_MARKERS = `\`${INDEX_PATH}\` must not lose its generated region. Put \`<!-- BEGIN GENERATED lint-rules -->\` and \`<!-- END GENERATED lint-rules -->\` back, or delete the file and regenerate it with \`vp run guard:fix\`.`;

const STALE_INDEX = `\`${INDEX_PATH}\` must not fall behind the rule implementations. Regenerate it with \`vp run guard:fix\`.`;

const DUPLICATED_RULE_NAME = `Two rules in \`packages/example\` must not share the name \`no-thing--allow-it\`; they claim the same document. Rename one of them.`;

const HANDWRITTEN_INDEX = "# 手書きの索引\n\n散文だけがある。\n";

const STALE_REGION_INDEX = `# 索引\n\n前書き。\n\n<!-- BEGIN GENERATED lint-rules -->\n\n古い表\n\n<!-- END GENERATED lint-rules -->\n\n後書き。\n`;

describe("lintRuleIndexProblems", () => {
  describe("a repository without declaring workspaces", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "reconcile-rule-index-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      return lintRuleIndexProblems({ repositoryRoot: root, write: false });
    });

    it("has nothing to reconcile", ({ report }) => {
      expect(report).toStrictEqual({ problems: [], scanned: 0 });
    });
  });

  describe("an index that is missing while the check only reads", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "reconcile-rule-index-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "packages/example/src/rules"), { recursive: true });
      writeFileSync(join(root, "pnpm-workspace.yaml"), WORKSPACE_DEFINITION, "utf8");
      writeFileSync(join(root, "packages/example/package.json"), DECLARING_MANIFEST, "utf8");
      writeFileSync(
        join(root, "packages/example/src/rules/no-thing--allow-it.ts"),
        RULE_SOURCE,
        "utf8",
      );
      return lintRuleIndexProblems({ repositoryRoot: root, write: false });
    });

    it("is reported against the path it should have been written to", ({ report }) => {
      expect(report).toStrictEqual({
        problems: [{ file: INDEX_PATH, message: MISSING_INDEX }],
        scanned: 1,
      });
    });
  });

  describe("an index that is missing while the check may write", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "reconcile-rule-index-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "packages/example/src/rules"), { recursive: true });
      writeFileSync(join(root, "pnpm-workspace.yaml"), WORKSPACE_DEFINITION, "utf8");
      writeFileSync(join(root, "packages/example/package.json"), DECLARING_MANIFEST, "utf8");
      writeFileSync(
        join(root, "packages/example/src/rules/no-thing--allow-it.ts"),
        RULE_SOURCE,
        "utf8",
      );
      return lintRuleIndexProblems({ repositoryRoot: root, write: true });
    });

    it("leaves nothing to report", ({ report }) => {
      expect(report).toStrictEqual({ problems: [], scanned: 1 });
    });
  });

  describe("the file a scaffolding run leaves behind", () => {
    const it = test.extend("indexText", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "reconcile-rule-index-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "packages/example/src/rules"), { recursive: true });
      writeFileSync(join(root, "pnpm-workspace.yaml"), WORKSPACE_DEFINITION, "utf8");
      writeFileSync(join(root, "packages/example/package.json"), DECLARING_MANIFEST, "utf8");
      writeFileSync(
        join(root, "packages/example/src/rules/no-thing--allow-it.ts"),
        RULE_SOURCE,
        "utf8",
      );
      lintRuleIndexProblems({ repositoryRoot: root, write: true });
      return readFileSync(join(root, INDEX_PATH), "utf8");
    });

    it("carries the generated region and the rule", ({ indexText }) => {
      expect(indexText).toMatchInlineSnapshot(`
        "# lint ルール索引

        このワークスペースの自前 lint ルールの一覧。ルール実装から生成される。手で書き換えない。更新は \`vp run guard:fix\` で行う。

        <!-- BEGIN GENERATED lint-rules -->

        | ルール | 説明 | ツール | 補足 |
        | --- | --- | --- | --- |
        | [no-thing--allow-it](./no-thing--allow-it.md) | Disallow the thing | - |  |

        <!-- END GENERATED lint-rules -->
        "
      `);
    });
  });

  describe("the check that follows a scaffolding run", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "reconcile-rule-index-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "packages/example/src/rules"), { recursive: true });
      writeFileSync(join(root, "pnpm-workspace.yaml"), WORKSPACE_DEFINITION, "utf8");
      writeFileSync(join(root, "packages/example/package.json"), DECLARING_MANIFEST, "utf8");
      writeFileSync(
        join(root, "packages/example/src/rules/no-thing--allow-it.ts"),
        RULE_SOURCE,
        "utf8",
      );
      lintRuleIndexProblems({ repositoryRoot: root, write: true });
      return lintRuleIndexProblems({ repositoryRoot: root, write: false });
    });

    it("stays silent", ({ report }) => {
      expect(report).toStrictEqual({ problems: [], scanned: 1 });
    });
  });

  describe("an index without the generated region while the check only reads", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "reconcile-rule-index-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "packages/example/src/rules"), { recursive: true });
      writeFileSync(join(root, "pnpm-workspace.yaml"), WORKSPACE_DEFINITION, "utf8");
      writeFileSync(join(root, "packages/example/package.json"), DECLARING_MANIFEST, "utf8");
      writeFileSync(
        join(root, "packages/example/src/rules/no-thing--allow-it.ts"),
        RULE_SOURCE,
        "utf8",
      );
      mkdirSync(dirname(join(root, INDEX_PATH)), { recursive: true });
      writeFileSync(join(root, INDEX_PATH), HANDWRITTEN_INDEX, "utf8");
      return lintRuleIndexProblems({ repositoryRoot: root, write: false });
    });

    it("is reported", ({ report }) => {
      expect(report).toStrictEqual({
        problems: [{ file: INDEX_PATH, message: MISSING_MARKERS }],
        scanned: 1,
      });
    });
  });

  describe("an index without the generated region while the check may write", () => {
    const it = test.extend("indexText", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "reconcile-rule-index-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "packages/example/src/rules"), { recursive: true });
      writeFileSync(join(root, "pnpm-workspace.yaml"), WORKSPACE_DEFINITION, "utf8");
      writeFileSync(join(root, "packages/example/package.json"), DECLARING_MANIFEST, "utf8");
      writeFileSync(
        join(root, "packages/example/src/rules/no-thing--allow-it.ts"),
        RULE_SOURCE,
        "utf8",
      );
      mkdirSync(dirname(join(root, INDEX_PATH)), { recursive: true });
      writeFileSync(join(root, INDEX_PATH), HANDWRITTEN_INDEX, "utf8");
      lintRuleIndexProblems({ repositoryRoot: root, write: true });
      return readFileSync(join(root, INDEX_PATH), "utf8");
    });

    it("gets the generated region inserted ahead of the prose", ({ indexText }) => {
      expect(indexText).toMatchInlineSnapshot(`
        "<!-- BEGIN GENERATED lint-rules -->

        | ルール | 説明 | ツール | 補足 |
        | --- | --- | --- | --- |
        | [no-thing--allow-it](./no-thing--allow-it.md) | Disallow the thing | - |  |

        <!-- END GENERATED lint-rules -->

        # 手書きの索引

        散文だけがある。
        "
      `);
    });
  });

  describe("a document that opens with frontmatter", () => {
    const it = test.extend("indexText", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "reconcile-rule-index-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "packages/example/src/rules"), { recursive: true });
      writeFileSync(join(root, "pnpm-workspace.yaml"), WORKSPACE_DEFINITION, "utf8");
      writeFileSync(join(root, "packages/example/package.json"), DECLARING_MANIFEST, "utf8");
      writeFileSync(
        join(root, "packages/example/src/rules/no-thing--allow-it.ts"),
        RULE_SOURCE,
        "utf8",
      );
      mkdirSync(dirname(join(root, INDEX_PATH)), { recursive: true });
      writeFileSync(
        join(root, INDEX_PATH),
        "---\ndescription: 索引\n---\n\n# 手書きの索引\n",
        "utf8",
      );
      lintRuleIndexProblems({ repositoryRoot: root, write: true });
      return readFileSync(join(root, INDEX_PATH), "utf8");
    });

    it("takes the inserted region after the frontmatter", ({ indexText }) => {
      expect(indexText).toMatchInlineSnapshot(`
        "---
        description: 索引
        ---

        <!-- BEGIN GENERATED lint-rules -->

        | ルール | 説明 | ツール | 補足 |
        | --- | --- | --- | --- |
        | [no-thing--allow-it](./no-thing--allow-it.md) | Disallow the thing | - |  |

        <!-- END GENERATED lint-rules -->


        # 手書きの索引
        "
      `);
    });
  });

  describe("an opening fence that never closes", () => {
    const it = test.extend("indexText", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "reconcile-rule-index-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "packages/example/src/rules"), { recursive: true });
      writeFileSync(join(root, "pnpm-workspace.yaml"), WORKSPACE_DEFINITION, "utf8");
      writeFileSync(join(root, "packages/example/package.json"), DECLARING_MANIFEST, "utf8");
      writeFileSync(
        join(root, "packages/example/src/rules/no-thing--allow-it.ts"),
        RULE_SOURCE,
        "utf8",
      );
      mkdirSync(dirname(join(root, INDEX_PATH)), { recursive: true });
      writeFileSync(join(root, INDEX_PATH), "---\nこの行は仕切りではない。\n", "utf8");
      lintRuleIndexProblems({ repositoryRoot: root, write: true });
      return readFileSync(join(root, INDEX_PATH), "utf8");
    });

    it("is treated as prose", ({ indexText }) => {
      expect(indexText).toMatchInlineSnapshot(`
        "<!-- BEGIN GENERATED lint-rules -->

        | ルール | 説明 | ツール | 補足 |
        | --- | --- | --- | --- |
        | [no-thing--allow-it](./no-thing--allow-it.md) | Disallow the thing | - |  |

        <!-- END GENERATED lint-rules -->

        ---
        この行は仕切りではない。
        "
      `);
    });
  });

  describe("a stale region while the check only reads", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "reconcile-rule-index-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "packages/example/src/rules"), { recursive: true });
      writeFileSync(join(root, "pnpm-workspace.yaml"), WORKSPACE_DEFINITION, "utf8");
      writeFileSync(join(root, "packages/example/package.json"), DECLARING_MANIFEST, "utf8");
      writeFileSync(
        join(root, "packages/example/src/rules/no-thing--allow-it.ts"),
        RULE_SOURCE,
        "utf8",
      );
      mkdirSync(dirname(join(root, INDEX_PATH)), { recursive: true });
      writeFileSync(join(root, INDEX_PATH), STALE_REGION_INDEX, "utf8");
      return lintRuleIndexProblems({ repositoryRoot: root, write: false });
    });

    it("is reported", ({ report }) => {
      expect(report).toStrictEqual({
        problems: [{ file: INDEX_PATH, message: STALE_INDEX }],
        scanned: 1,
      });
    });
  });

  describe("a stale region while the check may write", () => {
    const it = test.extend("indexText", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "reconcile-rule-index-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "packages/example/src/rules"), { recursive: true });
      writeFileSync(join(root, "pnpm-workspace.yaml"), WORKSPACE_DEFINITION, "utf8");
      writeFileSync(join(root, "packages/example/package.json"), DECLARING_MANIFEST, "utf8");
      writeFileSync(
        join(root, "packages/example/src/rules/no-thing--allow-it.ts"),
        RULE_SOURCE,
        "utf8",
      );
      mkdirSync(dirname(join(root, INDEX_PATH)), { recursive: true });
      writeFileSync(join(root, INDEX_PATH), STALE_REGION_INDEX, "utf8");
      lintRuleIndexProblems({ repositoryRoot: root, write: true });
      return readFileSync(join(root, INDEX_PATH), "utf8");
    });

    it("is refreshed while the prose around it stays", ({ indexText }) => {
      expect(indexText).toMatchInlineSnapshot(`
        "# 索引

        前書き。

        <!-- BEGIN GENERATED lint-rules -->

        | ルール | 説明 | ツール | 補足 |
        | --- | --- | --- | --- |
        | [no-thing--allow-it](./no-thing--allow-it.md) | Disallow the thing | - |  |

        <!-- END GENERATED lint-rules -->

        後書き。
        "
      `);
    });
  });

  describe("a region the formatter padded", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "reconcile-rule-index-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "packages/example/src/rules"), { recursive: true });
      writeFileSync(join(root, "pnpm-workspace.yaml"), WORKSPACE_DEFINITION, "utf8");
      writeFileSync(join(root, "packages/example/package.json"), DECLARING_MANIFEST, "utf8");
      writeFileSync(
        join(root, "packages/example/src/rules/no-thing--allow-it.ts"),
        RULE_SOURCE,
        "utf8",
      );
      mkdirSync(dirname(join(root, INDEX_PATH)), { recursive: true });
      writeFileSync(
        join(root, INDEX_PATH),
        `# 索引\n\n<!-- BEGIN GENERATED lint-rules -->\n\n| ルール                                      | 説明               | ツール | 補足 |\n| ------------------------------------------- | ------------------ | ------ | ---- |\n| [no-thing--allow-it](./no-thing--allow-it.md) | Disallow the thing | -      |      |\n\n<!-- END GENERATED lint-rules -->\n`,
        "utf8",
      );
      return lintRuleIndexProblems({ repositoryRoot: root, write: false });
    });

    it("still counts as fresh", ({ report }) => {
      expect(report).toStrictEqual({ problems: [], scanned: 1 });
    });
  });

  describe("two rules sharing a name while the check only reads", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "reconcile-rule-index-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "packages/example/src/rules"), { recursive: true });
      writeFileSync(join(root, "pnpm-workspace.yaml"), WORKSPACE_DEFINITION, "utf8");
      writeFileSync(join(root, "packages/example/package.json"), DECLARING_MANIFEST, "utf8");
      writeFileSync(
        join(root, "packages/example/src/rules/no-thing--allow-it.ts"),
        RULE_SOURCE,
        "utf8",
      );
      writeFileSync(join(root, "packages/example/src/rules/twin.ts"), RULE_SOURCE, "utf8");
      return lintRuleIndexProblems({ repositoryRoot: root, write: false });
    });

    it("are reported ahead of the missing index", ({ report }) => {
      expect(report).toStrictEqual({
        problems: [
          { file: INDEX_PATH, message: DUPLICATED_RULE_NAME },
          { file: INDEX_PATH, message: MISSING_INDEX },
        ],
        scanned: 1,
      });
    });
  });

  describe("two rules sharing a name while the check may write", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "reconcile-rule-index-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "packages/example/src/rules"), { recursive: true });
      writeFileSync(join(root, "pnpm-workspace.yaml"), WORKSPACE_DEFINITION, "utf8");
      writeFileSync(join(root, "packages/example/package.json"), DECLARING_MANIFEST, "utf8");
      writeFileSync(
        join(root, "packages/example/src/rules/no-thing--allow-it.ts"),
        RULE_SOURCE,
        "utf8",
      );
      writeFileSync(join(root, "packages/example/src/rules/twin.ts"), RULE_SOURCE, "utf8");
      return lintRuleIndexProblems({ repositoryRoot: root, write: true });
    });

    it("are reported even though the index gets written", ({ report }) => {
      expect(report).toStrictEqual({
        problems: [{ file: INDEX_PATH, message: DUPLICATED_RULE_NAME }],
        scanned: 1,
      });
    });
  });

  describe("a workspace with no rules yet while the check may write", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "reconcile-rule-index-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "packages/example"), { recursive: true });
      writeFileSync(join(root, "pnpm-workspace.yaml"), WORKSPACE_DEFINITION, "utf8");
      writeFileSync(join(root, "packages/example/package.json"), DECLARING_MANIFEST, "utf8");
      return lintRuleIndexProblems({ repositoryRoot: root, write: true });
    });

    it("leaves nothing to report", ({ report }) => {
      expect(report).toStrictEqual({ problems: [], scanned: 1 });
    });
  });

  describe("the file a workspace with no rules yet gets", () => {
    const it = test.extend("indexText", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "reconcile-rule-index-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "packages/example"), { recursive: true });
      writeFileSync(join(root, "pnpm-workspace.yaml"), WORKSPACE_DEFINITION, "utf8");
      writeFileSync(join(root, "packages/example/package.json"), DECLARING_MANIFEST, "utf8");
      lintRuleIndexProblems({ repositoryRoot: root, write: true });
      return readFileSync(join(root, INDEX_PATH), "utf8");
    });

    it("carries an empty table", ({ indexText }) => {
      expect(indexText).toMatchInlineSnapshot(`
        "# lint ルール索引

        このワークスペースの自前 lint ルールの一覧。ルール実装から生成される。手で書き換えない。更新は \`vp run guard:fix\` で行う。

        <!-- BEGIN GENERATED lint-rules -->

        | ルール | 説明 | ツール | 補足 |
        | --- | --- | --- | --- |

        <!-- END GENERATED lint-rules -->
        "
      `);
    });
  });
});

describe("formatLintRuleProblem", () => {
  describe("a problem naming the index it was found against", () => {
    const it = test.extend("formattedProblem", () =>
      formatLintRuleProblem({ file: INDEX_PATH, message: MISSING_INDEX }));

    it("spells the path first and the message after it", ({ formattedProblem }) => {
      expect(formattedProblem).toBe(`${INDEX_PATH} ${MISSING_INDEX}`);
    });
  });
});
