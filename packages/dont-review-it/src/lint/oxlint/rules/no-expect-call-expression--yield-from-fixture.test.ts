import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { noExpectCallExpression } from "./no-expect-call-expression--yield-from-fixture.ts";

const SPEC_FILE = "report.test.ts";

describe("dont-review-it/no-expect-call-expression--yield-from-fixture", () => {
  testLintRule(noExpectCallExpression, {
    valid: [
      {
        name: "a bare identifier is a subject that was produced before the assertion",
        filename: SPEC_FILE,
        code: 'test("carries the id", ({ report }) => {\n  expect(report).toStrictEqual({ id: "a" });\n});',
      },
      {
        name: "an awaited binding is still the binding",
        filename: SPEC_FILE,
        code: 'test("carries the id", async ({ report }) => {\n  expect(await report).toStrictEqual({ id: "a" });\n});',
      },
      {
        name: "a thunk the fixture handed back takes no arguments and runs under the matcher",
        filename: SPEC_FILE,
        code: 'test("refuses an empty name", ({ attempt }) => {\n  expect(attempt).toThrowErrorMessage("name must not be empty");\n});',
      },
      {
        name: "a thunk written in the file declares no parameters",
        filename: SPEC_FILE,
        code: 'const attempt = () => parse("");\ntest("refuses an empty name", () => {\n  expect(attempt).toThrowErrorMessage("name must not be empty");\n});',
      },
      {
        name: "a thunk annotated as taking no arguments declares none",
        filename: SPEC_FILE,
        code: 'const attempt: () => void = whateverParseNeeds();\ntest("refuses an empty name", () => {\n  expect(attempt).toThrowErrorMessage("name must not be empty");\n});',
      },
      {
        name: "a double the fixture handed over is read for how it was called, not run",
        filename: SPEC_FILE,
        code: 'test("forwards the order", ({ send }) => {\n  expect(send).toHaveBeenCalledWith({ id: "a" });\n});',
      },
      {
        name: "a double written in the file is read for how it was called, not run",
        filename: SPEC_FILE,
        code: 'const send = (order) => record(order);\ntest("forwards the order", () => {\n  expect(send).toHaveBeenCalledWith({ id: "a" });\n});',
      },
      {
        name: "a double read for how it was called stays readable behind a negation",
        filename: SPEC_FILE,
        code: 'const send = (order) => record(order);\ntest("sends nothing", () => {\n  expect(send).not.toHaveBeenCalled();\n});',
      },
      {
        name: "a binding whose initialiser is not a function shows no parameters",
        filename: SPEC_FILE,
        code: 'const report = summarised;\ntest("carries the id", () => {\n  expect(report).toStrictEqual({ id: "a" });\n});',
      },
      {
        name: "a binding declared without an initialiser shows no parameters",
        filename: SPEC_FILE,
        code: 'let report;\ntest("carries the id", () => {\n  expect(report).toStrictEqual({ id: "a" });\n});',
      },
      {
        name: "a binding annotated as something other than a function shows no parameters",
        filename: SPEC_FILE,
        code: 'const report: Report = summarised;\ntest("carries the id", () => {\n  expect(report).toStrictEqual({ id: "a" });\n});',
      },
      {
        name: "a function declared in the file taking no arguments is a thunk",
        filename: SPEC_FILE,
        code: 'function attempt() {\n  parse("");\n}\ntest("refuses an empty name", () => {\n  expect(attempt).toThrowErrorMessage("name must not be empty");\n});',
      },
      {
        name: "an identifier bound as a parameter shows nothing this reading can see",
        filename: SPEC_FILE,
        code: 'function assertRefused(attempt) {\n  expect(attempt).toThrowErrorMessage("name must not be empty");\n}',
      },
      {
        name: "an identifier this file never declares shows nothing this reading can see",
        filename: SPEC_FILE,
        code: 'test("refuses an empty name", () => {\n  expect(parse).toThrowErrorMessage("name must not be empty");\n});',
      },
      {
        name: "a member expression is a projected subject and belongs to another reading",
        filename: SPEC_FILE,
        code: 'test("carries the id", ({ report }) => {\n  expect(report.id).toBe("a");\n});',
      },
      {
        name: "an inline function literal is not a call and belongs to another reading",
        filename: SPEC_FILE,
        code: 'test("refuses an empty name", () => {\n  expect(() => parse("")).toThrowErrorMessage("name must not be empty");\n});',
      },
      {
        name: "a template literal without a tag runs nothing",
        filename: SPEC_FILE,
        code: 'test("spells the id out", ({ report }) => {\n  expect(`id ${report.id}`).toBe("id a");\n});',
      },
      {
        name: "declaring how many assertions are coming is not a matcher call",
        filename: SPEC_FILE,
        code: 'test("carries the id", ({ report }) => {\n  expect.assertions(count());\n  expect(report).toStrictEqual({ id: "a" });\n});',
      },
      {
        name: "a call outside an assertion is not read by this rule",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", () => summarise({ id: "a" }));',
      },
      {
        name: "a call reaching a computed matcher name is not a matcher this reading can name",
        filename: SPEC_FILE,
        code: 'test("carries the id", ({ report }) => {\n  expect(summarise(report))[matcherName]({ id: "a" });\n});',
      },
      {
        name: "a receiver that is not the assertion entry produces no assertion to read",
        filename: SPEC_FILE,
        code: 'test("carries the id", ({ report }) => {\n  assert(summarise(report)).toStrictEqual({ id: "a" });\n});',
      },
      {
        name: "an unrelated namespace member call is not an assertion entry",
        filename: SPEC_FILE,
        code: 'test("carries the id", ({ report }) => {\n  expect.extend(summarise(report)).toStrictEqual({ id: "a" });\n});',
      },
      {
        name: "a namespace member call on a receiver of another name is not an assertion entry",
        filename: SPEC_FILE,
        code: 'test("carries the id", ({ report }) => {\n  assert.soft(summarise(report)).toStrictEqual({ id: "a" });\n});',
      },
      {
        name: "a call produced by another call is not an assertion entry",
        filename: SPEC_FILE,
        code: 'test("carries the id", ({ report }) => {\n  buildAssert()(summarise(report)).toStrictEqual({ id: "a" });\n});',
      },
      {
        name: "a member chain that is not an assertion modifier leads to no assertion entry",
        filename: SPEC_FILE,
        code: 'test("carries the id", ({ report }) => {\n  summarise(report).result.toStrictEqual({ id: "a" });\n});',
      },
      {
        name: "a matcher call on something that is not a member expression is not an assertion",
        filename: SPEC_FILE,
        code: 'test("carries the id", ({ report }) => {\n  summarise(report);\n});',
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
        name: "a file that is not a spec file is outside this reading",
        filename: "report.ts",
        code: 'test("carries the id", ({ report }) => {\n  expect(summarise(report)).toStrictEqual({ id: "a" });\n});',
      },
      {
        name: "a suffix the configuration replaced no longer marks a spec file",
        filename: SPEC_FILE,
        options: [{ specFileSuffixes: ["-test.ts"] }],
        code: 'test("carries the id", ({ report }) => {\n  expect(summarise(report)).toStrictEqual({ id: "a" });\n});',
      },
    ],
    invalid: [
      {
        name: "a function called inside the assertion produces the subject there",
        filename: SPEC_FILE,
        code: 'test("carries the id", ({ input }) => {\n  expect(summarise(input)).toStrictEqual({ id: "a" });\n});',
        errors: [{ messageId: "producedSubject", data: { production: "calling a function" } }],
      },
      {
        name: "a constructor run inside the assertion produces the subject there",
        filename: SPEC_FILE,
        code: 'test("carries the id", ({ input }) => {\n  expect(new Report(input)).toStrictEqual({ id: "a" });\n});',
        errors: [{ messageId: "producedSubject", data: { production: "running a constructor" } }],
      },
      {
        name: "a template tag run inside the assertion produces the subject there",
        filename: SPEC_FILE,
        code: 'test("carries the id", ({ input }) => {\n  expect(summarise`${input}`).toStrictEqual({ id: "a" });\n});',
        errors: [{ messageId: "producedSubject", data: { production: "running a template tag" } }],
      },
      {
        name: "awaiting the call leaves the call inside the assertion",
        filename: SPEC_FILE,
        code: 'test("carries the id", async ({ input }) => {\n  expect(await summarise(input)).toStrictEqual({ id: "a" });\n});',
        errors: [{ messageId: "producedSubject" }],
      },
      {
        name: "a type assertion around the call is stripped before the subject is read",
        filename: SPEC_FILE,
        code: 'test("carries the id", ({ input }) => {\n  expect(summarise(input) as Report).toStrictEqual({ id: "a" });\n});',
        errors: [{ messageId: "producedSubject" }],
      },
      {
        name: "a non-null assertion around the call is stripped before the subject is read",
        filename: SPEC_FILE,
        code: 'test("carries the id", ({ input }) => {\n  expect(summarise(input)!).toStrictEqual({ id: "a" });\n});',
        errors: [{ messageId: "producedSubject" }],
      },
      {
        name: "an optional call is still a call",
        filename: SPEC_FILE,
        code: 'test("carries the id", ({ input }) => {\n  expect(summarise?.(input)).toStrictEqual({ id: "a" });\n});',
        errors: [{ messageId: "producedSubject" }],
      },
      {
        name: "a call behind a negation modifier is still inside the assertion",
        filename: SPEC_FILE,
        code: 'test("carries the id", ({ input }) => {\n  expect(summarise(input)).not.toStrictEqual({ id: "b" });\n});',
        errors: [{ messageId: "producedSubject" }],
      },
      {
        name: "a call behind a settlement modifier is still inside the assertion",
        filename: SPEC_FILE,
        code: 'test("carries the id", async ({ input }) => {\n  await expect(summarise(input)).resolves.toStrictEqual({ id: "a" });\n});',
        errors: [{ messageId: "producedSubject" }],
      },
      {
        name: "a call handed to the soft form of the receiver is still inside the assertion",
        filename: SPEC_FILE,
        code: 'test("carries the id", ({ input }) => {\n  expect.soft(summarise(input)).toStrictEqual({ id: "a" });\n});',
        errors: [{ messageId: "producedSubject" }],
      },
      {
        name: "a call read for how a double was called is still a call",
        filename: SPEC_FILE,
        code: 'test("forwards the order", ({ input }) => {\n  expect(sender(input)).toHaveBeenCalledWith({ id: "a" });\n});',
        errors: [{ messageId: "producedSubject" }],
      },
      {
        name: "a callable declared with a parameter carries the call it is about to make",
        filename: SPEC_FILE,
        code: 'const attempt = (name) => parse(name);\ntest("refuses an empty name", () => {\n  expect(attempt).toThrowErrorMessage("name must not be empty");\n});',
        errors: [{ messageId: "argumentTakingSubject", data: { subject: "attempt" } }],
      },
      {
        name: "a callable annotated as taking a parameter carries the call it is about to make",
        filename: SPEC_FILE,
        code: 'const attempt: (name: string) => void = whateverParseNeeds();\ntest("refuses an empty name", () => {\n  expect(attempt).toThrowErrorMessage("name must not be empty");\n});',
        errors: [{ messageId: "argumentTakingSubject", data: { subject: "attempt" } }],
      },
      {
        name: "a function declared in the file with a parameter carries the call too",
        filename: SPEC_FILE,
        code: 'function attempt(name) {\n  parse(name);\n}\ntest("refuses an empty name", () => {\n  expect(attempt).toThrowErrorMessage("name must not be empty");\n});',
        errors: [{ messageId: "argumentTakingSubject", data: { subject: "attempt" } }],
      },
      {
        name: "a function expression bound to a name declares its parameters the same way",
        filename: SPEC_FILE,
        code: 'const attempt = function (name) {\n  parse(name);\n};\ntest("refuses an empty name", () => {\n  expect(attempt).toThrowErrorMessage("name must not be empty");\n});',
        errors: [{ messageId: "argumentTakingSubject", data: { subject: "attempt" } }],
      },
      {
        name: "a rest parameter is a parameter, and the arguments still ride along",
        filename: SPEC_FILE,
        code: 'const attempt = (...names) => parse(...names);\ntest("refuses an empty name", () => {\n  expect(attempt).toThrowErrorMessage("name must not be empty");\n});',
        errors: [{ messageId: "argumentTakingSubject" }],
      },
      {
        name: "a defaulted parameter is a parameter, and the call is still bound in",
        filename: SPEC_FILE,
        code: 'const attempt = (name = "") => parse(name);\ntest("refuses an empty name", () => {\n  expect(attempt).toThrowErrorMessage("name must not be empty");\n});',
        errors: [{ messageId: "argumentTakingSubject" }],
      },
    ],
  });
});
