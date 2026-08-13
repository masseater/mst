import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { staticCalleeName, staticMemberName, staticPropertyName } from "./static-names.ts";

import type { ESTree } from "@oxlint/plugins";

describe("staticMemberName", () => {
  describe("a member written with a dot", () => {
    const it = test.extend("spelledName", () => {
      const written = parseSync("spec.ts", "it.skip").program.body[0] as ESTree.ExpressionStatement;
      return staticMemberName(written.expression as ESTree.MemberExpression);
    });

    it("spells its name", ({ spelledName }) => {
      expect(spelledName).toBe("skip");
    });
  });

  describe("a member written as a string subscript", () => {
    const it = test.extend("spelledName", () => {
      const written = parseSync("spec.ts", 'it["skip"]').program
        .body[0] as ESTree.ExpressionStatement;
      return staticMemberName(written.expression as ESTree.MemberExpression);
    });

    it("spells the same name", ({ spelledName }) => {
      expect(spelledName).toBe("skip");
    });
  });

  describe("a member written as a template subscript without a substitution", () => {
    const it = test.extend("spelledName", () => {
      const written = parseSync("spec.ts", "it[`skip`]").program
        .body[0] as ESTree.ExpressionStatement;
      return staticMemberName(written.expression as ESTree.MemberExpression);
    });

    it("spells the same name", ({ spelledName }) => {
      expect(spelledName).toBe("skip");
    });
  });

  describe("a member chosen through a binding", () => {
    const it = test.extend("spelledName", () => {
      const written = parseSync("spec.ts", "it[modifier]").program
        .body[0] as ESTree.ExpressionStatement;
      return staticMemberName(written.expression as ESTree.MemberExpression);
    });

    it("spells no name the source can be read for", ({ spelledName }) => {
      expect(spelledName).toBe(null);
    });
  });

  describe("a member chosen through a template with a substitution", () => {
    const it = test.extend("spelledName", () => {
      const written = parseSync("spec.ts", "it[`ski${tail}`]").program
        .body[0] as ESTree.ExpressionStatement;
      return staticMemberName(written.expression as ESTree.MemberExpression);
    });

    it("spells no readable name", ({ spelledName }) => {
      expect(spelledName).toBe(null);
    });
  });

  describe("a member subscripted by a number", () => {
    const it = test.extend("spelledName", () => {
      const written = parseSync("spec.ts", "rows[0]").program.body[0] as ESTree.ExpressionStatement;
      return staticMemberName(written.expression as ESTree.MemberExpression);
    });

    it("spells no name this reading can use", ({ spelledName }) => {
      expect(spelledName).toBe(null);
    });
  });

  describe("a private field spelled like a public member", () => {
    const it = test.extend("spelledName", () => {
      const declared = parseSync(
        "spec.ts",
        "class Suite { #skip = 1; read() { return this.#skip; } }",
      ).program.body[0] as ESTree.Class;
      const [, method] = declared.body.body;
      const body = (method as ESTree.MethodDefinition).value.body as ESTree.FunctionBody;
      const [returned] = body.body;
      const read = (returned as ESTree.ReturnStatement).argument as ESTree.MemberExpression;
      return staticMemberName(read);
    });

    it("stays distinct from a public member of the same spelling", ({ spelledName }) => {
      expect(spelledName).toBe(null);
    });
  });
});

