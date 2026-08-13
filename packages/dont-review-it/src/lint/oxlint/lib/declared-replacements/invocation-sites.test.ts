import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { handedTextsOf, spawnRoutesIn, spawnSiteAt } from "./invocation-sites.ts";
import { DEFAULT_SPAWN_FORMS, SPAWN_TARGET_LINE, SPAWN_TARGET_NAME } from "./spawn-forms.ts";

import type { ESTree } from "@oxlint/plugins";

const SPEC_FILE = "spec.ts";

describe("spawnSiteAt", () => {
  describe("something other than a node", () => {
    const it = test.extend("site", () =>
      spawnSiteAt({ node: "exec('lerna')", routes: new Map(), forms: DEFAULT_SPAWN_FORMS }));

    it("reaches no starting form", ({ site }) => {
      expect(site).toBe(null);
    });
  });

  describe("an expression that calls nothing", () => {
    const it = test.extend("site", () => {
      const statements = parseSync(SPEC_FILE, "started;").program.body.map(
        (statement) => statement as ESTree.Statement,
      );
      const last = statements.at(-1);
      return spawnSiteAt({
        node: last?.type === "ExpressionStatement" ? last.expression : null,
        routes: spawnRoutesIn({ body: statements, filename: SPEC_FILE }),
        forms: DEFAULT_SPAWN_FORMS,
      });
    });

    it("reaches no starting form", ({ site }) => {
      expect(site).toBe(null);
    });
  });

  describe("a call to a binding nothing imports", () => {
    const it = test.extend("site", () => {
      const statements = parseSync(SPEC_FILE, 'exec("lerna");').program.body.map(
        (statement) => statement as ESTree.Statement,
      );
      const last = statements.at(-1);
      return spawnSiteAt({
        node: last?.type === "ExpressionStatement" ? last.expression : null,
        routes: spawnRoutesIn({ body: statements, filename: SPEC_FILE }),
        forms: DEFAULT_SPAWN_FORMS,
      });
    });

    it("reaches no starting form", ({ site }) => {
      expect(site).toBe(null);
    });
  });

  describe("a call to a module the table says nothing about", () => {
    const it = test.extend("site", () => {
      const statements = parseSync(
        SPEC_FILE,
        'import { readFile } from "node:fs";\nreadFile("list");',
      ).program.body.map((statement) => statement as ESTree.Statement);
      const last = statements.at(-1);
      return spawnSiteAt({
        node: last?.type === "ExpressionStatement" ? last.expression : null,
        routes: spawnRoutesIn({ body: statements, filename: SPEC_FILE }),
        forms: DEFAULT_SPAWN_FORMS,
      });
    });

    it("reaches no starting form", ({ site }) => {
      expect(site).toBe(null);
    });
  });

  describe("a call to an imported starting form", () => {
    const it = test
      .extend("form", () => {
        const statements = parseSync(
          SPEC_FILE,
          'import { exec } from "node:child_process";\nexec("lerna run build");',
        ).program.body.map((statement) => statement as ESTree.Statement);
        const last = statements.at(-1);
        const site = spawnSiteAt({
          node: last?.type === "ExpressionStatement" ? last.expression : null,
          routes: spawnRoutesIn({ body: statements, filename: SPEC_FILE }),
          forms: DEFAULT_SPAWN_FORMS,
        });
        if (site === null) throw new Error("no starting form was reached");
        const { form } = site;
        return form;
      })
      .extend("spelledTarget", () => {
        const statements = parseSync(
          SPEC_FILE,
          'import { exec } from "node:child_process";\nexec("lerna run build");',
        ).program.body.map((statement) => statement as ESTree.Statement);
        const last = statements.at(-1);
        const site = spawnSiteAt({
          node: last?.type === "ExpressionStatement" ? last.expression : null,
          routes: spawnRoutesIn({ body: statements, filename: SPEC_FILE }),
          forms: DEFAULT_SPAWN_FORMS,
        });
        if (site === null) throw new Error("no starting form was reached");
        const { target } = site;
        if (target === null) throw new Error("no target was carried");
        const { value: spelledTarget } = target;
        return spelledTarget;
      });

    it("is read through the entry that carries a command line", ({ form }) => {
      expect(form).toStrictEqual({
        specifier: "node:child_process",
        exported: "exec",
        position: 0,
        carries: SPAWN_TARGET_LINE,
      });
    });

    it("carries the argument that names the command", ({ spelledTarget }) => {
      expect(spelledTarget).toBe("lerna run build");
    });
  });

  describe("a call taking no argument", () => {
    const it = test.extend("carriedTarget", () => {
      const statements = parseSync(
        SPEC_FILE,
        'import { execSync } from "node:child_process";\nexecSync();',
      ).program.body.map((statement) => statement as ESTree.Statement);
      const last = statements.at(-1);
      const site = spawnSiteAt({
        node: last?.type === "ExpressionStatement" ? last.expression : null,
        routes: spawnRoutesIn({ body: statements, filename: SPEC_FILE }),
        forms: DEFAULT_SPAWN_FORMS,
      });
      if (site === null) throw new Error("no starting form was reached");
      const { target: carriedTarget } = site;
      return carriedTarget;
    });

    it("carries no target", ({ carriedTarget }) => {
      expect(carriedTarget).toBe(null);
    });
  });

  describe("a member of a whole module import", () => {
    const it = test
      .extend("form", () => {
        const statements = parseSync(
          SPEC_FILE,
          'import * as childProcess from "node:child_process";\nchildProcess.spawn("lerna", ["run"]);',
        ).program.body.map((statement) => statement as ESTree.Statement);
        const last = statements.at(-1);
        const site = spawnSiteAt({
          node: last?.type === "ExpressionStatement" ? last.expression : null,
          routes: spawnRoutesIn({ body: statements, filename: SPEC_FILE }),
          forms: DEFAULT_SPAWN_FORMS,
        });
        if (site === null) throw new Error("no starting form was reached");
        const { form } = site;
        return form;
      })
      .extend("spelledTarget", () => {
        const statements = parseSync(
          SPEC_FILE,
          'import * as childProcess from "node:child_process";\nchildProcess.spawn("lerna", ["run"]);',
        ).program.body.map((statement) => statement as ESTree.Statement);
        const last = statements.at(-1);
        const site = spawnSiteAt({
          node: last?.type === "ExpressionStatement" ? last.expression : null,
          routes: spawnRoutesIn({ body: statements, filename: SPEC_FILE }),
          forms: DEFAULT_SPAWN_FORMS,
        });
        if (site === null) throw new Error("no starting form was reached");
        const { target } = site;
        if (target === null) throw new Error("no target was carried");
        const { value: spelledTarget } = target;
        return spelledTarget;
      });

    it("is read through the entry that carries a name", ({ form }) => {
      expect(form).toStrictEqual({
        specifier: "node:child_process",
        exported: "spawn",
        position: 0,
        carries: SPAWN_TARGET_NAME,
      });
    });

    it("carries the argument that names the command", ({ spelledTarget }) => {
      expect(spelledTarget).toBe("lerna");
    });
  });

  describe("a member of a default import", () => {
    const it = test.extend("spelledTarget", () => {
      const statements = parseSync(
        SPEC_FILE,
        'import childProcess from "node:child_process";\nchildProcess.execSync("lerna");',
      ).program.body.map((statement) => statement as ESTree.Statement);
      const last = statements.at(-1);
      const site = spawnSiteAt({
        node: last?.type === "ExpressionStatement" ? last.expression : null,
        routes: spawnRoutesIn({ body: statements, filename: SPEC_FILE }),
        forms: DEFAULT_SPAWN_FORMS,
      });
      if (site === null) throw new Error("no starting form was reached");
      const { target } = site;
      if (target === null) throw new Error("no target was carried");
      const { value: spelledTarget } = target;
      return spelledTarget;
    });

    it("carries the argument that names the command", ({ spelledTarget }) => {
      expect(spelledTarget).toBe("lerna");
    });
  });

  describe("a member written as a subscript", () => {
    const it = test.extend("site", () => {
      const statements = parseSync(
        SPEC_FILE,
        'import * as childProcess from "node:child_process";\nchildProcess["exec"]("lerna");',
      ).program.body.map((statement) => statement as ESTree.Statement);
      const last = statements.at(-1);
      return spawnSiteAt({
        node: last?.type === "ExpressionStatement" ? last.expression : null,
        routes: spawnRoutesIn({ body: statements, filename: SPEC_FILE }),
        forms: DEFAULT_SPAWN_FORMS,
      });
    });

    it("reaches no starting form", ({ site }) => {
      expect(site).toBe(null);
    });
  });

  describe("a member of a named import", () => {
    const it = test.extend("site", () => {
      const statements = parseSync(
        SPEC_FILE,
        'import { promises } from "node:fs";\npromises.exec("lerna");',
      ).program.body.map((statement) => statement as ESTree.Statement);
      const last = statements.at(-1);
      return spawnSiteAt({
        node: last?.type === "ExpressionStatement" ? last.expression : null,
        routes: spawnRoutesIn({ body: statements, filename: SPEC_FILE }),
        forms: DEFAULT_SPAWN_FORMS,
      });
    });

    it("reaches no starting form", ({ site }) => {
      expect(site).toBe(null);
    });
  });

  describe("a member of a binding nothing imports", () => {
    const it = test.extend("site", () => {
      const statements = parseSync(SPEC_FILE, 'runner.exec("lerna");').program.body.map(
        (statement) => statement as ESTree.Statement,
      );
      const last = statements.at(-1);
      return spawnSiteAt({
        node: last?.type === "ExpressionStatement" ? last.expression : null,
        routes: spawnRoutesIn({ body: statements, filename: SPEC_FILE }),
        forms: DEFAULT_SPAWN_FORMS,
      });
    });

    it("reaches no starting form", ({ site }) => {
      expect(site).toBe(null);
    });
  });

  describe("a member written on something other than a name", () => {
    const it = test.extend("site", () =>
      spawnSiteAt({
        node: {
          type: "CallExpression",
          callee: { type: "MemberExpression", object: null, property: null },
          arguments: [],
        },
        routes: new Map(),
        forms: DEFAULT_SPAWN_FORMS,
      }));

    it("reaches no starting form", ({ site }) => {
      expect(site).toBe(null);
    });
  });

  describe("a template tag written on something other than a name", () => {
    const it = test.extend("site", () =>
      spawnSiteAt({
        node: { type: "TaggedTemplateExpression", tag: null },
        routes: new Map(),
        forms: DEFAULT_SPAWN_FORMS,
      }));

    it("reaches no starting form", ({ site }) => {
      expect(site).toBe(null);
    });
  });

  describe("a tagged template", () => {
    const it = test
      .extend("form", () => {
        const statements = parseSync(
          SPEC_FILE,
          'import { $ } from "execa";\n$`lerna run build`;',
        ).program.body.map((statement) => statement as ESTree.Statement);
        const last = statements.at(-1);
        const site = spawnSiteAt({
          node: last?.type === "ExpressionStatement" ? last.expression : null,
          routes: spawnRoutesIn({ body: statements, filename: SPEC_FILE }),
          forms: DEFAULT_SPAWN_FORMS,
        });
        if (site === null) throw new Error("no starting form was reached");
        const { form } = site;
        return form;
      })
      .extend("targetSpelling", () => {
        const statements = parseSync(
          SPEC_FILE,
          'import { $ } from "execa";\n$`lerna run build`;',
        ).program.body.map((statement) => statement as ESTree.Statement);
        const last = statements.at(-1);
        const site = spawnSiteAt({
          node: last?.type === "ExpressionStatement" ? last.expression : null,
          routes: spawnRoutesIn({ body: statements, filename: SPEC_FILE }),
          forms: DEFAULT_SPAWN_FORMS,
        });
        if (site === null) throw new Error("no starting form was reached");
        const { target } = site;
        if (target === null) throw new Error("no target was carried");
        const { type: targetSpelling } = target;
        return targetSpelling;
      });

    it("is read through an entry that carries the line it spells out", ({ form }) => {
      expect(form).toStrictEqual({
        specifier: "execa",
        exported: "$",
        position: 0,
        carries: SPAWN_TARGET_LINE,
      });
    });

    it("carries the line it spells out", ({ targetSpelling }) => {
      expect(targetSpelling).toBe("TemplateLiteral");
    });
  });

  describe("a binding taken apart from a synchronous request", () => {
    const it = test.extend("spelledTarget", () => {
      const statements = parseSync(
        SPEC_FILE,
        'const { exec } = require("node:child_process");\nexec("lerna");',
      ).program.body.map((statement) => statement as ESTree.Statement);
      const last = statements.at(-1);
      const site = spawnSiteAt({
        node: last?.type === "ExpressionStatement" ? last.expression : null,
        routes: spawnRoutesIn({ body: statements, filename: SPEC_FILE }),
        forms: DEFAULT_SPAWN_FORMS,
      });
      if (site === null) throw new Error("no starting form was reached");
      const { target } = site;
      if (target === null) throw new Error("no target was carried");
      const { value: spelledTarget } = target;
      return spelledTarget;
    });

    it("keeps the route it came through", ({ spelledTarget }) => {
      expect(spelledTarget).toBe("lerna");
    });
  });

  describe("a whole module bound from a synchronous request", () => {
    const it = test.extend("spelledTarget", () => {
      const statements = parseSync(
        SPEC_FILE,
        'const cp = require("node:child_process");\ncp.execSync("lerna");',
      ).program.body.map((statement) => statement as ESTree.Statement);
      const last = statements.at(-1);
      const site = spawnSiteAt({
        node: last?.type === "ExpressionStatement" ? last.expression : null,
        routes: spawnRoutesIn({ body: statements, filename: SPEC_FILE }),
        forms: DEFAULT_SPAWN_FORMS,
      });
      if (site === null) throw new Error("no starting form was reached");
      const { target } = site;
      if (target === null) throw new Error("no target was carried");
      const { value: spelledTarget } = target;
      return spelledTarget;
    });

    it("keeps the route it came through", ({ spelledTarget }) => {
      expect(spelledTarget).toBe("lerna");
    });
  });

  describe("a binding taken apart under a subscript", () => {
    const it = test.extend("site", () => {
      const statements = parseSync(
        SPEC_FILE,
        'const { [named]: exec } = require("node:child_process");\nexec("lerna");',
      ).program.body.map((statement) => statement as ESTree.Statement);
      const last = statements.at(-1);
      return spawnSiteAt({
        node: last?.type === "ExpressionStatement" ? last.expression : null,
        routes: spawnRoutesIn({ body: statements, filename: SPEC_FILE }),
        forms: DEFAULT_SPAWN_FORMS,
      });
    });

    it("reaches no starting form", ({ site }) => {
      expect(site).toBe(null);
    });
  });

  describe("a binding taken apart under a written-out key", () => {
    const it = test.extend("site", () => {
      const statements = parseSync(
        SPEC_FILE,
        'const { "exec": run } = require("node:child_process");\nrun("lerna");',
      ).program.body.map((statement) => statement as ESTree.Statement);
      const last = statements.at(-1);
      return spawnSiteAt({
        node: last?.type === "ExpressionStatement" ? last.expression : null,
        routes: spawnRoutesIn({ body: statements, filename: SPEC_FILE }),
        forms: DEFAULT_SPAWN_FORMS,
      });
    });

    it("reaches no starting form", ({ site }) => {
      expect(site).toBe(null);
    });
  });

  describe("a binding taken apart into a further pattern", () => {
    const it = test.extend("site", () => {
      const statements = parseSync(
        SPEC_FILE,
        'const { exec: { inner } } = require("node:child_process");\ninner("lerna");',
      ).program.body.map((statement) => statement as ESTree.Statement);
      const last = statements.at(-1);
      return spawnSiteAt({
        node: last?.type === "ExpressionStatement" ? last.expression : null,
        routes: spawnRoutesIn({ body: statements, filename: SPEC_FILE }),
        forms: DEFAULT_SPAWN_FORMS,
      });
    });

    it("reaches no starting form", ({ site }) => {
      expect(site).toBe(null);
    });
  });

  describe("a binding taken apart into a list", () => {
    const it = test.extend("site", () => {
      const statements = parseSync(
        SPEC_FILE,
        'const [exec] = require("node:child_process");\nexec("lerna");',
      ).program.body.map((statement) => statement as ESTree.Statement);
      const last = statements.at(-1);
      return spawnSiteAt({
        node: last?.type === "ExpressionStatement" ? last.expression : null,
        routes: spawnRoutesIn({ body: statements, filename: SPEC_FILE }),
        forms: DEFAULT_SPAWN_FORMS,
      });
    });

    it("keeps no route", ({ site }) => {
      expect(site).toBe(null);
    });
  });

  describe("a member written on another member", () => {
    const it = test.extend("site", () => {
      const statements = parseSync(
        SPEC_FILE,
        'import * as childProcess from "node:child_process";\nchildProcess.inner.exec("x");',
      ).program.body.map((statement) => statement as ESTree.Statement);
      const last = statements.at(-1);
      return spawnSiteAt({
        node: last?.type === "ExpressionStatement" ? last.expression : null,
        routes: spawnRoutesIn({ body: statements, filename: SPEC_FILE }),
        forms: DEFAULT_SPAWN_FORMS,
      });
    });

    it("reaches no starting form", ({ site }) => {
      expect(site).toBe(null);
    });
  });

  describe("a declaration that is not a constant", () => {
    const it = test.extend("site", () => {
      const statements = parseSync(
        SPEC_FILE,
        'let exec = require("node:child_process").exec;\nexec("lerna");',
      ).program.body.map((statement) => statement as ESTree.Statement);
      const last = statements.at(-1);
      return spawnSiteAt({
        node: last?.type === "ExpressionStatement" ? last.expression : null,
        routes: spawnRoutesIn({ body: statements, filename: SPEC_FILE }),
        forms: DEFAULT_SPAWN_FORMS,
      });
    });

    it("keeps no route", ({ site }) => {
      expect(site).toBe(null);
    });
  });

  describe("a wrapper built around a starting form", () => {
    const it = test.extend("spelledTarget", () => {
      const statements = parseSync(
        SPEC_FILE,
        'import { promisify } from "node:util";\nimport { exec } from "node:child_process";\nconst run = promisify(exec);\nrun("lerna run build");',
      ).program.body.map((statement) => statement as ESTree.Statement);
      const last = statements.at(-1);
      const site = spawnSiteAt({
        node: last?.type === "ExpressionStatement" ? last.expression : null,
        routes: spawnRoutesIn({ body: statements, filename: SPEC_FILE }),
        forms: DEFAULT_SPAWN_FORMS,
      });
      if (site === null) throw new Error("no starting form was reached");
      const { target } = site;
      if (target === null) throw new Error("no target was carried");
      const { value: spelledTarget } = target;
      return spelledTarget;
    });

    it("keeps the route it wraps", ({ spelledTarget }) => {
      expect(spelledTarget).toBe("lerna run build");
    });
  });

  describe("a wrapper exported where it is built", () => {
    const it = test.extend("spelledTarget", () => {
      const statements = parseSync(
        SPEC_FILE,
        'import { promisify } from "node:util";\nimport { exec } from "node:child_process";\nexport const run = promisify(exec);\nrun("lerna");',
      ).program.body.map((statement) => statement as ESTree.Statement);
      const last = statements.at(-1);
      const site = spawnSiteAt({
        node: last?.type === "ExpressionStatement" ? last.expression : null,
        routes: spawnRoutesIn({ body: statements, filename: SPEC_FILE }),
        forms: DEFAULT_SPAWN_FORMS,
      });
      if (site === null) throw new Error("no starting form was reached");
      const { target } = site;
      if (target === null) throw new Error("no target was carried");
      const { value: spelledTarget } = target;
      return spelledTarget;
    });

    it("keeps the route it wraps", ({ spelledTarget }) => {
      expect(spelledTarget).toBe("lerna");
    });
  });

  describe("an export of names already bound", () => {
    const it = test.extend("spelledTarget", () => {
      const statements = parseSync(
        SPEC_FILE,
        'import { exec } from "node:child_process";\nexport { exec };\nexec("lerna");',
      ).program.body.map((statement) => statement as ESTree.Statement);
      const last = statements.at(-1);
      const site = spawnSiteAt({
        node: last?.type === "ExpressionStatement" ? last.expression : null,
        routes: spawnRoutesIn({ body: statements, filename: SPEC_FILE }),
        forms: DEFAULT_SPAWN_FORMS,
      });
      if (site === null) throw new Error("no starting form was reached");
      const { target } = site;
      if (target === null) throw new Error("no target was carried");
      const { value: spelledTarget } = target;
      return spelledTarget;
    });

    it("keeps no further route", ({ spelledTarget }) => {
      expect(spelledTarget).toBe("lerna");
    });
  });

  describe("a wrapper handed no route of its own", () => {
    const it = test.extend("site", () => {
      const statements = parseSync(
        SPEC_FILE,
        'const run = promisify("exec");\nrun("lerna");',
      ).program.body.map((statement) => statement as ESTree.Statement);
      const last = statements.at(-1);
      return spawnSiteAt({
        node: last?.type === "ExpressionStatement" ? last.expression : null,
        routes: spawnRoutesIn({ body: statements, filename: SPEC_FILE }),
        forms: DEFAULT_SPAWN_FORMS,
      });
    });

    it("keeps none", ({ site }) => {
      expect(site).toBe(null);
    });
  });

  describe("a binding holding something other than a call", () => {
    const it = test.extend("site", () => {
      const statements = parseSync(SPEC_FILE, 'const run = 1;\nrun("lerna");').program.body.map(
        (statement) => statement as ESTree.Statement,
      );
      const last = statements.at(-1);
      return spawnSiteAt({
        node: last?.type === "ExpressionStatement" ? last.expression : null,
        routes: spawnRoutesIn({ body: statements, filename: SPEC_FILE }),
        forms: DEFAULT_SPAWN_FORMS,
      });
    });

    it("keeps no route", ({ site }) => {
      expect(site).toBe(null);
    });
  });
});

