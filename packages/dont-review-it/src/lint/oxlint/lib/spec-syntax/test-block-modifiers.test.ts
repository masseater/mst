import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import {
  testBlockModifiersOf,
  testBlockRootIdentifier,
  testBlockRootName,
} from "./test-block-modifiers.ts";

import type { ESTree } from "@oxlint/plugins";

const CHAINED_MODIFIERS = [
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
];

const it = test
  .extend("modifierNamesOfEveryModifierTheRunnerChains", () =>
    CHAINED_MODIFIERS.flatMap((chained) => {
      const statement = parseSync("spec.ts", `it.${chained}("names a behaviour", () => {});`)
        .program.body[0] as ESTree.ExpressionStatement;
      const written = statement.expression as ESTree.CallExpression;
      return testBlockModifiersOf(written.callee).map((modifier) => modifier.name);
    }))
  .extend("modifierNamesOfExtend", () => {
    const statement = parseSync("spec.ts", 'it.extend("names a behaviour", () => {});').program
      .body[0] as ESTree.ExpressionStatement;
    const written = statement.expression as ESTree.CallExpression;
    return testBlockModifiersOf(written.callee).map((modifier) => modifier.name);
  })
  .extend("modifierNamesOfOverride", () => {
    const statement = parseSync("spec.ts", 'it.override("names a behaviour", () => {});').program
      .body[0] as ESTree.ExpressionStatement;
    const written = statement.expression as ESTree.CallExpression;
    return testBlockModifiersOf(written.callee).map((modifier) => modifier.name);
  })
  .extend("modifierNamesOfScoped", () => {
    const statement = parseSync("spec.ts", 'it.scoped("names a behaviour", () => {});').program
      .body[0] as ESTree.ExpressionStatement;
    const written = statement.expression as ESTree.CallExpression;
    return testBlockModifiersOf(written.callee).map((modifier) => modifier.name);
  })
  .extend("rootNameOfABareItDeclaration", () => {
    const statement = parseSync("spec.ts", 'it("names a behaviour", () => {});').program
      .body[0] as ESTree.ExpressionStatement;
    const written = statement.expression as ESTree.CallExpression;
    return testBlockRootName(written.callee);
  })
  .extend("rootNameOfABareTestDeclaration", () => {
    const statement = parseSync("spec.ts", 'test("names a behaviour", () => {});').program
      .body[0] as ESTree.ExpressionStatement;
    const written = statement.expression as ESTree.CallExpression;
    return testBlockRootName(written.callee);
  })
  .extend("rootNameOfASkippedBlock", () => {
    const statement = parseSync("spec.ts", 'it.skip("names a behaviour", () => {});').program
      .body[0] as ESTree.ExpressionStatement;
    const written = statement.expression as ESTree.CallExpression;
    return testBlockRootName(written.callee);
  })
  .extend("rootNameOfAConcurrentGroup", () => {
    const statement = parseSync("spec.ts", 'describe.concurrent("names a group", () => {});')
      .program.body[0] as ESTree.ExpressionStatement;
    const written = statement.expression as ESTree.CallExpression;
    return testBlockRootName(written.callee);
  })
  .extend("rootNameOfStackedModifiers", () => {
    const statement = parseSync(
      "spec.ts",
      'it.skipIf(slow).concurrent("names a behaviour", () => {});',
    ).program.body[0] as ESTree.ExpressionStatement;
    const written = statement.expression as ESTree.CallExpression;
    return testBlockRootName(written.callee);
  })
  .extend("rootNameOfAModifierWrittenAsAStringSubscript", () => {
    const statement = parseSync("spec.ts", 'it["skip"]("names a behaviour", () => {});').program
      .body[0] as ESTree.ExpressionStatement;
    const written = statement.expression as ESTree.CallExpression;
    return testBlockRootName(written.callee);
  })
  .extend("rootNameOfAModifierChosenAtRunTime", () => {
    const statement = parseSync("spec.ts", 'it[chosen]("names a behaviour", () => {});').program
      .body[0] as ESTree.ExpressionStatement;
    const written = statement.expression as ESTree.CallExpression;
    return testBlockRootName(written.callee);
  })
  .extend("rootNameOfATableDrivenBlock", () => {
    const statement = parseSync("spec.ts", 'it.each(rows)("names a behaviour", (row) => {});')
      .program.body[0] as ESTree.ExpressionStatement;
    const written = statement.expression as ESTree.CallExpression;
    return testBlockRootName(written.callee);
  })
  .extend("rootNameOfATableWrittenAsATaggedTemplate", () => {
    const statement = parseSync("spec.ts", "it.each`a | b`;").program
      .body[0] as ESTree.ExpressionStatement;
    const written = statement.expression as ESTree.TaggedTemplateExpression;
    return testBlockRootName(written.tag);
  })
  .extend("rootNameOfABlockCalledThroughATaggedTable", () => {
    const statement = parseSync("spec.ts", 'it.each`a | b`("names a behaviour", () => {});').program
      .body[0] as ESTree.ExpressionStatement;
    const written = statement.expression as ESTree.CallExpression;
    return testBlockRootName(written.callee);
  })
  .extend("rootNameOfACalleeThatIsNeitherANameACallNorAMember", () => {
    const statement = parseSync("spec.ts", 'this("names a behaviour");').program
      .body[0] as ESTree.ExpressionStatement;
    const written = statement.expression as ESTree.CallExpression;
    return testBlockRootName(written.callee);
  })
  .extend("rootNameOfTestExtend", () => {
    const statement = parseSync("spec.ts", "test.extend({ subject: 1 });").program
      .body[0] as ESTree.ExpressionStatement;
    const written = statement.expression as ESTree.CallExpression;
    return testBlockRootName(written.callee);
  })
  .extend("rootNameOfItExtend", () => {
    const statement = parseSync("spec.ts", "it.extend({ subject: 1 });").program
      .body[0] as ESTree.ExpressionStatement;
    const written = statement.expression as ESTree.CallExpression;
    return testBlockRootName(written.callee);
  })
  .extend("rootNameOfABlockDerivedFromAFixtureFactory", () => {
    const statement = parseSync(
      "spec.ts",
      'test.extend({ subject: 1 })("names a behaviour", () => {});',
    ).program.body[0] as ESTree.ExpressionStatement;
    const written = statement.expression as ESTree.CallExpression;
    return testBlockRootName(written.callee);
  })
  .extend("rootNameOfAMemberCallOnAReceiver", () => {
    const statement = parseSync("spec.ts", 'suite.it("names a behaviour", () => {});').program
      .body[0] as ESTree.ExpressionStatement;
    const written = statement.expression as ESTree.CallExpression;
    return testBlockRootName(written.callee);
  })
  .extend("rootIdentifierOfASkippedBlock", () => {
    const statement = parseSync("spec.ts", 'it.skip("names a behaviour", () => {});').program
      .body[0] as ESTree.ExpressionStatement;
    const written = statement.expression as ESTree.CallExpression;
    return testBlockRootIdentifier(written.callee);
  })
  .extend("rootIdentifierOfADeclarationWithNoReachableRoot", () => {
    const statement = parseSync("spec.ts", "test.extend({ subject: 1 });").program
      .body[0] as ESTree.ExpressionStatement;
    const written = statement.expression as ESTree.CallExpression;
    return testBlockRootIdentifier(written.callee);
  })
  .extend("modifierNamesOfABareBlockDeclaration", () => {
    const statement = parseSync("spec.ts", 'it("names a behaviour", () => {});').program
      .body[0] as ESTree.ExpressionStatement;
    const written = statement.expression as ESTree.CallExpression;
    return testBlockModifiersOf(written.callee).map((modifier) => modifier.name);
  })
  .extend("modifierNamesOfASkippedBlock", () => {
    const statement = parseSync("spec.ts", 'it.skip("names a behaviour", () => {});').program
      .body[0] as ESTree.ExpressionStatement;
    const written = statement.expression as ESTree.CallExpression;
    return testBlockModifiersOf(written.callee).map((modifier) => modifier.name);
  })
  .extend("modifierNamesOfStackedModifiers", () => {
    const statement = parseSync("spec.ts", 'it.skip.each(rows)("names a behaviour", (row) => {});')
      .program.body[0] as ESTree.ExpressionStatement;
    const written = statement.expression as ESTree.CallExpression;
    return testBlockModifiersOf(written.callee).map((modifier) => modifier.name);
  })
  .extend("modifierNamesOfAModifierWrittenAsAStringSubscript", () => {
    const statement = parseSync("spec.ts", 'it["skip"]("names a behaviour", () => {});').program
      .body[0] as ESTree.ExpressionStatement;
    const written = statement.expression as ESTree.CallExpression;
    return testBlockModifiersOf(written.callee).map((modifier) => modifier.name);
  })
  .extend("modifierNamesOfAModifierChosenAtRunTime", () => {
    const statement = parseSync("spec.ts", 'it[chosen]("names a behaviour", () => {});').program
      .body[0] as ESTree.ExpressionStatement;
    const written = statement.expression as ESTree.CallExpression;
    return testBlockModifiersOf(written.callee).map((modifier) => modifier.name);
  })
  .extend("modifierNamesOfABlockDerivedFromAFixtureFactory", () => {
    const statement = parseSync(
      "spec.ts",
      'test.extend({ subject: 1 })("names a behaviour", () => {});',
    ).program.body[0] as ESTree.ExpressionStatement;
    const written = statement.expression as ESTree.CallExpression;
    return testBlockModifiersOf(written.callee).map((modifier) => modifier.name);
  })
  .extend("handedShapesOfAModifierHandedANamedTable", () => {
    const statement = parseSync("spec.ts", 'it.each(rows)("names a behaviour", (row) => {});')
      .program.body[0] as ESTree.ExpressionStatement;
    const written = statement.expression as ESTree.CallExpression;
    return testBlockModifiersOf(written.callee).map(
      (modifier) => modifier.handed?.map((held) => held.type) ?? null,
    );
  })
  .extend("handedShapesOfAModifierHandedAWrittenTable", () => {
    const statement = parseSync("spec.ts", 'it.each([1, 2])("names a behaviour", (row) => {});')
      .program.body[0] as ESTree.ExpressionStatement;
    const written = statement.expression as ESTree.CallExpression;
    return testBlockModifiersOf(written.callee).map(
      (modifier) => modifier.handed?.map((held) => held.type) ?? null,
    );
  })
  .extend("handedShapesOfAModifierWrittenWithoutAnArgumentList", () => {
    const statement = parseSync("spec.ts", 'it.skip("names a behaviour", () => {});').program
      .body[0] as ESTree.ExpressionStatement;
    const written = statement.expression as ESTree.CallExpression;
    return testBlockModifiersOf(written.callee).map(
      (modifier) => modifier.handed?.map((held) => held.type) ?? null,
    );
  })
  .extend("handedShapesOfATableSpreadIntoTheModifier", () => {
    const statement = parseSync("spec.ts", 'it.each(...tables)("names a behaviour", (row) => {});')
      .program.body[0] as ESTree.ExpressionStatement;
    const written = statement.expression as ESTree.CallExpression;
    return testBlockModifiersOf(written.callee).map(
      (modifier) => modifier.handed?.map((held) => held.type) ?? null,
    );
  })
  .extend("handedShapesOfATableWrittenAsATaggedTemplate", () => {
    const statement = parseSync("spec.ts", 'it.each`a | b`("names a behaviour", () => {});').program
      .body[0] as ESTree.ExpressionStatement;
    const written = statement.expression as ESTree.CallExpression;
    return testBlockModifiersOf(written.callee).map(
      (modifier) => modifier.handed?.map((held) => held.type) ?? null,
    );
  })
  .extend("handedShapesOfAConcurrentBlockCarryingItsOwnArguments", () => {
    const statement = parseSync("spec.ts", 'it.concurrent("names a behaviour", () => {});').program
      .body[0] as ESTree.ExpressionStatement;
    const written = statement.expression as ESTree.CallExpression;
    return testBlockModifiersOf(written.callee).map(
      (modifier) => modifier.handed?.map((held) => held.type) ?? null,
    );
  });