describe("staticPropertyName", () => {
  describe("a shorthand property", () => {
    const it = test.extend("spelledName", () => {
      const declared = parseSync("spec.ts", "const written = { subject };").program
        .body[0] as ESTree.VariableDeclaration;
      const declarator = declared.declarations[0] as ESTree.VariableDeclarator;
      const object = declarator.init as ESTree.ObjectExpression;
      return staticPropertyName(object.properties[0] as ESTree.ObjectProperty);
    });

    it("spells the name it binds", ({ spelledName }) => {
      expect(spelledName).toBe("subject");
    });
  });

  describe("a property key written as a string", () => {
    const it = test.extend("spelledName", () => {
      const declared = parseSync("spec.ts", 'const written = { "subject": 1 };').program
        .body[0] as ESTree.VariableDeclaration;
      const declarator = declared.declarations[0] as ESTree.VariableDeclarator;
      const object = declarator.init as ESTree.ObjectExpression;
      return staticPropertyName(object.properties[0] as ESTree.ObjectProperty);
    });

    it("spells that name", ({ spelledName }) => {
      expect(spelledName).toBe("subject");
    });
  });

  describe("a property key written as a template without a substitution", () => {
    const it = test.extend("spelledName", () => {
      const declared = parseSync("spec.ts", "const written = { [`subject`]: 1 };").program
        .body[0] as ESTree.VariableDeclaration;
      const declarator = declared.declarations[0] as ESTree.VariableDeclarator;
      const object = declarator.init as ESTree.ObjectExpression;
      return staticPropertyName(object.properties[0] as ESTree.ObjectProperty);
    });

    it("spells that name", ({ spelledName }) => {
      expect(spelledName).toBe("subject");
    });
  });

  describe("a property key computed from a binding", () => {
    const it = test.extend("spelledName", () => {
      const declared = parseSync("spec.ts", "const written = { [chosen]: 1 };").program
        .body[0] as ESTree.VariableDeclaration;
      const declarator = declared.declarations[0] as ESTree.VariableDeclarator;
      const object = declarator.init as ESTree.ObjectExpression;
      return staticPropertyName(object.properties[0] as ESTree.ObjectProperty);
    });

    it("spells no readable name", ({ spelledName }) => {
      expect(spelledName).toBe(null);
    });
  });

  describe("a property key written as a number", () => {
    const it = test.extend("spelledName", () => {
      const declared = parseSync("spec.ts", "const written = { 1: 'first' };").program
        .body[0] as ESTree.VariableDeclaration;
      const declarator = declared.declarations[0] as ESTree.VariableDeclarator;
      const object = declarator.init as ESTree.ObjectExpression;
      return staticPropertyName(object.properties[0] as ESTree.ObjectProperty);
    });

    it("spells no name this reading can use", ({ spelledName }) => {
      expect(spelledName).toBe(null);
    });
  });
});

describe("staticCalleeName", () => {
  describe("a call on a bare binding", () => {
    const it = test.extend("spelledName", () => {
      const written = parseSync("spec.ts", "scopeHandlers(run)").program
        .body[0] as ESTree.ExpressionStatement;
      return staticCalleeName(written.expression as ESTree.CallExpression);
    });

    it("spells the name of that binding", ({ spelledName }) => {
      expect(spelledName).toBe("scopeHandlers");
    });
  });

  describe("a call on a member", () => {
    const it = test.extend("spelledName", () => {
      const written = parseSync("spec.ts", "server.boundary(run)").program
        .body[0] as ESTree.ExpressionStatement;
      return staticCalleeName(written.expression as ESTree.CallExpression);
    });

    it("spells the name of that member", ({ spelledName }) => {
      expect(spelledName).toBe("boundary");
    });
  });

  describe("a type assertion around the callee", () => {
    const it = test.extend("spelledName", () => {
      const written = parseSync("spec.ts", "(server.boundary as Scoping)(run)").program
        .body[0] as ESTree.ExpressionStatement;
      return staticCalleeName(written.expression as ESTree.CallExpression);
    });

    it("is stripped before the name is spelled", ({ spelledName }) => {
      expect(spelledName).toBe("boundary");
    });
  });

  describe("a call on a member chosen through a binding", () => {
    const it = test.extend("spelledName", () => {
      const written = parseSync("spec.ts", "server[chosen](run)").program
        .body[0] as ESTree.ExpressionStatement;
      return staticCalleeName(written.expression as ESTree.CallExpression);
    });

    it("spells no readable name", ({ spelledName }) => {
      expect(spelledName).toBe(null);
    });
  });

  describe("a call on an expression that is neither a binding nor a member", () => {
    const it = test.extend("spelledName", () => {
      const written = parseSync("spec.ts", "(() => run)()(run)").program
        .body[0] as ESTree.ExpressionStatement;
      return staticCalleeName(written.expression as ESTree.CallExpression);
    });

    it("spells no name", ({ spelledName }) => {
      expect(spelledName).toBe(null);
    });
  });
});
