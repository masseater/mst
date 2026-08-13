import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import {
  testBlockModifiersOf,
  testBlockRootIdentifier,
  testBlockRootName,
} from "./test-block-modifiers.ts";

import type { ESTree } from "@oxlint/plugins";

describe("testBlockModifiersOf", () => {
  describe("the names it reads off a declaration", () => {
    describe("every modifier the runner chains onto a block", () => {
      const it = test.extend("modifierNames", () =>
        [
          "concurrent",
          "each",
          "fails",
          "for",
          "only",
          "runIf",
          "sequential",
          "shuffle",
          "skip",
          "skipIf",
          "todo",
        ].flatMap((chained) => {
          const statement = parseSync("spec.ts", `it.${chained}("names a behaviour", () => {});`)
            .program.body[0] as ESTree.ExpressionStatement;
          const written = statement.expression as ESTree.CallExpression;
          return testBlockModifiersOf(written.callee).map((modifier) => modifier.name);
        }));

      it("is named as a modifier", ({ modifierNames }) => {
        expect(modifierNames).toStrictEqual([
          "concurrent",
          "each",
          "fails",
          "for",
          "only",
          "runIf",
          "sequential",
          "shuffle",
          "skip",
          "skipIf",
          "todo",
        ]);
      });
    });

    describe("a bare block declaration", () => {
      const it = test.extend("modifierNames", () => {
        const statement = parseSync("spec.ts", 'it("names a behaviour", () => {});').program
          .body[0] as ESTree.ExpressionStatement;
        const written = statement.expression as ESTree.CallExpression;
        return testBlockModifiersOf(written.callee).map((modifier) => modifier.name);
      });

      it("carries no modifier", ({ modifierNames }) => {
        expect(modifierNames).toStrictEqual([]);
      });
    });

    describe("a modifier in front of the block", () => {
      const it = test.extend("modifierNames", () => {
        const statement = parseSync("spec.ts", 'it.skip("names a behaviour", () => {});').program
          .body[0] as ESTree.ExpressionStatement;
        const written = statement.expression as ESTree.CallExpression;
        return testBlockModifiersOf(written.callee).map((modifier) => modifier.name);
      });

      it("is read under the name it is spelled with", ({ modifierNames }) => {
        expect(modifierNames).toStrictEqual(["skip"]);
      });
    });

    describe("modifiers stacked on top of each other", () => {
      const it = test.extend("modifierNames", () => {
        const statement = parseSync(
          "spec.ts",
          'it.skip.each(rows)("names a behaviour", (row) => {});',
        ).program.body[0] as ESTree.ExpressionStatement;
        const written = statement.expression as ESTree.CallExpression;
        return testBlockModifiersOf(written.callee).map((modifier) => modifier.name);
      });

      it("are read from the outermost inwards", ({ modifierNames }) => {
        expect(modifierNames).toStrictEqual(["each", "skip"]);
      });
    });

    describe("a modifier written as a string subscript", () => {
      const it = test.extend("modifierNames", () => {
        const statement = parseSync("spec.ts", 'it["skip"]("names a behaviour", () => {});').program
          .body[0] as ESTree.ExpressionStatement;
        const written = statement.expression as ESTree.CallExpression;
        return testBlockModifiersOf(written.callee).map((modifier) => modifier.name);
      });

      it("is read the same way", ({ modifierNames }) => {
        expect(modifierNames).toStrictEqual(["skip"]);
      });
    });

    describe("a modifier chosen at run time", () => {
      const it = test.extend("modifierNames", () => {
        const statement = parseSync("spec.ts", 'it[chosen]("names a behaviour", () => {});').program
          .body[0] as ESTree.ExpressionStatement;
        const written = statement.expression as ESTree.CallExpression;
        return testBlockModifiersOf(written.callee).map((modifier) => modifier.name);
      });

      it("is read as no modifier at all", ({ modifierNames }) => {
        expect(modifierNames).toStrictEqual([]);
      });
    });

    describe("the fixture builder spelling", () => {
      const it = test.extend("modifierNames", () => {
        const statement = parseSync("spec.ts", 'it.extend("names a behaviour", () => {});').program
          .body[0] as ESTree.ExpressionStatement;
        const written = statement.expression as ESTree.CallExpression;
        return testBlockModifiersOf(written.callee).map((modifier) => modifier.name);
      });

      it("is not a modifier", ({ modifierNames }) => {
        expect(modifierNames).toStrictEqual([]);
      });
    });

    describe("the fixture override spelling", () => {
      const it = test.extend("modifierNames", () => {
        const statement = parseSync("spec.ts", 'it.override("names a behaviour", () => {});')
          .program.body[0] as ESTree.ExpressionStatement;
        const written = statement.expression as ESTree.CallExpression;
        return testBlockModifiersOf(written.callee).map((modifier) => modifier.name);
      });

      it("is not a modifier", ({ modifierNames }) => {
        expect(modifierNames).toStrictEqual([]);
      });
    });

    describe("the fixture scoping spelling", () => {
      const it = test.extend("modifierNames", () => {
        const statement = parseSync("spec.ts", 'it.scoped("names a behaviour", () => {});').program
          .body[0] as ESTree.ExpressionStatement;
        const written = statement.expression as ESTree.CallExpression;
        return testBlockModifiersOf(written.callee).map((modifier) => modifier.name);
      });

      it("is not a modifier", ({ modifierNames }) => {
        expect(modifierNames).toStrictEqual([]);
      });
    });

    describe("a name the runner does not chain onto a block", () => {
      const it = test.extend("modifierNames", () => {
        const statement = parseSync(
          "spec.ts",
          'test.extend({ subject: 1 })("names a behaviour", () => {});',
        ).program.body[0] as ESTree.ExpressionStatement;
        const written = statement.expression as ESTree.CallExpression;
        return testBlockModifiersOf(written.callee).map((modifier) => modifier.name);
      });

      it("stops the reading", ({ modifierNames }) => {
        expect(modifierNames).toStrictEqual([]);
      });
    });
  });

  describe("what each modifier is handed", () => {
    describe("a modifier handed a named table", () => {
      const it = test.extend("handedShapes", () => {
        const statement = parseSync("spec.ts", 'it.each(rows)("names a behaviour", (row) => {});')
          .program.body[0] as ESTree.ExpressionStatement;
        const written = statement.expression as ESTree.CallExpression;
        return testBlockModifiersOf(written.callee).map(
          (modifier) => modifier.handed?.map((held) => held.type) ?? null,
        );
      });

      it("hands the table over with it", ({ handedShapes }) => {
        expect(handedShapes).toStrictEqual([["Identifier"]]);
      });
    });

    describe("a modifier handed a written table", () => {
      const it = test.extend("handedShapes", () => {
        const statement = parseSync("spec.ts", 'it.each([1, 2])("names a behaviour", (row) => {});')
          .program.body[0] as ESTree.ExpressionStatement;
        const written = statement.expression as ESTree.CallExpression;
        return testBlockModifiersOf(written.callee).map(
          (modifier) => modifier.handed?.map((held) => held.type) ?? null,
        );
      });

      it("hands that table over with it", ({ handedShapes }) => {
        expect(handedShapes).toStrictEqual([["ArrayExpression"]]);
      });
    });

    describe("a modifier written without an argument list", () => {
      const it = test.extend("handedShapes", () => {
        const statement = parseSync("spec.ts", 'it.skip("names a behaviour", () => {});').program
          .body[0] as ESTree.ExpressionStatement;
        const written = statement.expression as ESTree.CallExpression;
        return testBlockModifiersOf(written.callee).map(
          (modifier) => modifier.handed?.map((held) => held.type) ?? null,
        );
      });

      it("hands nothing over", ({ handedShapes }) => {
        expect(handedShapes).toStrictEqual([null]);
      });
    });

    describe("a table spread into the modifier", () => {
      const it = test.extend("handedShapes", () => {
        const statement = parseSync(
          "spec.ts",
          'it.each(...tables)("names a behaviour", (row) => {});',
        ).program.body[0] as ESTree.ExpressionStatement;
        const written = statement.expression as ESTree.CallExpression;
        return testBlockModifiersOf(written.callee).map(
          (modifier) => modifier.handed?.map((held) => held.type) ?? null,
        );
      });

      it("leaves nothing to read", ({ handedShapes }) => {
        expect(handedShapes).toStrictEqual([null]);
      });
    });

    describe("a table written as a tagged template", () => {
      const it = test.extend("handedShapes", () => {
        const statement = parseSync("spec.ts", 'it.each`a | b`("names a behaviour", () => {});')
          .program.body[0] as ESTree.ExpressionStatement;
        const written = statement.expression as ESTree.CallExpression;
        return testBlockModifiersOf(written.callee).map(
          (modifier) => modifier.handed?.map((held) => held.type) ?? null,
        );
      });

      it("leaves nothing to read", ({ handedShapes }) => {
        expect(handedShapes).toStrictEqual([null]);
      });
    });

    describe("the arguments of the block itself", () => {
      const it = test.extend("handedShapes", () => {
        const statement = parseSync("spec.ts", 'it.concurrent("names a behaviour", () => {});')
          .program.body[0] as ESTree.ExpressionStatement;
        const written = statement.expression as ESTree.CallExpression;
        return testBlockModifiersOf(written.callee).map(
          (modifier) => modifier.handed?.map((held) => held.type) ?? null,
        );
      });

      it("belong to no modifier", ({ handedShapes }) => {
        expect(handedShapes).toStrictEqual([null]);
      });
    });
  });
});

