import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { forbidMultiExpectIt } from "./forbid-multi-expect-it--split-into-separate-it.ts";

const SPEC_FILE = "report.test.ts";

describe("dont-review-it/forbid-multi-expect-it--split-into-separate-it", () => {
  testLintRule(forbidMultiExpectIt, {
    valid: [
      {
        name: "one exact comparison pins the one behaviour the block names",
        documented: true,
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", () => summarise());\nit("carries what it summarised", ({ report }) => {\n  expect(report).toStrictEqual({ id: "a", counted: 2 });\n});',
      },
      {
        name: "a declaration of how many assertions will run claims nothing",
        filename: SPEC_FILE,
        code: 'it("carries what it summarised", ({ report }) => {\n  expect.assertions(1);\n  expect(report).toStrictEqual({ id: "a" });\n});',
      },
      {
        name: "a budget the configuration raised admits the second assertion",
        filename: SPEC_FILE,
        options: [{ maxAssertions: 2 }],
        code: 'it("carries both fields", ({ report }) => {\n  expect(report.id).toBe("a");\n  expect(report.total).toBe(2);\n});',
      },
      {
        name: "assertions in a helper no block reaches are attributed to no block",
        filename: SPEC_FILE,
        code: 'const expectShape = (subject) => {\n  expect(subject.id).toBe("a");\n  expect(subject.total).toBe(2);\n};\nit("carries the id", ({ report }) => {\n  expect(report.id).toBe("a");\n});',
      },
      {
        name: "each behaviour in a block of its own keeps every block inside the budget",
        documented: true,
        filename: SPEC_FILE,
        code: 'it("carries the id", ({ report }) => {\n  expect(report.id).toBe("a");\n});\nit("carries the total", ({ report }) => {\n  expect(report.total).toBe(2);\n});',
      },
      {
        name: "an assertion inside a callback in the body is the one assertion of the block",
        filename: SPEC_FILE,
        code: 'it("carries every row", ({ rows }) => {\n  rows.forEach((row) => {\n    expect(row).toBe("a");\n  });\n});',
      },
      {
        name: "a group of blocks carries no assertions of its own",
        filename: SPEC_FILE,
        code: 'describe("the report", () => {\n  it("carries the id", ({ report }) => {\n    expect(report.id).toBe("a");\n  });\n});',
      },
      {
        name: "a call reaching nothing declared in the file carries no assertions in",
        filename: SPEC_FILE,
        code: 'it("carries the id", ({ report }) => {\n  expect(report.id).toBe(summarise("a"));\n});',
      },
      {
        name: "a fixture declared without a factory carries nothing into the block",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", { id: "a" });\nit("carries the id", ({ report }) => {\n  expect(report.id).toBe("a");\n});',
      },
      {
        name: "a receiver that is not the assertion entry carries no assertion",
        filename: SPEC_FILE,
        code: 'it("carries the id", ({ report }) => {\n  assertion(report.id).toBe("a");\n  builder.from(report).toBe("a");\n  other.soft(report).toBe("a");\n  pick(matchers)(report).toBe("a");\n  expect(report.id).toBe("a");\n});',
      },
      {
        name: "a block whose arguments are spread hands this reading no body to read",
        filename: SPEC_FILE,
        code: 'it(...spelledOut);\nit("carries the id", ...checks);\nit("carries the total", ({ report }) => {\n  expect(report.total).toBe(2);\n});',
      },
      {
        name: "an options object naming no budget leaves the budget where it was",
        filename: SPEC_FILE,
        options: [{ specFileSuffixes: [".test.ts"] }],
        code: 'it("carries the id", ({ report }) => {\n  expect(report.id).toBe("a");\n});',
      },
      {
        name: "an assertion standing outside every block is attributed to no block",
        filename: SPEC_FILE,
        code: 'expect(seed.id).toBe("a");\nit("carries the total", ({ report }) => {\n  expect(report.total).toBe(2);\n});',
      },
      {
        name: "a name bound to something this reading cannot follow reaches no assertions",
        filename: SPEC_FILE,
        code: 'import { summarise } from "./summarise.ts";\nlet missing;\nconst shaped = matchers.shape;\nit("carries the id", ({ report }) => {\n  summarise(report);\n  missing(report);\n  shaped(report);\n  unknown(report);\n  expect(report.id).toBe("a");\n});',
      },
      {
        name: "a helper called outside every block is attributed to no block",
        filename: SPEC_FILE,
        code: 'const expectShape = (subject) => {\n  expect(subject.id).toBe("a");\n  expect(subject.total).toBe(2);\n};\nexpectShape(seed);\nit("carries the name", ({ report }) => {\n  expect(report.name).toBe("b");\n});',
      },
      {
        name: "a matcher and a modifier chosen at run time hide the chain from this reading",
        filename: SPEC_FILE,
        code: 'it("carries the id", ({ report }) => {\n  expect[chosen](report).toBe("a");\n  expect(report)[chosen].toBe("a");\n  expect(report).id.toBe("a");\n  expect(report.id).toBe("a");\n});',
      },
      {
        name: "a declaration bound to something other than a function is not a callee",
        filename: SPEC_FILE,
        code: 'export const shape = { id: "a" };\nexport { shape as reportShape };\nconst [first] = rows;\nit("carries the id", ({ report }) => {\n  expect(report.id).toBe(shape.id);\n});',
      },
      {
        name: "a file that is not a spec file is outside this reading",
        filename: "report.ts",
        code: 'it("carries both fields", ({ report }) => {\n  expect(report.id).toBe("a");\n  expect(report.total).toBe(2);\n});',
      },
      {
        name: "a suffix the configuration replaced no longer marks a spec file",
        filename: SPEC_FILE,
        options: [{ specFileSuffixes: ["-test.ts"] }],
        code: 'it("carries both fields", ({ report }) => {\n  expect(report.id).toBe("a");\n  expect(report.total).toBe(2);\n});',
      },
    ],
    invalid: [
      {
        name: "two claims written under one name",
        documented: true,
        filename: SPEC_FILE,
        code: 'it("carries both fields", ({ report }) => {\n  expect(report.id).toBe("a");\n  expect(report.total).toBe(2);\n});',
        errors: [
          {
            messageId: "multiExpectIt",
            data: { attributed: 2, direct: 2, elsewhere: "", limit: 1 },
          },
        ],
      },
      {
        name: "a block declared without a name carries the same budget",
        filename: SPEC_FILE,
        code: 'it(() => {\n  expect(report.id).toBe("a");\n  expect(report.total).toBe(2);\n});',
        errors: [{ messageId: "multiExpectIt" }],
      },
      {
        name: "three claims report the two that overflow the budget",
        filename: SPEC_FILE,
        code: 'it("carries every field", ({ report }) => {\n  expect(report.id).toBe("a");\n  expect(report.total).toBe(2);\n  expect(report.name).toBe("b");\n});',
        errors: [{ messageId: "multiExpectIt" }, { messageId: "multiExpectIt" }],
      },
      {
        name: "a block whose run is suppressed carries the same budget",
        filename: SPEC_FILE,
        code: 'it.skip("carries both fields", ({ report }) => {\n  expect(report.id).toBe("a");\n  expect(report.total).toBe(2);\n});',
        errors: [{ messageId: "multiExpectIt" }],
      },
      {
        name: "a table-driven block carries the same budget",
        filename: SPEC_FILE,
        code: 'it.each(rows)("carries both fields", (row) => {\n  expect(row.id).toBe("a");\n  expect(row.total).toBe(2);\n});',
        errors: [{ messageId: "multiExpectIt" }],
      },
      {
        name: "the other name the runner accepts for a block reaches the same budget",
        filename: SPEC_FILE,
        code: 'test("carries both fields", function () {\n  expect(report.id).toBe("a");\n  expect(report.total).toBe(2);\n});',
        errors: [{ messageId: "multiExpectIt" }],
      },
      {
        name: "a name written as a template leaves the block inside this reading",
        filename: SPEC_FILE,
        code: 'it(`carries both fields`, ({ report }) => {\n  expect(report.id).toBe("a");\n  expect(report.total).toBe(2);\n});',
        errors: [{ messageId: "multiExpectIt" }],
      },
      {
        name: "modifiers in front of the matcher do not hide the assertions",
        filename: SPEC_FILE,
        code: 'it("carries both fields", ({ report }) => {\n  expect(report.id).not.toBe("a");\n  expect(report.total).resolves.toBe(2);\n  expect.soft(report.name).toBe("b");\n});',
        errors: [{ messageId: "multiExpectIt" }, { messageId: "multiExpectIt" }],
      },
      {
        name: "assertions pushed into a helper are still reached by the block",
        documented: true,
        filename: SPEC_FILE,
        code: 'const expectShape = (subject) => {\n  expect(subject.id).toBe("a");\n  expect(subject.total).toBe(2);\n};\nit("carries the shape", ({ report }) => {\n  expectShape(report);\n});',
        errors: [
          {
            messageId: "multiExpectItThroughCallees",
            data: {
              attributed: 2,
              direct: 0,
              elsewhere: "2 through the helper `expectShape`",
              limit: 1,
            },
          },
        ],
      },
      {
        name: "a helper reached through another helper is still reached by the block",
        filename: SPEC_FILE,
        code: 'function expectTotal(subject) {\n  expect(subject.total).toBe(2);\n}\nfunction expectShape(subject) {\n  expect(subject.id).toBe("a");\n  expectTotal(subject);\n}\nit("carries the shape", ({ report }) => {\n  expectShape(report);\n});',
        errors: [{ messageId: "multiExpectItThroughCallees" }],
      },
      {
        name: "assertions pushed into a fixture are still reached by the block",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", () => {\n  const built = summarise();\n  expect(built.id).toBe("a");\n  return built;\n});\nit("carries the total", ({ report }) => {\n  expect(report.total).toBe(2);\n});',
        errors: [
          {
            messageId: "multiExpectItThroughCallees",
            data: {
              attributed: 2,
              direct: 1,
              elsewhere: "1 through the fixture `report`",
              limit: 1,
            },
          },
        ],
      },
      {
        name: "a fixture reached through another fixture is still reached by the block",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend({\n  source: () => {\n    expect(seed.id).toBe("a");\n    return seed;\n  },\n  report: ({ source }) => {\n    expect(source.total).toBe(2);\n    return summarise(source);\n  },\n});\nit("carries the report", ({ report }) => {\n  expect(report.name).toBe("b");\n});',
        errors: [
          {
            messageId: "multiExpectItThroughCallees",
            data: {
              attributed: 3,
              direct: 1,
              elsewhere: "2 through the fixture `report`",
              limit: 1,
            },
          },
          { messageId: "multiExpectItThroughCallees" },
        ],
      },
      {
        name: "a helper two blocks reach is counted for each of them and never at the helper",
        filename: SPEC_FILE,
        code: 'const expectShape = (subject) => {\n  expect(subject.id).toBe("a");\n  expect(subject.total).toBe(2);\n};\nit("carries the shape", ({ report }) => {\n  expectShape(report);\n});\nit("carries the same shape", ({ summary }) => {\n  expectShape(summary);\n});',
        errors: [
          { messageId: "multiExpectItThroughCallees" },
          { messageId: "multiExpectItThroughCallees" },
        ],
      },
      {
        name: "a helper calling itself is counted once and stops there",
        filename: SPEC_FILE,
        code: 'const expectShape = (subject) => {\n  expect(subject.id).toBe("a");\n  expect(subject.total).toBe(2);\n  expectShape(subject.next);\n};\nit("carries the shape", ({ report }) => {\n  expectShape(report);\n});',
        errors: [{ messageId: "multiExpectItThroughCallees" }],
      },
      {
        name: "a helper reached twice from one block is counted once",
        filename: SPEC_FILE,
        code: 'const expectShape = (subject) => {\n  expect(subject.id).toBe("a");\n  expect(subject.total).toBe(2);\n};\nit("carries the shape", ({ report }) => {\n  expectShape(report);\n  expectShape(report.next);\n});',
        errors: [
          {
            messageId: "multiExpectItThroughCallees",
            data: {
              attributed: 2,
              direct: 0,
              elsewhere: "2 through the helper `expectShape`",
              limit: 1,
            },
          },
        ],
      },
      {
        name: "a helper a fixture calls is still reached by the block that takes the fixture",
        filename: SPEC_FILE,
        code: 'const expectShape = (subject) => {\n  expect(subject.id).toBe("a");\n};\nconst test = baseTest.extend("report", () => {\n  const built = summarise();\n  expectShape(built);\n  return built;\n});\nit("carries the total", ({ report }) => {\n  expect(report.total).toBe(2);\n});',
        errors: [
          {
            messageId: "multiExpectItThroughCallees",
            data: {
              attributed: 2,
              direct: 1,
              elsewhere: "1 through the fixture `report`",
              limit: 1,
            },
          },
        ],
      },
      {
        name: "a fixture taking something no fixture declares still carries its assertions in",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend({\n  report: ({ clock }) => {\n    expect(clock.now).toBe(0);\n    return summarise(clock);\n  },\n});\nit("carries the id", ({ report }) => {\n  expect(report.id).toBe("a");\n});',
        errors: [{ messageId: "multiExpectItThroughCallees" }],
      },
      {
        name: "a budget the configuration raised still stops the third assertion",
        filename: SPEC_FILE,
        options: [{ maxAssertions: 2 }],
        code: 'it("carries every field", ({ report }) => {\n  expect(report.id).toBe("a");\n  expect(report.total).toBe(2);\n  expect(report.name).toBe("b");\n});',
        errors: [{ messageId: "multiExpectIt" }],
      },
    ],
  });
});
