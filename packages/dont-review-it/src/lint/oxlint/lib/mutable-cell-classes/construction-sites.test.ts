import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { sourceFactsIn } from "./construction-sites.ts";

const it = test
  .extend("factsOfAClassKeptForItsOwnScope", () =>
    sourceFactsIn(
      parseSync("cell.ts", "class Cell { seen = 0; mark() { this.seen += 1; } }").program,
    ))
  .extend("factsOfAClassHandedToTheModuleSurface", () =>
    sourceFactsIn(parseSync("cell.ts", "export class Cell {}").program),
  )
  .extend("factsOfAClassHandedOutAsTheModuleDefault", () =>
    sourceFactsIn(parseSync("cell.ts", "export default class Cell {}").program),
  )
  .extend("factsOfAClassExpressionBoundToAName", () =>
    sourceFactsIn(parseSync("cell.ts", "const Cell = class Inner {};").program),
  )
  .extend("factsOfADefaultClassWithNoNameOfItsOwn", () =>
    sourceFactsIn(parseSync("cell.ts", "export default class { total = 0; }").program),
  )
  .extend("factsOfAnInstanceBuiltAtTheModuleTopLevel", () =>
    sourceFactsIn(parseSync("cell.ts", "class Cell {}\nconst held = new Cell();").program),
  )
  .extend("factsOfAnInstanceBuiltThroughAValueDecidedWhileTheFileRuns", () =>
    sourceFactsIn(parseSync("cell.ts", "const held = new chosen.Cell();").program),
  )
  .extend("scopeNamesOfAnInstanceBuiltInsideANamedFunction", () =>
    sourceFactsIn(
      parseSync("cell.ts", "class Cell {}\nfunction walk() { const held = new Cell(); }").program,
    ).constructions.map((site) => site.scopeName),
  )
  .extend("scopeNamesOfAnInstanceBuiltInsideAMethod", () =>
    sourceFactsIn(
      parseSync("cell.ts", "class Cell {}\nclass Host { walk() { const held = new Cell(); } }")
        .program,
    ).constructions.map((site) => site.scopeName),
  )
  .extend("scopeNamesOfAnInstanceBuiltInsideAFunctionOfAnObject", () =>
    sourceFactsIn(
      parseSync("cell.ts", "class Cell {}\nconst host = { walk() { const held = new Cell(); } };")
        .program,
    ).constructions.map((site) => site.scopeName),
  )
  .extend("scopeNamesOfAnInstanceBuiltInsideAFunctionHungOnAComputedKey", () =>
    sourceFactsIn(
      parseSync("cell.ts", "class Cell {}\nconst host = { [key]() { const held = new Cell(); } };")
        .program,
    ).constructions.map((site) => site.scopeName),
  )
  .extend("scopeNamesOfAnInstanceBuiltInsideAFunctionHandedToACall", () =>
    sourceFactsIn(
      parseSync("cell.ts", "class Cell {}\nrun(() => { const held = new Cell(); });").program,
    ).constructions.map((site) => site.scopeName),
  )
  .extend("scopeNamesOfAnInstanceBuiltInsideAFunctionHungOnASpelledOutKey", () =>
    sourceFactsIn(
      parseSync("cell.ts", 'class Cell {}\nconst host = { "walk"() { const held = new Cell(); } };')
        .program,
    ).constructions.map((site) => site.scopeName),
  )
  .extend("scopeNamesOfAnInstanceBuiltInsideAFunctionWithNoNameOfItsOwn", () =>
    sourceFactsIn(
      parseSync("cell.ts", "class Cell {}\nexport default function () { const held = new Cell(); }")
        .program,
    ).constructions.map((site) => site.scopeName),
  )
  .extend("cellIsDivertedInAClassExpressionCarryingTheName", () =>
    sourceFactsIn(parseSync("cell.ts", "const Held = class Cell {};").program).divertedNames.has(
      "Cell",
    ),
  )
  .extend("cellIsDivertedWhenBroughtInAsAModuleDefault", () =>
    sourceFactsIn(
      parseSync("cell.ts", 'import Cell from "./other.ts";\nconst held = new Cell();').program,
    ).divertedNames.has("Cell"),
  )
  .extend("cellIsDivertedWhenBroughtInAsAWholeModule", () =>
    sourceFactsIn(
      parseSync("cell.ts", 'import * as Cell from "./other.ts";\nexport {};').program,
    ).divertedNames.has("Cell"),
  )
  .extend("cellIsDivertedWhenUsedAsABase", () =>
    sourceFactsIn(
      parseSync("cell.ts", "class Cell {}\nclass Wider extends Cell {}").program,
    ).divertedNames.has("Cell"),
  )
  .extend("cellIsDivertedWhenHandedToACall", () =>
    sourceFactsIn(parseSync("cell.ts", "class Cell {}\nregister(Cell);").program).divertedNames.has(
      "Cell",
    ),
  )
  .extend("cellIsDivertedWhenListedOnTheModuleSurface", () =>
    sourceFactsIn(
      parseSync("cell.ts", "class Cell {}\nexport { Cell };").program,
    ).divertedNames.has("Cell"),
  )
  .extend("cellIsDivertedWhenBoundToASecondName", () =>
    sourceFactsIn(
      parseSync("cell.ts", "class Cell {}\nconst Held = Cell;").program,
    ).divertedNames.has("Cell"),
  )
  .extend("cellIsDivertedWhenUsedOnlyToBuildAnInstance", () =>
    sourceFactsIn(
      parseSync("cell.ts", "class Cell {}\nconst walk = (): Cell => new Cell();").program,
    ).divertedNames.has("Cell"),
  )
  .extend("cellIsDivertedWhenItOnlySpellsAMemberKey", () =>
    sourceFactsIn(
      parseSync("cell.ts", "class Cell {}\nconst read = host.Cell;").program,
    ).divertedNames.has("Cell"),
  )
  .extend("cellIsDivertedWhenItOnlySpellsAnObjectKey", () =>
    sourceFactsIn(
      parseSync("cell.ts", "class Cell {}\nconst host = { Cell: 1 };").program,
    ).divertedNames.has("Cell"),
  )
  .extend("cellIsDivertedWhenItOnlySpellsAClassMemberKey", () =>
    sourceFactsIn(
      parseSync("cell.ts", "class Cell {}\nclass Host { Cell = 1; }").program,
    ).divertedNames.has("Cell"),
  )
  .extend("cellIsDivertedWhenBroughtInFromAnotherModule", () =>
    sourceFactsIn(
      parseSync("cell.ts", 'import { Cell } from "./other.ts";\nconst held = new Cell();').program,
    ).divertedNames.has("Cell"),
  )
  .extend("cellIsDivertedWhenReadThroughAComputedMember", () =>
    sourceFactsIn(
      parseSync("cell.ts", "class Cell {}\nconst read = host[Cell];").program,
    ).divertedNames.has("Cell"),
  );

