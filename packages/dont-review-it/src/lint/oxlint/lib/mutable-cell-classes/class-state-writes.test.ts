import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { astFieldsOf, statementsOf } from "../setup-modules/coupling-edges.ts";
import { stateFieldsWrittenAfterConstruction } from "./class-state-writes.ts";

const fieldsOf = (sourceText: string): readonly string[] => {
  const program = astFieldsOf(parseSync("cell.ts", sourceText).program);
  if (program === null) throw new Error(`nothing was parsed from: ${sourceText}`);

  const [declared] = statementsOf(program);
  if (declared === undefined) throw new Error(`nothing is declared by: ${sourceText}`);
  return stateFieldsWrittenAfterConstruction(declared);
};

describe("stateFieldsWrittenAfterConstruction", () => {
  test("a method that adds to a field names that field", () => {
    expect(
      fieldsOf("class Tally { total = 0; add(row: number) { this.total += row; } }"),
    ).toStrictEqual(["total"]);
  });

  test("a setter that overwrites a field names that field", () => {
    expect(fieldsOf("class Held { set seed(next: string) { this.stored = next; } }")).toStrictEqual(
      ["stored"],
    );
  });

  test("a method that counts a field up names that field", () => {
    expect(fieldsOf("class Tick { count = 0; bump() { this.count++; } }")).toStrictEqual(["count"]);
  });

  test("a method that drops a key off the instance names that key", () => {
    expect(fieldsOf("class Held { drop() { delete this.spare; } }")).toStrictEqual(["spare"]);
  });

  test("a method that writes through a field names the field it reaches through", () => {
    expect(fieldsOf("class Nest { seen = {}; mark() { this.seen.at = 1; } }")).toStrictEqual([
      "seen",
    ]);
  });

  test("a method that writes a key spelled as a string names that key", () => {
    expect(fieldsOf('class Held { mark() { this["seen"] = 1; } }')).toStrictEqual(["seen"]);
  });

  test("a method that writes a key spelled in a template names that key", () => {
    expect(fieldsOf("class Held { mark() { this[`seen`] = 1; } }")).toStrictEqual(["seen"]);
  });

  test("a method that writes a key decided while it runs names no field", () => {
    expect(fieldsOf("class Held { mark(key: string) { this[key] = 1; } }")).toStrictEqual([]);
  });

  test("a method that writes a key spelled in a template holding a value names no field", () => {
    expect(fieldsOf("class Held { mark(key: string) { this[`at${key}`] = 1; } }")).toStrictEqual(
      [],
    );
  });

  test("a method that writes a number key names no field", () => {
    expect(fieldsOf("class Held { mark() { this[0] = 1; } }")).toStrictEqual([]);
  });

  test("a class settled by its constructor alone names no field", () => {
    expect(
      fieldsOf("class Settled { seed: string; constructor(seed: string) { this.seed = seed; } }"),
    ).toStrictEqual([]);
  });

  test("a handler the constructor parks on the instance names the field it later writes", () => {
    expect(
      fieldsOf(
        "class Late { count = 0; constructor() { this.bump = () => { this.count += 1; }; } }",
      ),
    ).toStrictEqual(["count"]);
  });

  test("a field holding a function that writes names that field", () => {
    expect(fieldsOf("class Late { count = 0; bump = () => { this.count += 1; }; }")).toStrictEqual([
      "count",
    ]);
  });

  test("a field holding a function of its own this names no field", () => {
    expect(
      fieldsOf("class Held { count = 0; bump = function () { this.count += 1; }; }"),
    ).toStrictEqual([]);
  });

  test("a field written straight through the initializer names no field", () => {
    expect(fieldsOf("class Held { seen = (this.count = 1); }")).toStrictEqual([]);
  });

  test("a method holding a function of its own this names no field", () => {
    expect(
      fieldsOf(
        "class Held { mark() { const run = function () { this.count = 1; }; return run; } }",
      ),
    ).toStrictEqual([]);
  });

  test("a class that keeps its state on the class itself names no field", () => {
    expect(
      fieldsOf("class Held { static made = 0; static bump() { this.made += 1; } }"),
    ).toStrictEqual([]);
  });

  test("a block that runs when the class is defined names no field", () => {
    expect(fieldsOf("class Held { static { this.made = 1; } }")).toStrictEqual([]);
  });

  test("a method that writes to something other than the instance names no field", () => {
    expect(fieldsOf("class Held { mark(sink: { at: number }) { sink.at = 1; } }")).toStrictEqual(
      [],
    );
  });

  test("a method that only reads the instance names no field", () => {
    expect(fieldsOf("class Held { seen = 0; read() { return this.seen; } }")).toStrictEqual([]);
  });

  test("a method that negates a value names no field", () => {
    expect(fieldsOf("class Held { read() { return !this.seen; } }")).toStrictEqual([]);
  });

  test("a method that writes through an assertion names the asserted field", () => {
    expect(fieldsOf("class Held { mark() { (this as Held).seen = 1; } }")).toStrictEqual(["seen"]);
  });

  test("a method that writes a key kept private to the class names that key", () => {
    expect(fieldsOf("class Held { #count = 0; mark() { this.#count = 1; } }")).toStrictEqual([
      "#count",
    ]);
  });

  test("a class that declares no member names no field", () => {
    expect(fieldsOf("class Empty {}")).toStrictEqual([]);
  });

  test("a declaration that is not a class names no field", () => {
    expect(fieldsOf("const held = 1;")).toStrictEqual([]);
  });
});
