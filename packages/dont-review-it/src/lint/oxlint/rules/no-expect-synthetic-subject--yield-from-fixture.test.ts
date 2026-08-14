import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { noExpectSyntheticSubject } from "./no-expect-synthetic-subject--yield-from-fixture.ts";

const SPEC_FILE = "report.test.ts";

const OBJECT_LITERAL = "an object literal";

const ARRAY_LITERAL = "an array literal";

const WRITTEN_OUT = "a value written out in the spec";

const CONSTRUCTED = "a value a constructor built here";

describe("dont-review-it/no-expect-synthetic-subject--yield-from-fixture", () => {
  testLintRule(noExpectSyntheticSubject, {
    valid: [
      {
        name: "a binding the fixture handed over is the subject this rule asks for",
        documented: true,
        filename: SPEC_FILE,
        code: 'test("carries the id", ({ report }) => {\n  expect(report).toStrictEqual({ id: "a" });\n});',
      },
      {
        name: "a binding holding what a call returned is not a value the spec wrote",
        documented: true,
        filename: SPEC_FILE,
        code: 'const report = summarise(input);\ntest("carries the id", () => {\n  expect(report).toStrictEqual({ id: "a" });\n});',
      },
      {
        name: "a call in the subject position belongs to another reading",
        filename: SPEC_FILE,
        code: 'test("carries the id", ({ input }) => {\n  expect(summarise(input)).toStrictEqual({ id: "a" });\n});',
      },
      {
        name: "a member read off the subject belongs to another reading",
        filename: SPEC_FILE,
        code: 'test("carries the id", ({ report }) => {\n  expect(report.id).toBe("a");\n});',
      },
      {
        name: "a function written in the assertion belongs to another reading",
        filename: SPEC_FILE,
        code: 'test("refuses an empty name", () => {\n  expect(() => parse("")).toThrowErrorMessage("name must not be empty");\n});',
      },
      {
        name: "a literal on the expected side is not the subject",
        filename: SPEC_FILE,
        code: 'test("carries the id", ({ reports }) => {\n  expect(reports).toStrictEqual([{ id: "a" }]);\n});',
      },
      {
        name: "declaring how many assertions are coming hands over no subject",
        filename: SPEC_FILE,
        code: 'test("carries the id", ({ report }) => {\n  expect.assertions(2);\n  expect(report).toStrictEqual({ id: "a" });\n});',
      },
      {
        name: "registering a matcher hands over a table rather than a subject",
        filename: SPEC_FILE,
        code: 'expect.extend({ toCarryTheId });\ntest("carries the id", ({ report }) => {\n  expect(report).toCarryTheId("a");\n});',
      },
      {
        name: "an assertion handed nothing has no subject to read",
        filename: SPEC_FILE,
        code: 'test("carries the id", () => {\n  expect().toStrictEqual({ id: "a" });\n});',
      },
      {
        name: "an assertion handed a spread has no single subject to read",
        filename: SPEC_FILE,
        code: 'test("carries the id", ({ handed }) => {\n  expect(...handed).toStrictEqual({ id: "a" });\n});',
      },
      {
        name: "a receiver of another name is not the assertion entry",
        filename: SPEC_FILE,
        code: 'test("carries the id", () => {\n  assert({ id: "a" }).toStrictEqual({ id: "a" });\n});',
      },
      {
        name: "a template carrying a substitution is not a value written out whole",
        filename: SPEC_FILE,
        code: 'test("spells the id out", ({ report }) => {\n  expect(`id ${report.id}`).toBe("id a");\n});',
      },
      {
        name: "a negation reads a value this rule cannot see written out",
        filename: SPEC_FILE,
        code: 'test("is not empty", ({ empty }) => {\n  expect(!empty).toBe(false);\n});',
      },
      {
        name: "a negated binding carries a value the spec never wrote",
        filename: SPEC_FILE,
        code: 'test("counts backwards", ({ count }) => {\n  expect(-count).toBe(-2);\n});',
      },
      {
        name: "an identifier this file never declares shows no initialiser to read",
        filename: SPEC_FILE,
        code: 'test("carries the id", () => {\n  expect(report).toStrictEqual({ id: "a" });\n});',
      },
      {
        name: "a binding declared without an initialiser holds nothing written here",
        filename: SPEC_FILE,
        code: 'let report;\ntest("carries the id", () => {\n  expect(report).toStrictEqual({ id: "a" });\n});',
      },
      {
        name: "a function declaration is not a binding filled with a written-out value",
        filename: SPEC_FILE,
        code: 'function attempt() {\n  parse("");\n}\ntest("refuses an empty name", () => {\n  expect(attempt).toThrowErrorMessage("name must not be empty");\n});',
      },
      {
        name: "a binding brought in by an import was filled in another file",
        filename: SPEC_FILE,
        code: 'import { fallbackReport } from "./fallback.ts";\ntest("carries the id", () => {\n  expect(fallbackReport).toStrictEqual({ id: "a" });\n});',
      },
      {
        name: "a binding initialised from itself never reaches a written-out value",
        filename: SPEC_FILE,
        code: 'const report = report;\ntest("carries the id", () => {\n  expect(report).toStrictEqual({ id: "a" });\n});',
      },
      {
        name: "a file that is not a spec file is outside this reading",
        filename: "report.ts",
        code: 'test("carries the id", () => {\n  expect({ id: "a" }).toStrictEqual({ id: "a" });\n});',
      },
      {
        name: "a suffix the configuration replaced no longer marks a spec file",
        filename: SPEC_FILE,
        options: [{ specFileSuffixes: ["-test.ts"] }],
        code: 'test("carries the id", () => {\n  expect({ id: "a" }).toStrictEqual({ id: "a" });\n});',
      },
    ],
    invalid: [
      {
        name: "an object literal in the subject position is a bag the spec packed",
        documented: true,
        filename: SPEC_FILE,
        code: 'test("carries the id", ({ status, body }) => {\n  expect({ status, body }).toStrictEqual({ status: 200, body: "a" });\n});',
        errors: [{ messageId: "syntheticSubject", data: { shape: OBJECT_LITERAL } }],
      },
      {
        name: "a shorthand property packs the same bag",
        filename: SPEC_FILE,
        code: 'test("carries the id", ({ value }) => {\n  expect({ value }).toStrictEqual({ value: "a" });\n});',
        errors: [{ messageId: "syntheticSubject", data: { shape: OBJECT_LITERAL } }],
      },
      {
        name: "an array literal packs the same bag under another bracket",
        filename: SPEC_FILE,
        code: 'test("carries both ids", ({ first, second }) => {\n  expect([first, second]).toStrictEqual(["a", "b"]);\n});',
        errors: [{ messageId: "syntheticSubject", data: { shape: ARRAY_LITERAL } }],
      },
      {
        name: "a string written in the assertion is the whole subject",
        filename: SPEC_FILE,
        code: 'test("carries the id", () => {\n  expect("a").toBe("a");\n});',
        errors: [{ messageId: "syntheticSubject", data: { shape: WRITTEN_OUT } }],
      },
      {
        name: "an absent value written in the assertion is still written there",
        filename: SPEC_FILE,
        code: 'test("carries no id", () => {\n  expect(undefined).toBe(undefined);\n});',
        errors: [{ messageId: "syntheticSubject", data: { shape: WRITTEN_OUT } }],
      },
      {
        name: "the void form of the same absent value is read the same way",
        filename: SPEC_FILE,
        code: 'test("carries no id", () => {\n  expect(void 0).toBe(undefined);\n});',
        errors: [{ messageId: "syntheticSubject", data: { shape: WRITTEN_OUT } }],
      },
      {
        name: "a negated number is a number written in the assertion",
        filename: SPEC_FILE,
        code: 'test("counts backwards", () => {\n  expect(-1).toBe(-1);\n});',
        errors: [{ messageId: "syntheticSubject", data: { shape: WRITTEN_OUT } }],
      },
      {
        name: "a template without substitutions is a string written in the assertion",
        filename: SPEC_FILE,
        code: 'test("carries the id", () => {\n  expect(`a`).toBe("a");\n});',
        errors: [{ messageId: "syntheticSubject", data: { shape: WRITTEN_OUT } }],
      },
      {
        name: "a constructor run in the assertion builds the subject there",
        filename: SPEC_FILE,
        code: 'test("carries the id", ({ input }) => {\n  expect(new Report(input)).toStrictEqual({ id: "a" });\n});',
        errors: [{ messageId: "syntheticSubject", data: { shape: CONSTRUCTED } }],
      },
      {
        name: "a type assertion around the bag is stripped before the subject is read",
        filename: SPEC_FILE,
        code: 'test("carries the id", ({ status }) => {\n  expect({ status } as Report).toStrictEqual({ status: 200 });\n});',
        errors: [{ messageId: "syntheticSubject", data: { shape: OBJECT_LITERAL } }],
      },
      {
        name: "a negation modifier leaves the bag standing in the subject position",
        filename: SPEC_FILE,
        code: 'test("carries another id", ({ status }) => {\n  expect({ status }).not.toStrictEqual({ status: 500 });\n});',
        errors: [{ messageId: "syntheticSubject", data: { shape: OBJECT_LITERAL } }],
      },
      {
        name: "a settlement modifier leaves the bag standing in the subject position",
        filename: SPEC_FILE,
        code: 'test("carries the id", async ({ status }) => {\n  await expect({ status }).resolves.toStrictEqual({ status: 200 });\n});',
        errors: [{ messageId: "syntheticSubject", data: { shape: OBJECT_LITERAL } }],
      },
      {
        name: "the soft form of the receiver takes the same bag",
        filename: SPEC_FILE,
        code: 'test("carries the id", ({ status }) => {\n  expect.soft({ status }).toStrictEqual({ status: 200 });\n});',
        errors: [{ messageId: "syntheticSubject", data: { shape: OBJECT_LITERAL } }],
      },
      {
        name: "a binding filled in the test block carries the bag to the assertion",
        documented: true,
        filename: SPEC_FILE,
        code: 'test("carries the id", ({ status, body }) => {\n  const bag = { status, body };\n  expect(bag).toStrictEqual({ status: 200, body: "a" });\n});',
        errors: [
          { messageId: "boundSyntheticSubject", data: { name: "bag", shape: OBJECT_LITERAL } },
        ],
      },
      {
        name: "a binding filled in the surrounding block carries the same bag",
        filename: SPEC_FILE,
        code: 'describe("report", () => {\n  const bag = { id: "a" };\n  test("carries the id", () => {\n    expect(bag).toStrictEqual({ id: "a" });\n  });\n});',
        errors: [
          { messageId: "boundSyntheticSubject", data: { name: "bag", shape: OBJECT_LITERAL } },
        ],
      },
      {
        name: "a binding filled at the top of the file carries the same bag",
        filename: SPEC_FILE,
        code: 'const bag = { id: "a" };\ntest("carries the id", () => {\n  expect(bag).toStrictEqual({ id: "a" });\n});',
        errors: [
          { messageId: "boundSyntheticSubject", data: { name: "bag", shape: OBJECT_LITERAL } },
        ],
      },
      {
        name: "passing the bag through a second binding reaches the same written-out value",
        filename: SPEC_FILE,
        code: 'const built = { id: "a" };\nconst bag = built;\ntest("carries the id", () => {\n  expect(bag).toStrictEqual({ id: "a" });\n});',
        errors: [
          { messageId: "boundSyntheticSubject", data: { name: "bag", shape: OBJECT_LITERAL } },
        ],
      },
      {
        name: "a non-null assertion around the binding is stripped before the subject is read",
        filename: SPEC_FILE,
        code: 'const bag = { id: "a" };\ntest("carries the id", () => {\n  expect(bag!).toStrictEqual({ id: "a" });\n});',
        errors: [
          { messageId: "boundSyntheticSubject", data: { name: "bag", shape: OBJECT_LITERAL } },
        ],
      },
      {
        name: "a binding filled with a list carries a list the spec wrote",
        filename: SPEC_FILE,
        code: 'const ids = ["a", "b"];\ntest("carries both ids", () => {\n  expect(ids).toStrictEqual(["a", "b"]);\n});',
        errors: [
          { messageId: "boundSyntheticSubject", data: { name: "ids", shape: ARRAY_LITERAL } },
        ],
      },
      {
        name: "a binding filled with a written-out value carries that value",
        filename: SPEC_FILE,
        code: 'const id = "a";\ntest("carries the id", () => {\n  expect(id).toBe("a");\n});',
        errors: [{ messageId: "boundSyntheticSubject", data: { name: "id", shape: WRITTEN_OUT } }],
      },
      {
        name: "a binding filled by a constructor carries what the constructor built here",
        filename: SPEC_FILE,
        code: 'const report = new Report({ id: "a" });\ntest("carries the id", () => {\n  expect(report).toStrictEqual({ id: "a" });\n});',
        errors: [
          { messageId: "boundSyntheticSubject", data: { name: "report", shape: CONSTRUCTED } },
        ],
      },
    ],
  });
});
