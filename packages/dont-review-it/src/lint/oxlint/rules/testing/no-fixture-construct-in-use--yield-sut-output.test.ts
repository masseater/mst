import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { noFixtureConstructInUse } from "./no-fixture-construct-in-use--yield-sut-output.ts";

const SPEC_FILE = "report.test.ts";

const WRITTEN_OUT_SHAPE = "a value written out in the spec";

describe("dont-review-it/no-fixture-construct-in-use--yield-sut-output", () => {
  testLintRule(noFixtureConstructInUse, {
    valid: [
      {
        name: "a factory that runs the code under test hands back what it produced",
        documented: true,
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", async () => await summarise(input));',
      },
      {
        name: "a fixture written as a direct value declares an input rather than a production",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("options", { path: "/x" });',
      },
      {
        name: "a direct value in the object form declares an input rather than a production",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend({ options: { path: "/x" } });',
      },
      {
        name: "setup laid over the produced value keeps the production at its root",
        documented: true,
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", async () => {\n  const report = await summarise(input);\n  return Object.assign(report, { seen: true });\n});',
      },
      {
        name: "a buffer a callback fills is filled by the run, not by the spec",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("collected", async () => {\n  const collected = [];\n  await run({ onEvent: (event) => collected.push(event) });\n  return collected;\n});',
      },
      {
        name: "a buffer a statement fills is filled by the run, not by the spec",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("collected", async () => {\n  const collected = [];\n  const record = await run();\n  collected.push(written);\n  return collected;\n});',
      },
      {
        name: "a binding another fixture handed over is not a value this fixture built",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("subject", ({ report }) => report);',
      },
      {
        name: "a part read off a binding another fixture handed over belongs to another reading",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("path", ({ options }) => options.path);',
      },
      {
        name: "a part read off the context the factory receives belongs to another reading",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("path", (context) => context.options.path);',
      },
      {
        name: "a method call on a binding produces a value rather than reading one off it",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("total", () => {\n  const service = build();\n  return service.compute();\n});',
      },
      {
        name: "a part read straight off a call has no binding this reading can name",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("output", () => runSut().stdout);',
      },
      {
        name: "a name declared in another file holds nothing this reading can read",
        filename: SPEC_FILE,
        code: 'import { seeded } from "./seed.ts";\nconst test = baseTest.extend("report", () => seeded);',
      },
      {
        name: "a name declared without a value holds nothing this reading can read",
        filename: SPEC_FILE,
        code: 'let held;\nconst test = baseTest.extend("report", () => held);',
      },
      {
        name: "a name that stands for itself has nothing further to read",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", () => {\n  const report = report;\n  return report;\n});',
      },
      {
        name: "an immediately invoked function that runs the code under test hands back a production",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", () => (() => summarise(input))());',
      },
      {
        name: "composing onto a spread hands back no single value this reading can read",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", () => Object.assign(...parts));',
      },
      {
        name: "composing nothing hands back no value this reading can read",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", () => Object.assign());',
      },
      {
        name: "a namespace member reached by a computed name is not a name this reading can spell",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", () => Object[builder](input));',
      },
      {
        name: "a namespace produced by a call is not a name this reading can spell",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", () => shapes().create(input));',
      },
      {
        name: "a factory handing back a function belongs to another reading",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("attempt", () => () => summarise(input));',
      },
      {
        name: "registering a custom matcher is not a fixture declaration",
        filename: SPEC_FILE,
        code: "expect.extend({ toBeReady: () => ({ pass: true }) });",
      },
      {
        name: "a file that is not a spec file is outside this reading",
        filename: "report.ts",
        code: 'const test = baseTest.extend("report", () => ({ id: "a" }));',
      },
      {
        name: "a suffix the configuration replaced no longer marks a spec file",
        filename: SPEC_FILE,
        options: [{ specFileSuffixes: ["-test.ts"] }],
        code: 'const test = baseTest.extend("report", () => ({ id: "a" }));',
      },
    ],
    invalid: [
      {
        name: "an object literal handed back is a shape the spec assembled",
        documented: true,
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", () => ({ id: "a" }));',
        errors: [{ messageId: "builtSubject", data: { shape: "an object literal" } }],
      },
      {
        name: "an array literal handed back is a shape the spec assembled",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("rows", () => []);',
        errors: [{ messageId: "builtSubject", data: { shape: "an array literal" } }],
      },
      {
        name: "a string handed back is a value the spec wrote",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("id", () => "a");',
        errors: [{ messageId: "builtSubject", data: { shape: WRITTEN_OUT_SHAPE } }],
      },
      {
        name: "the absent value handed back is a value the spec wrote",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", () => undefined);',
        errors: [{ messageId: "builtSubject", data: { shape: WRITTEN_OUT_SHAPE } }],
      },
      {
        name: "a discarded expression handed back is a value the spec wrote",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", () => void 0);',
        errors: [{ messageId: "builtSubject", data: { shape: WRITTEN_OUT_SHAPE } }],
      },
      {
        name: "the empty value handed back is a value the spec wrote",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", () => null);',
        errors: [{ messageId: "builtSubject", data: { shape: WRITTEN_OUT_SHAPE } }],
      },
      {
        name: "a template without substitutions handed back is a value the spec wrote",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("id", () => `a`);',
        errors: [{ messageId: "builtSubject", data: { shape: WRITTEN_OUT_SHAPE } }],
      },
      {
        name: "a signed number handed back is a value the spec wrote",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("offset", () => -1);',
        errors: [{ messageId: "builtSubject", data: { shape: WRITTEN_OUT_SHAPE } }],
      },
      {
        name: "a constructor run in the factory builds the value the fixture hands back",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", () => new Report(input));',
        errors: [
          { messageId: "builtSubject", data: { shape: "a value a constructor built here" } },
        ],
      },
      {
        name: "a type assertion around the built value is stripped before it is read",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", () => ({ id: "a" }) as Report);',
        errors: [{ messageId: "builtSubject", data: { shape: "an object literal" } }],
      },
      {
        name: "a binding between the building and the handover carries the built value",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", () => {\n  const report = { id: "a" };\n  return report;\n});',
        errors: [
          {
            messageId: "boundBuiltSubject",
            data: { name: "report", shape: "an object literal" },
          },
        ],
      },
      {
        name: "further bindings between the building and the handover carry the built value",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", () => {\n  const bag = { id: "a" };\n  const report = bag;\n  return report;\n});',
        errors: [
          {
            messageId: "boundBuiltSubject",
            data: { name: "report", shape: "an object literal" },
          },
        ],
      },
      {
        name: "a binding declared outside the factory carries the built value into it",
        filename: SPEC_FILE,
        code: 'const bag = { id: "a" };\nconst test = baseTest.extend("report", () => bag);',
        errors: [
          { messageId: "boundBuiltSubject", data: { name: "bag", shape: "an object literal" } },
        ],
      },
      {
        name: "composing onto a built value leaves the building at its root",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", () => Object.assign({ id: "a" }, extra));',
        errors: [{ messageId: "builtSubject", data: { shape: "an object literal" } }],
      },
      {
        name: "an instance made through the object namespace is built in the factory",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", () => Object.create(prototype));',
        errors: [
          { messageId: "builtSubject", data: { shape: "a value `Object.create` built here" } },
        ],
      },
      {
        name: "an instance made through reflection is built in the factory",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", () => Reflect.construct(Report, [input]));',
        errors: [
          { messageId: "builtSubject", data: { shape: "a value `Reflect.construct` built here" } },
        ],
      },
      {
        name: "an immediately invoked function hides the building rather than removing it",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", () => (() => ({ id: "a" }))());',
        errors: [{ messageId: "builtSubject", data: { shape: "an object literal" } }],
      },
      {
        name: "an immediately invoked function with a body of its own is followed to its return",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", () => (async () => {\n  return { id: "a" };\n})());',
        errors: [{ messageId: "builtSubject", data: { shape: "an object literal" } }],
      },
      {
        name: "a container the spec filled before handing it back is not a buffer the run filled",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("rows", () => {\n  const rows = [seed];\n  rows.push(extra);\n  return rows;\n});',
        errors: [
          { messageId: "boundBuiltSubject", data: { name: "rows", shape: "an array literal" } },
        ],
      },
      {
        name: "an empty container nothing ever fills is a value the spec assembled",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("rows", () => {\n  const rows = [];\n  return rows;\n});',
        errors: [
          { messageId: "boundBuiltSubject", data: { name: "rows", shape: "an array literal" } },
        ],
      },
      {
        name: "a call on something other than the container leaves the container empty",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("rows", () => {\n  const rows = [];\n  runSut().close();\n  return rows;\n});',
        errors: [
          { messageId: "boundBuiltSubject", data: { name: "rows", shape: "an array literal" } },
        ],
      },
      {
        name: "a part read off a binding the factory holds narrows what the fixture hands back",
        documented: true,
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("output", () => {\n  const caught = runSut();\n  return caught.stdout;\n});',
        errors: [{ messageId: "readSubject", data: { root: "caught" } }],
      },
      {
        name: "a binding between the reading and the handover carries the same narrowing",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("output", () => {\n  const caught = runSut();\n  const out = caught.stdout;\n  return out;\n});',
        errors: [{ messageId: "readSubject", data: { root: "caught" } }],
      },
      {
        name: "a value handed to the callback of the object form is read the same way",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend({\n  report: async ({}, use) => {\n    await use({ id: "a" });\n  },\n});',
        errors: [{ messageId: "builtSubject", data: { shape: "an object literal" } }],
      },
      {
        name: "a scoped fixture of the object form is read through its factory",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend({\n  report: [\n    async ({}, use) => {\n      await use(null);\n    },\n    { scope: "test" },\n  ],\n});',
        errors: [{ messageId: "builtSubject", data: { shape: WRITTEN_OUT_SHAPE } }],
      },
      {
        name: "every handover a factory writes is read on its own",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", (flag) => {\n  if (flag) {\n    return null;\n  }\n  return { id: "a" };\n});',
        errors: [
          { messageId: "builtSubject", data: { shape: WRITTEN_OUT_SHAPE } },
          { messageId: "builtSubject", data: { shape: "an object literal" } },
        ],
      },
    ],
  });
});
