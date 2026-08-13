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

describe("isFixtureBuilderCall", () => {
  describe("a builder call on the test base", () => {
    const it = test.extend("verdict", () => {
      const statement = parseSync("spec.ts", 'test.extend("subject", () => runSut());').program
        .body[0] as ESTree.Statement;
      const call = (statement as ESTree.ExpressionStatement).expression as ESTree.CallExpression;
      return isFixtureBuilderCall(call);
    });

    it("declares a fixture", ({ verdict }) => {
      expect(verdict).toBe(true);
    });
  });

  describe("a builder call on a fixture already derived from the base", () => {
    const it = test.extend("verdict", () => {
      const statement = parseSync("spec.ts", 'baseTest.extend("subject", () => runSut());').program
        .body[0] as ESTree.Statement;
      const call = (statement as ESTree.ExpressionStatement).expression as ESTree.CallExpression;
      return isFixtureBuilderCall(call);
    });

    it("declares a fixture too", ({ verdict }) => {
      expect(verdict).toBe(true);
    });
  });

  describe("registering a custom matcher", () => {
    const it = test.extend("verdict", () => {
      const statement = parseSync("spec.ts", "expect.extend({ toBeReport });").program
        .body[0] as ESTree.Statement;
      const call = (statement as ESTree.ExpressionStatement).expression as ESTree.CallExpression;
      return isFixtureBuilderCall(call);
    });

    it("shares the member name but is not a builder call", ({ verdict }) => {
      expect(verdict).toBe(false);
    });
  });

  describe("a member that is not the builder", () => {
    const it = test.extend("verdict", () => {
      const statement = parseSync("spec.ts", 'test.override("subject", () => runSut());').program
        .body[0] as ESTree.Statement;
      const call = (statement as ESTree.ExpressionStatement).expression as ESTree.CallExpression;
      return isFixtureBuilderCall(call);
    });

    it("declares no fixture", ({ verdict }) => {
      expect(verdict).toBe(false);
    });
  });

  describe("the member that scopes a value", () => {
    const it = test.extend("verdict", () => {
      const statement = parseSync("spec.ts", "test.scoped({ subject: 1 });").program
        .body[0] as ESTree.Statement;
      const call = (statement as ESTree.ExpressionStatement).expression as ESTree.CallExpression;
      return isFixtureBuilderCall(call);
    });

    it("is not the builder either", ({ verdict }) => {
      expect(verdict).toBe(false);
    });
  });

  describe("a plain call that only shares the builder's name", () => {
    const it = test.extend("verdict", () => {
      const statement = parseSync("spec.ts", 'extend("subject", () => runSut());').program
        .body[0] as ESTree.Statement;
      const call = (statement as ESTree.ExpressionStatement).expression as ESTree.CallExpression;
      return isFixtureBuilderCall(call);
    });

    it("is not a builder call", ({ verdict }) => {
      expect(verdict).toBe(false);
    });
  });
});

