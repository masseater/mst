import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { nodeTypeOf } from "../setup-modules/coupling-edges.ts";
import { chainFrom, fieldOf, innermostOf, kindAt, nodeVisitsIn, visitAt } from "./node-visits.ts";

import type { AstFields } from "../ast-node.ts";

const ELSEWHERE: AstFields = { type: "Program" };

describe("nodeVisitsIn", () => {
  describe("a source holding a name written in a type", () => {
    const it = test.extend("walkedKinds", () =>
      nodeVisitsIn(parseSync("held.ts", "const held: Cell = read();").program).map((visit) =>
        nodeTypeOf(visit.node),
      ));

    it("leaves the name written in the type out of the walk", ({ walkedKinds }) => {
      expect(walkedKinds).toStrictEqual([
        "Program",
        "VariableDeclaration",
        "VariableDeclarator",
        "Identifier",
        "CallExpression",
        "Identifier",
      ]);
    });
  });

  describe("a source holding a name written in a value", () => {
    const it = test.extend("walkedKinds", () =>
      nodeVisitsIn(parseSync("held.ts", "held;").program).map((visit) => nodeTypeOf(visit.node)));

    it("walks the name written in the value", ({ walkedKinds }) => {
      expect(walkedKinds).toStrictEqual(["Program", "ExpressionStatement", "Identifier"]);
    });
  });

  describe("a walked name", () => {
    const it = test.extend("ancestorKinds", () => {
      const found = nodeVisitsIn(parseSync("held.ts", "held;").program).find(
        (visit) => nodeTypeOf(visit.node) === "Identifier" && visit.node.name === "held",
      );
      if (found === undefined) throw new Error("no held is written on its own");
      return found.ancestors.map(nodeTypeOf);
    });

    it("carries the nodes it sits under", ({ ancestorKinds }) => {
      expect(ancestorKinds).toStrictEqual(["Program", "ExpressionStatement"]);
    });
  });
});

describe("fieldOf", () => {
  describe("a field asked of a walked node", () => {
    const it = test.extend("nameField", () => {
      const found = nodeVisitsIn(parseSync("held.ts", "held;").program).find(
        (visit) => nodeTypeOf(visit.node) === "Identifier" && visit.node.name === "held",
      );
      if (found === undefined) throw new Error("no held is written on its own");
      return fieldOf(found.node, "name");
    });

    it("reads as the value the node holds under that field", ({ nameField }) => {
      expect(nameField).toBe("held");
    });
  });

  describe("a field asked of something that is no node", () => {
    const it = test.extend("nameField", () => fieldOf("held", "name"));

    it("reads as nothing", ({ nameField }) => {
      expect(nameField).toBe(undefined);
    });
  });
});

describe("kindAt", () => {
  describe("a walked node", () => {
    const it = test.extend("heldNameKind", () => {
      const found = nodeVisitsIn(parseSync("held.ts", "held;").program).find(
        (visit) => nodeTypeOf(visit.node) === "Identifier" && visit.node.name === "held",
      );
      if (found === undefined) throw new Error("no held is written on its own");
      return kindAt(found.node);
    });

    it("reads as its own kind", ({ heldNameKind }) => {
      expect(heldNameKind).toBe("Identifier");
    });
  });

  describe("something that is no node", () => {
    const it = test.extend("nonNodeKind", () => kindAt(null));

    it("reads as no kind", ({ nonNodeKind }) => {
      expect(nonNodeKind).toBe("");
    });
  });
});

describe("chainFrom", () => {
  describe("a chain cut at a node the visit sits under", () => {
    const it = test.extend("chainKinds", () => {
      const found = nodeVisitsIn(parseSync("held.ts", "held;").program).find(
        (visit) => nodeTypeOf(visit.node) === "Identifier" && visit.node.name === "held",
      );
      if (found === undefined) throw new Error("no held is written on its own");
      const [boundary] = found.ancestors.slice(-1);
      if (boundary === undefined) throw new Error("held sits under nothing");
      return chainFrom(found, boundary).map(nodeTypeOf);
    });

    it("starts at that node", ({ chainKinds }) => {
      expect(chainKinds).toStrictEqual(["ExpressionStatement"]);
    });
  });

  describe("a chain cut at a node the visit does not sit under", () => {
    const it = test.extend("chainKinds", () => {
      const found = nodeVisitsIn(parseSync("held.ts", "held;").program).find(
        (visit) => nodeTypeOf(visit.node) === "Identifier" && visit.node.name === "held",
      );
      if (found === undefined) throw new Error("no held is written on its own");
      return chainFrom(found, ELSEWHERE).map(nodeTypeOf);
    });

    it("keeps every node", ({ chainKinds }) => {
      expect(chainKinds).toStrictEqual(["Program", "ExpressionStatement"]);
    });
  });
});

describe("visitAt", () => {
  describe("the visit at a node this one sits under", () => {
    const it = test.extend("ancestorKinds", () => {
      const found = nodeVisitsIn(parseSync("held.ts", "held;").program).find(
        (visit) => nodeTypeOf(visit.node) === "Identifier" && visit.node.name === "held",
      );
      if (found === undefined) throw new Error("no held is written on its own");
      const [boundary] = found.ancestors.slice(-1);
      if (boundary === undefined) throw new Error("held sits under nothing");
      return visitAt(found, boundary).ancestors.map(nodeTypeOf);
    });

    it("carries the nodes standing above that node", ({ ancestorKinds }) => {
      expect(ancestorKinds).toStrictEqual(["Program"]);
    });
  });
});

describe("innermostOf", () => {
  describe("a chain holding a node of a wanted kind", () => {
    const it = test.extend("innermostKind", () => {
      const found = nodeVisitsIn(parseSync("held.ts", "const walk = () => held;").program).find(
        (visit) => nodeTypeOf(visit.node) === "Identifier" && visit.node.name === "held",
      );
      if (found === undefined) throw new Error("no held stands as the body of a function");
      return nodeTypeOf(
        innermostOf(found.ancestors, new Set(["ArrowFunctionExpression"])) ?? ELSEWHERE,
      );
    });

    it("picks the nearest node of that kind", ({ innermostKind }) => {
      expect(innermostKind).toBe("ArrowFunctionExpression");
    });
  });

  describe("a chain holding no node of a wanted kind", () => {
    const it = test.extend("innermost", () => {
      const found = nodeVisitsIn(parseSync("held.ts", "held;").program).find(
        (visit) => nodeTypeOf(visit.node) === "Identifier" && visit.node.name === "held",
      );
      if (found === undefined) throw new Error("no held is written on its own");
      return innermostOf(found.ancestors, new Set(["ClassBody"]));
    });

    it("picks nothing", ({ innermost }) => {
      expect(innermost).toBe(null);
    });
  });
});
