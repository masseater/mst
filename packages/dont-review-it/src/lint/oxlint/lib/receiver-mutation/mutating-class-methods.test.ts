import { describe, expect, test } from "vite-plus/test";

import { mutatingMethodNamesIn } from "./mutating-class-methods.ts";

const it = test
  .extend("writingMethod", () =>
    mutatingMethodNamesIn({
      source: "class Bag {\n  add(entry: string) {\n    this.held = entry;\n  }\n}",
      path: "bag.ts",
      className: "Bag",
    }))
  .extend("readingMethod", () =>
    mutatingMethodNamesIn({
      source: "class Bag {\n  read() {\n    return this.held;\n  }\n}",
      path: "bag.ts",
      className: "Bag",
    }),
  )
  .extend("relayedWrite", () =>
    mutatingMethodNamesIn({
      source:
        "class Bag {\n  add(entry: string) {\n    this.keep(entry);\n  }\n  keep(entry: string) {\n    this.held = entry;\n  }\n}",
      path: "bag.ts",
      className: "Bag",
    }),
  )
  .extend("circularCalls", () =>
    mutatingMethodNamesIn({
      source:
        "class Bag {\n  first() {\n    this.second();\n  }\n  second() {\n    this.first();\n    this.held += 1;\n  }\n}",
      path: "bag.ts",
      className: "Bag",
    }),
  )
  .extend("privateRelayedWrite", () =>
    mutatingMethodNamesIn({
      source:
        "class Bag {\n  add(entry: string) {\n    this.#keep(entry);\n  }\n  #keep(entry: string) {\n    this.held = entry;\n  }\n}",
      path: "bag.ts",
      className: "Bag",
    }),
  )
  .extend("constructorAndAccessorWrites", () =>
    mutatingMethodNamesIn({
      source:
        "class Bag {\n  constructor() {\n    this.held = '';\n  }\n  get size() {\n    this.read = 1;\n    return 0;\n  }\n  set size(next: number) {\n    this.held = next;\n  }\n}",
      path: "bag.ts",
      className: "Bag",
    }),
  )
  .extend("arrowFieldWrite", () =>
    mutatingMethodNamesIn({
      source:
        "class Bag {\n  add = (entry: string) => {\n    this.held = entry;\n  };\n  held = '';\n}",
      path: "bag.ts",
      className: "Bag",
    }),
  )
  .extend("spelledOutKeys", () =>
    mutatingMethodNamesIn({
      source:
        "class Bag {\n  ['add'](entry: string) {\n    this.held = entry;\n  }\n  [`drop`]() {\n    delete this.held;\n  }\n}",
      path: "bag.ts",
      className: "Bag",
    }),
  )
  .extend("runtimeSettledKeys", () =>
    mutatingMethodNamesIn({
      source:
        "class Bag {\n  [picked](entry: string) {\n    this.held = entry;\n  }\n  [`add${suffix}`]() {\n    this.held = 1;\n  }\n  [1]() {\n    this.held = 2;\n  }\n  [Symbol.iterator]() {\n    this.held = 3;\n  }\n}",
      path: "bag.ts",
      className: "Bag",
    }),
  )
  .extend("bodilessMembers", () =>
    mutatingMethodNamesIn({
      source:
        "class Bag {\n  accessor held = 1;\n  static {\n    picked = 1;\n  }\n  add(entry: string) {\n    this.held = entry;\n  }\n}",
      path: "bag.ts",
      className: "Bag",
    }),
  )
  .extend("countingAndDeleting", () =>
    mutatingMethodNamesIn({
      source:
        "class Bag {\n  count() {\n    this.total++;\n  }\n  drop() {\n    delete this.held;\n  }\n  deepen() {\n    this.held.inner = 1;\n  }\n}",
      path: "bag.ts",
      className: "Bag",
    }),
  )
  .extend("assertedReceiver", () =>
    mutatingMethodNamesIn({
      source: "class Bag {\n  add() {\n    (this!).held = 1;\n  }\n}",
      path: "bag.ts",
      className: "Bag",
    }),
  )
  .extend("foreignTargetWrites", () =>
    mutatingMethodNamesIn({
      source:
        "class Bag {\n  add(target: { held: number }) {\n    target.held = 1;\n    held = 2;\n    delete target.held;\n  }\n}",
      path: "bag.ts",
      className: "Bag",
    }),
  )
  .extend("ownThisFunctionWrite", () =>
    mutatingMethodNamesIn({
      source:
        "class Bag {\n  add() {\n    const run = function () {\n      this.held = 1;\n    };\n    return run;\n  }\n}",
      path: "bag.ts",
      className: "Bag",
    }),
  )
  .extend("arrowWrite", () =>
    mutatingMethodNamesIn({
      source: "class Bag {\n  add() {\n    return () => {\n      this.held = 1;\n    };\n  }\n}",
      path: "bag.ts",
      className: "Bag",
    }),
  )
  .extend("nestedClassWrite", () =>
    mutatingMethodNamesIn({
      source:
        "class Bag {\n  add() {\n    class Inner {\n      hold() {\n        this.held = 1;\n      }\n    }\n    return Inner;\n  }\n}",
      path: "bag.ts",
      className: "Bag",
    }),
  )
  .extend("foreignReceiverCalls", () =>
    mutatingMethodNamesIn({
      source:
        "class Bag {\n  add(other: Bag) {\n    other.keep();\n    keep();\n    (this.held)();\n  }\n  keep() {\n    this.held = 1;\n  }\n}",
      path: "bag.ts",
      className: "Bag",
    }),
  )
  .extend("exportedClass", () =>
    mutatingMethodNamesIn({
      source: "export class Bag {\n  add(entry: string) {\n    this.held = entry;\n  }\n}",
      path: "bag.ts",
      className: "Bag",
    }),
  )
  .extend("classExpression", () =>
    mutatingMethodNamesIn({
      source: "const Bag = class {\n  add(entry: string) {\n    this.held = entry;\n  }\n};",
      path: "bag.ts",
      className: "Bag",
    }),
  )
  .extend("nonClassBinding", () =>
    mutatingMethodNamesIn({
      source: "const Bag = load();\nfunction Held() {}",
      path: "bag.ts",
      className: "Bag",
    }),
  )
  .extend("anonymousDefaultClass", () =>
    mutatingMethodNamesIn({
      source: "export default class {}",
      path: "bag.ts",
      className: "Bag",
    }),
  )
  .extend("destructuredClassExpression", () =>
    mutatingMethodNamesIn({
      source: "const { Bag } = class {};",
      path: "bag.ts",
      className: "Bag",
    }),
  )
  .extend("reExportedName", () =>
    mutatingMethodNamesIn({
      source: "export { Bag } from './bag.ts';",
      path: "bag.ts",
      className: "Bag",
    }),
  );

