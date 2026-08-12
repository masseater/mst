import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { noTestContextEscape } from "./no-test-context-escape--destructure-fixtures-by-name.ts";

describe("dont-review-it/no-test-context-escape--destructure-fixtures-by-name", () => {
  testLintRule(noTestContextEscape, {
    valid: [
      {
        name: "taking fixtures apart by name passes",
        code: 'it("names a behaviour", ({ subject, options }) => {});',
      },
      {
        name: "renaming what was taken out keeps the name readable",
        code: 'it("names a behaviour", ({ subject: bound }) => {});',
      },
      {
        name: "a quoted key names a fixture just the same",
        code: 'it("names a behaviour", ({ "subject": bound }) => {});',
      },
      {
        name: "a nested pattern passes as long as each stage reads statically",
        code: 'it("names a behaviour", ({ options: { path } }) => {});',
      },
      {
        name: "a nested pattern behind a default reads the same way",
        code: 'it("names a behaviour", ({ options: { path } = {} }) => {});',
      },
      {
        name: "a rest over a fixture value is not a rest over the context",
        code: 'it("names a behaviour", ({ options: { ...spread } }) => {});',
      },
      {
        name: "a default on the whole pattern leaves the names standing",
        code: 'it("names a behaviour", ({ subject } = {}) => {});',
      },
      {
        name: "a callback that takes no context passes",
        code: 'it("names a behaviour", () => {});',
      },
      {
        name: "a callback handed to a call that declares no test block is left alone",
        code: 'helper("names a behaviour", (ctx) => {});',
      },
      {
        name: "a callback handed to a grouping block is left alone",
        code: 'describe("names a group", (ctx) => {});',
      },
      {
        name: "a spread callback hides itself from this reading",
        code: 'it("names a behaviour", ...handlers);',
      },
      {
        name: "a value handed to a block that is no function carries no context",
        code: 'it("names a behaviour", 3000);',
      },
      {
        name: "a subscript on a fixture value is left alone",
        code: 'it("names a behaviour", ({ options }) => {\n  options[chosen];\n});',
      },
      {
        name: "a spread of a fixture value is left alone",
        code: 'it("names a behaviour", ({ options }) => {\n  const copied = { ...options };\n});',
      },
      {
        name: "walking a fixture value is left alone",
        code: 'it("names a behaviour", ({ options }) => {\n  for (const key in options) {\n  }\n});',
      },
      {
        name: "a subscript read off a call result is left alone",
        code: 'it("names a behaviour", ({ options }) => {\n  openContext()[chosen];\n});',
      },
      {
        name: "a static member read off a fixture value is left alone",
        code: 'it("names a behaviour", ({ subject }) => {\n  subject.field;\n});',
      },
      {
        name: "an object literal without a spread is left alone",
        code: 'it("names a behaviour", ({ subject }) => {\n  const shaped = { subject };\n});',
      },
      {
        name: "a construction that carries no context is left alone",
        code: 'it("names a behaviour", ({ subject }) => {\n  new Wrapper(subject);\n});',
      },
      {
        name: "an object-form fixture factory taking dependencies apart by name passes",
        code: "test.extend({\n  report: ({ subject }, use) => use(subject.line),\n});",
      },
      {
        name: "a builder-form fixture factory taking dependencies apart by name passes",
        code: 'test.extend("report", ({ subject }) => subject.line);',
      },
      {
        name: "a fixture declared without a factory carries no context",
        code: "test.extend({ subject: 1 });",
      },
      {
        name: "an extend on the assertion entry declares no fixture",
        code: "expect.extend({\n  toBeCell: (received) => ({ pass: true }),\n});",
      },
    ],
    invalid: [
      {
        name: "binding the context as one name is reported",
        code: 'it("names a behaviour", (ctx) => {});',
        errors: [{ messageId: "wholeContext" }],
      },
      {
        name: "a function expression callback is read the same way",
        code: 'it("names a behaviour", function (ctx) {});',
        errors: [{ messageId: "wholeContext" }],
      },
      {
        name: "a default on the whole binding does not turn it into names",
        code: 'it("names a behaviour", (ctx = {}) => {});',
        errors: [{ messageId: "wholeContext" }],
      },
      {
        name: "an array pattern is read as a whole binding",
        code: 'it("names a behaviour", ([subject]) => {});',
        errors: [{ messageId: "wholeContext" }],
      },
      {
        name: "a rest parameter is read as a whole binding",
        code: 'it("names a behaviour", (...handed) => {});',
        errors: [{ messageId: "wholeContext" }],
      },
      {
        name: "gathering the rest of the context is reported",
        code: 'it("names a behaviour", ({ subject, ...rest }) => {});',
        errors: [{ messageId: "restContext" }],
      },
      {
        name: "a key chosen at run time is reported",
        code: 'it("names a behaviour", ({ [chosen]: bound }) => {});',
        errors: [{ messageId: "computedContextKey" }],
      },
      {
        name: "a quoted subscript key is reported just the same",
        code: 'it("names a behaviour", ({ ["expect"]: assert }) => {});',
        errors: [{ messageId: "computedContextKey" }],
      },
      {
        name: "a key chosen at run time one stage down is reported",
        code: 'it("names a behaviour", ({ options: { [chosen]: bound } }) => {});',
        errors: [{ messageId: "computedContextKey" }],
      },
      {
        name: "reaching the context through a subscript is reported",
        code: 'it("names a behaviour", (ctx) => {\n  ctx["expect"](1);\n});',
        errors: [{ messageId: "wholeContext" }, { messageId: "traversedContext" }],
      },
      {
        name: "walking the properties of the context is reported",
        code: 'it("names a behaviour", (ctx) => {\n  for (const key in ctx) {\n  }\n});',
        errors: [{ messageId: "wholeContext" }, { messageId: "traversedContext" }],
      },
      {
        name: "copying the context by spread is reported",
        code: 'it("names a behaviour", (ctx) => {\n  const copied = { ...ctx };\n});',
        errors: [{ messageId: "wholeContext" }, { messageId: "traversedContext" }],
      },
      {
        name: "handing the context to another function is reported",
        code: 'it("names a behaviour", (ctx) => {\n  inspect(ctx);\n});',
        errors: [{ messageId: "wholeContext" }, { messageId: "traversedContext" }],
      },
      {
        name: "spreading the context into a call is reported",
        code: 'it("names a behaviour", (ctx) => {\n  inspect(...ctx);\n});',
        errors: [{ messageId: "wholeContext" }, { messageId: "traversedContext" }],
      },
      {
        name: "handing the context to a construction is reported",
        code: 'it("names a behaviour", (ctx) => {\n  new Wrapper(ctx);\n});',
        errors: [{ messageId: "wholeContext" }, { messageId: "traversedContext" }],
      },
      {
        name: "a subscript outside the callback that binds the context is left out",
        code: 'ctx[chosen];\nit("names a behaviour", (ctx) => {});\nctx[chosen];',
        errors: [{ messageId: "wholeContext" }],
      },
      {
        name: "a modifier in front of the block does not change the callback",
        code: 'it.skip("names a behaviour", (ctx) => {});',
        errors: [{ messageId: "wholeContext" }],
      },
      {
        name: "a table-driven block is reached through the call the table returns",
        code: 'it.each(rows)("names a behaviour", (ctx) => {});',
        errors: [{ messageId: "wholeContext" }],
      },
      {
        name: "the other injected spelling declares a block just the same",
        code: 'test("names a behaviour", (ctx) => {});',
        errors: [{ messageId: "wholeContext" }],
      },
      {
        name: "a renamed import of a block spelling declares a block just the same",
        code: 'import { it as check } from "vitest";\ncheck("names a behaviour", (ctx) => {});',
        errors: [{ messageId: "wholeContext" }],
      },
      {
        name: "a builder derived from the base declares a block just the same",
        code: 'const check = test.extend({ subject: 1 });\ncheck("names a behaviour", (ctx) => {});',
        errors: [{ messageId: "wholeContext" }],
      },
      {
        name: "a callback handed through a wrapping call is still the callback",
        code: 'it("names a behaviour", withSetup((ctx) => {}));',
        errors: [{ messageId: "wholeContext" }],
      },
      {
        name: "a block nested in a grouping block is reported the same way",
        code: 'describe("names a group", () => {\n  it("names a behaviour", (ctx) => {});\n});',
        errors: [{ messageId: "wholeContext" }],
      },
      {
        name: "each block that holds the context whole is reported on its own",
        code: 'it("names one behaviour", (ctx) => {});\nit("names another behaviour", (ctx) => {});',
        errors: [{ messageId: "wholeContext" }, { messageId: "wholeContext" }],
      },
      {
        name: "an object-form fixture factory holding the context whole is reported",
        code: "test.extend({\n  report: (ctx, use) => use(1),\n});",
        errors: [{ messageId: "wholeContext" }],
      },
      {
        name: "a builder-form fixture factory holding the context whole is reported",
        code: 'test.extend("report", (ctx) => ctx.line);',
        errors: [{ messageId: "wholeContext" }],
      },
      {
        name: "a fixture factory handed through a wrapping call is still the factory",
        code: 'test.extend("report", withSetup((ctx) => ctx.line));',
        errors: [{ messageId: "wholeContext" }],
      },
      {
        name: "handing the context on to the fixture handoff is reported",
        code: "test.extend({\n  report: (ctx, use) => use(ctx),\n});",
        errors: [{ messageId: "wholeContext" }, { messageId: "traversedContext" }],
      },
    ],
  });
});
