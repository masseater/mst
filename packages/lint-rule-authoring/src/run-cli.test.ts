import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { describe, expect, test, vi } from "vite-plus/test";

import { runLintRuleAuthoring } from "./run-cli.ts";

const USAGE = `Usage: lint-rule-authoring check [--write] [--repository-root <path>]

Reconciles every workspace lint rule index (docs/lint/index.md), every rule
document (docs/lint/<rule>.md), and the repository table of rules by normative
document (docs/lint-rules-by-guideline.md) with the rule implementations found
under the directories that the workspace manifests declare in their lintRules
field. Also reports every rule that names no normative document as its grounds,
or names one that is not there. Without --write it only reports what is missing,
unmarked, stale, or still carrying the text a seeded document was written with;
with --write it seeds the absent documents and regenerates every generated
region. Exits non-zero when a problem remains.

Options:
  --write                   Write the regenerated documents instead of only reporting them.
  --repository-root <path>  Root of the repository to scan. Defaults to the current working directory.
`;

const MISSING_INDEX = `packages/example/docs/lint/index.md A workspace that declares lint rules must not go without \`packages/example/docs/lint/index.md\`. Generate it with \`vp run guard:fix\`.\n`;

const MISSING_DOC = `packages/example/docs/lint/no-thing--allow-it.md A rule must not go without its document. Seed it with \`vp run guard:fix\`, then write the sections it leaves for you.\n`;

const MISSING_GUIDELINE_INDEX = `docs/lint-rules-by-guideline.md A repository whose rules name their grounds must not go without \`docs/lint-rules-by-guideline.md\`. Generate it with \`vp run guard:fix\`.\n`;

const SEEDED_SECTIONS = [
  `packages/example/docs/lint/no-thing--allow-it.md A seeded section must not be left as it was written. Replace "State what this rule rejects, why the invariant behind it holds, and where the detection stops short.".`,
  `packages/example/docs/lint/no-thing--allow-it.md A seeded section must not be left as it was written. Replace "State the change that resolves a report.".`,
  `packages/example/docs/lint/no-thing--allow-it.md A seeded section must not be left as it was written. Replace "Name the ways a report can be silenced without being resolved.".`,
];

const NO_EXAMPLE = `packages/example/docs/lint/no-thing--allow-it.md A rule document must not go without an example. Mark the test cases to publish with \`documented: true\` in \`src/rules/no-thing--allow-it.test.ts\`.`;

const UNSPELLABLE_EXAMPLE = `packages/example/docs/lint/no-thing--allow-it.md A test case marked to publish must not build its code from values this reader cannot settle. "a case whose code is read at run time" in \`src/rules/no-thing--allow-it.test.ts\` resolves to no text. Write its code as a literal, or take the mark off it.`;

const SEEDED_SECTIONS_LEFT_AS_WRITTEN = [...SEEDED_SECTIONS, NO_EXAMPLE, ""].join("\n");

const DECLARED_RULE = `export const rule = {
  name: "no-thing--allow-it",
  meta: {
    docs: { description: "Disallow the thing", relatedGuidelines: ["docs/guidelines/writing.md"] },
    messages: { report: "No." },
  },
  create: () => ({}),
};
`;

const UNSPELLABLE_TEST = `testLintRule(rule, {
  valid: [{ name: "a case whose code is read at run time", documented: true, code: readCode() }],
  invalid: [],
});
`;

const JOINED_TEST = `const ANNOTATION = [":", "any"].join(" ");

testLintRule(rule, {
  valid: [
    {
      name: "a value that names no loose type passes",
      documented: true,
      code: \`const held\${ANNOTATION} = read();\`,
    },
  ],
  invalid: [],
});
`;

const TEST_FILE_PATH = "packages/example/src/rules/no-thing--allow-it.test.ts";

