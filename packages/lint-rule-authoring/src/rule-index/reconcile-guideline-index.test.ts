import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { guidelineIndexProblems } from "./reconcile-guideline-index.ts";

const WORKSPACE_DEFINITION = "packages:\n  - packages/*\n";

const DECLARING_MANIFEST = JSON.stringify({ name: "example", lintRules: ["src/rules"] });

const DECLARING_ROOT_MANIFEST = JSON.stringify({
  name: "probe",
  normativeDocuments: { fileName: "AGENTS.md", directories: ["docs/guidelines"] },
});

const RULE_PATH = "packages/example/src/rules/no-thing--allow-it.ts";

const INDEX_PATH = "docs/lint-rules-by-guideline.md";

const RULE_STANDING_ON_NOTHING = `export const rule = {
  name: "no-thing--allow-it",
  meta: {
    docs: { description: "Disallow the thing", relatedGuidelines: [] },
    messages: { report: "No." },
  },
  create: () => ({}),
};
`;

const RULE_STANDING_ON_A_NORM = `export const rule = {
  name: "no-thing--allow-it",
  meta: {
    docs: { description: "Disallow the thing", relatedGuidelines: ["docs/guidelines/writing.md"] },
    messages: { report: "No." },
  },
  create: () => ({}),
};
`;

const MISSING = `A repository whose rules name their grounds must not go without \`${INDEX_PATH}\`. Generate it with \`vp run guard:fix\`.`;

const STRANDED = `\`${INDEX_PATH}\` must not stand while nothing keeps it fresh. This repository declares no place for its normative documents, so nothing regenerates the table. Declare \`normativeDocuments\` in the root manifest, or delete the table.`;

const STALE = `\`${INDEX_PATH}\` must not fall behind the grounds its rules declare. Regenerate it with \`vp run guard:fix\`.`;

