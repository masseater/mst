import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { lintRuleDocProblems } from "./reconcile-rule-doc.ts";
import { FRONTMATTER_DESCRIPTION_PATTERN, beginMarkerOf, endMarkerOf } from "./render-rule-doc.ts";
import { PLACEHOLDER_TOKENS } from "./scaffold-rule-doc.ts";

const RULE_SOURCE = `export const rule = {
  name: "no-thing--allow-it",
  meta: { docs: { description: "Disallow the thing" }, messages: { report: "No." } },
  create: () => ({}),
};
`;

const RULE_TEST = `testLintRule(rule, {
  valid: [{ name: "a value the rule leaves alone", documented: true, code: "export const shipped = true;" }],
  invalid: [],
});
`;

const DOC_PATH = "packages/example/docs/lint/no-thing--allow-it.md";

const WRITTEN_PROSE = "What this rule holds, and the move that clears a report.";

describe("lintRuleDocProblems", () => {
  const testInAWrittenDoc = test.extend("repository", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "reconcile-rule-doc-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    writeFileSync(join(root, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n", "utf8");
    mkdirSync(join(root, "packages/example/src/rules"), { recursive: true });
    writeFileSync(
      join(root, "packages/example/package.json"),
      JSON.stringify({ lintRules: ["src/rules"] }),
      "utf8",
    );
    writeFileSync(
      join(root, "packages/example/src/rules/no-thing--allow-it.ts"),
      RULE_SOURCE,
      "utf8",
    );
    writeFileSync(
      join(root, "packages/example/src/rules/no-thing--allow-it.test.ts"),
      RULE_TEST,
      "utf8",
    );
    lintRuleDocProblems({ repositoryRoot: root, write: true });
    const seeded = readFileSync(join(root, DOC_PATH), "utf8");
    writeFileSync(
      join(root, DOC_PATH),
      PLACEHOLDER_TOKENS.reduce((carried, token) => carried.replace(token, WRITTEN_PROSE), seeded),
      "utf8",
    );
    return root;
  });

  describe("a document whose sections are written and whose regions are fresh", () => {
    const it = testInAWrittenDoc.extend("report", ({ repository }) =>
      lintRuleDocProblems({ repositoryRoot: repository, write: false }),
    );

    it("asks for nothing", ({ report }) => {
      expect(report).toStrictEqual({ problems: [], scanned: 1 });
    });
  });

  describe("a document that lost a required heading", () => {
    const it = testInAWrittenDoc.extend("report", ({ repository }) => {
      const written = readFileSync(join(repository, DOC_PATH), "utf8");
      writeFileSync(join(repository, DOC_PATH), written.replace("## Fix\n", ""), "utf8");
      return lintRuleDocProblems({ repositoryRoot: repository, write: false });
    });

    it("names the heading it went without", ({ report }) => {
      expect(report).toStrictEqual({
        problems: [{ file: DOC_PATH, message: "A rule document must not go without `## Fix`." }],
        scanned: 1,
      });
    });
  });

  describe("a document that lost a generated region", () => {
    const it = testInAWrittenDoc.extend("report", ({ repository }) => {
      const written = readFileSync(join(repository, DOC_PATH), "utf8");
      writeFileSync(
        join(repository, DOC_PATH),
        written.replace(beginMarkerOf("examples"), ""),
        "utf8",
      );
      return lintRuleDocProblems({ repositoryRoot: repository, write: false });
    });

    it("names the region and sends the reader back to the seed", ({ report }) => {
      expect(report).toStrictEqual({
        problems: [
          {
            file: DOC_PATH,
            message:
              "A rule document must not lose its `examples` region. Delete the file and seed it again with `vp run guard:fix`.",
          },
        ],
        scanned: 1,
      });
    });
  });

  describe("a document that lost the description of its frontmatter", () => {
    const it = testInAWrittenDoc.extend("report", ({ repository }) => {
      const written = readFileSync(join(repository, DOC_PATH), "utf8");
      writeFileSync(
        join(repository, DOC_PATH),
        written.replace(FRONTMATTER_DESCRIPTION_PATTERN, "title: a rule"),
        "utf8",
      );
      return lintRuleDocProblems({ repositoryRoot: repository, write: false });
    });

    it("names the frontmatter description as the region it went without", ({ report }) => {
      expect(report).toStrictEqual({
        problems: [
          {
            file: DOC_PATH,
            message:
              "A rule document must not lose its `frontmatter description` region. Delete the file and seed it again with `vp run guard:fix`.",
          },
        ],
        scanned: 1,
      });
    });
  });

  describe("a document whose frontmatter description fell behind the rule", () => {
    const it = testInAWrittenDoc.extend("report", ({ repository }) => {
      const written = readFileSync(join(repository, DOC_PATH), "utf8");
      writeFileSync(
        join(repository, DOC_PATH),
        written.replace(FRONTMATTER_DESCRIPTION_PATTERN, 'description: "what it once disallowed"'),
        "utf8",
      );
      return lintRuleDocProblems({ repositoryRoot: repository, write: false });
    });

    it("asks for it to be regenerated", ({ report }) => {
      expect(report).toStrictEqual({
        problems: [
          {
            file: DOC_PATH,
            message:
              "The `frontmatter description` region must not fall behind the rule. Regenerate it with `vp run guard:fix`.",
          },
        ],
        scanned: 1,
      });
    });
  });

  describe("a document whose generated region fell behind the rule", () => {
    const it = testInAWrittenDoc.extend("report", ({ repository }) => {
      const written = readFileSync(join(repository, DOC_PATH), "utf8");
      writeFileSync(
        join(repository, DOC_PATH),
        written.replace(
          endMarkerOf("messages"),
          `what stood here before\n\n${endMarkerOf("messages")}`,
        ),
        "utf8",
      );
      return lintRuleDocProblems({ repositoryRoot: repository, write: false });
    });

    it("asks for that region to be regenerated", ({ report }) => {
      expect(report).toStrictEqual({
        problems: [
          {
            file: DOC_PATH,
            message:
              "The `messages` region must not fall behind the rule. Regenerate it with `vp run guard:fix`.",
          },
        ],
        scanned: 1,
      });
    });
  });

  describe("a check allowed to write over a region that fell behind", () => {
    const it = testInAWrittenDoc.extend("report", ({ repository }) => {
      const written = readFileSync(join(repository, DOC_PATH), "utf8");
      writeFileSync(
        join(repository, DOC_PATH),
        written.replace(
          endMarkerOf("messages"),
          `what stood here before\n\n${endMarkerOf("messages")}`,
        ),
        "utf8",
      );
      lintRuleDocProblems({ repositoryRoot: repository, write: true });
      return lintRuleDocProblems({ repositoryRoot: repository, write: false });
    });

    it("leaves the document with nothing left to ask for", ({ report }) => {
      expect(report).toStrictEqual({ problems: [], scanned: 1 });
    });
  });

  describe("a rule that declares no description", () => {
    const it = test
      .extend("repository", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "reconcile-rule-doc-"));
        onCleanup(() => {
          rmSync(root, { recursive: true, force: true });
        });
        writeFileSync(join(root, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n", "utf8");
        mkdirSync(join(root, "packages/example/src/rules"), { recursive: true });
        writeFileSync(
          join(root, "packages/example/package.json"),
          JSON.stringify({ lintRules: ["src/rules"] }),
          "utf8",
        );
        writeFileSync(
          join(root, "packages/example/src/rules/no-thing--allow-it.ts"),
          RULE_SOURCE.replace("Disallow the thing", ""),
          "utf8",
        );
        return root;
      })
      .extend("report", ({ repository }) =>
        lintRuleDocProblems({ repositoryRoot: repository, write: false }),
      );

    it("reports the rule itself rather than the document built from it", ({ report }) => {
      expect(report).toStrictEqual({
        problems: [
          {
            file: "src/rules/no-thing--allow-it.ts",
            message:
              "A rule must not go without `meta.docs.description`; the document is built from it. Declare it on the rule.",
          },
        ],
        scanned: 1,
      });
    });
  });
});