describe("runLintRuleAuthoring", () => {
  const testInADeclaringRepository = test.extend("declaringRepository", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "lint-rule-authoring-cli-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    writeFileSync(join(root, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n", "utf8");
    writeFileSync(
      join(root, "package.json"),
      JSON.stringify({
        name: "probe",
        normativeDocuments: { fileName: "AGENTS.md", directories: ["docs/guidelines"] },
      }),
      "utf8",
    );
    mkdirSync(join(root, "packages/example/src/rules"), { recursive: true });
    mkdirSync(join(root, "docs/guidelines"), { recursive: true });
    writeFileSync(join(root, "docs/guidelines/writing.md"), "# writing\n", "utf8");
    writeFileSync(
      join(root, "packages/example/package.json"),
      JSON.stringify({ lintRules: ["src/rules"] }),
      "utf8",
    );
    writeFileSync(
      join(root, "packages/example/src/rules/no-thing--allow-it.ts"),
      DECLARED_RULE,
      "utf8",
    );
    return root;
  });

  describe("a repository that declares no lint rules", () => {
    const testInAnEmptyRepository = test.extend("emptyRepository", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "lint-rule-authoring-cli-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      return root;
    });

    describe("a check of it", () => {
      const it = testInAnEmptyRepository.extend("theRun", ({ emptyRepository }) =>
        runLintRuleAuthoring(["check", "--repository-root", emptyRepository]),
      );

      it("stays silent and exits zero because every index is fresh", ({ theRun }) => {
        expect(theRun).toStrictEqual({ exitCode: 0, out: "", error: "" });
      });
    });

    describe("a check of a repository root inside it that is no directory", () => {
      const it = testInAnEmptyRepository.extend("theRun", ({ emptyRepository }) =>
        runLintRuleAuthoring(["check", "--repository-root", join(emptyRepository, "missing")]),
      );

      it("exits two instead of scanning nothing, naming the root back", ({
        theRun,
        emptyRepository,
      }) => {
        expect(theRun).toStrictEqual({
          exitCode: 2,
          out: "",
          error: `${resolve(join(emptyRepository, "missing"))} is not a directory that can be scanned.\n`,
        });
      });
    });
  });

  describe("a repository that declares lint rules and carries no index", () => {
    describe("a check of it", () => {
      const it = testInADeclaringRepository.extend("theRun", ({ declaringRepository }) =>
        runLintRuleAuthoring(["check", "--repository-root", declaringRepository]),
      );

      it("reports every document it would have generated, and exits one", ({ theRun }) => {
        expect(theRun).toStrictEqual({
          exitCode: 1,
          out: `${MISSING_INDEX}${MISSING_DOC}${MISSING_GUIDELINE_INDEX}`,
          error: "",
        });
      });
    });

    describe("a check of it that is allowed to write", () => {
      const it = testInADeclaringRepository.extend("theRun", ({ declaringRepository }) =>
        runLintRuleAuthoring(["check", "--write", "--repository-root", declaringRepository]),
      );

      it("regenerates the index, seeds the document, and asks for the sections it left", ({
        theRun,
      }) => {
        expect(theRun).toStrictEqual({
          exitCode: 1,
          out: SEEDED_SECTIONS_LEFT_AS_WRITTEN,
          error: "",
        });
      });
    });

    describe("a check of it that follows a writing check", () => {
      const it = testInADeclaringRepository.extend("theRun", ({ declaringRepository }) => {
        runLintRuleAuthoring(["check", "--write", "--repository-root", declaringRepository]);
        return runLintRuleAuthoring(["check", "--repository-root", declaringRepository]);
      });

      it("leaves nothing about the index and keeps asking for the seeded sections", ({
        theRun,
      }) => {
        expect(theRun).toStrictEqual({
          exitCode: 1,
          out: SEEDED_SECTIONS_LEFT_AS_WRITTEN,
          error: "",
        });
      });
    });
  });

  describe("a repository whose test marks a case it builds at run time", () => {
    const it = testInADeclaringRepository.extend("theRun", ({ declaringRepository }) => {
      writeFileSync(join(declaringRepository, TEST_FILE_PATH), UNSPELLABLE_TEST, "utf8");
      return runLintRuleAuthoring(["check", "--write", "--repository-root", declaringRepository]);
    });

    it("names the marked case it could not spell out beside the missing example", ({ theRun }) => {
      expect(theRun).toStrictEqual({
        exitCode: 1,
        out: [...SEEDED_SECTIONS, NO_EXAMPLE, UNSPELLABLE_EXAMPLE, ""].join("\n"),
        error: "",
      });
    });
  });

  describe("a repository whose test marks a case built from a joined constant", () => {
    const it = testInADeclaringRepository.extend("theRun", ({ declaringRepository }) => {
      writeFileSync(join(declaringRepository, TEST_FILE_PATH), JOINED_TEST, "utf8");
      return runLintRuleAuthoring(["check", "--write", "--repository-root", declaringRepository]);
    });

    it("publishes the case and asks only for the sections it seeded", ({ theRun }) => {
      expect(theRun).toStrictEqual({
        exitCode: 1,
        out: [...SEEDED_SECTIONS, ""].join("\n"),
        error: "",
      });
    });
  });

  describe("a check given no repository root", () => {
    const it = test
      .extend("workingDirectory", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "lint-rule-authoring-cli-"));
        onCleanup(() => {
          rmSync(root, { recursive: true, force: true });
        });
        return root;
      })
      .extend("theRun", ({ workingDirectory }) => {
        vi.spyOn(process, "cwd").mockReturnValue(workingDirectory);
        return runLintRuleAuthoring(["check"]);
      });

    it("scans the working directory and finds nothing to report", ({ theRun }) => {
      expect(theRun).toStrictEqual({ exitCode: 0, out: "", error: "" });
    });
  });

  describe("an unknown command", () => {
    const it = test.extend("theRun", () => runLintRuleAuthoring(["publish"]));

    it("returns the usage as an error and exits two", ({ theRun }) => {
      expect(theRun).toStrictEqual({ exitCode: 2, out: "", error: USAGE });
    });
  });

  describe("no command at all", () => {
    const it = test.extend("theRun", () => runLintRuleAuthoring([]));

    it("is answered the same way an unknown command is", ({ theRun }) => {
      expect(theRun).toStrictEqual({ exitCode: 2, out: "", error: USAGE });
    });
  });

  describe("an unknown option", () => {
    const it = test.extend("theRun", () => runLintRuleAuthoring(["check", "--repo-root", "."]));

    it("exits two instead of falling back to a default", ({ theRun }) => {
      expect(theRun).toStrictEqual({
        exitCode: 2,
        out: "",
        error: `Unknown option '--repo-root'. To specify a positional argument starting with a '-', place it at the end of the command after '--', as in '-- "--repo-root"\n`,
      });
    });
  });
});
