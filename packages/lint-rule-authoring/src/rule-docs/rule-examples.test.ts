import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { lintRuleExamplesIn } from "./rule-examples.ts";

const SOURCE_PATH = "src/rules/no-thing--allow-it.ts";

const TEST_PATH = "src/rules/no-thing--allow-it.test.ts";

describe("lintRuleExamplesIn", () => {
  describe("a test that marks a case on the valid side alone", () => {
    const it = test.extend("examples", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "rule-examples-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(dirname(join(root, TEST_PATH)), { recursive: true });
      writeFileSync(
        join(root, TEST_PATH),
        `testLintRule(rule, {
  valid: [
    { name: "a value the rule leaves alone", documented: true, code: "export const shipped = true;" },
  ],
});
`,
        "utf8",
      );
      return lintRuleExamplesIn({ workspaceRoot: root, sourcePath: SOURCE_PATH });
    });

    it("publishes that case and finds no side to read on the other one", ({ examples }) => {
      expect(examples).toStrictEqual({
        valid: [
          {
            name: "a value the rule leaves alone",
            code: "export const shipped = true;",
            filename: null,
          },
        ],
        invalid: [],
        unspellable: [],
      });
    });
  });

  describe("a test that marks a case on the invalid side", () => {
    const it = test.extend("examples", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "rule-examples-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(dirname(join(root, TEST_PATH)), { recursive: true });
      writeFileSync(
        join(root, TEST_PATH),
        `testLintRule(rule, {
  valid: [],
  invalid: [
    {
      name: "a value the rule rejects",
      documented: true,
      code: "export default true;",
      filename: "src/shipped.ts",
    },
  ],
});
`,
        "utf8",
      );
      return lintRuleExamplesIn({ workspaceRoot: root, sourcePath: SOURCE_PATH });
    });

    it("publishes that case with the file name it was given", ({ examples }) => {
      expect(examples).toStrictEqual({
        valid: [],
        invalid: [
          {
            name: "a value the rule rejects",
            code: "export default true;",
            filename: "src/shipped.ts",
          },
        ],
        unspellable: [],
      });
    });
  });

  describe("a marked case that spells out no name", () => {
    const it = test.extend("examples", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "rule-examples-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(dirname(join(root, TEST_PATH)), { recursive: true });
      writeFileSync(
        join(root, TEST_PATH),
        `testLintRule(rule, {
  valid: [{ documented: true, code: "export const shipped = true;" }],
  invalid: [],
});
`,
        "utf8",
      );
      return lintRuleExamplesIn({ workspaceRoot: root, sourcePath: SOURCE_PATH });
    });

    it("carries it out as unspellable under a name that says so", ({ examples }) => {
      expect(examples).toStrictEqual({
        valid: [],
        invalid: [],
        unspellable: ["a case that spells out no name"],
      });
    });
  });

  describe("a test file that hands no case list to the tester", () => {
    const it = test.extend("examples", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "rule-examples-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(dirname(join(root, TEST_PATH)), { recursive: true });
      writeFileSync(join(root, TEST_PATH), "describe(rule.name, () => {});\n", "utf8");
      return lintRuleExamplesIn({ workspaceRoot: root, sourcePath: SOURCE_PATH });
    });

    it("finds nothing to publish", ({ examples }) => {
      expect(examples).toStrictEqual({ valid: [], invalid: [], unspellable: [] });
    });
  });

  describe("a rule that carries no test file", () => {
    const it = test.extend("examples", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "rule-examples-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      return lintRuleExamplesIn({ workspaceRoot: root, sourcePath: SOURCE_PATH });
    });

    it("finds nothing to publish either", ({ examples }) => {
      expect(examples).toStrictEqual({ valid: [], invalid: [], unspellable: [] });
    });
  });
});
