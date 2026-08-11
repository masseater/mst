import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { noExpectMockCallInspection } from "./no-expect-mock-call-inspection--use-to-have-been-called-family.ts";

const SPEC_FILE = "send-mail.test.ts";

describe("dont-review-it/no-expect-mock-call-inspection--use-to-have-been-called-family", () => {
  testLintRule(noExpectMockCallInspection, {
    valid: [
      {
        name: "the arguments a mock was called with, claimed by the matcher that names them",
        filename: SPEC_FILE,
        code: 'test("addresses the recipient", ({ sendMail }) => {\n  expect(sendMail).toHaveBeenCalledWith("a@example.com");\n});',
      },
      {
        name: "how many times a mock was called, claimed by the matcher that names it",
        filename: SPEC_FILE,
        code: 'test("sends one message", ({ sendMail }) => {\n  expect(sendMail).toHaveBeenCalledTimes(1);\n});',
      },
      {
        name: "the absence of a call, claimed behind a negation",
        filename: SPEC_FILE,
        code: 'test("stays quiet", ({ sendMail }) => {\n  expect(sendMail).not.toHaveBeenCalled();\n});',
      },
      {
        name: "what a mock returned is outside what this reading covers",
        filename: SPEC_FILE,
        code: 'const sendMail = vi.fn();\ntest("hands the id back", () => {\n  expect(sendMail.mock.results).toStrictEqual([{ type: "return", value: "id" }]);\n});',
      },
      {
        name: "what a mock settled with is outside what this reading covers",
        filename: SPEC_FILE,
        code: 'const sendMail = vi.fn();\ntest("settles with the id", () => {\n  expect(sendMail.mock.settledResults).toStrictEqual([]);\n});',
      },
      {
        name: "a call record read for control flow reaches neither an assertion nor a fixture",
        filename: SPEC_FILE,
        code: 'const sendMail = vi.fn();\nconst test = baseTest.extend("delivered", () => {\n  if (sendMail.mock.calls.length === 0) return null;\n  return summarise();\n});',
      },
      {
        name: "a call record handed from one fixture to the next is never handed back",
        filename: SPEC_FILE,
        code: 'const sendMail = vi.fn();\nconst test = baseTest.extend("delivered", () => {\n  register(sendMail.mock.calls);\n  return summarise();\n});',
      },
      {
        name: "a call record put inside an object literal belongs to the fixture composition reading",
        filename: SPEC_FILE,
        code: 'const sendMail = vi.fn();\ntest("records the send", () => {\n  expect({ calls: sendMail.mock.calls }).toStrictEqual({ calls: [["a"]] });\n});',
      },
      {
        name: "a fixture composing an object around a call record belongs to that same reading",
        filename: SPEC_FILE,
        code: 'const sendMail = vi.fn();\nconst test = baseTest.extend("delivery", () => ({ calls: sendMail.mock.calls }));',
      },
      {
        name: "a fixture handing the mock binding itself back is the shape this rule asks for",
        filename: SPEC_FILE,
        code: 'const sendMail = vi.fn();\nconst test = baseTest.extend("sendMail", () => sendMail);\ntest("addresses the recipient", ({ sendMail }) => {\n  expect(sendMail).toHaveBeenCalledWith("a@example.com");\n});',
      },
      {
        name: "a property spelled like a record on a value that never passed through the namespace",
        filename: SPEC_FILE,
        code: 'test("counts the entries", ({ delivery }) => {\n  expect(delivery.calls).toStrictEqual([["a"]]);\n});',
      },
      {
        name: "a record reaching a parameter from a call site that is not statically decided",
        filename: SPEC_FILE,
        code: 'const observe = (calls) => {\n  expect(calls).toStrictEqual([["a"]]);\n};\nregistry[name](observe);',
      },
      {
        name: "a record name the configuration dropped is no longer read as a call record",
        filename: SPEC_FILE,
        options: [{ callRecordMembers: ["calls", "lastCall"] }],
        code: 'const sendMail = vi.fn();\ntest("keeps the receivers", () => {\n  expect(sendMail.mock.contexts).toStrictEqual([]);\n});',
      },
      {
        name: "a file that is not a spec file is outside this reading",
        filename: "send-mail.ts",
        code: 'const sendMail = vi.fn();\ntest("records the send", () => {\n  expect(sendMail.mock.calls).toStrictEqual([["a"]]);\n});',
      },
      {
        name: "a suffix the configuration replaced no longer marks a spec file",
        filename: SPEC_FILE,
        options: [{ specFileSuffixes: ["-test.ts"] }],
        code: 'const sendMail = vi.fn();\ntest("records the send", () => {\n  expect(sendMail.mock.calls).toStrictEqual([["a"]]);\n});',
      },
      {
        name: "a record member reached through a computed key is not decided statically",
        filename: SPEC_FILE,
        code: 'const sendMail = vi.fn();\ntest("records the send", () => {\n  const { [named]: sent } = sendMail.mock;\n  expect(sent).toStrictEqual([["a"]]);\n});',
      },
      {
        name: "a rest element carries no property name to read the namespace by",
        filename: SPEC_FILE,
        code: 'const sendMail = vi.fn();\ntest("records the send", () => {\n  const { ...sent } = sendMail.mock;\n  expect(sent).toStrictEqual({});\n});',
      },
      {
        name: "a rest parameter holds no position a call site can be matched against",
        filename: SPEC_FILE,
        code: 'const sendMail = vi.fn();\nconst expectSent = (...sent) => {\n  expect(sent[0]).toStrictEqual([["a"]]);\n};\nexpectSent(sendMail.mock.calls);',
      },
      {
        name: "a helper reached without being called hands nothing to its parameter",
        filename: SPEC_FILE,
        code: 'const expectSent = (sent) => {\n  expect(sent).toStrictEqual([["a"]]);\n};\nconst handlers = [expectSent];\nregister(expectSent);\nexpectSent();',
      },
      {
        name: "a call site spreading its arguments decides no position",
        filename: SPEC_FILE,
        code: 'const sendMail = vi.fn();\nconst expectSent = (sent) => {\n  expect(sent).toStrictEqual([["a"]]);\n};\nexpectSent(...[sendMail.mock.calls]);',
      },
      {
        name: "a subject declared in another module is outside a same-file reading",
        filename: SPEC_FILE,
        code: 'import { sent } from "./records.ts";\ntest("records the send", () => {\n  expect(sent).toStrictEqual([["a"]]);\n});',
      },
      {
        name: "a record member the caller narrowed away is no longer read as a call record",
        filename: SPEC_FILE,
        options: [{ callRecordMembers: ["lastCall"] }],
        code: 'const sendMail = vi.fn();\ntest("records the send", () => {\n  expect(sendMail.mock.calls).toStrictEqual([["a"]]);\n});',
      },
      {
        name: "an array destructuring of something that is not a record binds no record",
        filename: SPEC_FILE,
        code: 'test("addresses the recipient", ({ delivery }) => {\n  const [first] = delivery;\n  expect(first).toStrictEqual(["a"]);\n});',
      },
      {
        name: "bindings that stand on each other decide nothing and stop the walk",
        filename: SPEC_FILE,
        code: 'test("records the send", () => {\n  let first = second;\n  let second = first;\n  expect(first).toStrictEqual([["a"]]);\n});',
      },
      {
        name: "a matcher hanging off a call that is not the assertion entry is another chain",
        filename: SPEC_FILE,
        code: 'const sendMail = vi.fn();\ntest("records the send", () => {\n  summarise(sendMail.mock.calls).toStrictEqual([["a"]]);\n});',
      },
      {
        name: "an assertion entry handed nothing carries no subject",
        filename: SPEC_FILE,
        code: 'test("records the send", () => {\n  expect().toStrictEqual([["a"]]);\n});',
      },
      {
        name: "an assertion entry handed a spread carries no decided subject",
        filename: SPEC_FILE,
        code: 'const sendMail = vi.fn();\ntest("records the send", () => {\n  expect(...[sendMail.mock.calls]).toStrictEqual([["a"]]);\n});',
      },
    ],
    invalid: [
      {
        name: "the recorded calls compared as a value",
        filename: SPEC_FILE,
        code: 'const sendMail = vi.fn();\ntest("records the send", () => {\n  expect(sendMail.mock.calls).toStrictEqual([["a@example.com"]]);\n});',
        errors: [{ messageId: "inspectedCallRecord", data: { matcher: "toStrictEqual" } }],
      },
      {
        name: "the last recorded call compared as a value",
        filename: SPEC_FILE,
        code: 'const sendMail = vi.fn();\ntest("addresses the recipient", () => {\n  expect(sendMail.mock.lastCall).toStrictEqual(["a@example.com"]);\n});',
        errors: [{ messageId: "inspectedCallRecord" }],
      },
      {
        name: "the receivers of each call compared as a value",
        filename: SPEC_FILE,
        code: 'const sendMail = vi.fn();\ntest("keeps the receivers", () => {\n  expect(sendMail.mock.contexts).toStrictEqual([]);\n});',
        errors: [{ messageId: "inspectedCallRecord" }],
      },
      {
        name: "the order the mocks ran in compared as a value",
        filename: SPEC_FILE,
        code: 'const sendMail = vi.fn();\ntest("runs first", () => {\n  expect(sendMail.mock.invocationCallOrder).toStrictEqual([1]);\n});',
        errors: [{ messageId: "inspectedCallRecord" }],
      },
      {
        name: "how many calls were recorded, taken off the record instead of off the matcher",
        filename: SPEC_FILE,
        code: 'const sendMail = vi.fn();\ntest("sends one message", () => {\n  expect(sendMail.mock.calls.length).toBe(1);\n});',
        errors: [{ messageId: "inspectedCallRecord", data: { matcher: "toBe" } }],
      },
      {
        name: "one argument of one call, reached by index",
        filename: SPEC_FILE,
        code: 'const sendMail = vi.fn();\ntest("addresses the recipient", () => {\n  expect(sendMail.mock.calls[0][0]).toBe("a@example.com");\n});',
        errors: [{ messageId: "inspectedCallRecord" }],
      },
      {
        name: "the record mapped into another shape before it is compared",
        filename: SPEC_FILE,
        code: 'const sendMail = vi.fn();\ntest("addresses every recipient", () => {\n  expect(sendMail.mock.calls.map((call) => call[0])).toStrictEqual(["a@example.com"]);\n});',
        errors: [{ messageId: "inspectedCallRecord" }],
      },
      {
        name: "a record member spelled as a computed string",
        filename: SPEC_FILE,
        code: 'const sendMail = vi.fn();\ntest("records the send", () => {\n  expect(sendMail.mock["calls"]).toStrictEqual([["a@example.com"]]);\n});',
        errors: [{ messageId: "inspectedCallRecord" }],
      },
      {
        name: "a mock reached through the typed accessor of the runner",
        filename: SPEC_FILE,
        code: 'test("records the send", () => {\n  expect(vi.mocked(sendMail).mock.calls).toStrictEqual([["a@example.com"]]);\n});',
        errors: [{ messageId: "inspectedCallRecord" }],
      },
      {
        name: "the record bound to a name before it is handed to the assertion",
        filename: SPEC_FILE,
        code: 'const sendMail = vi.fn();\ntest("records the send", () => {\n  const sent = sendMail.mock.calls;\n  expect(sent).toStrictEqual([["a@example.com"]]);\n});',
        errors: [{ messageId: "inspectedCallRecord" }],
      },
      {
        name: "the record taken out of the namespace by a destructuring",
        filename: SPEC_FILE,
        code: 'const sendMail = vi.fn();\ntest("records the send", () => {\n  const { calls } = sendMail.mock;\n  expect(calls).toStrictEqual([["a@example.com"]]);\n});',
        errors: [{ messageId: "inspectedCallRecord" }],
      },
      {
        name: "the namespace taken off the mock by a destructuring",
        filename: SPEC_FILE,
        code: 'const sendMail = vi.fn();\ntest("records the send", () => {\n  const { mock } = sendMail;\n  expect(mock.calls).toStrictEqual([["a@example.com"]]);\n});',
        errors: [{ messageId: "inspectedCallRecord" }],
      },
      {
        name: "the first recorded call taken out by an array destructuring",
        filename: SPEC_FILE,
        code: 'const sendMail = vi.fn();\ntest("addresses the recipient", () => {\n  const [first] = sendMail.mock.calls;\n  expect(first).toStrictEqual(["a@example.com"]);\n});',
        errors: [{ messageId: "inspectedCallRecord" }],
      },
      {
        name: "the record carried across two bindings before it is handed over",
        filename: SPEC_FILE,
        code: 'const sendMail = vi.fn();\ntest("records the send", () => {\n  const record = sendMail.mock;\n  const sent = record.calls;\n  expect(sent).toStrictEqual([["a@example.com"]]);\n});',
        errors: [{ messageId: "inspectedCallRecord" }],
      },
      {
        name: "the record put into a binding by an assignment rather than by its declaration",
        filename: SPEC_FILE,
        code: 'const sendMail = vi.fn();\ntest("records the send", () => {\n  let sent = [];\n  sent = sendMail.mock.calls;\n  expect(sent).toStrictEqual([["a@example.com"]]);\n});',
        errors: [{ messageId: "inspectedCallRecord" }],
      },
      {
        name: "the record reaching the assertion as the argument of a helper call",
        filename: SPEC_FILE,
        code: 'const sendMail = vi.fn();\nconst expectSent = (sent) => {\n  expect(sent).toStrictEqual([["a@example.com"]]);\n};\nexpectSent(sendMail.mock.calls);',
        errors: [{ messageId: "inspectedCallRecord" }],
      },
      {
        name: "the record reaching a helper through a destructured parameter",
        filename: SPEC_FILE,
        code: 'const sendMail = vi.fn();\nfunction expectSent({ calls }) {\n  expect(calls).toStrictEqual([["a@example.com"]]);\n}\nexpectSent(sendMail.mock);',
        errors: [{ messageId: "inspectedCallRecord" }],
      },
      {
        name: "the record reaching a helper written as a bare function expression",
        filename: SPEC_FILE,
        code: 'const sendMail = vi.fn();\nconst expectSent = function (sent) {\n  expect(sent).toStrictEqual([["a@example.com"]]);\n};\nexpectSent(sendMail.mock.calls);',
        errors: [{ messageId: "inspectedCallRecord" }],
      },
      {
        name: "the record reaching a helper through an array pattern parameter",
        filename: SPEC_FILE,
        code: 'const sendMail = vi.fn();\nconst expectFirst = ([first]) => {\n  expect(first).toStrictEqual(["a@example.com"]);\n};\nexpectFirst(sendMail.mock.calls);',
        errors: [{ messageId: "inspectedCallRecord" }],
      },
      {
        name: "the record reaching a helper past a parameter that carries a default",
        filename: SPEC_FILE,
        code: 'const sendMail = vi.fn();\nconst expectSent = (sent = []) => {\n  expect(sent).toStrictEqual([["a@example.com"]]);\n};\nexpectSent(sendMail.mock.calls);',
        errors: [{ messageId: "inspectedCallRecord" }],
      },
      {
        name: "the record taken out of the namespace with a default standing beside it",
        filename: SPEC_FILE,
        code: 'const sendMail = vi.fn();\ntest("records the send", () => {\n  const { calls = [] } = sendMail.mock;\n  expect(calls).toStrictEqual([["a@example.com"]]);\n});',
        errors: [{ messageId: "inspectedCallRecord" }],
      },
      {
        name: "a later recorded call taken out past a hole in the array pattern",
        filename: SPEC_FILE,
        code: 'const sendMail = vi.fn();\ntest("addresses the second recipient", () => {\n  const [, second] = sendMail.mock.calls;\n  expect(second).toStrictEqual(["b@example.com"]);\n});',
        errors: [{ messageId: "inspectedCallRecord" }],
      },
      {
        name: "how many calls were recorded, taken out of the record by a destructuring",
        filename: SPEC_FILE,
        code: 'const sendMail = vi.fn();\ntest("sends one message", () => {\n  const { length } = sendMail.mock.calls;\n  expect(length).toBe(1);\n});',
        errors: [{ messageId: "inspectedCallRecord" }],
      },
      {
        name: "the record put into a binding declared without an initializer",
        filename: SPEC_FILE,
        code: 'const sendMail = vi.fn();\ntest("records the send", () => {\n  let sent;\n  sent = sendMail.mock.calls;\n  expect(sent).toStrictEqual([["a@example.com"]]);\n});',
        errors: [{ messageId: "inspectedCallRecord" }],
      },
      {
        name: "a record read under a configuration that names the record members",
        filename: SPEC_FILE,
        options: [{ specFileSuffixes: [".test.ts"] }],
        code: 'const sendMail = vi.fn();\ntest("records the send", () => {\n  expect(sendMail.mock.calls).toStrictEqual([["a@example.com"]]);\n});',
        errors: [{ messageId: "inspectedCallRecord" }],
      },
      {
        name: "a record read under a configuration that hands an empty member list",
        filename: SPEC_FILE,
        options: [{ callRecordMembers: [] }],
        code: 'const sendMail = vi.fn();\ntest("records the send", () => {\n  expect(sendMail.mock.calls).toStrictEqual([["a@example.com"]]);\n});',
        errors: [{ messageId: "inspectedCallRecord" }],
      },
      {
        name: "the record compared behind a negation modifier",
        filename: SPEC_FILE,
        code: 'const sendMail = vi.fn();\ntest("sends nothing", () => {\n  expect(sendMail.mock.calls).not.toStrictEqual([]);\n});',
        errors: [{ messageId: "inspectedCallRecord" }],
      },
      {
        name: "the record compared through the soft form of the receiver",
        filename: SPEC_FILE,
        code: 'const sendMail = vi.fn();\ntest("records the send", () => {\n  expect.soft(sendMail.mock.calls).toStrictEqual([]);\n});',
        errors: [{ messageId: "inspectedCallRecord" }],
      },
      {
        name: "a type assertion around the record does not make it another expression",
        filename: SPEC_FILE,
        code: 'const sendMail = vi.fn();\ntest("records the send", () => {\n  expect(sendMail.mock.calls as string[][]).toStrictEqual([]);\n});',
        errors: [{ messageId: "inspectedCallRecord" }],
      },
      {
        name: "a matcher of one's own is held to the same reading",
        filename: SPEC_FILE,
        code: 'const sendMail = vi.fn();\ntest("records the send", () => {\n  expect(sendMail.mock.calls).toBeDelivery();\n});',
        errors: [{ messageId: "inspectedCallRecord", data: { matcher: "toBeDelivery" } }],
      },
      {
        name: "a fixture handing the record back as its subject",
        filename: SPEC_FILE,
        code: 'const sendMail = vi.fn();\nconst test = baseTest.extend("sent", () => sendMail.mock.calls);',
        errors: [{ messageId: "fixtureYieldsCallRecord", data: { fixture: "sent" } }],
      },
      {
        name: "a fixture binding the record to a name inside the factory before handing it back",
        filename: SPEC_FILE,
        code: 'const sendMail = vi.fn();\nconst test = baseTest.extend("sent", () => {\n  const sent = sendMail.mock.calls;\n  return sent;\n});',
        errors: [{ messageId: "fixtureYieldsCallRecord" }],
      },
      {
        name: "a fixture handing the record over through the older object form of the builder",
        filename: SPEC_FILE,
        code: "const sendMail = vi.fn();\nconst test = baseTest.extend({\n  sent: async ({}, use) => {\n    await use(sendMail.mock.calls);\n  },\n});",
        errors: [{ messageId: "fixtureYieldsCallRecord", data: { fixture: "sent" } }],
      },
    ],
  });
});
