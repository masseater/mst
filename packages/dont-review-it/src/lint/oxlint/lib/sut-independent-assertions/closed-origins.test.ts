import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { isSpecClosedValue } from "./closed-origins.ts";

import type { ESTree } from "@oxlint/plugins";

describe("isSpecClosedValue", () => {
  describe("a written-out string", () => {
    const it = test.extend("verdict", () => {
      const written = parseSync("spec.ts", '"a";').program.body[0] as ESTree.Statement;
      const bare = (written as ESTree.ExpressionStatement).expression;
      return isSpecClosedValue({
        written: bare.type === "ParenthesizedExpression" ? bare.expression : bare,
        reach: { boundValueOf: () => null, isDeclaredHere: () => false },
      });
    });

    it("reads as closed inside the spec", ({ verdict }) => {
      expect(verdict).toBe(true);
    });
  });

  describe("a written-out boolean", () => {
    const it = test.extend("verdict", () => {
      const written = parseSync("spec.ts", "true;").program.body[0] as ESTree.Statement;
      const bare = (written as ESTree.ExpressionStatement).expression;
      return isSpecClosedValue({
        written: bare.type === "ParenthesizedExpression" ? bare.expression : bare,
        reach: { boundValueOf: () => null, isDeclaredHere: () => false },
      });
    });

    it("reads as closed inside the spec", ({ verdict }) => {
      expect(verdict).toBe(true);
    });
  });

  describe("a written-out undefined", () => {
    const it = test.extend("verdict", () => {
      const written = parseSync("spec.ts", "undefined;").program.body[0] as ESTree.Statement;
      const bare = (written as ESTree.ExpressionStatement).expression;
      return isSpecClosedValue({
        written: bare.type === "ParenthesizedExpression" ? bare.expression : bare,
        reach: { boundValueOf: () => null, isDeclaredHere: () => false },
      });
    });

    it("reads as closed inside the spec", ({ verdict }) => {
      expect(verdict).toBe(true);
    });
  });

  describe("a sum of written-out numbers", () => {
    const it = test.extend("verdict", () => {
      const written = parseSync("spec.ts", "1 + 1;").program.body[0] as ESTree.Statement;
      const bare = (written as ESTree.ExpressionStatement).expression;
      return isSpecClosedValue({
        written: bare.type === "ParenthesizedExpression" ? bare.expression : bare,
        reach: { boundValueOf: () => null, isDeclaredHere: () => false },
      });
    });

    it("reads as closed", ({ verdict }) => {
      expect(verdict).toBe(true);
    });
  });

  describe("a list of written-out strings", () => {
    const it = test.extend("verdict", () => {
      const written = parseSync("spec.ts", '["a", "b"];').program.body[0] as ESTree.Statement;
      const bare = (written as ESTree.ExpressionStatement).expression;
      return isSpecClosedValue({
        written: bare.type === "ParenthesizedExpression" ? bare.expression : bare,
        reach: { boundValueOf: () => null, isDeclaredHere: () => false },
      });
    });

    it("reads as closed", ({ verdict }) => {
      expect(verdict).toBe(true);
    });
  });

  describe("a shape whose parts are all written out", () => {
    const it = test.extend("verdict", () => {
      const written = parseSync("spec.ts", '({ id: "a", carried: [1] });').program
        .body[0] as ESTree.Statement;
      const bare = (written as ESTree.ExpressionStatement).expression;
      return isSpecClosedValue({
        written: bare.type === "ParenthesizedExpression" ? bare.expression : bare,
        reach: { boundValueOf: () => null, isDeclaredHere: () => false },
      });
    });

    it("reads as closed", ({ verdict }) => {
      expect(verdict).toBe(true);
    });
  });

  describe("a template that substitutes nothing", () => {
    const it = test.extend("verdict", () => {
      const written = parseSync("spec.ts", "`a`;").program.body[0] as ESTree.Statement;
      const bare = (written as ESTree.ExpressionStatement).expression;
      return isSpecClosedValue({
        written: bare.type === "ParenthesizedExpression" ? bare.expression : bare,
        reach: { boundValueOf: () => null, isDeclaredHere: () => false },
      });
    });

    it("reads as closed", ({ verdict }) => {
      expect(verdict).toBe(true);
    });
  });

  describe("a choice between written-out strings", () => {
    const it = test.extend("verdict", () => {
      const written = parseSync("spec.ts", 'true ? "a" : "b";').program.body[0] as ESTree.Statement;
      const bare = (written as ESTree.ExpressionStatement).expression;
      return isSpecClosedValue({
        written: bare.type === "ParenthesizedExpression" ? bare.expression : bare,
        reach: { boundValueOf: () => null, isDeclaredHere: () => false },
      });
    });

    it("reads as closed", ({ verdict }) => {
      expect(verdict).toBe(true);
    });
  });

  describe("a name the spec filled with a written-out value", () => {
    const it = test.extend("verdict", () => {
      const spelled = parseSync("spec.ts", '"a";').program.body[0] as ESTree.Statement;
      const spelledBare = (spelled as ESTree.ExpressionStatement).expression;
      const declared = new Map<string, ESTree.Expression | null>([
        [
          "id",
          spelledBare.type === "ParenthesizedExpression" ? spelledBare.expression : spelledBare,
        ],
      ]);
      const written = parseSync("spec.ts", "id;").program.body[0] as ESTree.Statement;
      const bare = (written as ESTree.ExpressionStatement).expression;
      return isSpecClosedValue({
        written: bare.type === "ParenthesizedExpression" ? bare.expression : bare,
        reach: {
          boundValueOf: (reached) => declared.get(reached.name) ?? null,
          isDeclaredHere: (reached) => declared.has(reached.name),
        },
      });
    });

    it("reads as closed", ({ verdict }) => {
      expect(verdict).toBe(true);
    });
  });

  describe("a name reaching another name", () => {
    const it = test.extend("verdict", () => {
      const relayed = parseSync("spec.ts", "id;").program.body[0] as ESTree.Statement;
      const relayedBare = (relayed as ESTree.ExpressionStatement).expression;
      const spelled = parseSync("spec.ts", '"a";').program.body[0] as ESTree.Statement;
      const spelledBare = (spelled as ESTree.ExpressionStatement).expression;
      const declared = new Map<string, ESTree.Expression | null>([
        [
          "carried",
          relayedBare.type === "ParenthesizedExpression" ? relayedBare.expression : relayedBare,
        ],
        [
          "id",
          spelledBare.type === "ParenthesizedExpression" ? spelledBare.expression : spelledBare,
        ],
      ]);
      const written = parseSync("spec.ts", "carried;").program.body[0] as ESTree.Statement;
      const bare = (written as ESTree.ExpressionStatement).expression;
      return isSpecClosedValue({
        written: bare.type === "ParenthesizedExpression" ? bare.expression : bare,
        reach: {
          boundValueOf: (reached) => declared.get(reached.name) ?? null,
          isDeclaredHere: (reached) => declared.has(reached.name),
        },
      });
    });

    it("follows the chain of names to the value at its end", ({ verdict }) => {
      expect(verdict).toBe(true);
    });
  });

  describe("a name whose value the spec never wrote", () => {
    const it = test.extend("verdict", () => {
      const written = parseSync("spec.ts", "report;").program.body[0] as ESTree.Statement;
      const bare = (written as ESTree.ExpressionStatement).expression;
      return isSpecClosedValue({
        written: bare.type === "ParenthesizedExpression" ? bare.expression : bare,
        reach: { boundValueOf: () => null, isDeclaredHere: () => false },
      });
    });

    it("reads as open", ({ verdict }) => {
      expect(verdict).toBe(false);
    });
  });

  describe("a name declared without a value the spec can read", () => {
    const it = test.extend("verdict", () => {
      const declared = new Map<string, ESTree.Expression | null>([["report", null]]);
      const written = parseSync("spec.ts", "report;").program.body[0] as ESTree.Statement;
      const bare = (written as ESTree.ExpressionStatement).expression;
      return isSpecClosedValue({
        written: bare.type === "ParenthesizedExpression" ? bare.expression : bare,
        reach: {
          boundValueOf: (reached) => declared.get(reached.name) ?? null,
          isDeclaredHere: (reached) => declared.has(reached.name),
        },
      });
    });

    it("reads as open", ({ verdict }) => {
      expect(verdict).toBe(false);
    });
  });

  describe("a name reaching itself", () => {
    const it = test.extend("verdict", () => {
      const spelled = parseSync("spec.ts", "looped;").program.body[0] as ESTree.Statement;
      const spelledBare = (spelled as ESTree.ExpressionStatement).expression;
      const declared = new Map<string, ESTree.Expression | null>([
        [
          "looped",
          spelledBare.type === "ParenthesizedExpression" ? spelledBare.expression : spelledBare,
        ],
      ]);
      const written = parseSync("spec.ts", "looped;").program.body[0] as ESTree.Statement;
      const bare = (written as ESTree.ExpressionStatement).expression;
      return isSpecClosedValue({
        written: bare.type === "ParenthesizedExpression" ? bare.expression : bare,
        reach: {
          boundValueOf: (reached) => declared.get(reached.name) ?? null,
          isDeclaredHere: (reached) => declared.has(reached.name),
        },
      });
    });

    it("stops instead of walking forever", ({ verdict }) => {
      expect(verdict).toBe(false);
    });
  });

  describe("a call of a name the spec knows", () => {
    const it = test.extend("verdict", () => {
      const written = parseSync("spec.ts", 'summarise("a");').program.body[0] as ESTree.Statement;
      const bare = (written as ESTree.ExpressionStatement).expression;
      return isSpecClosedValue({
        written: bare.type === "ParenthesizedExpression" ? bare.expression : bare,
        reach: { boundValueOf: () => null, isDeclaredHere: () => false },
      });
    });

    it("reads as open", ({ verdict }) => {
      expect(verdict).toBe(false);
    });
  });

  describe("a call of a name from outside the spec", () => {
    const it = test.extend("verdict", () => {
      const written = parseSync("spec.ts", 'String("a");').program.body[0] as ESTree.Statement;
      const bare = (written as ESTree.ExpressionStatement).expression;
      return isSpecClosedValue({
        written: bare.type === "ParenthesizedExpression" ? bare.expression : bare,
        reach: { boundValueOf: () => null, isDeclaredHere: () => false },
      });
    });

    it("reads as open", ({ verdict }) => {
      expect(verdict).toBe(false);
    });
  });

  describe("a call written as a tagged template", () => {
    const it = test.extend("verdict", () => {
      const written = parseSync("spec.ts", "sql`a`;").program.body[0] as ESTree.Statement;
      const bare = (written as ESTree.ExpressionStatement).expression;
      return isSpecClosedValue({
        written: bare.type === "ParenthesizedExpression" ? bare.expression : bare,
        reach: { boundValueOf: () => null, isDeclaredHere: () => false },
      });
    });

    it("reads as open", ({ verdict }) => {
      expect(verdict).toBe(false);
    });
  });

  describe("a construction on a name this file declares", () => {
    const it = test.extend("verdict", () => {
      const declared = new Map<string, ESTree.Expression | null>([["Report", null]]);
      const written = parseSync("spec.ts", 'new Report("a");').program.body[0] as ESTree.Statement;
      const bare = (written as ESTree.ExpressionStatement).expression;
      return isSpecClosedValue({
        written: bare.type === "ParenthesizedExpression" ? bare.expression : bare,
        reach: {
          boundValueOf: (reached) => declared.get(reached.name) ?? null,
          isDeclaredHere: (reached) => declared.has(reached.name),
        },
      });
    });

    it("reads as open", ({ verdict }) => {
      expect(verdict).toBe(false);
    });
  });

  describe("a construction on a name from outside the spec", () => {
    const it = test.extend("verdict", () => {
      const written = parseSync("spec.ts", 'new Headers({ accept: "text/plain" });').program
        .body[0] as ESTree.Statement;
      const bare = (written as ESTree.ExpressionStatement).expression;
      return isSpecClosedValue({
        written: bare.type === "ParenthesizedExpression" ? bare.expression : bare,
        reach: { boundValueOf: () => null, isDeclaredHere: () => false },
      });
    });

    it("reads as closed", ({ verdict }) => {
      expect(verdict).toBe(true);
    });
  });

  describe("a construction carrying an open argument", () => {
    const it = test.extend("verdict", () => {
      const written = parseSync("spec.ts", "new Headers(sent);").program
        .body[0] as ESTree.Statement;
      const bare = (written as ESTree.ExpressionStatement).expression;
      return isSpecClosedValue({
        written: bare.type === "ParenthesizedExpression" ? bare.expression : bare,
        reach: { boundValueOf: () => null, isDeclaredHere: () => false },
      });
    });

    it("reads as open", ({ verdict }) => {
      expect(verdict).toBe(false);
    });
  });

  describe("a written-out value carried through a type assertion", () => {
    const it = test.extend("verdict", () => {
      const written = parseSync("spec.ts", '"a" as Spelling;').program.body[0] as ESTree.Statement;
      const bare = (written as ESTree.ExpressionStatement).expression;
      return isSpecClosedValue({
        written: bare.type === "ParenthesizedExpression" ? bare.expression : bare,
        reach: { boundValueOf: () => null, isDeclaredHere: () => false },
      });
    });

    it("reads as closed", ({ verdict }) => {
      expect(verdict).toBe(true);
    });
  });

  describe("an open name carried through a non-null assertion", () => {
    const it = test.extend("verdict", () => {
      const written = parseSync("spec.ts", "sent!;").program.body[0] as ESTree.Statement;
      const bare = (written as ESTree.ExpressionStatement).expression;
      return isSpecClosedValue({
        written: bare.type === "ParenthesizedExpression" ? bare.expression : bare,
        reach: { boundValueOf: () => null, isDeclaredHere: () => false },
      });
    });

    it("reads as open", ({ verdict }) => {
      expect(verdict).toBe(false);
    });
  });

  describe("a member of a shape written out on the spot", () => {
    const it = test.extend("verdict", () => {
      const written = parseSync("spec.ts", '({ id: "a" }).id;').program.body[0] as ESTree.Statement;
      const bare = (written as ESTree.ExpressionStatement).expression;
      return isSpecClosedValue({
        written: bare.type === "ParenthesizedExpression" ? bare.expression : bare,
        reach: { boundValueOf: () => null, isDeclaredHere: () => false },
      });
    });

    it("reads as closed", ({ verdict }) => {
      expect(verdict).toBe(true);
    });
  });

  describe("an element of a list written out on the spot", () => {
    const it = test.extend("verdict", () => {
      const written = parseSync("spec.ts", '["a"][0];').program.body[0] as ESTree.Statement;
      const bare = (written as ESTree.ExpressionStatement).expression;
      return isSpecClosedValue({
        written: bare.type === "ParenthesizedExpression" ? bare.expression : bare,
        reach: { boundValueOf: () => null, isDeclaredHere: () => false },
      });
    });

    it("reads as closed", ({ verdict }) => {
      expect(verdict).toBe(true);
    });
  });

  describe("a member of an open value", () => {
    const it = test.extend("verdict", () => {
      const written = parseSync("spec.ts", "report.id;").program.body[0] as ESTree.Statement;
      const bare = (written as ESTree.ExpressionStatement).expression;
      return isSpecClosedValue({
        written: bare.type === "ParenthesizedExpression" ? bare.expression : bare,
        reach: { boundValueOf: () => null, isDeclaredHere: () => false },
      });
    });

    it("reads as open", ({ verdict }) => {
      expect(verdict).toBe(false);
    });
  });

  describe("a member picked by an open key", () => {
    const it = test.extend("verdict", () => {
      const written = parseSync("spec.ts", '({ id: "a" })[picked];').program
        .body[0] as ESTree.Statement;
      const bare = (written as ESTree.ExpressionStatement).expression;
      return isSpecClosedValue({
        written: bare.type === "ParenthesizedExpression" ? bare.expression : bare,
        reach: { boundValueOf: () => null, isDeclaredHere: () => false },
      });
    });

    it("reads as open", ({ verdict }) => {
      expect(verdict).toBe(false);
    });
  });

  describe("a shape a name holds", () => {
    const it = test.extend("verdict", () => {
      const spelled = parseSync("spec.ts", "({});").program.body[0] as ESTree.Statement;
      const spelledBare = (spelled as ESTree.ExpressionStatement).expression;
      const declared = new Map<string, ESTree.Expression | null>([
        [
          "sink",
          spelledBare.type === "ParenthesizedExpression" ? spelledBare.expression : spelledBare,
        ],
      ]);
      const written = parseSync("spec.ts", "sink;").program.body[0] as ESTree.Statement;
      const bare = (written as ESTree.ExpressionStatement).expression;
      return isSpecClosedValue({
        written: bare.type === "ParenthesizedExpression" ? bare.expression : bare,
        reach: {
          boundValueOf: (reached) => declared.get(reached.name) ?? null,
          isDeclaredHere: (reached) => declared.has(reached.name),
        },
      });
    });

    it("reads as open, since anything holding it can write into it", ({ verdict }) => {
      expect(verdict).toBe(false);
    });
  });

  describe("a list a name holds", () => {
    const it = test.extend("verdict", () => {
      const spelled = parseSync("spec.ts", '["a"];').program.body[0] as ESTree.Statement;
      const spelledBare = (spelled as ESTree.ExpressionStatement).expression;
      const declared = new Map<string, ESTree.Expression | null>([
        [
          "ids",
          spelledBare.type === "ParenthesizedExpression" ? spelledBare.expression : spelledBare,
        ],
      ]);
      const written = parseSync("spec.ts", "ids;").program.body[0] as ESTree.Statement;
      const bare = (written as ESTree.ExpressionStatement).expression;
      return isSpecClosedValue({
        written: bare.type === "ParenthesizedExpression" ? bare.expression : bare,
        reach: {
          boundValueOf: (reached) => declared.get(reached.name) ?? null,
          isDeclaredHere: (reached) => declared.has(reached.name),
        },
      });
    });

    it("reads as open, since anything holding it can write into it", ({ verdict }) => {
      expect(verdict).toBe(false);
    });
  });

  describe("a constructed container a name holds", () => {
    const it = test.extend("verdict", () => {
      const spelled = parseSync("spec.ts", "new Set();").program.body[0] as ESTree.Statement;
      const spelledBare = (spelled as ESTree.ExpressionStatement).expression;
      const declared = new Map<string, ESTree.Expression | null>([
        [
          "sink",
          spelledBare.type === "ParenthesizedExpression" ? spelledBare.expression : spelledBare,
        ],
      ]);
      const written = parseSync("spec.ts", "sink;").program.body[0] as ESTree.Statement;
      const bare = (written as ESTree.ExpressionStatement).expression;
      return isSpecClosedValue({
        written: bare.type === "ParenthesizedExpression" ? bare.expression : bare,
        reach: {
          boundValueOf: (reached) => declared.get(reached.name) ?? null,
          isDeclaredHere: (reached) => declared.has(reached.name),
        },
      });
    });

    it("reads as open", ({ verdict }) => {
      expect(verdict).toBe(false);
    });
  });

  describe("a member of a constructed container a name holds", () => {
    const it = test.extend("verdict", () => {
      const spelled = parseSync("spec.ts", "new Set();").program.body[0] as ESTree.Statement;
      const spelledBare = (spelled as ESTree.ExpressionStatement).expression;
      const declared = new Map<string, ESTree.Expression | null>([
        [
          "sink",
          spelledBare.type === "ParenthesizedExpression" ? spelledBare.expression : spelledBare,
        ],
      ]);
      const written = parseSync("spec.ts", "sink.size;").program.body[0] as ESTree.Statement;
      const bare = (written as ESTree.ExpressionStatement).expression;
      return isSpecClosedValue({
        written: bare.type === "ParenthesizedExpression" ? bare.expression : bare,
        reach: {
          boundValueOf: (reached) => declared.get(reached.name) ?? null,
          isDeclaredHere: (reached) => declared.has(reached.name),
        },
      });
    });

    it("reads as open", ({ verdict }) => {
      expect(verdict).toBe(false);
    });
  });

  describe("joined strings a name holds", () => {
    const it = test.extend("verdict", () => {
      const spelled = parseSync("spec.ts", '"a" + "b";').program.body[0] as ESTree.Statement;
      const spelledBare = (spelled as ESTree.ExpressionStatement).expression;
      const declared = new Map<string, ESTree.Expression | null>([
        [
          "spelled",
          spelledBare.type === "ParenthesizedExpression" ? spelledBare.expression : spelledBare,
        ],
      ]);
      const written = parseSync("spec.ts", "spelled;").program.body[0] as ESTree.Statement;
      const bare = (written as ESTree.ExpressionStatement).expression;
      return isSpecClosedValue({
        written: bare.type === "ParenthesizedExpression" ? bare.expression : bare,
        reach: {
          boundValueOf: (reached) => declared.get(reached.name) ?? null,
          isDeclaredHere: (reached) => declared.has(reached.name),
        },
      });
    });

    it("reads as closed, since nothing can write into them", ({ verdict }) => {
      expect(verdict).toBe(true);
    });
  });

  describe("a template a name holds", () => {
    const it = test.extend("verdict", () => {
      const spelled = parseSync("spec.ts", "`a`;").program.body[0] as ESTree.Statement;
      const spelledBare = (spelled as ESTree.ExpressionStatement).expression;
      const declared = new Map<string, ESTree.Expression | null>([
        [
          "spelled",
          spelledBare.type === "ParenthesizedExpression" ? spelledBare.expression : spelledBare,
        ],
      ]);
      const written = parseSync("spec.ts", "spelled;").program.body[0] as ESTree.Statement;
      const bare = (written as ESTree.ExpressionStatement).expression;
      return isSpecClosedValue({
        written: bare.type === "ParenthesizedExpression" ? bare.expression : bare,
        reach: {
          boundValueOf: (reached) => declared.get(reached.name) ?? null,
          isDeclaredHere: (reached) => declared.has(reached.name),
        },
      });
    });

    it("reads as closed, since nothing can write into it", ({ verdict }) => {
      expect(verdict).toBe(true);
    });
  });

  describe("a function written in the spec", () => {
    const it = test.extend("verdict", () => {
      const written = parseSync("spec.ts", '() => parse("");').program.body[0] as ESTree.Statement;
      const bare = (written as ESTree.ExpressionStatement).expression;
      return isSpecClosedValue({
        written: bare.type === "ParenthesizedExpression" ? bare.expression : bare,
        reach: { boundValueOf: () => null, isDeclaredHere: () => false },
      });
    });

    it("reads as open", ({ verdict }) => {
      expect(verdict).toBe(false);
    });
  });

  describe("a shape spreading an open value", () => {
    const it = test.extend("verdict", () => {
      const written = parseSync("spec.ts", '({ ...report, id: "a" });').program
        .body[0] as ESTree.Statement;
      const bare = (written as ESTree.ExpressionStatement).expression;
      return isSpecClosedValue({
        written: bare.type === "ParenthesizedExpression" ? bare.expression : bare,
        reach: { boundValueOf: () => null, isDeclaredHere: () => false },
      });
    });

    it("reads as open", ({ verdict }) => {
      expect(verdict).toBe(false);
    });
  });

  describe("a list spreading an open value", () => {
    const it = test.extend("verdict", () => {
      const written = parseSync("spec.ts", '[...ids, "a"];').program.body[0] as ESTree.Statement;
      const bare = (written as ESTree.ExpressionStatement).expression;
      return isSpecClosedValue({
        written: bare.type === "ParenthesizedExpression" ? bare.expression : bare,
        reach: { boundValueOf: () => null, isDeclaredHere: () => false },
      });
    });

    it("reads as open", ({ verdict }) => {
      expect(verdict).toBe(false);
    });
  });
});
