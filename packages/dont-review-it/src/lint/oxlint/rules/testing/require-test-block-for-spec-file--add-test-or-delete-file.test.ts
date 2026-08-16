import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { requireTestBlockForSpecFile } from "./require-test-block-for-spec-file--add-test-or-delete-file.ts";

const SPEC_FILE = "report.test.ts";

describe("dont-review-it/require-test-block-for-spec-file--add-test-or-delete-file", () => {
  testLintRule(requireTestBlockForSpecFile, {
    valid: [
      {
        name: "a block that runs carries the file",
        documented: true,
        filename: SPEC_FILE,
        code: 'it("carries the id", ({ report }) => {\n  expect(report.id).toBe("a");\n});',
      },
      {
        name: "a block written under a grouping block runs the same way",
        filename: SPEC_FILE,
        code: 'describe("the summary", () => {\n  test("carries the id", ({ report }) => {\n    expect(report.id).toBe("a");\n  });\n});',
      },
      {
        name: "one block that runs is enough, however many are held back beside it",
        documented: true,
        filename: SPEC_FILE,
        code: 'it.skip("carries the id", () => {});\nit.todo("carries the total");\nit("carries the name", ({ report }) => {\n  expect(report.name).toBe("a");\n});',
      },
      {
        name: "a block reached through a renamed import runs under the name it was bound to",
        filename: SPEC_FILE,
        code: 'import { it as check } from "vitest";\ncheck("carries the id", ({ report }) => {\n  expect(report.id).toBe("a");\n});',
      },
      {
        name: "a block reached through a derived builder runs the same way",
        filename: SPEC_FILE,
        code: 'const check = test.extend({ report: summarise });\ncheck("carries the id", ({ report }) => {\n  expect(report.id).toBe("a");\n});',
      },
      {
        name: "a mark that settles while the program runs leaves a running path in the source",
        filename: SPEC_FILE,
        code: 'it.skipIf(offline)("carries the id", ({ report }) => {\n  expect(report.id).toBe("a");\n});\nit.runIf(online)("carries the total", ({ report }) => {\n  expect(report.total).toBe(2);\n});',
      },
      {
        name: "a group held back leaves the blocks it does not hold running",
        filename: SPEC_FILE,
        code: 'describe.skip("the draft", () => {\n  it("carries the id", () => {});\n});\nit("carries the total", ({ report }) => {\n  expect(report.total).toBe(2);\n});',
      },
      {
        name: "a group whose mark settles while the program runs holds nothing back",
        filename: SPEC_FILE,
        code: 'describe.skipIf(offline)("the summary", () => {\n  it("carries the id", ({ report }) => {\n    expect(report.id).toBe("a");\n  });\n});',
      },
      {
        name: "a table written out with rows in it runs once per row",
        filename: SPEC_FILE,
        code: 'it.each([["a"], ["b"]])("carries %s", (row) => {\n  expect(row).toBe("a");\n});',
      },
      {
        name: "a table that settles while the program runs leaves the count out of reach",
        filename: SPEC_FILE,
        code: 'it.each(rows)("carries %s", (row) => {\n  expect(row).toBe("a");\n});',
      },
      {
        name: "a table assembled from a spread leaves the count out of reach",
        filename: SPEC_FILE,
        code: 'it.each([...rows])("carries %s", (row) => {\n  expect(row).toBe("a");\n});',
      },
      {
        name: "a table written as a tagged template leaves the count out of reach",
        filename: SPEC_FILE,
        code: 'it.each`\n  row\n  ${1}\n`("carries $row", ({ row }) => {\n  expect(row).toBe(1);\n});',
      },
      {
        name: "a block whose arguments are spread hands this reading no body to read",
        filename: SPEC_FILE,
        code: 'it("carries the id", ...declaration);',
      },
      {
        name: "a block handed something other than a written out function may still run",
        filename: SPEC_FILE,
        code: 'it("carries the id", carriesTheId);',
      },
      {
        name: "a call into another module inside a group may declare the blocks this reading cannot see",
        filename: SPEC_FILE,
        code: 'import { testLintRule } from "@mst/lint-rule-authoring";\nimport { describe } from "vite-plus/test";\ndescribe("the summary", () => {\n  testLintRule(summariseRule, { valid: [], invalid: [] });\n});',
      },
      {
        name: "a call into another module at module scope may declare them just as well",
        filename: SPEC_FILE,
        code: 'import { runSuite } from "@mst/lint-rule-authoring";\nrunSuite(summariseRule);',
      },
      {
        name: "a member call into another module is read the same way",
        filename: SPEC_FILE,
        code: 'import * as authoring from "@mst/lint-rule-authoring";\nauthoring.runSuite(summariseRule);',
      },
      {
        name: "a declarer bound to a local name still reaches the module it came from",
        filename: SPEC_FILE,
        code: 'import { runSuite } from "@mst/lint-rule-authoring";\nconst run = runSuite;\nconst declare = run;\ndeclare(summariseRule);',
      },
      {
        name: "a file that is not a spec file is outside this reading",
        filename: "report.ts",
        code: "export const summarise = (seed) => ({ id: seed });",
      },
      {
        name: "a suffix the configuration replaced no longer marks a spec file",
        filename: SPEC_FILE,
        options: [{ specFileSuffixes: [".spec.ts"] }],
        code: "export const summarise = (seed) => ({ id: seed });",
      },
    ],
    invalid: [
      {
        name: "a file with nothing in it names a spec that checks nothing",
        documented: true,
        filename: SPEC_FILE,
        code: "",
        errors: [{ messageId: "noTestBlock" }],
      },
      {
        name: "a file that only imports declares no block",
        filename: SPEC_FILE,
        code: 'import { describe, expect, it } from "vitest";\n\nconst seed = "a";',
        errors: [{ messageId: "noTestBlock" }],
      },
      {
        name: "a file that only calls a name bound nowhere declares no block",
        filename: SPEC_FILE,
        code: 'record("carries the id", () => {\n  expect(summarise("a").id).toBe("a");\n});',
        errors: [{ messageId: "noTestBlock" }],
      },
      {
        name: "a file that only calls what it declares itself declares no block",
        filename: SPEC_FILE,
        code: 'const summarise = (seed) => ({ id: seed });\nexport const seeded = summarise("a");',
        errors: [{ messageId: "noTestBlock" }],
      },
      {
        name: "a call standing on a function written in place is rooted at no name to read",
        filename: SPEC_FILE,
        code: "let pending;\nconst { seed } = source;\n(() => summarise(seed))();",
        errors: [{ messageId: "noTestBlock" }],
      },
      {
        name: "a binding that names itself reaches no module, and the reading does not loop",
        filename: SPEC_FILE,
        code: "const declare = declare;\ndeclare(summariseRule);",
        errors: [{ messageId: "noTestBlock" }],
      },
      {
        name: "a group with nothing inside it divides what is never checked",
        filename: SPEC_FILE,
        code: 'describe("the summary", () => {});',
        errors: [{ messageId: "onlyGroupingBlocks" }],
      },
      {
        name: "groups nested inside groups still check nothing",
        filename: SPEC_FILE,
        code: 'describe("the summary", () => {\n  describe("the id", () => {});\n});',
        errors: [{ messageId: "onlyGroupingBlocks" }],
      },
      {
        name: "a group reached through a renamed import divides just as little",
        filename: SPEC_FILE,
        code: 'import { describe as group } from "vitest";\ngroup("the summary", () => {});',
        errors: [{ messageId: "onlyGroupingBlocks" }],
      },
      {
        name: "blocks marked as skipped run nothing",
        documented: true,
        filename: SPEC_FILE,
        code: 'it.skip("carries the id", () => {\n  expect(summarise("a").id).toBe("a");\n});',
        errors: [{ messageId: "heldBackTestBlocks" }],
      },
      {
        name: "blocks marked as todo run nothing",
        filename: SPEC_FILE,
        code: 'it.todo("carries the id");\ntest.todo("carries the total");',
        errors: [{ messageId: "heldBackTestBlocks" }],
      },
      {
        name: "a mark stacked in front of a table still holds the block back",
        filename: SPEC_FILE,
        code: 'it.skip.each([["a"]])("carries %s", (row) => {\n  expect(row).toBe("a");\n});',
        errors: [{ messageId: "heldBackTestBlocks" }],
      },
      {
        name: "a block standing without a body is work still to be written",
        filename: SPEC_FILE,
        code: 'it("carries the id");',
        errors: [{ messageId: "heldBackTestBlocks" }],
      },
      {
        name: "a table written out empty runs the block on no row at all",
        filename: SPEC_FILE,
        code: 'it.each([])("carries %s", (row) => {\n  expect(row).toBe("a");\n});',
        errors: [{ messageId: "heldBackTestBlocks" }],
      },
      {
        name: "a group held back holds back every block written inside it",
        filename: SPEC_FILE,
        code: 'describe.skip("the summary", () => {\n  it("carries the id", ({ report }) => {\n    expect(report.id).toBe("a");\n  });\n});',
        errors: [{ messageId: "heldBackTestBlocks" }],
      },
      {
        name: "a group marked as todo holds back the blocks written inside it",
        filename: SPEC_FILE,
        code: 'describe.todo("the summary", () => {\n  it("carries the id", ({ report }) => {\n    expect(report.id).toBe("a");\n  });\n});',
        errors: [{ messageId: "heldBackTestBlocks" }],
      },
      {
        name: "a call into another module written inside a held back block runs at test time, not at collection",
        filename: SPEC_FILE,
        code: 'import { expect, it } from "vite-plus/test";\nimport { summarise } from "./report.ts";\nit.skip("carries the id", () => {\n  expect(summarise("a").id).toBe("a");\n});',
        errors: [{ messageId: "heldBackTestBlocks" }],
      },
      {
        name: "a call into another module written inside a fixture initialiser runs at test time too",
        filename: SPEC_FILE,
        code: 'import { expect, test } from "vite-plus/test";\nimport { summarise } from "./report.ts";\nconst check = test.extend({ report: ({}, use) => use(summarise("a")) });\ncheck.skip("carries the id", ({ report }) => {\n  expect(report.id).toBe("a");\n});',
        errors: [{ messageId: "heldBackTestBlocks" }],
      },
      {
        name: "a block held back under a renamed import owes the same run",
        filename: SPEC_FILE,
        code: 'import { it as check } from "vitest";\ncheck.skip("carries the id", () => {});',
        errors: [{ messageId: "heldBackTestBlocks" }],
      },
      {
        name: "a block held back on a derived builder owes the same run",
        filename: SPEC_FILE,
        code: 'const check = test.extend({ report: summarise });\ncheck.todo("carries the id");',
        errors: [{ messageId: "heldBackTestBlocks" }],
      },
      {
        name: "a group standing beside blocks that are all held back reads as held back",
        filename: SPEC_FILE,
        code: 'describe("the summary", () => {\n  it.skip("carries the id", () => {});\n});',
        errors: [{ messageId: "heldBackTestBlocks" }],
      },
      {
        name: "a block whose spelling settles while the program runs is no block this reading can find",
        filename: SPEC_FILE,
        code: 'it[chosen]("carries the id", ({ report }) => {\n  expect(report.id).toBe("a");\n});',
        errors: [{ messageId: "noTestBlock" }],
      },
      {
        name: "a suffix the configuration added brings its own files into this reading",
        filename: "report.spec.ts",
        options: [{ specFileSuffixes: [".spec.ts"] }],
        code: "export const summarise = (seed) => ({ id: seed });",
        errors: [{ messageId: "noTestBlock" }],
      },
    ],
  });
});
