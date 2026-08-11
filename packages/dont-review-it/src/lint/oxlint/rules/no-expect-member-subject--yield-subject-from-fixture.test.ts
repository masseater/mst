import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { noExpectMemberSubject } from "./no-expect-member-subject--yield-subject-from-fixture.ts";

const SPEC_FILE = "report.test.ts";

const DERIVED_TEST =
  'import { test as baseTest } from "vitest";\nconst test = baseTest.extend({});\n';

describe("dont-review-it/no-expect-member-subject--yield-subject-from-fixture", () => {
  testLintRule(noExpectMemberSubject, {
    valid: [
      {
        name: "the value a fixture handed over is the subject this rule asks for",
        filename: SPEC_FILE,
        code: 'test("carries the id", ({ report }) => {\n  expect(report).toStrictEqual({ id: "a" });\n});',
      },
      {
        name: "renaming the fixture in the pattern still names the whole value",
        filename: SPEC_FILE,
        code: 'test("carries the id", ({ report: summary }) => {\n  expect(summary).toStrictEqual({ id: "a" });\n});',
      },
      {
        name: "reaching the fixture through the context parameter names the whole value",
        filename: SPEC_FILE,
        code: 'test("carries the id", (context) => {\n  expect(context.report).toStrictEqual({ id: "a" });\n});',
      },
      {
        name: "the rest of the context holds fixtures rather than faces of one",
        filename: SPEC_FILE,
        code: 'test("carries the id", ({ input, ...rest }) => {\n  expect(rest.report).toStrictEqual({ id: "a" });\n});',
      },
      {
        name: "a member of the expected value is not the subject",
        filename: SPEC_FILE,
        code: 'test("carries the id", ({ report, expected }) => {\n  expect(report).toStrictEqual(expected.body);\n});',
      },
      {
        name: "a member of a value written in the spec is not a face of a fixture",
        filename: SPEC_FILE,
        code: 'const DEFAULTS = { limit: 2 };\ntest("carries the limit", () => {\n  expect(DEFAULTS.limit).toBe(2);\n});',
      },
      {
        name: "a member of a value brought in from another file is not a face of a fixture",
        filename: SPEC_FILE,
        code: 'import { fallback } from "./fallback.ts";\ntest("carries the id", () => {\n  expect(fallback.report.id).toBe("a");\n});',
      },
      {
        name: "a member of a value a call returned is not a face of a fixture",
        filename: SPEC_FILE,
        code: 'test("carries the id", ({ input }) => {\n  const report = summarise(input);\n  expect(report.meta.source).toBe("orders");\n});',
      },
      {
        name: "a binding declared without a value never reaches a fixture",
        filename: SPEC_FILE,
        code: 'test("carries the id", () => {\n  let report;\n  expect(report.meta.source).toBe("orders");\n});',
      },
      {
        name: "a binding initialised from itself never reaches a fixture",
        filename: SPEC_FILE,
        code: 'const report = report;\ntest("carries the id", () => {\n  expect(report.meta.source).toBe("orders");\n});',
      },
      {
        name: "a name this file never declares reaches no fixture",
        filename: SPEC_FILE,
        code: 'test("carries the id", () => {\n  expect(report.id).toBe("a");\n});',
      },
      {
        name: "a value spelled out in the assertion is read by another rule",
        filename: SPEC_FILE,
        code: 'test("carries the id", () => {\n  expect("a").toBe("a");\n});',
      },
      {
        name: "an assertion handed nothing has no subject to read",
        filename: SPEC_FILE,
        code: 'test("carries the id", ({ report }) => {\n  expect().toStrictEqual(report);\n});',
      },
      {
        name: "an assertion handed a spread has no single subject to read",
        filename: SPEC_FILE,
        code: 'test("carries the ids", ({ handed }) => {\n  expect(...handed).toStrictEqual(["a"]);\n});',
      },
      {
        name: "a table block hands its callback a row rather than the test context",
        filename: SPEC_FILE,
        code: 'it.each(rows)("carries the id", (row) => {\n  expect(row.report.id).toBe("a");\n});',
      },
      {
        name: "a grouping block hands its callback no fixture",
        filename: SPEC_FILE,
        code: 'describe("the report", ({ report }) => {\n  test("carries the id", () => {\n    expect(report.id).toBe("a");\n  });\n});',
      },
      {
        name: "a file that is not a spec file is outside this reading",
        filename: "report.ts",
        code: 'test("carries the id", ({ report }) => {\n  expect(report.id).toBe("a");\n});',
      },
      {
        name: "a suffix the configuration replaced no longer marks a spec file",
        filename: SPEC_FILE,
        options: [{ specFileSuffixes: ["-test.ts"] }],
        code: 'test("carries the id", ({ report }) => {\n  expect(report.id).toBe("a");\n});',
      },
    ],
    invalid: [
      {
        name: "a member written in the assertion names one face of the fixture value",
        filename: SPEC_FILE,
        code: 'test("carries the id", ({ report }) => {\n  expect(report.id).toBe("a");\n});',
        errors: [{ messageId: "memberSubject", data: { subject: "report.id" } }],
      },
      {
        name: "a bracket carrying a spelled key names the same face",
        filename: SPEC_FILE,
        code: 'test("carries the id", ({ report }) => {\n  expect(report["id"]).toBe("a");\n});',
        errors: [{ messageId: "memberSubject", data: { subject: 'report["id"]' } }],
      },
      {
        name: "a bracket carrying a key settled at run time names a face all the same",
        filename: SPEC_FILE,
        code: 'test("carries the id", ({ report, key }) => {\n  expect(report[key]).toBe("a");\n});',
        errors: [{ messageId: "memberSubject", data: { subject: "report[key]" } }],
      },
      {
        name: "an element taken out of a collection is one face of it",
        filename: SPEC_FILE,
        code: 'test("carries the first row", ({ rows }) => {\n  expect(rows[0]).toStrictEqual({ id: "a" });\n});',
        errors: [{ messageId: "memberSubject", data: { subject: "rows[0]" } }],
      },
      {
        name: "a member reached through two hops is still a face of the fixture value",
        filename: SPEC_FILE,
        code: 'test("names the source", ({ report }) => {\n  expect(report.meta.source).toBe("orders");\n});',
        errors: [{ messageId: "memberSubject", data: { subject: "report.meta.source" } }],
      },
      {
        name: "a member reached through the context parameter is a face of the fixture value",
        filename: SPEC_FILE,
        code: 'test("carries the id", (context) => {\n  expect(context.report.id).toBe("a");\n});',
        errors: [{ messageId: "memberSubject", data: { subject: "context.report.id" } }],
      },
      {
        name: "a member reached off a binding that holds the fixture value names a face too",
        filename: SPEC_FILE,
        code: 'test("carries the id", ({ report }) => {\n  const held = report;\n  expect(held.id).toBe("a");\n});',
        errors: [{ messageId: "memberSubject", data: { subject: "held.id" } }],
      },
      {
        name: "a non-null assertion around the member is stripped before the subject is read",
        filename: SPEC_FILE,
        code: 'test("carries the id", ({ report }) => {\n  expect(report.id!).toBe("a");\n});',
        errors: [{ messageId: "memberSubject", data: { subject: "report.id" } }],
      },
      {
        name: "a settlement modifier leaves the member standing in the subject position",
        filename: SPEC_FILE,
        code: 'test("carries the id", async ({ report }) => {\n  await expect(report.id).resolves.toBe("a");\n});',
        errors: [{ messageId: "memberSubject", data: { subject: "report.id" } }],
      },
      {
        name: "the soft form of the receiver takes the same member",
        filename: SPEC_FILE,
        code: 'test("carries the id", ({ report }) => {\n  expect.soft(report.id).toBe("a");\n});',
        errors: [{ messageId: "memberSubject", data: { subject: "report.id" } }],
      },
      {
        name: "an assertion left without a matcher reads the same subject",
        filename: SPEC_FILE,
        code: 'test("carries the id", ({ report }) => {\n  expect(report.id);\n});',
        errors: [{ messageId: "memberSubject", data: { subject: "report.id" } }],
      },
      {
        name: "a callback written as a function expression hands over the same value",
        filename: SPEC_FILE,
        code: 'it("carries the id", function ({ report }) {\n  expect(report.id).toBe("a");\n});',
        errors: [{ messageId: "memberSubject", data: { subject: "report.id" } }],
      },
      {
        name: "a fixture derived from an imported base hands over the same value",
        filename: SPEC_FILE,
        code: `${DERIVED_TEST}test("carries the id", ({ report }) => {\n  expect(report.id).toBe("a");\n});`,
        errors: [{ messageId: "memberSubject", data: { subject: "report.id" } }],
      },
      {
        name: "a binding filled with the member carries the same face to the assertion",
        filename: SPEC_FILE,
        code: 'test("carries the id", ({ report }) => {\n  const id = report.id;\n  expect(id).toBe("a");\n});',
        errors: [{ messageId: "boundMemberSubject", data: { subject: "id" } }],
      },
      {
        name: "taking the member apart in the body reaches the same face",
        filename: SPEC_FILE,
        code: 'test("carries the id", ({ report }) => {\n  const { id } = report;\n  expect(id).toBe("a");\n});',
        errors: [{ messageId: "boundMemberSubject", data: { subject: "id" } }],
      },
      {
        name: "passing the member through a second binding reaches the same face",
        filename: SPEC_FILE,
        code: 'test("carries the id", ({ report }) => {\n  const held = report.id;\n  const id = held;\n  expect(id).toBe("a");\n});',
        errors: [{ messageId: "boundMemberSubject", data: { subject: "id" } }],
      },
      {
        name: "a pattern nested in the context takes a face out of the fixture value",
        filename: SPEC_FILE,
        code: 'test("carries the id", ({ report: { id } }) => {\n  expect(id).toBe("a");\n});',
        errors: [{ messageId: "destructuredMemberSubject", data: { subject: "id" } }],
      },
      {
        name: "renaming the face in the nested pattern leaves the face it names unchanged",
        filename: SPEC_FILE,
        code: 'test("carries the id", ({ report: { id: carried } }) => {\n  expect(carried).toBe("a");\n});',
        errors: [{ messageId: "destructuredMemberSubject", data: { subject: "carried" } }],
      },
      {
        name: "the rest of a fixture value is the faces of that value left over",
        filename: SPEC_FILE,
        code: 'test("carries the rest", ({ report: { id, ...rest } }) => {\n  expect(rest.total).toBe(2);\n});',
        errors: [{ messageId: "memberSubject", data: { subject: "rest.total" } }],
      },
    ],
  });
});
