import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { handedTextsOf, spawnRoutesIn, spawnSiteAt, type SpawnSite } from "./invocation-sites.ts";
import { DEFAULT_SPAWN_FORMS, SPAWN_TARGET_LINE, SPAWN_TARGET_NAME } from "./spawn-forms.ts";

import type { ESTree } from "@oxlint/plugins";

const SPEC_FILE = "spec.ts";

const statementsIn = (sourceText: string): readonly ESTree.Statement[] =>
  parseSync(SPEC_FILE, sourceText).program.body.map((statement) => statement as ESTree.Statement);

const lastExpressionIn = (statements: readonly ESTree.Statement[]): unknown => {
  const last = statements.at(-1);
  return last?.type === "ExpressionStatement" ? last.expression : null;
};

const siteIn = (sourceText: string): SpawnSite | null => {
  const statements = statementsIn(sourceText);
  return spawnSiteAt({
    node: lastExpressionIn(statements),
    routes: spawnRoutesIn({ body: statements, filename: SPEC_FILE }),
    forms: DEFAULT_SPAWN_FORMS,
  });
};

const spelledTarget = (site: SpawnSite | null): unknown => site?.target?.value;

describe("declared-replacements/invocation-sites", () => {
  test("something other than a node reaches no starting form", () => {
    expect(
      spawnSiteAt({ node: "exec('lerna')", routes: new Map(), forms: DEFAULT_SPAWN_FORMS }),
    ).toBeNull();
  });

  test("an expression that calls nothing reaches no starting form", () => {
    expect(siteIn("started;")).toBeNull();
  });

  test("a call to a binding nothing imports reaches no starting form", () => {
    expect(siteIn('exec("lerna");')).toBeNull();
  });

  test("a call to a module the table says nothing about reaches no starting form", () => {
    expect(siteIn('import { readFile } from "node:fs";\nreadFile("list");')).toBeNull();
  });

  test("a call to an imported starting form carries the argument that names the command", () => {
    const site = siteIn('import { exec } from "node:child_process";\nexec("lerna run build");');
    expect(site?.form.carries).toBe(SPAWN_TARGET_LINE);
    expect(spelledTarget(site)).toBe("lerna run build");
  });

  test("a call taking no argument carries no target", () => {
    const site = siteIn('import { execSync } from "node:child_process";\nexecSync();');
    expect(site?.target).toBeNull();
  });

  test("a member of a whole module import carries the argument that names the command", () => {
    const site = siteIn(
      'import * as childProcess from "node:child_process";\nchildProcess.spawn("lerna", ["run"]);',
    );
    expect(site?.form.carries).toBe(SPAWN_TARGET_NAME);
    expect(spelledTarget(site)).toBe("lerna");
  });

  test("a member of a default import carries the argument that names the command", () => {
    const site = siteIn(
      'import childProcess from "node:child_process";\nchildProcess.execSync("lerna");',
    );
    expect(spelledTarget(site)).toBe("lerna");
  });

  test("a member written as a subscript reaches no starting form", () => {
    expect(
      siteIn('import * as childProcess from "node:child_process";\nchildProcess["exec"]("lerna");'),
    ).toBeNull();
  });

  test("a member of a named import reaches no starting form", () => {
    expect(siteIn('import { promises } from "node:fs";\npromises.exec("lerna");')).toBeNull();
  });

  test("a member of a binding nothing imports reaches no starting form", () => {
    expect(siteIn('runner.exec("lerna");')).toBeNull();
  });

  test("a member written on something other than a name reaches no starting form", () => {
    expect(
      spawnSiteAt({
        node: {
          type: "CallExpression",
          callee: { type: "MemberExpression", object: null, property: null },
          arguments: [],
        },
        routes: new Map(),
        forms: DEFAULT_SPAWN_FORMS,
      }),
    ).toBeNull();
  });

  test("a template tag written on something other than a name reaches no starting form", () => {
    expect(
      spawnSiteAt({
        node: { type: "TaggedTemplateExpression", tag: null },
        routes: new Map(),
        forms: DEFAULT_SPAWN_FORMS,
      }),
    ).toBeNull();
  });

  test("a tagged template carries the line it spells out", () => {
    const site = siteIn('import { $ } from "execa";\n$`lerna run build`;');
    expect(site?.form.carries).toBe(SPAWN_TARGET_LINE);
    expect(site?.target?.type).toBe("TemplateLiteral");
  });

  test("a binding taken apart from a synchronous request keeps the route it came through", () => {
    const site = siteIn('const { exec } = require("node:child_process");\nexec("lerna");');
    expect(spelledTarget(site)).toBe("lerna");
  });

  test("a whole module bound from a synchronous request keeps the route it came through", () => {
    const site = siteIn('const cp = require("node:child_process");\ncp.execSync("lerna");');
    expect(spelledTarget(site)).toBe("lerna");
  });

  test("a binding taken apart under a subscript reaches no starting form", () => {
    expect(
      siteIn('const { [named]: exec } = require("node:child_process");\nexec("lerna");'),
    ).toBeNull();
  });

  test("a binding taken apart under a written-out key reaches no starting form", () => {
    expect(
      siteIn('const { "exec": run } = require("node:child_process");\nrun("lerna");'),
    ).toBeNull();
  });

  test("a binding taken apart into a further pattern reaches no starting form", () => {
    expect(
      siteIn('const { exec: { inner } } = require("node:child_process");\ninner("lerna");'),
    ).toBeNull();
  });

  test("a binding taken apart into a list keeps no route", () => {
    expect(siteIn('const [exec] = require("node:child_process");\nexec("lerna");')).toBeNull();
  });

  test("a member written on another member reaches no starting form", () => {
    expect(
      siteIn('import * as childProcess from "node:child_process";\nchildProcess.inner.exec("x");'),
    ).toBeNull();
  });

  test("a declarator carrying neither a name nor an initializer keeps no route", () => {
    expect(
      spawnRoutesIn({
        body: [
          {
            type: "VariableDeclaration",
            kind: "const",
            declarations: [{ type: "VariableDeclarator", id: null, init: null }],
          },
        ],
        filename: SPEC_FILE,
      }),
    ).toStrictEqual(new Map());
  });

  test("a declaration that is not a constant keeps no route", () => {
    expect(siteIn('let exec = require("node:child_process").exec;\nexec("lerna");')).toBeNull();
  });

  test("a wrapper built around a starting form keeps the route it wraps", () => {
    const site = siteIn(
      'import { promisify } from "node:util";\nimport { exec } from "node:child_process";\nconst run = promisify(exec);\nrun("lerna run build");',
    );
    expect(spelledTarget(site)).toBe("lerna run build");
  });

  test("a wrapper exported where it is built keeps the route it wraps", () => {
    const site = siteIn(
      'import { promisify } from "node:util";\nimport { exec } from "node:child_process";\nexport const run = promisify(exec);\nrun("lerna");',
    );
    expect(spelledTarget(site)).toBe("lerna");
  });

  test("an export of names already bound keeps no further route", () => {
    const site = siteIn(
      'import { exec } from "node:child_process";\nexport { exec };\nexec("lerna");',
    );
    expect(spelledTarget(site)).toBe("lerna");
  });

  test("a wrapper handed no route of its own keeps none", () => {
    expect(siteIn('const run = promisify("exec");\nrun("lerna");')).toBeNull();
  });

  test("a binding holding something other than a call keeps no route", () => {
    expect(siteIn('const run = 1;\nrun("lerna");')).toBeNull();
  });

  test("arguments spelled out one by one come back as text", () => {
    const site = siteIn(
      'import { spawn } from "node:child_process";\nspawn("npx", ["lerna", "run"]);',
    );
    expect(handedTextsOf({ handed: site?.handed ?? [], constants: new Map() })).toStrictEqual([
      "lerna",
      "run",
    ]);
  });

  test("arguments handed as anything but a list come back as nothing", () => {
    const site = siteIn('import { spawn } from "node:child_process";\nspawn("npx", handed);');
    expect(handedTextsOf({ handed: site?.handed ?? [], constants: new Map() })).toBeNull();
  });

  test("arguments nobody wrote come back as nothing", () => {
    const site = siteIn('import { spawn } from "node:child_process";\nspawn("npx");');
    expect(handedTextsOf({ handed: site?.handed ?? [], constants: new Map() })).toBeNull();
  });

  test("a list holding an argument nobody can fold comes back as nothing", () => {
    const site = siteIn('import { spawn } from "node:child_process";\nspawn("npx", [chosen]);');
    expect(handedTextsOf({ handed: site?.handed ?? [], constants: new Map() })).toBeNull();
  });
});
