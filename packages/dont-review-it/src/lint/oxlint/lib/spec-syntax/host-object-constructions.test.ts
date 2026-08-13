import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import {
  constructedHostTypeOf,
  hostObjectTypesFrom,
  runtimeModulesFrom,
} from "./host-object-constructions.ts";

import type { ESTree } from "@oxlint/plugins";

describe("constructedHostTypeOf", () => {
  describe("a construction of a name the runtime declares", () => {
    const it = test.extend("hostType", () => {
      const declared = parseSync("spec.ts", "const written = new Response('a');").program
        .body[0] as ESTree.Statement;
      const [declarator] = (declared as ESTree.VariableDeclaration).declarations;
      return constructedHostTypeOf(declarator?.init as ESTree.Expression, {
        named: (name) => (name === "Request" || name === "Response" ? name : null),
        qualified: (namespace, member) =>
          namespace === "undici" && (member === "Request" || member === "Response") ? member : null,
      });
    });

    it("is that host type", ({ hostType }) => {
      expect(hostType).toBe("Response");
    });
  });

  describe("a construction of the other name the runtime declares", () => {
    const it = test.extend("hostType", () => {
      const declared = parseSync("spec.ts", "const written = new Request('https://example.test/');")
        .program.body[0] as ESTree.Statement;
      const [declarator] = (declared as ESTree.VariableDeclaration).declarations;
      return constructedHostTypeOf(declarator?.init as ESTree.Expression, {
        named: (name) => (name === "Request" || name === "Response" ? name : null),
        qualified: (namespace, member) =>
          namespace === "undici" && (member === "Request" || member === "Response") ? member : null,
      });
    });

    it("is that host type too", ({ hostType }) => {
      expect(hostType).toBe("Request");
    });
  });

  describe("a construction of a name the caller declares", () => {
    const it = test.extend("hostType", () => {
      const declared = parseSync("spec.ts", "const written = new Response('a');").program
        .body[0] as ESTree.Statement;
      const [declarator] = (declared as ESTree.VariableDeclaration).declarations;
      return constructedHostTypeOf(declarator?.init as ESTree.Expression, {
        named: () => null,
        qualified: () => null,
      });
    });

    it("is not a host type", ({ hostType }) => {
      expect(hostType).toBe(null);
    });
  });

  describe("a construction of an unrelated name", () => {
    const it = test.extend("hostType", () => {
      const declared = parseSync("spec.ts", "const written = new Date(0);").program
        .body[0] as ESTree.Statement;
      const [declarator] = (declared as ESTree.VariableDeclaration).declarations;
      return constructedHostTypeOf(declarator?.init as ESTree.Expression, {
        named: (name) => (name === "Request" || name === "Response" ? name : null),
        qualified: (namespace, member) =>
          namespace === "undici" && (member === "Request" || member === "Response") ? member : null,
      });
    });

    it("is not a host type", ({ hostType }) => {
      expect(hostType).toBe(null);
    });
  });

  describe("a construction reached through a runtime namespace", () => {
    const it = test.extend("hostType", () => {
      const declared = parseSync("spec.ts", "const written = new undici.Response('a');").program
        .body[0] as ESTree.Statement;
      const [declarator] = (declared as ESTree.VariableDeclaration).declarations;
      return constructedHostTypeOf(declarator?.init as ESTree.Expression, {
        named: (name) => (name === "Request" || name === "Response" ? name : null),
        qualified: (namespace, member) =>
          namespace === "undici" && (member === "Request" || member === "Response") ? member : null,
      });
    });

    it("is that host type", ({ hostType }) => {
      expect(hostType).toBe("Response");
    });
  });

  describe("a construction reached through an unrelated namespace", () => {
    const it = test.extend("hostType", () => {
      const declared = parseSync("spec.ts", "const written = new helpers.Response('a');").program
        .body[0] as ESTree.Statement;
      const [declarator] = (declared as ESTree.VariableDeclaration).declarations;
      return constructedHostTypeOf(declarator?.init as ESTree.Expression, {
        named: (name) => (name === "Request" || name === "Response" ? name : null),
        qualified: (namespace, member) =>
          namespace === "undici" && (member === "Request" || member === "Response") ? member : null,
      });
    });

    it("is not a host type", ({ hostType }) => {
      expect(hostType).toBe(null);
    });
  });

  describe("a constructor read off a name at run time", () => {
    const it = test.extend("hostType", () => {
      const declared = parseSync("spec.ts", "const written = new globalThis[name]('a');").program
        .body[0] as ESTree.Statement;
      const [declarator] = (declared as ESTree.VariableDeclaration).declarations;
      return constructedHostTypeOf(declarator?.init as ESTree.Expression, {
        named: (name) => (name === "Request" || name === "Response" ? name : null),
        qualified: (namespace, member) =>
          namespace === "undici" && (member === "Request" || member === "Response") ? member : null,
      });
    });

    it("is not a host type", ({ hostType }) => {
      expect(hostType).toBe(null);
    });
  });

  describe("a constructor handed back by a call", () => {
    const it = test.extend("hostType", () => {
      const declared = parseSync("spec.ts", "const written = new (build())('a');").program
        .body[0] as ESTree.Statement;
      const [declarator] = (declared as ESTree.VariableDeclaration).declarations;
      return constructedHostTypeOf(declarator?.init as ESTree.Expression, {
        named: (name) => (name === "Request" || name === "Response" ? name : null),
        qualified: (namespace, member) =>
          namespace === "undici" && (member === "Request" || member === "Response") ? member : null,
      });
    });

    it("is not a host type", ({ hostType }) => {
      expect(hostType).toBe(null);
    });
  });

  describe("the json factory", () => {
    const it = test.extend("hostType", () => {
      const declared = parseSync("spec.ts", "const written = Response.json({ id: 1 });").program
        .body[0] as ESTree.Statement;
      const [declarator] = (declared as ESTree.VariableDeclaration).declarations;
      return constructedHostTypeOf(declarator?.init as ESTree.Expression, {
        named: (name) => (name === "Request" || name === "Response" ? name : null),
        qualified: (namespace, member) =>
          namespace === "undici" && (member === "Request" || member === "Response") ? member : null,
      });
    });

    it("hands back the same host type a construction does", ({ hostType }) => {
      expect(hostType).toBe("Response");
    });
  });

  describe("the redirect factory", () => {
    const it = test.extend("hostType", () => {
      const declared = parseSync("spec.ts", "const written = Response.redirect('/next');").program
        .body[0] as ESTree.Statement;
      const [declarator] = (declared as ESTree.VariableDeclaration).declarations;
      return constructedHostTypeOf(declarator?.init as ESTree.Expression, {
        named: (name) => (name === "Request" || name === "Response" ? name : null),
        qualified: (namespace, member) =>
          namespace === "undici" && (member === "Request" || member === "Response") ? member : null,
      });
    });

    it("hands back the same host type a construction does", ({ hostType }) => {
      expect(hostType).toBe("Response");
    });
  });

  describe("the error factory", () => {
    const it = test.extend("hostType", () => {
      const declared = parseSync("spec.ts", "const written = Response.error();").program
        .body[0] as ESTree.Statement;
      const [declarator] = (declared as ESTree.VariableDeclaration).declarations;
      return constructedHostTypeOf(declarator?.init as ESTree.Expression, {
        named: (name) => (name === "Request" || name === "Response" ? name : null),
        qualified: (namespace, member) =>
          namespace === "undici" && (member === "Request" || member === "Response") ? member : null,
      });
    });

    it("hands back the same host type a construction does", ({ hostType }) => {
      expect(hostType).toBe("Response");
    });
  });

  describe("a factory reached through a runtime namespace", () => {
    const it = test.extend("hostType", () => {
      const declared = parseSync("spec.ts", "const written = undici.Response.json({ id: 1 });")
        .program.body[0] as ESTree.Statement;
      const [declarator] = (declared as ESTree.VariableDeclaration).declarations;
      return constructedHostTypeOf(declarator?.init as ESTree.Expression, {
        named: (name) => (name === "Request" || name === "Response" ? name : null),
        qualified: (namespace, member) =>
          namespace === "undici" && (member === "Request" || member === "Response") ? member : null,
      });
    });

    it("hands back the same host type", ({ hostType }) => {
      expect(hostType).toBe("Response");
    });
  });

  describe("a method that is not one of the standard factories", () => {
    const it = test.extend("hostType", () => {
      const declared = parseSync("spec.ts", "const written = Response.clone();").program
        .body[0] as ESTree.Statement;
      const [declarator] = (declared as ESTree.VariableDeclaration).declarations;
      return constructedHostTypeOf(declarator?.init as ESTree.Expression, {
        named: (name) => (name === "Request" || name === "Response" ? name : null),
        qualified: (namespace, member) =>
          namespace === "undici" && (member === "Request" || member === "Response") ? member : null,
      });
    });

    it("is not a construction", ({ hostType }) => {
      expect(hostType).toBe(null);
    });
  });

  describe("a host type the runtime gives no factory to", () => {
    const it = test.extend("hostType", () => {
      const declared = parseSync("spec.ts", "const written = Request.json({ id: 1 });").program
        .body[0] as ESTree.Statement;
      const [declarator] = (declared as ESTree.VariableDeclaration).declarations;
      return constructedHostTypeOf(declarator?.init as ESTree.Expression, {
        named: (name) => (name === "Request" || name === "Response" ? name : null),
        qualified: (namespace, member) =>
          namespace === "undici" && (member === "Request" || member === "Response") ? member : null,
      });
    });

    it("has no factory call to read", ({ hostType }) => {
      expect(hostType).toBe(null);
    });
  });

  describe("a method named at run time", () => {
    const it = test.extend("hostType", () => {
      const declared = parseSync("spec.ts", "const written = Response[member]();").program
        .body[0] as ESTree.Statement;
      const [declarator] = (declared as ESTree.VariableDeclaration).declarations;
      return constructedHostTypeOf(declarator?.init as ESTree.Expression, {
        named: (name) => (name === "Request" || name === "Response" ? name : null),
        qualified: (namespace, member) =>
          namespace === "undici" && (member === "Request" || member === "Response") ? member : null,
      });
    });

    it("is not a factory call", ({ hostType }) => {
      expect(hostType).toBe(null);
    });
  });

  describe("a factory call on the value a call handed back", () => {
    const it = test.extend("hostType", () => {
      const declared = parseSync("spec.ts", "const written = build().json({ id: 1 });").program
        .body[0] as ESTree.Statement;
      const [declarator] = (declared as ESTree.VariableDeclaration).declarations;
      return constructedHostTypeOf(declarator?.init as ESTree.Expression, {
        named: (name) => (name === "Request" || name === "Response" ? name : null),
        qualified: (namespace, member) =>
          namespace === "undici" && (member === "Request" || member === "Response") ? member : null,
      });
    });

    it("is not a factory call", ({ hostType }) => {
      expect(hostType).toBe(null);
    });
  });

  describe("a bare call on a name", () => {
    const it = test.extend("hostType", () => {
      const declared = parseSync("spec.ts", "const written = read();").program
        .body[0] as ESTree.Statement;
      const [declarator] = (declared as ESTree.VariableDeclaration).declarations;
      return constructedHostTypeOf(declarator?.init as ESTree.Expression, {
        named: (name) => (name === "Request" || name === "Response" ? name : null),
        qualified: (namespace, member) =>
          namespace === "undici" && (member === "Request" || member === "Response") ? member : null,
      });
    });

    it("is not a factory call", ({ hostType }) => {
      expect(hostType).toBe(null);
    });
  });

  describe("a bare name", () => {
    const it = test.extend("hostType", () => {
      const declared = parseSync("spec.ts", "const written = subject;").program
        .body[0] as ESTree.Statement;
      const [declarator] = (declared as ESTree.VariableDeclaration).declarations;
      return constructedHostTypeOf(declarator?.init as ESTree.Expression, {
        named: (name) => (name === "Request" || name === "Response" ? name : null),
        qualified: (namespace, member) =>
          namespace === "undici" && (member === "Request" || member === "Response") ? member : null,
      });
    });

    it("is neither a construction nor a factory call", ({ hostType }) => {
      expect(hostType).toBe(null);
    });
  });

  describe("an object written out in place", () => {
    const it = test.extend("hostType", () => {
      const declared = parseSync("spec.ts", "const written = { status: 200 };").program
        .body[0] as ESTree.Statement;
      const [declarator] = (declared as ESTree.VariableDeclaration).declarations;
      return constructedHostTypeOf(declarator?.init as ESTree.Expression, {
        named: (name) => (name === "Request" || name === "Response" ? name : null),
        qualified: (namespace, member) =>
          namespace === "undici" && (member === "Request" || member === "Response") ? member : null,
      });
    });

    it("is neither a construction nor a factory call", ({ hostType }) => {
      expect(hostType).toBe(null);
    });
  });
});

