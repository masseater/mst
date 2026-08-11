import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { noModuleScopeMockConfig } from "./no-module-scope-mock-config--lift-into-fixture.ts";

const SPEC_FILENAME = "mailer.test.ts";

const SOURCE_FILENAME = "mailer.ts";

describe("dont-review-it/no-module-scope-mock-config--lift-into-fixture", () => {
  testLintRule(noModuleScopeMockConfig, {
    valid: [
      {
        name: "a mock built inside the fixture that hands it back is the shape this rule keeps",
        code: "const it = test.extend('sendMail', () => vi.fn());",
        filename: SPEC_FILENAME,
      },
      {
        name: "what the mock does, settled inside the fixture body, is applied for each test on its own",
        code: "const it = test.extend('sendMail', () => {\n  const sendMail = vi.fn();\n  sendMail.mockResolvedValue({ accepted: 1 });\n  return sendMail;\n});",
        filename: SPEC_FILENAME,
      },
      {
        name: "the handoff form of a fixture holds the mock in its body just the same",
        code: "const it = test.extend({ sendMail: async ({}, use) => use(vi.fn().mockReturnValue(1)) });",
        filename: SPEC_FILENAME,
      },
      {
        name: "the scoped handoff form keeps the fixture function at the head of the array",
        code: "const it = test.extend({ sendMail: [async ({}, use) => use(vi.fn()), { auto: true }] });",
        filename: SPEC_FILENAME,
      },
      {
        name: "an options object between the name and the fixture function leaves the function last",
        code: "const it = test.extend('sendMail', { auto: true }, () => vi.spyOn(mailer, 'send'));",
        filename: SPEC_FILENAME,
      },
      {
        name: "a fixture standing on a renamed import of the builder is still a fixture",
        code: "import { test as baseTest } from 'vite-plus/test';\nconst it = baseTest.extend('sendMail', () => vi.fn());",
        filename: SPEC_FILENAME,
      },
      {
        name: "a fixture derived from another fixture keeps the builder at the root of the chain",
        code: "const base = test.extend('mailer', () => mailer);\nconst it = base.extend('sendMail', () => vi.fn());",
        filename: SPEC_FILENAME,
      },
      {
        name: "a chain of builders written in one expression is rooted at the builder too",
        code: "const it = test.extend('mailer', () => mailer).extend('sendMail', () => vi.fn());",
        filename: SPEC_FILENAME,
      },
      {
        name: "a fixture standing on the test block spelling is a fixture as far as this rule reads it",
        code: "const check = it.extend('sendMail', () => vi.fn());",
        filename: SPEC_FILENAME,
      },
      {
        name: "the factory of a module replacement declaration may hold the mock it stands up",
        code: "vi.mock('./mailer.ts', () => ({ send: vi.fn().mockResolvedValue({ accepted: 1 }) }));",
        filename: SPEC_FILENAME,
      },
      {
        name: "a deferred module replacement declaration carries the same allowance",
        code: "vi.doMock('./mailer.ts', () => ({ send: vi.fn() }));",
        filename: SPEC_FILENAME,
      },
      {
        name: "a module replacement declaration naming only the module declares structure and nothing else",
        code: "vi.mock('./mailer.ts');\nvi.mock('./queue.ts', { spy: true });",
        filename: SPEC_FILENAME,
      },
      {
        name: "clearing the call record belongs to the rule that forbids writing cleanup at all",
        code: "sendMail.mockClear();\nsendMail.mockReset();\nsendMail.mockRestore();",
        filename: SPEC_FILENAME,
      },
      {
        name: "the bulk cleanup calls on the namespace are outside what this rule reads",
        code: "vi.clearAllMocks();\nvi.resetAllMocks();\nvi.restoreAllMocks();\nvi.unstubAllGlobals();\nvi.unstubAllEnvs();",
        filename: SPEC_FILENAME,
      },
      {
        name: "a private member carrying a setting name is a different member",
        code: "class Stub { #mockReturnValue() { return this; } stand() { return this.#mockReturnValue(); } }",
        filename: SPEC_FILENAME,
      },
      {
        name: "a subscript on a receiver that never reaches a mock names nothing this rule can read",
        code: "const totals = buildTotals();\ntotals[member](1);",
        filename: SPEC_FILENAME,
      },
      {
        name: "a creation member on a receiver other than the mock namespace is another API",
        code: "const watcher = helpers.spyOn(mailer, 'send');",
        filename: SPEC_FILENAME,
      },
      {
        name: "the creation member taken as a value without calling it stands up nothing",
        code: "const build = vi.fn;",
        filename: SPEC_FILENAME,
      },
      {
        name: "a file that declares no tests is outside the scope this rule reads",
        code: "const sendMail = vi.fn();\nsendMail.mockReturnValue(1);",
        filename: SOURCE_FILENAME,
      },
      {
        name: "a fixture declared inside a grouping block is still a fixture body",
        code: "describe('mailer', () => {\n  const it = test.extend('sendMail', () => vi.fn());\n});",
        filename: SPEC_FILENAME,
      },
    ],
    invalid: [
      {
        name: "a mock built at module scope is one instance every test in the file shares",
        code: "const sendMail = vi.fn();",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "mockCreationOutsideFixture" }],
      },
      {
        name: "replacing a method on a real object at module scope shares that replacement too",
        code: "const sendMail = vi.spyOn(mailer, 'send');",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "mockCreationOutsideFixture" }],
      },
      {
        name: "taking a replaced import as a mock at module scope is the same acquisition",
        code: "const mocked = vi.mocked(mailer);",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "mockCreationOutsideFixture" }],
      },
      {
        name: "what the mock does, settled at module scope, is left standing for the next test",
        code: "sendMail.mockReturnValue({ accepted: 1 });",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "mockBehaviorOutsideFixture" }],
      },
      {
        name: "a setting written in the body of a grouping block is shared by the blocks it holds",
        code: "describe('mailer', () => {\n  sendMail.mockResolvedValue({ accepted: 1 });\n});",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "mockBehaviorOutsideFixture" }],
      },
      {
        name: "a hoisted container is not a fixture, so the instance it holds is still shared",
        code: "const held = vi.hoisted(() => ({ sendMail: vi.fn() }));",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "mockCreationOutsideFixture" }],
      },
      {
        name: "a setting written in the body of a test block buries what the test verifies",
        code: "it('accepts the address', () => {\n  sendMail.mockReturnValue(1);\n  expect(sendMail).toHaveBeenCalled();\n});",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "mockBehaviorOutsideFixture" }],
      },
      {
        name: "a setting written in a setup hook is outside the fixture just as plainly",
        code: "beforeEach(() => {\n  sendMail.mockResolvedValue({ accepted: 1 });\n});",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "mockBehaviorOutsideFixture" }],
      },
      {
        name: "building and settling in one chain is one defect reported at the outermost call",
        code: "const sendMail = vi.fn().mockReturnValue({ accepted: 1 });",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "mockBehaviorOutsideFixture" }],
      },
      {
        name: "a chain reaching through a member of the replaced module is reported once as well",
        code: "vi.mocked(mailer).send.mockResolvedValue({ accepted: 1 });",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "mockBehaviorOutsideFixture" }],
      },
      {
        name: "every setting in a chain of settings collapses to the outermost call",
        code: "vi.fn().mockReturnValue(1).mockReturnValueOnce(2);",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "mockBehaviorOutsideFixture" }],
      },
      {
        name: "the namespace imported under another name is the same namespace",
        code: "import { vi as runner } from 'vite-plus/test';\nconst sendMail = runner.fn();",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "mockCreationOutsideFixture" }],
      },
      {
        name: "the namespace bound to another name is followed back to the namespace",
        code: "const runner = vi;\nconst sendMail = runner.fn();",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "mockCreationOutsideFixture" }],
      },
      {
        name: "the namespace reached through a whole module import is the same namespace",
        code: "import * as runner from 'vite-plus/test';\nconst sendMail = runner.vi.fn();",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "mockCreationOutsideFixture" }],
      },
      {
        name: "a written out subscript names the creation member just as plainly",
        code: "const sendMail = vi['fn']();",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "mockCreationOutsideFixture" }],
      },
      {
        name: "a template subscript carrying no substitution names the setting member too",
        code: "sendMail[`mockReturnValue`](1);",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "mockBehaviorOutsideFixture" }],
      },
      {
        name: "a subscript that only settles at run time on the namespace is still reported",
        code: "const sendMail = vi[member]();",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "subscriptedMockWriting" }],
      },
      {
        name: "a subscript that only settles at run time on a mock binding is reported as well",
        code: "const sendMail = vi.fn();\nsendMail[member](1);",
        filename: SPEC_FILENAME,
        errors: [
          { messageId: "mockCreationOutsideFixture" },
          { messageId: "subscriptedMockWriting" },
        ],
      },
      {
        name: "the options object handed to the builder is not the body of the fixture function",
        code: "const it = test.extend('sendMail', { timeout: vi.fn() }, () => mailer);",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "mockCreationOutsideFixture" }],
      },
      {
        name: "a builder member on an unrelated API opens no fixture body",
        code: "const total = schema.extend({ amount: () => vi.fn() });",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "mockCreationOutsideFixture" }],
      },
      {
        name: "a setting member on a receiver this rule cannot follow is reported on the name alone",
        code: "builder.mockReturnValue(1);",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "mockBehaviorOutsideFixture" }],
      },
      {
        name: "an implementation handed to the mock outside a fixture is a setting like any other",
        code: "sendMail.mockImplementation(() => ({ accepted: 1 }));\nsendMail.mockImplementationOnce(() => ({ accepted: 2 }));",
        filename: SPEC_FILENAME,
        errors: [
          { messageId: "mockBehaviorOutsideFixture" },
          { messageId: "mockBehaviorOutsideFixture" },
        ],
      },
      {
        name: "the module replacement factory allows what it holds, not what stands beside it",
        code: "vi.mock('./mailer.ts', () => ({ send: vi.fn() }));\nconst queued = vi.fn();",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "mockCreationOutsideFixture" }],
      },
    ],
  });
});
