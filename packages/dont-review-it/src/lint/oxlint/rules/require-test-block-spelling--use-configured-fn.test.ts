import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { requireTestBlockSpelling } from "./require-test-block-spelling--use-configured-fn.ts";

describe("dont-review-it/require-test-block-spelling--use-configured-fn", () => {
  testLintRule(requireTestBlockSpelling, {
    valid: [
      {
        name: "a block declared with the required spelling is the form this rule asks for",
        code: 'it("names a behaviour", () => {});',
      },
      {
        name: "a modifier in front of the required spelling leaves the root where it belongs",
        code: 'it.skip("names a behaviour", () => {});\nit.each(rows)("names a behaviour", () => {});',
      },
      {
        name: "a modifier written as a string subscript on the required spelling stays valid",
        code: 'it["skip"]("names a behaviour", () => {});',
      },
      {
        name: "a fixture factory is not a block declaration",
        code: "test.extend({ subject: 1 });",
      },
      {
        name: "a fixture factory rooted at the required spelling is not a block declaration either",
        code: "it.extend({ subject: 1 });",
      },
      {
        name: "a modifier chosen at run time hides the root from this reading",
        code: 'test[chosen]("names a behaviour", () => {});',
      },
      {
        name: "a method reached through a receiver is not a block declaration",
        code: 'suite.test("names a behaviour", () => {});',
      },
      {
        name: "a derived builder bound to the required spelling is the agreed form",
        code: 'const it = test.extend({ subject: 1 });\nit("names a behaviour", () => {});',
      },
      {
        name: "a grouping block carries its own spelling",
        code: 'describe("names a group", () => {});',
      },
      {
        name: "a grouping API renamed on import is not a block declaration",
        code: 'import { describe as group } from "vitest";\ngroup("names a group", () => {});',
      },
      {
        name: "an assertion entry imported from the runner is not a block declaration",
        code: 'import { expect } from "vitest";\nexpect(1);',
      },
      {
        name: "a binding named after a block spelling imported from elsewhere stays out of reach",
        code: 'import { test as spec } from "./helpers.ts";\nspec("names a behaviour", () => {});',
      },
      {
        name: "a default import carries no name the runner exported",
        code: 'import spec from "vitest";\nspec("names a behaviour", () => {});',
      },
      {
        name: "a parameter shadowing a block spelling is bound to whatever the caller hands it",
        code: 'const run = (test) => { test("names a behaviour", () => {}); };',
      },
      {
        name: "a call to something the runner never handed over is left alone",
        code: 'helper("names a behaviour", () => {});',
      },
      {
        name: "a binding built by something other than the runner is left alone",
        code: 'const spec = build({ subject: 1 });\nspec("names a behaviour", () => {});',
      },
      {
        name: "a binding built through a member that is not the fixture builder is left alone",
        code: 'const spec = helper.make({ subject: 1 });\nspec("names a behaviour", () => {});',
      },
      {
        name: "bindings that stand on each other reach no runner API",
        code: 'const first = second;\nconst second = first;\nfirst("names a behaviour", () => {});',
      },
      {
        name: "the configured spelling decides which spelling is the required one",
        code: 'test("names a behaviour", () => {});',
        options: [{ blockSpelling: "test" }],
      },
    ],
    invalid: [
      {
        name: "a bare block declared with the other injected spelling is reported and renamed",
        code: 'test("names a behaviour", () => {});',
        errors: [{ messageId: "foreignBlockSpelling" }],
        output: 'it("names a behaviour", () => {});',
      },
      {
        name: "a modifier in front of the block leaves the report and the rename at the root",
        code: 'test.skip("names a behaviour", () => {});',
        errors: [{ messageId: "foreignBlockSpelling" }],
        output: 'it.skip("names a behaviour", () => {});',
      },
      {
        name: "modifiers stacked on each other are reported once at the root",
        code: 'test.skipIf(slow).concurrent("names a behaviour", () => {});',
        errors: [{ messageId: "foreignBlockSpelling" }],
        output: 'it.skipIf(slow).concurrent("names a behaviour", () => {});',
      },
      {
        name: "a table driven block is reported once through the call the table returns",
        code: 'test.each(rows)("names a behaviour", (row) => {});',
        errors: [{ messageId: "foreignBlockSpelling" }],
        output: 'it.each(rows)("names a behaviour", (row) => {});',
      },
      {
        name: "a table written as a tagged template is reported at the same root",
        code: "test.each`a | b`;",
        errors: [{ messageId: "foreignBlockSpelling" }],
        output: "it.each`a | b`;",
      },
      {
        name: "a declaration that takes no callback is still a declaration",
        code: 'test.todo("names a behaviour");',
        errors: [{ messageId: "foreignBlockSpelling" }],
        output: 'it.todo("names a behaviour");',
      },
      {
        name: "a modifier written as a string subscript resolves to the same name",
        code: 'test["skip"]("names a behaviour", () => {});',
        errors: [{ messageId: "foreignBlockSpelling" }],
        output: 'it["skip"]("names a behaviour", () => {});',
      },
      {
        name: "a block nested in a grouping block is reported just the same",
        code: 'describe("names a group", () => {\n  test("names a behaviour", () => {});\n});',
        errors: [{ messageId: "foreignBlockSpelling" }],
        output: 'describe("names a group", () => {\n  it("names a behaviour", () => {});\n});',
      },
      {
        name: "each declaration in a file is reported on its own",
        code: 'test("names one behaviour", () => {});\ntest("names another", () => {});',
        errors: [{ messageId: "foreignBlockSpelling" }, { messageId: "foreignBlockSpelling" }],
        output: 'it("names one behaviour", () => {});\nit("names another", () => {});',
      },
      {
        name: "the required spelling is reported once the configuration names the other one",
        code: 'it("names a behaviour", () => {});',
        options: [{ blockSpelling: "test" }],
        errors: [{ messageId: "foreignBlockSpelling" }],
        output: 'test("names a behaviour", () => {});',
      },
      {
        name: "a block API renamed on import is reported at the binding",
        code: 'import { it as spec } from "vitest";\nspec("names a behaviour", () => {});',
        errors: [{ messageId: "foreignBlockBinding" }],
      },
      {
        name: "the other injected spelling renamed on import is reported at the binding too",
        code: 'import { test as spec } from "vite-plus/test";\nspec("names a behaviour", () => {});',
        errors: [{ messageId: "foreignBlockBinding" }],
      },
      {
        name: "a block API imported under a written out name is reported at the binding",
        code: 'import { "it" as spec } from "vitest";\nspec("names a behaviour", () => {});',
        errors: [{ messageId: "foreignBlockBinding" }],
      },
      {
        name: "a module named as the runner in the configuration hands over block APIs",
        code: 'import { it as spec } from "./runner.ts";\nspec("names a behaviour", () => {});',
        options: [{ runnerModules: ["./runner.ts"] }],
        errors: [{ messageId: "foreignBlockBinding" }],
      },
      {
        name: "a derived builder bound to another name is reported at the binding",
        code: 'const spec = test.extend({ subject: 1 });\nspec("names a behaviour", () => {});',
        errors: [{ messageId: "foreignBlockBinding" }],
      },
      {
        name: "a block API handed to another binding is reported at that binding",
        code: 'const spec = test;\nspec("names a behaviour", () => {});',
        errors: [{ messageId: "foreignBlockBinding" }],
      },
      {
        name: "a binding that reaches the runner through another binding is reported",
        code: 'const relay = test;\nconst spec = relay;\nspec("names a behaviour", () => {});',
        errors: [{ messageId: "foreignBlockBinding" }],
      },
      {
        name: "a binding holding a modified block is reported at the binding",
        code: 'const spec = test.only;\nspec("names a behaviour", () => {});',
        errors: [{ messageId: "foreignBlockBinding" }],
      },
    ],
  });
});
