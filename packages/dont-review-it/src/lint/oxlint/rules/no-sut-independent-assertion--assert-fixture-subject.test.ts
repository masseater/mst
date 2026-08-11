import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { noSutIndependentAssertion } from "./no-sut-independent-assertion--assert-fixture-subject.ts";

const SPEC_FILE = "report.test.ts";

describe("dont-review-it/no-sut-independent-assertion--assert-fixture-subject", () => {
  testLintRule(noSutIndependentAssertion, {
    valid: [
      {
        name: "a subject the fixture handed over is compared against a value written in the spec",
        filename: SPEC_FILE,
        code: 'test("carries the id", ({ report }) => {\n  expect(report).toStrictEqual({ id: "a" });\n});',
      },
      {
        name: "a subject that came out of a call went through the code under test",
        filename: SPEC_FILE,
        code: 'test("carries the id", ({ input }) => {\n  expect(summarise(input)).toBe("a");\n});',
      },
      {
        name: "a written-out subject compared against a value from the code still turns on the code",
        filename: SPEC_FILE,
        code: 'test("carries the id", ({ report }) => {\n  expect("a").toBe(report.id);\n});',
      },
      {
        name: "a value brought in from outside the spec changes when the code under test changes",
        filename: SPEC_FILE,
        code: 'import { DEFAULT_ID } from "./report.ts";\ntest("carries the default id", () => {\n  expect(DEFAULT_ID).toBe("a");\n});',
      },
      {
        name: "a construction on a name the spec brought in runs code that can change",
        filename: SPEC_FILE,
        code: 'import { Report } from "./report.ts";\ntest("carries the id", () => {\n  expect(new Report("a")).toStrictEqual(new Report("a"));\n});',
      },
      {
        name: "a mock the fixture handed over records what the code under test did",
        filename: SPEC_FILE,
        code: 'test("wrote the row", ({ write }) => {\n  expect(write).toHaveBeenCalledWith({ id: "a" });\n});',
      },
      {
        name: "a matcher taking no expected value reads a subject that came from the fixture",
        filename: SPEC_FILE,
        code: 'test("carries an id", ({ report }) => {\n  expect(report).toBeTruthy();\n});',
      },
      {
        name: "an expected value from the code under test keeps the comparison answerable",
        filename: SPEC_FILE,
        code: 'test("matches the sent id", ({ sent }) => {\n  expect("a").toBe(sent);\n});',
      },
      {
        name: "an assertion that stopped before a matcher belongs to another reading",
        filename: SPEC_FILE,
        code: 'test("carries the id", () => {\n  expect("a");\n});',
      },
      {
        name: "a subject the fixture handed over under a weak matcher belongs to another reading",
        filename: SPEC_FILE,
        code: 'test("carries an id", ({ report }) => {\n  expect(report).toMatchObject({ id: "a" });\n});',
      },
      {
        name: "a name the spec never filled with a value it wrote is left alone",
        filename: SPEC_FILE,
        code: 'test("carries the id", () => {\n  expect(report).toBe("a");\n});',
      },
      {
        name: "a name the spec wrote over with the code's output still turns on the code",
        filename: SPEC_FILE,
        code: 'let id = "a";\nid = summarise(input);\ntest("carries the id", () => {\n  expect(id).toBe("a");\n});',
      },
      {
        name: "two names holding the same written-out value are still two bindings",
        filename: SPEC_FILE,
        code: 'test("carries the id", ({ report }) => {\n  expect(report).toStrictEqual({ ...report, id: "b" });\n});',
      },
      {
        name: "a container held by a name is open, since the code under test can write into it",
        filename: SPEC_FILE,
        code: 'const written = new Set();\ntest("wrote one row", () => {\n  expect(written.size).toBe(1);\n});',
      },
      {
        name: "a collection held by a name is open for the same reason",
        filename: SPEC_FILE,
        code: 'const ids = [];\ntest("wrote one id", () => {\n  expect(ids).toStrictEqual(["a"]);\n});',
      },
      {
        name: "a file that is not a spec file is outside this reading",
        filename: "report.ts",
        code: 'test("carries the id", () => {\n  expect("a").toBe("a");\n});',
      },
      {
        name: "a suffix the configuration replaced no longer marks a spec file",
        filename: SPEC_FILE,
        options: [{ specFileSuffixes: ["-test.ts"] }],
        code: 'test("carries the id", () => {\n  expect("a").toBe("a");\n});',
      },
    ],
    invalid: [
      {
        name: "a written-out value compared against a written-out value asks nothing of the code",
        filename: SPEC_FILE,
        code: 'test("holds", () => {\n  expect(true).toBe(true);\n});',
        errors: [{ messageId: "sutIndependentAssertion" }],
      },
      {
        name: "an expression built only from written-out values lands the same way whatever the code does",
        filename: SPEC_FILE,
        code: 'test("adds up", () => {\n  expect(1 + 1).toBe(2);\n});',
        errors: [{ messageId: "sutIndependentAssertion" }],
      },
      {
        name: "a name the spec filled with a written-out value carries that value into the comparison",
        filename: SPEC_FILE,
        code: 'const id = "a";\ntest("carries the id", () => {\n  expect(id).toBe("a");\n});',
        errors: [{ messageId: "sutIndependentAssertion" }],
      },
      {
        name: "a chain of names ends at the same written-out value",
        filename: SPEC_FILE,
        code: 'const id = "a";\nconst carried = id;\ntest("carries the id", () => {\n  expect(carried).toStrictEqual(["a"][0]);\n});',
        errors: [{ messageId: "sutIndependentAssertion" }],
      },
      {
        name: "a matcher taking no expected value reads a subject the spec wrote",
        filename: SPEC_FILE,
        code: 'const id = "a";\ntest("carries an id", () => {\n  expect(id).toBeTruthy();\n});',
        errors: [{ messageId: "sutIndependentAssertion" }],
      },
      {
        name: "a negation leaves the comparison as far from the code as it was",
        filename: SPEC_FILE,
        code: 'test("differs", () => {\n  expect("a").not.toBe("b");\n});',
        errors: [{ messageId: "sutIndependentAssertion" }],
      },
      {
        name: "the soft form of the receiver takes the same written-out pair",
        filename: SPEC_FILE,
        code: 'test("holds", () => {\n  expect.soft("a").toBe("a");\n});',
        errors: [{ messageId: "sutIndependentAssertion" }],
      },
      {
        name: "a host object the spec built on both sides never reaches the code under test",
        filename: SPEC_FILE,
        code: 'test("carries the header", () => {\n  expect(new Headers({ accept: "text/plain" })).toStrictEqual(new Headers({ accept: "text/plain" }));\n});',
        errors: [{ messageId: "sutIndependentAssertion" }],
      },
      {
        name: "a subject compared against itself lands the same way whatever the code does",
        filename: SPEC_FILE,
        code: 'test("carries the id", ({ report }) => {\n  expect(report).toStrictEqual(report);\n});',
        errors: [{ messageId: "selfComparedSubject", data: { subject: "report" } }],
      },
      {
        name: "a negation over a subject compared against itself only always fails",
        filename: SPEC_FILE,
        code: 'test("carries the id", ({ report }) => {\n  expect(report).not.toStrictEqual(report);\n});',
        errors: [{ messageId: "selfComparedSubject", data: { subject: "report" } }],
      },
      {
        name: "spreading the subject into a fresh object reaches the same value",
        filename: SPEC_FILE,
        code: 'test("carries the id", ({ report }) => {\n  expect(report).toStrictEqual({ ...report });\n});',
        errors: [{ messageId: "selfComparedSubject", data: { subject: "report" } }],
      },
      {
        name: "spreading the subject into a fresh array reaches the same value",
        filename: SPEC_FILE,
        code: 'test("carries both ids", ({ ids }) => {\n  expect(ids).toStrictEqual([...ids]);\n});',
        errors: [{ messageId: "selfComparedSubject", data: { subject: "ids" } }],
      },
      {
        name: "copying the subject into another name reaches the same binding",
        filename: SPEC_FILE,
        code: 'test("carries the id", ({ report }) => {\n  const copied = report;\n  expect(report).toStrictEqual(copied);\n});',
        errors: [{ messageId: "selfComparedSubject", data: { subject: "report" } }],
      },
      {
        name: "a wrapper on either side is stripped before the two are read as one value",
        filename: SPEC_FILE,
        code: 'test("carries the id", ({ report }) => {\n  expect(report!).toStrictEqual(report as Report);\n});',
        errors: [{ messageId: "selfComparedSubject", data: { subject: "report" } }],
      },
      {
        name: "a subject held by a name the spec filled from a call is still compared against itself",
        filename: SPEC_FILE,
        code: 'const report = summarise(input);\ntest("carries the id", () => {\n  expect(report).toStrictEqual(report);\n});',
        errors: [{ messageId: "selfComparedSubject", data: { subject: "report" } }],
      },
    ],
  });
});
