import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { noFixtureCopySubject } from "./no-fixture-copy-subject--yield-sut-output.ts";

const SPEC_FILENAME = "report.test.ts";

const SOURCE_FILENAME = "report.ts";

describe("dont-review-it/no-fixture-copy-subject--yield-sut-output", () => {
  testLintRule(noFixtureCopySubject, {
    valid: [
      {
        name: "a fixture handing back what the code under test produced carries its shape unchanged",
        documented: true,
        code: "const it = test.extend('report', () => summarise(entries));",
        filename: SPEC_FILENAME,
      },
      {
        name: "a binding holding what the code under test produced is handed back whole",
        code: "const it = test.extend('report', () => {\n  const produced = summarise(entries);\n  return produced;\n});",
        filename: SPEC_FILENAME,
      },
      {
        name: "a subject naming a binding the file does not declare cannot be read any further",
        code: "const it = test.extend('report', () => produced);",
        filename: SPEC_FILENAME,
      },
      {
        name: "a binding holding a value that reads nothing carries no name into the key",
        code: "const it = test.extend('report', () => {\n  const total = 3;\n  return { total };\n});",
        filename: SPEC_FILENAME,
      },
      {
        name: "an object whose every key is spelled apart from the value it reads is not a copy of a shape",
        documented: true,
        code: "const it = test.extend('report', () => ({ count: source.total, at: source.recordedAt }));",
        filename: SPEC_FILENAME,
      },
      {
        name: "a binding that reads a differently spelled name carries no copy into the key",
        code: "const it = test.extend('report', () => {\n  const total = source.recorded;\n  return { total };\n});",
        filename: SPEC_FILENAME,
      },
      {
        name: "a method carrying the name of the value it reads is a member of its own",
        code: "const it = test.extend('report', () => ({ total() { return source.total; } }));",
        filename: SPEC_FILENAME,
      },
      {
        name: "an accessor carrying the name of the value it reads is not a property this rule reads",
        code: "const it = test.extend('report', () => ({ get total() { return source.total; } }));",
        filename: SPEC_FILENAME,
      },
      {
        name: "an object built only out of spreads names no property to compare",
        code: "const it = test.extend('report', () => ({ ...produced }));",
        filename: SPEC_FILENAME,
      },
      {
        name: "values that are not read off anything carry no name to copy",
        code: "const it = test.extend('report', () => ({ total: 3, at: recordedAt() }));",
        filename: SPEC_FILENAME,
      },
      {
        name: "a shorthand standing on a dependency the fixture takes apart is that dependency",
        code: "const it = test.extend('report', ({ total }) => ({ total }));",
        filename: SPEC_FILENAME,
      },
      {
        name: "a key that only settles at run time carries no name to compare",
        code: "const it = test.extend('report', () => ({ [held]: source.total }));",
        filename: SPEC_FILENAME,
      },
      {
        name: "a subject that is a call result is not an object this rule reads",
        code: "const it = test.extend('report', () => summarise(source.entries));",
        filename: SPEC_FILENAME,
      },
      {
        name: "registering a custom matcher shares the spelling but declares no fixture",
        code: "expect.extend({ toBeSettled: (received) => ({ pass: received.pass, message: () => '' }) });",
        filename: SPEC_FILENAME,
      },
      {
        name: "the same object written outside a spec file is outside what this rule reads",
        code: "const it = test.extend('report', () => ({ total: source.total }));",
        filename: SOURCE_FILENAME,
      },
    ],
    invalid: [
      {
        name: "an object written as the arrow body copies the shape it reads from",
        documented: true,
        code: "const it = test.extend('report', () => ({ total: source.total }));",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "copiedSubject", data: { fixture: "report", properties: "total" } }],
      },
      {
        name: "an object assembled out of what the code under test produced is still assembled",
        code: "const it = test.extend('report', () => {\n  const produced = summarise(entries);\n  return { total: produced.total };\n});",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "copiedSubject", data: { fixture: "report", properties: "total" } }],
      },
      {
        name: "a copy held in a binding before it is handed back is the same copy",
        code: "const it = test.extend('report', () => {\n  const copied = { total: source.total };\n  return copied;\n});",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "copiedSubject", data: { fixture: "report", properties: "total" } }],
      },
      {
        name: "a shorthand standing on a binding that reads the same name copies it just the same",
        code: "const it = test.extend('report', () => {\n  const total = source.total;\n  return { total };\n});",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "copiedSubject", data: { fixture: "report", properties: "total" } }],
      },
      {
        name: "a binding spelled apart from the key still carries the name the key copies",
        code: "const it = test.extend('report', () => {\n  const held = source.total;\n  return { total: held };\n});",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "copiedSubject", data: { fixture: "report", properties: "total" } }],
      },
      {
        name: "a binding declared at the top of the file is reached the same way",
        code: "const total = source.total;\nconst it = test.extend('report', () => ({ total }));",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "copiedSubject", data: { fixture: "report", properties: "total" } }],
      },
      {
        name: "renaming every key but one leaves the copy in place",
        documented: true,
        code: "const it = test.extend('report', () => ({ count: source.entries, total: source.total }));",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "copiedSubject", data: { fixture: "report", properties: "total" } }],
      },
      {
        name: "a subscripted key and a subscripted read name the same property",
        code: "const it = test.extend('report', () => ({ ['total']: source['total'] }));",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "copiedSubject", data: { fixture: "report", properties: "total" } }],
      },
      {
        name: "a key and a read spelled as templates without substitutions name the same property",
        code: "const it = test.extend('report', () => ({ [`total`]: source[`total`] }));",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "copiedSubject", data: { fixture: "report", properties: "total" } }],
      },
      {
        name: "assertions, awaits and optional reads written around the read do not change what it reads",
        code: "const it = test.extend('report', async () => ({ total: (await source).total, at: source?.at, seen: source.seen as number }));",
        filename: SPEC_FILENAME,
        errors: [
          {
            messageId: "copiedSubject",
            data: { fixture: "report", properties: "total, at, seen" },
          },
        ],
      },
      {
        name: "the handoff form hands the copy to the callback all the same",
        code: "const it = test.extend({\n  report: async ({}, use) => {\n    await use({ total: source.total });\n  },\n});",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "copiedSubject", data: { fixture: "report", properties: "total" } }],
      },
      {
        name: "the handoff form reaches the copy through a binding too",
        code: "const it = test.extend({\n  report: async ({}, use) => {\n    const copied = { total: source.total };\n    await use(copied);\n  },\n});",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "copiedSubject", data: { fixture: "report", properties: "total" } }],
      },
      {
        name: "the scoped handoff form keeps the fixture function at the head of the array",
        code: "const it = test.extend({\n  report: [\n    async ({}, use) => {\n      await use({ total: source.total });\n    },\n    { auto: true },\n  ],\n});",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "copiedSubject", data: { fixture: "report", properties: "total" } }],
      },
      {
        name: "every fixture a map declares is read on its own",
        code: "const it = test.extend({\n  report: async ({}, use) => {\n    await use({ total: source.total });\n  },\n  digest: async ({}, use) => {\n    await use({ at: source.at });\n  },\n});",
        filename: SPEC_FILENAME,
        errors: [
          { messageId: "copiedSubject", data: { fixture: "report", properties: "total" } },
          { messageId: "copiedSubject", data: { fixture: "digest", properties: "at" } },
        ],
      },
      {
        name: "a fixture handed a value instead of a function copies the shape the same way",
        code: "const it = test.extend('report', { total: source.total });",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "copiedSubject", data: { fixture: "report", properties: "total" } }],
      },
      {
        name: "a fixture handed a value reaches a binding declared at the top of the file too",
        code: "const total = source.total;\nconst it = test.extend('report', { total });",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "copiedSubject", data: { fixture: "report", properties: "total" } }],
      },
      {
        name: "a fixture derived from another fixture is read as a fixture too",
        code: "const base = test.extend('source', () => summarise(entries));\nconst it = base.extend('report', ({ source }) => ({ total: source.total }));",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "copiedSubject", data: { fixture: "report", properties: "total" } }],
      },
    ],
  });
});
