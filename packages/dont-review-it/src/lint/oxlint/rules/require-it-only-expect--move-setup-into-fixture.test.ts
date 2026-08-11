import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { requireItOnlyExpect } from "./require-it-only-expect--move-setup-into-fixture.ts";

const SPEC_FILENAME = "order.test.ts";

const SOURCE_FILENAME = "order.ts";

describe("dont-review-it/require-it-only-expect--move-setup-into-fixture", () => {
  testLintRule(requireItOnlyExpect, {
    valid: [
      {
        name: "a body holding one assertion against the subject is the shape this rule keeps",
        code: "it('totals the lines', () => {\n  expect(total).toStrictEqual({ amount: 3 });\n});",
        filename: SPEC_FILENAME,
      },
      {
        name: "an awaited assertion reached through a modifier is still an assertion",
        code: "it('settles', async () => {\n  await expect(settled).resolves.toStrictEqual({ amount: 3 });\n});",
        filename: SPEC_FILENAME,
      },
      {
        name: "a negated assertion is an assertion",
        code: "it('rejects the empty order', () => {\n  expect(total).not.toBe(0);\n});",
        filename: SPEC_FILENAME,
      },
      {
        name: "an assertion entered through a derived receiver is an assertion",
        code: "it('totals the lines', () => {\n  expect.soft(total).toBe(3);\n  expect.poll(read).toBe(3);\n});",
        filename: SPEC_FILENAME,
      },
      {
        name: "declaring how many assertions the block carries is a statement about the assertions themselves",
        code: "it('totals the lines', () => {\n  expect.assertions(1);\n  expect.hasAssertions();\n  expect(total).toBe(3);\n});",
        filename: SPEC_FILENAME,
      },
      {
        name: "a concise body that is an assertion carries no preparation",
        code: "it('totals the lines', () => expect(total).toBe(3));",
        filename: SPEC_FILENAME,
      },
      {
        name: "handing the assertion back leaves the waiting to the runner",
        code: "it('settles', () => {\n  return expect(settled).resolves.toBe(3);\n});",
        filename: SPEC_FILENAME,
      },
      {
        name: "an empty body carries no preparation and is left to the rule that owns the lower bound",
        code: "it('totals the lines', () => {});",
        filename: SPEC_FILENAME,
      },
      {
        name: "preparation standing outside the test block is where this rule wants it",
        code: "const order = build();\ndescribe('order', () => {\n  const paid = pay(order);\n  it('totals the lines', () => {\n    expect(paid).toBe(3);\n  });\n});",
        filename: SPEC_FILENAME,
      },
      {
        name: "a table driven block reaches its body through the same reading",
        code: "it.each(rows)('totals %s', (row) => {\n  expect(row).toStrictEqual({ amount: 1 });\n});",
        filename: SPEC_FILENAME,
      },
      {
        name: "a suppressed block is read like any other block",
        code: "it.skip('totals the lines', () => {\n  expect(total).toBe(3);\n});",
        filename: SPEC_FILENAME,
      },
      {
        name: "a call that is not a test block is left alone",
        code: "record('totals the lines', () => {\n  const seed = build();\n});",
        filename: SPEC_FILENAME,
      },
      {
        name: "a call whose name is not spelled out is not a test block",
        code: "it(title, () => {\n  const seed = build();\n});\nit(1, () => {\n  const seed = build();\n});",
        filename: SPEC_FILENAME,
      },
      {
        name: "a block handed no callback has no body to read",
        code: "it('totals the lines');",
        filename: SPEC_FILENAME,
      },
      {
        name: "arguments spread into the block leave no name to read",
        code: "it(...pending);",
        filename: SPEC_FILENAME,
      },
      {
        name: "a name built from a template is a spelled out name",
        code: "it(`totals ${label}`, () => {\n  expect(total).toBe(3);\n});",
        filename: SPEC_FILENAME,
      },
      {
        name: "an options object between the name and the callback does not hide the callback",
        code: "it('totals the lines', { retry: 2 }, () => {\n  expect(total).toBe(3);\n});",
        filename: SPEC_FILENAME,
      },
      {
        name: "a timeout after the callback does not hide the callback",
        code: "it('totals the lines', () => {\n  expect(total).toBe(3);\n}, 1000);",
        filename: SPEC_FILENAME,
      },
      {
        name: "a callback written as a function expression is read the same way",
        code: "it('totals the lines', function () {\n  expect(total).toBe(3);\n});",
        filename: SPEC_FILENAME,
      },
      {
        name: "an execution standing inside the subject of an assertion is left to the rule that owns it",
        code: "it('totals the lines', () => {\n  expect.assertions(1);\n  expect(build()).toBe(3);\n});",
        filename: SPEC_FILENAME,
      },
      {
        name: "a repository that lists its own utilities lets those through",
        code: "it('totals the lines', () => {\n  expect.unreachable();\n});",
        filename: SPEC_FILENAME,
        options: [{ allowedExpectUtilities: ["unreachable"] }],
      },
      {
        name: "a repository that spells its specs differently takes this file out of range",
        code: "it('totals the lines', () => {\n  const order = build();\n});",
        filename: SPEC_FILENAME,
        options: [{ specFileSuffixes: [".spec.ts"] }],
      },
      {
        name: "a file that is not a spec is out of range",
        code: "it('totals the lines', () => {\n  const order = build();\n});",
        filename: SOURCE_FILENAME,
      },
    ],
    invalid: [
      {
        name: "a binding that prepares the subject is reported",
        code: "it('totals the lines', () => {\n  const order = build();\n  expect(order).toBe(3);\n});",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "setupStatement" }],
      },
      {
        name: "the call under test written as a statement is reported",
        code: "it('totals the lines', () => {\n  save(order);\n  expect(order).toBe(3);\n});",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "setupStatement" }],
      },
      {
        name: "taking the subject apart with a destructuring binding is reported",
        code: "it('totals the lines', () => {\n  const { amount } = order;\n  expect(amount).toBe(3);\n});",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "setupStatement" }],
      },
      {
        name: "a branch around the assertion is reported",
        code: "it('totals the lines', () => {\n  if (ready) {\n    expect(total).toBe(3);\n  }\n});",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "setupStatement" }],
      },
      {
        name: "catching a failure inside the block is reported",
        code: "it('totals the lines', () => {\n  try {\n    save(order);\n  } catch (failure) {\n    expect(failure).toBe(3);\n  }\n});",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "setupStatement" }],
      },
      {
        name: "looping over assertions is reported",
        code: "it('totals the lines', () => {\n  for (const line of lines) expect(line).toBe(3);\n});",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "setupStatement" }],
      },
      {
        name: "writing to the console inside the block is reported",
        code: "it('totals the lines', () => {\n  console.log(order);\n  expect(order).toBe(3);\n});",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "setupStatement" }],
      },
      {
        name: "a statement that is only a value is reported",
        code: "it('totals the lines', () => {\n  order;\n});",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "setupStatement" }],
      },
      {
        name: "an expect call that never reaches a matcher is reported",
        code: "it('totals the lines', () => {\n  expect(order);\n});",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "setupStatement" }],
      },
      {
        name: "a matcher taken as a value is reported",
        code: "it('totals the lines', () => {\n  expect(order).toBe;\n});",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "setupStatement" }],
      },
      {
        name: "a matcher reached through a key decided at run time is reported",
        code: "it('totals the lines', () => {\n  expect(order)[matcher]();\n});",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "setupStatement" }],
      },
      {
        name: "a modifier that is not a modifier leaves the chain off the assertion entry",
        code: "it('totals the lines', () => {\n  expect(order).maybe.toBe(3);\n});\nit('totals again', () => {\n  expect(order)[flag].toBe(3);\n});",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "setupStatement" }, { messageId: "setupStatement" }],
      },
      {
        name: "a chain standing on a binding is not an assertion",
        code: "it('totals the lines', () => {\n  assertion.toBe(3);\n});",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "setupStatement" }],
      },
      {
        name: "a receiver that is not the assertion entry is not an assertion",
        code: "it('totals the lines', () => {\n  report.of(order).toBe(3);\n});\nit('totals again', () => {\n  suite.expect.soft(order).toBe(3);\n});",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "setupStatement" }, { messageId: "setupStatement" }],
      },
      {
        name: "an assertion entry reached through a key decided at run time is not the assertion entry",
        code: "it('totals the lines', () => {\n  expect[entry](order).toBe(3);\n});\nit('totals again', () => {\n  entryOf()(order).toBe(3);\n});",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "setupStatement" }, { messageId: "setupStatement" }],
      },
      {
        name: "registering a matcher inside the block is preparation the shared setup owns",
        code: "it('totals the lines', () => {\n  expect.extend({ toBeSettled });\n  expect(order).toBe(3);\n});",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "setupStatement" }],
      },
      {
        name: "a namespace member reached through a key decided at run time is not a listed utility",
        code: "it('totals the lines', () => {\n  expect[utility]();\n  expect.assertions;\n  expect(order).toBe(3);\n});",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "setupStatement" }, { messageId: "setupStatement" }],
      },
      {
        name: "a call hidden in the argument of a listed utility is reported",
        code: "it('totals the lines', () => {\n  expect.assertions(counted());\n  expect(order).toBe(3);\n});",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "utilityArgument" }],
      },
      {
        name: "a construction hidden in the argument of a listed utility is reported",
        code: "it('totals the lines', () => {\n  expect.assertions(new Counter().total);\n  expect(order).toBe(3);\n});",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "utilityArgument" }],
      },
      {
        name: "an assignment hidden in the argument of a listed utility is reported",
        code: "it('totals the lines', () => {\n  expect.assertions(counted = 2);\n  expect(order).toBe(3);\n});",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "utilityArgument" }],
      },
      {
        name: "a concise body that runs the code under test is reported",
        code: "it('totals the lines', () => save(order));",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "nonAssertionBody" }],
      },
      {
        name: "handing back something other than an assertion is reported",
        code: "it('totals the lines', () => {\n  return build();\n});",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "setupStatement" }],
      },
      {
        name: "leaving the block early is reported",
        code: "it('totals the lines', () => {\n  return;\n});",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "setupStatement" }],
      },
      {
        name: "preparation inside a table driven block is reported",
        code: "it.each(rows)('totals %s', (row) => {\n  const parsed = parse(row);\n  expect(parsed).toBe(3);\n});",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "setupStatement" }],
      },
      {
        name: "every statement that is not an assertion is reported on its own",
        code: "it('totals the lines', () => {\n  const order = build();\n  save(order);\n  expect(order).toBe(3);\n});",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "setupStatement" }, { messageId: "setupStatement" }],
      },
      {
        name: "listing other utilities takes the count declaration out of the list",
        code: "it('totals the lines', () => {\n  expect.assertions(1);\n  expect(order).toBe(3);\n});",
        filename: SPEC_FILENAME,
        options: [{ allowedExpectUtilities: ["unreachable"] }],
        errors: [{ messageId: "setupStatement" }],
      },
      {
        name: "a repository that spells its specs differently brings its own files into range",
        code: "it('totals the lines', () => {\n  const order = build();\n});",
        filename: "order.spec.ts",
        options: [{ specFileSuffixes: [".spec.ts"] }],
        errors: [{ messageId: "setupStatement" }],
      },
    ],
  });
});
