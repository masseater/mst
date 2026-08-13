import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { destructuredBindingsOf } from "./destructured-bindings.ts";

import type { ESTree } from "@oxlint/plugins";

describe("destructuredBindingsOf", () => {
  describe("a name bound whole", () => {
    const it = test.extend("bindings", () => {
      const declaration = parseSync("spec.ts", `const held = (context) => context;`).program
        .body[0] as ESTree.VariableDeclaration;
      const declarator = declaration.declarations[0] as ESTree.VariableDeclarator;
      const pattern = (declarator.init as ESTree.ArrowFunctionExpression)
        .params[0] as ESTree.ParamPattern;
      return destructuredBindingsOf(pattern).map((binding) => ({
        name: binding.name.name,
        depth: binding.depth,
      }));
    });

    it("sits at the depth of the value it names", ({ bindings }) => {
      expect(bindings).toStrictEqual([{ name: "context", depth: 0 }]);
    });
  });

  describe("a key taken out of an object pattern", () => {
    const it = test.extend("bindings", () => {
      const declaration = parseSync("spec.ts", `const held = ({ report }) => report;`).program
        .body[0] as ESTree.VariableDeclaration;
      const declarator = declaration.declarations[0] as ESTree.VariableDeclarator;
      const pattern = (declarator.init as ESTree.ArrowFunctionExpression)
        .params[0] as ESTree.ParamPattern;
      return destructuredBindingsOf(pattern).map((binding) => ({
        name: binding.name.name,
        depth: binding.depth,
      }));
    });

    it("sits one level under the value", ({ bindings }) => {
      expect(bindings).toStrictEqual([{ name: "report", depth: 1 }]);
    });
  });

  describe("renaming a key", () => {
    const it = test.extend("bindings", () => {
      const declaration = parseSync("spec.ts", `const held = ({ report: summary }) => summary;`)
        .program.body[0] as ESTree.VariableDeclaration;
      const declarator = declaration.declarations[0] as ESTree.VariableDeclarator;
      const pattern = (declarator.init as ESTree.ArrowFunctionExpression)
        .params[0] as ESTree.ParamPattern;
      return destructuredBindingsOf(pattern).map((binding) => ({
        name: binding.name.name,
        depth: binding.depth,
      }));
    });

    it("leaves the level the name was taken from unchanged", ({ bindings }) => {
      expect(bindings).toStrictEqual([{ name: "summary", depth: 1 }]);
    });
  });

  describe("a key taken out of a nested pattern", () => {
    const it = test.extend("bindings", () => {
      const declaration = parseSync("spec.ts", `const held = ({ report: { total } }) => total;`)
        .program.body[0] as ESTree.VariableDeclaration;
      const declarator = declaration.declarations[0] as ESTree.VariableDeclarator;
      const pattern = (declarator.init as ESTree.ArrowFunctionExpression)
        .params[0] as ESTree.ParamPattern;
      return destructuredBindingsOf(pattern).map((binding) => ({
        name: binding.name.name,
        depth: binding.depth,
      }));
    });

    it("sits one level under the key above it", ({ bindings }) => {
      expect(bindings).toStrictEqual([{ name: "total", depth: 2 }]);
    });
  });

  describe("a default value written on a pattern", () => {
    const it = test.extend("bindings", () => {
      const declaration = parseSync("spec.ts", `const held = ({ report = fallback }) => report;`)
        .program.body[0] as ESTree.VariableDeclaration;
      const declarator = declaration.declarations[0] as ESTree.VariableDeclarator;
      const pattern = (declarator.init as ESTree.ArrowFunctionExpression)
        .params[0] as ESTree.ParamPattern;
      return destructuredBindingsOf(pattern).map((binding) => ({
        name: binding.name.name,
        depth: binding.depth,
      }));
    });

    it("adds no level of its own", ({ bindings }) => {
      expect(bindings).toStrictEqual([{ name: "report", depth: 1 }]);
    });
  });

  describe("a parameter carrying a default value", () => {
    const it = test.extend("bindings", () => {
      const declaration = parseSync("spec.ts", `const held = ({ report } = empty) => report;`)
        .program.body[0] as ESTree.VariableDeclaration;
      const declarator = declaration.declarations[0] as ESTree.VariableDeclarator;
      const pattern = (declarator.init as ESTree.ArrowFunctionExpression)
        .params[0] as ESTree.ParamPattern;
      return destructuredBindingsOf(pattern).map((binding) => ({
        name: binding.name.name,
        depth: binding.depth,
      }));
    });

    it("is read through to the pattern it holds", ({ bindings }) => {
      expect(bindings).toStrictEqual([{ name: "report", depth: 1 }]);
    });
  });

  describe("the rest of an object pattern", () => {
    const it = test.extend("bindings", () => {
      const declaration = parseSync("spec.ts", `const held = ({ report, ...rest }) => rest;`)
        .program.body[0] as ESTree.VariableDeclaration;
      const declarator = declaration.declarations[0] as ESTree.VariableDeclarator;
      const pattern = (declarator.init as ESTree.ArrowFunctionExpression)
        .params[0] as ESTree.ParamPattern;
      return destructuredBindingsOf(pattern).map((binding) => ({
        name: binding.name.name,
        depth: binding.depth,
      }));
    });

    it("names what is left of the same value", ({ bindings }) => {
      expect(bindings).toStrictEqual([
        { name: "report", depth: 1 },
        { name: "rest", depth: 0 },
      ]);
    });
  });

  describe("an element taken out of an array pattern", () => {
    const it = test.extend("bindings", () => {
      const declaration = parseSync("spec.ts", `const held = ({ rows: [first, second] }) => first;`)
        .program.body[0] as ESTree.VariableDeclaration;
      const declarator = declaration.declarations[0] as ESTree.VariableDeclarator;
      const pattern = (declarator.init as ESTree.ArrowFunctionExpression)
        .params[0] as ESTree.ParamPattern;
      return destructuredBindingsOf(pattern).map((binding) => ({
        name: binding.name.name,
        depth: binding.depth,
      }));
    });

    it("sits one level under the list", ({ bindings }) => {
      expect(bindings).toStrictEqual([
        { name: "first", depth: 2 },
        { name: "second", depth: 2 },
      ]);
    });
  });

  describe("a hole in an array pattern", () => {
    const it = test.extend("bindings", () => {
      const declaration = parseSync("spec.ts", `const held = ([, second]) => second;`).program
        .body[0] as ESTree.VariableDeclaration;
      const declarator = declaration.declarations[0] as ESTree.VariableDeclarator;
      const pattern = (declarator.init as ESTree.ArrowFunctionExpression)
        .params[0] as ESTree.ParamPattern;
      return destructuredBindingsOf(pattern).map((binding) => ({
        name: binding.name.name,
        depth: binding.depth,
      }));
    });

    it("names nothing", ({ bindings }) => {
      expect(bindings).toStrictEqual([{ name: "second", depth: 1 }]);
    });
  });

  describe("the rest of an array pattern", () => {
    const it = test.extend("bindings", () => {
      const declaration = parseSync("spec.ts", `const held = ([first, ...rest]) => rest;`).program
        .body[0] as ESTree.VariableDeclaration;
      const declarator = declaration.declarations[0] as ESTree.VariableDeclarator;
      const pattern = (declarator.init as ESTree.ArrowFunctionExpression)
        .params[0] as ESTree.ParamPattern;
      return destructuredBindingsOf(pattern).map((binding) => ({
        name: binding.name.name,
        depth: binding.depth,
      }));
    });

    it("names what is left of the same list", ({ bindings }) => {
      expect(bindings).toStrictEqual([
        { name: "first", depth: 1 },
        { name: "rest", depth: 0 },
      ]);
    });
  });

  describe("a rest parameter", () => {
    const it = test.extend("bindings", () => {
      const declaration = parseSync("spec.ts", `const held = (...handed) => handed;`).program
        .body[0] as ESTree.VariableDeclaration;
      const declarator = declaration.declarations[0] as ESTree.VariableDeclarator;
      const pattern = (declarator.init as ESTree.ArrowFunctionExpression)
        .params[0] as ESTree.ParamPattern;
      return destructuredBindingsOf(pattern).map((binding) => ({
        name: binding.name.name,
        depth: binding.depth,
      }));
    });

    it("names what is left of the argument list", ({ bindings }) => {
      expect(bindings).toStrictEqual([{ name: "handed", depth: 0 }]);
    });
  });

  describe("a declared pattern", () => {
    const it = test.extend("bindings", () => {
      const declaration = parseSync("spec.ts", `const { report: { total } } = context;`).program
        .body[0] as ESTree.VariableDeclaration;
      const pattern = (declaration.declarations[0] as ESTree.VariableDeclarator).id;
      return destructuredBindingsOf(pattern).map((binding) => ({
        name: binding.name.name,
        depth: binding.depth,
      }));
    });

    it("is read the same way as a parameter pattern", ({ bindings }) => {
      expect(bindings).toStrictEqual([{ name: "total", depth: 2 }]);
    });
  });

  describe("a parameter property", () => {
    const it = test.extend("bindings", () => {
      const declared = parseSync("spec.ts", "class Held { constructor(readonly seen: number) {} }")
        .program.body[0] as ESTree.Class;
      const member = declared.body.body[0] as ESTree.MethodDefinition;
      const pattern = member.value.params[0] as ESTree.ParamPattern;
      return destructuredBindingsOf(pattern).map((binding) => ({
        name: binding.name.name,
        depth: binding.depth,
      }));
    });

    it("declares a field rather than a destructured binding", ({ bindings }) => {
      expect(bindings).toStrictEqual([]);
    });
  });
});