describe("spawnRoutesIn", () => {
  describe("a declarator carrying neither a name nor an initializer", () => {
    const it = test.extend("routes", () =>
      spawnRoutesIn({
        body: [
          {
            type: "VariableDeclaration",
            kind: "const",
            declarations: [{ type: "VariableDeclarator", id: null, init: null }],
          },
        ],
        filename: SPEC_FILE,
      }));

    it("keeps no route", ({ routes }) => {
      expect(routes).toStrictEqual(new Map());
    });
  });
});

describe("handedTextsOf", () => {
  describe("a call spelling its arguments out one by one", () => {
    const it = test.extend("handedTexts", () => {
      const statements = parseSync(
        SPEC_FILE,
        'import { spawn } from "node:child_process";\nspawn("npx", ["lerna", "run"]);',
      ).program.body.map((statement) => statement as ESTree.Statement);
      const last = statements.at(-1);
      const site = spawnSiteAt({
        node: last?.type === "ExpressionStatement" ? last.expression : null,
        routes: spawnRoutesIn({ body: statements, filename: SPEC_FILE }),
        forms: DEFAULT_SPAWN_FORMS,
      });
      if (site === null) throw new Error("no starting form was reached");
      const { handed } = site;
      return handedTextsOf({ handed, constants: new Map() });
    });

    it("comes back as text", ({ handedTexts }) => {
      expect(handedTexts).toStrictEqual(["lerna", "run"]);
    });
  });

  describe("a call handing anything but a list", () => {
    const it = test.extend("handedTexts", () => {
      const statements = parseSync(
        SPEC_FILE,
        'import { spawn } from "node:child_process";\nspawn("npx", handed);',
      ).program.body.map((statement) => statement as ESTree.Statement);
      const last = statements.at(-1);
      const site = spawnSiteAt({
        node: last?.type === "ExpressionStatement" ? last.expression : null,
        routes: spawnRoutesIn({ body: statements, filename: SPEC_FILE }),
        forms: DEFAULT_SPAWN_FORMS,
      });
      if (site === null) throw new Error("no starting form was reached");
      const { handed } = site;
      return handedTextsOf({ handed, constants: new Map() });
    });

    it("comes back as nothing", ({ handedTexts }) => {
      expect(handedTexts).toBe(null);
    });
  });

  describe("a call nobody wrote arguments for", () => {
    const it = test.extend("handedTexts", () => {
      const statements = parseSync(
        SPEC_FILE,
        'import { spawn } from "node:child_process";\nspawn("npx");',
      ).program.body.map((statement) => statement as ESTree.Statement);
      const last = statements.at(-1);
      const site = spawnSiteAt({
        node: last?.type === "ExpressionStatement" ? last.expression : null,
        routes: spawnRoutesIn({ body: statements, filename: SPEC_FILE }),
        forms: DEFAULT_SPAWN_FORMS,
      });
      if (site === null) throw new Error("no starting form was reached");
      const { handed } = site;
      return handedTextsOf({ handed, constants: new Map() });
    });

    it("comes back as nothing", ({ handedTexts }) => {
      expect(handedTexts).toBe(null);
    });
  });

  describe("a list holding an argument nobody can fold", () => {
    const it = test.extend("handedTexts", () => {
      const statements = parseSync(
        SPEC_FILE,
        'import { spawn } from "node:child_process";\nspawn("npx", [chosen]);',
      ).program.body.map((statement) => statement as ESTree.Statement);
      const last = statements.at(-1);
      const site = spawnSiteAt({
        node: last?.type === "ExpressionStatement" ? last.expression : null,
        routes: spawnRoutesIn({ body: statements, filename: SPEC_FILE }),
        forms: DEFAULT_SPAWN_FORMS,
      });
      if (site === null) throw new Error("no starting form was reached");
      const { handed } = site;
      return handedTextsOf({ handed, constants: new Map() });
    });

    it("comes back as nothing", ({ handedTexts }) => {
      expect(handedTexts).toBe(null);
    });
  });
});