describe("mutating-class-methods", () => {
  it("a method writing to this is a method that writes to the receiver", ({ writingMethod }) => {
    expect(writingMethod).toStrictEqual(new Set(["add"]));
  });

  it("a method that only reads leaves the receiver as it was", ({ readingMethod }) => {
    expect(readingMethod).toStrictEqual(new Set([]));
  });

  it("a write reached through another method of the same receiver counts for both", ({
    relayedWrite,
  }) => {
    expect(relayedWrite).toStrictEqual(new Set(["add", "keep"]));
  });

  it("methods calling each other in a circle settle instead of looping", ({ circularCalls }) => {
    expect(circularCalls).toStrictEqual(new Set(["first", "second"]));
  });

  it("a write reached through a private method counts for the method that calls it", ({
    privateRelayedWrite,
  }) => {
    expect(privateRelayedWrite).toStrictEqual(new Set(["#keep", "add"]));
  });

  it("what a constructor and an accessor write is the class settling its own state", ({
    constructorAndAccessorWrites,
  }) => {
    expect(constructorAndAccessorWrites).toStrictEqual(new Set([]));
  });

  it("a method held as an arrow field writes to the receiver", ({ arrowFieldWrite }) => {
    expect(arrowFieldWrite).toStrictEqual(new Set(["add"]));
  });

  it("a name spelled through a string or a template without a substitution is that name", ({
    spelledOutKeys,
  }) => {
    expect(spelledOutKeys).toStrictEqual(new Set(["add", "drop"]));
  });

  it("a name that only settles at runtime names no method to report", ({ runtimeSettledKeys }) => {
    expect(runtimeSettledKeys).toStrictEqual(new Set([]));
  });

  it("a member that is neither a method nor a field holding one carries no body to read", ({
    bodilessMembers,
  }) => {
    expect(bodilessMembers).toStrictEqual(new Set(["add"]));
  });

  it("counting up and deleting are writes to the receiver as much as an assignment is", ({
    countingAndDeleting,
  }) => {
    expect(countingAndDeleting).toStrictEqual(new Set(["count", "deepen", "drop"]));
  });

  it("a receiver wrapped in an assertion is still this", ({ assertedReceiver }) => {
    expect(assertedReceiver).toStrictEqual(new Set(["add"]));
  });

  it("a write to something other than this leaves the receiver as it was", ({
    foreignTargetWrites,
  }) => {
    expect(foreignTargetWrites).toStrictEqual(new Set([]));
  });

  it("a write inside a function that carries its own this is not a write to the receiver", ({
    ownThisFunctionWrite,
  }) => {
    expect(ownThisFunctionWrite).toStrictEqual(new Set([]));
  });

  it("a write inside an arrow is a write to the receiver the arrow stands in", ({ arrowWrite }) => {
    expect(arrowWrite).toStrictEqual(new Set(["add"]));
  });

  it("a class written inside a method keeps its own writes to itself", ({ nestedClassWrite }) => {
    expect(nestedClassWrite).toStrictEqual(new Set([]));
  });

  it("a call on another receiver is no route to a write of this one", ({
    foreignReceiverCalls,
  }) => {
    expect(foreignReceiverCalls).toStrictEqual(new Set(["keep"]));
  });

  it("a class the file sends away under its own name is read the same way", ({ exportedClass }) => {
    expect(exportedClass).toStrictEqual(new Set(["add"]));
  });

  it("a class written as an expression and bound to a name is read the same way", ({
    classExpression,
  }) => {
    expect(classExpression).toStrictEqual(new Set(["add"]));
  });

  it("a name bound to a call declares no class", ({ nonClassBinding }) => {
    expect(nonClassBinding).toBe(null);
  });

  it("a class sent away without a name declares no class under that name", ({
    anonymousDefaultClass,
  }) => {
    expect(anonymousDefaultClass).toBe(null);
  });

  it("a class expression taken apart by a pattern declares no class", ({
    destructuredClassExpression,
  }) => {
    expect(destructuredClassExpression).toBe(null);
  });

  it("a name this file only passes on declares no class", ({ reExportedName }) => {
    expect(reExportedName).toBe(null);
  });
});
