import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import {
  astFieldsOf,
  constantSpecifiersIn,
  couplingEdgeOf,
  couplingEdgesUnder,
  type CouplingEdge,
  nodeTypeOf,
  requestedSpecifierOf,
  statementsOf,
} from "./coupling-edges.ts";

import type { AstFields } from "../ast-node.ts";

const programIn = (sourceText: string): AstFields => {
  const program = astFieldsOf(parseSync("spec.ts", sourceText).program);
  if (program === null) throw new Error(`nothing was parsed from: ${sourceText}`);
  return program;
};

const callIn = (sourceText: string): AstFields => {
  const [statement] = statementsOf(programIn(sourceText));
  const called = statement === undefined ? null : astFieldsOf(statement.expression);
  if (called === null) throw new Error(`nothing is called by: ${sourceText}`);
  return called;
};

const edgesIn = (sourceText: string): readonly CouplingEdge[] => {
  const program = programIn(sourceText);
  return couplingEdgesUnder(program, constantSpecifiersIn(program.body));
};

const specifiersIn = (sourceText: string): readonly string[] =>
  edgesIn(sourceText).map((edge) => edge.specifier);

const templateSourceOf = (quasi: unknown): AstFields => ({
  type: "ImportExpression",
  source: { type: "TemplateLiteral", quasis: [quasi], expressions: [] },
});

describe("setup-modules/coupling-edges", () => {
  test("a value that carries no node type spells no type at all", () => {
    expect(nodeTypeOf({})).toBe("");
  });

  test("a value that is not a node at all is no coupling", () => {
    expect(couplingEdgeOf(null, new Map())).toBe(null);
  });

  test("a template part carrying no value spells no specifier", () => {
    expect(couplingEdgeOf(templateSourceOf({}), new Map())).toBe(null);
  });

  test("a template part whose text was never cooked spells no specifier", () => {
    expect(couplingEdgeOf(templateSourceOf({ value: {} }), new Map())).toBe(null);
  });

  test("the statements of a program are read as nodes", () => {
    expect(statementsOf(programIn("const total = 1;")).map(nodeTypeOf)).toStrictEqual([
      "VariableDeclaration",
    ]);
  });

  test("an import declaration couples this file to a module and carries its values", () => {
    expect(edgesIn('import held from "./held.ts";')).toStrictEqual([
      { specifier: "./held.ts", carriesValues: true },
    ]);
  });

  test("an import of types alone couples this file to a module without carrying values", () => {
    expect(edgesIn('import type { Held } from "./held.ts";')).toStrictEqual([
      { specifier: "./held.ts", carriesValues: false },
    ]);
  });

  test("a named export read from another module carries its values", () => {
    expect(edgesIn('export { held } from "./held.ts";')).toStrictEqual([
      { specifier: "./held.ts", carriesValues: true },
    ]);
  });

  test("an export of types alone reaches another module without carrying values", () => {
    expect(edgesIn('export type { Held } from "./held.ts";')).toStrictEqual([
      { specifier: "./held.ts", carriesValues: false },
    ]);
  });

  test("an export of everything another module holds carries its values", () => {
    expect(edgesIn('export * from "./held.ts";')).toStrictEqual([
      { specifier: "./held.ts", carriesValues: true },
    ]);
  });

  test("a constant that binds a pattern rather than a name specifies nothing", () => {
    expect(constantSpecifiersIn(programIn("const { picked } = held;").body)).toStrictEqual(
      new Map(),
    );
  });

  test("a constant exported with its declaration still spells its specifier", () => {
    expect(constantSpecifiersIn(programIn('export const SETUP = "./held.ts";').body)).toStrictEqual(
      new Map([["SETUP", "./held.ts"]]),
    );
  });

  test("a constant re-exported under its own name binds no further specifier", () => {
    expect(
      constantSpecifiersIn(programIn('const HELD = "./held.ts";\nexport { HELD };').body),
    ).toStrictEqual(new Map([["HELD", "./held.ts"]]));
  });

  test("a binding that can be written to again spells no constant specifier", () => {
    expect(constantSpecifiersIn(programIn('let entry = "./held.ts";').body)).toStrictEqual(
      new Map(),
    );
  });

  test("a constant bound to a number spells no specifier", () => {
    expect(constantSpecifiersIn(programIn("const RETRIES = 3;").body)).toStrictEqual(new Map());
  });

  test("a constant that compares two written-out strings spells no specifier", () => {
    expect(
      constantSpecifiersIn(
        programIn('const ENTRY = "./held.ts";\nconst IS_HELD = ENTRY === "./held.ts";').body,
      ),
    ).toStrictEqual(new Map([["ENTRY", "./held.ts"]]));
  });

  test("a template assembled from a constant of this file resolves to one specifier", () => {
    expect(
      specifiersIn('const STEM = "held";\nconst loaded = import(`./${STEM}.ts`);'),
    ).toStrictEqual(["./held.ts"]);
  });

  test("two written-out strings joined together resolve to one specifier", () => {
    expect(specifiersIn('const loaded = import("./held" + ".ts");')).toStrictEqual(["./held.ts"]);
  });

  test("a join whose side is decided while the program runs resolves to no specifier", () => {
    expect(specifiersIn('const loaded = import("./" + chosen);')).toStrictEqual([]);
  });

  test("a join under an operator other than concatenation resolves to no specifier", () => {
    expect(specifiersIn('const loaded = import("./held.ts" ?? "./other.ts");')).toStrictEqual([]);
  });

  test("a constant joined from a constant declared above it resolves to one specifier", () => {
    expect(
      specifiersIn(
        'const BASE = "./held";\nconst ENTRY = BASE + ".ts";\nconst held = import(ENTRY);',
      ),
    ).toStrictEqual(["./held.ts"]);
  });

  test("a constant that reads a name declared below it resolves to no specifier", () => {
    expect(
      specifiersIn(
        'const ENTRY = BASE + ".ts";\nconst BASE = "./held";\nconst held = import(ENTRY);',
      ),
    ).toStrictEqual([]);
  });

  test("a value that is not a node requests no specifier", () => {
    expect(requestedSpecifierOf(null)).toBe(null);
  });

  test("the specifier a call requests is read only from a call named require", () => {
    expect(requestedSpecifierOf(callIn('load("./held.ts");'))).toBe(null);
  });

  test("the specifier a require call requests is the argument it is handed", () => {
    const requested = requestedSpecifierOf(callIn('require("./held.ts");'));
    expect(requested === null ? null : requested.value).toBe("./held.ts");
  });

  test("a require call handed nothing requests no specifier", () => {
    expect(requestedSpecifierOf(callIn("require();"))).toBe(null);
  });

  test("a call through a member of an object requests no specifier", () => {
    expect(requestedSpecifierOf(callIn('loader.require("./held.ts");'))).toBe(null);
  });
});
