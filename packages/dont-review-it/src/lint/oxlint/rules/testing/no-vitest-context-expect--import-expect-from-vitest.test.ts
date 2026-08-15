import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { noVitestContextExpect } from "./no-vitest-context-expect--import-expect-from-vitest.ts";

describe("dont-review-it/no-vitest-context-expect--import-expect-from-vitest", () => {
  testLintRule(noVitestContextExpect, {
    valid: [
      {
        name: "asserting through the imported binding passes",
        documented: true,
        code: 'import { expect } from "vitest";\nit("names a behaviour", ({ subject }) => {\n  expect(subject).toBe(1);\n});',
      },
      {
        name: "taking fixtures apart by name passes",
        documented: true,
        code: 'it("names a behaviour", ({ subject, options }) => {});',
      },
      {
        name: "a callback that takes no context passes",
        code: 'it("names a behaviour", () => {\n  expect(runSut()).toBe(1);\n});',
      },
      {
        name: "a pattern carrying a rest element belongs to the rule on context escape",
        code: 'it("names a behaviour", ({ expect, ...rest }) => {});',
      },
      {
        name: "a key written as a subscript is not read as a name here",
        code: 'it("names a behaviour", ({ ["expect"]: assert }) => {});',
      },
      {
        name: "a key chosen at run time is not read as a name here",
        code: 'it("names a behaviour", ({ [chosen]: assert }) => {});',
      },
      {
        name: "a property named expect outside a test callback is left alone",
        code: "const { expect } = runner;",
      },
      {
        name: "a callback handed to a call that declares no test block is left alone",
        code: 'helper("names a behaviour", ({ expect }) => {});',
      },
      {
        name: "a callback handed to a grouping block is left alone",
        code: 'describe("names a group", ({ expect }) => {});',
      },
      {
        name: "a receiver that is not the context is left alone",
        code: 'it("names a behaviour", (ctx) => {\n  runner.expect(1);\n});',
      },
      {
        name: "reaching the context through a subscript belongs to the rule on context escape",
        code: 'it("names a behaviour", (ctx) => {\n  ctx["expect"](1);\n});',
      },
      {
        name: "another member of the context is left alone",
        code: 'it("names a behaviour", (ctx) => {\n  ctx.subject;\n});',
      },
      {
        name: "a private field spelled the same way is left alone",
        code: "class Suite {\n  #expect = 1;\n  run() {\n    return this.#expect;\n  }\n}",
      },
      {
        name: "a member read off a call result is left alone",
        code: 'it("names a behaviour", (ctx) => {\n  openContext().expect(1);\n});',
      },
      {
        name: "a member read outside the callback that binds the context is left alone",
        code: 'ctx.expect(1);\nit("names a behaviour", (ctx) => {});\nctx.expect(2);',
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
        name: "a fixture factory taking expect apart belongs to the rule on context escape",
        code: "test.extend({\n  report: ({ expect }, use) => use(1),\n});",
      },
    ],
    invalid: [
      {
        name: "taking expect out of the context is reported",
        documented: true,
        code: 'it("names a behaviour", ({ expect }) => {\n  expect(runSut()).toBe(1);\n});',
        errors: [{ messageId: "destructuredContextExpect" }],
      },
      {
        name: "renaming what was taken out does not change what was taken",
        code: 'it("names a behaviour", ({ expect: assert }) => {\n  assert(runSut()).toBe(1);\n});',
        errors: [{ messageId: "destructuredContextExpect" }],
      },
      {
        name: "a quoted key names the same entry",
        code: 'it("names a behaviour", ({ "expect": assert }) => {});',
        errors: [{ messageId: "destructuredContextExpect" }],
      },
      {
        name: "a function expression callback is read the same way",
        code: 'it("names a behaviour", function ({ expect }) {});',
        errors: [{ messageId: "destructuredContextExpect" }],
      },
      {
        name: "a defaulted context parameter is read the same way",
        code: 'it("names a behaviour", ({ expect } = {}) => {});',
        errors: [{ messageId: "destructuredContextExpect" }],
      },
      {
        name: "a modifier in front of the block does not change the callback",
        code: 'it.skip("names a behaviour", ({ expect }) => {});',
        errors: [{ messageId: "destructuredContextExpect" }],
      },
      {
        name: "a table-driven block is reached through the call the table returns",
        code: 'it.each(rows)("names a behaviour", ({ expect }) => {});',
        errors: [{ messageId: "destructuredContextExpect" }],
      },
      {
        name: "the other injected spelling declares a block just the same",
        code: 'test("names a behaviour", ({ expect }) => {});',
        errors: [{ messageId: "destructuredContextExpect" }],
      },
      {
        name: "a renamed import of a block spelling declares a block just the same",
        code: 'import { it as check } from "vitest";\ncheck("names a behaviour", ({ expect }) => {});',
        errors: [{ messageId: "destructuredContextExpect" }],
      },
      {
        name: "a builder derived from the base declares a block just the same",
        code: 'const check = test.extend({ subject: 1 });\ncheck("names a behaviour", ({ expect }) => {});',
        errors: [{ messageId: "destructuredContextExpect" }],
      },
      {
        name: "a callback handed through a wrapping call is still the callback",
        code: 'it("names a behaviour", withSetup(({ expect }) => {}));',
        errors: [{ messageId: "destructuredContextExpect" }],
      },
      {
        name: "options written between the name and the callback change nothing",
        code: 'it("names a behaviour", { retry: 2 }, ({ expect }) => {});',
        errors: [{ messageId: "destructuredContextExpect" }],
      },
      {
        name: "a timeout written after the callback changes nothing",
        code: 'it("names a behaviour", ({ expect }) => {}, 1000);',
        errors: [{ messageId: "destructuredContextExpect" }],
      },
      {
        name: "a block nested in a grouping block is reported the same way",
        code: 'describe("names a group", () => {\n  it("names a behaviour", ({ expect }) => {});\n});',
        errors: [{ messageId: "destructuredContextExpect" }],
      },
      {
        name: "each block that takes expect out is reported on its own",
        code: 'it("names one behaviour", ({ expect }) => {});\nit("names another behaviour", ({ expect }) => {});',
        errors: [
          { messageId: "destructuredContextExpect" },
          { messageId: "destructuredContextExpect" },
        ],
      },
      {
        name: "reaching expect through the context binding is reported",
        documented: true,
        code: 'it("names a behaviour", (ctx) => {\n  ctx.expect(runSut()).toBe(1);\n});',
        errors: [{ messageId: "reachedContextExpect" }],
      },
      {
        name: "a callback that is not a test block in between changes nothing",
        code: 'it("names a behaviour", (ctx) => {\n  rows.forEach((row) => {\n    ctx.expect(row).toBe(1);\n  });\n});',
        errors: [{ messageId: "reachedContextExpect" }],
      },
      {
        name: "the context of an outer block is reached from a block nested inside it",
        code: 'it("names a behaviour", (ctx) => {\n  it("names another behaviour", (inner) => {\n    ctx.expect(1).toBe(1);\n  });\n});',
        errors: [{ messageId: "reachedContextExpect" }],
      },
    ],
  });
});
