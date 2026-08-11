import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { noFixtureForwardSubject } from "./no-fixture-forward-subject--yield-sut-output.ts";

const SPEC_FILE = "report.test.ts";

const SCOPING_WRAPPERS = [{ handlerScopingWrappers: ["scopeHandlers"] }];

describe("dont-review-it/no-fixture-forward-subject--yield-sut-output", () => {
  testLintRule(noFixtureForwardSubject, {
    valid: [
      {
        name: "a local binding handed back whole carries every field the code produced",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", async () => {\n  const report = await summarise(entries);\n  return report;\n});',
      },
      {
        name: "the call this fixture exercises produces the value it hands back",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", async () => summarise(entries));',
      },
      {
        name: "a method call on a local binding produces a new value",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("total", async () => {\n  const service = build(entries);\n  return service.compute();\n});',
      },
      {
        name: "a method call on a dependency produces a new value",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("record", async ({ store }) => store.load());',
      },
      {
        name: "an object literal that names no dependency is read by the rule against built subjects",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", async ({ store }) => ({ id: "a", total: 2 }));',
      },
      {
        name: "an array literal that names no dependency is read by the rule against built subjects",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("entries", async ({ store }) => ["a", "b"]);',
      },
      {
        name: "a constructor run over a dependency is read by the rule against built subjects",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", async ({ input }) => new Report(input));',
      },
      {
        name: "a literal spreading a local binding is read by the rule against built subjects",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", async () => {\n  const summarised = await summarise(entries);\n  return { ...summarised };\n});',
      },
      {
        name: "the old form handing over a local binding hands over the whole value",
        filename: SPEC_FILE,
        code: "const test = baseTest.extend({\n  report: async ({ store }, use) => {\n    const summarised = await summarise(entries);\n    await use(summarised);\n  },\n});",
      },
      {
        name: "a fixture written as a shared binding declares no factory to read",
        filename: SPEC_FILE,
        code: "const test = baseTest.extend({ report: fixtures.report });",
      },
      {
        name: "a builder handed a shared binding declares no factory to read",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", fixtures.report);',
      },
      {
        name: "registering a matcher on the assertion receiver declares no fixture",
        filename: SPEC_FILE,
        code: "expect.extend({ toBeReport: (subject) => subject.id });",
      },
      {
        name: "a wrapper the configuration does not name stays a call over its own arguments",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", async () => scopeHandlers(() => summarise(entries)));',
      },
      {
        name: "a named wrapper handing back a whole local binding hands over the whole value",
        filename: SPEC_FILE,
        options: SCOPING_WRAPPERS,
        code: 'const test = baseTest.extend("report", async () => scopeHandlers(handlers, async () => {\n  const summarised = await summarise(entries);\n  return summarised;\n}));',
      },
      {
        name: "a file that is not a spec file is outside this reading",
        filename: "report.ts",
        code: 'const test = baseTest.extend("path", async ({ lockOptions }) => lockOptions.lockPath);',
      },
      {
        name: "a suffix the configuration replaced no longer marks a spec file",
        filename: SPEC_FILE,
        options: [{ specFileSuffixes: ["-test.ts"] }],
        code: 'const test = baseTest.extend("path", async ({ lockOptions }) => lockOptions.lockPath);',
      },
    ],
    invalid: [
      {
        name: "a dependency handed straight back leaves this fixture stating nothing of its own",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", async ({ summarised }) => summarised);',
        errors: [{ messageId: "forwardedSubject", data: { subject: "summarised" } }],
      },
      {
        name: "a dependency taken apart under another name is still handed straight back",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", async ({ summarised: produced }) => produced);',
        errors: [{ messageId: "forwardedSubject", data: { subject: "produced" } }],
      },
      {
        name: "a member read off a dependency drops the rest of that dependency",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("path", async ({ lockOptions }) => lockOptions.lockPath);',
        errors: [{ messageId: "projectedSubject", data: { subject: "lockOptions" } }],
      },
      {
        name: "a call built out of a dependency derives the subject from another fixture",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", async ({ entries }) => summarise(entries));',
        errors: [{ messageId: "derivedSubject", data: { subject: "entries" } }],
      },
      {
        name: "a dependency spread into the arguments of a call derives the subject the same way",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", async ({ entries }) => summarise(...entries));',
        errors: [{ messageId: "derivedSubject", data: { subject: "entries" } }],
      },
      {
        name: "a member read off the local binding that caught the output drops the rest of it",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("status", async () => {\n  const response = await request();\n  return response.status;\n});',
        errors: [{ messageId: "projectedSubject", data: { subject: "response" } }],
      },
      {
        name: "a type assertion around the member read is stripped before the subject is read",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("status", async () => {\n  const response = await request();\n  return response.status as number;\n});',
        errors: [{ messageId: "projectedSubject", data: { subject: "response" } }],
      },
      {
        name: "a non-null assertion inside the member read is stripped before the root is named",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("status", async () => {\n  const response = await request();\n  return response!.status;\n});',
        errors: [{ messageId: "projectedSubject", data: { subject: "response" } }],
      },
      {
        name: "a member read parked in a local binding first is still a member read",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("status", async () => {\n  const response = await request();\n  const status = response.status;\n  return status;\n});',
        errors: [{ messageId: "projectedSubject", data: { subject: "response" } }],
      },
      {
        name: "a dependency parked in a local binding first is still handed straight back",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", async ({ summarised }) => {\n  const forwarded = summarised;\n  return forwarded;\n});',
        errors: [{ messageId: "forwardedSubject", data: { subject: "summarised" } }],
      },
      {
        name: "the fixture context handed back whole hands back every dependency at once",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", async (fixtureContext) => fixtureContext);',
        errors: [{ messageId: "forwardedSubject", data: { subject: "fixtureContext" } }],
      },
      {
        name: "a member read off the fixture context is a member read this rule can root",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("path", async (fixtureContext) => fixtureContext.lockOptions.lockPath);',
        errors: [{ messageId: "projectedSubject", data: { subject: "fixtureContext" } }],
      },
      {
        name: "an object literal spreading a dependency carries that dependency through",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", async ({ base }) => ({ ...base, id: "a" }));',
        errors: [{ messageId: "spreadSubject", data: { subject: "base" } }],
      },
      {
        name: "an array literal spreading a dependency carries that dependency through",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("entries", async ({ base }) => [...base]);',
        errors: [{ messageId: "spreadSubject", data: { subject: "base" } }],
      },
      {
        name: "the old form handing over a dependency hands it straight back",
        filename: SPEC_FILE,
        code: "const test = baseTest.extend({\n  report: async ({ summarised }, use) => {\n    await use(summarised);\n  },\n});",
        errors: [{ messageId: "forwardedSubject", data: { subject: "summarised" } }],
      },
      {
        name: "the old form handing over a member read drops the rest of the dependency",
        filename: SPEC_FILE,
        code: "const test = baseTest.extend({\n  path: async ({ lockOptions }, use) => {\n    await use(lockOptions.lockPath);\n  },\n});",
        errors: [{ messageId: "projectedSubject", data: { subject: "lockOptions" } }],
      },
      {
        name: "a member read hidden inside a named wrapper is read through the wrapper",
        filename: SPEC_FILE,
        options: SCOPING_WRAPPERS,
        code: 'const test = baseTest.extend("status", async () => scopeHandlers(handlers, async () => {\n  const response = await request();\n  return response.status;\n}));',
        errors: [{ messageId: "projectedSubject", data: { subject: "response" } }],
      },
      {
        name: "a member read bound outside a named wrapper is reached from inside it",
        filename: SPEC_FILE,
        options: SCOPING_WRAPPERS,
        code: 'const test = baseTest.extend("path", async ({ lockOptions }) => {\n  const lockPath = lockOptions.lockPath;\n  return scopeHandlers(() => lockPath);\n});',
        errors: [{ messageId: "projectedSubject", data: { subject: "lockOptions" } }],
      },
      {
        name: "every hand-back a fixture writes is read on its own",
        filename: SPEC_FILE,
        code: 'const test = baseTest.extend("report", async ({ summarised }) => {\n  if (summarised.stale) {\n    return summarised;\n  }\n  return summarised.fresh;\n});',
        errors: [{ messageId: "forwardedSubject" }, { messageId: "projectedSubject" }],
      },
    ],
  });
});