describe("fixtureDeclarationsOf", () => {
  describe("the builder form", () => {
    describe("a builder written with a name and a factory", () => {
      const it = test.extend("shapes", () => {
        const statement = parseSync("spec.ts", 'test.extend("report", async () => await runSut());')
          .program.body[0] as ESTree.Statement;
        const call = (statement as ESTree.ExpressionStatement).expression as ESTree.CallExpression;
        return fixtureDeclarationsOf(call).map((declaration) => ({
          name: declaration.name,
          form: declaration.form,
          subjects: declaration.subjects.map((subject) => subject.type),
        }));
      });

      it("hands back what the factory returns", ({ shapes }) => {
        expect(shapes).toStrictEqual([
          { name: "report", form: "builder", subjects: ["AwaitExpression"] },
        ]);
      });
    });

    describe("a builder carrying options between the name and the factory", () => {
      const it = test.extend("shapes", () => {
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
      });

      it("reads the same way", ({ shapes }) => {
        expect(shapes).toStrictEqual([
          { name: "report", form: "builder", subjects: ["CallExpression"] },
        ]);
      });
    });

    describe("a builder handed a plain expression", () => {
      const it = test.extend("shapes", () => {
        const statement = parseSync("spec.ts", 'test.extend("port", 3000);').program
          .body[0] as ESTree.Statement;
        const call = (statement as ESTree.ExpressionStatement).expression as ESTree.CallExpression;
        return fixtureDeclarationsOf(call).map((declaration) => ({
          name: declaration.name,
          form: declaration.form,
          subjects: declaration.subjects.map((subject) => subject.type),
        }));
      });

      it("takes that expression as the subject", ({ shapes }) => {
        expect(shapes).toStrictEqual([{ name: "port", form: "builder", subjects: ["Literal"] }]);
      });
    });

    describe("a builder name written as a template without a substitution", () => {
      const it = test.extend("shapes", () => {
        const statement = parseSync("spec.ts", "test.extend(`report`, () => runSut());").program
          .body[0] as ESTree.Statement;
        const call = (statement as ESTree.ExpressionStatement).expression as ESTree.CallExpression;
        return fixtureDeclarationsOf(call).map((declaration) => ({
          name: declaration.name,
          form: declaration.form,
          subjects: declaration.subjects.map((subject) => subject.type),
        }));
      });

      it("is read the same way", ({ shapes }) => {
        expect(shapes).toStrictEqual([
          { name: "report", form: "builder", subjects: ["CallExpression"] },
        ]);
      });
    });

    describe("a factory with several returns", () => {
      const it = test.extend("shapes", () => {
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
      });

      it("offers every subject it can hand back", ({ shapes }) => {
        expect(shapes).toStrictEqual([
          { name: "report", form: "builder", subjects: ["CallExpression", "Literal"] },
        ]);
      });
    });

    describe("a builder handed a name and nothing else", () => {
      const it = test.extend("declarations", () => {
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
      });

      it("declares a fixture that stands up no subject", ({ declarations }) => {
        expect(declarations).toStrictEqual([
          { name: "report", form: "builder", factory: null, subjects: [] },
        ]);
      });
    });

    describe("a spread in the builder arguments", () => {
      const it = test.extend("declarations", () => {
        const statement = parseSync("spec.ts", "test.extend(...declarations);").program
          .body[0] as ESTree.Statement;
        const call = (statement as ESTree.ExpressionStatement).expression as ESTree.CallExpression;
        return fixtureDeclarationsOf(call);
      });

      it("leaves the declaration unreadable", ({ declarations }) => {
        expect(declarations).toStrictEqual([]);
      });
    });

    describe("a builder handed neither a name nor an object", () => {
      const it = test.extend("declarations", () => {
        const statement = parseSync("spec.ts", "test.extend(declarations);").program
          .body[0] as ESTree.Statement;
        const call = (statement as ESTree.ExpressionStatement).expression as ESTree.CallExpression;
        return fixtureDeclarationsOf(call);
      });

      it("declares nothing", ({ declarations }) => {
        expect(declarations).toStrictEqual([]);
      });
    });

    describe("a builder handed nothing at all", () => {
      const it = test.extend("declarations", () => {
        const statement = parseSync("spec.ts", "test.extend();").program
          .body[0] as ESTree.ExpressionStatement;
        const call = statement.expression;
        return call.type !== "CallExpression" ? null : fixtureDeclarationsOf(call);
      });

      it("declares no fixture", ({ declarations }) => {
        expect(declarations).toStrictEqual([]);
      });
    });
  });

  describe("the older object form", () => {
    describe("an object carrying one property per fixture", () => {
      const it = test.extend("shapes", () => {
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
      });

      it("declares one fixture per property", ({ shapes }) => {
        expect(shapes).toStrictEqual([
          { name: "port", form: "object", subjects: ["Literal"] },
          { name: "report", form: "object", subjects: ["AwaitExpression"] },
        ]);
      });
    });

    describe("a property written as a method", () => {
      const it = test.extend("shapes", () => {
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
      });

      it("declares the same fixture", ({ shapes }) => {
        expect(shapes).toStrictEqual([
          { name: "report", form: "object", subjects: ["CallExpression"] },
        ]);
      });
    });

    describe("a scoped fixture written as a tuple", () => {
      const it = test.extend("shapes", () => {
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
      });

      it("reads its factory out of the first slot", ({ shapes }) => {
        expect(shapes).toStrictEqual([
          { name: "store", form: "object", subjects: ["CallExpression"] },
        ]);
      });
    });

    describe("a factory that never names its handoff", () => {
      const it = test.extend("shapes", () => {
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
      });

      it("hands back no subject", ({ shapes }) => {
        expect(shapes).toStrictEqual([{ name: "report", form: "object", subjects: [] }]);
      });
    });

    describe("a scoped fixture whose tuple is spread in from elsewhere", () => {
      const it = test.extend("shapes", () => {
        const statement = parseSync("spec.ts", "test.extend({ store: [...storeFixture] });").program
          .body[0] as ESTree.Statement;
        const call = (statement as ESTree.ExpressionStatement).expression as ESTree.CallExpression;
        return fixtureDeclarationsOf(call).map((declaration) => ({
          name: declaration.name,
          form: declaration.form,
          subjects: declaration.subjects.map((subject) => subject.type),
        }));
      });

      it("keeps its name and offers no subject", ({ shapes }) => {
        expect(shapes).toStrictEqual([{ name: "store", form: "object", subjects: [] }]);
      });
    });

    describe("a spread standing among written properties", () => {
      const it = test.extend("shapes", () => {
        const statement = parseSync("spec.ts", "test.extend({ ...sharedFixtures, port: 3000 });")
          .program.body[0] as ESTree.Statement;
        const call = (statement as ESTree.ExpressionStatement).expression as ESTree.CallExpression;
        return fixtureDeclarationsOf(call).map((declaration) => ({
          name: declaration.name,
          form: declaration.form,
          subjects: declaration.subjects.map((subject) => subject.type),
        }));
      });

      it("declares nothing while the written properties still do", ({ shapes }) => {
        expect(shapes).toStrictEqual([{ name: "port", form: "object", subjects: ["Literal"] }]);
      });
    });

    describe("a scoped fixture written as an empty array", () => {
      const it = test.extend("declarations", () => {
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
      });

      it("carries no factory at its head", ({ declarations }) => {
        expect(declarations).toStrictEqual([
          { name: "report", form: "object", factory: null, subjects: [] },
        ]);
      });
    });

    describe("a property whose key is chosen at run time", () => {
      const it = test.extend("declarations", () => {
        const statement = parseSync("spec.ts", "test.extend({ [chosen]: () => runSut() });").program
          .body[0] as ESTree.Statement;
        const call = (statement as ESTree.ExpressionStatement).expression as ESTree.CallExpression;
        return fixtureDeclarationsOf(call);
      });

      it("declares no fixture this reading can name", ({ declarations }) => {
        expect(declarations).toStrictEqual([]);
      });
    });

    describe("an object that only spreads another object", () => {
      const it = test.extend("declarations", () => {
        const statement = parseSync("spec.ts", "test.extend({ ...shared });").program
          .body[0] as ESTree.ExpressionStatement;
        const call = statement.expression;
        return call.type !== "CallExpression" ? null : fixtureDeclarationsOf(call);
      });

      it("declares no fixture this reading can name", ({ declarations }) => {
        expect(declarations).toStrictEqual([]);
      });
    });
  });

  describe("a call that is not the builder", () => {
    describe("registering a custom matcher", () => {
      const it = test.extend("declarations", () => {
        const statement = parseSync("spec.ts", "expect.extend({ toBeReport });").program
          .body[0] as ESTree.Statement;
        const call = (statement as ESTree.ExpressionStatement).expression as ESTree.CallExpression;
        return fixtureDeclarationsOf(call);
      });

      it("declares no fixture", ({ declarations }) => {
        expect(declarations).toStrictEqual([]);
      });
    });

    describe("a plain call that only shares the builder's name", () => {
      const it = test.extend("declarations", () => {
        const statement = parseSync("spec.ts", 'extend("subject", () => runSut());').program
          .body[0] as ESTree.Statement;
        const call = (statement as ESTree.ExpressionStatement).expression as ESTree.CallExpression;
        return fixtureDeclarationsOf(call);
      });

      it("declares no fixture", ({ declarations }) => {
        expect(declarations).toStrictEqual([]);
      });
    });
  });
});

