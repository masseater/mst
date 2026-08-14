import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { noModuleScopeMutableState } from "./no-module-scope-mutable-state--lift-into-fixture.ts";

const SPEC_FILENAME = "ledger.test.ts";

const SOURCE_FILENAME = "ledger.ts";

describe("dont-review-it/no-module-scope-mutable-state--lift-into-fixture", () => {
  testLintRule(noModuleScopeMutableState, {
    valid: [
      {
        name: "state built inside the fixture and handed back is the shape this rule keeps",
        documented: true,
        code: "const it = test.extend('entries', () => {\n  const entries = [];\n  entries.push('opening');\n  return entries;\n});",
        filename: SPEC_FILENAME,
      },
      {
        name: "the subject a test receives as a parameter belongs to that test alone",
        code: "it('records the entry', ({ entries }) => {\n  entries.push('closing');\n  expect(entries).toStrictEqual(['closing']);\n});",
        filename: SPEC_FILENAME,
      },
      {
        name: "state declared inside the test block is created again for every run of it",
        code: "it('records the entry', () => {\n  const entries = [];\n  entries.push('closing');\n  expect(entries).toStrictEqual(['closing']);\n});",
        filename: SPEC_FILENAME,
      },
      {
        name: "a module scope value that tests only read is not shared state anybody writes",
        documented: true,
        code: "const opening = ['a', 'b'];\nit('counts what it was given', () => {\n  expect(!opening.length).toBe(false);\n});",
        filename: SPEC_FILENAME,
      },
      {
        name: "a frozen module scope value read from a test stays outside what this rule reads",
        code: "const rates = Object.freeze({ standard: 1 });\nit('reads the rate', () => {\n  expect(rates.standard).toBe(1);\n});",
        filename: SPEC_FILENAME,
      },
      {
        name: "a module scope binding settled at the top level and never touched by a test is left alone",
        code: "let total = 0;\ntotal = 3;\nit('reads the total', () => {\n  expect(total).toBe(3);\n});",
        filename: SPEC_FILENAME,
      },
      {
        name: "standing a mock up on an imported object belongs to the rule on where mocks are written",
        code: "import { mailer } from './mailer.ts';\nconst it = test.extend('sendMail', () => {\n  mailer.send = vi.fn();\n  return mailer.send;\n});",
        filename: SPEC_FILENAME,
      },
      {
        name: "settling what a module scope mock does is read by the rule on where mocks are written",
        code: "const sendMail = vi.fn();\nit('sends once', () => {\n  sendMail.mockReturnValue(1);\n  expect(sendMail()).toBe(1);\n});",
        filename: SPEC_FILENAME,
      },
      {
        name: "a write standing outside every fixture, test block and setup hook is not read here",
        code: "const entries = [];\nentries.push('opening');\nit('reads the entry', () => {\n  expect(entries).toStrictEqual(['opening']);\n});",
        filename: SPEC_FILENAME,
      },
      {
        name: "a write inside the describe body is not a write from inside a test either",
        code: "describe('ledger', () => {\n  const entries = [];\n  entries.push('opening');\n  it('reads the entry', () => {\n    expect(entries).toStrictEqual(['opening']);\n  });\n});",
        filename: SPEC_FILENAME,
      },
      {
        name: "a value a fixture builds and a test writes into came from that test's own fixture",
        code: "const it = test.extend('ledger', () => ({ entries: [] }));\nit('records the entry', ({ ledger }) => {\n  ledger.entries.push('closing');\n  expect(ledger.entries).toStrictEqual(['closing']);\n});",
        filename: SPEC_FILENAME,
      },
      {
        name: "a method that changes nothing is not a write however the receiver was declared",
        code: "const entries = ['a'];\nit('reads the entries', () => {\n  expect(entries.filter((entry) => entry !== 'b')).toStrictEqual(['a']);\n});",
        filename: SPEC_FILENAME,
      },
      {
        name: "a file that is not a test declaration file is outside the reach of this rule",
        code: "const entries = [];\nit('records the entry', () => {\n  entries.push('closing');\n});",
        filename: SOURCE_FILENAME,
      },
      {
        name: "a value this file never declares is not state this file placed outside its tests",
        code: "it('registers the entry', () => {\n  globalLedger.entries.push('closing');\n  expect(globalLedger.entries).toStrictEqual(['closing']);\n});",
        filename: SPEC_FILENAME,
      },
      {
        name: "a property written on what a call returned reaches no binding this file declares",
        code: "import { openLedger } from './ledger.ts';\nit('counts the call', () => {\n  openLedger().calls = 1;\n  expect(openLedger().calls).toBe(1);\n});",
        filename: SPEC_FILENAME,
      },
      {
        name: "an element pushed onto what a call returned reaches no binding this file declares",
        code: "import { openLedger } from './ledger.ts';\nit('records the entry', () => {\n  openLedger().entries.push('closing');\n  expect(openLedger().entries).toStrictEqual(['closing']);\n});",
        filename: SPEC_FILENAME,
      },
      {
        name: "a deletion that names no property reaches no binding this file declares",
        code: "import { openLedger } from './ledger.ts';\nit('drops the ledger', () => {\n  delete openLedger();\n  expect(openLedger()).toBeDefined();\n});",
        filename: SPEC_FILENAME,
      },
      {
        name: "a deletion through what a call returned reaches no binding this file declares",
        code: "import { openLedger } from './ledger.ts';\nit('drops the rate', () => {\n  delete openLedger().standard;\n  expect(openLedger()).toBeDefined();\n});",
        filename: SPEC_FILENAME,
      },
      {
        name: "a binding this file takes from another module is not one this rule reads for reassignment",
        code: "import { total } from './totals.ts';\nit('takes the total', () => {\n  total = 1;\n  expect(total).toBe(1);\n});",
        filename: SPEC_FILENAME,
      },
      {
        name: "a declaration that cannot be rebound is outside the reassignment this rule reads",
        code: "const calls = 0;\nit('counts the call', () => {\n  calls = 1;\n  expect(calls).toBe(1);\n});",
        filename: SPEC_FILENAME,
      },
    ],
    invalid: [
      {
        name: "a module scope let reassigned from the test block is one counter for the whole file",
        documented: true,
        code: "let calls = 0;\nit('counts the call', () => {\n  calls = calls + 1;\n  expect(calls).toBe(1);\n});",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "sharedBindingRebound" }],
      },
      {
        name: "an update on a module scope let is a reassignment written in shorter form",
        code: "let calls = 0;\nit('counts the call', () => {\n  calls += 1;\n  expect(calls).toBe(1);\n});",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "sharedBindingRebound" }],
      },
      {
        name: "an increment on a module scope let is read the same way",
        code: "let calls = 0;\nit('counts the call', () => {\n  calls++;\n  expect(calls).toBe(1);\n});",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "sharedBindingRebound" }],
      },
      {
        name: "a destructured assignment onto a module scope let carries the same reassignment",
        code: "let head = '';\nit('takes the head', () => {\n  [head] = ['a'];\n  expect(head).toBe('a');\n});",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "sharedBindingRebound" }],
      },
      {
        name: "pushing onto a module scope array from the fixture leaves the element behind",
        code: "const entries = [];\nconst it = test.extend('ledger', () => {\n  entries.push('opening');\n  return entries;\n});",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "sharedValueChangedByCall" }],
      },
      {
        name: "wrapping the counter in a const object keeps the single instance the file shares",
        documented: true,
        code: "const held = { calls: 0 };\nit('counts the call', () => {\n  held.calls += 1;\n  expect(held.calls).toBe(1);\n});",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "sharedValueWritten" }],
      },
      {
        name: "a property parked in a hoisted container is still one property for the whole file",
        code: "const held = vi.hoisted(() => ({ entries: [] }));\nit('records the entry', () => {\n  held.entries.push('closing');\n  expect(held.entries).toStrictEqual(['closing']);\n});",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "sharedValueChangedByCall" }],
      },
      {
        name: "state declared in the describe body and written in the test is shared by its tests",
        code: "describe('ledger', () => {\n  const held = { calls: 0 };\n  it('counts the call', () => {\n    held.calls = 1;\n    expect(held.calls).toBe(1);\n  });\n});",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "sharedValueWritten" }],
      },
      {
        name: "a setter standing in front of the write does not change where the value lives",
        code: "const held = { set calls(given) {} };\nit('counts the call', () => {\n  held.calls = 1;\n  expect(held).toBeDefined();\n});",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "sharedValueWritten" }],
      },
      {
        name: "deleting a property of a module scope value takes it away for every later test",
        code: "const rates = { standard: 1 };\nit('drops the rate', () => {\n  delete rates.standard;\n  expect(rates).toStrictEqual({});\n});",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "sharedValueWritten" }],
      },
      {
        name: "writing through a computed index needs no readable name to change the value",
        code: "const entries = ['a'];\nit('replaces the entry', () => {\n  entries[0] = 'b';\n  expect(entries).toStrictEqual(['b']);\n});",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "sharedValueWritten" }],
      },
      {
        name: "moving the declaration into another module leaves the sharing where it was",
        code: "import { entries } from './entries.ts';\nit('records the entry', () => {\n  entries.push('closing');\n  expect(entries).toStrictEqual(['closing']);\n});",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "sharedValueChangedByCall" }],
      },
      {
        name: "a setup hook is inside a test as far as the placement of the write goes",
        code: "const held = { calls: 0 };\nbeforeEach(() => {\n  held.calls = 0;\n});",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "sharedValueWritten" }],
      },
      {
        name: "a setup hook imported under another name is read as the hook it names",
        code: "import { beforeEach as prepare } from 'vite-plus/test';\nconst held = { calls: 0 };\nprepare(() => {\n  held.calls = 0;\n});",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "sharedValueWritten" }],
      },
      {
        name: "an entry written into a module scope map is read for the whole file afterwards",
        code: "const registry = new Map();\nit('registers the entry', () => {\n  registry.set('a', 1);\n  expect(registry.get('a')).toBe(1);\n});",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "sharedValueChangedByCall" }],
      },
      {
        name: "a subscript spelled out in full is read as the method it names",
        code: "const entries = [];\nit('records the entry', () => {\n  entries['push']('closing');\n  expect(entries).toStrictEqual(['closing']);\n});",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "sharedValueChangedByCall" }],
      },
      {
        name: "a module scope var carries the same sharing a let does",
        code: "var calls = 0;\nit('counts the call', () => {\n  calls = 1;\n  expect(calls).toBe(1);\n});",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "sharedBindingRebound" }],
      },
      {
        name: "a non null assertion in front of the target loosens the type and nothing else",
        code: "let calls = 0;\nit('counts the call', () => {\n  calls! = 1;\n  expect(calls).toBe(1);\n});",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "sharedBindingRebound" }],
      },
      {
        name: "an object pattern on the left of the assignment names the same shared binding",
        code: "let head = '';\nit('takes the head', () => {\n  ({ head } = { head: 'a' });\n  expect(head).toBe('a');\n});",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "sharedBindingRebound" }],
      },
      {
        name: "a rest element on the left of the assignment names the same shared binding",
        code: "let rest = [];\nit('takes the rest', () => {\n  [...rest] = ['a'];\n  expect(rest).toStrictEqual(['a']);\n});",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "sharedBindingRebound" }],
      },
      {
        name: "a default on the left of the assignment names the same shared binding",
        code: "let head = '';\nit('takes the head', () => {\n  [head = 'a'] = [];\n  expect(head).toBe('a');\n});",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "sharedBindingRebound" }],
      },
      {
        name: "a hole in the pattern skips a position and leaves the named binding shared",
        code: "let head = '';\nit('takes the head', () => {\n  [, head] = ['a', 'b'];\n  expect(head).toBe('b');\n});",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "sharedBindingRebound" }],
      },
      {
        name: "a binding reached through a whole module import is declared outside every test too",
        code: "import * as ledger from './ledger.ts';\nit('records the entry', () => {\n  ledger.entries.push('closing');\n  expect(ledger.entries).toStrictEqual(['closing']);\n});",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "sharedValueChangedByCall" }],
      },
      {
        name: "a fixture standing on a value rather than a function leaves the state where it was",
        code: "const held = { calls: 0 };\nconst check = test.extend('ledger', held);\ncheck('counts the call', () => {\n  held.calls = 1;\n  expect(held.calls).toBe(1);\n});",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "sharedValueWritten" }],
      },
    ],
  });
});
