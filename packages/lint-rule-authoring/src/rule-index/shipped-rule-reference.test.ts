import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { shippedRuleReferenceProblems } from "./shipped-rule-reference.ts";

import type { BundledLintRule } from "./rule-bundle.ts";

const WORKSPACE_DIR = "packages/example";

const REFERENCE_PATH = "packages/example/skills/core/references/lint-rules.md";

const SKILL_PATH = "packages/example/skills/core/SKILL.md";

const SKILL_SOURCE = "---\nname: core\n---\n";

const rules: readonly BundledLintRule[] = [
  {
    name: "no-thing--allow-it",
    description: "Disallow the thing",
    sourcePath: "src/rules/no-thing--allow-it.ts",
    fixable: false,
    hasSuggestions: false,
    configurable: false,
    shipped: true,
    bundle: null,
    messages: [],
  },
];

const MISSING_REFERENCE = `A package that ships both lint rules and agent skills must not go without \`${REFERENCE_PATH}\`, because the rule documents stay in the repository and never reach an installed copy. Generate it with \`vp run guard:fix\`.`;

const MISSING_MARKERS = `\`${REFERENCE_PATH}\` must not lose its generated region. Put \`<!-- BEGIN GENERATED shipped-lint-rules -->\` and \`<!-- END GENERATED shipped-lint-rules -->\` back, or delete the file and regenerate it with \`vp run guard:fix\`.`;

const STALE_REFERENCE = `\`${REFERENCE_PATH}\` must not fall behind the rule implementations it lists. Regenerate it with \`vp run guard:fix\`.`;

const HANDWRITTEN_REFERENCE = "# A reference someone typed\n\nProse only.\n";

const STALE_REGION_REFERENCE =
  "# Reference\n\n<!-- BEGIN GENERATED shipped-lint-rules -->\n\nan old table\n\n<!-- END GENERATED shipped-lint-rules -->\n";

const WRITTEN_REFERENCE = [
  "# Lint rules this package ships",
  "",
  "Every rule below is registered at error severity unless the table says the preset leaves it off. Generated from the rule implementations; regenerate with `vp run guard:fix` rather than editing it.",
  "",
  "<!-- BEGIN GENERATED shipped-lint-rules -->",
  "",
  "| Rule | What it rejects | Notices |",
  "| --- | --- | --- |",
  "| [no-thing--allow-it](https://github.com/masseater/mst/blob/main/packages/example/docs/lint/no-thing--allow-it.md) | Disallow the thing |  |",
  "",
  "<!-- END GENERATED shipped-lint-rules -->",
  "",
].join("\n");

describe("shippedRuleReferenceProblems", () => {
  describe("a workspace that declares rules but ships no skill", () => {
    const it = test.extend("problems", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "shipped-rule-reference-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      return shippedRuleReferenceProblems({
        repositoryRoot: root,
        workspaceDir: WORKSPACE_DIR,
        rules,
        write: false,
      });
    });

    it("asks for no reference at all", ({ problems }) => {
      expect(problems).toStrictEqual([]);
    });
  });

  describe("a reference that is missing while the check only reads", () => {
    const it = test.extend("problems", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "shipped-rule-reference-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "packages/example/skills/core"), { recursive: true });
      writeFileSync(join(root, SKILL_PATH), SKILL_SOURCE, "utf8");
      return shippedRuleReferenceProblems({
        repositoryRoot: root,
        workspaceDir: WORKSPACE_DIR,
        rules,
        write: false,
      });
    });

    it("is reported against the path it should have been written to", ({ problems }) => {
      expect(problems).toStrictEqual([{ file: REFERENCE_PATH, message: MISSING_REFERENCE }]);
    });
  });

  describe("a reference that is missing while the check may write", () => {
    const it = test.extend("written", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "shipped-rule-reference-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "packages/example/skills/core"), { recursive: true });
      writeFileSync(join(root, SKILL_PATH), SKILL_SOURCE, "utf8");
      shippedRuleReferenceProblems({
        repositoryRoot: root,
        workspaceDir: WORKSPACE_DIR,
        rules,
        write: true,
      });
      return readFileSync(join(root, REFERENCE_PATH), "utf8");
    });

    it("writes the table inside a generated region", ({ written }) => {
      expect(written).toBe(WRITTEN_REFERENCE);
    });
  });

  describe("a reference whose generated region was removed", () => {
    const it = test.extend("problems", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "shipped-rule-reference-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "packages/example/skills/core/references"), { recursive: true });
      writeFileSync(join(root, SKILL_PATH), SKILL_SOURCE, "utf8");
      writeFileSync(join(root, REFERENCE_PATH), HANDWRITTEN_REFERENCE, "utf8");
      return shippedRuleReferenceProblems({
        repositoryRoot: root,
        workspaceDir: WORKSPACE_DIR,
        rules,
        write: false,
      });
    });

    it("asks for the markers back", ({ problems }) => {
      expect(problems).toStrictEqual([{ file: REFERENCE_PATH, message: MISSING_MARKERS }]);
    });
  });

  describe("a reference whose region no longer matches the rules", () => {
    const it = test.extend("problems", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "shipped-rule-reference-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "packages/example/skills/core/references"), { recursive: true });
      writeFileSync(join(root, SKILL_PATH), SKILL_SOURCE, "utf8");
      writeFileSync(join(root, REFERENCE_PATH), STALE_REGION_REFERENCE, "utf8");
      return shippedRuleReferenceProblems({
        repositoryRoot: root,
        workspaceDir: WORKSPACE_DIR,
        rules,
        write: false,
      });
    });

    it("reports it as fallen behind the rule implementations", ({ problems }) => {
      expect(problems).toStrictEqual([{ file: REFERENCE_PATH, message: STALE_REFERENCE }]);
    });
  });
});
