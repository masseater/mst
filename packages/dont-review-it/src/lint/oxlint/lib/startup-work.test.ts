import { describe, expect, test } from "vite-plus/test";

import { carriesStartupWork } from "./startup-work.ts";

describe("carriesStartupWork", () => {
  describe("a literal", () => {
    const it = test.extend("verdict", () =>
      carriesStartupWork({ type: "NumericLiteral", value: 200 }));

    it("runs nothing where it stands", ({ verdict }) => {
      expect(verdict).toBe(false);
    });
  });

  describe("a call standing on its own", () => {
    const it = test.extend("verdict", () =>
      carriesStartupWork({ type: "CallExpression", callee: { type: "Identifier", name: "read" } }));

    it("runs where it stands", ({ verdict }) => {
      expect(verdict).toBe(true);
    });
  });

  describe("an arrow function whose body calls something", () => {
    const it = test.extend("verdict", () =>
      carriesStartupWork({
        type: "ArrowFunctionExpression",
        body: { type: "CallExpression", callee: { type: "Identifier", name: "read" } },
      }));

    it("defers that call to the call site", ({ verdict }) => {
      expect(verdict).toBe(false);
    });
  });

  describe("an object holding arrow functions that call something", () => {
    const it = test.extend("verdict", () =>
      carriesStartupWork({
        type: "ObjectExpression",
        properties: [
          {
            type: "Property",
            value: {
              type: "ArrowFunctionExpression",
              body: { type: "CallExpression", callee: { type: "Identifier", name: "read" } },
            },
          },
        ],
      }));

    it("runs nothing where it stands", ({ verdict }) => {
      expect(verdict).toBe(false);
    });
  });

  describe("an object holding a call in a field", () => {
    const it = test.extend("verdict", () =>
      carriesStartupWork({
        type: "ObjectExpression",
        properties: [
          {
            type: "Property",
            value: { type: "CallExpression", callee: { type: "Identifier", name: "read" } },
          },
        ],
      }));

    it("runs where it stands", ({ verdict }) => {
      expect(verdict).toBe(true);
    });
  });

  describe("a construction of a collection from a list of literals", () => {
    const it = test.extend("verdict", () =>
      carriesStartupWork({
        type: "NewExpression",
        callee: { type: "Identifier", name: "Set" },
        arguments: [{ type: "ArrayExpression", elements: [{ type: "StringLiteral", value: "a" }] }],
      }));

    it("runs nothing that reaches outside itself", ({ verdict }) => {
      expect(verdict).toBe(false);
    });
  });

  describe("an awaited expression", () => {
    const it = test.extend("verdict", () =>
      carriesStartupWork({
        type: "AwaitExpression",
        argument: { type: "Identifier", name: "pending" },
      }));

    it("runs where it stands", ({ verdict }) => {
      expect(verdict).toBe(true);
    });
  });

  describe("a field carrying nothing", () => {
    const it = test.extend("verdict", () => carriesStartupWork(null));

    it("runs nothing where it stands", ({ verdict }) => {
      expect(verdict).toBe(false);
    });
  });
});
