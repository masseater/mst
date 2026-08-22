import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { FUNCTION_NODE_TYPES } from "../node-kinds.ts";
import { nodeTypeOf } from "../setup-modules/coupling-edges.ts";
import { constructedValueEscapes } from "./instance-escape.ts";
import { innermostOf, nodeVisitsIn } from "./node-visits.ts";

const SCOPE_OPENING = "class Cell {}\nconst walk = () => {\n";

const SCOPE_CLOSING = "\n};\n";

describe("constructedValueEscapes", () => {
  describe("an instance taken apart on the way out of its scope", () => {
    const it = test.extend("escapes", () => {
      const visits = nodeVisitsIn(
        parseSync(
          "cell.ts",
          `${SCOPE_OPENING}const { total } = new Cell();\nreturn total;${SCOPE_CLOSING}`,
        ).program,
      );
      const built = visits.find((visit) => nodeTypeOf(visit.node) === "NewExpression");
      if (built === undefined) throw new Error("the source builds nothing");
      const scope = innermostOf(built.ancestors, FUNCTION_NODE_TYPES);
      if (scope === null) throw new Error("no function holds the construction");
      return constructedValueEscapes({ visits, scope }, built);
    });

    it("leaves it", ({ escapes }) => {
      expect(escapes).toBe(true);
    });
  });

  describe("an instance held in a binding and only read", () => {
    const it = test.extend("escapes", () => {
      const visits = nodeVisitsIn(
        parseSync(
          "cell.ts",
          `${SCOPE_OPENING}const held = new Cell();\nheld.mark();${SCOPE_CLOSING}`,
        ).program,
      );
      const built = visits.find((visit) => nodeTypeOf(visit.node) === "NewExpression");
      if (built === undefined) throw new Error("the source builds nothing");
      const scope = innermostOf(built.ancestors, FUNCTION_NODE_TYPES);
      if (scope === null) throw new Error("no function holds the construction");
      return constructedValueEscapes({ visits, scope }, built);
    });

    it("stays inside its scope", ({ escapes }) => {
      expect(escapes).toBe(false);
    });
  });

  describe("an instance returned from its scope", () => {
    const it = test.extend("escapes", () => {
      const visits = nodeVisitsIn(
        parseSync(
          "cell.ts",
          `${SCOPE_OPENING}const held = new Cell();\nreturn held;${SCOPE_CLOSING}`,
        ).program,
      );
      const built = visits.find((visit) => nodeTypeOf(visit.node) === "NewExpression");
      if (built === undefined) throw new Error("the source builds nothing");
      const scope = innermostOf(built.ancestors, FUNCTION_NODE_TYPES);
      if (scope === null) throw new Error("no function holds the construction");
      return constructedValueEscapes({ visits, scope }, built);
    });

    it("leaves it", ({ escapes }) => {
      expect(escapes).toBe(true);
    });
  });

  describe("an instance thrown out of its scope", () => {
    const it = test.extend("escapes", () => {
      const visits = nodeVisitsIn(
        parseSync(
          "cell.ts",
          `${SCOPE_OPENING}const held = new Cell();\nthrow held;${SCOPE_CLOSING}`,
        ).program,
      );
      const built = visits.find((visit) => nodeTypeOf(visit.node) === "NewExpression");
      if (built === undefined) throw new Error("the source builds nothing");
      const scope = innermostOf(built.ancestors, FUNCTION_NODE_TYPES);
      if (scope === null) throw new Error("no function holds the construction");
      return constructedValueEscapes({ visits, scope }, built);
    });

    it("leaves it", ({ escapes }) => {
      expect(escapes).toBe(true);
    });
  });

  describe("an instance handed to a call", () => {
    const it = test.extend("escapes", () => {
      const visits = nodeVisitsIn(
        parseSync(
          "cell.ts",
          `${SCOPE_OPENING}const held = new Cell();\nsink(held);${SCOPE_CLOSING}`,
        ).program,
      );
      const built = visits.find((visit) => nodeTypeOf(visit.node) === "NewExpression");
      if (built === undefined) throw new Error("the source builds nothing");
      const scope = innermostOf(built.ancestors, FUNCTION_NODE_TYPES);
      if (scope === null) throw new Error("no function holds the construction");
      return constructedValueEscapes({ visits, scope }, built);
    });

    it("leaves its scope", ({ escapes }) => {
      expect(escapes).toBe(true);
    });
  });

  describe("an instance spread into a call", () => {
    const it = test.extend("escapes", () => {
      const visits = nodeVisitsIn(
        parseSync(
          "cell.ts",
          `${SCOPE_OPENING}const held = new Cell();\nsink(...[held]);${SCOPE_CLOSING}`,
        ).program,
      );
      const built = visits.find((visit) => nodeTypeOf(visit.node) === "NewExpression");
      if (built === undefined) throw new Error("the source builds nothing");
      const scope = innermostOf(built.ancestors, FUNCTION_NODE_TYPES);
      if (scope === null) throw new Error("no function holds the construction");
      return constructedValueEscapes({ visits, scope }, built);
    });

    it("leaves its scope", ({ escapes }) => {
      expect(escapes).toBe(true);
    });
  });

  describe("an instance handed to a template tag", () => {
    const it = test.extend("escapes", () => {
      const visits = nodeVisitsIn(
        parseSync(
          "cell.ts",
          `${SCOPE_OPENING}const held = new Cell();\ntag\`\${held}\`;${SCOPE_CLOSING}`,
        ).program,
      );
      const built = visits.find((visit) => nodeTypeOf(visit.node) === "NewExpression");
      if (built === undefined) throw new Error("the source builds nothing");
      const scope = innermostOf(built.ancestors, FUNCTION_NODE_TYPES);
      if (scope === null) throw new Error("no function holds the construction");
      return constructedValueEscapes({ visits, scope }, built);
    });

    it("leaves its scope", ({ escapes }) => {
      expect(escapes).toBe(true);
    });
  });

  describe("an instance handed to a further construction", () => {
    const it = test.extend("escapes", () => {
      const visits = nodeVisitsIn(
        parseSync(
          "cell.ts",
          `${SCOPE_OPENING}const held = new Cell();\nconst wrap = new Wrapper(held);${SCOPE_CLOSING}`,
        ).program,
      );
      const built = visits.find((visit) => nodeTypeOf(visit.node) === "NewExpression");
      if (built === undefined) throw new Error("the source builds nothing");
      const scope = innermostOf(built.ancestors, FUNCTION_NODE_TYPES);
      if (scope === null) throw new Error("no function holds the construction");
      return constructedValueEscapes({ visits, scope }, built);
    });

    it("leaves its scope", ({ escapes }) => {
      expect(escapes).toBe(true);
    });
  });

  describe("an instance written onto something else", () => {
    const it = test.extend("escapes", () => {
      const visits = nodeVisitsIn(
        parseSync(
          "cell.ts",
          `${SCOPE_OPENING}const held = new Cell();\nsink.at = held;${SCOPE_CLOSING}`,
        ).program,
      );
      const built = visits.find((visit) => nodeTypeOf(visit.node) === "NewExpression");
      if (built === undefined) throw new Error("the source builds nothing");
      const scope = innermostOf(built.ancestors, FUNCTION_NODE_TYPES);
      if (scope === null) throw new Error("no function holds the construction");
      return constructedValueEscapes({ visits, scope }, built);
    });

    it("leaves its scope", ({ escapes }) => {
      expect(escapes).toBe(true);
    });
  });

  describe("an instance bound to a second name", () => {
    const it = test.extend("escapes", () => {
      const visits = nodeVisitsIn(
        parseSync(
          "cell.ts",
          `${SCOPE_OPENING}const held = new Cell();\nconst alias = held;${SCOPE_CLOSING}`,
        ).program,
      );
      const built = visits.find((visit) => nodeTypeOf(visit.node) === "NewExpression");
      if (built === undefined) throw new Error("the source builds nothing");
      const scope = innermostOf(built.ancestors, FUNCTION_NODE_TYPES);
      if (scope === null) throw new Error("no function holds the construction");
      return constructedValueEscapes({ visits, scope }, built);
    });

    it("leaves its scope", ({ escapes }) => {
      expect(escapes).toBe(true);
    });
  });

  describe("an instance packed into an object that is returned", () => {
    const it = test.extend("escapes", () => {
      const visits = nodeVisitsIn(
        parseSync(
          "cell.ts",
          `${SCOPE_OPENING}const held = new Cell();\nreturn { held };${SCOPE_CLOSING}`,
        ).program,
      );
      const built = visits.find((visit) => nodeTypeOf(visit.node) === "NewExpression");
      if (built === undefined) throw new Error("the source builds nothing");
      const scope = innermostOf(built.ancestors, FUNCTION_NODE_TYPES);
      if (scope === null) throw new Error("no function holds the construction");
      return constructedValueEscapes({ visits, scope }, built);
    });

    it("leaves its scope", ({ escapes }) => {
      expect(escapes).toBe(true);
    });
  });

  describe("an instance chosen by a condition and returned", () => {
    const it = test.extend("escapes", () => {
      const visits = nodeVisitsIn(
        parseSync(
          "cell.ts",
          `${SCOPE_OPENING}const held = new Cell();\nreturn ready ? held : null;${SCOPE_CLOSING}`,
        ).program,
      );
      const built = visits.find((visit) => nodeTypeOf(visit.node) === "NewExpression");
      if (built === undefined) throw new Error("the source builds nothing");
      const scope = innermostOf(built.ancestors, FUNCTION_NODE_TYPES);
      if (scope === null) throw new Error("no function holds the construction");
      return constructedValueEscapes({ visits, scope }, built);
    });

    it("leaves its scope", ({ escapes }) => {
      expect(escapes).toBe(true);
    });
  });

  describe("an instance weighed by a condition that is returned", () => {
    const it = test.extend("escapes", () => {
      const visits = nodeVisitsIn(
        parseSync(
          "cell.ts",
          `${SCOPE_OPENING}const held = new Cell();\nreturn held ? 1 : 0;${SCOPE_CLOSING}`,
        ).program,
      );
      const built = visits.find((visit) => nodeTypeOf(visit.node) === "NewExpression");
      if (built === undefined) throw new Error("the source builds nothing");
      const scope = innermostOf(built.ancestors, FUNCTION_NODE_TYPES);
      if (scope === null) throw new Error("no function holds the construction");
      return constructedValueEscapes({ visits, scope }, built);
    });

    it("leaves its scope", ({ escapes }) => {
      expect(escapes).toBe(true);
    });
  });

  describe("an instance read through an assertion", () => {
    const it = test.extend("escapes", () => {
      const visits = nodeVisitsIn(
        parseSync(
          "cell.ts",
          `${SCOPE_OPENING}const held = new Cell();\n(held as Cell).mark();${SCOPE_CLOSING}`,
        ).program,
      );
      const built = visits.find((visit) => nodeTypeOf(visit.node) === "NewExpression");
      if (built === undefined) throw new Error("the source builds nothing");
      const scope = innermostOf(built.ancestors, FUNCTION_NODE_TYPES);
      if (scope === null) throw new Error("no function holds the construction");
      return constructedValueEscapes({ visits, scope }, built);
    });

    it("stays inside its scope", ({ escapes }) => {
      expect(escapes).toBe(false);
    });
  });

  describe("an instance returned through an assertion", () => {
    const it = test.extend("escapes", () => {
      const visits = nodeVisitsIn(
        parseSync(
          "cell.ts",
          `${SCOPE_OPENING}const held = new Cell();\nreturn held as Cell;${SCOPE_CLOSING}`,
        ).program,
      );
      const built = visits.find((visit) => nodeTypeOf(visit.node) === "NewExpression");
      if (built === undefined) throw new Error("the source builds nothing");
      const scope = innermostOf(built.ancestors, FUNCTION_NODE_TYPES);
      if (scope === null) throw new Error("no function holds the construction");
      return constructedValueEscapes({ visits, scope }, built);
    });

    it("leaves its scope", ({ escapes }) => {
      expect(escapes).toBe(true);
    });
  });

  describe("an instance read through an optional link", () => {
    const it = test.extend("escapes", () => {
      const visits = nodeVisitsIn(
        parseSync(
          "cell.ts",
          `${SCOPE_OPENING}const held = new Cell();\nheld?.mark();${SCOPE_CLOSING}`,
        ).program,
      );
      const built = visits.find((visit) => nodeTypeOf(visit.node) === "NewExpression");
      if (built === undefined) throw new Error("the source builds nothing");
      const scope = innermostOf(built.ancestors, FUNCTION_NODE_TYPES);
      if (scope === null) throw new Error("no function holds the construction");
      return constructedValueEscapes({ visits, scope }, built);
    });

    it("stays inside its scope", ({ escapes }) => {
      expect(escapes).toBe(false);
    });
  });

  describe("an instance built straight into a return", () => {
    const it = test.extend("escapes", () => {
      const visits = nodeVisitsIn(
        parseSync("cell.ts", `${SCOPE_OPENING}return new Cell();${SCOPE_CLOSING}`).program,
      );
      const built = visits.find((visit) => nodeTypeOf(visit.node) === "NewExpression");
      if (built === undefined) throw new Error("the source builds nothing");
      const scope = innermostOf(built.ancestors, FUNCTION_NODE_TYPES);
      if (scope === null) throw new Error("no function holds the construction");
      return constructedValueEscapes({ visits, scope }, built);
    });

    it("leaves its scope", ({ escapes }) => {
      expect(escapes).toBe(true);
    });
  });

  describe("an instance built and read in place", () => {
    const it = test.extend("escapes", () => {
      const visits = nodeVisitsIn(
        parseSync("cell.ts", `${SCOPE_OPENING}new Cell().mark();${SCOPE_CLOSING}`).program,
      );
      const built = visits.find((visit) => nodeTypeOf(visit.node) === "NewExpression");
      if (built === undefined) throw new Error("the source builds nothing");
      const scope = innermostOf(built.ancestors, FUNCTION_NODE_TYPES);
      if (scope === null) throw new Error("no function holds the construction");
      return constructedValueEscapes({ visits, scope }, built);
    });

    it("stays inside its scope", ({ escapes }) => {
      expect(escapes).toBe(false);
    });
  });

  describe("an instance held by a local function that is only called", () => {
    const it = test.extend("escapes", () => {
      const visits = nodeVisitsIn(
        parseSync(
          "cell.ts",
          `${SCOPE_OPENING}const held = new Cell();\nconst bump = () => held.mark();\nbump();${SCOPE_CLOSING}`,
        ).program,
      );
      const built = visits.find((visit) => nodeTypeOf(visit.node) === "NewExpression");
      if (built === undefined) throw new Error("the source builds nothing");
      const scope = innermostOf(built.ancestors, FUNCTION_NODE_TYPES);
      if (scope === null) throw new Error("no function holds the construction");
      return constructedValueEscapes({ visits, scope }, built);
    });

    it("stays inside its scope", ({ escapes }) => {
      expect(escapes).toBe(false);
    });
  });

  describe("an instance held by a local function declaration that is only called", () => {
    const it = test.extend("escapes", () => {
      const visits = nodeVisitsIn(
        parseSync(
          "cell.ts",
          `${SCOPE_OPENING}const held = new Cell();\nfunction bump() { held.mark(); }\nbump();${SCOPE_CLOSING}`,
        ).program,
      );
      const built = visits.find((visit) => nodeTypeOf(visit.node) === "NewExpression");
      if (built === undefined) throw new Error("the source builds nothing");
      const scope = innermostOf(built.ancestors, FUNCTION_NODE_TYPES);
      if (scope === null) throw new Error("no function holds the construction");
      return constructedValueEscapes({ visits, scope }, built);
    });

    it("stays inside its scope", ({ escapes }) => {
      expect(escapes).toBe(false);
    });
  });

  describe("an instance held by a local function that is handed away", () => {
    const it = test.extend("escapes", () => {
      const visits = nodeVisitsIn(
        parseSync(
          "cell.ts",
          `${SCOPE_OPENING}const held = new Cell();\nconst bump = () => held.mark();\nregister(bump);${SCOPE_CLOSING}`,
        ).program,
      );
      const built = visits.find((visit) => nodeTypeOf(visit.node) === "NewExpression");
      if (built === undefined) throw new Error("the source builds nothing");
      const scope = innermostOf(built.ancestors, FUNCTION_NODE_TYPES);
      if (scope === null) throw new Error("no function holds the construction");
      return constructedValueEscapes({ visits, scope }, built);
    });

    it("leaves its scope", ({ escapes }) => {
      expect(escapes).toBe(true);
    });
  });

  describe("an instance held by a nameless function handed away", () => {
    const it = test.extend("escapes", () => {
      const visits = nodeVisitsIn(
        parseSync(
          "cell.ts",
          `${SCOPE_OPENING}const held = new Cell();\nregister(() => held.mark());${SCOPE_CLOSING}`,
        ).program,
      );
      const built = visits.find((visit) => nodeTypeOf(visit.node) === "NewExpression");
      if (built === undefined) throw new Error("the source builds nothing");
      const scope = innermostOf(built.ancestors, FUNCTION_NODE_TYPES);
      if (scope === null) throw new Error("no function holds the construction");
      return constructedValueEscapes({ visits, scope }, built);
    });

    it("leaves its scope", ({ escapes }) => {
      expect(escapes).toBe(true);
    });
  });

  describe("an instance handed out from inside a local function", () => {
    const it = test.extend("escapes", () => {
      const visits = nodeVisitsIn(
        parseSync(
          "cell.ts",
          `${SCOPE_OPENING}const held = new Cell();\nconst send = () => register(held);\nsend();${SCOPE_CLOSING}`,
        ).program,
      );
      const built = visits.find((visit) => nodeTypeOf(visit.node) === "NewExpression");
      if (built === undefined) throw new Error("the source builds nothing");
      const scope = innermostOf(built.ancestors, FUNCTION_NODE_TYPES);
      if (scope === null) throw new Error("no function holds the construction");
      return constructedValueEscapes({ visits, scope }, built);
    });

    it("leaves its scope", ({ escapes }) => {
      expect(escapes).toBe(true);
    });
  });

  describe("an instance held by a function inside a function that is only called", () => {
    const it = test.extend("escapes", () => {
      const visits = nodeVisitsIn(
        parseSync(
          "cell.ts",
          `${SCOPE_OPENING}const held = new Cell();\nconst outer = () => { const inner = () => held.mark(); inner(); };\nouter();${SCOPE_CLOSING}`,
        ).program,
      );
      const built = visits.find((visit) => nodeTypeOf(visit.node) === "NewExpression");
      if (built === undefined) throw new Error("the source builds nothing");
      const scope = innermostOf(built.ancestors, FUNCTION_NODE_TYPES);
      if (scope === null) throw new Error("no function holds the construction");
      return constructedValueEscapes({ visits, scope }, built);
    });

    it("stays inside its scope", ({ escapes }) => {
      expect(escapes).toBe(false);
    });
  });

  describe("an instance held by a nameless function inside a function that is handed away", () => {
    const it = test.extend("escapes", () => {
      const visits = nodeVisitsIn(
        parseSync(
          "cell.ts",
          `${SCOPE_OPENING}const held = new Cell();\nconst outer = () => { register(() => held.mark()); };\nouter();${SCOPE_CLOSING}`,
        ).program,
      );
      const built = visits.find((visit) => nodeTypeOf(visit.node) === "NewExpression");
      if (built === undefined) throw new Error("the source builds nothing");
      const scope = innermostOf(built.ancestors, FUNCTION_NODE_TYPES);
      if (scope === null) throw new Error("no function holds the construction");
      return constructedValueEscapes({ visits, scope }, built);
    });

    it("leaves its scope", ({ escapes }) => {
      expect(escapes).toBe(true);
    });
  });

  describe("an instance held by two functions that call each other", () => {
    const it = test.extend("escapes", () => {
      const visits = nodeVisitsIn(
        parseSync(
          "cell.ts",
          `${SCOPE_OPENING}const held = new Cell();\nconst even = () => odd();\nconst odd = () => { held.mark(); even(); };\nodd();${SCOPE_CLOSING}`,
        ).program,
      );
      const built = visits.find((visit) => nodeTypeOf(visit.node) === "NewExpression");
      if (built === undefined) throw new Error("the source builds nothing");
      const scope = innermostOf(built.ancestors, FUNCTION_NODE_TYPES);
      if (scope === null) throw new Error("no function holds the construction");
      return constructedValueEscapes({ visits, scope }, built);
    });

    it("stays inside its scope", ({ escapes }) => {
      expect(escapes).toBe(false);
    });
  });

  describe("an instance held by a function running in place inside a function", () => {
    const it = test.extend("escapes", () => {
      const visits = nodeVisitsIn(
        parseSync(
          "cell.ts",
          `${SCOPE_OPENING}const held = new Cell();\nconst outer = () => { (() => held.mark())(); };\nouter();${SCOPE_CLOSING}`,
        ).program,
      );
      const built = visits.find((visit) => nodeTypeOf(visit.node) === "NewExpression");
      if (built === undefined) throw new Error("the source builds nothing");
      const scope = innermostOf(built.ancestors, FUNCTION_NODE_TYPES);
      if (scope === null) throw new Error("no function holds the construction");
      return constructedValueEscapes({ visits, scope }, built);
    });

    it("stays inside its scope", ({ escapes }) => {
      expect(escapes).toBe(false);
    });
  });

  describe("an instance yielded out of its scope", () => {
    const it = test.extend("escapes", () => {
      const visits = nodeVisitsIn(
        parseSync(
          "cell.ts",
          "class Cell {}\nfunction* walk() { const held = new Cell(); yield held; }",
        ).program,
      );
      const built = visits.find((visit) => nodeTypeOf(visit.node) === "NewExpression");
      if (built === undefined) throw new Error("the source builds nothing");
      const scope = innermostOf(built.ancestors, FUNCTION_NODE_TYPES);
      if (scope === null) throw new Error("no function holds the construction");
      return constructedValueEscapes({ visits, scope }, built);
    });

    it("leaves it", ({ escapes }) => {
      expect(escapes).toBe(true);
    });
  });

  describe("an instance whose name is also bound outside its scope", () => {
    const it = test.extend("escapes", () => {
      const visits = nodeVisitsIn(
        parseSync(
          "cell.ts",
          "class Cell {}\nconst held = 0;\nconst walk = () => { const held = new Cell(); held.mark(); };",
        ).program,
      );
      const built = visits.find((visit) => nodeTypeOf(visit.node) === "NewExpression");
      if (built === undefined) throw new Error("the source builds nothing");
      const scope = innermostOf(built.ancestors, FUNCTION_NODE_TYPES);
      if (scope === null) throw new Error("no function holds the construction");
      return constructedValueEscapes({ visits, scope }, built);
    });

    it("stays inside its scope", ({ escapes }) => {
      expect(escapes).toBe(false);
    });
  });
});
