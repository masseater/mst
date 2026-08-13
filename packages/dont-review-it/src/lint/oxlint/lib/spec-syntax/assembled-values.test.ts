import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { assembledShapeOf, isEmptyContainer, WRITTEN_OUT_SHAPE } from "./assembled-values.ts";

import type { ESTree } from "@oxlint/plugins";

describe("assembledShapeOf", () => {
  describe("a string spelled out in the source", () => {
    const it = test.extend("assembledShape", () => {
      const declared = parseSync("spec.ts", 'const written = "a";').program
        .body[0] as ESTree.VariableDeclaration;
      const declarator = declared.declarations[0] as ESTree.VariableDeclarator;
      return assembledShapeOf(declarator.init as ESTree.Expression);
    });

    it("is a value the spec wrote", ({ assembledShape }) => {
      expect(assembledShape).toBe(WRITTEN_OUT_SHAPE);
    });
  });

  describe("a template without substitutions", () => {
    const it = test.extend("assembledShape", () => {
      const declared = parseSync("spec.ts", "const written = `a`;").program
        .body[0] as ESTree.VariableDeclaration;
      const declarator = declared.declarations[0] as ESTree.VariableDeclarator;
      return assembledShapeOf(declarator.init as ESTree.Expression);
    });

    it("is a value the spec wrote", ({ assembledShape }) => {
      expect(assembledShape).toBe(WRITTEN_OUT_SHAPE);
    });
  });

  describe("a template carrying a substitution", () => {
    const it = test.extend("assembledShape", () => {
      const declared = parseSync("spec.ts", "const written = `id ${report.id}`;").program
        .body[0] as ESTree.VariableDeclaration;
      const declarator = declared.declarations[0] as ESTree.VariableDeclarator;
      return assembledShapeOf(declarator.init as ESTree.Expression);
    });

    it("is not a value this reading can spell", ({ assembledShape }) => {
      expect(assembledShape).toBe(null);
    });
  });

  describe("the name of the absent value", () => {
    const it = test.extend("assembledShape", () => {
      const declared = parseSync("spec.ts", "const written = undefined;").program
        .body[0] as ESTree.VariableDeclaration;
      const declarator = declared.declarations[0] as ESTree.VariableDeclarator;
      return assembledShapeOf(declarator.init as ESTree.Expression);
    });

    it("is a value the spec wrote", ({ assembledShape }) => {
      expect(assembledShape).toBe(WRITTEN_OUT_SHAPE);
    });
  });

  describe("a name other than the absent value", () => {
    const it = test.extend("assembledShape", () => {
      const declared = parseSync("spec.ts", "const written = report;").program
        .body[0] as ESTree.VariableDeclaration;
      const declarator = declared.declarations[0] as ESTree.VariableDeclarator;
      return assembledShapeOf(declarator.init as ESTree.Expression);
    });

    it("is not a value this reading can spell", ({ assembledShape }) => {
      expect(assembledShape).toBe(null);
    });
  });

  describe("a discarded expression", () => {
    const it = test.extend("assembledShape", () => {
      const declared = parseSync("spec.ts", "const written = void 0;").program
        .body[0] as ESTree.VariableDeclaration;
      const declarator = declared.declarations[0] as ESTree.VariableDeclarator;
      return assembledShapeOf(declarator.init as ESTree.Expression);
    });

    it("spells the absent value out", ({ assembledShape }) => {
      expect(assembledShape).toBe(WRITTEN_OUT_SHAPE);
    });
  });

  describe("a signed number", () => {
    const it = test.extend("assembledShape", () => {
      const declared = parseSync("spec.ts", "const written = -1;").program
        .body[0] as ESTree.VariableDeclaration;
      const declarator = declared.declarations[0] as ESTree.VariableDeclarator;
      return assembledShapeOf(declarator.init as ESTree.Expression);
    });

    it("is still a number spelled out in the source", ({ assembledShape }) => {
      expect(assembledShape).toBe(WRITTEN_OUT_SHAPE);
    });
  });

  describe("a sign in front of a name", () => {
    const it = test.extend("assembledShape", () => {
      const declared = parseSync("spec.ts", "const written = -count;").program
        .body[0] as ESTree.VariableDeclaration;
      const declarator = declared.declarations[0] as ESTree.VariableDeclarator;
      return assembledShapeOf(declarator.init as ESTree.Expression);
    });

    it("spells nothing out", ({ assembledShape }) => {
      expect(assembledShape).toBe(null);
    });
  });

  describe("an operator standing in front of a name", () => {
    const it = test.extend("assembledShape", () => {
      const declared = parseSync("spec.ts", "const written = !flag;").program
        .body[0] as ESTree.VariableDeclaration;
      const declarator = declared.declarations[0] as ESTree.VariableDeclarator;
      return assembledShapeOf(declarator.init as ESTree.Expression);
    });

    it("spells nothing out", ({ assembledShape }) => {
      expect(assembledShape).toBe(null);
    });
  });

  describe("an operator standing in front of a spelled-out value", () => {
    const it = test.extend("assembledShape", () => {
      const declared = parseSync("spec.ts", "const written = !true;").program
        .body[0] as ESTree.VariableDeclaration;
      const declarator = declared.declarations[0] as ESTree.VariableDeclarator;
      return assembledShapeOf(declarator.init as ESTree.Expression);
    });

    it("spells one out", ({ assembledShape }) => {
      expect(assembledShape).toBe(WRITTEN_OUT_SHAPE);
    });
  });

  describe("an object literal", () => {
    const it = test.extend("assembledShape", () => {
      const declared = parseSync("spec.ts", 'const written = { id: "a" };').program
        .body[0] as ESTree.VariableDeclaration;
      const declarator = declared.declarations[0] as ESTree.VariableDeclarator;
      return assembledShapeOf(declarator.init as ESTree.Expression);
    });

    it("is a shape the spec assembled", ({ assembledShape }) => {
      expect(assembledShape).toBe("an object literal");
    });
  });

  describe("an array literal", () => {
    const it = test.extend("assembledShape", () => {
      const declared = parseSync("spec.ts", 'const written = ["a"];').program
        .body[0] as ESTree.VariableDeclaration;
      const declarator = declared.declarations[0] as ESTree.VariableDeclarator;
      return assembledShapeOf(declarator.init as ESTree.Expression);
    });

    it("is a shape the spec assembled", ({ assembledShape }) => {
      expect(assembledShape).toBe("an array literal");
    });
  });

  describe("a constructor call", () => {
    const it = test.extend("assembledShape", () => {
      const declared = parseSync("spec.ts", "const written = new Report(input);").program
        .body[0] as ESTree.VariableDeclaration;
      const declarator = declared.declarations[0] as ESTree.VariableDeclarator;
      return assembledShapeOf(declarator.init as ESTree.Expression);
    });

    it("is a shape the spec assembled", ({ assembledShape }) => {
      expect(assembledShape).toBe("a value a constructor built here");
    });
  });

  describe("a type assertion around an assembled shape", () => {
    const it = test.extend("assembledShape", () => {
      const declared = parseSync("spec.ts", 'const written = ({ id: "a" }) as Report;').program
        .body[0] as ESTree.VariableDeclaration;
      const declarator = declared.declarations[0] as ESTree.VariableDeclarator;
      return assembledShapeOf(declarator.init as ESTree.Expression);
    });

    it("is stripped before the shape is read", ({ assembledShape }) => {
      expect(assembledShape).toBe("an object literal");
    });
  });

  describe("a call", () => {
    const it = test.extend("assembledShape", () => {
      const declared = parseSync("spec.ts", "const written = summarise(input);").program
        .body[0] as ESTree.VariableDeclaration;
      const declarator = declared.declarations[0] as ESTree.VariableDeclarator;
      return assembledShapeOf(declarator.init as ESTree.Expression);
    });

    it("is not a shape the spec assembled", ({ assembledShape }) => {
      expect(assembledShape).toBe(null);
    });
  });
});

