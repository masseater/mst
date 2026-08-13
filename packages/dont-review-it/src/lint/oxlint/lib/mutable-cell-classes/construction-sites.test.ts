import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { sourceFactsIn } from "./construction-sites.ts";

describe("sourceFactsIn", () => {
  describe("a class kept for its own scope", () => {
    const it = test.extend("facts", () =>
      sourceFactsIn(
        parseSync("cell.ts", "class Cell { seen = 0; mark() { this.seen += 1; } }").program,
      ));

    it("is named among the declared classes", ({ facts }) => {
      expect(facts).toStrictEqual({
        declaredClasses: [{ name: "Cell", fields: ["seen"], shared: false }],
        constructions: [],
        divertedNames: new Set(),
      });
    });
  });

  describe("a class handed to the module surface", () => {
    const it = test.extend("facts", () =>
      sourceFactsIn(parseSync("cell.ts", "export class Cell {}").program));

    it("is named as shared", ({ facts }) => {
      expect(facts).toStrictEqual({
        declaredClasses: [{ name: "Cell", fields: [], shared: true }],
        constructions: [],
        divertedNames: new Set(),
      });
    });
  });

  describe("a class handed to the module surface as its default", () => {
    const it = test.extend("facts", () =>
      sourceFactsIn(parseSync("cell.ts", "export default class Cell {}").program));

    it("is named as shared", ({ facts }) => {
      expect(facts).toStrictEqual({
        declaredClasses: [{ name: "Cell", fields: [], shared: true }],
        constructions: [],
        divertedNames: new Set(),
      });
    });
  });

  describe("a class expression bound to a name", () => {
    const it = test.extend("facts", () =>
      sourceFactsIn(parseSync("cell.ts", "const Cell = class Inner {};").program));

    it("is named among no declared classes", ({ facts }) => {
      expect(facts).toStrictEqual({
        declaredClasses: [],
        constructions: [],
        divertedNames: new Set(["Cell"]),
      });
    });
  });

  describe("a class handed to the module surface with no name of its own", () => {
    const it = test.extend("facts", () =>
      sourceFactsIn(parseSync("cell.ts", "export default class { total = 0; }").program));

    it("is named among no declared classes", ({ facts }) => {
      expect(facts).toStrictEqual({
        declaredClasses: [],
        constructions: [],
        divertedNames: new Set(),
      });
    });
  });

  describe("an instance built at the module top level", () => {
    const it = test.extend("facts", () =>
      sourceFactsIn(parseSync("cell.ts", "class Cell {}\nconst held = new Cell();").program));

    it("carries no scope", ({ facts }) => {
      expect(facts).toStrictEqual({
        declaredClasses: [{ name: "Cell", fields: [], shared: false }],
        constructions: [{ name: "Cell", scopeKey: null, scopeName: null, escapes: true }],
        divertedNames: new Set(["held"]),
      });
    });
  });

  describe("an instance built through a value decided while the file runs", () => {
    const it = test.extend("facts", () =>
      sourceFactsIn(parseSync("cell.ts", "const held = new chosen.Cell();").program));

    it("is counted nowhere", ({ facts }) => {
      expect(facts).toStrictEqual({
        declaredClasses: [],
        constructions: [],
        divertedNames: new Set(["held", "chosen"]),
      });
    });
  });

  describe("an instance built inside a named function", () => {
    const it = test.extend("scopeNames", () =>
      sourceFactsIn(
        parseSync("cell.ts", "class Cell {}\nfunction walk() { const held = new Cell(); }").program,
      ).constructions.map((site) => site.scopeName));

    it("carries that name", ({ scopeNames }) => {
      expect(scopeNames).toStrictEqual(["walk"]);
    });
  });

  describe("an instance built inside a method", () => {
    const it = test.extend("scopeNames", () =>
      sourceFactsIn(
        parseSync("cell.ts", "class Cell {}\nclass Host { walk() { const held = new Cell(); } }")
          .program,
      ).constructions.map((site) => site.scopeName));

    it("carries the method name", ({ scopeNames }) => {
      expect(scopeNames).toStrictEqual(["walk"]);
    });
  });

  describe("an instance built inside a function of an object", () => {
    const it = test.extend("scopeNames", () =>
      sourceFactsIn(
        parseSync("cell.ts", "class Cell {}\nconst host = { walk() { const held = new Cell(); } };")
          .program,
      ).constructions.map((site) => site.scopeName));

    it("carries the key it hangs on", ({ scopeNames }) => {
      expect(scopeNames).toStrictEqual(["walk"]);
    });
  });

  describe("an instance built inside a function hung on a computed key", () => {
    const it = test.extend("scopeNames", () =>
      sourceFactsIn(
        parseSync(
          "cell.ts",
          "class Cell {}\nconst host = { [key]() { const held = new Cell(); } };",
        ).program,
      ).constructions.map((site) => site.scopeName));

    it("carries no name", ({ scopeNames }) => {
      expect(scopeNames).toStrictEqual([null]);
    });
  });

  describe("an instance built inside a function handed to a call", () => {
    const it = test.extend("scopeNames", () =>
      sourceFactsIn(
        parseSync("cell.ts", "class Cell {}\nrun(() => { const held = new Cell(); });").program,
      ).constructions.map((site) => site.scopeName));

    it("carries no name", ({ scopeNames }) => {
      expect(scopeNames).toStrictEqual([null]);
    });
  });

  describe("an instance built inside a function hung on a spelled out key", () => {
    const it = test.extend("scopeNames", () =>
      sourceFactsIn(
        parseSync(
          "cell.ts",
          'class Cell {}\nconst host = { "walk"() { const held = new Cell(); } };',
        ).program,
      ).constructions.map((site) => site.scopeName));

    it("carries no name", ({ scopeNames }) => {
      expect(scopeNames).toStrictEqual([null]);
    });
  });

  describe("an instance built inside a function with no name of its own", () => {
    const it = test.extend("scopeNames", () =>
      sourceFactsIn(
        parseSync(
          "cell.ts",
          "class Cell {}\nexport default function () { const held = new Cell(); }",
        ).program,
      ).constructions.map((site) => site.scopeName));

    it("carries no name", ({ scopeNames }) => {
      expect(scopeNames).toStrictEqual([null]);
    });
  });

  describe("a class name written on a class expression", () => {
    const it = test.extend("cellIsDiverted", () =>
      sourceFactsIn(parseSync("cell.ts", "const Held = class Cell {};").program).divertedNames.has(
        "Cell",
      ));

    it("is named among no diverted references", ({ cellIsDiverted }) => {
      expect(cellIsDiverted).toBe(false);
    });
  });

  describe("a name brought in as a module default", () => {
    const it = test.extend("cellIsDiverted", () =>
      sourceFactsIn(
        parseSync("cell.ts", 'import Cell from "./other.ts";\nconst held = new Cell();').program,
      ).divertedNames.has("Cell"));

    it("is named among no diverted references", ({ cellIsDiverted }) => {
      expect(cellIsDiverted).toBe(false);
    });
  });

  describe("a name brought in as a whole module", () => {
    const it = test.extend("cellIsDiverted", () =>
      sourceFactsIn(
        parseSync("cell.ts", 'import * as Cell from "./other.ts";\nexport {};').program,
      ).divertedNames.has("Cell"));

    it("is named among no diverted references", ({ cellIsDiverted }) => {
      expect(cellIsDiverted).toBe(false);
    });
  });

  describe("a class name used as a base", () => {
    const it = test.extend("cellIsDiverted", () =>
      sourceFactsIn(
        parseSync("cell.ts", "class Cell {}\nclass Wider extends Cell {}").program,
      ).divertedNames.has("Cell"));

    it("is named among the diverted references", ({ cellIsDiverted }) => {
      expect(cellIsDiverted).toBe(true);
    });
  });

  describe("a class name handed to a call", () => {
    const it = test.extend("cellIsDiverted", () =>
      sourceFactsIn(
        parseSync("cell.ts", "class Cell {}\nregister(Cell);").program,
      ).divertedNames.has("Cell"));

    it("is named among the diverted references", ({ cellIsDiverted }) => {
      expect(cellIsDiverted).toBe(true);
    });
  });

  describe("a class name listed on the module surface", () => {
    const it = test.extend("cellIsDiverted", () =>
      sourceFactsIn(
        parseSync("cell.ts", "class Cell {}\nexport { Cell };").program,
      ).divertedNames.has("Cell"));

    it("is named among the diverted references", ({ cellIsDiverted }) => {
      expect(cellIsDiverted).toBe(true);
    });
  });

  describe("a class name bound to a second name", () => {
    const it = test.extend("cellIsDiverted", () =>
      sourceFactsIn(
        parseSync("cell.ts", "class Cell {}\nconst Held = Cell;").program,
      ).divertedNames.has("Cell"));

    it("is named among the diverted references", ({ cellIsDiverted }) => {
      expect(cellIsDiverted).toBe(true);
    });
  });

  describe("a class name used only to build an instance", () => {
    const it = test.extend("cellIsDiverted", () =>
      sourceFactsIn(
        parseSync("cell.ts", "class Cell {}\nconst walk = (): Cell => new Cell();").program,
      ).divertedNames.has("Cell"));

    it("is named among no diverted references", ({ cellIsDiverted }) => {
      expect(cellIsDiverted).toBe(false);
    });
  });

  describe("a name that only spells a member key", () => {
    const it = test.extend("cellIsDiverted", () =>
      sourceFactsIn(
        parseSync("cell.ts", "class Cell {}\nconst read = host.Cell;").program,
      ).divertedNames.has("Cell"));

    it("is named among no diverted references", ({ cellIsDiverted }) => {
      expect(cellIsDiverted).toBe(false);
    });
  });

  describe("a name that only spells an object key", () => {
    const it = test.extend("cellIsDiverted", () =>
      sourceFactsIn(
        parseSync("cell.ts", "class Cell {}\nconst host = { Cell: 1 };").program,
      ).divertedNames.has("Cell"));

    it("is named among no diverted references", ({ cellIsDiverted }) => {
      expect(cellIsDiverted).toBe(false);
    });
  });

  describe("a name that only spells a class member key", () => {
    const it = test.extend("cellIsDiverted", () =>
      sourceFactsIn(
        parseSync("cell.ts", "class Cell {}\nclass Host { Cell = 1; }").program,
      ).divertedNames.has("Cell"));

    it("is named among no diverted references", ({ cellIsDiverted }) => {
      expect(cellIsDiverted).toBe(false);
    });
  });

  describe("a name brought in from another module", () => {
    const it = test.extend("cellIsDiverted", () =>
      sourceFactsIn(
        parseSync("cell.ts", 'import { Cell } from "./other.ts";\nconst held = new Cell();')
          .program,
      ).divertedNames.has("Cell"));

    it("is named among no diverted references", ({ cellIsDiverted }) => {
      expect(cellIsDiverted).toBe(false);
    });
  });

  describe("a name read through a computed member", () => {
    const it = test.extend("cellIsDiverted", () =>
      sourceFactsIn(
        parseSync("cell.ts", "class Cell {}\nconst read = host[Cell];").program,
      ).divertedNames.has("Cell"));

    it("is named among the diverted references", ({ cellIsDiverted }) => {
      expect(cellIsDiverted).toBe(true);
    });
  });
});
