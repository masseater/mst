import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { relatedGuidelineProblems } from "./related-guidelines.ts";

const WORKSPACE_DEFINITION = "packages:\n  - packages/*\n";

const DECLARING_MANIFEST = JSON.stringify({ name: "example", lintRules: ["src/rules"] });

const DECLARING_ROOT_MANIFEST = JSON.stringify({
  name: "probe",
  normativeDocuments: { fileName: "AGENTS.md", directories: ["docs/guidelines"] },
});

const RULE_PATH = "packages/example/src/rules/no-thing--allow-it.ts";

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
    docs: { description: "Disallow the thing", relatedGuidelines: ["docs/guidelines/tests.md"] },
    messages: { report: "No." },
  },
  create: () => ({}),
};
`;

const RULE_STANDING_ON_THE_OPERATING_DOCUMENT = `export const rule = {
  name: "no-thing--allow-it",
  meta: {
    docs: { description: "Disallow the thing", relatedGuidelines: ["AGENTS.md"] },
    messages: { report: "No." },
  },
  create: () => ({}),
};
`;

const RULE_STANDING_ON_ITS_OWN_WORKSPACE = `export const rule = {
  name: "no-thing--allow-it",
  meta: {
    docs: { description: "Disallow the thing", relatedGuidelines: ["packages/example/docs/guidelines/local.md"] },
    messages: { report: "No." },
  },
  create: () => ({}),
};
`;

const RULE_STANDING_ON_ITS_OWN_OPERATING_DOCUMENT = `export const rule = {
  name: "no-thing--allow-it",
  meta: {
    docs: { description: "Disallow the thing", relatedGuidelines: ["packages/example/AGENTS.md"] },
    messages: { report: "No." },
  },
  create: () => ({}),
};
`;

const RULE_NAMING_ONE_NORM_TWICE = `export const rule = {
  name: "no-thing--allow-it",
  meta: {
    docs: { description: "Disallow the thing", relatedGuidelines: ["docs/guidelines/tests.md", "docs/guidelines/tests.md"] },
    messages: { report: "No." },
  },
  create: () => ({}),
};
`;

const RULE_STANDING_ON_A_NORM_THAT_MOVED = `export const rule = {
  name: "no-thing--allow-it",
  meta: {
    docs: { description: "Disallow the thing", relatedGuidelines: ["docs/guidelines/gone.md"] },
    messages: { report: "No." },
  },
  create: () => ({}),
};
`;

const RULE_STANDING_ON_A_RECORD = `export const rule = {
  name: "no-thing--allow-it",
  meta: {
    docs: { description: "Disallow the thing", relatedGuidelines: ["docs/engineering-decision-logs/0001-a-decision.md"] },
    messages: { report: "No." },
  },
  create: () => ({}),
};
`;

const RULE_STANDING_ON_ANOTHER_WORKSPACE = `export const rule = {
  name: "no-thing--allow-it",
  meta: {
    docs: { description: "Disallow the thing", relatedGuidelines: ["packages/other/AGENTS.md"] },
    messages: { report: "No." },
  },
  create: () => ({}),
};
`;

const RULE_STANDING_ON_SOMETHING_UNREADABLE = `export const rule = {
  name: "no-thing--allow-it",
  meta: {
    docs: { description: "Disallow the thing", relatedGuidelines: ["docs/guidelines/notes.txt"] },
    messages: { report: "No." },
  },
  create: () => ({}),
};
`;

const RULE_NAMING_GROUNDS_BY_A_CONSTANT = `export const rule = {
  name: "no-thing--allow-it",
  meta: {
    docs: { description: "Disallow the thing", relatedGuidelines: GROUNDS },
    messages: { report: "No." },
  },
  create: () => ({}),
};
`;

const MISSING = `A rule must not go without the normative documents it enforces. Declare their repository-relative paths in \`meta.docs.relatedGuidelines\`, so a reader of the norm can find what enforces it.`;

const UNREADABLE = `A rule must not name its grounds with anything the checks cannot resolve to a path while reading the source. Something in this declaration does not settle into a path, so the checks that read the grounds match nothing against it. Write the paths as literals, or as a constant of this file that holds them.`;