describe("hostObjectTypesFrom", () => {
  describe("the roster", () => {
    const it = test.extend("hostTypes", () => hostObjectTypesFrom([]));

    it("stands until the repository replaces it", ({ hostTypes }) => {
      expect(hostTypes).toStrictEqual(new Set(["Request", "Response"]));
    });
  });

  describe("a rule run with a severity alone", () => {
    const it = test.extend("hostTypes", () => hostObjectTypesFrom(["error"]));

    it("keeps the roster the rule carries", ({ hostTypes }) => {
      expect(hostTypes).toStrictEqual(new Set(["Request", "Response"]));
    });
  });

  describe("a roster written as a single spelling rather than a list", () => {
    const it = test.extend("hostTypes", () =>
      hostObjectTypesFrom([{ hostObjectTypes: "Response" }]));

    it("keeps the carried roster", ({ hostTypes }) => {
      expect(hostTypes).toStrictEqual(new Set(["Request", "Response"]));
    });
  });

  describe("an empty roster", () => {
    const it = test.extend("hostTypes", () => hostObjectTypesFrom([{ hostObjectTypes: [] }]));

    it("keeps the carried roster", ({ hostTypes }) => {
      expect(hostTypes).toStrictEqual(new Set(["Request", "Response"]));
    });
  });

  describe("a roster holding nothing that reads as a spelling", () => {
    const it = test.extend("hostTypes", () => hostObjectTypesFrom([{ hostObjectTypes: [1] }]));

    it("keeps the carried roster", ({ hostTypes }) => {
      expect(hostTypes).toStrictEqual(new Set(["Request", "Response"]));
    });
  });

  describe("a repository that names its own roster", () => {
    const it = test.extend("hostTypes", () =>
      hostObjectTypesFrom([{ hostObjectTypes: ["Headers"] }]));

    it("is taken at its word", ({ hostTypes }) => {
      expect(hostTypes).toStrictEqual(new Set(["Headers"]));
    });
  });
});

describe("runtimeModulesFrom", () => {
  describe("the runtime module list", () => {
    const it = test.extend("runtimeModules", () => runtimeModulesFrom([]));

    it("stands until the repository replaces it", ({ runtimeModules }) => {
      expect(runtimeModules).toStrictEqual(new Set(["undici"]));
    });
  });

  describe("a repository that names its own runtime modules", () => {
    const it = test.extend("runtimeModules", () =>
      runtimeModulesFrom([{ runtimeModules: ["@internal/http"] }]));

    it("is taken at its word", ({ runtimeModules }) => {
      expect(runtimeModules).toStrictEqual(new Set(["@internal/http"]));
    });
  });
});
