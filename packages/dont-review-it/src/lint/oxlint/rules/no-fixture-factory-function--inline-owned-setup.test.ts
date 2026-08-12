import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { noFixtureFactoryFunction } from "./no-fixture-factory-function--inline-owned-setup.ts";

const SPEC_FILE = "report.test.ts";

describe("dont-review-it/no-fixture-factory-function--inline-owned-setup", () => {
  testLintRule(noFixtureFactoryFunction, {
    valid: [
      {
        name: "a fixture handing back the value the scenario produced owns its setup",
        filename: SPEC_FILE,
        code: `const test = baseTest.extend("report", () => summarise(3000));`,
      },
      {
        name: "a fixture handing back a value built over several statements owns its setup",
        filename: SPEC_FILE,
        code: `const test = baseTest.extend("report", () => {\n  const port = 3000;\n  return summarise(port);\n});`,
      },
      {
        name: "the older form handing the produced value to the runner owns its setup",
        filename: SPEC_FILE,
        code: `const test = baseTest.extend({\n  report: async ({ port }, use) => {\n    await use(summarise(port));\n  },\n});`,
      },
      {
        name: "a fixture handing back a value that is not a function offers no factory",
        filename: SPEC_FILE,
        code: `const test = baseTest.extend("port", 3000);`,
      },
      {
        name: "a function defined inside a fixture and never handed back is setup, not a subject",
        filename: SPEC_FILE,
        code: `const test = baseTest.extend("report", () => {\n  const close = () => store.close();\n  return summarise(close);\n});`,
      },
      {
        name: "registering a custom matcher shares the member name but declares no fixture",
        filename: SPEC_FILE,
        code: `expect.extend({ toBeReport: () => ({ pass: true }) });`,
      },
      {
        name: "registering a custom matcher that takes the received value declares no fixture",
        filename: SPEC_FILE,
        code: `expect.extend({ toBeReport: (received, expected) => ({ pass: received === expected }) });`,
      },
      {
        name: "a thunk every test block demands fail is the shape the thrown-value reading asks for",
        filename: SPEC_FILE,
        code: `const test = baseTest.extend("failing", () => () => summarise(-1));\ntest("refuses a negative port", ({ failing }) => {\n  expect(failing).toThrow(new RangeError("port is negative"));\n});`,
      },
      {
        name: "a thunk demanded to fail under a turned-around assertion is left alone as well",
        filename: SPEC_FILE,
        code: `const test = baseTest.extend("failing", () => () => summarise(3000));\ntest("accepts a port in range", ({ failing }) => {\n  expect(failing).not.toThrow();\n});`,
      },
      {
        name: "a thunk demanded to reject is left alone",
        filename: SPEC_FILE,
        code: `const test = baseTest.extend("failing", () => async () => summarise(-1));\ntest("refuses a negative port", async ({ failing }) => {\n  await expect(failing).rejects.toBeInstanceOf(RangeError);\n});`,
      },
      {
        name: "a thunk demanded to fail against a recorded message is left alone",
        filename: SPEC_FILE,
        code: `const test = baseTest.extend("failing", () => () => summarise(-1));\ntest("refuses a negative port", ({ failing }) => {\n  expect(failing).toThrowErrorMatchingInlineSnapshot(\`[RangeError: port is negative]\`);\n});`,
      },
      {
        name: "a thunk renamed where it is taken apart is followed to its uses",
        filename: SPEC_FILE,
        code: `const test = baseTest.extend("failing", () => () => summarise(-1));\ntest("refuses a negative port", ({ failing: thrown }) => {\n  expect(thrown).toThrow(new RangeError("port is negative"));\n});`,
      },
      {
        name: "a thunk demanded to fail in each of several test blocks is left alone",
        filename: SPEC_FILE,
        code: `const test = baseTest.extend("failing", () => () => summarise(-1));\ntest("names the bound", ({ failing }) => {\n  expect(failing).toThrow(new RangeError("port is negative"));\n});\ntest("names the class", ({ failing }) => {\n  expect(failing).toThrowError(new RangeError("port is negative"));\n});`,
      },
      {
        name: "a thunk demanded to fail through a soft assertion is left alone",
        filename: SPEC_FILE,
        code: `const test = baseTest.extend("failing", () => () => summarise(-1));\ntest("refuses a negative port", ({ failing }) => {\n  expect.soft(failing).toThrow(new RangeError("port is negative"));\n});`,
      },
      {
        name: "a thunk no test block reads is read by nothing that asks for another shape",
        filename: SPEC_FILE,
        code: `const test = baseTest.extend("failing", () => () => summarise(-1));`,
      },
      {
        name: "a thunk a test block names without reading is read by nothing asking for another shape",
        filename: SPEC_FILE,
        code: `const test = baseTest.extend("failing", () => () => summarise(-1));\ntest("refuses a negative port", ({ failing }) => {\n  expect(summarise(-1)).toBeUndefined();\n});`,
      },
      {
        name: "a runner taken in through an import roots the same reading",
        filename: SPEC_FILE,
        code: `import { test as baseTest } from "vite-plus/test";\n\nconst test = baseTest.extend("report", () => summarise(3000));`,
      },
      {
        name: "a test block taking the whole context names no fixture this reading can follow",
        filename: SPEC_FILE,
        code: `const test = baseTest.extend("build", () => () => summarise(3000));\ntest("summarises the port", (fixtureContext) => {\n  expect(fixtureContext.build()).toStrictEqual({ port: 3000 });\n});`,
      },
      {
        name: "a name the fixture never bound carries no function this reading can reach",
        filename: SPEC_FILE,
        code: `const test = baseTest.extend("build", () => {\n  return sharedBuilder;\n});`,
      },
      {
        name: "a name bound to itself leaves this reading with no function to reach",
        filename: SPEC_FILE,
        code: `const test = baseTest.extend("build", () => {\n  const build = build;\n  return build;\n});`,
      },
      {
        name: "a file that is not a spec is left alone",
        filename: "report.ts",
        code: `const test = baseTest.extend("report", () => (port) => summarise(port));`,
      },
      {
        name: "a spec spelled the way the configuration names is read the same way",
        filename: "report.spec.ts",
        options: [{ specFileSuffixes: [".spec.ts"] }],
        code: `const test = baseTest.extend("report", () => summarise(3000));`,
      },
      {
        name: "a matcher the configuration names demands the failure this reading leaves alone",
        filename: SPEC_FILE,
        options: [{ throwExpectingMatchers: ["toBlowUp"] }],
        code: `const test = baseTest.extend("failing", () => () => summarise(-1));\ntest("refuses a negative port", ({ failing }) => {\n  expect(failing).toBlowUp();\n});`,
      },
    ],
    invalid: [
      {
        name: "a factory taking the values its subject is built from hands the choice over",
        filename: SPEC_FILE,
        code: `const test = baseTest.extend("report", () => (port) => summarise(port));`,
        errors: [{ messageId: "parameterisedFactory" }],
      },
      {
        name: "a factory spelled under a name carrying no signal hands the same choice over",
        filename: SPEC_FILE,
        code: `const test = baseTest.extend("subject", () => (port) => summarise(port));`,
        errors: [{ messageId: "parameterisedFactory" }],
      },
      {
        name: "a factory taking only a fallback still declares a parameter",
        filename: SPEC_FILE,
        code: `const test = baseTest.extend("report", () => (port = 3000) => summarise(port));`,
        errors: [{ messageId: "parameterisedFactory" }],
      },
      {
        name: "a factory gathering its arguments into a rest parameter declares one",
        filename: SPEC_FILE,
        code: `const test = baseTest.extend("report", () => (...ports) => summarise(ports));`,
        errors: [{ messageId: "parameterisedFactory" }],
      },
      {
        name: "a factory spelled as a function expression hands the same choice over",
        filename: SPEC_FILE,
        code: `const test = baseTest.extend("report", () => function (port) {\n  return summarise(port);\n});`,
        errors: [{ messageId: "parameterisedFactory" }],
      },
      {
        name: "a factory a test block demands fail is reported for the parameters it declares",
        filename: SPEC_FILE,
        code: `const test = baseTest.extend("failing", () => (port) => summarise(port));\ntest("refuses a negative port", ({ failing }) => {\n  expect(failing).toThrow(new RangeError("port is negative"));\n});`,
        errors: [{ messageId: "parameterisedFactory" }],
      },
      {
        name: "a function handed back and called for its result leaves the subject to the test block",
        filename: SPEC_FILE,
        code: `const test = baseTest.extend("build", () => () => summarise(3000));\ntest("summarises the port", ({ build }) => {\n  expect(build()).toStrictEqual({ port: 3000 });\n});`,
        errors: [{ messageId: "handedBackFunction" }],
      },
      {
        name: "a callback spelled as a named function expression is followed to the thunk it reads",
        filename: SPEC_FILE,
        code: `const test = baseTest.extend("build", () => () => summarise(3000));\ntest("summarises the port", function run({ build }) {\n  expect(build()).toStrictEqual({ port: 3000 });\n});`,
        errors: [{ messageId: "handedBackFunction" }],
      },
      {
        name: "a thunk written over before the assertion is not the thunk that assertion demands fail",
        filename: SPEC_FILE,
        code: `const test = baseTest.extend("failing", () => () => summarise(-1));\ntest("refuses a negative port", ({ failing }) => {\n  failing = () => summarise(-2);\n  expect(failing).toThrow(new RangeError("port is negative"));\n});`,
        errors: [{ messageId: "handedBackFunction" }],
      },
      {
        name: "a function handed back and asserted about itself is not a demanded failure",
        filename: SPEC_FILE,
        code: `const test = baseTest.extend("build", () => () => summarise(3000));\ntest("hands back a callable", ({ build }) => {\n  expect(build).toBeTypeOf("function");\n});`,
        errors: [{ messageId: "handedBackFunction" }],
      },
      {
        name: "a thunk demanded to resolve is run for its value rather than for its failure",
        filename: SPEC_FILE,
        code: `const test = baseTest.extend("build", () => async () => summarise(3000));\ntest("summarises the port", async ({ build }) => {\n  await expect(build).resolves.toStrictEqual({ port: 3000 });\n});`,
        errors: [{ messageId: "handedBackFunction" }],
      },
      {
        name: "a thunk read once for something other than a failure is reported for that read",
        filename: SPEC_FILE,
        code: `const test = baseTest.extend("failing", () => () => summarise(-1));\ntest("refuses a negative port", ({ failing }) => {\n  expect(failing).toThrow(new RangeError("port is negative"));\n});\ntest("hands back a callable", ({ failing }) => {\n  expect(failing).toBeTypeOf("function");\n});`,
        errors: [{ messageId: "handedBackFunction" }],
      },
      {
        name: "a thunk another fixture takes apart has its setup chosen somewhere else",
        filename: SPEC_FILE,
        code: `const test = baseTest\n  .extend("failing", () => () => summarise(-1))\n  .extend("outcome", ({ failing }) => collect(failing));\ntest("refuses a negative port", ({ failing }) => {\n  expect(failing).toThrow(new RangeError("port is negative"));\n});`,
        errors: [{ messageId: "handedBackFunction" }],
      },
      {
        name: "a function wrapped in a type assertion is stripped before this reading",
        filename: SPEC_FILE,
        code: `const test = baseTest.extend("build", () => (() => summarise(3000)) as ReportBuilder);\ntest("summarises the port", ({ build }) => {\n  expect(build()).toStrictEqual({ port: 3000 });\n});`,
        errors: [{ messageId: "handedBackFunction" }],
      },
      {
        name: "a name carrying the function under a type assertion is followed to its initializer",
        filename: SPEC_FILE,
        code: `const test = baseTest.extend("build", () => {\n  const build = () => summarise(3000);\n  return build as ReportBuilder;\n});\ntest("summarises the port", ({ build }) => {\n  expect(build()).toStrictEqual({ port: 3000 });\n});`,
        errors: [{ messageId: "handedBackFunction" }],
      },
      {
        name: "a function bound to a name inside the fixture is followed to its initializer",
        filename: SPEC_FILE,
        code: `const test = baseTest.extend("build", () => {\n  const build = () => summarise(3000);\n  return build;\n});\ntest("summarises the port", ({ build }) => {\n  expect(build()).toStrictEqual({ port: 3000 });\n});`,
        errors: [{ messageId: "handedBackFunction" }],
      },
      {
        name: "the older form handing a function to the runner hands the same choice over",
        filename: SPEC_FILE,
        code: `const test = baseTest.extend({\n  build: async ({ port }, use) => {\n    await use((chosen) => summarise(chosen ?? port));\n  },\n});`,
        errors: [{ messageId: "parameterisedFactory" }],
      },
      {
        name: "the older form handing a thunk to the runner is read the same way",
        filename: SPEC_FILE,
        code: `const test = baseTest.extend({\n  build: async ({ port }, use) => {\n    await use(() => summarise(port));\n  },\n});\ntest("summarises the port", ({ build }) => {\n  expect(build()).toStrictEqual({ port: 3000 });\n});`,
        errors: [{ messageId: "handedBackFunction" }],
      },
      {
        name: "a builder carrying options between the name and the factory reads the same way",
        filename: SPEC_FILE,
        code: `const test = baseTest.extend("report", { auto: true }, () => (port) => summarise(port));`,
        errors: [{ messageId: "parameterisedFactory" }],
      },
      {
        name: "each function a fixture hands back is named on its own",
        filename: SPEC_FILE,
        code: `const test = baseTest.extend("report", ({ port }) => {\n  if (port === 0) return () => summarise(3000);\n  return (chosen) => summarise(chosen);\n});\ntest("summarises the port", ({ report }) => {\n  expect(report()).toStrictEqual({ port: 3000 });\n});`,
        errors: [{ messageId: "handedBackFunction" }, { messageId: "parameterisedFactory" }],
      },
      {
        name: "a thunk taken apart into a pattern this reading cannot follow is not shown to be one",
        filename: SPEC_FILE,
        code: `const test = baseTest.extend("failing", () => () => summarise(-1));\ntest("refuses a negative port", ({ failing = fallbackThunk }) => {\n  expect(failing).toThrow(new RangeError("port is negative"));\n});`,
        errors: [{ messageId: "handedBackFunction" }],
      },
      {
        name: "a matcher reached through a name decided at run time states no demand for a failure",
        filename: SPEC_FILE,
        code: `const test = baseTest.extend("failing", () => () => summarise(-1));\ntest("refuses a negative port", ({ failing }) => {\n  expect(failing)[chosenMatcher]();\n});`,
        errors: [{ messageId: "handedBackFunction" }],
      },
      {
        name: "a modifier reached through a name decided at run time breaks the chain this reading walks",
        filename: SPEC_FILE,
        code: `const test = baseTest.extend("failing", () => () => summarise(-1));\ntest("refuses a negative port", ({ failing }) => {\n  expect(failing)[chosenModifier].toThrow(new RangeError("port is negative"));\n});`,
        errors: [{ messageId: "handedBackFunction" }],
      },
      {
        name: "a thunk spread into the assertion entry is not the subject that entry states",
        filename: SPEC_FILE,
        code: `const test = baseTest.extend("failing", () => () => summarise(-1));\ntest("refuses a negative port", ({ failing }) => {\n  expect(...[failing]).toThrow(new RangeError("port is negative"));\n});`,
        errors: [{ messageId: "handedBackFunction" }],
      },
      {
        name: "an assertion entry standing on no subject demands no failure of the thunk it names",
        filename: SPEC_FILE,
        code: `const test = baseTest.extend("failing", () => () => summarise(-1));\ntest("refuses a negative port", ({ failing }) => {\n  expect().toThrow(failing);\n});`,
        errors: [{ messageId: "handedBackFunction" }],
      },
      {
        name: "a thunk called inside another function leaves the demanded failure to that function",
        filename: SPEC_FILE,
        code: `const test = baseTest.extend("failing", () => () => summarise(-1));\ntest("refuses a negative port", ({ failing }) => {\n  expect(() => failing()).toThrow(new RangeError("port is negative"));\n});`,
        errors: [{ messageId: "handedBackFunction" }],
      },
      {
        name: "a matcher the configuration leaves out no longer demands a failure",
        filename: SPEC_FILE,
        options: [{ throwExpectingMatchers: ["toBlowUp"] }],
        code: `const test = baseTest.extend("failing", () => () => summarise(-1));\ntest("refuses a negative port", ({ failing }) => {\n  expect(failing).toThrow(new RangeError("port is negative"));\n});`,
        errors: [{ messageId: "handedBackFunction" }],
      },
      {
        name: "a spec spelled the way the configuration names is examined",
        filename: "report.spec.ts",
        options: [{ specFileSuffixes: [".spec.ts"] }],
        code: `const test = baseTest.extend("report", () => (port) => summarise(port));`,
        errors: [{ messageId: "parameterisedFactory" }],
      },
    ],
  });
});