describe("guidelineIndexProblems", () => {
  describe("a repository that declares no place for its norms", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "guideline-index-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "packages/example/src/rules"), { recursive: true });
      mkdirSync(join(root, "docs/guidelines"), { recursive: true });
      writeFileSync(join(root, "pnpm-workspace.yaml"), WORKSPACE_DEFINITION, "utf8");
      writeFileSync(join(root, "package.json"), JSON.stringify({ name: "probe" }), "utf8");
      writeFileSync(join(root, "docs/guidelines/writing.md"), "# writing\n", "utf8");
      writeFileSync(join(root, "packages/example/package.json"), DECLARING_MANIFEST, "utf8");
      writeFileSync(join(root, RULE_PATH), RULE_STANDING_ON_NOTHING, "utf8");
      return guidelineIndexProblems({ repositoryRoot: root, write: false });
    });

    it("has no table to keep", ({ report }) => {
      expect(report).toStrictEqual({ problems: [], scanned: 0 });
    });
  });

  describe("a table that is missing while the check only reads", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "guideline-index-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "packages/example/src/rules"), { recursive: true });
      mkdirSync(join(root, "docs/guidelines"), { recursive: true });
      writeFileSync(join(root, "pnpm-workspace.yaml"), WORKSPACE_DEFINITION, "utf8");
      writeFileSync(join(root, "package.json"), DECLARING_ROOT_MANIFEST, "utf8");
      writeFileSync(join(root, "docs/guidelines/writing.md"), "# writing\n", "utf8");
      writeFileSync(join(root, "packages/example/package.json"), DECLARING_MANIFEST, "utf8");
      writeFileSync(join(root, RULE_PATH), RULE_STANDING_ON_A_NORM, "utf8");
      return guidelineIndexProblems({ repositoryRoot: root, write: false });
    });

    it("is reported against the path it should have been written to", ({ report }) => {
      expect(report).toStrictEqual({
        problems: [{ file: INDEX_PATH, message: MISSING }],
        scanned: 1,
      });
    });
  });

  describe("a table that is missing while the check may write", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "guideline-index-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "packages/example/src/rules"), { recursive: true });
      mkdirSync(join(root, "docs/guidelines"), { recursive: true });
      writeFileSync(join(root, "pnpm-workspace.yaml"), WORKSPACE_DEFINITION, "utf8");
      writeFileSync(join(root, "package.json"), DECLARING_ROOT_MANIFEST, "utf8");
      writeFileSync(join(root, "docs/guidelines/writing.md"), "# writing\n", "utf8");
      writeFileSync(join(root, "packages/example/package.json"), DECLARING_MANIFEST, "utf8");
      writeFileSync(join(root, RULE_PATH), RULE_STANDING_ON_A_NORM, "utf8");
      return guidelineIndexProblems({ repositoryRoot: root, write: true });
    });

    it("leaves nothing to report", ({ report }) => {
      expect(report).toStrictEqual({ problems: [], scanned: 1 });
    });
  });

  describe("the file a generating run leaves behind", () => {
    const it = test.extend("tableText", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "guideline-index-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "packages/example/src/rules"), { recursive: true });
      mkdirSync(join(root, "docs/guidelines"), { recursive: true });
      writeFileSync(join(root, "pnpm-workspace.yaml"), WORKSPACE_DEFINITION, "utf8");
      writeFileSync(join(root, "package.json"), DECLARING_ROOT_MANIFEST, "utf8");
      writeFileSync(join(root, "docs/guidelines/writing.md"), "# writing\n", "utf8");
      writeFileSync(join(root, "packages/example/package.json"), DECLARING_MANIFEST, "utf8");
      writeFileSync(join(root, RULE_PATH), RULE_STANDING_ON_A_NORM, "utf8");
      guidelineIndexProblems({ repositoryRoot: root, write: true });
      return readFileSync(join(root, INDEX_PATH), "utf8");
    });

    it("carries the norm as a heading and the rule beneath it", ({ tableText }) => {
      expect(tableText).toMatchInlineSnapshot(`
        "# Rules by normative document

        Which lint rules of this repository declare each normative document as their grounds. Collected from those declarations alone, so what the off-the-shelf rules and the other checks cover is not in it. Generated; refresh it with \`vp run guard:fix\` rather than editing it.

        <!-- BEGIN GENERATED rules-by-guideline -->

        ## [docs/guidelines/writing.md](../docs/guidelines/writing.md)

        | Rule | Description |
        | --- | --- |
        | [no-thing--allow-it](../packages/example/docs/lint/no-thing--allow-it.md) | Disallow the thing |

        <!-- END GENERATED rules-by-guideline -->
        "
      `);
    });
  });

  describe("a table that fell behind what the rules declare", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "guideline-index-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "packages/example/src/rules"), { recursive: true });
      mkdirSync(join(root, "docs/guidelines"), { recursive: true });
      writeFileSync(join(root, "pnpm-workspace.yaml"), WORKSPACE_DEFINITION, "utf8");
      writeFileSync(join(root, "package.json"), DECLARING_ROOT_MANIFEST, "utf8");
      writeFileSync(join(root, "docs/guidelines/writing.md"), "# writing\n", "utf8");
      writeFileSync(join(root, "packages/example/package.json"), DECLARING_MANIFEST, "utf8");
      writeFileSync(join(root, RULE_PATH), RULE_STANDING_ON_A_NORM, "utf8");
      guidelineIndexProblems({ repositoryRoot: root, write: true });
      writeFileSync(
        join(root, INDEX_PATH),
        readFileSync(join(root, INDEX_PATH), "utf8").replace(
          "no-thing--allow-it",
          "no-other--allow-it",
        ),
        "utf8",
      );
      return guidelineIndexProblems({ repositoryRoot: root, write: false });
    });

    it("is reported as standing behind the grounds", ({ report }) => {
      expect(report).toStrictEqual({
        problems: [{ file: INDEX_PATH, message: STALE }],
        scanned: 1,
      });
    });
  });

  describe("a repository whose declared place is not there", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "guideline-index-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "packages/example/src/rules"), { recursive: true });
      writeFileSync(join(root, "pnpm-workspace.yaml"), WORKSPACE_DEFINITION, "utf8");
      writeFileSync(join(root, "package.json"), DECLARING_ROOT_MANIFEST, "utf8");
      writeFileSync(join(root, "packages/example/package.json"), DECLARING_MANIFEST, "utf8");
      writeFileSync(join(root, RULE_PATH), RULE_STANDING_ON_A_NORM, "utf8");
      return guidelineIndexProblems({ repositoryRoot: root, write: false });
    });

    it("has no table to keep", ({ report }) => {
      expect(report).toStrictEqual({ problems: [], scanned: 0 });
    });
  });

  describe("a declared place holding something that is not a document", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "guideline-index-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "packages/example/src/rules"), { recursive: true });
      mkdirSync(join(root, "docs/guidelines/rationales"), { recursive: true });
      writeFileSync(join(root, "pnpm-workspace.yaml"), WORKSPACE_DEFINITION, "utf8");
      writeFileSync(join(root, "package.json"), DECLARING_ROOT_MANIFEST, "utf8");
      writeFileSync(join(root, "docs/guidelines/notes.txt"), "plain\n", "utf8");
      writeFileSync(join(root, "packages/example/package.json"), DECLARING_MANIFEST, "utf8");
      writeFileSync(join(root, RULE_PATH), RULE_STANDING_ON_A_NORM, "utf8");
      return guidelineIndexProblems({ repositoryRoot: root, write: false });
    });

    it("counts neither the nested place nor the file that is not a document", ({ report }) => {
      expect(report).toStrictEqual({ problems: [], scanned: 0 });
    });
  });

  describe("a table that stands while the repository declares no place", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "guideline-index-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "packages/example/src/rules"), { recursive: true });
      mkdirSync(join(root, "docs"), { recursive: true });
      writeFileSync(join(root, "pnpm-workspace.yaml"), WORKSPACE_DEFINITION, "utf8");
      writeFileSync(join(root, "package.json"), JSON.stringify({ name: "probe" }), "utf8");
      writeFileSync(join(root, INDEX_PATH), "# a table left behind\n", "utf8");
      writeFileSync(join(root, "packages/example/package.json"), DECLARING_MANIFEST, "utf8");
      writeFileSync(join(root, RULE_PATH), RULE_STANDING_ON_A_NORM, "utf8");
      return guidelineIndexProblems({ repositoryRoot: root, write: false });
    });

    it("is reported as standing while nothing keeps it fresh", ({ report }) => {
      expect(report).toStrictEqual({
        problems: [{ file: INDEX_PATH, message: STRANDED }],
        scanned: 0,
      });
    });
  });
});
