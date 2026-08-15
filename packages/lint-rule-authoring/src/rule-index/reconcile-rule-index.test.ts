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

const HANDWRITTEN_INDEX = "# A hand written index\n\nProse and nothing else.\n";

const STALE_REGION_INDEX = `# An index\n\nFront matter prose.\n\n<!-- BEGIN GENERATED lint-rules -->\n\nA stale table\n\n<!-- END GENERATED lint-rules -->\n\nTrailing prose.\n`;

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
        "# Lint rule index

        Every lint rule this workspace implements. Generated from the rule sources; refresh it with \`vp run guard:fix\` rather than editing it.

        <!-- BEGIN GENERATED lint-rules -->

        | Rule | Description | Tool | Notices |
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

        | Rule | Description | Tool | Notices |
        | --- | --- | --- | --- |
        | [no-thing--allow-it](./no-thing--allow-it.md) | Disallow the thing | - |  |

        <!-- END GENERATED lint-rules -->

        # A hand written index

        Prose and nothing else.
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
        "---\ndescription: an index\n---\n\n# A hand written index\n",
        "utf8",
      );
      lintRuleIndexProblems({ repositoryRoot: root, write: true });
      return readFileSync(join(root, INDEX_PATH), "utf8");
    });

    it("takes the inserted region after the frontmatter", ({ indexText }) => {
      expect(indexText).toMatchInlineSnapshot(`
        "---
        description: an index
        ---

        <!-- BEGIN GENERATED lint-rules -->

        | Rule | Description | Tool | Notices |
        | --- | --- | --- | --- |
        | [no-thing--allow-it](./no-thing--allow-it.md) | Disallow the thing | - |  |

        <!-- END GENERATED lint-rules -->


        # A hand written index
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
      writeFileSync(join(root, INDEX_PATH), "---\nThis line is not a fence.\n", "utf8");
      lintRuleIndexProblems({ repositoryRoot: root, write: true });
      return readFileSync(join(root, INDEX_PATH), "utf8");
    });

    it("is treated as prose", ({ indexText }) => {
      expect(indexText).toMatchInlineSnapshot(`
        "<!-- BEGIN GENERATED lint-rules -->

        | Rule | Description | Tool | Notices |
        | --- | --- | --- | --- |
        | [no-thing--allow-it](./no-thing--allow-it.md) | Disallow the thing | - |  |

        <!-- END GENERATED lint-rules -->

        ---
        This line is not a fence.
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
        "# An index

        Front matter prose.

        <!-- BEGIN GENERATED lint-rules -->

        | Rule | Description | Tool | Notices |
        | --- | --- | --- | --- |
        | [no-thing--allow-it](./no-thing--allow-it.md) | Disallow the thing | - |  |

        <!-- END GENERATED lint-rules -->

        Trailing prose.
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
        `# An index\n\n<!-- BEGIN GENERATED lint-rules -->\n\n| Rule                                        | Description        | Tool   | Notices |\n| ------------------------------------------- | ------------------ | ------ | ---- |\n| [no-thing--allow-it](./no-thing--allow-it.md) | Disallow the thing | -      |      |\n\n<!-- END GENERATED lint-rules -->\n`,
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
        "# Lint rule index

        Every lint rule this workspace implements. Generated from the rule sources; refresh it with \`vp run guard:fix\` rather than editing it.

        <!-- BEGIN GENERATED lint-rules -->

        | Rule | Description | Tool | Notices |
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
