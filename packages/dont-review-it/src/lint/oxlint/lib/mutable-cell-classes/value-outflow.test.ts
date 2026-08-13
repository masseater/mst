import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { nodeTypeOf } from "../setup-modules/coupling-edges.ts";
import { nodeVisitsIn } from "./node-visits.ts";
import { flowsOutOf } from "./value-outflow.ts";

describe("flowsOutOf", () => {
  describe("a name standing as a parameter of a function", () => {
    const it = test.extend("outflow", () => {
      const found = nodeVisitsIn(
        parseSync("held.ts", "const bump = (held: number) => 1;").program,
      ).find((visit) => nodeTypeOf(visit.node) === "Identifier" && visit.node.name === "held");
      if (found === undefined) throw new Error("no held stands as a parameter of a function");
      return flowsOutOf(found.node, found.ancestors);
    });

    it("stays where it is written", ({ outflow }) => {
      expect(outflow).toBe(false);
    });
  });

  describe("a name standing as the body of a function", () => {
    const it = test.extend("outflow", () => {
      const found = nodeVisitsIn(parseSync("held.ts", "const bump = () => held;").program).find(
        (visit) => nodeTypeOf(visit.node) === "Identifier" && visit.node.name === "held",
      );
      if (found === undefined) throw new Error("no held stands as the body of a function");
      return flowsOutOf(found.node, found.ancestors);
    });

    it("is handed out of it", ({ outflow }) => {
      expect(outflow).toBe(true);
    });
  });

  describe("a name standing on the left of an assignment", () => {
    const it = test.extend("outflow", () => {
      const found = nodeVisitsIn(parseSync("held.ts", "held = 1;").program).find(
        (visit) => nodeTypeOf(visit.node) === "Identifier" && visit.node.name === "held",
      );
      if (found === undefined) throw new Error("no held stands on the left of an assignment");
      return flowsOutOf(found.node, found.ancestors);
    });

    it("stays where it is written", ({ outflow }) => {
      expect(outflow).toBe(false);
    });
  });

  describe("a name standing on the right of an assignment", () => {
    const it = test.extend("outflow", () => {
      const found = nodeVisitsIn(parseSync("held.ts", "sink.at = held;").program).find(
        (visit) => nodeTypeOf(visit.node) === "Identifier" && visit.node.name === "held",
      );
      if (found === undefined) throw new Error("no held stands on the right of an assignment");
      return flowsOutOf(found.node, found.ancestors);
    });

    it("is handed out", ({ outflow }) => {
      expect(outflow).toBe(true);
    });
  });

  describe("a name written inside an object bound to a name", () => {
    const it = test.extend("outflow", () => {
      const found = nodeVisitsIn(parseSync("held.ts", "const host = { at: held };").program).find(
        (visit) => nodeTypeOf(visit.node) === "Identifier" && visit.node.name === "held",
      );
      if (found === undefined) throw new Error("no held is written inside an object");
      return flowsOutOf(found.node, found.ancestors);
    });

    it("is handed out", ({ outflow }) => {
      expect(outflow).toBe(true);
    });
  });

  describe("a name standing as the value of an object that is returned", () => {
    const it = test.extend("outflow", () => {
      const found = nodeVisitsIn(
        parseSync("held.ts", "const walk = () => { return { at: held }; };").program,
      ).find((visit) => nodeTypeOf(visit.node) === "Identifier" && visit.node.name === "held");
      if (found === undefined) throw new Error("no held stands as the value of a returned object");
      return flowsOutOf(found.node, found.ancestors);
    });

    it("is handed out", ({ outflow }) => {
      expect(outflow).toBe(true);
    });
  });

  describe("a name standing as the tag of a template", () => {
    const it = test.extend("outflow", () => {
      const found = nodeVisitsIn(parseSync("held.ts", "held`text`;").program).find(
        (visit) => nodeTypeOf(visit.node) === "Identifier" && visit.node.name === "held",
      );
      if (found === undefined) throw new Error("no held stands as the tag of a template");
      return flowsOutOf(found.node, found.ancestors);
    });

    it("stays where it is written", ({ outflow }) => {
      expect(outflow).toBe(false);
    });
  });

  describe("a name standing as the name of a binding", () => {
    const it = test.extend("outflow", () => {
      const found = nodeVisitsIn(parseSync("held.ts", "const held = 1;").program).find(
        (visit) => nodeTypeOf(visit.node) === "Identifier" && visit.node.name === "held",
      );
      if (found === undefined) throw new Error("no held stands as the name of a binding");
      return flowsOutOf(found.node, found.ancestors);
    });

    it("stays where it is written", ({ outflow }) => {
      expect(outflow).toBe(false);
    });
  });

  describe("a name standing as the value of a binding", () => {
    const it = test.extend("outflow", () => {
      const found = nodeVisitsIn(
        parseSync("held.ts", "const walk = () => { const alias = held; };").program,
      ).find((visit) => nodeTypeOf(visit.node) === "Identifier" && visit.node.name === "held");
      if (found === undefined) throw new Error("no held stands as the value of a binding");
      return flowsOutOf(found.node, found.ancestors);
    });

    it("is handed out", ({ outflow }) => {
      expect(outflow).toBe(true);
    });
  });

  describe("a name standing as the test of a condition that is returned", () => {
    const it = test.extend("outflow", () => {
      const found = nodeVisitsIn(
        parseSync("held.ts", "const walk = () => { return held ? 1 : 0; };").program,
      ).find((visit) => nodeTypeOf(visit.node) === "Identifier" && visit.node.name === "held");
      if (found === undefined) {
        throw new Error("no held stands as the test of a returned condition");
      }
      return flowsOutOf(found.node, found.ancestors);
    });

    it("is handed out", ({ outflow }) => {
      expect(outflow).toBe(true);
    });
  });

  describe("a name standing as the test of a condition that goes nowhere", () => {
    const it = test.extend("outflow", () => {
      const found = nodeVisitsIn(parseSync("held.ts", "held ? 1 : 0;").program).find(
        (visit) => nodeTypeOf(visit.node) === "Identifier" && visit.node.name === "held",
      );
      if (found === undefined) throw new Error("no held stands as the test of a condition");
      return flowsOutOf(found.node, found.ancestors);
    });

    it("stays where it is written", ({ outflow }) => {
      expect(outflow).toBe(false);
    });
  });

  describe("a name that nothing carries anywhere", () => {
    const it = test.extend("outflow", () => {
      const found = nodeVisitsIn(parseSync("held.ts", "held;").program).find(
        (visit) => nodeTypeOf(visit.node) === "Identifier" && visit.node.name === "held",
      );
      if (found === undefined) throw new Error("no held stands on its own");
      return flowsOutOf(found.node, found.ancestors);
    });

    it("stays where it is written", ({ outflow }) => {
      expect(outflow).toBe(false);
    });
  });
});
