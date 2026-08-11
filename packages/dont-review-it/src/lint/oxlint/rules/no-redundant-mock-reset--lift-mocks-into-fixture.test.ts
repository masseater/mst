import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { noRedundantMockReset } from "./no-redundant-mock-reset--lift-mocks-into-fixture.ts";

const SPEC_FILE = "send-mail.test.ts";

const SETUP_FILE = "runner-setup.ts";

describe("dont-review-it/no-redundant-mock-reset--lift-mocks-into-fixture", () => {
  testLintRule(noRedundantMockReset, {
    valid: [
      {
        name: "a fixture handing a mock binding to the test carries no cleanup of its own",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("sendMail", () => vi.fn());\ntest("addresses the recipient", ({ sendMail }) => {\n  expect(sendMail).toHaveBeenCalledWith("a@example.com");\n});',
      },
      {
        name: "giving a mock a return value is left to the reading that places mock setup",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("sendMail", () => {\n  const sendMail = vi.fn();\n  sendMail.mockReturnValue("id");\n  return sendMail;\n});',
      },
      {
        name: "putting a global in place is not the release of one",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("clock", () => {\n  vi.stubGlobal("Date", frozenClock);\n  return frozenClock;\n});',
      },
      {
        name: "putting an environment variable in place is not the release of one",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("region", () => {\n  vi.stubEnv("REGION", "north");\n  return "north";\n});',
      },
      {
        name: "a bulk name on an object that never reaches the namespace stays untouched",
        filename: SPEC_FILE,
        code: "const recorder = { clearAllMocks: () => undefined };\nrecorder.clearAllMocks();",
      },
      {
        name: "a bulk name destructured from an object that never reaches the namespace",
        filename: SPEC_FILE,
        code: "const recorder = { clearAllMocks: () => undefined };\nconst { clearAllMocks } = recorder;",
      },
      {
        name: "a namespace member outside the cleanup vocabulary stays untouched",
        filename: SPEC_FILE,
        code: "vi.resetModules();",
      },
      {
        name: "asking whether a cleanup member exists never runs it",
        filename: SPEC_FILE,
        code: 'const sendMail = vi.fn();\nconst callable = typeof sendMail.mockClear === "function";',
      },
      {
        name: "a cleanup member named inside a type annotation never runs",
        filename: SPEC_FILE,
        code: "let release: typeof vi.clearAllMocks;",
      },
      {
        name: "a cleanup name reached through a parent class is another member",
        filename: SPEC_FILE,
        code: "class Recorder extends BaseRecorder {\n  finish() {\n    super.mockClear();\n  }\n}",
      },
      {
        name: "a cleanup name written as a private member is another member",
        filename: SPEC_FILE,
        code: "class Recorder {\n  #mockClear() {}\n  finish() {\n    this.#mockClear();\n  }\n}",
      },
      {
        name: "a computed key on a receiver that reaches neither a mock nor the namespace",
        filename: SPEC_FILE,
        code: "const recorder = buildRecorder();\nrecorder[named]();",
      },
      {
        name: "a bulk name taken as a value off an object that never reaches the namespace",
        filename: SPEC_FILE,
        code: "const recorder = buildRecorder();\nconst release = recorder.clearAllMocks;",
      },
      {
        name: "a computed key on a binding declared in another module reaches neither",
        filename: SPEC_FILE,
        code: 'import { sendMail } from "./mailer.ts";\nsendMail[named]();',
      },
      {
        name: "a computed key on a binding built by a call outside the mock factories",
        filename: SPEC_FILE,
        code: "const recorder = mailer.build();\nrecorder[named]();",
      },
      {
        name: "a computed key on a binding built by a factory reached through a computed key",
        filename: SPEC_FILE,
        code: "const recorder = mailer[built]();\nrecorder[named]();",
      },
      {
        name: "a computed key on a binding declared without an initialiser reaches neither",
        filename: SPEC_FILE,
        code: "let recorder;\nrecorder[named]();",
      },
      {
        name: "a computed key on a binding taken as a parameter reaches neither",
        filename: SPEC_FILE,
        code: "const release = (recorder) => {\n  recorder[named]();\n};",
      },
      {
        name: "a bulk name destructured in a parameter position carries no receiver to read",
        filename: SPEC_FILE,
        code: "const release = ({ clearAllMocks }) => clearAllMocks;",
      },
      {
        name: "a chain of bindings that points back at itself reaches neither",
        filename: SPEC_FILE,
        code: "let first = second;\nlet second = first;\nfirst.clearAllMocks();",
      },
      {
        name: "a cleanup vocabulary the configuration emptied falls back to the one built in",
        filename: SPEC_FILE,
        options: [{ bulkResetMembers: [] }],
        code: "const recorder = buildRecorder();\nrecorder.clearAllMocks();",
      },
      {
        name: "a per-mock name the configuration dropped is no longer read as cleanup",
        filename: SPEC_FILE,
        options: [{ perMockResetMembers: ["mockReset"] }],
        code: "const sendMail = vi.fn();\nsendMail.mockClear();",
      },
      {
        name: "a bulk name the configuration dropped is no longer read as cleanup",
        filename: SPEC_FILE,
        options: [{ bulkResetMembers: ["resetAllMocks"] }],
        code: "vi.clearAllMocks();",
      },
      {
        name: "a namespace spelling the configuration replaced no longer matches the runner",
        filename: SPEC_FILE,
        options: [{ mockNamespace: "runner" }],
        code: "vi.clearAllMocks();",
      },
    ],
    invalid: [
      {
        name: "the call record of one mock cleared by hand",
        filename: SPEC_FILE,
        code: "const sendMail = vi.fn();\nsendMail.mockClear();",
        errors: [{ messageId: "perMockReset", data: { member: "mockClear" } }],
      },
      {
        name: "the implementation of one mock reset by hand",
        filename: SPEC_FILE,
        code: "const sendMail = vi.fn();\nsendMail.mockReset();",
        errors: [{ messageId: "perMockReset", data: { member: "mockReset" } }],
      },
      {
        name: "the original implementation behind a spy restored by hand",
        filename: SPEC_FILE,
        code: 'const sendMail = vi.spyOn(mailer, "send");\nsendMail.mockRestore();',
        errors: [{ messageId: "perMockReset", data: { member: "mockRestore" } }],
      },
      {
        name: "cleanup written at the end of a fixture rather than in the shared configuration",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("sendMail", () => {\n  const sendMail = vi.fn();\n  sendMail.mockReset();\n  return sendMail;\n});',
        errors: [{ messageId: "perMockReset", data: { member: "mockReset" } }],
      },
      {
        name: "cleanup written inside a test body rather than in the shared configuration",
        filename: SPEC_FILE,
        code: 'test("addresses the recipient", ({ sendMail }) => {\n  sendMail.mockClear();\n  expect(sendMail).toHaveBeenCalledOnce();\n});',
        errors: [{ messageId: "perMockReset", data: { member: "mockClear" } }],
      },
      {
        name: "cleanup written in a setup hook rather than in the shared configuration",
        filename: SPEC_FILE,
        code: "beforeEach(() => {\n  vi.clearAllMocks();\n});",
        errors: [{ messageId: "bulkMockReset", data: { member: "clearAllMocks" } }],
      },
      {
        name: "cleanup written in a file that declares no test of its own",
        filename: SETUP_FILE,
        code: "beforeEach(() => {\n  vi.restoreAllMocks();\n});",
        errors: [{ messageId: "bulkMockReset", data: { member: "restoreAllMocks" } }],
      },
      {
        name: "cleanup reached through the typed accessor of the runner",
        filename: SPEC_FILE,
        code: "vi.mocked(sendMail).mockReset();",
        errors: [{ messageId: "perMockReset", data: { member: "mockReset" } }],
      },
      {
        name: "cleanup on a receiver widened by a type assertion",
        filename: SPEC_FILE,
        code: "(sendMail as Mock).mockRestore();",
        errors: [{ messageId: "perMockReset", data: { member: "mockRestore" } }],
      },
      {
        name: "cleanup on a receiver carried through a non-null assertion",
        filename: SPEC_FILE,
        code: "sendMail!.mockClear();",
        errors: [{ messageId: "perMockReset", data: { member: "mockClear" } }],
      },
      {
        name: "cleanup on a mock reached through a property of another object",
        filename: SPEC_FILE,
        code: "const mailer = { send: vi.fn() };\nmailer.send.mockClear();",
        errors: [{ messageId: "perMockReset", data: { member: "mockClear" } }],
      },
      {
        name: "every mock cleared at once by hand",
        filename: SPEC_FILE,
        code: "vi.clearAllMocks();",
        errors: [{ messageId: "bulkMockReset", data: { member: "clearAllMocks" } }],
      },
      {
        name: "every mock reset at once through a namespace given another name at the import",
        filename: SPEC_FILE,
        code: 'import { vi as runner } from "vitest";\nrunner.resetAllMocks();',
        errors: [{ messageId: "bulkMockReset", data: { member: "resetAllMocks" } }],
      },
      {
        name: "every mock restored at once through a namespace put into another binding",
        filename: SPEC_FILE,
        code: "const runner = vi;\nrunner.restoreAllMocks();",
        errors: [{ messageId: "bulkMockReset", data: { member: "restoreAllMocks" } }],
      },
      {
        name: "every mock cleared at once through a namespace wrapped in parentheses",
        filename: SPEC_FILE,
        code: "(vi).clearAllMocks();",
        errors: [{ messageId: "bulkMockReset", data: { member: "clearAllMocks" } }],
      },
      {
        name: "a per-mock cleanup member called through a parenthesised member reference",
        filename: SPEC_FILE,
        code: "const sendMail = vi.fn();\n(sendMail.mockClear)();",
        errors: [{ messageId: "perMockReset", data: { member: "mockClear" } }],
      },
      {
        name: "a bulk cleanup member spelled as a string index",
        filename: SPEC_FILE,
        code: 'vi["clearAllMocks"]();',
        errors: [{ messageId: "bulkMockReset", data: { member: "clearAllMocks" } }],
      },
      {
        name: "a bulk cleanup member spelled as a template with nothing put into it",
        filename: SPEC_FILE,
        code: "vi[`resetAllMocks`]();",
        errors: [{ messageId: "bulkMockReset", data: { member: "resetAllMocks" } }],
      },
      {
        name: "every stubbed environment variable released at once by hand",
        filename: SPEC_FILE,
        code: "vi.unstubAllEnvs();",
        errors: [{ messageId: "bulkStubRelease", data: { member: "unstubAllEnvs" } }],
      },
      {
        name: "every stubbed global released at once by hand",
        filename: SPEC_FILE,
        code: "vi.unstubAllGlobals();",
        errors: [{ messageId: "bulkStubRelease", data: { member: "unstubAllGlobals" } }],
      },
      {
        name: "a bulk cleanup member handed to a hook as a value",
        filename: SPEC_FILE,
        code: "afterEach(vi.clearAllMocks);",
        errors: [{ messageId: "resetTakenAsValue", data: { member: "clearAllMocks" } }],
      },
      {
        name: "a per-mock cleanup member bound to a name before it is called",
        filename: SPEC_FILE,
        code: "const sendMail = vi.fn();\nconst release = sendMail.mockRestore;\nrelease();",
        errors: [{ messageId: "resetTakenAsValue", data: { member: "mockRestore" } }],
      },
      {
        name: "cleanup members collected into an array",
        filename: SPEC_FILE,
        code: "const sendMail = vi.fn();\nconst cleanups = [sendMail.mockClear, vi.resetAllMocks];",
        errors: [
          { messageId: "resetTakenAsValue", data: { member: "mockClear" } },
          { messageId: "resetTakenAsValue", data: { member: "resetAllMocks" } },
        ],
      },
      {
        name: "a per-mock cleanup member taken out by a destructuring",
        filename: SPEC_FILE,
        code: "const sendMail = vi.fn();\nconst { mockClear } = sendMail;\nmockClear();",
        errors: [{ messageId: "resetTakenAsValue", data: { member: "mockClear" } }],
      },
      {
        name: "a bulk cleanup member taken out of the namespace by a destructuring",
        filename: SPEC_FILE,
        code: "const { clearAllMocks } = vi;\nclearAllMocks();",
        errors: [{ messageId: "resetTakenAsValue", data: { member: "clearAllMocks" } }],
      },
      {
        name: "every mock reset at once through a namespace imported under a quoted name",
        filename: SPEC_FILE,
        code: 'import { "vi" as runner } from "vitest";\nrunner.resetAllMocks();',
        errors: [{ messageId: "bulkMockReset", data: { member: "resetAllMocks" } }],
      },
      {
        name: "every mock cleared at once through a binding the namespace was assigned to",
        filename: SPEC_FILE,
        code: "let runner;\nrunner = vi;\nrunner.clearAllMocks();",
        errors: [{ messageId: "bulkMockReset", data: { member: "clearAllMocks" } }],
      },
      {
        name: "a per-mock cleanup member called through a receiver widened before the call",
        filename: SPEC_FILE,
        code: "const sendMail = vi.fn();\n(sendMail.mockClear as () => void)();",
        errors: [{ messageId: "perMockReset", data: { member: "mockClear" } }],
      },
      {
        name: "a per-mock cleanup member widened before it is bound to a name",
        filename: SPEC_FILE,
        code: "const sendMail = vi.fn();\nconst release = sendMail.mockReset as () => void;",
        errors: [{ messageId: "resetTakenAsValue", data: { member: "mockReset" } }],
      },
      {
        name: "a bulk cleanup member taken out of the namespace by a destructuring assignment",
        filename: SPEC_FILE,
        code: "let clearAllMocks;\n({ clearAllMocks } = vi);",
        errors: [{ messageId: "resetTakenAsValue", data: { member: "clearAllMocks" } }],
      },
      {
        name: "a member of the namespace reached through a key decided at run time",
        filename: SPEC_FILE,
        code: "vi[named]();",
        errors: [{ messageId: "computedMockMember" }],
      },
      {
        name: "a member of a mock reached through a key decided at run time",
        filename: SPEC_FILE,
        code: "const sendMail = vi.fn();\nsendMail[named]();",
        errors: [{ messageId: "computedMockMember" }],
      },
      {
        name: "a member of a spy reached through a key decided at run time",
        filename: SPEC_FILE,
        code: 'const sendMail = vi.spyOn(mailer, "send");\nsendMail[named]();',
        errors: [{ messageId: "computedMockMember" }],
      },
      {
        name: "a per-mock name the configuration added is read as cleanup",
        filename: SPEC_FILE,
        options: [{ perMockResetMembers: ["mockReset", "forget"] }],
        code: "const sendMail = vi.fn();\nsendMail.forget();",
        errors: [{ messageId: "perMockReset", data: { member: "forget" } }],
      },
      {
        name: "a namespace spelling the configuration replaced is read as the runner",
        filename: SPEC_FILE,
        options: [{ mockNamespace: "runner" }],
        code: "runner.clearAllMocks();",
        errors: [{ messageId: "bulkMockReset", data: { member: "clearAllMocks" } }],
      },
      {
        name: "a stub release member the configuration added is read as cleanup",
        filename: SPEC_FILE,
        options: [{ bulkStubReleaseMembers: ["unstubAllTimers"] }],
        code: "vi.unstubAllTimers();",
        errors: [{ messageId: "bulkStubRelease", data: { member: "unstubAllTimers" } }],
      },
    ],
  });
});
