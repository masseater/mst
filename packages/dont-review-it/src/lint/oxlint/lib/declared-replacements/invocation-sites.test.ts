import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { handedTextsOf, spawnRoutesIn, spawnSiteAt } from "./invocation-sites.ts";
import { DEFAULT_SPAWN_FORMS, SPAWN_TARGET_LINE, SPAWN_TARGET_NAME } from "./spawn-forms.ts";

import type { ESTree } from "@oxlint/plugins";

const SPEC_FILE = "spec.ts";

const it = test
  .extend("siteOfSomethingOtherThanANode", () =>
    spawnSiteAt({ node: "exec('lerna')", routes: new Map(), forms: DEFAULT_SPAWN_FORMS }))
  .extend("siteOfAnExpressionThatCallsNothing", () => {
    const statements = parseSync(SPEC_FILE, "started;").program.body.map(
      (statement) => statement as ESTree.Statement,
    );
    const last = statements.at(-1);
    return spawnSiteAt({
      node: last?.type === "ExpressionStatement" ? last.expression : null,
      routes: spawnRoutesIn({ body: statements, filename: SPEC_FILE }),
      forms: DEFAULT_SPAWN_FORMS,
    });
  })
  .extend("siteOfACallToABindingNothingImports", () => {
    const statements = parseSync(SPEC_FILE, 'exec("lerna");').program.body.map(
      (statement) => statement as ESTree.Statement,
    );
    const last = statements.at(-1);
    return spawnSiteAt({
      node: last?.type === "ExpressionStatement" ? last.expression : null,
      routes: spawnRoutesIn({ body: statements, filename: SPEC_FILE }),
      forms: DEFAULT_SPAWN_FORMS,
    });
  })
  .extend("siteOfACallToAModuleTheTableSaysNothingAbout", () => {
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
  })
  .extend("formOfACallToAnImportedStartingForm", () => {
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
  .extend("spelledTargetOfACallToAnImportedStartingForm", () => {
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
  })
  .extend("targetOfACallTakingNoArgument", () => {
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
    const { target } = site;
    return target;
  })
  .extend("formOfAMemberOfAWholeModuleImport", () => {
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
  .extend("spelledTargetOfAMemberOfAWholeModuleImport", () => {
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
  })
  .extend("spelledTargetOfAMemberOfADefaultImport", () => {
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
  })
  .extend("siteOfAMemberWrittenAsASubscript", () => {
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
  })
  .extend("siteOfAMemberOfANamedImport", () => {
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
  })
  .extend("siteOfAMemberOfABindingNothingImports", () => {
    const statements = parseSync(SPEC_FILE, 'runner.exec("lerna");').program.body.map(
      (statement) => statement as ESTree.Statement,
    );
    const last = statements.at(-1);
    return spawnSiteAt({
      node: last?.type === "ExpressionStatement" ? last.expression : null,
      routes: spawnRoutesIn({ body: statements, filename: SPEC_FILE }),
      forms: DEFAULT_SPAWN_FORMS,
    });
  })
  .extend("siteOfAMemberWrittenOnSomethingOtherThanAName", () =>
    spawnSiteAt({
      node: {
        type: "CallExpression",
        callee: { type: "MemberExpression", object: null, property: null },
        arguments: [],
      },
      routes: new Map(),
      forms: DEFAULT_SPAWN_FORMS,
    }),
  )
  .extend("siteOfATemplateTagWrittenOnSomethingOtherThanAName", () =>
    spawnSiteAt({
      node: { type: "TaggedTemplateExpression", tag: null },
      routes: new Map(),
      forms: DEFAULT_SPAWN_FORMS,
    }),
  )
  .extend("formOfATaggedTemplate", () => {
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
  .extend("targetSpellingOfATaggedTemplate", () => {
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
  })
  .extend("spelledTargetOfABindingTakenApartFromASynchronousRequest", () => {
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
  })
  .extend("spelledTargetOfAWholeModuleBoundFromASynchronousRequest", () => {
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
  })
  .extend("siteOfABindingTakenApartUnderASubscript", () => {
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
  })
  .extend("siteOfABindingTakenApartUnderAWrittenOutKey", () => {
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
  })
  .extend("siteOfABindingTakenApartIntoAFurtherPattern", () => {
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
  })
  .extend("siteOfABindingTakenApartIntoAList", () => {
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
  })
  .extend("siteOfAMemberWrittenOnAnotherMember", () => {
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
  })
  .extend("routesOfADeclaratorCarryingNeitherANameNorAnInitializer", () =>
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
  )
  .extend("siteOfADeclarationThatIsNotAConstant", () => {
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
  })
  .extend("spelledTargetOfAWrapperBuiltAroundAStartingForm", () => {
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
  })
  .extend("spelledTargetOfAWrapperExportedWhereItIsBuilt", () => {
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
  })
  .extend("spelledTargetOfAnExportOfNamesAlreadyBound", () => {
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
  })
  .extend("siteOfAWrapperHandedNoRouteOfItsOwn", () => {
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
  })
  .extend("siteOfABindingHoldingSomethingOtherThanACall", () => {
    const statements = parseSync(SPEC_FILE, 'const run = 1;\nrun("lerna");').program.body.map(
      (statement) => statement as ESTree.Statement,
    );
    const last = statements.at(-1);
    return spawnSiteAt({
      node: last?.type === "ExpressionStatement" ? last.expression : null,
      routes: spawnRoutesIn({ body: statements, filename: SPEC_FILE }),
      forms: DEFAULT_SPAWN_FORMS,
    });
  })
  .extend("textsHandedToACallSpellingArgumentsOneByOne", () => {
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
  })
  .extend("textsHandedToACallHandingAnythingButAList", () => {
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
  })
  .extend("textsHandedToACallNobodyWroteArgumentsFor", () => {
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
  })
  .extend("textsHandedToACallHoldingAnArgumentNobodyCanFold", () => {
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

describe("declared-replacements/invocation-sites", () => {
  it("something other than a node reaches no starting form", ({
    siteOfSomethingOtherThanANode,
  }) => {
    expect(siteOfSomethingOtherThanANode).toBe(null);
  });

  it("an expression that calls nothing reaches no starting form", ({
    siteOfAnExpressionThatCallsNothing,
  }) => {
    expect(siteOfAnExpressionThatCallsNothing).toBe(null);
  });

  it("a call to a binding nothing imports reaches no starting form", ({
    siteOfACallToABindingNothingImports,
  }) => {
    expect(siteOfACallToABindingNothingImports).toBe(null);
  });

  it("a call to a module the table says nothing about reaches no starting form", ({
    siteOfACallToAModuleTheTableSaysNothingAbout,
  }) => {
    expect(siteOfACallToAModuleTheTableSaysNothingAbout).toBe(null);
  });

  it("a call to an imported starting form is read through the entry that carries a command line", ({
    formOfACallToAnImportedStartingForm,
  }) => {
    expect(formOfACallToAnImportedStartingForm).toStrictEqual({
      specifier: "node:child_process",
      exported: "exec",
      position: 0,
      carries: SPAWN_TARGET_LINE,
    });
  });

  it("a call to an imported starting form carries the argument that names the command", ({
    spelledTargetOfACallToAnImportedStartingForm,
  }) => {
    expect(spelledTargetOfACallToAnImportedStartingForm).toBe("lerna run build");
  });

  it("a call taking no argument carries no target", ({ targetOfACallTakingNoArgument }) => {
    expect(targetOfACallTakingNoArgument).toBe(null);
  });

  it("a member of a whole module import is read through the entry that carries a name", ({
    formOfAMemberOfAWholeModuleImport,
  }) => {
    expect(formOfAMemberOfAWholeModuleImport).toStrictEqual({
      specifier: "node:child_process",
      exported: "spawn",
      position: 0,
      carries: SPAWN_TARGET_NAME,
    });
  });

  it("a member of a whole module import carries the argument that names the command", ({
    spelledTargetOfAMemberOfAWholeModuleImport,
  }) => {
    expect(spelledTargetOfAMemberOfAWholeModuleImport).toBe("lerna");
  });

  it("a member of a default import carries the argument that names the command", ({
    spelledTargetOfAMemberOfADefaultImport,
  }) => {
    expect(spelledTargetOfAMemberOfADefaultImport).toBe("lerna");
  });

  it("a member written as a subscript reaches no starting form", ({
    siteOfAMemberWrittenAsASubscript,
  }) => {
    expect(siteOfAMemberWrittenAsASubscript).toBe(null);
  });

  it("a member of a named import reaches no starting form", ({ siteOfAMemberOfANamedImport }) => {
    expect(siteOfAMemberOfANamedImport).toBe(null);
  });

  it("a member of a binding nothing imports reaches no starting form", ({
    siteOfAMemberOfABindingNothingImports,
  }) => {
    expect(siteOfAMemberOfABindingNothingImports).toBe(null);
  });

  it("a member written on something other than a name reaches no starting form", ({
    siteOfAMemberWrittenOnSomethingOtherThanAName,
  }) => {
    expect(siteOfAMemberWrittenOnSomethingOtherThanAName).toBe(null);
  });

  it("a template tag written on something other than a name reaches no starting form", ({
    siteOfATemplateTagWrittenOnSomethingOtherThanAName,
  }) => {
    expect(siteOfATemplateTagWrittenOnSomethingOtherThanAName).toBe(null);
  });

  it("a tagged template is read through an entry that carries the line it spells out", ({
    formOfATaggedTemplate,
  }) => {
    expect(formOfATaggedTemplate).toStrictEqual({
      specifier: "execa",
      exported: "$",
      position: 0,
      carries: SPAWN_TARGET_LINE,
    });
  });

  it("a tagged template carries the line it spells out", ({ targetSpellingOfATaggedTemplate }) => {
    expect(targetSpellingOfATaggedTemplate).toBe("TemplateLiteral");
  });

  it("a binding taken apart from a synchronous request keeps the route it came through", ({
    spelledTargetOfABindingTakenApartFromASynchronousRequest,
  }) => {
    expect(spelledTargetOfABindingTakenApartFromASynchronousRequest).toBe("lerna");
  });

  it("a whole module bound from a synchronous request keeps the route it came through", ({
    spelledTargetOfAWholeModuleBoundFromASynchronousRequest,
  }) => {
    expect(spelledTargetOfAWholeModuleBoundFromASynchronousRequest).toBe("lerna");
  });

  it("a binding taken apart under a subscript reaches no starting form", ({
    siteOfABindingTakenApartUnderASubscript,
  }) => {
    expect(siteOfABindingTakenApartUnderASubscript).toBe(null);
  });

  it("a binding taken apart under a written-out key reaches no starting form", ({
    siteOfABindingTakenApartUnderAWrittenOutKey,
  }) => {
    expect(siteOfABindingTakenApartUnderAWrittenOutKey).toBe(null);
  });

  it("a binding taken apart into a further pattern reaches no starting form", ({
    siteOfABindingTakenApartIntoAFurtherPattern,
  }) => {
    expect(siteOfABindingTakenApartIntoAFurtherPattern).toBe(null);
  });

  it("a binding taken apart into a list keeps no route", ({
    siteOfABindingTakenApartIntoAList,
  }) => {
    expect(siteOfABindingTakenApartIntoAList).toBe(null);
  });

  it("a member written on another member reaches no starting form", ({
    siteOfAMemberWrittenOnAnotherMember,
  }) => {
    expect(siteOfAMemberWrittenOnAnotherMember).toBe(null);
  });

  it("a declarator carrying neither a name nor an initializer keeps no route", ({
    routesOfADeclaratorCarryingNeitherANameNorAnInitializer,
  }) => {
    expect(routesOfADeclaratorCarryingNeitherANameNorAnInitializer).toStrictEqual(new Map());
  });

  it("a declaration that is not a constant keeps no route", ({
    siteOfADeclarationThatIsNotAConstant,
  }) => {
    expect(siteOfADeclarationThatIsNotAConstant).toBe(null);
  });

  it("a wrapper built around a starting form keeps the route it wraps", ({
    spelledTargetOfAWrapperBuiltAroundAStartingForm,
  }) => {
    expect(spelledTargetOfAWrapperBuiltAroundAStartingForm).toBe("lerna run build");
  });

  it("a wrapper exported where it is built keeps the route it wraps", ({
    spelledTargetOfAWrapperExportedWhereItIsBuilt,
  }) => {
    expect(spelledTargetOfAWrapperExportedWhereItIsBuilt).toBe("lerna");
  });

  it("an export of names already bound keeps no further route", ({
    spelledTargetOfAnExportOfNamesAlreadyBound,
  }) => {
    expect(spelledTargetOfAnExportOfNamesAlreadyBound).toBe("lerna");
  });

  it("a wrapper handed no route of its own keeps none", ({
    siteOfAWrapperHandedNoRouteOfItsOwn,
  }) => {
    expect(siteOfAWrapperHandedNoRouteOfItsOwn).toBe(null);
  });

  it("a binding holding something other than a call keeps no route", ({
    siteOfABindingHoldingSomethingOtherThanACall,
  }) => {
    expect(siteOfABindingHoldingSomethingOtherThanACall).toBe(null);
  });

  it("arguments spelled out one by one come back as text", ({
    textsHandedToACallSpellingArgumentsOneByOne,
  }) => {
    expect(textsHandedToACallSpellingArgumentsOneByOne).toStrictEqual(["lerna", "run"]);
  });

  it("arguments handed as anything but a list come back as nothing", ({
    textsHandedToACallHandingAnythingButAList,
  }) => {
    expect(textsHandedToACallHandingAnythingButAList).toBe(null);
  });

  it("arguments nobody wrote come back as nothing", ({
    textsHandedToACallNobodyWroteArgumentsFor,
  }) => {
    expect(textsHandedToACallNobodyWroteArgumentsFor).toBe(null);
  });

  it("a list holding an argument nobody can fold comes back as nothing", ({
    textsHandedToACallHoldingAnArgumentNobodyCanFold,
  }) => {
    expect(textsHandedToACallHoldingAnArgumentNobodyCanFold).toBe(null);
  });
});
