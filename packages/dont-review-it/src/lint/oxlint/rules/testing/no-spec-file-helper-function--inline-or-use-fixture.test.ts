import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { noSpecFileHelperFunction } from "./no-spec-file-helper-function--inline-or-use-fixture.ts";

const SPEC_FILENAME = "report.test.ts";

const SOURCE_FILENAME = "report.ts";

describe("dont-review-it/no-spec-file-helper-function--inline-or-use-fixture", () => {
  testLintRule(noSpecFileHelperFunction, {
    valid: [
      {
        name: "a function declared in a test block stays inside the one test that runs it",
        documented: true,
        code: 'it("names a behaviour", () => {\n  function build() {\n    return 1;\n  }\n  expect(build()).toBe(1);\n});',
        filename: SPEC_FILENAME,
      },
      {
        name: "a binding initialised with a function inside a test block stays inside that test",
        code: 'it("names a behaviour", () => {\n  const build = () => 1;\n  expect(build()).toBe(1);\n});',
        filename: SPEC_FILENAME,
      },
      {
        name: "a function declared in the body of a fixture stays inside that fixture",
        code: 'describe("a report", () => {\n  const it = test.extend("report", () => {\n    const build = () => 1;\n    return build();\n  });\n});',
        filename: SPEC_FILENAME,
      },
      {
        name: "a fixture builder declared in the body of a grouping block stands beside the tests that read it",
        documented: true,
        code: 'describe("a report", () => {\n  const it = test.extend("report", () => summarise(rows));\n});',
        filename: SPEC_FILENAME,
      },
      {
        name: "a function declared inside another local function is closed in the same way",
        code: 'it("names a behaviour", () => {\n  const outer = () => {\n    const inner = () => 1;\n    return inner();\n  };\n  expect(outer()).toBe(1);\n});',
        filename: SPEC_FILENAME,
      },
      {
        name: "a call whose callee is reached through a receiver is not resolved to a function in this file",
        code: 'const report = summaries.build("report");',
        filename: SPEC_FILENAME,
      },
      {
        name: "a call whose callee is declared in another module is not resolved to a function in this file",
        code: 'import { build } from "./build.ts";\nconst report = build();',
        filename: SPEC_FILENAME,
      },
      {
        name: "a call whose callee is bound nowhere in this file is not resolved to a function",
        code: "const report = summarise(rows);",
        filename: SPEC_FILENAME,
      },
      {
        name: "a fixture builder hands back a builder rather than a function of its own",
        code: 'describe("a report", () => {\n  const it = test.extend({ port: 3000 });\n});',
        filename: SPEC_FILENAME,
      },
      {
        name: "an immediately invoked call handing back a value other than a function assembles a constant",
        code: "const settings = (() => ({ port: 3000 }))();",
        filename: SPEC_FILENAME,
      },
      {
        name: "a construction binds an instance rather than a function",
        code: "const client = new Client({ port: 3000 });",
        filename: SPEC_FILENAME,
      },
      {
        name: "a class declaration and a type alias bind no function",
        code: "class Client {}\ntype Report = { readonly total: number };",
        filename: SPEC_FILENAME,
      },
      {
        name: "a module scope constant carrying no function is test data",
        code: 'const rows = [{ id: "a", total: 1 }, { id: "b", total: 2 }];',
        filename: SPEC_FILENAME,
      },
      {
        name: "a declaration without an initialiser binds nothing to read",
        code: "let held;",
        filename: SPEC_FILENAME,
      },
      {
        name: "a fixture handing back an imported binding hands back the code under test",
        code: 'import { summarise } from "./summarise.ts";\ndescribe("a report", () => {\n  const it = test.extend("summarise", () => summarise);\n});',
        filename: SPEC_FILENAME,
      },
      {
        name: "a fixture handing back the value a call produced hands back a subject",
        code: 'describe("a report", () => {\n  const it = test.extend("total", () => summarise(rows, DEFAULTS));\n});',
        filename: SPEC_FILENAME,
      },
      {
        name: "registering a custom matcher shares the spelling but declares no fixture",
        code: "expect.extend({ toBeSettled: () => ({ pass: true, message: () => '' }) });",
        filename: SPEC_FILENAME,
      },
      {
        name: "a literal handed to a call is not the initialiser of a binding",
        code: 'describe("a report", () => {\n  const it = test.extend({ report: { build: () => 1 } });\n});',
        filename: SPEC_FILENAME,
      },
      {
        name: "the same helper written outside a spec file is outside what this rule reads",
        code: "const build = () => 1;",
        filename: SOURCE_FILENAME,
      },
    ],
    invalid: [
      {
        name: "a function declared at module scope is reached by every test in the file",
        documented: true,
        code: "function build() {\n  return 1;\n}",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "scopedHelperDeclaration", data: { name: "build" } }],
      },
      {
        name: "a function declaration carrying no name is read under the name it is exported as",
        code: "export default function () {\n  return 1;\n}",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "scopedHelperDeclaration", data: { name: "default" } }],
      },
      {
        name: "a binding initialised with an arrow at module scope holds the same helper",
        code: "const build = () => 1;",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "scopedHelperBinding", data: { name: "build" } }],
      },
      {
        name: "a binding initialised with a function expression holds it just the same",
        code: "const build = function () {\n  return 1;\n};",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "scopedHelperBinding", data: { name: "build" } }],
      },
      {
        name: "a function declared in the body of a grouping block is shared by every test under it",
        code: 'describe("a report", () => {\n  function build() {\n    return 1;\n  }\n});',
        filename: SPEC_FILENAME,
        errors: [{ messageId: "scopedHelperDeclaration", data: { name: "build" } }],
      },
      {
        name: "a binding initialised with an arrow in the body of a grouping block holds the same helper",
        code: 'describe("a report", () => {\n  const build = () => 1;\n});',
        filename: SPEC_FILENAME,
        errors: [{ messageId: "scopedHelperBinding", data: { name: "build" } }],
      },
      {
        name: "the callback of a table driven grouping block is the body of a grouping block",
        code: 'describe.each(rows)("a report", (row) => {\n  const build = () => row;\n});',
        filename: SPEC_FILENAME,
        errors: [{ messageId: "scopedHelperBinding", data: { name: "build" } }],
      },
      {
        name: "a grouping block imported under another name is resolved to the same block",
        code: 'import { describe as group } from "vitest";\ngroup("a report", () => {\n  const build = () => 1;\n});',
        filename: SPEC_FILENAME,
        errors: [{ messageId: "scopedHelperBinding", data: { name: "build" } }],
      },
      {
        name: "a grouping block bound to a local name is resolved to the same block",
        code: 'const group = describe;\ngroup("a report", () => {\n  const build = () => 1;\n});',
        filename: SPEC_FILENAME,
        errors: [{ messageId: "scopedHelperBinding", data: { name: "build" } }],
      },
      {
        name: "a helper declared inside a grouping block nested in another grouping block stands in the inner one",
        code: 'describe("a report", () => {\n  describe("its total", () => {\n    const build = () => 1;\n  });\n});',
        filename: SPEC_FILENAME,
        errors: [{ messageId: "scopedHelperBinding", data: { name: "build" } }],
      },
      {
        name: "an immediately invoked call handing back a function binds a function all the same",
        code: "const build = (() => () => 1)();",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "disguisedHelperBinding", data: { name: "build" } }],
      },
      {
        name: "an immediately invoked call handing a function back from a branch hands back a function",
        code: "const build = (() => {\n  if (enabled) {\n    return () => 1;\n  }\n  return null;\n})();",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "disguisedHelperBinding", data: { name: "build" } }],
      },
      {
        name: "an immediately invoked call handing a function back from a guarded block hands back a function",
        code: "const build = (function () {\n  try {\n    return () => 1;\n  } finally {\n    settle();\n  }\n})();",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "disguisedHelperBinding", data: { name: "build" } }],
      },
      {
        name: "an immediately invoked call handing a function back from a case hands back a function",
        code: "const build = (() => {\n  switch (mode) {\n    case 'fast':\n      return () => 1;\n    default:\n      return null;\n  }\n})();",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "disguisedHelperBinding", data: { name: "build" } }],
      },
      {
        name: "an immediately invoked call handing a function back from a loop hands back a function",
        code: "const build = (() => {\n  for (const row of rows) {\n    return () => row;\n  }\n  return null;\n})();",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "disguisedHelperBinding", data: { name: "build" } }],
      },
      {
        name: "an immediately invoked call handing back a literal that carries a function carries a helper",
        code: "const helpers = (() => ({ build: () => 1 }))();",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "disguisedHelperBinding", data: { name: "helpers" } }],
      },
      {
        name: "a factory declared in this file is followed to what it hands back",
        code: "function makeBuild() {\n  return () => 1;\n}\nconst build = makeBuild();",
        filename: SPEC_FILENAME,
        errors: [
          { messageId: "scopedHelperDeclaration", data: { name: "makeBuild" } },
          { messageId: "disguisedHelperBinding", data: { name: "build" } },
        ],
      },
      {
        name: "a call to a same file function handing back a value other than a function binds a value",
        code: "function makeRows() {\n  return [{ id: 'a' }];\n}\nconst rows = makeRows();",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "scopedHelperDeclaration", data: { name: "makeRows" } }],
      },
      {
        name: "a factory bound to an arrow in this file is followed the same way",
        code: "const makeBuild = () => () => 1;\nconst build = makeBuild();",
        filename: SPEC_FILENAME,
        errors: [
          { messageId: "scopedHelperBinding", data: { name: "makeBuild" } },
          { messageId: "disguisedHelperBinding", data: { name: "build" } },
        ],
      },
      {
        name: "an object literal holding a function moves the helper into a container",
        code: "const helpers = { build: () => 1 };",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "containedHelperBinding", data: { name: "helpers" } }],
      },
      {
        name: "a method written in an object literal is a function the container holds",
        code: "const helpers = {\n  build() {\n    return 1;\n  },\n};",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "containedHelperBinding", data: { name: "helpers" } }],
      },
      {
        name: "an array literal holding a function moves the helper into a container too",
        code: "const helpers = [() => 1];",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "containedHelperBinding", data: { name: "helpers" } }],
      },
      {
        name: "a spread written beside a function in an object literal leaves the function in place",
        code: "const helpers = { ...shared, build: () => 1 };",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "containedHelperBinding", data: { name: "helpers" } }],
      },
      {
        name: "a hole and a spread written beside a function in an array literal leave it in place",
        code: "const helpers = [, ...shared, () => 1];",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "containedHelperBinding", data: { name: "helpers" } }],
      },
      {
        name: "a container taken apart by a pattern is named by the pattern that received it",
        code: "const { build } = { build: () => 1 };",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "containedHelperBinding", data: { name: "{ build }" } }],
      },
      {
        name: "a literal nested inside another literal is read to the bottom",
        code: "const helpers = { report: { build: () => 1 } };",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "containedHelperBinding", data: { name: "helpers" } }],
      },
      {
        name: "a container declared in the body of a grouping block holds the same helper",
        code: 'describe("a report", () => {\n  const helpers = { build: () => 1 };\n});',
        filename: SPEC_FILENAME,
        errors: [{ messageId: "containedHelperBinding", data: { name: "helpers" } }],
      },
      {
        name: "a fixture handing back a function written in place hands back a procedure",
        code: 'describe("a report", () => {\n  const it = test.extend("build", () => () => 1);\n});',
        filename: SPEC_FILENAME,
        errors: [{ messageId: "handedHelperFixture", data: { name: "build" } }],
      },
      {
        name: "the handoff form hands the function to the callback all the same",
        code: 'describe("a report", () => {\n  const it = test.extend({\n    build: async ({}, use) => {\n      await use(() => 1);\n    },\n  });\n});',
        filename: SPEC_FILENAME,
        errors: [{ messageId: "handedHelperFixture", data: { name: "build" } }],
      },
      {
        name: "a fixture carrying a name that passes any other gate is read by its shape",
        code: 'describe("a report", () => {\n  const it = test.extend("summarisedReportSubject", () => () => 1);\n});',
        filename: SPEC_FILENAME,
        errors: [{ messageId: "handedHelperFixture", data: { name: "summarisedReportSubject" } }],
      },
      {
        name: "a fixture derived from another fixture hands back a function the same way",
        code: 'describe("a report", () => {\n  const base = test.extend("rows", () => rows);\n  const it = base.extend("build", () => () => 1);\n});',
        filename: SPEC_FILENAME,
        errors: [{ messageId: "handedHelperFixture", data: { name: "build" } }],
      },
      {
        name: "every fixture a map declares is read on its own",
        code: 'describe("a report", () => {\n  const it = test.extend({\n    build: async ({}, use) => {\n      await use(() => 1);\n    },\n    settle: async ({}, use) => {\n      await use(() => 2);\n    },\n  });\n});',
        filename: SPEC_FILENAME,
        errors: [
          { messageId: "handedHelperFixture", data: { name: "build" } },
          { messageId: "handedHelperFixture", data: { name: "settle" } },
        ],
      },
      {
        name: "a fixture builder at module scope is reached by every test in the file",
        documented: true,
        code: 'const it = test.extend("report", () => summarise(rows));',
        filename: SPEC_FILENAME,
        errors: [{ messageId: "moduleScopeFixtureBinding", data: { name: "it" } }],
      },
      {
        name: "a builder derived from another builder at module scope stands there just the same",
        code: 'const base = test.extend("rows", () => rows);\nconst it = base.extend("report", () => summarise(rows));',
        filename: SPEC_FILENAME,
        errors: [
          { messageId: "moduleScopeFixtureBinding", data: { name: "base" } },
          { messageId: "moduleScopeFixtureBinding", data: { name: "it" } },
        ],
      },
      {
        name: "a chain of extends bound to one name is the one binding it stands in",
        code: 'const it = test.extend("rows", () => rows).extend("report", () => summarise(rows));',
        filename: SPEC_FILENAME,
        errors: [{ messageId: "moduleScopeFixtureBinding", data: { name: "it" } }],
      },
      {
        name: "a builder carrying a map of fixtures at module scope is named by the binding that holds it",
        code: "const it = test.extend({ rows: () => rows, report: () => summarise(rows) });",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "moduleScopeFixtureBinding", data: { name: "it" } }],
      },
      {
        name: "a fixture standing at module scope and handing back a function carries both defects",
        code: 'const it = test.extend("build", () => () => 1);',
        filename: SPEC_FILENAME,
        errors: [
          { messageId: "moduleScopeFixtureBinding", data: { name: "it" } },
          { messageId: "handedHelperFixture", data: { name: "build" } },
        ],
      },
    ],
  });
});