describe("fixtureDependenciesOf", () => {
  describe("a factory taking its dependencies apart", () => {
    const it = test.extend("namesAndBindings", () => {
      const statement = parseSync(
        "spec.ts",
        'test.extend("report", async ({ port, store: warehouse, [chosen]: picked }) => runSut());',
      ).program.body[0] as ESTree.Statement;
      const call = (statement as ESTree.ExpressionStatement).expression as ESTree.CallExpression;
      const [declaration] = fixtureDeclarationsOf(call);
      return (fixtureDependenciesOf(declaration?.factory as SpecFunction) ?? []).map(
        (dependency) => [dependency.name, dependency.boundAs],
      );
    });

    it("names each one and the name it binds it to", ({ namesAndBindings }) => {
      expect(namesAndBindings).toStrictEqual([
        ["port", "port"],
        ["store", "warehouse"],
      ]);
    });
  });

  describe("each dependency a factory takes apart by name", () => {
    const it = test.extend("nodeKinds", () => {
      const statement = parseSync(
        "spec.ts",
        'test.extend("report", async ({ port }) => runSut(port));',
      ).program.body[0] as ESTree.Statement;
      const call = (statement as ESTree.ExpressionStatement).expression as ESTree.CallExpression;
      const [declaration] = fixtureDeclarationsOf(call);
      return (fixtureDependenciesOf(declaration?.factory as SpecFunction) ?? []).map(
        (dependency) => dependency.property.type,
      );
    });

    it("points at the property that declared it", ({ nodeKinds }) => {
      expect(nodeKinds).toStrictEqual(["Property"]);
    });
  });

  describe("a factory gathering the rest of the context", () => {
    const it = test.extend("namesAndBindings", () => {
      const statement = parseSync(
        "spec.ts",
        'test.extend("report", async ({ port, ...extras }) => runSut(port, extras));',
      ).program.body[0] as ESTree.Statement;
      const call = (statement as ESTree.ExpressionStatement).expression as ESTree.CallExpression;
      const [declaration] = fixtureDeclarationsOf(call);
      return (fixtureDependenciesOf(declaration?.factory as SpecFunction) ?? []).map(
        (dependency) => [dependency.name, dependency.boundAs],
      );
    });

    it("names only what it took apart by name", ({ namesAndBindings }) => {
      expect(namesAndBindings).toStrictEqual([["port", "port"]]);
    });
  });

  describe("a dependency taken further apart", () => {
    const it = test.extend("namesAndBindings", () => {
      const statement = parseSync(
        "spec.ts",
        'test.extend("report", async ({ store: { warehouse } }) => runSut(warehouse));',
      ).program.body[0] as ESTree.Statement;
      const call = (statement as ESTree.ExpressionStatement).expression as ESTree.CallExpression;
      const [declaration] = fixtureDeclarationsOf(call);
      return (fixtureDependenciesOf(declaration?.factory as SpecFunction) ?? []).map(
        (dependency) => [dependency.name, dependency.boundAs],
      );
    });

    it("is named but bound to no single name", ({ namesAndBindings }) => {
      expect(namesAndBindings).toStrictEqual([["store", null]]);
    });
  });

  describe("a factory taking the context whole", () => {
    const it = test.extend("dependencies", () => {
      const statement = parseSync(
        "spec.ts",
        'test.extend("report", async (context) => runSut(context));',
      ).program.body[0] as ESTree.Statement;
      const call = (statement as ESTree.ExpressionStatement).expression as ESTree.CallExpression;
      const [declaration] = fixtureDeclarationsOf(call);
      return fixtureDependenciesOf(declaration?.factory as SpecFunction);
    });

    it("declares no dependency this reading can name", ({ dependencies }) => {
      expect(dependencies).toBe(null);
    });
  });
});

describe("fixtureContextParameterName", () => {
  describe("a factory taking the context whole", () => {
    const it = test.extend("contextName", () => {
      const statement = parseSync(
        "spec.ts",
        'test.extend("report", async (context) => runSut(context));',
      ).program.body[0] as ESTree.Statement;
      const call = (statement as ESTree.ExpressionStatement).expression as ESTree.CallExpression;
      const [declaration] = fixtureDeclarationsOf(call);
      return fixtureContextParameterName(declaration?.factory as SpecFunction);
    });

    it("binds it to the name it was written with", ({ contextName }) => {
      expect(contextName).toBe("context");
    });
  });

  describe("a factory taking its dependencies apart", () => {
    const it = test.extend("contextName", () => {
      const statement = parseSync(
        "spec.ts",
        'test.extend("report", async ({ port }) => runSut(port));',
      ).program.body[0] as ESTree.Statement;
      const call = (statement as ESTree.ExpressionStatement).expression as ESTree.CallExpression;
      const [declaration] = fixtureDeclarationsOf(call);
      return fixtureContextParameterName(declaration?.factory as SpecFunction);
    });

    it("binds the context to no single name", ({ contextName }) => {
      expect(contextName).toBe(null);
    });
  });
});
