import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import {
  fixtureContextParameterName,
  fixtureDeclarationsOf,
  fixtureDependenciesOf,
  isFixtureBuilderCall,
  type FixtureDeclaration,
} from "./fixture-declarations.ts";

import type { ESTree } from "@oxlint/plugins";
import type { SpecFunction } from "./subject-expressions.ts";

const callIn = (callSource: string): ESTree.CallExpression => {
  const statement = parseSync("spec.ts", `${callSource};`).program.body[0] as ESTree.Statement;
  return (statement as ESTree.ExpressionStatement).expression as ESTree.CallExpression;
};

const declaredIn = (callSource: string): readonly FixtureDeclaration[] =>
  fixtureDeclarationsOf(callIn(callSource));

const shapeOf = (
  declaration: FixtureDeclaration,
): { readonly name: string; readonly form: string; readonly subjects: readonly string[] } => ({
  name: declaration.name,
  form: declaration.form,
  subjects: declaration.subjects.map((subject) => subject.type),
});

describe("what a fixture builder declares", () => {
  test("a builder call on the test base declares a fixture", () => {
    expect(isFixtureBuilderCall(callIn('test.extend("subject", () => runSut())'))).toBe(true);
  });

  test("a builder call on a fixture already derived from the base declares a fixture too", () => {
    expect(isFixtureBuilderCall(callIn('baseTest.extend("subject", () => runSut())'))).toBe(true);
  });

  test("registering a custom matcher shares the member name but declares no fixture", () => {
    expect(isFixtureBuilderCall(callIn("expect.extend({ toBeReport })"))).toBe(false);
    expect(declaredIn("expect.extend({ toBeReport })")).toStrictEqual([]);
  });

  test("a member that is not the builder declares no fixture", () => {
    expect(isFixtureBuilderCall(callIn('test.override("subject", () => runSut())'))).toBe(false);
    expect(isFixtureBuilderCall(callIn("test.scoped({ subject: 1 })"))).toBe(false);
  });

  test("a plain call that only shares the builder's name declares no fixture", () => {
    expect(isFixtureBuilderCall(callIn('extend("subject", () => runSut())'))).toBe(false);
    expect(declaredIn('extend("subject", () => runSut())')).toStrictEqual([]);
  });

  test("a builder written with a name and a factory hands back what the factory returns", () => {
    expect(
      declaredIn('test.extend("report", async () => await runSut())').map(shapeOf),
    ).toStrictEqual([{ name: "report", form: "builder", subjects: ["AwaitExpression"] }]);
  });

  test("a builder written with options between the name and the factory reads the same way", () => {
    expect(
      declaredIn('test.extend("report", { scope: "file" }, async () => runSut())').map(shapeOf),
    ).toStrictEqual([{ name: "report", form: "builder", subjects: ["CallExpression"] }]);
  });

  test("a builder handed a plain expression takes that expression as the subject", () => {
    expect(declaredIn('test.extend("port", 3000)').map(shapeOf)).toStrictEqual([
      { name: "port", form: "builder", subjects: ["Literal"] },
    ]);
  });

  test("a builder that only names a fixture declares it with no subject to hand back", () => {
    expect(declaredIn('test.extend("report")').map(shapeOf)).toStrictEqual([
      { name: "report", form: "builder", subjects: [] },
    ]);
    expect(
      declaredIn('test.extend("report")').map((declaration) => declaration.factory),
    ).toStrictEqual([null]);
  });

  test("a builder name written as a template without a substitution is read the same way", () => {
    expect(declaredIn("test.extend(`report`, () => runSut())").map(shapeOf)).toStrictEqual([
      { name: "report", form: "builder", subjects: ["CallExpression"] },
    ]);
  });

  test("a factory with several returns offers every subject it can hand back", () => {
    expect(
      declaredIn(
        'test.extend("report", ({ flag }) => { if (flag) { return runSut(); } return null; })',
      ).map(shapeOf),
    ).toStrictEqual([{ name: "report", form: "builder", subjects: ["CallExpression", "Literal"] }]);
  });

  test("the older object form declares one fixture per property", () => {
    expect(
      declaredIn(
        "test.extend({ port: 3000, report: async ({ port }, use) => { await use(await runSut(port)); } })",
      ).map(shapeOf),
    ).toStrictEqual([
      { name: "port", form: "object", subjects: ["Literal"] },
      { name: "report", form: "object", subjects: ["AwaitExpression"] },
    ]);
  });

  test("the older object form written as a method declares the same fixture", () => {
    expect(
      declaredIn("test.extend({ async report({ port }, use) { await use(runSut(port)); } })").map(
        shapeOf,
      ),
    ).toStrictEqual([{ name: "report", form: "object", subjects: ["CallExpression"] }]);
  });

  test("a scoped fixture written as a tuple reads its factory out of the first slot", () => {
    expect(
      declaredIn(
        'test.extend({ store: [async ({}, use) => { await use(openStore()); }, { scope: "worker" }] })',
      ).map(shapeOf),
    ).toStrictEqual([{ name: "store", form: "object", subjects: ["CallExpression"] }]);
  });

  test("a scoped fixture whose tuple is spread in from elsewhere keeps its name and offers no subject", () => {
    expect(declaredIn("test.extend({ store: [...storeFixture] })").map(shapeOf)).toStrictEqual([
      { name: "store", form: "object", subjects: [] },
    ]);
  });

  test("an older-form factory that never names its handoff hands back no subject", () => {
    expect(
      declaredIn("test.extend({ report: async ({ port }) => { runSut(port); } })").map(shapeOf),
    ).toStrictEqual([{ name: "report", form: "object", subjects: [] }]);
  });

  test("a property whose key is chosen at run time declares no fixture this reading can name", () => {
    expect(declaredIn("test.extend({ [chosen]: () => runSut() })")).toStrictEqual([]);
  });

  test("a spread among the properties declares nothing while the written properties still do", () => {
    expect(declaredIn("test.extend({ ...sharedFixtures, port: 3000 })").map(shapeOf)).toStrictEqual(
      [{ name: "port", form: "object", subjects: ["Literal"] }],
    );
  });

  test("a spread in the builder arguments leaves the declaration unreadable", () => {
    expect(declaredIn("test.extend(...declarations)")).toStrictEqual([]);
  });

  test("a builder handed neither a name nor an object declares nothing", () => {
    expect(declaredIn("test.extend(declarations)")).toStrictEqual([]);
  });

  test("a builder handed no argument at all declares nothing", () => {
    expect(declaredIn("test.extend()")).toStrictEqual([]);
  });
});