describe("isEmptyContainer", () => {
  describe("an array literal holding nothing", () => {
    const it = test.extend("containerEmptiness", () => {
      const declared = parseSync("spec.ts", "const written = [];").program
        .body[0] as ESTree.VariableDeclaration;
      const declarator = declared.declarations[0] as ESTree.VariableDeclarator;
      return isEmptyContainer(declarator.init as ESTree.Expression);
    });

    it("is an empty container", ({ containerEmptiness }) => {
      expect(containerEmptiness).toBe(true);
    });
  });

  describe("an object literal holding nothing", () => {
    const it = test.extend("containerEmptiness", () => {
      const declared = parseSync("spec.ts", "const written = ({});").program
        .body[0] as ESTree.VariableDeclaration;
      const declarator = declared.declarations[0] as ESTree.VariableDeclarator;
      return isEmptyContainer(declarator.init as ESTree.Expression);
    });

    it("is an empty container", ({ containerEmptiness }) => {
      expect(containerEmptiness).toBe(true);
    });
  });

  describe("an array literal holding an element", () => {
    const it = test.extend("containerEmptiness", () => {
      const declared = parseSync("spec.ts", "const written = [seed];").program
        .body[0] as ESTree.VariableDeclaration;
      const declarator = declared.declarations[0] as ESTree.VariableDeclarator;
      return isEmptyContainer(declarator.init as ESTree.Expression);
    });

    it("is not an empty container", ({ containerEmptiness }) => {
      expect(containerEmptiness).toBe(false);
    });
  });

  describe("an object literal holding a property", () => {
    const it = test.extend("containerEmptiness", () => {
      const declared = parseSync("spec.ts", 'const written = ({ id: "a" });').program
        .body[0] as ESTree.VariableDeclaration;
      const declarator = declared.declarations[0] as ESTree.VariableDeclarator;
      return isEmptyContainer(declarator.init as ESTree.Expression);
    });

    it("is not an empty container", ({ containerEmptiness }) => {
      expect(containerEmptiness).toBe(false);
    });
  });

  describe("a call", () => {
    const it = test.extend("containerEmptiness", () => {
      const declared = parseSync("spec.ts", "const written = summarise(input);").program
        .body[0] as ESTree.VariableDeclaration;
      const declarator = declared.declarations[0] as ESTree.VariableDeclarator;
      return isEmptyContainer(declarator.init as ESTree.Expression);
    });

    it("is not a container this reading can see into", ({ containerEmptiness }) => {
      expect(containerEmptiness).toBe(false);
    });
  });
});