const REPEATED = `A rule must not name the same normative document twice. Remove the repeated \`docs/guidelines/tests.md\`.`;

const ABSENT = `A rule must not name a normative document that does not exist. Point \`docs/guidelines/gone.md\` at a document that is there, or drop the grounds that moved away.`;

const OUTSIDE_A_RECORD = `A rule must not draw its grounds from outside the normative documents. Point \`docs/engineering-decision-logs/0001-a-decision.md\` at a document this repository declares as normative, which is an \`AGENTS.md\` or a document directly in one of ["docs/guidelines"], at the repository root or in the workspace that owns the rule.`;

const OUTSIDE_ANOTHER_WORKSPACE = `A rule must not draw its grounds from outside the normative documents. Point \`packages/other/AGENTS.md\` at a document this repository declares as normative, which is an \`AGENTS.md\` or a document directly in one of ["docs/guidelines"], at the repository root or in the workspace that owns the rule.`;

const NO_PLACE_DECLARED = `A repository whose rules stand on documents must not go without declaring where those documents live. Write \`normativeDocuments\` in the root manifest, naming the file every location is read through and the directories that hold the norms.`;

const NOT_A_DOCUMENT = `A rule must not name anything but a document as its grounds. \`docs/guidelines/notes.txt\` is not a \`.md\` file. Name the document that carries the norm.`;