const factoryIn = (callSource: string): SpecFunction => {
  const [declaration] = declaredIn(callSource);
  if (declaration === undefined) throw new Error(`no fixture is declared by: ${callSource}`);

  return declaration.factory as SpecFunction;
};

describe("what a fixture factory depends on", () => {
  test("a factory taking its dependencies apart names each one and the name it binds it to", () => {
    const dependencies = fixtureDependenciesOf(
      factoryIn(
        'test.extend("report", async ({ port, store: warehouse, [chosen]: picked }) => runSut())',
      ),
    );

    expect(
      (dependencies ?? []).map((dependency) => [dependency.name, dependency.boundAs]),
    ).toStrictEqual([
      ["port", "port"],
      ["store", "warehouse"],
    ]);
  });

  test("a factory gathering the rest of the context names only what it took apart by name", () => {
    const dependencies = fixtureDependenciesOf(
      factoryIn('test.extend("report", async ({ port, ...extras }) => runSut(port, extras))'),
    );

    expect(
      (dependencies ?? []).map((dependency) => [dependency.name, dependency.boundAs]),
    ).toStrictEqual([["port", "port"]]);
  });

  test("a dependency taken further apart is named but bound to no single name", () => {
    const dependencies = fixtureDependenciesOf(
      factoryIn('test.extend("report", async ({ store: { warehouse } }) => runSut(warehouse))'),
    );

    expect(
      (dependencies ?? []).map((dependency) => [dependency.name, dependency.boundAs]),
    ).toStrictEqual([["store", null]]);
  });

  test("each named dependency points at the property that declared it", () => {
    const dependencies = fixtureDependenciesOf(
      factoryIn('test.extend("report", async ({ port }) => runSut(port))'),
    );

    expect((dependencies ?? []).map((dependency) => dependency.property.type)).toStrictEqual([
      "Property",
    ]);
  });

  test("a factory taking the context whole declares no dependency this reading can name", () => {
    const factory = factoryIn('test.extend("report", async (context) => runSut(context))');

    expect(fixtureDependenciesOf(factory)).toBe(null);
    expect(fixtureContextParameterName(factory)).toBe("context");
  });

  test("a factory taking its dependencies apart binds the context to no single name", () => {
    const factory = factoryIn('test.extend("report", async ({ port }) => runSut(port))');

    expect(fixtureContextParameterName(factory)).toBe(null);
  });
});
