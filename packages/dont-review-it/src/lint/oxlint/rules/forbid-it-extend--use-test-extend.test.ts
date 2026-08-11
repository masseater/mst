import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { forbidItExtend } from "./forbid-it-extend--use-test-extend.ts";

describe("dont-review-it/forbid-it-extend--use-test-extend", () => {
  testLintRule(forbidItExtend, {
    valid: [
      {
        name: "the fixture factory standing on test is the shape this rule asks for",
        code: "const it = test.extend({ subject: async ({}, use) => use(runSut()) });",
      },
      {
        name: "a modifier on the test block spelling is not the fixture builder",
        code: "it.skip('adds', () => {});",
      },
      {
        name: "the test block spelling called on its own declares a test block",
        code: "it('adds', () => {});",
      },
      {
        name: "a receiver in front of the test block spelling is a different value",
        code: "runner.it.extend({});",
      },
      {
        name: "a chained builder stands on a call, not on the test block spelling",
        code: "test.extend({ a: 1 }).extend({ b: 2 });",
      },
      {
        name: "registering a custom matcher stands on the assertion entry",
        code: "expect.extend({ toBeReport });",
      },
      {
        name: "a private field carrying the builder name is out of reach",
        code: "class Suite { #extend() { return this; } run() { return this.#extend(); } }",
      },
      {
        name: "a subscript that only settles at run time names nothing this rule can read",
        code: "it[member]({});",
      },
      {
        name: "a subscript built from an expression names nothing this rule can read",
        code: "it[`ext${suffix}`]({});",
      },
      {
        name: "a fixture derived from the test base keeps the base it was derived from",
        code: "const it = test.extend({ a: 1 });\nit.extend({ b: 2 });",
      },
      {
        name: "an import that renames the fixture base onto the test block spelling still stands on the base",
        code: "import { test as it } from 'vite-plus/test';\nit.extend({ a: 1 });",
      },
      {
        name: "a binding declared without an initializer leads nowhere",
        code: "let check;\ncheck.extend({});",
      },
      {
        name: "a default import is not the named test block API",
        code: "import it from 'vite-plus/test';\nit.extend({});",
      },
      {
        name: "a parameter carrying the test block spelling is whatever the caller handed in",
        code: "const derive = (it) => it.extend({});",
      },
      {
        name: "a binding initialized from itself never reaches a spelling",
        code: "const it = it;\nit.extend({});",
      },
      {
        name: "a builder on a value the suite owns is outside this rule",
        code: "const schema = buildSchema();\nschema.extend({ total: 1 });",
      },
      {
        name: "a binding the language provides has no declaration to follow",
        code: "function derive() { return arguments.extend; }",
      },
      {
        name: "a member other than the builder on the test block spelling is left alone",
        code: "it.each([1, 2])('adds %i', () => {});",
      },
    ],
    invalid: [
      {
        name: "the fixture builder on the test block spelling is reported and rewritten onto the base",
        code: "it.extend({ subject: async ({}, use) => use(runSut()) });",
        output: "test.extend({ subject: async ({}, use) => use(runSut()) });",
        errors: [{ messageId: "itExtend" }],
      },
      {
        name: "taking the builder as a value without calling it carries the same defect",
        code: "const derive = it.extend;",
        output: "const derive = test.extend;",
        errors: [{ messageId: "itExtend" }],
      },
      {
        name: "a written out subscript names the builder just as plainly",
        code: "it['extend']({ a: 1 });",
        errors: [{ messageId: "itExtend" }],
      },
      {
        name: "a template subscript carrying no expression names the builder too",
        code: "it[`extend`]({ a: 1 });",
        errors: [{ messageId: "itExtend" }],
      },
      {
        name: "an import of the test block API under another name still stands on it",
        code: "import { it as check } from 'vite-plus/test';\ncheck.extend({ a: 1 });",
        errors: [{ messageId: "itExtend" }],
      },
      {
        name: "an imported test block spelling with no fixture base beside it is reported without a rewrite",
        code: "import { it } from 'vite-plus/test';\nit.extend({ a: 1 });",
        errors: [{ messageId: "itExtend" }],
      },
      {
        name: "an imported test block spelling is rewritten onto the fixture base the file already holds",
        code: "import { it, test } from 'vite-plus/test';\nit.extend({ a: 1 });",
        output: "import { it, test } from 'vite-plus/test';\ntest.extend({ a: 1 });",
        errors: [{ messageId: "itExtend" }],
      },
      {
        name: "an import written with a string module export name resolves the same way",
        code: "import { 'it' as check } from 'vite-plus/test';\ncheck.extend({ a: 1 });",
        errors: [{ messageId: "itExtend" }],
      },
      {
        name: "a rebinding of the test block spelling is followed to the spelling it came from",
        code: "const check = it;\ncheck.extend({ a: 1 });",
        errors: [{ messageId: "itExtend" }],
      },
      {
        name: "a rebinding chain is followed through every step",
        code: "const check = it;\nconst derived = check;\nderived.extend({ a: 1 });",
        errors: [{ messageId: "itExtend" }],
      },
      {
        name: "an import of the test block API keeps its spelling through a rebinding",
        code: "import { it } from 'vite-plus/test';\nconst check = it;\ncheck.extend({ a: 1 });",
        errors: [{ messageId: "itExtend" }],
      },
      {
        name: "a chain reports once at the base it stands on",
        code: "it.extend({ a: 1 }).extend({ b: 2 });",
        output: "test.extend({ a: 1 }).extend({ b: 2 });",
        errors: [{ messageId: "itExtend" }],
      },
      {
        name: "a grouping block around the builder changes nothing",
        code: "describe('suite', () => {\n  const derive = it.extend({ a: 1 });\n});",
        output: "describe('suite', () => {\n  const derive = test.extend({ a: 1 });\n});",
        errors: [{ messageId: "itExtend" }],
      },
      {
        name: "reaching the builder through an optional member is the same base",
        code: "it?.extend({ a: 1 });",
        output: "test?.extend({ a: 1 });",
        errors: [{ messageId: "itExtend" }],
      },
    ],
  });
});