describe("dont-review-it/spec-syntax/test-block-modifiers", () => {
  it("every modifier the runner chains onto a block is named as a modifier", ({
    modifierNamesOfEveryModifierTheRunnerChains,
  }) => {
    expect(modifierNamesOfEveryModifierTheRunnerChains).toStrictEqual(CHAINED_MODIFIERS);
  });

  it("the fixture builder spelling is not a modifier", ({ modifierNamesOfExtend }) => {
    expect(modifierNamesOfExtend).toStrictEqual([]);
  });

  it("the fixture override spelling is not a modifier", ({ modifierNamesOfOverride }) => {
    expect(modifierNamesOfOverride).toStrictEqual([]);
  });

  it("the fixture scoping spelling is not a modifier", ({ modifierNamesOfScoped }) => {
    expect(modifierNamesOfScoped).toStrictEqual([]);
  });

  it("a bare block declaration is rooted at the identifier it is written with", ({
    rootNameOfABareItDeclaration,
  }) => {
    expect(rootNameOfABareItDeclaration).toBe("it");
  });

  it("a bare block declaration written with the other spelling is rooted at that spelling", ({
    rootNameOfABareTestDeclaration,
  }) => {
    expect(rootNameOfABareTestDeclaration).toBe("test");
  });

  it("a modifier in front of the block leaves the root where it was", ({
    rootNameOfASkippedBlock,
  }) => {
    expect(rootNameOfASkippedBlock).toBe("it");
  });

  it("a modifier in front of a grouping block leaves that root where it was", ({
    rootNameOfAConcurrentGroup,
  }) => {
    expect(rootNameOfAConcurrentGroup).toBe("describe");
  });

  it("modifiers stacked on top of each other still reach the same root", ({
    rootNameOfStackedModifiers,
  }) => {
    expect(rootNameOfStackedModifiers).toBe("it");
  });

  it("a modifier written as a string subscript reaches the same root", ({
    rootNameOfAModifierWrittenAsAStringSubscript,
  }) => {
    expect(rootNameOfAModifierWrittenAsAStringSubscript).toBe("it");
  });

  it("a modifier chosen at run time hides the root from this reading", ({
    rootNameOfAModifierChosenAtRunTime,
  }) => {
    expect(rootNameOfAModifierChosenAtRunTime).toBe(null);
  });

  it("a table-driven block reaches its root through the call the table returns", ({
    rootNameOfATableDrivenBlock,
  }) => {
    expect(rootNameOfATableDrivenBlock).toBe("it");
  });

  it("a table written as a tagged template reaches the same root", ({
    rootNameOfATableWrittenAsATaggedTemplate,
  }) => {
    expect(rootNameOfATableWrittenAsATaggedTemplate).toBe("it");
  });

  it("a block called through the function a tagged table returns reaches the same root", ({
    rootNameOfABlockCalledThroughATaggedTable,
  }) => {
    expect(rootNameOfABlockCalledThroughATaggedTable).toBe("it");
  });

  it("a callee that is neither a name, a call nor a member reaches no root", ({
    rootNameOfACalleeThatIsNeitherANameACallNorAMember,
  }) => {
    expect(rootNameOfACalleeThatIsNeitherANameACallNorAMember).toBe(null);
  });

  it("a fixture factory built on the other spelling is not a modified block", ({
    rootNameOfTestExtend,
  }) => {
    expect(rootNameOfTestExtend).toBe(null);
  });

  it("a fixture factory built on the block spelling is not a modified block either", ({
    rootNameOfItExtend,
  }) => {
    expect(rootNameOfItExtend).toBe(null);
  });

  it("a block derived from a fixture factory is rooted at nothing this reading can name", ({
    rootNameOfABlockDerivedFromAFixtureFactory,
  }) => {
    expect(rootNameOfABlockDerivedFromAFixtureFactory).toBe(null);
  });

  it("a member call on a receiver is not a modified block", ({
    rootNameOfAMemberCallOnAReceiver,
  }) => {
    expect(rootNameOfAMemberCallOnAReceiver).toBe(null);
  });

  it("the root is handed back as the identifier the declaration is written with", ({
    rootIdentifierOfASkippedBlock,
  }) => {
    expect(rootIdentifierOfASkippedBlock).toStrictEqual({
      type: "Identifier",
      start: 0,
      end: 2,
      decorators: [],
      name: "it",
      optional: false,
      typeAnnotation: null,
    });
  });

  it("a declaration with no reachable root hands back nothing to rename", ({
    rootIdentifierOfADeclarationWithNoReachableRoot,
  }) => {
    expect(rootIdentifierOfADeclarationWithNoReachableRoot).toBe(null);
  });

  it("a bare block declaration carries no modifier", ({ modifierNamesOfABareBlockDeclaration }) => {
    expect(modifierNamesOfABareBlockDeclaration).toStrictEqual([]);
  });

  it("a modifier in front of the block is read under the name it is spelled with", ({
    modifierNamesOfASkippedBlock,
  }) => {
    expect(modifierNamesOfASkippedBlock).toStrictEqual(["skip"]);
  });

  it("modifiers stacked on top of each other are read from the outermost inwards", ({
    modifierNamesOfStackedModifiers,
  }) => {
    expect(modifierNamesOfStackedModifiers).toStrictEqual(["each", "skip"]);
  });

  it("a modifier written as a string subscript is read the same way", ({
    modifierNamesOfAModifierWrittenAsAStringSubscript,
  }) => {
    expect(modifierNamesOfAModifierWrittenAsAStringSubscript).toStrictEqual(["skip"]);
  });

  it("a modifier chosen at run time is read as no modifier at all", ({
    modifierNamesOfAModifierChosenAtRunTime,
  }) => {
    expect(modifierNamesOfAModifierChosenAtRunTime).toStrictEqual([]);
  });

  it("a name the runner does not chain onto a block stops the reading", ({
    modifierNamesOfABlockDerivedFromAFixtureFactory,
  }) => {
    expect(modifierNamesOfABlockDerivedFromAFixtureFactory).toStrictEqual([]);
  });

  it("a modifier handed a named table hands the table over with it", ({
    handedShapesOfAModifierHandedANamedTable,
  }) => {
    expect(handedShapesOfAModifierHandedANamedTable).toStrictEqual([["Identifier"]]);
  });

  it("a modifier handed a written table hands that table over with it", ({
    handedShapesOfAModifierHandedAWrittenTable,
  }) => {
    expect(handedShapesOfAModifierHandedAWrittenTable).toStrictEqual([["ArrayExpression"]]);
  });

  it("a modifier written without an argument list hands nothing over", ({
    handedShapesOfAModifierWrittenWithoutAnArgumentList,
  }) => {
    expect(handedShapesOfAModifierWrittenWithoutAnArgumentList).toStrictEqual([null]);
  });

  it("a table spread into the modifier leaves nothing to read", ({
    handedShapesOfATableSpreadIntoTheModifier,
  }) => {
    expect(handedShapesOfATableSpreadIntoTheModifier).toStrictEqual([null]);
  });

  it("a table written as a tagged template leaves nothing to read", ({
    handedShapesOfATableWrittenAsATaggedTemplate,
  }) => {
    expect(handedShapesOfATableWrittenAsATaggedTemplate).toStrictEqual([null]);
  });

  it("the arguments of the block itself belong to no modifier", ({
    handedShapesOfAConcurrentBlockCarryingItsOwnArguments,
  }) => {
    expect(handedShapesOfAConcurrentBlockCarryingItsOwnArguments).toStrictEqual([null]);
  });
});
