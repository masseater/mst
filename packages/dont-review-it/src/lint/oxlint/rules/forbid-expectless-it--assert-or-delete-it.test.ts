import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { forbidExpectlessIt } from "./forbid-expectless-it--assert-or-delete-it.ts";

const SPEC_FILE = "report.test.ts";

describe("dont-review-it/forbid-expectless-it--assert-or-delete-it", () => {
  testLintRule(forbidExpectlessIt, {
    valid: [
      {
        name: "a block that pins its subject writes the claim its name promises",
        filename: SPEC_FILE,
        code: 'it("carries what it summarised", ({ report }) => {\n  expect(report).toStrictEqual({ id: "a", total: 2 });\n});',
      },
      {
        name: "a claim reached through a modifier or a derived entry is still a claim",
        filename: SPEC_FILE,
        code: 'it("rejects an empty source", ({ pending }) => {\n  expect(pending).rejects.toThrow(failure);\n});\nit("carries the id", ({ report }) => {\n  expect(report.id).not.toBe("b");\n});\nit("carries the total", ({ report }) => {\n  expect.soft(report.total).toBe(2);\n});\nit("settles on the id", ({ read }) => {\n  expect.poll(read).toBe("a");\n});',
      },
      {
        name: "a claim written inside a callback of the block stands in the block",
        filename: SPEC_FILE,
        code: 'it("carries every row", ({ rows }) => {\n  rows.forEach((row) => {\n    expect(row).toBe("a");\n  });\n});',
      },
      {
        name: "a body that is nothing but the claim needs no braces",
        filename: SPEC_FILE,
        code: 'it("carries the id", ({ report }) => expect(report.id).toBe("a"));',
      },
      {
        name: "a claim handed back for the runner to wait on is written in the block",
        filename: SPEC_FILE,
        code: 'it("settles on the summary", ({ pending }) => {\n  return expect(pending).resolves.toStrictEqual({ id: "a" });\n});',
      },
      {
        name: "a matcher chosen at run time still reaches a matcher",
        filename: SPEC_FILE,
        code: 'it("carries the id", ({ report }) => {\n  expect(report.id)[chosen]("a");\n});',
      },
      {
        name: "a suppressed block that claims something is left alone",
        filename: SPEC_FILE,
        code: 'it.skip("carries the id", ({ report }) => {\n  expect(report.id).toBe("a");\n});',
      },
      {
        name: "a table driven block claims once per row",
        filename: SPEC_FILE,
        code: 'it.each(rows)("carries %s", (row) => {\n  expect(row).toBe("a");\n});',
      },
      {
        name: "a block reached through a renamed import claims the same way",
        filename: SPEC_FILE,
        code: 'import { it as check } from "vitest";\ncheck("carries the id", ({ report }) => {\n  expect(report.id).toBe("a");\n});',
      },
      {
        name: "a block reached through a derived builder claims the same way",
        filename: SPEC_FILE,
        code: 'const check = test.extend({ report: summarise });\ncheck("carries the id", ({ report }) => {\n  expect(report.id).toBe("a");\n});',
      },
      {
        name: "a claim standing outside every block belongs to no block",
        filename: SPEC_FILE,
        code: 'expect(seed.id).toBe("a");\nit("carries the total", ({ report }) => {\n  expect(report.total).toBe(2);\n});',
      },
      {
        name: "a grouping block names no behaviour of its own",
        filename: SPEC_FILE,
        code: 'describe("the summary", () => {\n  it("carries the id", ({ report }) => {\n    expect(report.id).toBe("a");\n  });\n});',
      },
      {
        name: "a call that declares no test block is outside this reading",
        filename: SPEC_FILE,
        code: 'record("carries the id", () => {\n  const report = summarise();\n});',
      },
      {
        name: "a block declared without a spelled name is no test block declaration",
        filename: SPEC_FILE,
        code: "it(() => {});",
      },
      {
        name: "a block handed no callback declares work still to be written, not a run that passed",
        filename: SPEC_FILE,
        code: 'it("carries the id");\nit.todo("carries the total");',
      },
      {
        name: "a block whose arguments are spread hands this reading no body to read",
        filename: SPEC_FILE,
        code: "it(...declaration);",
      },
      {
        name: "a file that is not a spec file is outside this reading",
        filename: "report.ts",
        code: 'it("carries the id", () => {});',
      },
      {
        name: "a suffix the configuration replaced no longer marks a spec file",
        filename: SPEC_FILE,
        options: [{ specFileSuffixes: [".spec.ts"] }],
        code: 'it("carries the id", () => {});',
      },
    ],
    invalid: [
      {
        name: "a block with an empty body claims nothing",
        filename: SPEC_FILE,
        code: 'it("carries the id", () => {});',
        errors: [{ messageId: "expectlessIt" }],
      },
      {
        name: "a block holding nothing but a comment claims nothing",
        filename: SPEC_FILE,
        code: 'it("carries the id", () => {\n  // the id comes from the source\n});',
        errors: [{ messageId: "expectlessIt" }],
      },
      {
        name: "declaring how many assertions the block carries is no claim",
        filename: SPEC_FILE,
        code: 'it("carries the id", () => {\n  expect.assertions(1);\n});\nit("carries the total", () => {\n  expect.hasAssertions();\n});',
        errors: [{ messageId: "expectlessIt" }, { messageId: "expectlessIt" }],
      },
      {
        name: "a body that only names a value claims nothing",
        filename: SPEC_FILE,
        code: 'it("carries the id", ({ report }) => {\n  report.id;\n});',
        errors: [{ messageId: "expectlessIt" }],
      },
      {
        name: "an entry that never reaches a matcher claims nothing",
        filename: SPEC_FILE,
        code: 'it("carries the id", ({ report }) => {\n  expect(report.id);\n});\nit("carries the total", ({ report }) => {\n  expect(report.total).toBe;\n});',
        errors: [{ messageId: "expectlessIt" }, { messageId: "expectlessIt" }],
      },
      {
        name: "a body that only runs the code under test claims nothing",
        filename: SPEC_FILE,
        code: 'it("summarises the source", ({ source }) => summarise(source));',
        errors: [{ messageId: "expectlessIt" }],
      },
      {
        name: "a body that only prepares a subject claims nothing",
        filename: SPEC_FILE,
        code: 'it("carries the id", () => {\n  const report = summarise(seed);\n});',
        errors: [{ messageId: "expectlessIt" }],
      },
      {
        name: "a suppressed block still owes the claim its name promises",
        filename: SPEC_FILE,
        code: 'it.skip("carries the id", () => {});\nit.todo("carries the total", () => {});\nit.fails("carries the name", () => {});',
        errors: [
          { messageId: "expectlessIt" },
          { messageId: "expectlessIt" },
          { messageId: "expectlessIt" },
        ],
      },
      {
        name: "a table driven block that claims nothing claims nothing on every row",
        filename: SPEC_FILE,
        code: 'it.each(rows)("carries %s", (row) => {});',
        errors: [{ messageId: "expectlessIt" }],
      },
      {
        name: "a claim parked in a helper leaves the block claiming nothing",
        filename: SPEC_FILE,
        code: 'const expectShape = (subject) => {\n  expect(subject.id).toBe("a");\n};\nit("carries the shape", ({ report }) => {\n  expectShape(report);\n});',
        errors: [{ messageId: "expectlessIt" }],
      },
      {
        name: "a claim parked in a fixture leaves the block claiming nothing",
        filename: SPEC_FILE,
        code: 'const check = test.extend({\n  report: (context, use) => {\n    expect(seed.id).toBe("a");\n    use(summarise(seed));\n  },\n});\ncheck("carries the shape", ({ report }) => {});',
        errors: [{ messageId: "expectlessIt" }],
      },
      {
        name: "a block reached through a renamed import owes the same claim",
        filename: SPEC_FILE,
        code: 'import { it as check } from "vitest";\ncheck("carries the id", () => {});',
        errors: [{ messageId: "expectlessIt" }],
      },
      {
        name: "a block whose only claim stands in a block nested inside it claims nothing itself",
        filename: SPEC_FILE,
        code: 'it("carries the id", () => {\n  it("carries the total", ({ report }) => {\n    expect(report.total).toBe(2);\n  });\n});',
        errors: [{ messageId: "expectlessIt" }],
      },
      {
        name: "every block that claims nothing is reported under its own name",
        filename: SPEC_FILE,
        code: 'it("carries the id", () => {});\nit("carries the total", ({ report }) => {\n  expect(report.total).toBe(2);\n});\nit("carries the name", () => {});',
        errors: [{ messageId: "expectlessIt" }, { messageId: "expectlessIt" }],
      },
      {
        name: "a suffix the configuration added brings its own files into this reading",
        filename: "report.spec.ts",
        options: [{ specFileSuffixes: [".spec.ts"] }],
        code: 'it("carries the id", () => {});',
        errors: [{ messageId: "expectlessIt" }],
      },
    ],
  });
});
