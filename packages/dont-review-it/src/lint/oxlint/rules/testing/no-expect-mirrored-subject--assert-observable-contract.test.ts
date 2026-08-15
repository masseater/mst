import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { noExpectMirroredSubject } from "./no-expect-mirrored-subject--assert-observable-contract.ts";

const SPEC_FILE = "report.test.ts";

describe("dont-review-it/no-expect-mirrored-subject--assert-observable-contract", () => {
  testLintRule(noExpectMirroredSubject, {
    valid: [
      {
        name: "an expected value the fixture never built stands on its own",
        documented: true,
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", () => summarise({ id: "a", total: 2 }));\ntest("counts what it was handed", ({ report }) => {\n  expect(report).toStrictEqual({ id: "a", entries: 2 });\n});',
      },
      {
        name: "an expected value built through another route is out of this reading",
        documented: true,
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", () => ({ id: "a" }));\ntest("carries the id", ({ report }) => {\n  expect(report).toStrictEqual(storedReport());\n});',
      },
      {
        name: "a matcher taking no value has nothing to compare against",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", () => ({ id: "a" }));\ntest("hands something back", ({ report }) => {\n  expect(report).toBeDefined();\n});',
      },
      {
        name: "an expected value handed over as a spread names no single expression",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", () => ({ id: "a" }));\ntest("carries the id", ({ report }) => {\n  expect(report).toStrictEqual(...builders);\n});',
      },
      {
        name: "a subject handed over as a spread names no single expression",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", () => ({ id: "a" }));\ntest("carries the id", ({ report }) => {\n  expect(...reports).toStrictEqual({ id: "a" });\n});',
      },
      {
        name: "a receiver holding no subject at all leaves nothing to look up",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", () => ({ id: "a" }));\ntest("carries the id", ({ report }) => {\n  expect().toStrictEqual({ id: "a" });\n});',
      },
      {
        name: "a projected subject carries no fixture name to look the construction up by",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", () => ({ id: "a" }));\ntest("carries the id", ({ report }) => {\n  expect(report.id).toStrictEqual({ id: "a" });\n});',
      },
      {
        name: "two property names name two properties",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", () => ({ id: "a" }));\ntest("carries the id", ({ report }) => {\n  expect(report).toStrictEqual({ name: "a" });\n});',
      },
      {
        name: "an expected value bound to a name that stands for nothing here",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", () => ({ id: "a" }));\ntest("carries the id", ({ report }) => {\n  expect(report).toStrictEqual(storedReport);\n});',
      },
      {
        name: "a name that two declarations spell stands for neither of them",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", () => {\n  const built = { id: "a" };\n  return built;\n});\ntest("carries the id", ({ report }) => {\n  const built = { id: "z" };\n  expect(report).toStrictEqual(built);\n});',
      },
      {
        name: "two names standing for each other reach no expression",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", () => ({ id: "a" }));\nconst first = second;\nconst second = first;\ntest("carries the id", ({ report }) => {\n  expect(report).toStrictEqual(first);\n});',
      },
      {
        name: "a construction that stands for itself reaches no expression",
        filename: SPEC_FILE,
        code: 'const outward = inward;\nconst inward = outward;\nconst test = baseTest.extend("report", () => outward);\ntest("carries the id", ({ report }) => {\n  expect(report).toStrictEqual({ id: "a" });\n});',
      },
      {
        name: "a name that takes a second expression later stands for neither",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", () => ({ id: "a" }));\ntest("carries the id", ({ report }) => {\n  let built = { id: "a" };\n  built = storedReport;\n  expect(report).toStrictEqual(built);\n});',
      },
      {
        name: "a name two declarations give an expression to stands for neither",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", () => ({ id: "a" }));\ntest("carries the id", ({ report }) => {\n  var built = { id: "a" };\n  var built = { id: "z" };\n  expect(report).toStrictEqual(built);\n});',
      },
      {
        name: "a name given no expression stands for nothing here",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", () => ({ id: "a" }));\ntest("carries the id", ({ report }) => {\n  let built;\n  expect(report).toStrictEqual(built);\n});',
      },
      {
        name: "a subject bound outside every fixture carries no fixture to look up",
        filename: SPEC_FILE,
        code: 'const report = summarise();\ntest("carries the id", () => {\n  expect(report).toStrictEqual({ id: "a" });\n});',
      },
      {
        name: "a subject of its own is not the fixture that shares its spelling",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", () => ({ id: "a" }));\nconst report = storedReport();\ntest("carries the id", () => {\n  expect(report).toStrictEqual({ id: "a" });\n});',
      },
      {
        name: "a test body taking the whole context names no fixture",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", () => ({ id: "a" }));\ntest("carries the id", (context) => {\n  expect(context).toStrictEqual({ id: "a" });\n});',
      },
      {
        name: "a subject no declaration in this file binds names no fixture",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", () => ({ id: "a" }));\ntest("carries the id", () => {\n  expect(storedReport).toStrictEqual({ id: "a" });\n});',
      },
      {
        name: "a name taken apart by destructuring is not a name this reading resolves",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", () => ({ id: "a" }));\ntest("carries the id", ({ report }) => {\n  const { built } = holder;\n  expect(report).toStrictEqual(built);\n});',
      },
      {
        name: "a fixture taken apart further names no subject of its own",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", () => ({ id: "a" }));\ntest("carries the id", ({ report: { id } }) => {\n  expect(id).toStrictEqual("a");\n});',
      },
      {
        name: "a builder handed a name this file does not bind reaches no construction",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", storedReport);\ntest("carries the id", ({ report }) => {\n  expect(report).toStrictEqual({ id: "a" });\n});',
      },
      {
        name: "a factory handing back a name this file does not bind reaches no construction",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", () => storedReport);\ntest("carries the id", ({ report }) => {\n  expect(report).toStrictEqual({ id: "a" });\n});',
      },
      {
        name: "a throw inside a function passed into the attempt is not what the catch caught",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("failure", () => {\n  try {\n    runSut(() => {\n      throw new ValidationError("empty");\n    });\n  } catch (error) {\n    return error;\n  }\n  return null;\n});\ntest("reports the failure", ({ failure }) => {\n  expect(failure).toStrictEqual(new ValidationError("empty"));\n});',
      },
      {
        name: "a caught value taken apart by destructuring names no caught subject",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("failure", () => {\n  try {\n    throw new ValidationError("empty");\n  } catch ({ message }) {\n    return message;\n  }\n});\ntest("reports the failure", ({ failure }) => {\n  expect(failure).toStrictEqual(new ValidationError("empty"));\n});',
      },
      {
        name: "an attempt with no catch clause holds no caught subject",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("failure", () => {\n  try {\n    throw new ValidationError("empty");\n  } finally {\n    close();\n  }\n  return caught;\n});\ntest("reports the failure", ({ failure }) => {\n  expect(failure).toStrictEqual(new ValidationError("empty"));\n});',
      },
      {
        name: "a receiver produced by a call of its own is not the assertion receiver",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", () => ({ id: "a" }));\ntest("carries the id", ({ report }) => {\n  resolve()(report).toStrictEqual({ id: "a" });\n});',
      },
      {
        name: "a spread of something other than the subject is a composed expected value",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", () => summarise());\ntest("carries the defaults", ({ report }) => {\n  expect(report).toStrictEqual({ ...defaults, id: "a" });\n});',
      },
      {
        name: "a spread of a call is a composed expected value",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", () => summarise());\ntest("carries the defaults", ({ report }) => {\n  expect(report).toStrictEqual({ ...defaults(), id: "a" });\n});',
      },
      {
        name: "a receiver of another name is not the assertion receiver",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", () => ({ id: "a" }));\ntest("carries the id", ({ report }) => {\n  assertThat(report).toStrictEqual({ id: "a" });\n});',
      },
      {
        name: "a member of another namespace is not the assertion receiver",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", () => ({ id: "a" }));\ntest("carries the id", ({ report }) => {\n  assert.soft(report).toStrictEqual({ id: "a" });\n});',
      },
      {
        name: "a member of the receiver that is not a form of it is not the receiver",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", () => ({ id: "a" }));\ntest("carries the id", ({ report }) => {\n  expect.raw(report).toStrictEqual({ id: "a" });\n});',
      },
      {
        name: "a receiver reached through a computed member is not the assertion receiver",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", () => ({ id: "a" }));\ntest("carries the id", ({ report }) => {\n  expect[form](report).toStrictEqual({ id: "a" });\n});',
      },
      {
        name: "a matcher on a value of its own is not an assertion",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", () => ({ id: "a" }));\ntest("carries the id", ({ report }) => {\n  report.toStrictEqual({ id: "a" });\n});',
      },
      {
        name: "a modifier this reading does not know breaks the chain",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", () => ({ id: "a" }));\ntest("carries the id", ({ report }) => {\n  expect(report).maybe.toStrictEqual({ id: "a" });\n});',
      },
      {
        name: "a modifier reached through a computed member breaks the chain",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", () => ({ id: "a" }));\ntest("carries the id", ({ report }) => {\n  expect(report)[step].toStrictEqual({ id: "a" });\n});',
      },
      {
        name: "a matcher reached through a computed member names no matcher",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", () => ({ id: "a" }));\ntest("carries the id", ({ report }) => {\n  expect(report)[matcher]({ id: "a" });\n});',
      },
      {
        name: "registering a custom matcher declares no fixture to mirror",
        filename: SPEC_FILE,
        code: 'expect.extend({ toBeReport });\ntest("carries the id", ({ toBeReport }) => {\n  expect(toBeReport).toStrictEqual({ toBeReport: 1 });\n});',
      },
      {
        name: "a file that is not a spec file is outside this reading",
        filename: "report.ts",
        code: 'const test = baseTest.extend("report", () => ({ id: "a" }));\ntest("carries the id", ({ report }) => {\n  expect(report).toStrictEqual({ id: "a" });\n});',
      },
      {
        name: "a suffix the configuration replaced no longer marks a spec file",
        filename: SPEC_FILE,
        options: [{ specFileSuffixes: ["-test.ts"] }],
        code: 'const test = baseTest.extend("report", () => ({ id: "a" }));\ntest("carries the id", ({ report }) => {\n  expect(report).toStrictEqual({ id: "a" });\n});',
      },
    ],
    invalid: [
      {
        name: "an object literal the fixture returns, written again as the expected value",
        documented: true,
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", () => ({ id: "a", total: 2 }));\ntest("carries both fields", ({ report }) => {\n  expect(report).toStrictEqual({ id: "a", total: 2 });\n});',
        errors: [{ messageId: "mirroredSubject", data: { subject: "report" } }],
      },
      {
        name: "indentation between the two sides is absorbed before they are compared",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", () => ({\n  id: "a",\n  total: 2,\n}));\ntest("carries both fields", ({ report }) => {\n  expect(report).toStrictEqual({\n    id: "a",\n    total: 2,\n  });\n});',
        errors: [{ messageId: "mirroredSubject" }],
      },
      {
        name: "the order the properties are written in is absorbed before they are compared",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", () => ({ id: "a", total: 2 }));\ntest("carries both fields", ({ report }) => {\n  expect(report).toStrictEqual({ total: 2, id: "a" });\n});',
        errors: [{ messageId: "mirroredSubject" }],
      },
      {
        name: "the quotes a string is written in are absorbed before the two sides are compared",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", () => ({ id: \'a\' }));\ntest("carries the id", ({ report }) => {\n  expect(report).toStrictEqual({ id: "a" });\n});',
        errors: [{ messageId: "mirroredSubject" }],
      },
      {
        name: "a construction bound to a name inside the factory before it is returned",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", () => {\n  const built = { id: "a", total: 2 };\n  return built;\n});\ntest("carries both fields", ({ report }) => {\n  expect(report).toStrictEqual({ id: "a", total: 2 });\n});',
        errors: [{ messageId: "mirroredSubject" }],
      },
      {
        name: "a construction bound to a name the whole file shares",
        filename: SPEC_FILE,
        code: 'const built = { id: "a" };\nconst test = baseTest.extend("report", () => built);\ntest("carries the id", ({ report }) => {\n  expect(report).toStrictEqual({ id: "a" });\n});',
        errors: [{ messageId: "mirroredSubject" }],
      },
      {
        name: "a construction handed to the builder without a factory around it",
        filename: SPEC_FILE,
        code: 'const built = { id: "a" };\nconst test = baseTest.extend("report", built);\ntest("carries the id", ({ report }) => {\n  expect(report).toStrictEqual({ id: "a" });\n});',
        errors: [{ messageId: "mirroredSubject" }],
      },
      {
        name: "a construction handed over by a factory written as a function",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend({\n  report: async function ({ port }, use) {\n    await use({ id: "a", port });\n  },\n});\ntest("carries the id", ({ report }) => {\n  expect(report).toStrictEqual({ id: "a", port });\n});',
        errors: [{ messageId: "mirroredSubject" }],
      },
      {
        name: "a construction handed over by the older object form of the builder",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend({\n  report: async ({}, use) => {\n    await use({ id: "a", total: 2 });\n  },\n});\ntest("carries both fields", ({ report }) => {\n  expect(report).toStrictEqual({ id: "a", total: 2 });\n});',
        errors: [{ messageId: "mirroredSubject" }],
      },
      {
        name: "a construction assembled by a function the factory runs on the spot",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", () => (() => ({ id: "a" }))());\ntest("carries the id", ({ report }) => {\n  expect(report).toStrictEqual({ id: "a" });\n});',
        errors: [{ messageId: "mirroredSubject" }],
      },
      {
        name: "a construction the factory reaches through a helper of this file",
        filename: SPEC_FILE,
        code: 'const buildReport = () => ({ id: "a" });\nconst test = baseTest.extend("report", () => buildReport());\ntest("carries the id", ({ report }) => {\n  expect(report).toStrictEqual({ id: "a" });\n});',
        errors: [{ messageId: "mirroredSubject" }],
      },
      {
        name: "a value thrown in the attempt and handed back out of the catch",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("failure", () => {\n  try {\n    throw new ValidationError("empty");\n  } catch (error) {\n    return error;\n  }\n});\ntest("reports the failure", ({ failure }) => {\n  expect(failure).toStrictEqual(new ValidationError("empty"));\n});',
        errors: [{ messageId: "mirroredSubject", data: { subject: "failure" } }],
      },
      {
        name: "a construction repeated behind a negation modifier",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", () => ({ id: "a" }));\ntest("carries the id", ({ report }) => {\n  expect(report).not.toStrictEqual({ id: "a" });\n});',
        errors: [{ messageId: "mirroredSubject" }],
      },
      {
        name: "a construction repeated behind a settlement modifier",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", () => ({ id: "a" }));\ntest("carries the id", async ({ report }) => {\n  await expect(report).resolves.toStrictEqual({ id: "a" });\n});',
        errors: [{ messageId: "mirroredSubject" }],
      },
      {
        name: "a construction repeated through the soft form of the receiver",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", () => ({ id: "a" }));\ntest("carries the id", ({ report }) => {\n  expect.soft(report).toStrictEqual({ id: "a" });\n});',
        errors: [{ messageId: "mirroredSubject" }],
      },
      {
        name: "a type assertion around the expected value does not make it another expression",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", () => ({ id: "a" }));\ntest("carries the id", ({ report }) => {\n  expect(report).toStrictEqual({ id: "a" } as Report);\n});',
        errors: [{ messageId: "mirroredSubject" }],
      },
      {
        name: "a weaker matcher is held to the same reading",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", () => ({ id: "a" }));\ntest("carries the id", ({ report }) => {\n  expect(report).toMatchObject({ id: "a" });\n});',
        errors: [{ messageId: "mirroredSubject" }],
      },
      {
        name: "a matcher of one's own is held to the same reading",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", () => ({ id: "a" }));\ntest("carries the id", ({ report }) => {\n  expect(report).toBeReport({ id: "a" });\n});',
        errors: [{ messageId: "mirroredSubject" }],
      },
      {
        name: "a fixture declared after the assertion is still the one the subject came from",
        filename: SPEC_FILE,
        code: 'test("carries the id", ({ report }) => {\n  expect(report).toStrictEqual({ id: "a" });\n});\nconst test = baseTest.extend("report", () => ({ id: "a" }));',
        errors: [{ messageId: "mirroredSubject" }],
      },
      {
        name: "one spelling standing for two fixtures reaches each of them by its own binding",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", () => ({ id: "a" })).extend("summary", () => ({ id: "b" }));\ntest("carries the id", ({ report: shared }) => {\n  expect(shared).toStrictEqual({ id: "a" });\n});\ntest("carries it too", ({ summary: shared }) => {\n  expect(shared).toStrictEqual({ id: "b" });\n});',
        errors: [
          { messageId: "mirroredSubject", data: { subject: "report" } },
          { messageId: "mirroredSubject", data: { subject: "summary" } },
        ],
      },
      {
        name: "a name given its expression once and never reassigned reaches the construction",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", () => ({ id: "a" }));\ntest("carries the id", ({ report }) => {\n  let built = { id: "a" };\n  expect(report).toStrictEqual(built);\n});',
        errors: [{ messageId: "mirroredSubject" }],
      },
      {
        name: "a subject taken under another name reaches the fixture it was declared as",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", () => ({ id: "a" }));\ntest("carries the id", ({ report: summary }) => {\n  expect(summary).toStrictEqual({ id: "a" });\n});',
        errors: [{ messageId: "mirroredSubject", data: { subject: "report" } }],
      },
      {
        name: "the subject written again as the expected value compares it with itself",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", () => summarise());\ntest("carries the id", ({ report }) => {\n  expect(report).toStrictEqual(report);\n});',
        errors: [{ messageId: "mirroredSubject", data: { subject: "report" } }],
      },
      {
        name: "an expected value bound to a name before the assertion reaches it",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", () => ({ id: "a" }));\ntest("carries the id", ({ report }) => {\n  const expected = { id: "a" };\n  expect(report).toStrictEqual(expected);\n});',
        errors: [{ messageId: "mirroredSubject" }],
      },
      {
        name: "an expected value passed along several names still reaches the construction",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", () => ({ id: "a" }));\nconst written = { id: "a" };\nconst forwarded = written;\ntest("carries the id", ({ report }) => {\n  expect(report).toStrictEqual(forwarded);\n});',
        errors: [{ messageId: "mirroredSubject" }],
      },
      {
        name: "spreading the subject into the expected value pins only what is overridden",
        documented: true,
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", () => summarise());\ntest("marks itself settled", ({ report }) => {\n  expect(report).toStrictEqual({ ...report, settled: true });\n});',
        errors: [{ messageId: "spreadSubject", data: { subject: "report" } }],
      },
      {
        name: "spreading the subject is read the same way when no fixture is in reach",
        filename: SPEC_FILE,
        code: 'test("marks itself settled", ({ report }) => {\n  expect(report).toStrictEqual({ ...report, settled: true });\n});',
        errors: [{ messageId: "spreadSubject" }],
      },
      {
        name: "spreading the subject under a name it was bound to is the same spread",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", () => summarise());\ntest("marks itself settled", ({ report }) => {\n  const expected = { ...report, settled: true };\n  expect(report).toStrictEqual(expected);\n});',
        errors: [{ messageId: "spreadSubject" }],
      },
    ],
  });
});
