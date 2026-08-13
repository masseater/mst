import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { astFieldsOf, statementsOf } from "../setup-modules/coupling-edges.ts";
import { stateFieldsWrittenAfterConstruction } from "./class-state-writes.ts";

describe("stateFieldsWrittenAfterConstruction", () => {
  describe("a method that adds to a field", () => {
    const it = test.extend("fields", () => {
      const program = astFieldsOf(
        parseSync("cell.ts", "class Tally { total = 0; add(row: number) { this.total += row; } }")
          .program,
      );
      if (program === null) throw new Error("the source was not parsed");
      const [declared] = statementsOf(program);
      if (declared === undefined) throw new Error("the source declares nothing");
      return stateFieldsWrittenAfterConstruction(declared);
    });

    it("names that field", ({ fields }) => {
      expect(fields).toStrictEqual(new Set(["total"]));
    });
  });

  describe("a setter that overwrites a field", () => {
    const it = test.extend("fields", () => {
      const program = astFieldsOf(
        parseSync("cell.ts", "class Held { set seed(next: string) { this.stored = next; } }")
          .program,
      );
      if (program === null) throw new Error("the source was not parsed");
      const [declared] = statementsOf(program);
      if (declared === undefined) throw new Error("the source declares nothing");
      return stateFieldsWrittenAfterConstruction(declared);
    });

    it("names that field", ({ fields }) => {
      expect(fields).toStrictEqual(new Set(["stored"]));
    });
  });

  describe("a method that counts a field up", () => {
    const it = test.extend("fields", () => {
      const program = astFieldsOf(
        parseSync("cell.ts", "class Tick { count = 0; bump() { this.count++; } }").program,
      );
      if (program === null) throw new Error("the source was not parsed");
      const [declared] = statementsOf(program);
      if (declared === undefined) throw new Error("the source declares nothing");
      return stateFieldsWrittenAfterConstruction(declared);
    });

    it("names that field", ({ fields }) => {
      expect(fields).toStrictEqual(new Set(["count"]));
    });
  });

  describe("a method that drops a key off the instance", () => {
    const it = test.extend("fields", () => {
      const program = astFieldsOf(
        parseSync("cell.ts", "class Held { drop() { delete this.spare; } }").program,
      );
      if (program === null) throw new Error("the source was not parsed");
      const [declared] = statementsOf(program);
      if (declared === undefined) throw new Error("the source declares nothing");
      return stateFieldsWrittenAfterConstruction(declared);
    });

    it("names that key", ({ fields }) => {
      expect(fields).toStrictEqual(new Set(["spare"]));
    });
  });

  describe("a method that writes through a field", () => {
    const it = test.extend("fields", () => {
      const program = astFieldsOf(
        parseSync("cell.ts", "class Nest { seen = {}; mark() { this.seen.at = 1; } }").program,
      );
      if (program === null) throw new Error("the source was not parsed");
      const [declared] = statementsOf(program);
      if (declared === undefined) throw new Error("the source declares nothing");
      return stateFieldsWrittenAfterConstruction(declared);
    });

    it("names the field it reaches through", ({ fields }) => {
      expect(fields).toStrictEqual(new Set(["seen"]));
    });
  });

  describe("a method that writes a key spelled as a string", () => {
    const it = test.extend("fields", () => {
      const program = astFieldsOf(
        parseSync("cell.ts", 'class Held { mark() { this["seen"] = 1; } }').program,
      );
      if (program === null) throw new Error("the source was not parsed");
      const [declared] = statementsOf(program);
      if (declared === undefined) throw new Error("the source declares nothing");
      return stateFieldsWrittenAfterConstruction(declared);
    });

    it("names that key", ({ fields }) => {
      expect(fields).toStrictEqual(new Set(["seen"]));
    });
  });

  describe("a method that writes a key spelled in a template", () => {
    const it = test.extend("fields", () => {
      const program = astFieldsOf(
        parseSync("cell.ts", "class Held { mark() { this[`seen`] = 1; } }").program,
      );
      if (program === null) throw new Error("the source was not parsed");
      const [declared] = statementsOf(program);
      if (declared === undefined) throw new Error("the source declares nothing");
      return stateFieldsWrittenAfterConstruction(declared);
    });

    it("names that key", ({ fields }) => {
      expect(fields).toStrictEqual(new Set(["seen"]));
    });
  });

  describe("a method that writes a key decided while it runs", () => {
    const it = test.extend("fields", () => {
      const program = astFieldsOf(
        parseSync("cell.ts", "class Held { mark(key: string) { this[key] = 1; } }").program,
      );
      if (program === null) throw new Error("the source was not parsed");
      const [declared] = statementsOf(program);
      if (declared === undefined) throw new Error("the source declares nothing");
      return stateFieldsWrittenAfterConstruction(declared);
    });

    it("names no field", ({ fields }) => {
      expect(fields).toStrictEqual(new Set());
    });
  });

  describe("a method that writes a key spelled in a template holding a value", () => {
    const it = test.extend("fields", () => {
      const program = astFieldsOf(
        parseSync("cell.ts", "class Held { mark(key: string) { this[`at${key}`] = 1; } }").program,
      );
      if (program === null) throw new Error("the source was not parsed");
      const [declared] = statementsOf(program);
      if (declared === undefined) throw new Error("the source declares nothing");
      return stateFieldsWrittenAfterConstruction(declared);
    });

    it("names no field", ({ fields }) => {
      expect(fields).toStrictEqual(new Set());
    });
  });

  describe("a method that writes a number key", () => {
    const it = test.extend("fields", () => {
      const program = astFieldsOf(
        parseSync("cell.ts", "class Held { mark() { this[0] = 1; } }").program,
      );
      if (program === null) throw new Error("the source was not parsed");
      const [declared] = statementsOf(program);
      if (declared === undefined) throw new Error("the source declares nothing");
      return stateFieldsWrittenAfterConstruction(declared);
    });

    it("names no field", ({ fields }) => {
      expect(fields).toStrictEqual(new Set());
    });
  });

  describe("a class settled by its constructor alone", () => {
    const it = test.extend("fields", () => {
      const program = astFieldsOf(
        parseSync(
          "cell.ts",
          "class Settled { seed: string; constructor(seed: string) { this.seed = seed; } }",
        ).program,
      );
      if (program === null) throw new Error("the source was not parsed");
      const [declared] = statementsOf(program);
      if (declared === undefined) throw new Error("the source declares nothing");
      return stateFieldsWrittenAfterConstruction(declared);
    });

    it("names no field", ({ fields }) => {
      expect(fields).toStrictEqual(new Set());
    });
  });

  describe("a handler the constructor parks on the instance", () => {
    const it = test.extend("fields", () => {
      const program = astFieldsOf(
        parseSync(
          "cell.ts",
          "class Late { count = 0; constructor() { this.bump = () => { this.count += 1; }; } }",
        ).program,
      );
      if (program === null) throw new Error("the source was not parsed");
      const [declared] = statementsOf(program);
      if (declared === undefined) throw new Error("the source declares nothing");
      return stateFieldsWrittenAfterConstruction(declared);
    });

    it("names the field it later writes", ({ fields }) => {
      expect(fields).toStrictEqual(new Set(["count"]));
    });
  });

  describe("a field holding a function that writes", () => {
    const it = test.extend("fields", () => {
      const program = astFieldsOf(
        parseSync("cell.ts", "class Late { count = 0; bump = () => { this.count += 1; }; }")
          .program,
      );
      if (program === null) throw new Error("the source was not parsed");
      const [declared] = statementsOf(program);
      if (declared === undefined) throw new Error("the source declares nothing");
      return stateFieldsWrittenAfterConstruction(declared);
    });

    it("names that field", ({ fields }) => {
      expect(fields).toStrictEqual(new Set(["count"]));
    });
  });

  describe("a field holding a function of its own this", () => {
    const it = test.extend("fields", () => {
      const program = astFieldsOf(
        parseSync("cell.ts", "class Held { count = 0; bump = function () { this.count += 1; }; }")
          .program,
      );
      if (program === null) throw new Error("the source was not parsed");
      const [declared] = statementsOf(program);
      if (declared === undefined) throw new Error("the source declares nothing");
      return stateFieldsWrittenAfterConstruction(declared);
    });

    it("names no field", ({ fields }) => {
      expect(fields).toStrictEqual(new Set());
    });
  });

  describe("a field written straight through the initializer", () => {
    const it = test.extend("fields", () => {
      const program = astFieldsOf(
        parseSync("cell.ts", "class Held { seen = (this.count = 1); }").program,
      );
      if (program === null) throw new Error("the source was not parsed");
      const [declared] = statementsOf(program);
      if (declared === undefined) throw new Error("the source declares nothing");
      return stateFieldsWrittenAfterConstruction(declared);
    });

    it("names no field", ({ fields }) => {
      expect(fields).toStrictEqual(new Set());
    });
  });

  describe("a method holding a function of its own this", () => {
    const it = test.extend("fields", () => {
      const program = astFieldsOf(
        parseSync(
          "cell.ts",
          "class Held { mark() { const run = function () { this.count = 1; }; return run; } }",
        ).program,
      );
      if (program === null) throw new Error("the source was not parsed");
      const [declared] = statementsOf(program);
      if (declared === undefined) throw new Error("the source declares nothing");
      return stateFieldsWrittenAfterConstruction(declared);
    });

    it("names no field", ({ fields }) => {
      expect(fields).toStrictEqual(new Set());
    });
  });

  describe("a class that keeps its state on the class itself", () => {
    const it = test.extend("fields", () => {
      const program = astFieldsOf(
        parseSync("cell.ts", "class Held { static made = 0; static bump() { this.made += 1; } }")
          .program,
      );
      if (program === null) throw new Error("the source was not parsed");
      const [declared] = statementsOf(program);
      if (declared === undefined) throw new Error("the source declares nothing");
      return stateFieldsWrittenAfterConstruction(declared);
    });

    it("names no field", ({ fields }) => {
      expect(fields).toStrictEqual(new Set());
    });
  });

  describe("a block that runs when the class is defined", () => {
    const it = test.extend("fields", () => {
      const program = astFieldsOf(
        parseSync("cell.ts", "class Held { static { this.made = 1; } }").program,
      );
      if (program === null) throw new Error("the source was not parsed");
      const [declared] = statementsOf(program);
      if (declared === undefined) throw new Error("the source declares nothing");
      return stateFieldsWrittenAfterConstruction(declared);
    });

    it("names no field", ({ fields }) => {
      expect(fields).toStrictEqual(new Set());
    });
  });

  describe("a method that writes to something other than the instance", () => {
    const it = test.extend("fields", () => {
      const program = astFieldsOf(
        parseSync("cell.ts", "class Held { mark(sink: { at: number }) { sink.at = 1; } }").program,
      );
      if (program === null) throw new Error("the source was not parsed");
      const [declared] = statementsOf(program);
      if (declared === undefined) throw new Error("the source declares nothing");
      return stateFieldsWrittenAfterConstruction(declared);
    });

    it("names no field", ({ fields }) => {
      expect(fields).toStrictEqual(new Set());
    });
  });

  describe("a method that only reads the instance", () => {
    const it = test.extend("fields", () => {
      const program = astFieldsOf(
        parseSync("cell.ts", "class Held { seen = 0; read() { return this.seen; } }").program,
      );
      if (program === null) throw new Error("the source was not parsed");
      const [declared] = statementsOf(program);
      if (declared === undefined) throw new Error("the source declares nothing");
      return stateFieldsWrittenAfterConstruction(declared);
    });

    it("names no field", ({ fields }) => {
      expect(fields).toStrictEqual(new Set());
    });
  });

  describe("a method that negates a value", () => {
    const it = test.extend("fields", () => {
      const program = astFieldsOf(
        parseSync("cell.ts", "class Held { read() { return !this.seen; } }").program,
      );
      if (program === null) throw new Error("the source was not parsed");
      const [declared] = statementsOf(program);
      if (declared === undefined) throw new Error("the source declares nothing");
      return stateFieldsWrittenAfterConstruction(declared);
    });

    it("names no field", ({ fields }) => {
      expect(fields).toStrictEqual(new Set());
    });
  });

  describe("a method that writes through an assertion", () => {
    const it = test.extend("fields", () => {
      const program = astFieldsOf(
        parseSync("cell.ts", "class Held { mark() { (this as Held).seen = 1; } }").program,
      );
      if (program === null) throw new Error("the source was not parsed");
      const [declared] = statementsOf(program);
      if (declared === undefined) throw new Error("the source declares nothing");
      return stateFieldsWrittenAfterConstruction(declared);
    });

    it("names the asserted field", ({ fields }) => {
      expect(fields).toStrictEqual(new Set(["seen"]));
    });
  });

  describe("a method that writes a key kept private to the class", () => {
    const it = test.extend("fields", () => {
      const program = astFieldsOf(
        parseSync("cell.ts", "class Held { #count = 0; mark() { this.#count = 1; } }").program,
      );
      if (program === null) throw new Error("the source was not parsed");
      const [declared] = statementsOf(program);
      if (declared === undefined) throw new Error("the source declares nothing");
      return stateFieldsWrittenAfterConstruction(declared);
    });

    it("names that key", ({ fields }) => {
      expect(fields).toStrictEqual(new Set(["#count"]));
    });
  });

  describe("a class that declares no member", () => {
    const it = test.extend("fields", () => {
      const program = astFieldsOf(parseSync("cell.ts", "class Empty {}").program);
      if (program === null) throw new Error("the source was not parsed");
      const [declared] = statementsOf(program);
      if (declared === undefined) throw new Error("the source declares nothing");
      return stateFieldsWrittenAfterConstruction(declared);
    });

    it("names no field", ({ fields }) => {
      expect(fields).toStrictEqual(new Set());
    });
  });

  describe("a declaration that is not a class", () => {
    const it = test.extend("fields", () => {
      const program = astFieldsOf(parseSync("cell.ts", "const held = 1;").program);
      if (program === null) throw new Error("the source was not parsed");
      const [declared] = statementsOf(program);
      if (declared === undefined) throw new Error("the source declares nothing");
      return stateFieldsWrittenAfterConstruction(declared);
    });

    it("names no field", ({ fields }) => {
      expect(fields).toStrictEqual(new Set());
    });
  });
});
