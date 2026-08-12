import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { sourceFactsIn, type ConstructionSite } from "./construction-sites.ts";

const factsOf = (sourceText: string) => sourceFactsIn(parseSync("cell.ts", sourceText).program);

const soleSiteOf = (writtenBody: string): ConstructionSite => {
  const [site] = factsOf(`class Cell {}\nconst walk = () => {\n${writtenBody}\n};\n`).constructions;
  if (site === undefined) throw new Error(`nothing is constructed by: ${writtenBody}`);
  return site;
};

const escapesFrom = (writtenBody: string): boolean => soleSiteOf(writtenBody).escapes;

const divertsCell = (sourceText: string): boolean => factsOf(sourceText).divertedNames.has("Cell");

describe("sourceFactsIn", () => {
  test("a class kept for its own scope is named among the declared classes", () => {
    expect(
      factsOf("class Cell { seen = 0; mark() { this.seen += 1; } }").declaredClasses,
    ).toStrictEqual([{ name: "Cell", fields: ["seen"], shared: false }]);
  });

  test("a class handed to the module surface is named as shared", () => {
    expect(factsOf("export class Cell {}").declaredClasses).toStrictEqual([
      { name: "Cell", fields: [], shared: true },
    ]);
  });

  test("a class handed to the module surface as its default is named as shared", () => {
    expect(factsOf("export default class Cell {}").declaredClasses).toStrictEqual([
      { name: "Cell", fields: [], shared: true },
    ]);
  });

  test("a class expression bound to a name is named among no declared classes", () => {
    expect(factsOf("const Cell = class Inner {};").declaredClasses).toStrictEqual([]);
  });

  test("an instance built at the module top level carries no scope", () => {
    const [site] = factsOf("class Cell {}\nconst held = new Cell();").constructions;

    expect(site).toStrictEqual({ name: "Cell", scopeKey: null, scopeName: null, escapes: true });
  });

  test("an instance built through a value decided while the file runs is counted nowhere", () => {
    expect(factsOf("const held = new chosen.Cell();").constructions).toStrictEqual([]);
  });

  test("an instance built inside a named function carries that name", () => {
    const [site] = factsOf(
      "class Cell {}\nfunction walk() { const held = new Cell(); }",
    ).constructions;

    expect(site?.scopeName).toBe("walk");
  });

  test("an instance built inside a method carries the method name", () => {
    const [site] = factsOf(
      "class Cell {}\nclass Host { walk() { const held = new Cell(); } }",
    ).constructions;

    expect(site?.scopeName).toBe("walk");
  });

  test("an instance built inside a function of an object carries the key it hangs on", () => {
    const [site] = factsOf(
      "class Cell {}\nconst host = { walk() { const held = new Cell(); } };",
    ).constructions;

    expect(site?.scopeName).toBe("walk");
  });

  test("an instance built inside a function hung on a computed key carries no name", () => {
    const [site] = factsOf(
      "class Cell {}\nconst host = { [key]() { const held = new Cell(); } };",
    ).constructions;

    expect(site?.scopeName).toBe(null);
  });

  test("an instance built inside a function handed to a call carries no name", () => {
    const [site] = factsOf("class Cell {}\nrun(() => { const held = new Cell(); });").constructions;

    expect(site?.scopeName).toBe(null);
  });

  test("an instance built inside a function hung on a spelled out key carries no name", () => {
    const [site] = factsOf(
      'class Cell {}\nconst host = { "walk"() { const held = new Cell(); } };',
    ).constructions;

    expect(site?.scopeName).toBe(null);
  });

  test("a class handed to the module surface with no name of its own is named among no declared classes", () => {
    expect(factsOf("export default class { total = 0; }").declaredClasses).toStrictEqual([]);
  });

  test("an instance built inside a function with no name of its own carries no name", () => {
    const [site] = factsOf(
      "class Cell {}\nexport default function () { const held = new Cell(); }",
    ).constructions;

    expect(site?.scopeName).toBe(null);
  });

  test("an instance taken apart on the way out of its scope leaves it", () => {
    expect(escapesFrom("const { total } = new Cell();\nreturn total;")).toBe(true);
  });

  test("an instance held in a binding and only read stays inside its scope", () => {
    expect(escapesFrom("const held = new Cell();\nheld.mark();")).toBe(false);
  });

  test("an instance returned from its scope leaves it", () => {
    expect(escapesFrom("const held = new Cell();\nreturn held;")).toBe(true);
  });

  test("an instance thrown out of its scope leaves it", () => {
    expect(escapesFrom("const held = new Cell();\nthrow held;")).toBe(true);
  });

  test("an instance handed to a call leaves its scope", () => {
    expect(escapesFrom("const held = new Cell();\nsink(held);")).toBe(true);
  });

  test("an instance spread into a call leaves its scope", () => {
    expect(escapesFrom("const held = new Cell();\nsink(...[held]);")).toBe(true);
  });

  test("an instance handed to a template tag leaves its scope", () => {
    expect(escapesFrom("const held = new Cell();\ntag`${held}`;")).toBe(true);
  });

  test("an instance handed to a further construction leaves its scope", () => {
    expect(escapesFrom("const held = new Cell();\nconst wrap = new Wrapper(held);")).toBe(true);
  });

  test("an instance written onto something else leaves its scope", () => {
    expect(escapesFrom("const held = new Cell();\nsink.at = held;")).toBe(true);
  });

  test("an instance bound to a second name leaves its scope", () => {
    expect(escapesFrom("const held = new Cell();\nconst alias = held;")).toBe(true);
  });

  test("an instance packed into an object that is returned leaves its scope", () => {
    expect(escapesFrom("const held = new Cell();\nreturn { held };")).toBe(true);
  });

  test("an instance chosen by a condition and returned leaves its scope", () => {
    expect(escapesFrom("const held = new Cell();\nreturn ready ? held : null;")).toBe(true);
  });

  test("an instance weighed by a condition that is returned leaves its scope", () => {
    expect(escapesFrom("const held = new Cell();\nreturn held ? 1 : 0;")).toBe(true);
  });

  test("an instance read through an assertion stays inside its scope", () => {
    expect(escapesFrom("const held = new Cell();\n(held as Cell).mark();")).toBe(false);
  });

  test("an instance returned through an assertion leaves its scope", () => {
    expect(escapesFrom("const held = new Cell();\nreturn held as Cell;")).toBe(true);
  });

  test("an instance read through an optional link stays inside its scope", () => {
    expect(escapesFrom("const held = new Cell();\nheld?.mark();")).toBe(false);
  });

  test("an instance yielded out of its scope leaves it", () => {
    const [site] = factsOf(
      "class Cell {}\nfunction* walk() { const held = new Cell(); yield held; }",
    ).constructions;

    expect(site?.escapes).toBe(true);
  });

  test("an instance built straight into a return leaves its scope", () => {
    expect(escapesFrom("return new Cell();")).toBe(true);
  });

  test("an instance built and read in place stays inside its scope", () => {
    expect(escapesFrom("new Cell().mark();")).toBe(false);
  });

  test("an instance held by a local function that is only called stays inside its scope", () => {
    expect(escapesFrom("const held = new Cell();\nconst bump = () => held.mark();\nbump();")).toBe(
      false,
    );
  });

  test("an instance held by a local function declaration that is only called stays inside its scope", () => {
    expect(escapesFrom("const held = new Cell();\nfunction bump() { held.mark(); }\nbump();")).toBe(
      false,
    );
  });

  test("an instance held by a local function that is handed away leaves its scope", () => {
    expect(
      escapesFrom("const held = new Cell();\nconst bump = () => held.mark();\nregister(bump);"),
    ).toBe(true);
  });

  test("an instance held by a nameless function handed away leaves its scope", () => {
    expect(escapesFrom("const held = new Cell();\nregister(() => held.mark());")).toBe(true);
  });

  test("an instance handed out from inside a local function leaves its scope", () => {
    expect(
      escapesFrom("const held = new Cell();\nconst send = () => register(held);\nsend();"),
    ).toBe(true);
  });

  test("an instance held by a function inside a function that is only called stays inside its scope", () => {
    expect(
      escapesFrom(
        "const held = new Cell();\nconst outer = () => { const inner = () => held.mark(); inner(); };\nouter();",
      ),
    ).toBe(false);
  });

  test("an instance held by a nameless function inside a function that is handed away leaves its scope", () => {
    expect(
      escapesFrom(
        "const held = new Cell();\nconst outer = () => { register(() => held.mark()); };\nouter();",
      ),
    ).toBe(true);
  });

  test("an instance held by two functions that call each other stays inside its scope", () => {
    expect(
      escapesFrom(
        "const held = new Cell();\nconst even = () => odd();\nconst odd = () => { held.mark(); even(); };\nodd();",
      ),
    ).toBe(false);
  });

  test("an instance held by a function running in place inside a function stays inside its scope", () => {
    expect(
      escapesFrom(
        "const held = new Cell();\nconst outer = () => { (() => held.mark())(); };\nouter();",
      ),
    ).toBe(false);
  });

  test("an instance whose name is also bound outside its scope stays inside its scope", () => {
    const [site] = factsOf(
      "class Cell {}\nconst held = 0;\nconst walk = () => { const held = new Cell(); held.mark(); };",
    ).constructions;

    expect(site?.escapes).toBe(false);
  });

  test("a class name written on a class expression is named among no diverted references", () => {
    expect(divertsCell("const Held = class Cell {};")).toBe(false);
  });

  test("a name brought in as a module default is named among no diverted references", () => {
    expect(divertsCell('import Cell from "./other.ts";\nconst held = new Cell();')).toBe(false);
  });

  test("a name brought in as a whole module is named among no diverted references", () => {
    expect(divertsCell('import * as Cell from "./other.ts";\nexport {};')).toBe(false);
  });

  test("a class name used as a base is named among the diverted references", () => {
    expect(divertsCell("class Cell {}\nclass Wider extends Cell {}")).toBe(true);
  });

  test("a class name handed to a call is named among the diverted references", () => {
    expect(divertsCell("class Cell {}\nregister(Cell);")).toBe(true);
  });

  test("a class name listed on the module surface is named among the diverted references", () => {
    expect(divertsCell("class Cell {}\nexport { Cell };")).toBe(true);
  });

  test("a class name bound to a second name is named among the diverted references", () => {
    expect(divertsCell("class Cell {}\nconst Held = Cell;")).toBe(true);
  });

  test("a class name used only to build an instance is named among no diverted references", () => {
    expect(divertsCell("class Cell {}\nconst walk = (): Cell => new Cell();")).toBe(false);
  });

  test("a name that only spells a member key is named among no diverted references", () => {
    expect(divertsCell("class Cell {}\nconst read = host.Cell;")).toBe(false);
  });

  test("a name that only spells an object key is named among no diverted references", () => {
    expect(divertsCell("class Cell {}\nconst host = { Cell: 1 };")).toBe(false);
  });

  test("a name that only spells a class member key is named among no diverted references", () => {
    expect(divertsCell("class Cell {}\nclass Host { Cell = 1; }")).toBe(false);
  });

  test("a name brought in from another module is named among no diverted references", () => {
    expect(divertsCell('import { Cell } from "./other.ts";\nconst held = new Cell();')).toBe(false);
  });

  test("a name read through a computed member is named among the diverted references", () => {
    expect(divertsCell("class Cell {}\nconst read = host[Cell];")).toBe(true);
  });
});
