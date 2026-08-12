import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import {
  fixtureContextParameterName,
  fixtureDeclarationsOf,
  fixtureDependenciesOf,
  isFixtureBuilderCall,
} from "./fixture-declarations.ts";

import type { ESTree } from "@oxlint/plugins";
import type { SpecFunction } from "./subject-expressions.ts";

const it = test
  .extend("verdictOnABuilderCallOnTheTestBase", () => {
    const statement = parseSync("spec.ts", 'test.extend("subject", () => runSut());').program
      .body[0] as ESTree.Statement;
    const call = (statement as ESTree.ExpressionStatement).expression as ESTree.CallExpression;
    return isFixtureBuilderCall(call);
  })
  .extend("verdictOnABuilderCallOnADerivedFixture", () => {
    const statement = parseSync("spec.ts", 'baseTest.extend("subject", () => runSut());').program
      .body[0] as ESTree.Statement;
    const call = (statement as ESTree.ExpressionStatement).expression as ESTree.CallExpression;
    return isFixtureBuilderCall(call);
  })
  .extend("verdictOnACustomMatcherRegistration", () => {
    const statement = parseSync("spec.ts", "expect.extend({ toBeReport });").program
      .body[0] as ESTree.Statement;
    const call = (statement as ESTree.ExpressionStatement).expression as ESTree.CallExpression;
    return isFixtureBuilderCall(call);
  })
  .extend("declarationsOfACustomMatcherRegistration", () => {
    const statement = parseSync("spec.ts", "expect.extend({ toBeReport });").program
      .body[0] as ESTree.Statement;
    const call = (statement as ESTree.ExpressionStatement).expression as ESTree.CallExpression;
    return fixtureDeclarationsOf(call);
  })
  .extend("verdictOnAMemberThatIsNotTheBuilder", () => {
    const statement = parseSync("spec.ts", 'test.override("subject", () => runSut());').program
      .body[0] as ESTree.Statement;
    const call = (statement as ESTree.ExpressionStatement).expression as ESTree.CallExpression;
    return isFixtureBuilderCall(call);
  })
  .extend("verdictOnTheScopedMember", () => {
    const statement = parseSync("spec.ts", "test.scoped({ subject: 1 });").program
      .body[0] as ESTree.Statement;
    const call = (statement as ESTree.ExpressionStatement).expression as ESTree.CallExpression;
    return isFixtureBuilderCall(call);
  })
  .extend("shapesOfABuilderWrittenWithANameAndAFactory", () => {
    const statement = parseSync("spec.ts", 'test.extend("report", async () => await runSut());')
      .program.body[0] as ESTree.Statement;
    const call = (statement as ESTree.ExpressionStatement).expression as ESTree.CallExpression;
    return fixtureDeclarationsOf(call).map((declaration) => ({
      name: declaration.name,
      form: declaration.form,
      subjects: declaration.subjects.map((subject) => subject.type),
    }));
  })
  .extend("shapesOfABuilderCarryingOptionsBetweenTheNameAndTheFactory", () => {
    const statement = parseSync(
      "spec.ts",
      'test.extend("report", { scope: "file" }, async () => runSut());',
    ).program.body[0] as ESTree.Statement;
    const call = (statement as ESTree.ExpressionStatement).expression as ESTree.CallExpression;
    return fixtureDeclarationsOf(call).map((declaration) => ({
      name: declaration.name,
      form: declaration.form,
      subjects: declaration.subjects.map((subject) => subject.type),
    }));
  })
  .extend("shapesOfABuilderHandedAPlainExpression", () => {
    const statement = parseSync("spec.ts", 'test.extend("port", 3000);').program
      .body[0] as ESTree.Statement;
    const call = (statement as ESTree.ExpressionStatement).expression as ESTree.CallExpression;
    return fixtureDeclarationsOf(call).map((declaration) => ({
      name: declaration.name,
      form: declaration.form,
      subjects: declaration.subjects.map((subject) => subject.type),
    }));
  })
  .extend("shapesOfABuilderNamedByATemplateWithoutASubstitution", () => {
    const statement = parseSync("spec.ts", "test.extend(`report`, () => runSut());").program
      .body[0] as ESTree.Statement;
    const call = (statement as ESTree.ExpressionStatement).expression as ESTree.CallExpression;
    return fixtureDeclarationsOf(call).map((declaration) => ({
      name: declaration.name,
      form: declaration.form,
      subjects: declaration.subjects.map((subject) => subject.type),
    }));
  })
  .extend("shapesOfAFactoryWithSeveralReturns", () => {
    const statement = parseSync(
      "spec.ts",
      'test.extend("report", ({ flag }) => { if (flag) { return runSut(); } return null; });',
    ).program.body[0] as ESTree.Statement;
    const call = (statement as ESTree.ExpressionStatement).expression as ESTree.CallExpression;
    return fixtureDeclarationsOf(call).map((declaration) => ({
      name: declaration.name,
      form: declaration.form,
      subjects: declaration.subjects.map((subject) => subject.type),
    }));
  })
  .extend("shapesOfTheOlderObjectForm", () => {
    const statement = parseSync(
      "spec.ts",
      "test.extend({ port: 3000, report: async ({ port }, use) => { await use(await runSut(port)); } });",
    ).program.body[0] as ESTree.Statement;
    const call = (statement as ESTree.ExpressionStatement).expression as ESTree.CallExpression;
    return fixtureDeclarationsOf(call).map((declaration) => ({
      name: declaration.name,
      form: declaration.form,
      subjects: declaration.subjects.map((subject) => subject.type),
    }));
  })
  .extend("shapesOfTheOlderObjectFormWrittenAsAMethod", () => {
    const statement = parseSync(
      "spec.ts",
      "test.extend({ async report({ port }, use) { await use(runSut(port)); } });",
    ).program.body[0] as ESTree.Statement;
    const call = (statement as ESTree.ExpressionStatement).expression as ESTree.CallExpression;
    return fixtureDeclarationsOf(call).map((declaration) => ({
      name: declaration.name,
      form: declaration.form,
      subjects: declaration.subjects.map((subject) => subject.type),
    }));
  })
  .extend("shapesOfAScopedFixtureWrittenAsATuple", () => {
    const statement = parseSync(
      "spec.ts",
      'test.extend({ store: [async ({}, use) => { await use(openStore()); }, { scope: "worker" }] });',
    ).program.body[0] as ESTree.Statement;
    const call = (statement as ESTree.ExpressionStatement).expression as ESTree.CallExpression;
    return fixtureDeclarationsOf(call).map((declaration) => ({
      name: declaration.name,
      form: declaration.form,
      subjects: declaration.subjects.map((subject) => subject.type),
    }));
  })
  .extend("shapesOfAnOlderFormFactoryThatNeverNamesItsHandoff", () => {
    const statement = parseSync(
      "spec.ts",
      "test.extend({ report: async ({ port }) => { runSut(port); } });",
    ).program.body[0] as ESTree.Statement;
    const call = (statement as ESTree.ExpressionStatement).expression as ESTree.CallExpression;
    return fixtureDeclarationsOf(call).map((declaration) => ({
      name: declaration.name,
      form: declaration.form,
      subjects: declaration.subjects.map((subject) => subject.type),
    }));
  })
  .extend("declarationsOfAPropertyKeyedAtRunTime", () => {
    const statement = parseSync("spec.ts", "test.extend({ [chosen]: () => runSut() });").program
      .body[0] as ESTree.Statement;
    const call = (statement as ESTree.ExpressionStatement).expression as ESTree.CallExpression;
    return fixtureDeclarationsOf(call);
  })
  .extend("declarationsOfABuilderHandedASpread", () => {
    const statement = parseSync("spec.ts", "test.extend(...declarations);").program
      .body[0] as ESTree.Statement;
    const call = (statement as ESTree.ExpressionStatement).expression as ESTree.CallExpression;
    return fixtureDeclarationsOf(call);
  })
  .extend("declarationsOfABuilderHandedNeitherANameNorAnObject", () => {
    const statement = parseSync("spec.ts", "test.extend(declarations);").program
      .body[0] as ESTree.Statement;
    const call = (statement as ESTree.ExpressionStatement).expression as ESTree.CallExpression;
    return fixtureDeclarationsOf(call);
  })
  .extend("declarationsOfABuilderCarryingNoFactory", () => {
    const statement = parseSync("spec.ts", 'test.extend("report");').program
      .body[0] as ESTree.ExpressionStatement;
    const call = statement.expression;
    return call.type !== "CallExpression"
      ? null
      : fixtureDeclarationsOf(call).map((declaration) => ({
          name: declaration.name,
          form: declaration.form,
          factory: declaration.factory,
          subjects: declaration.subjects,
        }));
  })
  .extend("declarationsOfAScopedFixtureCarryingNoHead", () => {
    const statement = parseSync("spec.ts", "test.extend({ report: [] });").program
      .body[0] as ESTree.ExpressionStatement;
    const call = statement.expression;
    return call.type !== "CallExpression"
      ? null
      : fixtureDeclarationsOf(call).map((declaration) => ({
          name: declaration.name,
          form: declaration.form,
          factory: declaration.factory,
          subjects: declaration.subjects,
        }));
  })
  .extend("declarationsOfAnObjectThatOnlySpreadsAnotherObject", () => {
    const statement = parseSync("spec.ts", "test.extend({ ...shared });").program
      .body[0] as ESTree.ExpressionStatement;
    const call = statement.expression;
    return call.type !== "CallExpression" ? null : fixtureDeclarationsOf(call);
  })
  .extend("declarationsOfABuilderHandedNothing", () => {
    const statement = parseSync("spec.ts", "test.extend();").program
      .body[0] as ESTree.ExpressionStatement;
    const call = statement.expression;
    return call.type !== "CallExpression" ? null : fixtureDeclarationsOf(call);
  })
  .extend("namesAndBindingsOfTheDependenciesAFactoryTakesApart", () => {
    const statement = parseSync(
      "spec.ts",
      'test.extend("report", async ({ port, store: warehouse, [chosen]: picked }) => runSut());',
    ).program.body[0] as ESTree.Statement;
    const call = (statement as ESTree.ExpressionStatement).expression as ESTree.CallExpression;
    const [declaration] = fixtureDeclarationsOf(call);
    return (fixtureDependenciesOf(declaration?.factory as SpecFunction) ?? []).map((dependency) => [
      dependency.name,
      dependency.boundAs,
    ]);
  })
  .extend("nodeKindsBehindTheDependenciesAFactoryTakesApart", () => {
    const statement = parseSync(
      "spec.ts",
      'test.extend("report", async ({ port }) => runSut(port));',
    ).program.body[0] as ESTree.Statement;
    const call = (statement as ESTree.ExpressionStatement).expression as ESTree.CallExpression;
    const [declaration] = fixtureDeclarationsOf(call);
    return (fixtureDependenciesOf(declaration?.factory as SpecFunction) ?? []).map(
      (dependency) => dependency.property.type,
    );
  })
  .extend("dependenciesOfAFactoryTakingTheContextWhole", () => {
    const statement = parseSync(
      "spec.ts",
      'test.extend("report", async (context) => runSut(context));',
    ).program.body[0] as ESTree.Statement;
    const call = (statement as ESTree.ExpressionStatement).expression as ESTree.CallExpression;
    const [declaration] = fixtureDeclarationsOf(call);
    return fixtureDependenciesOf(declaration?.factory as SpecFunction);
  })
  .extend("contextNameOfAFactoryTakingTheContextWhole", () => {
    const statement = parseSync(
      "spec.ts",
      'test.extend("report", async (context) => runSut(context));',
    ).program.body[0] as ESTree.Statement;
    const call = (statement as ESTree.ExpressionStatement).expression as ESTree.CallExpression;
    const [declaration] = fixtureDeclarationsOf(call);
    return fixtureContextParameterName(declaration?.factory as SpecFunction);
  })
  .extend("contextNameOfAFactoryTakingItsDependenciesApart", () => {
    const statement = parseSync(
      "spec.ts",
      'test.extend("report", async ({ port }) => runSut(port));',
    ).program.body[0] as ESTree.Statement;
    const call = (statement as ESTree.ExpressionStatement).expression as ESTree.CallExpression;
    const [declaration] = fixtureDeclarationsOf(call);
    return fixtureContextParameterName(declaration?.factory as SpecFunction);
  });

