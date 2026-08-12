import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { requireVitestExtendBuilder } from "./require-vitest-extend-builder--infer-fixture-type.ts";

describe("dont-review-it/require-vitest-extend-builder--infer-fixture-type", () => {
  testLintRule(requireVitestExtendBuilder, {
    valid: [
      {
        name: "a fixture named beside its factory reads its type off what the factory returns",
        code: 'const test = baseTest.extend("report", () => summarise());',
      },
      {
        name: "a fixture named beside a plain value carries no written out type either",
        code: 'const test = baseTest.extend("seed", { id: "a" });',
      },
      {
        name: "a scoped fixture takes its options between the name and the factory",
        code: 'const test = baseTest.extend("db", { scope: "file" }, () => openDb());',
      },
      {
        name: "every stage of a chain declares one fixture and infers it",
        code: 'const test = baseTest.extend("seed", 1).extend("report", ({ seed }) => summarise(seed));',
      },
      {
        name: "registering custom matchers shares the member name with a different API",
        code: "expect.extend({ toBeReport });",
      },
      {
        name: "a custom matcher registration keeps its type argument because it is a different API",
        code: "expect.extend<ReportMatchers>({ toBeReport });",
      },
      {
        name: "a call that stands on no receiver is not the fixture builder",
        code: "summarise({ report: 1 });",
      },
      {
        name: "a modifier that is not the builder takes whatever shape it takes",
        code: "baseTest.each({ report: 1 });",
      },
      {
        name: "a builder call handed nothing declares no fixture to infer",
        code: "baseTest.extend();",
      },
      {
        name: "a builder call handed a spread names no fixture this rule can read",
        code: "baseTest.extend(...held);",
      },
      {
        name: "the spelling the builder stands on belongs to another rule",
        code: 'const check = it.extend("report", () => summarise());',
      },
    ],
    invalid: [
      {
        name: "an object of fixtures becomes one builder call carrying the factory",
        code: "const test = baseTest.extend({ report: async ({}, use) => { await use(summarise()); } });",
        output: 'const test = baseTest.extend("report", async ({}) => summarise());',
        errors: [{ messageId: "objectFixtureDeclaration" }],
      },
      {
        name: "a fixture holding a plain value becomes the value form of the builder",
        code: 'baseTest.extend({ seed: { id: "a" } });',
        output: 'baseTest.extend("seed", { id: "a" });',
        errors: [{ messageId: "objectFixtureDeclaration" }],
      },
      {
        name: "fixtures are chained in the order their dependencies allow",
        code: "baseTest.extend({ report: ({ seed }, use) => use(summarise(seed)), seed: 1 });",
        output: 'baseTest.extend("seed", 1).extend("report", ({ seed }) => summarise(seed));',
        errors: [{ messageId: "objectFixtureDeclaration" }],
      },
      {
        name: "a fixture written as a tuple hands its options to the builder",
        code: 'baseTest.extend({ db: [async ({}, use) => { await use(openDb()); }, { scope: "file" }] });',
        output: 'baseTest.extend("db", { scope: "file" }, async ({}) => openDb());',
        errors: [{ messageId: "objectFixtureDeclaration" }],
      },
      {
        name: "a tuple written without options keeps the shape of a plain factory",
        code: "baseTest.extend({ report: [({}, use) => use(summarise())] });",
        output: 'baseTest.extend("report", ({}) => summarise());',
        errors: [{ messageId: "objectFixtureDeclaration" }],
      },
      {
        name: "what runs after the handoff becomes a registered cleanup",
        code: "baseTest.extend({ db: async ({}, use) => { const db = openDb(); await use(db); await db.close(); } });",
        output:
          'baseTest.extend("db", async ({}, { onCleanup }) => {\nconst db = openDb();\nonCleanup(async () => {\nawait db.close();\n});\nreturn db;\n});',
        errors: [{ messageId: "objectFixtureDeclaration" }],
      },
      {
        name: "a cleanup written without await is registered without await",
        code: "baseTest.extend({ db: ({}, use) => { const db = openDb(); use(db); db.close() } });",
        output:
          'baseTest.extend("db", ({}, { onCleanup }) => {\nconst db = openDb();\nonCleanup(() => {\ndb.close();\n});\nreturn db;\n});',
        errors: [{ messageId: "objectFixtureDeclaration" }],
      },
      {
        name: "what runs before the handoff stays in front of the returned value",
        code: "baseTest.extend({ report: async ({}, use) => { const built = summarise(); await use(built); } });",
        output:
          'baseTest.extend("report", async ({}) => {\nconst built = summarise();\nreturn built;\n});',
        errors: [{ messageId: "objectFixtureDeclaration" }],
      },
      {
        name: "a subject built in the handoff keeps its shape behind parentheses",
        code: 'baseTest.extend({ report: ({}, use) => use({ id: "a" }) });',
        output: 'baseTest.extend("report", ({}) => ({ id: "a" }));',
        errors: [{ messageId: "objectFixtureDeclaration" }],
      },
      {
        name: "a context taken under one name is carried across unchanged",
        code: "baseTest.extend({ report: async (ctx, use) => { await use(summarise(ctx)); } });",
        output: 'baseTest.extend("report", async (ctx) => summarise(ctx));',
        errors: [{ messageId: "objectFixtureDeclaration" }],
      },
      {
        name: "a written out type argument on the object form disappears with the rewrite",
        code: "baseTest.extend<{ seed: number }>({ seed: 1 });",
        output: 'baseTest.extend("seed", 1);',
        errors: [{ messageId: "objectFixtureDeclaration" }],
      },
      {
        name: "a builder named by subscript is rewritten through the same subscript",
        code: 'baseTest["extend"]({ seed: 1 });',
        output: 'baseTest["extend"]("seed", 1);',
        errors: [{ messageId: "objectFixtureDeclaration" }],
      },
      {
        name: "a builder named by a template subscript carrying no expression is the same builder",
        code: "baseTest[`extend`]({ seed: 1 });",
        output: 'baseTest[`extend`]("seed", 1);',
        errors: [{ messageId: "objectFixtureDeclaration" }],
      },
      {
        name: "a builder reached through an optional member keeps that member",
        code: "baseTest?.extend({ seed: 1 });",
        output: 'baseTest?.extend("seed", 1);',
        errors: [{ messageId: "objectFixtureDeclaration" }],
      },
      {
        name: "a builder called optionally is reported without a rewrite",
        code: "baseTest.extend?.({ seed: 1 });",
        errors: [{ messageId: "objectFixtureDeclaration" }],
      },
      {
        name: "a base carried through a type assertion leaves the chain no text to stand on",
        code: "(baseTest as Base).extend({ seed: 1 });",
        errors: [{ messageId: "objectFixtureDeclaration" }],
      },
      {
        name: "a chain of object forms rewrites the stage nearest the base first",
        code: "baseTest.extend({ seed: 1 }).extend({ report: 2 });",
        output: 'baseTest.extend("seed", 1).extend({ report: 2 });',
        errors: [
          { messageId: "objectFixtureDeclaration" },
          { messageId: "objectFixtureDeclaration" },
        ],
      },
      {
        name: "a modifier between two object forms does not hide the stage behind it",
        code: "baseTest.extend({ seed: 1 }).skip.extend({ report: 2 });",
        output: 'baseTest.extend("seed", 1).skip.extend({ report: 2 });',
        errors: [
          { messageId: "objectFixtureDeclaration" },
          { messageId: "objectFixtureDeclaration" },
        ],
      },
      {
        name: "a stage standing on an already named fixture is rewritten in place",
        code: 'baseTest.extend("seed", 1).extend({ report: 2 });',
        output: 'baseTest.extend("seed", 1).extend("report", 2);',
        errors: [{ messageId: "objectFixtureDeclaration" }],
      },
      {
        name: "a builder standing on a call the suite makes is rewritten in place",
        code: "summarise().extend({ seed: 1 });",
        output: 'summarise().extend("seed", 1);',
        errors: [{ messageId: "objectFixtureDeclaration" }],
      },
      {
        name: "a spread of fixtures names nothing the rewrite can place",
        code: "baseTest.extend({ ...shared });",
        errors: [{ messageId: "objectFixtureDeclaration" }],
      },
      {
        name: "a key that only settles at run time names no fixture",
        code: "baseTest.extend({ [name]: 1 });",
        errors: [{ messageId: "objectFixtureDeclaration" }],
      },
      {
        name: "a key written as a number is not a fixture name the builder takes",
        code: 'baseTest.extend({ 1: "a" });',
        errors: [{ messageId: "objectFixtureDeclaration" }],
      },
      {
        name: "a fixture written as a method has no factory shape to carry over",
        code: "baseTest.extend({ report() { return 1; } });",
        errors: [{ messageId: "objectFixtureDeclaration" }],
      },
      {
        name: "a fixture written as an accessor has no factory shape to carry over",
        code: "baseTest.extend({ get report() { return 1; } });",
        errors: [{ messageId: "objectFixtureDeclaration" }],
      },
      {
        name: "two fixtures under one name leave the rewrite no order to take",
        code: "baseTest.extend({ report: 1, report: 2 });",
        errors: [{ messageId: "objectFixtureDeclaration" }],
      },
      {
        name: "fixtures depending on each other leave the chain no place to start",
        code: "baseTest.extend({ first: ({ second }, use) => use(1), second: ({ first }, use) => use(2) });",
        errors: [{ messageId: "objectFixtureDeclaration" }],
      },
      {
        name: "an object declaring no fixture becomes no builder call",
        code: "baseTest.extend({});",
        errors: [{ messageId: "objectFixtureDeclaration" }],
      },
      {
        name: "a value named elsewhere may be a factory or a value and the rewrite cannot tell",
        code: "baseTest.extend({ report: summary });",
        errors: [{ messageId: "objectFixtureDeclaration" }],
      },
      {
        name: "two handoffs leave the rewrite no single value to return",
        code: "baseTest.extend({ report: async ({}, use) => { await use(1); await use(2); } });",
        errors: [{ messageId: "objectFixtureDeclaration" }],
      },
      {
        name: "a handoff reached only under a condition is not a value the factory always returns",
        code: "baseTest.extend({ report: async ({}, use) => { if (ok) { await use(1); } } });",
        errors: [{ messageId: "objectFixtureDeclaration" }],
      },
      {
        name: "a factory that already returns something leaves two values to hand back",
        code: "baseTest.extend({ report: async ({}, use) => { await use(1); return 2; } });",
        errors: [{ messageId: "objectFixtureDeclaration" }],
      },
      {
        name: "a handoff carrying nothing names no subject to return",
        code: "baseTest.extend({ report: async ({}, use) => { await use(); } });",
        errors: [{ messageId: "objectFixtureDeclaration" }],
      },
      {
        name: "a handoff carrying a spread names no single subject to return",
        code: "baseTest.extend({ report: async ({}, use) => { await use(...held); } });",
        errors: [{ messageId: "objectFixtureDeclaration" }],
      },
      {
        name: "a handoff carrying two arguments names no single subject to return",
        code: "baseTest.extend({ report: ({}, use) => use(1, 2) });",
        errors: [{ messageId: "objectFixtureDeclaration" }],
      },
      {
        name: "a factory that hands the handoff back instead of calling it returns no subject",
        code: "baseTest.extend({ report: ({}, use) => use });",
        errors: [{ messageId: "objectFixtureDeclaration" }],
      },
      {
        name: "a factory passing the handoff to something else keeps the handoff out of reach",
        code: "baseTest.extend({ report: ({}, use) => wrap(use) });",
        errors: [{ messageId: "objectFixtureDeclaration" }],
      },
      {
        name: "a factory handing the handoff to a member call keeps it out of reach too",
        code: "baseTest.extend({ report: ({}, use) => held.take(use) });",
        errors: [{ messageId: "objectFixtureDeclaration" }],
      },
      {
        name: "a factory written as a function expression is left to be rewritten by hand",
        code: "baseTest.extend({ report: async function ({}, use) { await use(1); } });",
        errors: [{ messageId: "objectFixtureDeclaration" }],
      },
      {
        name: "a factory taking nothing never receives a handoff to convert",
        code: "baseTest.extend({ report: () => 1 });",
        errors: [{ messageId: "objectFixtureDeclaration" }],
      },
      {
        name: "a factory taking only the context never receives a handoff to convert",
        code: "baseTest.extend({ report: ({}) => 1 });",
        errors: [{ messageId: "objectFixtureDeclaration" }],
      },
      {
        name: "a handoff taken apart into pieces is not a name the rewrite can follow",
        code: "baseTest.extend({ report: async ({}, { use }) => { await use(1); } });",
        errors: [{ messageId: "objectFixtureDeclaration" }],
      },
      {
        name: "a factory taking more than the context and the handoff is left alone",
        code: "baseTest.extend({ report: async ({}, use, extra) => { await use(1); } });",
        errors: [{ messageId: "objectFixtureDeclaration" }],
      },
      {
        name: "a binding declared after the handoff is not a cleanup the rewrite can register",
        code: "baseTest.extend({ db: async ({}, use) => { await use(1); const closed = close(); } });",
        errors: [{ messageId: "objectFixtureDeclaration" }],
      },
      {
        name: "a pair that is not a fixture and its options names no scope to carry",
        code: "baseTest.extend({ report: [1, 2] });",
        errors: [{ messageId: "objectFixtureDeclaration" }],
      },
      {
        name: "a tuple spread open names no fixture at its head",
        code: "baseTest.extend({ report: [...pair] });",
        errors: [{ messageId: "objectFixtureDeclaration" }],
      },
      {
        name: "a tuple with a hole at its head names no fixture either",
        code: "baseTest.extend({ report: [, {}] });",
        errors: [{ messageId: "objectFixtureDeclaration" }],
      },
      {
        name: "an empty tuple names no fixture at all",
        code: "baseTest.extend({ report: [] });",
        errors: [{ messageId: "objectFixtureDeclaration" }],
      },
      {
        name: "a tuple carrying more than a fixture and its options is left alone",
        code: "baseTest.extend({ report: [1, {}, {}] });",
        errors: [{ messageId: "objectFixtureDeclaration" }],
      },
      {
        name: "a tuple whose options are spread open names no options to carry",
        code: "baseTest.extend({ report: [1, ...rest] });",
        errors: [{ messageId: "objectFixtureDeclaration" }],
      },
      {
        name: "a tuple whose head cannot be told apart from a factory is left alone",
        code: "baseTest.extend({ report: [held, {}] });",
        errors: [{ messageId: "objectFixtureDeclaration" }],
      },
      {
        name: "a written out type argument beside a named fixture is reported on its own",
        code: 'baseTest.extend<{ report: Report }>("report", () => summarise());',
        errors: [{ messageId: "handWrittenFixtureType" }],
      },
      {
        name: "a written out type argument on a later stage of a chain is reported there",
        code: 'baseTest.extend("seed", 1).extend<{ report: Report }>("report", () => summarise());',
        errors: [{ messageId: "handWrittenFixtureType" }],
      },
      {
        name: "a written out type argument beside fixtures named elsewhere is still hand written",
        code: "baseTest.extend<Fixtures>(shared);",
        errors: [{ messageId: "handWrittenFixtureType" }],
      },
      {
        name: "a written out type argument on a builder handed a spread is still hand written",
        code: "baseTest.extend<Fixtures>(...held);",
        errors: [{ messageId: "handWrittenFixtureType" }],
      },
      {
        name: "a written out type argument on a builder handed nothing is still hand written",
        code: "baseTest.extend<Fixtures>();",
        errors: [{ messageId: "handWrittenFixtureType" }],
      },
    ],
  });
});
