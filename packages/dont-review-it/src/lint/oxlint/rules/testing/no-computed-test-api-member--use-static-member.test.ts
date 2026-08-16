import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { noComputedTestApiMember } from "./no-computed-test-api-member--use-static-member.ts";

describe("dont-review-it/no-computed-test-api-member--use-static-member", () => {
  testLintRule(noComputedTestApiMember, {
    valid: [
      {
        name: "a modifier written as a static member is the shape this rule asks for",
        documented: true,
        code: "it.skip('adds', () => {});",
      },
      {
        name: "the fixture builder written as a static member names itself",
        code: "const it = test.extend({ subject: async ({}, use) => use(runSut()) });",
      },
      {
        name: "a matcher written as a static member names itself",
        code: "expect(runSut()).toStrictEqual({ total: 1 });",
      },
      {
        name: "a subscript on a value the suite owns is outside this rule",
        documented: true,
        code: "it('adds', () => {\n  expect(runSut()[key]).toBe(1);\n});",
      },
      {
        name: "an element taken out of a table by index reaches no test API root",
        code: "const rows = [1, 2];\nit.each(rows)('adds %i', (row) => {});\nconst head = rows[0];",
      },
      {
        name: "a subscript on a fixture the callback took apart is outside this rule",
        code: "it('adds', ({ subject }) => {\n  expect(subject[field]).toBe(1);\n});",
      },
      {
        name: "a private field carries no subscript this rule can reach",
        code: "class Suite { #skip() { return this; } run() { return this.#skip(); } }",
      },
      {
        name: "a subscript behind a receiver never reaches an identifier root",
        code: "runner.it[member]('adds', () => {});",
      },
      {
        name: "a subscript on the return of a plain call reaches no test API root",
        code: "buildRunner()[member]('adds', () => {});",
      },
      {
        name: "a subscript on a binding taken apart from an object reaches no test API root",
        code: "const { it: check } = runner;\ncheck[member]('adds', () => {});",
      },
      {
        name: "a grouping block is not the test block API this rule covers",
        code: "describe[member]('a group', () => {});",
      },
      {
        name: "a subscript on a value written out in place reaches no identifier root",
        code: "const held = { skip: 1 }['skip'];",
      },
    ],
    invalid: [
      {
        name: "a modifier written out as a subscript is reported and rewritten as a static member",
        documented: true,
        code: "it['skip']('adds', () => {});",
        output: "it.skip('adds', () => {});",
        errors: [{ messageId: "spelledSubscript" }],
      },
      {
        name: "a modifier written as a template subscript carrying no expression is rewritten too",
        code: "it[`skip`]('adds', () => {});",
        output: "it.skip('adds', () => {});",
        errors: [{ messageId: "spelledSubscript" }],
      },
      {
        name: "a modifier settled by a binding at run time is reported without a rewrite",
        code: "it[member]('adds', () => {});",
        errors: [{ messageId: "unreadableSubscript" }],
      },
      {
        name: "a modifier assembled by a template is reported without a rewrite",
        code: "it[`sk${suffix}`]('adds', () => {});",
        errors: [{ messageId: "unreadableSubscript" }],
      },
      {
        name: "a subscript spelling something no static member can carry is reported without a rewrite",
        code: "it['skip me']('adds', () => {});",
        errors: [{ messageId: "spelledSubscript" }],
      },
      {
        name: "taking the member as a value without calling it carries the same defect",
        code: "const held = it['skip'];",
        output: "const held = it.skip;",
        errors: [{ messageId: "spelledSubscript" }],
      },
      {
        name: "the fixture builder written out as a subscript is reported and rewritten",
        code: "test['extend']({ subject: 1 });",
        output: "test.extend({ subject: 1 });",
        errors: [{ messageId: "spelledSubscript" }],
      },
      {
        name: "a matcher written out as a subscript is reported and rewritten",
        code: "expect(runSut())['toStrictEqual']({ total: 1 });",
        output: "expect(runSut()).toStrictEqual({ total: 1 });",
        errors: [{ messageId: "spelledSubscript" }],
      },
      {
        name: "a matcher settled at run time is reported without a rewrite",
        documented: true,
        code: "expect(runSut())[matcher]({ total: 1 });",
        errors: [{ messageId: "unreadableSubscript" }],
      },
      {
        name: "a subscript behind an assertion chain modifier stands on the same root",
        code: "expect(runSut()).not[matcher](1);",
        errors: [{ messageId: "unreadableSubscript" }],
      },
      {
        name: "a derived assertion receiver written out as a subscript is reported and rewritten",
        code: "expect['soft'](runSut()).toBe(1);",
        output: "expect.soft(runSut()).toBe(1);",
        errors: [{ messageId: "spelledSubscript" }],
      },
      {
        name: "a subscript reached through an optional member keeps the optional link",
        code: "it?.['skip']('adds', () => {});",
        output: "it?.skip('adds', () => {});",
        errors: [{ messageId: "spelledSubscript" }],
      },
      {
        name: "a subscript on a builder derived from the fixture base stands on the same root",
        code: "const check = test.extend({ subject: 1 });\ncheck['skip']('adds', () => {});",
        output: "const check = test.extend({ subject: 1 });\ncheck.skip('adds', () => {});",
        errors: [{ messageId: "spelledSubscript" }],
      },
      {
        name: "taking the test block API into another binding first changes no root",
        code: "const check = it;\ncheck[member]('adds', () => {});",
        errors: [{ messageId: "unreadableSubscript" }],
      },
      {
        name: "taking the assertion entry into another binding first changes no root",
        code: "const assertThat = expect;\nassertThat(runSut())[matcher](1);",
        errors: [{ messageId: "unreadableSubscript" }],
      },
      {
        name: "an import of the test block API under another name still stands on it",
        code: "import { it as check } from 'vitest';\ncheck[member]('adds', () => {});",
        errors: [{ messageId: "unreadableSubscript" }],
      },
      {
        name: "an import of the assertion entry under another name still stands on it",
        code: "import { expect as assertThat } from 'vitest';\nassertThat(runSut())[matcher](1);",
        errors: [{ messageId: "unreadableSubscript" }],
      },
      {
        name: "every subscript in a chain is reported at the step it sits on",
        code: "it[outer][inner]('adds', () => {});",
        errors: [{ messageId: "unreadableSubscript" }, { messageId: "unreadableSubscript" }],
      },
      {
        name: "a subscript behind a table driven call stands on the same root",
        code: "it.each(rows)('adds %i', (row) => {});\nit.each(rows)[member]('adds %i', (row) => {});",
        errors: [{ messageId: "unreadableSubscript" }],
      },
      {
        name: "a subscript behind a tagged template table stands on the same root",
        code: "it.each`\n  seed\n  ${1}\n`[member]('adds $seed', ({ seed }) => {});",
        errors: [{ messageId: "unreadableSubscript" }],
      },
      {
        name: "a subscript inside a grouping block is reported the same way",
        code: "describe('a group', () => {\n  it['skip']('adds', () => {});\n});",
        output: "describe('a group', () => {\n  it.skip('adds', () => {});\n});",
        errors: [{ messageId: "spelledSubscript" }],
      },
      {
        name: "a subscript on the test block API declared before the binding it stands on is still reported",
        code: "check['skip']('adds', () => {});\nconst check = it;",
        output: "check.skip('adds', () => {});\nconst check = it;",
        errors: [{ messageId: "spelledSubscript" }],
      },
    ],
  });
});