describe("what a fixture builder declares", () => {
  it("a builder call on the test base declares a fixture", ({
    verdictOnABuilderCallOnTheTestBase,
  }) => {
    expect(verdictOnABuilderCallOnTheTestBase).toBe(true);
  });

  it("a builder call on a fixture already derived from the base declares a fixture too", ({
    verdictOnABuilderCallOnADerivedFixture,
  }) => {
    expect(verdictOnABuilderCallOnADerivedFixture).toBe(true);
  });

  it("registering a custom matcher shares the member name but is not a builder call", ({
    verdictOnACustomMatcherRegistration,
  }) => {
    expect(verdictOnACustomMatcherRegistration).toBe(false);
  });

  it("registering a custom matcher declares no fixture", ({
    declarationsOfACustomMatcherRegistration,
  }) => {
    expect(declarationsOfACustomMatcherRegistration).toStrictEqual([]);
  });

  it("a member that is not the builder declares no fixture", ({
    verdictOnAMemberThatIsNotTheBuilder,
  }) => {
    expect(verdictOnAMemberThatIsNotTheBuilder).toBe(false);
  });

  it("the member that scopes a value is not the builder either", ({ verdictOnTheScopedMember }) => {
    expect(verdictOnTheScopedMember).toBe(false);
  });

  it("a builder written with a name and a factory hands back what the factory returns", ({
    shapesOfABuilderWrittenWithANameAndAFactory,
  }) => {
    expect(shapesOfABuilderWrittenWithANameAndAFactory).toStrictEqual([
      { name: "report", form: "builder", subjects: ["AwaitExpression"] },
    ]);
  });

  it("a builder written with options between the name and the factory reads the same way", ({
    shapesOfABuilderCarryingOptionsBetweenTheNameAndTheFactory,
  }) => {
    expect(shapesOfABuilderCarryingOptionsBetweenTheNameAndTheFactory).toStrictEqual([
      { name: "report", form: "builder", subjects: ["CallExpression"] },
    ]);
  });

  it("a builder handed a plain expression takes that expression as the subject", ({
    shapesOfABuilderHandedAPlainExpression,
  }) => {
    expect(shapesOfABuilderHandedAPlainExpression).toStrictEqual([
      { name: "port", form: "builder", subjects: ["Literal"] },
    ]);
  });

  it("a builder name written as a template without a substitution is read the same way", ({
    shapesOfABuilderNamedByATemplateWithoutASubstitution,
  }) => {
    expect(shapesOfABuilderNamedByATemplateWithoutASubstitution).toStrictEqual([
      { name: "report", form: "builder", subjects: ["CallExpression"] },
    ]);
  });

  it("a factory with several returns offers every subject it can hand back", ({
    shapesOfAFactoryWithSeveralReturns,
  }) => {
    expect(shapesOfAFactoryWithSeveralReturns).toStrictEqual([
      { name: "report", form: "builder", subjects: ["CallExpression", "Literal"] },
    ]);
  });

  it("the older object form declares one fixture per property", ({
    shapesOfTheOlderObjectForm,
  }) => {
    expect(shapesOfTheOlderObjectForm).toStrictEqual([
      { name: "port", form: "object", subjects: ["Literal"] },
      { name: "report", form: "object", subjects: ["AwaitExpression"] },
    ]);
  });

  it("the older object form written as a method declares the same fixture", ({
    shapesOfTheOlderObjectFormWrittenAsAMethod,
  }) => {
    expect(shapesOfTheOlderObjectFormWrittenAsAMethod).toStrictEqual([
      { name: "report", form: "object", subjects: ["CallExpression"] },
    ]);
  });

  it("a scoped fixture written as a tuple reads its factory out of the first slot", ({
    shapesOfAScopedFixtureWrittenAsATuple,
  }) => {
    expect(shapesOfAScopedFixtureWrittenAsATuple).toStrictEqual([
      { name: "store", form: "object", subjects: ["CallExpression"] },
    ]);
  });

  it("an older-form factory that never names its handoff hands back no subject", ({
    shapesOfAnOlderFormFactoryThatNeverNamesItsHandoff,
  }) => {
    expect(shapesOfAnOlderFormFactoryThatNeverNamesItsHandoff).toStrictEqual([
      { name: "report", form: "object", subjects: [] },
    ]);
  });

  it("a property whose key is chosen at run time declares no fixture this reading can name", ({
    declarationsOfAPropertyKeyedAtRunTime,
  }) => {
    expect(declarationsOfAPropertyKeyedAtRunTime).toStrictEqual([]);
  });

  it("a spread in the builder arguments leaves the declaration unreadable", ({
    declarationsOfABuilderHandedASpread,
  }) => {
    expect(declarationsOfABuilderHandedASpread).toStrictEqual([]);
  });

  it("a builder handed neither a name nor an object declares nothing", ({
    declarationsOfABuilderHandedNeitherANameNorAnObject,
  }) => {
    expect(declarationsOfABuilderHandedNeitherANameNorAnObject).toStrictEqual([]);
  });
});

