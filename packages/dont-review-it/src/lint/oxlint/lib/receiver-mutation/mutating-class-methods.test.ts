import { describe, expect, test } from "vite-plus/test";

import { mutatingMethodNamesIn } from "./mutating-class-methods.ts";

const namesIn = (source: string, className = "Bag"): readonly string[] | null => {
  const found = mutatingMethodNamesIn({ source, path: "bag.ts", className });
  return found === null ? null : [...found].toSorted();
};

describe("mutating-class-methods", () => {
  test("a method writing to this is a method that writes to the receiver", () => {
    expect(
      namesIn("class Bag {\n  add(entry: string) {\n    this.held = entry;\n  }\n}"),
    ).toStrictEqual(["add"]);
  });

  test("a method that only reads leaves the receiver as it was", () => {
    expect(namesIn("class Bag {\n  read() {\n    return this.held;\n  }\n}")).toStrictEqual([]);
  });

  test("a write reached through another method of the same receiver counts for both", () => {
    expect(
      namesIn(
        "class Bag {\n  add(entry: string) {\n    this.keep(entry);\n  }\n  keep(entry: string) {\n    this.held = entry;\n  }\n}",
      ),
    ).toStrictEqual(["add", "keep"]);
  });

  test("methods calling each other in a circle settle instead of looping", () => {
    expect(
      namesIn(
        "class Bag {\n  first() {\n    this.second();\n  }\n  second() {\n    this.first();\n    this.held += 1;\n  }\n}",
      ),
    ).toStrictEqual(["first", "second"]);
  });

  test("a write reached through a private method counts for the method that calls it", () => {
    expect(
      namesIn(
        "class Bag {\n  add(entry: string) {\n    this.#keep(entry);\n  }\n  #keep(entry: string) {\n    this.held = entry;\n  }\n}",
      ),
    ).toStrictEqual(["#keep", "add"]);
  });

  test("what a constructor and an accessor write is the class settling its own state", () => {
    expect(
      namesIn(
        "class Bag {\n  constructor() {\n    this.held = '';\n  }\n  get size() {\n    this.read = 1;\n    return 0;\n  }\n  set size(next: number) {\n    this.held = next;\n  }\n}",
      ),
    ).toStrictEqual([]);
  });

  test("a method held as an arrow field writes to the receiver, a plain value does not", () => {
    expect(
      namesIn(
        "class Bag {\n  add = (entry: string) => {\n    this.held = entry;\n  };\n  held = '';\n}",
      ),
    ).toStrictEqual(["add"]);
  });

  test("a name spelled through a string or a template without a substitution is that name", () => {
    expect(
      namesIn(
        "class Bag {\n  ['add'](entry: string) {\n    this.held = entry;\n  }\n  [`drop`]() {\n    delete this.held;\n  }\n}",
      ),
    ).toStrictEqual(["add", "drop"]);
  });

  test("a name that only settles at runtime names no method to report", () => {
    expect(
      namesIn(
        "class Bag {\n  [picked](entry: string) {\n    this.held = entry;\n  }\n  [`add${suffix}`]() {\n    this.held = 1;\n  }\n  [1]() {\n    this.held = 2;\n  }\n  [Symbol.iterator]() {\n    this.held = 3;\n  }\n}",
      ),
    ).toStrictEqual([]);
  });

  test("a member that is neither a method nor a field holding one carries no body to read", () => {
    expect(
      namesIn(
        "class Bag {\n  accessor held = 1;\n  static {\n    picked = 1;\n  }\n  add(entry: string) {\n    this.held = entry;\n  }\n}",
      ),
    ).toStrictEqual(["add"]);
  });

  test("counting up and deleting are writes to the receiver as much as an assignment is", () => {
    expect(
      namesIn(
        "class Bag {\n  count() {\n    this.total++;\n  }\n  drop() {\n    delete this.held;\n  }\n  deepen() {\n    this.held.inner = 1;\n  }\n}",
      ),
    ).toStrictEqual(["count", "deepen", "drop"]);
  });

  test("a receiver wrapped in an assertion is still this", () => {
    expect(namesIn("class Bag {\n  add() {\n    (this!).held = 1;\n  }\n}")).toStrictEqual(["add"]);
  });

  test("a write to something other than this leaves the receiver as it was", () => {
    expect(
      namesIn(
        "class Bag {\n  add(target: { held: number }) {\n    target.held = 1;\n    held = 2;\n    delete target.held;\n  }\n}",
      ),
    ).toStrictEqual([]);
  });

  test("a write inside a function that carries its own this is not a write to the receiver", () => {
    expect(
      namesIn(
        "class Bag {\n  add() {\n    const run = function () {\n      this.held = 1;\n    };\n    return run;\n  }\n}",
      ),
    ).toStrictEqual([]);
  });

  test("a write inside an arrow is a write to the receiver the arrow stands in", () => {
    expect(
      namesIn("class Bag {\n  add() {\n    return () => {\n      this.held = 1;\n    };\n  }\n}"),
    ).toStrictEqual(["add"]);
  });

  test("a class written inside a method keeps its own writes to itself", () => {
    expect(
      namesIn(
        "class Bag {\n  add() {\n    class Inner {\n      hold() {\n        this.held = 1;\n      }\n    }\n    return Inner;\n  }\n}",
      ),
    ).toStrictEqual([]);
  });

  test("a call on another receiver is no route to a write of this one", () => {
    expect(
      namesIn(
        "class Bag {\n  add(other: Bag) {\n    other.keep();\n    keep();\n    (this.held)();\n  }\n  keep() {\n    this.held = 1;\n  }\n}",
      ),
    ).toStrictEqual(["keep"]);
  });

  test("a class the file sends away under its own name is read the same way", () => {
    expect(
      namesIn("export class Bag {\n  add(entry: string) {\n    this.held = entry;\n  }\n}"),
    ).toStrictEqual(["add"]);
  });

  test("a class written as an expression and bound to a name is read the same way", () => {
    expect(
      namesIn("const Bag = class {\n  add(entry: string) {\n    this.held = entry;\n  }\n};"),
    ).toStrictEqual(["add"]);
  });

  test("a name this file binds to something other than a class declares no class", () => {
    expect(namesIn("const Bag = load();\nfunction Held() {}")).toBe(null);
    expect(namesIn("export default class {}")).toBe(null);
    expect(namesIn("const { Bag } = class {};")).toBe(null);
    expect(namesIn("export { Bag } from './bag.ts';")).toBe(null);
  });
});
