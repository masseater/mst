import { describe, expect, test } from "vite-plus/test";

import { mutatingMethodNamesIn } from "./mutating-class-methods.ts";

describe("mutatingMethodNamesIn", () => {
  describe("a method writing to this", () => {
    const it = test.extend("writingMethod", () =>
      mutatingMethodNamesIn({
        source: "class Bag {\n  add(entry: string) {\n    this.held = entry;\n  }\n}",
        path: "bag.ts",
        className: "Bag",
      }));

    it("is a method that writes to the receiver", ({ writingMethod }) => {
      expect(writingMethod).toStrictEqual(new Set(["add"]));
    });
  });

  describe("a method that only reads", () => {
    const it = test.extend("readingMethod", () =>
      mutatingMethodNamesIn({
        source: "class Bag {\n  read() {\n    return this.held;\n  }\n}",
        path: "bag.ts",
        className: "Bag",
      }));

    it("leaves the receiver as it was", ({ readingMethod }) => {
      expect(readingMethod).toStrictEqual(new Set());
    });
  });

  describe("a write reached through another method of the same receiver", () => {
    const it = test.extend("relayedWrite", () =>
      mutatingMethodNamesIn({
        source:
          "class Bag {\n  add(entry: string) {\n    this.keep(entry);\n  }\n  keep(entry: string) {\n    this.held = entry;\n  }\n}",
        path: "bag.ts",
        className: "Bag",
      }));

    it("counts for both", ({ relayedWrite }) => {
      expect(relayedWrite).toStrictEqual(new Set(["add", "keep"]));
    });
  });

  describe("methods calling each other in a circle", () => {
    const it = test.extend("circularCalls", () =>
      mutatingMethodNamesIn({
        source:
          "class Bag {\n  first() {\n    this.second();\n  }\n  second() {\n    this.first();\n    this.held += 1;\n  }\n}",
        path: "bag.ts",
        className: "Bag",
      }));

    it("settle instead of looping", ({ circularCalls }) => {
      expect(circularCalls).toStrictEqual(new Set(["first", "second"]));
    });
  });

  describe("a write reached through a private method", () => {
    const it = test.extend("privateRelayedWrite", () =>
      mutatingMethodNamesIn({
        source:
          "class Bag {\n  add(entry: string) {\n    this.#keep(entry);\n  }\n  #keep(entry: string) {\n    this.held = entry;\n  }\n}",
        path: "bag.ts",
        className: "Bag",
      }));

    it("counts for the method that calls it", ({ privateRelayedWrite }) => {
      expect(privateRelayedWrite).toStrictEqual(new Set(["#keep", "add"]));
    });
  });

  describe("what a constructor and an accessor write", () => {
    const it = test.extend("constructorAndAccessorWrites", () =>
      mutatingMethodNamesIn({
        source:
          "class Bag {\n  constructor() {\n    this.held = '';\n  }\n  get size() {\n    this.read = 1;\n    return 0;\n  }\n  set size(next: number) {\n    this.held = next;\n  }\n}",
        path: "bag.ts",
        className: "Bag",
      }));

    it("is the class settling its own state", ({ constructorAndAccessorWrites }) => {
      expect(constructorAndAccessorWrites).toStrictEqual(new Set());
    });
  });

  describe("a method held as an arrow field", () => {
    const it = test.extend("arrowFieldWrite", () =>
      mutatingMethodNamesIn({
        source:
          "class Bag {\n  add = (entry: string) => {\n    this.held = entry;\n  };\n  held = '';\n}",
        path: "bag.ts",
        className: "Bag",
      }));

    it("writes to the receiver", ({ arrowFieldWrite }) => {
      expect(arrowFieldWrite).toStrictEqual(new Set(["add"]));
    });
  });

  describe("a name spelled through a string or a template without a substitution", () => {
    const it = test.extend("spelledOutKeys", () =>
      mutatingMethodNamesIn({
        source:
          "class Bag {\n  ['add'](entry: string) {\n    this.held = entry;\n  }\n  [`drop`]() {\n    delete this.held;\n  }\n}",
        path: "bag.ts",
        className: "Bag",
      }));

    it("is that name", ({ spelledOutKeys }) => {
      expect(spelledOutKeys).toStrictEqual(new Set(["add", "drop"]));
    });
  });

  describe("a name that only settles at runtime", () => {
    const it = test.extend("runtimeSettledKeys", () =>
      mutatingMethodNamesIn({
        source:
          "class Bag {\n  [picked](entry: string) {\n    this.held = entry;\n  }\n  [`add${suffix}`]() {\n    this.held = 1;\n  }\n  [1]() {\n    this.held = 2;\n  }\n  [Symbol.iterator]() {\n    this.held = 3;\n  }\n}",
        path: "bag.ts",
        className: "Bag",
      }));

    it("names no method to report", ({ runtimeSettledKeys }) => {
      expect(runtimeSettledKeys).toStrictEqual(new Set());
    });
  });

  describe("a member that is neither a method nor a field holding one", () => {
    const it = test.extend("bodilessMembers", () =>
      mutatingMethodNamesIn({
        source:
          "class Bag {\n  accessor held = 1;\n  static {\n    picked = 1;\n  }\n  add(entry: string) {\n    this.held = entry;\n  }\n}",
        path: "bag.ts",
        className: "Bag",
      }));

    it("carries no body to read", ({ bodilessMembers }) => {
      expect(bodilessMembers).toStrictEqual(new Set(["add"]));
    });
  });

  describe("counting up and deleting", () => {
    const it = test.extend("countingAndDeleting", () =>
      mutatingMethodNamesIn({
        source:
          "class Bag {\n  count() {\n    this.total++;\n  }\n  drop() {\n    delete this.held;\n  }\n  deepen() {\n    this.held.inner = 1;\n  }\n}",
        path: "bag.ts",
        className: "Bag",
      }));

    it("are writes to the receiver as much as an assignment is", ({ countingAndDeleting }) => {
      expect(countingAndDeleting).toStrictEqual(new Set(["count", "deepen", "drop"]));
    });
  });

  describe("a receiver wrapped in an assertion", () => {
    const it = test.extend("assertedReceiver", () =>
      mutatingMethodNamesIn({
        source: "class Bag {\n  add() {\n    (this!).held = 1;\n  }\n}",
        path: "bag.ts",
        className: "Bag",
      }));

    it("is still this", ({ assertedReceiver }) => {
      expect(assertedReceiver).toStrictEqual(new Set(["add"]));
    });
  });

  describe("a write to something other than this", () => {
    const it = test.extend("foreignTargetWrites", () =>
      mutatingMethodNamesIn({
        source:
          "class Bag {\n  add(target: { held: number }) {\n    target.held = 1;\n    held = 2;\n    delete target.held;\n  }\n}",
        path: "bag.ts",
        className: "Bag",
      }));

    it("leaves the receiver as it was", ({ foreignTargetWrites }) => {
      expect(foreignTargetWrites).toStrictEqual(new Set());
    });
  });

  describe("a write inside a function that carries its own this", () => {
    const it = test.extend("ownThisFunctionWrite", () =>
      mutatingMethodNamesIn({
        source:
          "class Bag {\n  add() {\n    const run = function () {\n      this.held = 1;\n    };\n    return run;\n  }\n}",
        path: "bag.ts",
        className: "Bag",
      }));

    it("is not a write to the receiver", ({ ownThisFunctionWrite }) => {
      expect(ownThisFunctionWrite).toStrictEqual(new Set());
    });
  });

  describe("a write inside an arrow", () => {
    const it = test.extend("arrowWrite", () =>
      mutatingMethodNamesIn({
        source: "class Bag {\n  add() {\n    return () => {\n      this.held = 1;\n    };\n  }\n}",
        path: "bag.ts",
        className: "Bag",
      }));

    it("is a write to the receiver the arrow stands in", ({ arrowWrite }) => {
      expect(arrowWrite).toStrictEqual(new Set(["add"]));
    });
  });

  describe("a class written inside a method", () => {
    const it = test.extend("nestedClassWrite", () =>
      mutatingMethodNamesIn({
        source:
          "class Bag {\n  add() {\n    class Inner {\n      hold() {\n        this.held = 1;\n      }\n    }\n    return Inner;\n  }\n}",
        path: "bag.ts",
        className: "Bag",
      }));

    it("keeps its own writes to itself", ({ nestedClassWrite }) => {
      expect(nestedClassWrite).toStrictEqual(new Set());
    });
  });

  describe("a call on another receiver", () => {
    const it = test.extend("foreignReceiverCalls", () =>
      mutatingMethodNamesIn({
        source:
          "class Bag {\n  add(other: Bag) {\n    other.keep();\n    keep();\n    (this.held)();\n  }\n  keep() {\n    this.held = 1;\n  }\n}",
        path: "bag.ts",
        className: "Bag",
      }));

    it("is no route to a write of this one", ({ foreignReceiverCalls }) => {
      expect(foreignReceiverCalls).toStrictEqual(new Set(["keep"]));
    });
  });

  describe("a class the file sends away under its own name", () => {
    const it = test.extend("exportedClass", () =>
      mutatingMethodNamesIn({
        source: "export class Bag {\n  add(entry: string) {\n    this.held = entry;\n  }\n}",
        path: "bag.ts",
        className: "Bag",
      }));

    it("is read the same way", ({ exportedClass }) => {
      expect(exportedClass).toStrictEqual(new Set(["add"]));
    });
  });

  describe("a class written as an expression and bound to a name", () => {
    const it = test.extend("classExpression", () =>
      mutatingMethodNamesIn({
        source: "const Bag = class {\n  add(entry: string) {\n    this.held = entry;\n  }\n};",
        path: "bag.ts",
        className: "Bag",
      }));

    it("is read the same way", ({ classExpression }) => {
      expect(classExpression).toStrictEqual(new Set(["add"]));
    });
  });

  describe("a name bound to a call", () => {
    const it = test.extend("nonClassBinding", () =>
      mutatingMethodNamesIn({
        source: "const Bag = load();\nfunction Held() {}",
        path: "bag.ts",
        className: "Bag",
      }));

    it("declares no class", ({ nonClassBinding }) => {
      expect(nonClassBinding).toBe(null);
    });
  });

  describe("a class sent away without a name", () => {
    const it = test.extend("anonymousDefaultClass", () =>
      mutatingMethodNamesIn({
        source: "export default class {}",
        path: "bag.ts",
        className: "Bag",
      }));

    it("declares no class under that name", ({ anonymousDefaultClass }) => {
      expect(anonymousDefaultClass).toBe(null);
    });
  });

  describe("a class expression taken apart by a pattern", () => {
    const it = test.extend("destructuredClassExpression", () =>
      mutatingMethodNamesIn({
        source: "const { Bag } = class {};",
        path: "bag.ts",
        className: "Bag",
      }));

    it("declares no class", ({ destructuredClassExpression }) => {
      expect(destructuredClassExpression).toBe(null);
    });
  });

  describe("a name this file only passes on", () => {
    const it = test.extend("reExportedName", () =>
      mutatingMethodNamesIn({
        source: "export { Bag } from './bag.ts';",
        path: "bag.ts",
        className: "Bag",
      }));

    it("declares no class", ({ reExportedName }) => {
      expect(reExportedName).toBe(null);
    });
  });
});