describe("what a fixture factory depends on", () => {
  it("a factory taking its dependencies apart names each one and the name it binds it to", ({
    namesAndBindingsOfTheDependenciesAFactoryTakesApart,
  }) => {
    expect(namesAndBindingsOfTheDependenciesAFactoryTakesApart).toStrictEqual([
      ["port", "port"],
      ["store", "warehouse"],
    ]);
  });

  it("each named dependency points at the property that declared it", ({
    nodeKindsBehindTheDependenciesAFactoryTakesApart,
  }) => {
    expect(nodeKindsBehindTheDependenciesAFactoryTakesApart).toStrictEqual(["Property"]);
  });

  it("a factory taking the context whole declares no dependency this reading can name", ({
    dependenciesOfAFactoryTakingTheContextWhole,
  }) => {
    expect(dependenciesOfAFactoryTakingTheContextWhole).toBe(null);
  });

  it("a factory taking the context whole binds it to the name it was written with", ({
    contextNameOfAFactoryTakingTheContextWhole,
  }) => {
    expect(contextNameOfAFactoryTakingTheContextWhole).toBe("context");
  });

  it("a factory taking its dependencies apart binds the context to no single name", ({
    contextNameOfAFactoryTakingItsDependenciesApart,
  }) => {
    expect(contextNameOfAFactoryTakingItsDependenciesApart).toBe(null);
  });

  it("a builder handed a name and nothing else declares a fixture that stands up no subject", ({
    declarationsOfABuilderCarryingNoFactory,
  }) => {
    expect(declarationsOfABuilderCarryingNoFactory).toStrictEqual([
      { name: "report", form: "builder", factory: null, subjects: [] },
    ]);
  });

  it("a scoped fixture written as an empty array carries no factory at its head", ({
    declarationsOfAScopedFixtureCarryingNoHead,
  }) => {
    expect(declarationsOfAScopedFixtureCarryingNoHead).toStrictEqual([
      { name: "report", form: "object", factory: null, subjects: [] },
    ]);
  });

  it("an object that only spreads another object declares no fixture this reading can name", ({
    declarationsOfAnObjectThatOnlySpreadsAnotherObject,
  }) => {
    expect(declarationsOfAnObjectThatOnlySpreadsAnotherObject).toStrictEqual([]);
  });

  it("a builder handed nothing at all declares no fixture", ({
    declarationsOfABuilderHandedNothing,
  }) => {
    expect(declarationsOfABuilderHandedNothing).toStrictEqual([]);
  });
});