describe("testBlockRootName", () => {
  describe("a bare block declaration", () => {
    const it = test.extend("rootName", () => {
      const statement = parseSync("spec.ts", 'it("names a behaviour", () => {});').program
        .body[0] as ESTree.ExpressionStatement;
      const written = statement.expression as ESTree.CallExpression;
      return testBlockRootName(written.callee);
    });

    it("is rooted at the identifier it is written with", ({ rootName }) => {
      expect(rootName).toBe("it");
    });
  });

  describe("a bare block declaration written with the other spelling", () => {
    const it = test.extend("rootName", () => {
      const statement = parseSync("spec.ts", 'test("names a behaviour", () => {});').program
        .body[0] as ESTree.ExpressionStatement;
      const written = statement.expression as ESTree.CallExpression;
      return testBlockRootName(written.callee);
    });

    it("is rooted at that spelling", ({ rootName }) => {
      expect(rootName).toBe("test");
    });
  });

  describe("a modifier in front of the block", () => {
    const it = test.extend("rootName", () => {
      const statement = parseSync("spec.ts", 'it.skip("names a behaviour", () => {});').program
        .body[0] as ESTree.ExpressionStatement;
      const written = statement.expression as ESTree.CallExpression;
      return testBlockRootName(written.callee);
    });

    it("leaves the root where it was", ({ rootName }) => {
      expect(rootName).toBe("it");
    });
  });

  describe("a modifier in front of a grouping block", () => {
    const it = test.extend("rootName", () => {
      const statement = parseSync("spec.ts", 'describe.concurrent("names a group", () => {});')
        .program.body[0] as ESTree.ExpressionStatement;
      const written = statement.expression as ESTree.CallExpression;
      return testBlockRootName(written.callee);
    });

    it("leaves that root where it was", ({ rootName }) => {
      expect(rootName).toBe("describe");
    });
  });

  describe("modifiers stacked on top of each other", () => {
    const it = test.extend("rootName", () => {
      const statement = parseSync(
        "spec.ts",
        'it.skipIf(slow).concurrent("names a behaviour", () => {});',
      ).program.body[0] as ESTree.ExpressionStatement;
      const written = statement.expression as ESTree.CallExpression;
      return testBlockRootName(written.callee);
    });

    it("still reach the same root", ({ rootName }) => {
      expect(rootName).toBe("it");
    });
  });

  describe("a modifier written as a string subscript", () => {
    const it = test.extend("rootName", () => {
      const statement = parseSync("spec.ts", 'it["skip"]("names a behaviour", () => {});').program
        .body[0] as ESTree.ExpressionStatement;
      const written = statement.expression as ESTree.CallExpression;
      return testBlockRootName(written.callee);
    });

    it("reaches the same root", ({ rootName }) => {
      expect(rootName).toBe("it");
    });
  });

  describe("a modifier chosen at run time", () => {
    const it = test.extend("rootName", () => {
      const statement = parseSync("spec.ts", 'it[chosen]("names a behaviour", () => {});').program
        .body[0] as ESTree.ExpressionStatement;
      const written = statement.expression as ESTree.CallExpression;
      return testBlockRootName(written.callee);
    });

    it("hides the root from this reading", ({ rootName }) => {
      expect(rootName).toBe(null);
    });
  });

  describe("a table-driven block", () => {
    const it = test.extend("rootName", () => {
      const statement = parseSync("spec.ts", 'it.each(rows)("names a behaviour", (row) => {});')
        .program.body[0] as ESTree.ExpressionStatement;
      const written = statement.expression as ESTree.CallExpression;
      return testBlockRootName(written.callee);
    });

    it("reaches its root through the call the table returns", ({ rootName }) => {
      expect(rootName).toBe("it");
    });
  });

  describe("a table written as a tagged template", () => {
    const it = test.extend("rootName", () => {
      const statement = parseSync("spec.ts", "it.each`a | b`;").program
        .body[0] as ESTree.ExpressionStatement;
      const written = statement.expression as ESTree.TaggedTemplateExpression;
      return testBlockRootName(written.tag);
    });

    it("reaches the same root", ({ rootName }) => {
      expect(rootName).toBe("it");
    });
  });

  describe("a block called through the function a tagged table returns", () => {
    const it = test.extend("rootName", () => {
      const statement = parseSync("spec.ts", 'it.each`a | b`("names a behaviour", () => {});')
        .program.body[0] as ESTree.ExpressionStatement;
      const written = statement.expression as ESTree.CallExpression;
      return testBlockRootName(written.callee);
    });

    it("reaches the same root", ({ rootName }) => {
      expect(rootName).toBe("it");
    });
  });

  describe("a callee that is neither a name, a call nor a member", () => {
    const it = test.extend("rootName", () => {
      const statement = parseSync("spec.ts", 'this("names a behaviour");').program
        .body[0] as ESTree.ExpressionStatement;
      const written = statement.expression as ESTree.CallExpression;
      return testBlockRootName(written.callee);
    });

    it("reaches no root", ({ rootName }) => {
      expect(rootName).toBe(null);
    });
  });

  describe("a fixture factory built on the other spelling", () => {
    const it = test.extend("rootName", () => {
      const statement = parseSync("spec.ts", "test.extend({ subject: 1 });").program
        .body[0] as ESTree.ExpressionStatement;
      const written = statement.expression as ESTree.CallExpression;
      return testBlockRootName(written.callee);
    });

    it("is not a modified block", ({ rootName }) => {
      expect(rootName).toBe(null);
    });
  });

  describe("a fixture factory built on the block spelling", () => {
    const it = test.extend("rootName", () => {
      const statement = parseSync("spec.ts", "it.extend({ subject: 1 });").program
        .body[0] as ESTree.ExpressionStatement;
      const written = statement.expression as ESTree.CallExpression;
      return testBlockRootName(written.callee);
    });

    it("is not a modified block either", ({ rootName }) => {
      expect(rootName).toBe(null);
    });
  });

  describe("a block derived from a fixture factory", () => {
    const it = test.extend("rootName", () => {
      const statement = parseSync(
        "spec.ts",
        'test.extend({ subject: 1 })("names a behaviour", () => {});',
      ).program.body[0] as ESTree.ExpressionStatement;
      const written = statement.expression as ESTree.CallExpression;
      return testBlockRootName(written.callee);
    });

    it("is rooted at nothing this reading can name", ({ rootName }) => {
      expect(rootName).toBe(null);
    });
  });

  describe("a member call on a receiver", () => {
    const it = test.extend("rootName", () => {
      const statement = parseSync("spec.ts", 'suite.it("names a behaviour", () => {});').program
        .body[0] as ESTree.ExpressionStatement;
      const written = statement.expression as ESTree.CallExpression;
      return testBlockRootName(written.callee);
    });

    it("is not a modified block", ({ rootName }) => {
      expect(rootName).toBe(null);
    });
  });
});

describe("testBlockRootIdentifier", () => {
  describe("a modifier in front of the block", () => {
    const it = test.extend("rootIdentifier", () => {
      const statement = parseSync("spec.ts", 'it.skip("names a behaviour", () => {});').program
        .body[0] as ESTree.ExpressionStatement;
      const written = statement.expression as ESTree.CallExpression;
      return testBlockRootIdentifier(written.callee);
    });

    it("hands the root back as the identifier the declaration is written with", ({
      rootIdentifier,
    }) => {
      expect(rootIdentifier).toStrictEqual({
        type: "Identifier",
        start: 0,
        end: 2,
        decorators: [],
        name: "it",
        optional: false,
        typeAnnotation: null,
      });
    });
  });

  describe("a declaration with no reachable root", () => {
    const it = test.extend("rootIdentifier", () => {
      const statement = parseSync("spec.ts", "test.extend({ subject: 1 });").program
        .body[0] as ESTree.ExpressionStatement;
      const written = statement.expression as ESTree.CallExpression;
      return testBlockRootIdentifier(written.callee);
    });

    it("hands back nothing to rename", ({ rootIdentifier }) => {
      expect(rootIdentifier).toBe(null);
    });
  });
});
