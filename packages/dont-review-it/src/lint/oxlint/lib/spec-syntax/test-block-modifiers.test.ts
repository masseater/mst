import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import {
  isTestBlockModifier,
  TEST_BLOCK_MODIFIERS,
  testBlockModifiersOf,
  testBlockRootIdentifier,
  testBlockRootName,
} from "./test-block-modifiers.ts";

import type { ESTree } from "@oxlint/plugins";

const declaredBlockIn = (declarationSource: string): ESTree.Expression => {
  const statement = parseSync("spec.ts", declarationSource).program.body[0] as ESTree.Statement;
  const written = (statement as ESTree.ExpressionStatement).expression;
  if (written.type === "TaggedTemplateExpression") return written.tag;
  return (written as ESTree.CallExpression).callee;
};

const rootOf = (declarationSource: string): string | null =>
  testBlockRootName(declaredBlockIn(declarationSource));

const modifierNamesIn = (declarationSource: string): readonly string[] =>
  testBlockModifiersOf(declaredBlockIn(declarationSource)).map((modifier) => modifier.name);

const handedShapesIn = (declarationSource: string): readonly (readonly string[] | null)[] =>
  testBlockModifiersOf(declaredBlockIn(declarationSource)).map(
    (modifier) => modifier.handed?.map((held) => held.type) ?? null,
  );

describe("dont-review-it/spec-syntax/test-block-modifiers", () => {
  test("every modifier the runner chains onto a block is named as a modifier", () => {
    expect([...TEST_BLOCK_MODIFIERS].toSorted()).toStrictEqual([
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

  test("a name the runner does not chain onto a block is not a modifier", () => {
    expect(isTestBlockModifier("extend")).toBe(false);
    expect(isTestBlockModifier("override")).toBe(false);
    expect(isTestBlockModifier("scoped")).toBe(false);
  });

  test("a bare block declaration is rooted at the identifier it is written with", () => {
    expect(rootOf('it("names a behaviour", () => {});')).toBe("it");
    expect(rootOf('test("names a behaviour", () => {});')).toBe("test");
  });

  test("a modifier in front of the block leaves the root where it was", () => {
    expect(rootOf('it.skip("names a behaviour", () => {});')).toBe("it");
    expect(rootOf('describe.concurrent("names a group", () => {});')).toBe("describe");
  });

  test("modifiers stacked on top of each other still reach the same root", () => {
    expect(rootOf('it.skipIf(slow).concurrent("names a behaviour", () => {});')).toBe("it");
  });

  test("a modifier written as a string subscript reaches the same root", () => {
    expect(rootOf('it["skip"]("names a behaviour", () => {});')).toBe("it");
  });

  test("a modifier chosen at run time hides the root from this reading", () => {
    expect(rootOf('it[chosen]("names a behaviour", () => {});')).toBe(null);
  });

  test("a table-driven block reaches its root through the call the table returns", () => {
    expect(rootOf('it.each(rows)("names a behaviour", (row) => {});')).toBe("it");
  });

  test("a table written as a tagged template reaches the same root", () => {
    expect(rootOf("it.each`a | b`;")).toBe("it");
  });

  test("a block called through the function a tagged table returns reaches the same root", () => {
    expect(rootOf('it.each`a | b`("names a behaviour", () => {});')).toBe("it");
  });

  test("a callee that is neither a name, a call nor a member reaches no root", () => {
    expect(rootOf('this("names a behaviour");')).toBe(null);
  });

  test("a fixture factory is not a modified block, so its root is out of reach", () => {
    expect(rootOf("test.extend({ subject: 1 });")).toBe(null);
    expect(rootOf("it.extend({ subject: 1 });")).toBe(null);
  });

  test("a block derived from a fixture factory is rooted at nothing this reading can name", () => {
    expect(rootOf('test.extend({ subject: 1 })("names a behaviour", () => {});')).toBe(null);
  });

  test("a member call on a receiver is not a modified block", () => {
    expect(rootOf('suite.it("names a behaviour", () => {});')).toBe(null);
  });

  test("the root is handed back as the identifier the declaration is written with", () => {
    const root = testBlockRootIdentifier(
      declaredBlockIn('it.skip("names a behaviour", () => {});'),
    );
    expect(root?.type).toBe("Identifier");
  });

  test("a declaration with no reachable root hands back nothing to rename", () => {
    expect(testBlockRootIdentifier(declaredBlockIn("test.extend({ subject: 1 });"))).toBe(null);
  });

  test("a bare block declaration carries no modifier", () => {
    expect(modifierNamesIn('it("names a behaviour", () => {});')).toStrictEqual([]);
  });

  test("a modifier in front of the block is read under the name it is spelled with", () => {
    expect(modifierNamesIn('it.skip("names a behaviour", () => {});')).toStrictEqual(["skip"]);
  });

  test("modifiers stacked on top of each other are read from the outermost inwards", () => {
    expect(modifierNamesIn('it.skip.each(rows)("names a behaviour", (row) => {});')).toStrictEqual([
      "each",
      "skip",
    ]);
  });

  test("a modifier written as a string subscript is read the same way", () => {
    expect(modifierNamesIn('it["skip"]("names a behaviour", () => {});')).toStrictEqual(["skip"]);
  });

  test("a modifier chosen at run time is read as no modifier at all", () => {
    expect(modifierNamesIn('it[chosen]("names a behaviour", () => {});')).toStrictEqual([]);
  });

  test("a name the runner does not chain onto a block stops the reading", () => {
    expect(
      modifierNamesIn('test.extend({ subject: 1 })("names a behaviour", () => {});'),
    ).toStrictEqual([]);
  });

  test("a modifier handed a table hands the table over with it", () => {
    expect(handedShapesIn('it.each(rows)("names a behaviour", (row) => {});')).toStrictEqual([
      ["Identifier"],
    ]);
    expect(handedShapesIn('it.each([1, 2])("names a behaviour", (row) => {});')).toStrictEqual([
      ["ArrayExpression"],
    ]);
  });

  test("a modifier written without an argument list hands nothing over", () => {
    expect(handedShapesIn('it.skip("names a behaviour", () => {});')).toStrictEqual([null]);
  });

  test("a table spread into the modifier leaves nothing to read", () => {
    expect(handedShapesIn('it.each(...tables)("names a behaviour", (row) => {});')).toStrictEqual([
      null,
    ]);
  });

  test("a table written as a tagged template leaves nothing to read", () => {
    expect(handedShapesIn('it.each`a | b`("names a behaviour", () => {});')).toStrictEqual([null]);
  });

  test("the arguments of the block itself belong to no modifier", () => {
    expect(handedShapesIn('it.concurrent("names a behaviour", () => {});')).toStrictEqual([null]);
  });
});