describe("relatedGuidelineProblems", () => {
  describe("a rule declaring an empty list", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "related-guidelines-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "packages/example/src/rules"), { recursive: true });
      mkdirSync(join(root, "packages/example/docs/guidelines"), { recursive: true });
      mkdirSync(join(root, "packages/other"), { recursive: true });
      mkdirSync(join(root, "docs/guidelines"), { recursive: true });
      mkdirSync(join(root, "docs/engineering-decision-logs"), { recursive: true });
      writeFileSync(join(root, "pnpm-workspace.yaml"), WORKSPACE_DEFINITION, "utf8");
      writeFileSync(join(root, "package.json"), DECLARING_ROOT_MANIFEST, "utf8");
      writeFileSync(join(root, "AGENTS.md"), "# root\n", "utf8");
      writeFileSync(join(root, "packages/other/AGENTS.md"), "# other\n", "utf8");
      writeFileSync(join(root, "packages/example/AGENTS.md"), "# example\n", "utf8");
      writeFileSync(join(root, "docs/guidelines/tests.md"), "# tests\n", "utf8");
      writeFileSync(join(root, "docs/guidelines/notes.txt"), "plain\n", "utf8");
      writeFileSync(join(root, "packages/example/docs/guidelines/local.md"), "# local\n", "utf8");
      writeFileSync(
        join(root, "docs/engineering-decision-logs/0001-a-decision.md"),
        "# a decision\n",
        "utf8",
      );
      writeFileSync(join(root, "packages/example/package.json"), DECLARING_MANIFEST, "utf8");
      writeFileSync(join(root, RULE_PATH), RULE_STANDING_ON_NOTHING, "utf8");
      return relatedGuidelineProblems({ repositoryRoot: root });
    });

    it("is reported as standing on no norm", ({ report }) => {
      expect(report).toStrictEqual({
        problems: [{ file: RULE_PATH, message: MISSING }],
        scanned: 1,
      });
    });
  });

  describe("a rule naming grounds by a constant of another file", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "related-guidelines-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "packages/example/src/rules"), { recursive: true });
      mkdirSync(join(root, "packages/example/docs/guidelines"), { recursive: true });
      mkdirSync(join(root, "packages/other"), { recursive: true });
      mkdirSync(join(root, "docs/guidelines"), { recursive: true });
      mkdirSync(join(root, "docs/engineering-decision-logs"), { recursive: true });
      writeFileSync(join(root, "pnpm-workspace.yaml"), WORKSPACE_DEFINITION, "utf8");
      writeFileSync(join(root, "package.json"), DECLARING_ROOT_MANIFEST, "utf8");
      writeFileSync(join(root, "AGENTS.md"), "# root\n", "utf8");
      writeFileSync(join(root, "packages/other/AGENTS.md"), "# other\n", "utf8");
      writeFileSync(join(root, "packages/example/AGENTS.md"), "# example\n", "utf8");
      writeFileSync(join(root, "docs/guidelines/tests.md"), "# tests\n", "utf8");
      writeFileSync(join(root, "docs/guidelines/notes.txt"), "plain\n", "utf8");
      writeFileSync(join(root, "packages/example/docs/guidelines/local.md"), "# local\n", "utf8");
      writeFileSync(
        join(root, "docs/engineering-decision-logs/0001-a-decision.md"),
        "# a decision\n",
        "utf8",
      );
      writeFileSync(join(root, "packages/example/package.json"), DECLARING_MANIFEST, "utf8");
      writeFileSync(join(root, RULE_PATH), RULE_NAMING_GROUNDS_BY_A_CONSTANT, "utf8");
      return relatedGuidelineProblems({ repositoryRoot: root });
    });

    it("is reported because the checks cannot read what it named", ({ report }) => {
      expect(report).toStrictEqual({
        problems: [{ file: RULE_PATH, message: UNREADABLE }],
        scanned: 1,
      });
    });
  });

  describe("a rule naming a normative document that is there", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "related-guidelines-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "packages/example/src/rules"), { recursive: true });
      mkdirSync(join(root, "packages/example/docs/guidelines"), { recursive: true });
      mkdirSync(join(root, "packages/other"), { recursive: true });
      mkdirSync(join(root, "docs/guidelines"), { recursive: true });
      mkdirSync(join(root, "docs/engineering-decision-logs"), { recursive: true });
      writeFileSync(join(root, "pnpm-workspace.yaml"), WORKSPACE_DEFINITION, "utf8");
      writeFileSync(join(root, "package.json"), DECLARING_ROOT_MANIFEST, "utf8");
      writeFileSync(join(root, "AGENTS.md"), "# root\n", "utf8");
      writeFileSync(join(root, "packages/other/AGENTS.md"), "# other\n", "utf8");
      writeFileSync(join(root, "packages/example/AGENTS.md"), "# example\n", "utf8");
      writeFileSync(join(root, "docs/guidelines/tests.md"), "# tests\n", "utf8");
      writeFileSync(join(root, "docs/guidelines/notes.txt"), "plain\n", "utf8");
      writeFileSync(join(root, "packages/example/docs/guidelines/local.md"), "# local\n", "utf8");
      writeFileSync(
        join(root, "docs/engineering-decision-logs/0001-a-decision.md"),
        "# a decision\n",
        "utf8",
      );
      writeFileSync(join(root, "packages/example/package.json"), DECLARING_MANIFEST, "utf8");
      writeFileSync(join(root, RULE_PATH), RULE_STANDING_ON_A_NORM, "utf8");
      return relatedGuidelineProblems({ repositoryRoot: root });
    });

    it("is left alone", ({ report }) => {
      expect(report).toStrictEqual({ problems: [], scanned: 1 });
    });
  });

  describe("a rule naming the repository's own operating document", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "related-guidelines-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "packages/example/src/rules"), { recursive: true });
      mkdirSync(join(root, "packages/example/docs/guidelines"), { recursive: true });
      mkdirSync(join(root, "packages/other"), { recursive: true });
      mkdirSync(join(root, "docs/guidelines"), { recursive: true });
      mkdirSync(join(root, "docs/engineering-decision-logs"), { recursive: true });
      writeFileSync(join(root, "pnpm-workspace.yaml"), WORKSPACE_DEFINITION, "utf8");
      writeFileSync(join(root, "package.json"), DECLARING_ROOT_MANIFEST, "utf8");
      writeFileSync(join(root, "AGENTS.md"), "# root\n", "utf8");
      writeFileSync(join(root, "packages/other/AGENTS.md"), "# other\n", "utf8");
      writeFileSync(join(root, "packages/example/AGENTS.md"), "# example\n", "utf8");
      writeFileSync(join(root, "docs/guidelines/tests.md"), "# tests\n", "utf8");
      writeFileSync(join(root, "docs/guidelines/notes.txt"), "plain\n", "utf8");
      writeFileSync(join(root, "packages/example/docs/guidelines/local.md"), "# local\n", "utf8");
      writeFileSync(
        join(root, "docs/engineering-decision-logs/0001-a-decision.md"),
        "# a decision\n",
        "utf8",
      );
      writeFileSync(join(root, "packages/example/package.json"), DECLARING_MANIFEST, "utf8");
      writeFileSync(join(root, RULE_PATH), RULE_STANDING_ON_THE_OPERATING_DOCUMENT, "utf8");
      return relatedGuidelineProblems({ repositoryRoot: root });
    });

    it("is left alone", ({ report }) => {
      expect(report).toStrictEqual({ problems: [], scanned: 1 });
    });
  });

  describe("a rule naming a norm its own workspace carries", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "related-guidelines-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "packages/example/src/rules"), { recursive: true });
      mkdirSync(join(root, "packages/example/docs/guidelines"), { recursive: true });
      mkdirSync(join(root, "packages/other"), { recursive: true });
      mkdirSync(join(root, "docs/guidelines"), { recursive: true });
      mkdirSync(join(root, "docs/engineering-decision-logs"), { recursive: true });
      writeFileSync(join(root, "pnpm-workspace.yaml"), WORKSPACE_DEFINITION, "utf8");
      writeFileSync(join(root, "package.json"), DECLARING_ROOT_MANIFEST, "utf8");
      writeFileSync(join(root, "AGENTS.md"), "# root\n", "utf8");
      writeFileSync(join(root, "packages/other/AGENTS.md"), "# other\n", "utf8");
      writeFileSync(join(root, "packages/example/AGENTS.md"), "# example\n", "utf8");
      writeFileSync(join(root, "docs/guidelines/tests.md"), "# tests\n", "utf8");
      writeFileSync(join(root, "docs/guidelines/notes.txt"), "plain\n", "utf8");
      writeFileSync(join(root, "packages/example/docs/guidelines/local.md"), "# local\n", "utf8");
      writeFileSync(
        join(root, "docs/engineering-decision-logs/0001-a-decision.md"),
        "# a decision\n",
        "utf8",
      );
      writeFileSync(join(root, "packages/example/package.json"), DECLARING_MANIFEST, "utf8");
      writeFileSync(join(root, RULE_PATH), RULE_STANDING_ON_ITS_OWN_WORKSPACE, "utf8");
      return relatedGuidelineProblems({ repositoryRoot: root });
    });

    it("is left alone", ({ report }) => {
      expect(report).toStrictEqual({ problems: [], scanned: 1 });
    });
  });

  describe("a rule naming the operating document of its own workspace", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "related-guidelines-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "packages/example/src/rules"), { recursive: true });
      mkdirSync(join(root, "packages/example/docs/guidelines"), { recursive: true });
      mkdirSync(join(root, "packages/other"), { recursive: true });
      mkdirSync(join(root, "docs/guidelines"), { recursive: true });
      mkdirSync(join(root, "docs/engineering-decision-logs"), { recursive: true });
      writeFileSync(join(root, "pnpm-workspace.yaml"), WORKSPACE_DEFINITION, "utf8");
      writeFileSync(join(root, "package.json"), DECLARING_ROOT_MANIFEST, "utf8");
      writeFileSync(join(root, "AGENTS.md"), "# root\n", "utf8");
      writeFileSync(join(root, "packages/other/AGENTS.md"), "# other\n", "utf8");
      writeFileSync(join(root, "packages/example/AGENTS.md"), "# example\n", "utf8");
      writeFileSync(join(root, "docs/guidelines/tests.md"), "# tests\n", "utf8");
      writeFileSync(join(root, "docs/guidelines/notes.txt"), "plain\n", "utf8");
      writeFileSync(join(root, "packages/example/docs/guidelines/local.md"), "# local\n", "utf8");
      writeFileSync(
        join(root, "docs/engineering-decision-logs/0001-a-decision.md"),
        "# a decision\n",
        "utf8",
      );
      writeFileSync(join(root, "packages/example/package.json"), DECLARING_MANIFEST, "utf8");
      writeFileSync(join(root, RULE_PATH), RULE_STANDING_ON_ITS_OWN_OPERATING_DOCUMENT, "utf8");
      return relatedGuidelineProblems({ repositoryRoot: root });
    });

    it("is left alone", ({ report }) => {
      expect(report).toStrictEqual({ problems: [], scanned: 1 });
    });
  });

  describe("a rule naming the same document twice", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "related-guidelines-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "packages/example/src/rules"), { recursive: true });
      mkdirSync(join(root, "packages/example/docs/guidelines"), { recursive: true });
      mkdirSync(join(root, "packages/other"), { recursive: true });
      mkdirSync(join(root, "docs/guidelines"), { recursive: true });
      mkdirSync(join(root, "docs/engineering-decision-logs"), { recursive: true });
      writeFileSync(join(root, "pnpm-workspace.yaml"), WORKSPACE_DEFINITION, "utf8");
      writeFileSync(join(root, "package.json"), DECLARING_ROOT_MANIFEST, "utf8");
      writeFileSync(join(root, "AGENTS.md"), "# root\n", "utf8");
      writeFileSync(join(root, "packages/other/AGENTS.md"), "# other\n", "utf8");
      writeFileSync(join(root, "packages/example/AGENTS.md"), "# example\n", "utf8");
      writeFileSync(join(root, "docs/guidelines/tests.md"), "# tests\n", "utf8");
      writeFileSync(join(root, "docs/guidelines/notes.txt"), "plain\n", "utf8");
      writeFileSync(join(root, "packages/example/docs/guidelines/local.md"), "# local\n", "utf8");
      writeFileSync(
        join(root, "docs/engineering-decision-logs/0001-a-decision.md"),
        "# a decision\n",
        "utf8",
      );
      writeFileSync(join(root, "packages/example/package.json"), DECLARING_MANIFEST, "utf8");
      writeFileSync(join(root, RULE_PATH), RULE_NAMING_ONE_NORM_TWICE, "utf8");
      return relatedGuidelineProblems({ repositoryRoot: root });
    });

    it("is reported against the repetition", ({ report }) => {
      expect(report).toStrictEqual({
        problems: [{ file: RULE_PATH, message: REPEATED }],
        scanned: 1,
      });
    });
  });

  describe("a rule naming a normative document that is not there", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "related-guidelines-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "packages/example/src/rules"), { recursive: true });
      mkdirSync(join(root, "packages/example/docs/guidelines"), { recursive: true });
      mkdirSync(join(root, "packages/other"), { recursive: true });
      mkdirSync(join(root, "docs/guidelines"), { recursive: true });
      mkdirSync(join(root, "docs/engineering-decision-logs"), { recursive: true });
      writeFileSync(join(root, "pnpm-workspace.yaml"), WORKSPACE_DEFINITION, "utf8");
      writeFileSync(join(root, "package.json"), DECLARING_ROOT_MANIFEST, "utf8");
      writeFileSync(join(root, "AGENTS.md"), "# root\n", "utf8");
      writeFileSync(join(root, "packages/other/AGENTS.md"), "# other\n", "utf8");
      writeFileSync(join(root, "packages/example/AGENTS.md"), "# example\n", "utf8");
      writeFileSync(join(root, "docs/guidelines/tests.md"), "# tests\n", "utf8");
      writeFileSync(join(root, "docs/guidelines/notes.txt"), "plain\n", "utf8");
      writeFileSync(join(root, "packages/example/docs/guidelines/local.md"), "# local\n", "utf8");
      writeFileSync(
        join(root, "docs/engineering-decision-logs/0001-a-decision.md"),
        "# a decision\n",
        "utf8",
      );
      writeFileSync(join(root, "packages/example/package.json"), DECLARING_MANIFEST, "utf8");
      writeFileSync(join(root, RULE_PATH), RULE_STANDING_ON_A_NORM_THAT_MOVED, "utf8");
      return relatedGuidelineProblems({ repositoryRoot: root });
    });

    it("is reported as standing on a document that moved away", ({ report }) => {
      expect(report).toStrictEqual({
        problems: [{ file: RULE_PATH, message: ABSENT }],
        scanned: 1,
      });
    });
  });

  describe("a rule naming a record of a decision", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "related-guidelines-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "packages/example/src/rules"), { recursive: true });
      mkdirSync(join(root, "packages/example/docs/guidelines"), { recursive: true });
      mkdirSync(join(root, "packages/other"), { recursive: true });
      mkdirSync(join(root, "docs/guidelines"), { recursive: true });
      mkdirSync(join(root, "docs/engineering-decision-logs"), { recursive: true });
      writeFileSync(join(root, "pnpm-workspace.yaml"), WORKSPACE_DEFINITION, "utf8");
      writeFileSync(join(root, "package.json"), DECLARING_ROOT_MANIFEST, "utf8");
      writeFileSync(join(root, "AGENTS.md"), "# root\n", "utf8");
      writeFileSync(join(root, "packages/other/AGENTS.md"), "# other\n", "utf8");
      writeFileSync(join(root, "packages/example/AGENTS.md"), "# example\n", "utf8");
      writeFileSync(join(root, "docs/guidelines/tests.md"), "# tests\n", "utf8");
      writeFileSync(join(root, "docs/guidelines/notes.txt"), "plain\n", "utf8");
      writeFileSync(join(root, "packages/example/docs/guidelines/local.md"), "# local\n", "utf8");
      writeFileSync(
        join(root, "docs/engineering-decision-logs/0001-a-decision.md"),
        "# a decision\n",
        "utf8",
      );
      writeFileSync(join(root, "packages/example/package.json"), DECLARING_MANIFEST, "utf8");
      writeFileSync(join(root, RULE_PATH), RULE_STANDING_ON_A_RECORD, "utf8");
      return relatedGuidelineProblems({ repositoryRoot: root });
    });

    it("is reported because a record binds nobody", ({ report }) => {
      expect(report).toStrictEqual({
        problems: [
          {
            file: RULE_PATH,
            message: OUTSIDE_A_RECORD,
          },
        ],
        scanned: 1,
      });
    });
  });

  describe("a rule naming the operating document of another workspace", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "related-guidelines-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "packages/example/src/rules"), { recursive: true });
      mkdirSync(join(root, "packages/example/docs/guidelines"), { recursive: true });
      mkdirSync(join(root, "packages/other"), { recursive: true });
      mkdirSync(join(root, "docs/guidelines"), { recursive: true });
      mkdirSync(join(root, "docs/engineering-decision-logs"), { recursive: true });
      writeFileSync(join(root, "pnpm-workspace.yaml"), WORKSPACE_DEFINITION, "utf8");
      writeFileSync(join(root, "package.json"), DECLARING_ROOT_MANIFEST, "utf8");
      writeFileSync(join(root, "AGENTS.md"), "# root\n", "utf8");
      writeFileSync(join(root, "packages/other/AGENTS.md"), "# other\n", "utf8");
      writeFileSync(join(root, "packages/example/AGENTS.md"), "# example\n", "utf8");
      writeFileSync(join(root, "docs/guidelines/tests.md"), "# tests\n", "utf8");
      writeFileSync(join(root, "docs/guidelines/notes.txt"), "plain\n", "utf8");
      writeFileSync(join(root, "packages/example/docs/guidelines/local.md"), "# local\n", "utf8");
      writeFileSync(
        join(root, "docs/engineering-decision-logs/0001-a-decision.md"),
        "# a decision\n",
        "utf8",
      );
      writeFileSync(join(root, "packages/example/package.json"), DECLARING_MANIFEST, "utf8");
      writeFileSync(join(root, RULE_PATH), RULE_STANDING_ON_ANOTHER_WORKSPACE, "utf8");
      return relatedGuidelineProblems({ repositoryRoot: root });
    });

    it("is reported because the grounds sit outside the rule's reach", ({ report }) => {
      expect(report).toStrictEqual({
        problems: [{ file: RULE_PATH, message: OUTSIDE_ANOTHER_WORKSPACE }],
        scanned: 1,
      });
    });
  });

  describe("a rule naming something that is not a document", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "related-guidelines-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "packages/example/src/rules"), { recursive: true });
      mkdirSync(join(root, "packages/example/docs/guidelines"), { recursive: true });
      mkdirSync(join(root, "packages/other"), { recursive: true });
      mkdirSync(join(root, "docs/guidelines"), { recursive: true });
      mkdirSync(join(root, "docs/engineering-decision-logs"), { recursive: true });
      writeFileSync(join(root, "pnpm-workspace.yaml"), WORKSPACE_DEFINITION, "utf8");
      writeFileSync(join(root, "package.json"), DECLARING_ROOT_MANIFEST, "utf8");
      writeFileSync(join(root, "AGENTS.md"), "# root\n", "utf8");
      writeFileSync(join(root, "packages/other/AGENTS.md"), "# other\n", "utf8");
      writeFileSync(join(root, "packages/example/AGENTS.md"), "# example\n", "utf8");
      writeFileSync(join(root, "docs/guidelines/tests.md"), "# tests\n", "utf8");
      writeFileSync(join(root, "docs/guidelines/notes.txt"), "plain\n", "utf8");
      writeFileSync(join(root, "packages/example/docs/guidelines/local.md"), "# local\n", "utf8");
      writeFileSync(
        join(root, "docs/engineering-decision-logs/0001-a-decision.md"),
        "# a decision\n",
        "utf8",
      );
      writeFileSync(join(root, "packages/example/package.json"), DECLARING_MANIFEST, "utf8");
      writeFileSync(join(root, RULE_PATH), RULE_STANDING_ON_SOMETHING_UNREADABLE, "utf8");
      return relatedGuidelineProblems({ repositoryRoot: root });
    });

    it("is reported because only a document carries a norm", ({ report }) => {
      expect(report).toStrictEqual({
        problems: [{ file: RULE_PATH, message: NOT_A_DOCUMENT }],
        scanned: 1,
      });
    });
  });

  describe("a repository that declares no place while its rules name one", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "related-guidelines-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "packages/example/src/rules"), { recursive: true });
      mkdirSync(join(root, "docs/guidelines"), { recursive: true });
      writeFileSync(join(root, "pnpm-workspace.yaml"), WORKSPACE_DEFINITION, "utf8");
      writeFileSync(join(root, "package.json"), JSON.stringify({ name: "probe" }), "utf8");
      writeFileSync(join(root, "docs/guidelines/tests.md"), "# tests\n", "utf8");
      writeFileSync(join(root, "packages/example/package.json"), DECLARING_MANIFEST, "utf8");
      writeFileSync(join(root, RULE_PATH), RULE_STANDING_ON_A_NORM, "utf8");
      return relatedGuidelineProblems({ repositoryRoot: root });
    });

    it("names the missing declaration once, instead of every rule", ({ report }) => {
      expect(report).toStrictEqual({
        problems: [{ file: "package.json", message: NO_PLACE_DECLARED }],
        scanned: 1,
      });
    });
  });

  describe("a repository that declares no place while its rules name only the operating document", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "related-guidelines-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "packages/example/src/rules"), { recursive: true });
      writeFileSync(join(root, "pnpm-workspace.yaml"), WORKSPACE_DEFINITION, "utf8");
      writeFileSync(join(root, "package.json"), JSON.stringify({ name: "probe" }), "utf8");
      writeFileSync(join(root, "AGENTS.md"), "# root\n", "utf8");
      writeFileSync(join(root, "packages/example/package.json"), DECLARING_MANIFEST, "utf8");
      writeFileSync(join(root, RULE_PATH), RULE_STANDING_ON_THE_OPERATING_DOCUMENT, "utf8");
      return relatedGuidelineProblems({ repositoryRoot: root });
    });

    it("is left alone", ({ report }) => {
      expect(report).toStrictEqual({ problems: [], scanned: 1 });
    });
  });
});
