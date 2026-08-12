import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { noExpectOutsideIt } from "./no-expect-outside-it--move-into-it-block.ts";

describe("dont-review-it/no-expect-outside-it--move-into-it-block", () => {
  testLintRule(noExpectOutsideIt, {
    valid: [
      {
        name: "an assertion in the body of the canonical test block is where the rule wants it",
        code: "it('adds', () => { expect(sum).toBe(3); });",
      },
      {
        name: "a modifier on the canonical test block keeps the root the rule reads",
        code: "it.skip('adds', () => { expect(sum).toBe(3); });",
      },
      {
        name: "a table driven block hands its rows to the same canonical root",
        code: "const rows = [1, 2];\nit.each(rows)('adds %i', (row) => { expect(row).toBe(1); });",
      },
      {
        name: "stacked modifiers still resolve to the canonical root",
        code: "it.skipIf(slow).concurrent('adds', () => { expect(sum).toBe(3); });",
      },
      {
        name: "an iteration callback inside the test block is walked through to the block around it",
        code: "it('adds', () => { rows.forEach((row) => { expect(row).toBe(1); }); });",
      },
      {
        name: "an assertion carrying no matcher is still an assertion standing in the right place",
        code: "it('adds', () => { expect(sum); });",
      },
      {
        name: "a derived receiver inside the test block is read as the same assertion entry",
        code: "it('adds', () => { expect.soft(sum).toBe(3); });",
      },
      {
        name: "registering a custom matcher is not an assertion",
        code: "expect.extend({ toBeReport });",
      },
      {
        name: "an assertion count declared inside the canonical block counts what that block runs",
        code: "it('adds', () => { expect.hasAssertions(); expect(sum).toBe(3); });",
      },
      {
        name: "an assertion count declared inside another runner spelling still stands in a test block",
        code: "test('adds', () => { expect.assertions(1); });",
      },
      {
        name: "a member of the assertion entry that counts nothing is not a count declaration",
        code: "expect.setState({ assertionCalls: 0 });",
      },
      {
        name: "a receiver reached through a subscript is not read as an assertion entry",
        code: "expect[chosen](sum).toBe(3);",
      },
      {
        name: "a derived receiver standing on a call is not read as an assertion entry",
        code: "buildExpect().soft(sum).toBe(3);",
      },
      {
        name: "a call that reaches neither the assertion entry nor a count declaration is left alone",
        code: "seedDatabase();",
      },
      {
        name: "a fixture factory bound to the canonical spelling declares canonical test blocks",
        code: "const it = test.extend({ subject: 1 });\nit('adds', ({ subject }) => { expect(subject).toBe(1); });",
      },
      {
        name: "a factory built up through repeated derivation still declares canonical test blocks",
        code: "const it = test.extend({ port: 1 }).extend({ subject: 2 });\nit('adds', ({ subject }) => { expect(subject).toBe(2); });",
      },
      {
        name: "the canonical spelling taken from the test runner declares canonical test blocks",
        code: "import { it } from 'vite-plus/test';\nit('adds', () => { expect(sum).toBe(3); });",
      },
      {
        name: "a configured spelling the runner injects under that name declares canonical test blocks",
        code: "spec('adds', () => { expect(sum).toBe(3); });",
        options: [{ blockSpelling: "spec" }],
      },
      {
        name: "a function declared without a name leaves the canonical spelling alone",
        code: "export default function () {}\nit('adds', () => { expect(sum).toBe(3); });",
      },
      {
        name: "a test block nested in a grouping block is still the block the assertion stands in",
        code: "describe('sums', () => { it('adds', () => { expect(sum).toBe(3); }); });",
      },
      {
        name: "an interpolated title names the block just as plainly as a written out one",
        code: "it(`adds ${label}`, () => { expect(sum).toBe(3); });",
      },
      {
        name: "an options object between the title and the callback does not hide the callback",
        code: "it('adds', { timeout: 1 }, () => { expect(sum).toBe(3); });",
      },
      {
        name: "a call taking no argument at all declares no block around the assertion",
        code: "it('adds', () => { expect(run()).toBe(3); });",
      },
      {
        name: "a call whose first argument is spread declares no block around the assertion",
        code: "it('adds', () => { expect(sum(...parts)).toBe(3); });",
      },
      {
        name: "a wrapper handed the callback of a canonical block keeps that block around the assertion",
        code: "it('adds', withFixture('seeded', () => { expect(sum).toBe(3); }));",
      },
      {
        name: "bindings the rule cannot read as a factory leave the block around the assertion alone",
        code: "const { total } = totals;\nlet pending;\nconst built = derive({ a: 1 });\nconst mapped = list.map(toRow);\nit('adds', () => { expect(total).toBe(3); });",
      },
      {
        name: "export forms the rule scans do not disturb an assertion standing in a canonical block",
        code: "export function helper() {}\nexport const { seed } = totals;\nexport { 'subject' as fixture } from './fixtures.ts';\nit('adds', () => { expect(seed).toBe(3); });",
      },
    ],
    invalid: [
      {
        name: "the alternate runner spelling is rewritten to the canonical one",
        code: "test('adds', () => { expect(sum).toBe(3); });",
        output: "it('adds', () => { expect(sum).toBe(3); });",
        errors: [{ messageId: "foreignTestBlockAssertion" }],
      },
      {
        name: "every assertion in the block is reported and the block root is rewritten once",
        code: "test('adds', () => { expect(sum).toBe(3); expect(rest).toBe(1); });",
        output: "it('adds', () => { expect(sum).toBe(3); expect(rest).toBe(1); });",
        errors: [
          { messageId: "foreignTestBlockAssertion" },
          { messageId: "foreignTestBlockAssertion" },
        ],
      },
      {
        name: "an options object with no spelling in it keeps the canonical spelling",
        code: "test('adds', () => { expect(sum).toBe(3); });",
        options: [{}],
        output: "it('adds', () => { expect(sum).toBe(3); });",
        errors: [{ messageId: "foreignTestBlockAssertion" }],
      },
      {
        name: "a configured spelling the runner does not inject is reported without a rewrite",
        code: "it('adds', () => { expect(sum).toBe(3); });",
        options: [{ blockSpelling: "spec" }],
        errors: [{ messageId: "foreignTestBlockAssertion" }],
      },
      {
        name: "a fixture factory bound to another name is renamed at its declaration and its reference",
        code: "const spec = test.extend({ subject: 1 });\nspec('adds', ({ subject }) => { expect(subject).toBe(1); });",
        output:
          "const it = test.extend({ subject: 1 });\nit('adds', ({ subject }) => { expect(subject).toBe(1); });",
        errors: [{ messageId: "foreignTestBlockAssertion" }],
      },
      {
        name: "a fixture factory imported under another name is reported without a rewrite",
        code: "import { it as check } from 'vite-plus/test';\ncheck('adds', () => { expect(sum).toBe(3); });",
        errors: [{ messageId: "foreignTestBlockAssertion" }],
      },
      {
        name: "a plain rebinding of the canonical spelling is reported without a rewrite",
        code: "const check = it;\ncheck('adds', () => { expect(sum).toBe(3); });",
        errors: [{ messageId: "foreignTestBlockAssertion" }],
      },
      {
        name: "a factory standing on the canonical spelling is reported without a rewrite",
        code: "const spec = it.extend({ subject: 1 });\nspec('adds', ({ subject }) => { expect(subject).toBe(1); });",
        errors: [{ messageId: "foreignTestBlockAssertion" }],
      },
      {
        name: "a factory reaching the canonical spelling through another factory keeps the rewrite off",
        code: "const base = it.extend({ a: 1 });\nconst spec = base.extend({ b: 2 });\nspec('adds', () => { expect(sum).toBe(3); });",
        errors: [{ messageId: "foreignTestBlockAssertion" }],
      },
      {
        name: "a scope already holding the canonical spelling keeps the rewrite off",
        code: "const it = test.extend({ a: 1 });\nconst spec = test.extend({ b: 2 });\nspec('adds', () => { expect(sum).toBe(3); });",
        errors: [{ messageId: "foreignTestBlockAssertion" }],
      },
      {
        name: "a factory the module exports through its declaration keeps the rewrite off",
        code: "export const spec = test.extend({ a: 1 });\nspec('adds', () => { expect(sum).toBe(3); });",
        errors: [{ messageId: "foreignTestBlockAssertion" }],
      },
      {
        name: "a factory the module exports through a specifier keeps the rewrite off",
        code: "const spec = test.extend({ a: 1 });\nspec('adds', () => { expect(sum).toBe(3); });\nexport { spec };",
        errors: [{ messageId: "foreignTestBlockAssertion" }],
      },
      {
        name: "an assertion written straight into a grouping block names no behaviour",
        code: "describe('sums', () => { expect(sum).toBe(3); });",
        errors: [{ messageId: "groupingBlockAssertion" }],
      },
      {
        name: "an assertion in a helper declared beside the suite stands in no block at all",
        code: "const check = (total) => { expect(total).toBe(3); };",
        errors: [{ messageId: "detachedAssertion" }],
      },
      {
        name: "an assertion in a hook stands in no block at all",
        code: "beforeEach(() => { expect(sum).toBe(3); });",
        errors: [{ messageId: "detachedAssertion" }],
      },
      {
        name: "an assertion in a fixture factory stands in no block at all",
        code: "const it = test.extend({ subject: async ({}, use) => { expect(seed).toBe(1); await use(seed); } });",
        errors: [{ messageId: "detachedAssertion" }],
      },
      {
        name: "a soft receiver at module scope is read as an assertion standing in no block",
        code: "expect.soft(sum).toBe(3);",
        errors: [{ messageId: "detachedAssertion" }],
      },
      {
        name: "a polling receiver at module scope is read as an assertion standing in no block",
        code: "expect.poll(() => sum).toBe(3);",
        errors: [{ messageId: "detachedAssertion" }],
      },
      {
        name: "assertions on either side of a test block stand outside it",
        code: "expect(before).toBe(1);\nit('adds', () => { expect(inside).toBe(2); });\nexpect(after).toBe(3);",
        errors: [{ messageId: "detachedAssertion" }, { messageId: "detachedAssertion" }],
      },
      {
        name: "a title that is not written out leaves the assertion standing in no block",
        code: "it(1, () => { expect(sum).toBe(3); });",
        errors: [{ messageId: "detachedAssertion" }],
      },
      {
        name: "a block reached through a receiver is not a test block declaration",
        code: "suite.test('adds', () => { expect(sum).toBe(3); });",
        errors: [{ messageId: "detachedAssertion" }],
      },
      {
        name: "an assertion entry taken from the runner under another name is still the entry",
        code: "import { expect as check } from 'vite-plus/test';\ndescribe('sums', () => { check(sum).toBe(3); });",
        errors: [{ messageId: "groupingBlockAssertion" }],
      },
      {
        name: "an assertion entry bound to another name in the file is still the entry",
        code: "const check = expect;\ncheck(sum).toBe(3);",
        errors: [{ messageId: "detachedAssertion" }],
      },
      {
        name: "a derived receiver on a renamed assertion entry is still the entry",
        code: "import { expect as check } from 'vite-plus/test';\ncheck.soft(sum).toBe(3);",
        errors: [{ messageId: "detachedAssertion" }],
      },
      {
        name: "an assertion count declared at module scope counts assertions no block runs",
        code: "expect.hasAssertions();",
        errors: [{ messageId: "strayAssertionCount" }],
      },
      {
        name: "an assertion count declared in a grouping block counts assertions that block never runs",
        code: "describe('sums', () => { expect.assertions(2); });",
        errors: [{ messageId: "strayAssertionCount" }],
      },
      {
        name: "a block declared through a locally written function of the canonical spelling runs no test",
        code: "const it = (title, body) => body();\nit('adds', () => { expect(sum).toBe(3); });",
        errors: [{ messageId: "shadowedTestBlockAssertion" }],
      },
      {
        name: "a function declaration taking the canonical spelling declares no test block",
        code: "function it(title, body) { body(); }\nit('adds', () => { expect(sum).toBe(3); });",
        errors: [{ messageId: "shadowedTestBlockAssertion" }],
      },
      {
        name: "the canonical spelling filled by a plain call reaches no runner block",
        code: "const it = buildRunner();\nit('adds', () => { expect(sum).toBe(3); });",
        errors: [{ messageId: "shadowedTestBlockAssertion" }],
      },
      {
        name: "the canonical spelling bound to a grouping block declares no test block",
        code: "const it = describe;\nit('adds', () => { expect(sum).toBe(3); });",
        errors: [{ messageId: "shadowedTestBlockAssertion" }],
      },
      {
        name: "the canonical spelling taken from a module that is no test runner declares no test block",
        code: "import { it } from './runner.ts';\nit('adds', () => { expect(sum).toBe(3); });",
        errors: [{ messageId: "shadowedTestBlockAssertion" }],
      },
      {
        name: "another runner spelling bound to a locally written function declares no test block",
        code: "const test = (title, body) => body();\ntest('adds', () => { expect(sum).toBe(3); });",
        errors: [{ messageId: "groupingBlockAssertion" }],
      },
    ],
  });
});