describe("sourceFactsIn", () => {
  it("a class kept for its own scope is named among the declared classes", ({
    factsOfAClassKeptForItsOwnScope,
  }) => {
    expect(factsOfAClassKeptForItsOwnScope).toStrictEqual({
      declaredClasses: [{ name: "Cell", fields: ["seen"], shared: false }],
      constructions: [],
      divertedNames: new Set(),
    });
  });

  it("a class handed to the module surface is named as shared", ({
    factsOfAClassHandedToTheModuleSurface,
  }) => {
    expect(factsOfAClassHandedToTheModuleSurface).toStrictEqual({
      declaredClasses: [{ name: "Cell", fields: [], shared: true }],
      constructions: [],
      divertedNames: new Set(),
    });
  });

  it("a class handed to the module surface as its default is named as shared", ({
    factsOfAClassHandedOutAsTheModuleDefault,
  }) => {
    expect(factsOfAClassHandedOutAsTheModuleDefault).toStrictEqual({
      declaredClasses: [{ name: "Cell", fields: [], shared: true }],
      constructions: [],
      divertedNames: new Set(),
    });
  });

  it("a class expression bound to a name is named among no declared classes", ({
    factsOfAClassExpressionBoundToAName,
  }) => {
    expect(factsOfAClassExpressionBoundToAName).toStrictEqual({
      declaredClasses: [],
      constructions: [],
      divertedNames: new Set(["Cell"]),
    });
  });

  it("a class handed to the module surface with no name of its own is named among no declared classes", ({
    factsOfADefaultClassWithNoNameOfItsOwn,
  }) => {
    expect(factsOfADefaultClassWithNoNameOfItsOwn).toStrictEqual({
      declaredClasses: [],
      constructions: [],
      divertedNames: new Set(),
    });
  });

  it("an instance built at the module top level carries no scope", ({
    factsOfAnInstanceBuiltAtTheModuleTopLevel,
  }) => {
    expect(factsOfAnInstanceBuiltAtTheModuleTopLevel).toStrictEqual({
      declaredClasses: [{ name: "Cell", fields: [], shared: false }],
      constructions: [{ name: "Cell", scopeKey: null, scopeName: null, escapes: true }],
      divertedNames: new Set(["held"]),
    });
  });

  it("an instance built through a value decided while the file runs is counted nowhere", ({
    factsOfAnInstanceBuiltThroughAValueDecidedWhileTheFileRuns,
  }) => {
    expect(factsOfAnInstanceBuiltThroughAValueDecidedWhileTheFileRuns).toStrictEqual({
      declaredClasses: [],
      constructions: [],
      divertedNames: new Set(["held", "chosen"]),
    });
  });

  it("an instance built inside a named function carries that name", ({
    scopeNamesOfAnInstanceBuiltInsideANamedFunction,
  }) => {
    expect(scopeNamesOfAnInstanceBuiltInsideANamedFunction).toStrictEqual(["walk"]);
  });

  it("an instance built inside a method carries the method name", ({
    scopeNamesOfAnInstanceBuiltInsideAMethod,
  }) => {
    expect(scopeNamesOfAnInstanceBuiltInsideAMethod).toStrictEqual(["walk"]);
  });

  it("an instance built inside a function of an object carries the key it hangs on", ({
    scopeNamesOfAnInstanceBuiltInsideAFunctionOfAnObject,
  }) => {
    expect(scopeNamesOfAnInstanceBuiltInsideAFunctionOfAnObject).toStrictEqual(["walk"]);
  });

  it("an instance built inside a function hung on a computed key carries no name", ({
    scopeNamesOfAnInstanceBuiltInsideAFunctionHungOnAComputedKey,
  }) => {
    expect(scopeNamesOfAnInstanceBuiltInsideAFunctionHungOnAComputedKey).toStrictEqual([null]);
  });

  it("an instance built inside a function handed to a call carries no name", ({
    scopeNamesOfAnInstanceBuiltInsideAFunctionHandedToACall,
  }) => {
    expect(scopeNamesOfAnInstanceBuiltInsideAFunctionHandedToACall).toStrictEqual([null]);
  });

  it("an instance built inside a function hung on a spelled out key carries no name", ({
    scopeNamesOfAnInstanceBuiltInsideAFunctionHungOnASpelledOutKey,
  }) => {
    expect(scopeNamesOfAnInstanceBuiltInsideAFunctionHungOnASpelledOutKey).toStrictEqual([null]);
  });

  it("an instance built inside a function with no name of its own carries no name", ({
    scopeNamesOfAnInstanceBuiltInsideAFunctionWithNoNameOfItsOwn,
  }) => {
    expect(scopeNamesOfAnInstanceBuiltInsideAFunctionWithNoNameOfItsOwn).toStrictEqual([null]);
  });

  it("a class name written on a class expression is named among no diverted references", ({
    cellIsDivertedInAClassExpressionCarryingTheName,
  }) => {
    expect(cellIsDivertedInAClassExpressionCarryingTheName).toBe(false);
  });

  it("a name brought in as a module default is named among no diverted references", ({
    cellIsDivertedWhenBroughtInAsAModuleDefault,
  }) => {
    expect(cellIsDivertedWhenBroughtInAsAModuleDefault).toBe(false);
  });

  it("a name brought in as a whole module is named among no diverted references", ({
    cellIsDivertedWhenBroughtInAsAWholeModule,
  }) => {
    expect(cellIsDivertedWhenBroughtInAsAWholeModule).toBe(false);
  });

  it("a class name used as a base is named among the diverted references", ({
    cellIsDivertedWhenUsedAsABase,
  }) => {
    expect(cellIsDivertedWhenUsedAsABase).toBe(true);
  });

  it("a class name handed to a call is named among the diverted references", ({
    cellIsDivertedWhenHandedToACall,
  }) => {
    expect(cellIsDivertedWhenHandedToACall).toBe(true);
  });

  it("a class name listed on the module surface is named among the diverted references", ({
    cellIsDivertedWhenListedOnTheModuleSurface,
  }) => {
    expect(cellIsDivertedWhenListedOnTheModuleSurface).toBe(true);
  });

  it("a class name bound to a second name is named among the diverted references", ({
    cellIsDivertedWhenBoundToASecondName,
  }) => {
    expect(cellIsDivertedWhenBoundToASecondName).toBe(true);
  });

  it("a class name used only to build an instance is named among no diverted references", ({
    cellIsDivertedWhenUsedOnlyToBuildAnInstance,
  }) => {
    expect(cellIsDivertedWhenUsedOnlyToBuildAnInstance).toBe(false);
  });

  it("a name that only spells a member key is named among no diverted references", ({
    cellIsDivertedWhenItOnlySpellsAMemberKey,
  }) => {
    expect(cellIsDivertedWhenItOnlySpellsAMemberKey).toBe(false);
  });

  it("a name that only spells an object key is named among no diverted references", ({
    cellIsDivertedWhenItOnlySpellsAnObjectKey,
  }) => {
    expect(cellIsDivertedWhenItOnlySpellsAnObjectKey).toBe(false);
  });

  it("a name that only spells a class member key is named among no diverted references", ({
    cellIsDivertedWhenItOnlySpellsAClassMemberKey,
  }) => {
    expect(cellIsDivertedWhenItOnlySpellsAClassMemberKey).toBe(false);
  });

  it("a name brought in from another module is named among no diverted references", ({
    cellIsDivertedWhenBroughtInFromAnotherModule,
  }) => {
    expect(cellIsDivertedWhenBroughtInFromAnotherModule).toBe(false);
  });

  it("a name read through a computed member is named among the diverted references", ({
    cellIsDivertedWhenReadThroughAComputedMember,
  }) => {
    expect(cellIsDivertedWhenReadThroughAComputedMember).toBe(true);
  });
});
