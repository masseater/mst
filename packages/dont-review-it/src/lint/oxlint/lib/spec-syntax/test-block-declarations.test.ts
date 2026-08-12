import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import {
  assertionEntryRootNames,
  carriesSpelledTitle,
  declaresTestBlock,
  groupingBlockRootNames,
  runnerRootedTestBlockRootNames,
  testBlockBodyOf,
  testBlockRootNames,
  testCallbacksOf,
} from "./test-block-declarations.ts";

import type { ESTree } from "@oxlint/plugins";

const it = test
  .extend("declarationOfAnInjectedBlockSpelling", () => {
    const program = {
      type: "Program",
      body: parseSync("spec.ts", 'it("names a behaviour", () => {});').program.body,
    } as ESTree.Program;
    const last = program.body.at(-1) as ESTree.ExpressionStatement;
    return declaresTestBlock(last.expression as ESTree.CallExpression, testBlockRootNames(program));
  })
  .extend("declarationOfTheOtherInjectedBlockSpelling", () => {
    const program = {
      type: "Program",
      body: parseSync("spec.ts", 'test("names a behaviour", () => {});').program.body,
    } as ESTree.Program;
    const last = program.body.at(-1) as ESTree.ExpressionStatement;
    return declaresTestBlock(last.expression as ESTree.CallExpression, testBlockRootNames(program));
  })
  .extend("declarationOfASkippedBlock", () => {
    const program = {
      type: "Program",
      body: parseSync("spec.ts", 'it.skip("names a behaviour", () => {});').program.body,
    } as ESTree.Program;
    const last = program.body.at(-1) as ESTree.ExpressionStatement;
    return declaresTestBlock(last.expression as ESTree.CallExpression, testBlockRootNames(program));
  })
  .extend("declarationOfATableDrivenBlock", () => {
    const program = {
      type: "Program",
      body: parseSync("spec.ts", 'it.each(rows)("names a behaviour", (row) => {});').program.body,
    } as ESTree.Program;
    const last = program.body.at(-1) as ESTree.ExpressionStatement;
    return declaresTestBlock(last.expression as ESTree.CallExpression, testBlockRootNames(program));
  })
  .extend("declarationOfAGroupingBlock", () => {
    const program = {
      type: "Program",
      body: parseSync("spec.ts", 'describe("names a group", () => {});').program.body,
    } as ESTree.Program;
    const last = program.body.at(-1) as ESTree.ExpressionStatement;
    return declaresTestBlock(last.expression as ESTree.CallExpression, testBlockRootNames(program));
  })
  .extend("declarationOfACallReachedThroughAReceiver", () => {
    const program = {
      type: "Program",
      body: parseSync("spec.ts", 'suite.it("names a behaviour", () => {});').program.body,
    } as ESTree.Program;
    const last = program.body.at(-1) as ESTree.ExpressionStatement;
    return declaresTestBlock(last.expression as ESTree.CallExpression, testBlockRootNames(program));
  })
  .extend("declarationOfAFixtureFactory", () => {
    const program = {
      type: "Program",
      body: parseSync("spec.ts", "test.extend({ subject: 1 });").program.body,
    } as ESTree.Program;
    const last = program.body.at(-1) as ESTree.ExpressionStatement;
    return declaresTestBlock(last.expression as ESTree.CallExpression, testBlockRootNames(program));
  })
  .extend("declarationOfARenamedImportOfABlockSpelling", () => {
    const program = {
      type: "Program",
      body: parseSync(
        "spec.ts",
        'import { it as check } from "vitest";\ncheck("names a behaviour", () => {});',
      ).program.body,
    } as ESTree.Program;
    const last = program.body.at(-1) as ESTree.ExpressionStatement;
    return declaresTestBlock(last.expression as ESTree.CallExpression, testBlockRootNames(program));
  })
  .extend("declarationOfAnImportWrittenWithAQuotedExportName", () => {
    const program = {
      type: "Program",
      body: parseSync(
        "spec.ts",
        'import { "test" as check } from "vitest";\ncheck("names a behaviour", () => {});',
      ).program.body,
    } as ESTree.Program;
    const last = program.body.at(-1) as ESTree.ExpressionStatement;
    return declaresTestBlock(last.expression as ESTree.CallExpression, testBlockRootNames(program));
  })
  .extend("declarationOfAnImportOfSomethingOtherThanABlockSpelling", () => {
    const program = {
      type: "Program",
      body: parseSync(
        "spec.ts",
        'import { expect } from "vitest";\nexpect("names a behaviour", () => {});',
      ).program.body,
    } as ESTree.Program;
    const last = program.body.at(-1) as ESTree.ExpressionStatement;
    return declaresTestBlock(last.expression as ESTree.CallExpression, testBlockRootNames(program));
  })
  .extend("declarationOfADefaultImport", () => {
    const program = {
      type: "Program",
      body: parseSync(
        "spec.ts",
        'import runner from "vitest";\nrunner("names a behaviour", () => {});',
      ).program.body,
    } as ESTree.Program;
    const last = program.body.at(-1) as ESTree.ExpressionStatement;
    return declaresTestBlock(last.expression as ESTree.CallExpression, testBlockRootNames(program));
  })
  .extend("declarationOfANamespaceImport", () => {
    const program = {
      type: "Program",
      body: parseSync(
        "spec.ts",
        'import * as runner from "vitest";\nrunner("names a behaviour", () => {});',
      ).program.body,
    } as ESTree.Program;
    const last = program.body.at(-1) as ESTree.ExpressionStatement;
    return declaresTestBlock(last.expression as ESTree.CallExpression, testBlockRootNames(program));
  })
  .extend("declarationOfALocalBindingOfABlockSpelling", () => {
    const program = {
      type: "Program",
      body: parseSync("spec.ts", 'const check = it;\ncheck("names a behaviour", () => {});').program
        .body,
    } as ESTree.Program;
    const last = program.body.at(-1) as ESTree.ExpressionStatement;
    return declaresTestBlock(last.expression as ESTree.CallExpression, testBlockRootNames(program));
  })
  .extend("declarationOfABuilderDerivedFromTheBase", () => {
    const program = {
      type: "Program",
      body: parseSync(
        "spec.ts",
        'const check = test.extend({ subject: 1 });\ncheck("names a behaviour", () => {});',
      ).program.body,
    } as ESTree.Program;
    const last = program.body.at(-1) as ESTree.ExpressionStatement;
    return declaresTestBlock(last.expression as ESTree.CallExpression, testBlockRootNames(program));
  })
  .extend("declarationOfABuilderDerivedFromAnotherBuilder", () => {
    const program = {
      type: "Program",
      body: parseSync(
        "spec.ts",
        'const check = test.extend({ port: 1 }).extend({ subject: 2 });\ncheck("names a behaviour", () => {});',
      ).program.body,
    } as ESTree.Program;
    const last = program.body.at(-1) as ESTree.ExpressionStatement;
    return declaresTestBlock(last.expression as ESTree.CallExpression, testBlockRootNames(program));
  })
  .extend("declarationOfABindingTakenFromABindingDerivedEarlier", () => {
    const program = {
      type: "Program",
      body: parseSync(
        "spec.ts",
        'const base = test.extend({ subject: 1 });\nconst check = base;\ncheck("names a behaviour", () => {});',
      ).program.body,
    } as ESTree.Program;
    const last = program.body.at(-1) as ESTree.ExpressionStatement;
    return declaresTestBlock(last.expression as ESTree.CallExpression, testBlockRootNames(program));
  })
  .extend("declarationOfAMemberThatIsNotTheBuilder", () => {
    const program = {
      type: "Program",
      body: parseSync(
        "spec.ts",
        'const check = test.override({ subject: 1 });\ncheck("names a behaviour", () => {});',
      ).program.body,
    } as ESTree.Program;
    const last = program.body.at(-1) as ESTree.ExpressionStatement;
    return declaresTestBlock(last.expression as ESTree.CallExpression, testBlockRootNames(program));
  })
  .extend("declarationOfABindingInitialisedByAPlainCall", () => {
    const program = {
      type: "Program",
      body: parseSync("spec.ts", 'const check = build();\ncheck("names a behaviour", () => {});')
        .program.body,
    } as ESTree.Program;
    const last = program.body.at(-1) as ESTree.ExpressionStatement;
    return declaresTestBlock(last.expression as ESTree.CallExpression, testBlockRootNames(program));
  })
  .extend("declarationOfABindingInitialisedByAValueThatIsNoCall", () => {
    const program = {
      type: "Program",
      body: parseSync("spec.ts", 'const port = 3000;\nport("names a behaviour", () => {});').program
        .body,
    } as ESTree.Program;
    const last = program.body.at(-1) as ESTree.ExpressionStatement;
    return declaresTestBlock(last.expression as ESTree.CallExpression, testBlockRootNames(program));
  })
  .extend("declarationOfABindingTakenApartFromAnObject", () => {
    const program = {
      type: "Program",
      body: parseSync(
        "spec.ts",
        'const { it: check } = runner;\ncheck("names a behaviour", () => {});',
      ).program.body,
    } as ESTree.Program;
    const last = program.body.at(-1) as ESTree.ExpressionStatement;
    return declaresTestBlock(last.expression as ESTree.CallExpression, testBlockRootNames(program));
  })
  .extend("declarationOfABindingDeclaredWithoutAnInitialiser", () => {
    const program = {
      type: "Program",
      body: parseSync("spec.ts", 'let check;\ncheck("names a behaviour", () => {});').program.body,
    } as ESTree.Program;
    const last = program.body.at(-1) as ESTree.ExpressionStatement;
    return declaresTestBlock(last.expression as ESTree.CallExpression, testBlockRootNames(program));
  })
  .extend("groupDeclarationOfTheInjectedGroupingSpelling", () => {
    const program = {
      type: "Program",
      body: parseSync("spec.ts", 'describe("names a group", () => {});').program.body,
    } as ESTree.Program;
    const last = program.body.at(-1) as ESTree.ExpressionStatement;
    return declaresTestBlock(
      last.expression as ESTree.CallExpression,
      groupingBlockRootNames(program),
    );
  })
  .extend("groupDeclarationOfATableDrivenGroup", () => {
    const program = {
      type: "Program",
      body: parseSync("spec.ts", 'describe.each(rows)("names a group", (row) => {});').program.body,
    } as ESTree.Program;
    const last = program.body.at(-1) as ESTree.ExpressionStatement;
    return declaresTestBlock(
      last.expression as ESTree.CallExpression,
      groupingBlockRootNames(program),
    );
  })
  .extend("groupDeclarationOfATestBlock", () => {
    const program = {
      type: "Program",
      body: parseSync("spec.ts", 'it("names a behaviour", () => {});').program.body,
    } as ESTree.Program;
    const last = program.body.at(-1) as ESTree.ExpressionStatement;
    return declaresTestBlock(
      last.expression as ESTree.CallExpression,
      groupingBlockRootNames(program),
    );
  })
  .extend("groupDeclarationOfTheOtherTestBlockSpelling", () => {
    const program = {
      type: "Program",
      body: parseSync("spec.ts", 'test("names a behaviour", () => {});').program.body,
    } as ESTree.Program;
    const last = program.body.at(-1) as ESTree.ExpressionStatement;
    return declaresTestBlock(
      last.expression as ESTree.CallExpression,
      groupingBlockRootNames(program),
    );
  })
  .extend("groupDeclarationOfARenamedImportOfTheGroupingSpelling", () => {
    const program = {
      type: "Program",
      body: parseSync(
        "spec.ts",
        'import { describe as group } from "vitest";\ngroup("a group", () => {});',
      ).program.body,
    } as ESTree.Program;
    const last = program.body.at(-1) as ESTree.ExpressionStatement;
    return declaresTestBlock(
      last.expression as ESTree.CallExpression,
      groupingBlockRootNames(program),
    );
  })
  .extend("groupDeclarationOfALocalBindingOfTheGroupingSpelling", () => {
    const program = {
      type: "Program",
      body: parseSync("spec.ts", 'const group = describe;\ngroup("a group", () => {});').program
        .body,
    } as ESTree.Program;
    const last = program.body.at(-1) as ESTree.ExpressionStatement;
    return declaresTestBlock(
      last.expression as ESTree.CallExpression,
      groupingBlockRootNames(program),
    );
  })
  .extend("assertionEntryNamesBesideAPlainBinding", () => {
    const program = {
      type: "Program",
      body: parseSync("spec.ts", "const port = 3000;").program.body,
    } as ESTree.Program;
    return assertionEntryRootNames(program);
  })
  .extend("assertionEntryNamesBesideARenamedImport", () => {
    const program = {
      type: "Program",
      body: parseSync("spec.ts", 'import { expect as assertThat } from "vitest";').program.body,
    } as ESTree.Program;
    return assertionEntryRootNames(program);
  })
  .extend("assertionEntryNamesBesideALocalBinding", () => {
    const program = {
      type: "Program",
      body: parseSync("spec.ts", "const assertThat = expect;").program.body,
    } as ESTree.Program;
    return assertionEntryRootNames(program);
  })
  .extend("assertionEntryNamesBesideATestBlockSpelling", () => {
    const program = {
      type: "Program",
      body: parseSync("spec.ts", "const check = it;").program.body,
    } as ESTree.Program;
    return assertionEntryRootNames(program);
  })
  .extend("runnerRootedNamesBesideAPlainBinding", () => {
    const program = {
      type: "Program",
      body: parseSync("spec.ts", "const port = 3000;").program.body,
    } as ESTree.Program;
    return runnerRootedTestBlockRootNames(program);
  })
  .extend("runnerRootedNamesBesideARenamedRunnerImport", () => {
    const program = {
      type: "Program",
      body: parseSync("spec.ts", 'import { it as check } from "vitest";').program.body,
    } as ESTree.Program;
    return runnerRootedTestBlockRootNames(program);
  })
  .extend("runnerRootedNamesBesideAnImportFromAnotherModule", () => {
    const program = {
      type: "Program",
      body: parseSync("spec.ts", 'import { it } from "./runner.ts";').program.body,
    } as ESTree.Program;
    return runnerRootedTestBlockRootNames(program);
  })
  .extend("runnerRootedNamesBesideABindingDerivedFromTheRunner", () => {
    const program = {
      type: "Program",
      body: parseSync("spec.ts", "const it = test.extend({ subject: 1 });").program.body,
    } as ESTree.Program;
    return runnerRootedTestBlockRootNames(program);
  })
  .extend("runnerRootedNamesBesideABindingReachingNoRunner", () => {
    const program = {
      type: "Program",
      body: parseSync("spec.ts", "const it = buildRunner();").program.body,
    } as ESTree.Program;
    return runnerRootedTestBlockRootNames(program);
  })
  .extend("runnerRootedNamesBesideAFunctionDeclarationTakingASpelling", () => {
    const program = {
      type: "Program",
      body: parseSync("spec.ts", "function it(title, body) {}").program.body,
    } as ESTree.Program;
    return runnerRootedTestBlockRootNames(program);
  })
  .extend("runnerRootedNamesBesideAFunctionDeclaredWithoutAName", () => {
    const program = {
      type: "Program",
      body: parseSync("spec.ts", "export default function () {}").program.body,
    } as ESTree.Program;
    return runnerRootedTestBlockRootNames(program);
  })
  .extend("runnerRootedNamesBesideABindingTakenApartFromAnObject", () => {
    const program = {
      type: "Program",
      body: parseSync("spec.ts", "const { it } = runner;").program.body,
    } as ESTree.Program;
    return runnerRootedTestBlockRootNames(program);
  })
  .extend("runnerRootedNamesBesideABindingDeclaredWithoutAnInitialiser", () => {
    const program = {
      type: "Program",
      body: parseSync("spec.ts", "let it;").program.body,
    } as ESTree.Program;
    return runnerRootedTestBlockRootNames(program);
  })
  .extend("callbackShapesOfAnArrowHandedToABlock", () => {
    const statement = parseSync("spec.ts", 'it("names a behaviour", () => {});').program
      .body[0] as ESTree.ExpressionStatement;
    const written = statement.expression as ESTree.CallExpression;
    return testCallbacksOf(written).map((callback) => callback.type);
  })
  .extend("callbackShapesOfAFunctionExpressionHandedToABlock", () => {
    const statement = parseSync("spec.ts", 'it("names a behaviour", function () {});').program
      .body[0] as ESTree.ExpressionStatement;
    const written = statement.expression as ESTree.CallExpression;
    return testCallbacksOf(written).map((callback) => callback.type);
  })
  .extend("callbackShapesOfAValueThatIsNoFunction", () => {
    const statement = parseSync("spec.ts", 'it("names a behaviour", 3000);').program
      .body[0] as ESTree.ExpressionStatement;
    const written = statement.expression as ESTree.CallExpression;
    return testCallbacksOf(written).map((callback) => callback.type);
  })
  .extend("callbackShapesOfAFunctionHandedThroughAWrappingCall", () => {
    const statement = parseSync("spec.ts", 'it("names a behaviour", withSetup(() => {}));').program
      .body[0] as ESTree.ExpressionStatement;
    const written = statement.expression as ESTree.CallExpression;
    return testCallbacksOf(written).map((callback) => callback.type);
  })
  .extend("callbackShapesOfACallbackSpreadIntoTheBlock", () => {
    const statement = parseSync("spec.ts", 'it("names a behaviour", ...handlers);').program
      .body[0] as ESTree.ExpressionStatement;
    const written = statement.expression as ESTree.CallExpression;
    return testCallbacksOf(written).map((callback) => callback.type);
  })
  .extend("callbackShapesOfACallbackSpreadIntoAWrappingCall", () => {
    const statement = parseSync("spec.ts", 'it("names a behaviour", withSetup(...handlers));')
      .program.body[0] as ESTree.ExpressionStatement;
    const written = statement.expression as ESTree.CallExpression;
    return testCallbacksOf(written).map((callback) => callback.type);
  })
  .extend("titleSpellingOfANameWrittenOutAsAString", () => {
    const statement = parseSync("spec.ts", 'it("names a behaviour", () => {});').program
      .body[0] as ESTree.ExpressionStatement;
    return carriesSpelledTitle(statement.expression as ESTree.CallExpression);
  })
  .extend("titleSpellingOfANameAssembledByATemplate", () => {
    const statement = parseSync("spec.ts", "it(`names ${behaviour}`, () => {});").program
      .body[0] as ESTree.ExpressionStatement;
    return carriesSpelledTitle(statement.expression as ESTree.CallExpression);
  })
  .extend("titleSpellingOfANumberName", () => {
    const statement = parseSync("spec.ts", "it(3000, () => {});").program
      .body[0] as ESTree.ExpressionStatement;
    return carriesSpelledTitle(statement.expression as ESTree.CallExpression);
  })
  .extend("titleSpellingOfANameHeldByABinding", () => {
    const statement = parseSync("spec.ts", "it(behaviour, () => {});").program
      .body[0] as ESTree.ExpressionStatement;
    return carriesSpelledTitle(statement.expression as ESTree.CallExpression);
  })
  .extend("titleSpellingOfABlockOpeningWithItsCallback", () => {
    const statement = parseSync("spec.ts", "it(() => {});").program
      .body[0] as ESTree.ExpressionStatement;
    return carriesSpelledTitle(statement.expression as ESTree.CallExpression);
  })
  .extend("titleSpellingOfABlockWhoseFirstArgumentIsSpread", () => {
    const statement = parseSync("spec.ts", "it(...declaration);").program
      .body[0] as ESTree.ExpressionStatement;
    return carriesSpelledTitle(statement.expression as ESTree.CallExpression);
  })
  .extend("titleSpellingOfABlockHandedNothing", () => {
    const statement = parseSync("spec.ts", "it();").program.body[0] as ESTree.ExpressionStatement;
    return carriesSpelledTitle(statement.expression as ESTree.CallExpression);
  })
  .extend("bodyShapeOfANamedBlockHandedAnArrow", () => {
    const program = {
      type: "Program",
      body: parseSync("spec.ts", 'it("names a behaviour", () => {});').program.body,
    } as ESTree.Program;
    const last = program.body.at(-1) as ESTree.ExpressionStatement;
    const body = testBlockBodyOf(
      last.expression as ESTree.CallExpression,
      testBlockRootNames(program),
    );
    return body === null ? null : body.type;
  })
  .extend("bodyShapeOfANamedBlockHandedAFunctionExpression", () => {
    const program = {
      type: "Program",
      body: parseSync("spec.ts", 'it("names a behaviour", function () {});').program.body,
    } as ESTree.Program;
    const last = program.body.at(-1) as ESTree.ExpressionStatement;
    const body = testBlockBodyOf(
      last.expression as ESTree.CallExpression,
      testBlockRootNames(program),
    );
    return body === null ? null : body.type;
  })
  .extend("bodyShapeOfABodyWrittenBehindAnOptionsObject", () => {
    const program = {
      type: "Program",
      body: parseSync("spec.ts", 'it("names a behaviour", { retry: 2 }, () => {}, 1000);').program
        .body,
    } as ESTree.Program;
    const last = program.body.at(-1) as ESTree.ExpressionStatement;
    const body = testBlockBodyOf(
      last.expression as ESTree.CallExpression,
      testBlockRootNames(program),
    );
    return body === null ? null : body.type;
  })
  .extend("bodyShapeOfABodyReachedThroughADerivedBuilder", () => {
    const program = {
      type: "Program",
      body: parseSync(
        "spec.ts",
        'const check = test.extend({ subject: 1 });\ncheck("a behaviour", () => {});',
      ).program.body,
    } as ESTree.Program;
    const last = program.body.at(-1) as ESTree.ExpressionStatement;
    const body = testBlockBodyOf(
      last.expression as ESTree.CallExpression,
      testBlockRootNames(program),
    );
    return body === null ? null : body.type;
  })
  .extend("bodyShapeOfABlockHandedNoCallback", () => {
    const program = {
      type: "Program",
      body: parseSync("spec.ts", 'it("names a behaviour");').program.body,
    } as ESTree.Program;
    const last = program.body.at(-1) as ESTree.ExpressionStatement;
    const body = testBlockBodyOf(
      last.expression as ESTree.CallExpression,
      testBlockRootNames(program),
    );
    return body === null ? null : body.type;
  })
  .extend("bodyShapeOfABlockWithoutASpelledTitle", () => {
    const program = {
      type: "Program",
      body: parseSync("spec.ts", "it(() => {});").program.body,
    } as ESTree.Program;
    const last = program.body.at(-1) as ESTree.ExpressionStatement;
    const body = testBlockBodyOf(
      last.expression as ESTree.CallExpression,
      testBlockRootNames(program),
    );
    return body === null ? null : body.type;
  })
  .extend("bodyShapeOfACallThatDeclaresNoTestBlock", () => {
    const program = {
      type: "Program",
      body: parseSync("spec.ts", 'describe("names a group", () => {});').program.body,
    } as ESTree.Program;
    const last = program.body.at(-1) as ESTree.ExpressionStatement;
    const body = testBlockBodyOf(
      last.expression as ESTree.CallExpression,
      testBlockRootNames(program),
    );
    return body === null ? null : body.type;
  });

describe("dont-review-it/spec-syntax/test-block-declarations", () => {
  it("a block written with an injected spelling is a test block declaration", ({
    declarationOfAnInjectedBlockSpelling,
  }) => {
    expect(declarationOfAnInjectedBlockSpelling).toBe(true);
  });

  it("a block written with the other injected spelling declares the same way", ({
    declarationOfTheOtherInjectedBlockSpelling,
  }) => {
    expect(declarationOfTheOtherInjectedBlockSpelling).toBe(true);
  });

  it("a block written with a modifier in front of an injected spelling declares the same way", ({
    declarationOfASkippedBlock,
  }) => {
    expect(declarationOfASkippedBlock).toBe(true);
  });

  it("a table-driven block written on an injected spelling declares the same way", ({
    declarationOfATableDrivenBlock,
  }) => {
    expect(declarationOfATableDrivenBlock).toBe(true);
  });

  it("a grouping block is not a test block declaration", ({ declarationOfAGroupingBlock }) => {
    expect(declarationOfAGroupingBlock).toBe(false);
  });

  it("a call reached through a receiver is not a test block declaration", ({
    declarationOfACallReachedThroughAReceiver,
  }) => {
    expect(declarationOfACallReachedThroughAReceiver).toBe(false);
  });

  it("a fixture factory is not a test block declaration", ({ declarationOfAFixtureFactory }) => {
    expect(declarationOfAFixtureFactory).toBe(false);
  });

  it("a renamed import of a block spelling declares under the name it was bound to", ({
    declarationOfARenamedImportOfABlockSpelling,
  }) => {
    expect(declarationOfARenamedImportOfABlockSpelling).toBe(true);
  });

  it("an import written with a quoted export name is read the same way", ({
    declarationOfAnImportWrittenWithAQuotedExportName,
  }) => {
    expect(declarationOfAnImportWrittenWithAQuotedExportName).toBe(true);
  });

  it("an import of something other than a block spelling binds no block", ({
    declarationOfAnImportOfSomethingOtherThanABlockSpelling,
  }) => {
    expect(declarationOfAnImportOfSomethingOtherThanABlockSpelling).toBe(false);
  });

  it("a default import binds no block", ({ declarationOfADefaultImport }) => {
    expect(declarationOfADefaultImport).toBe(false);
  });

  it("a namespace import binds no block", ({ declarationOfANamespaceImport }) => {
    expect(declarationOfANamespaceImport).toBe(false);
  });

  it("a local binding of a block spelling declares under its own name", ({
    declarationOfALocalBindingOfABlockSpelling,
  }) => {
    expect(declarationOfALocalBindingOfABlockSpelling).toBe(true);
  });

  it("a builder derived from the base declares under the name it was bound to", ({
    declarationOfABuilderDerivedFromTheBase,
  }) => {
    expect(declarationOfABuilderDerivedFromTheBase).toBe(true);
  });

  it("a builder derived from another builder reaches the same base", ({
    declarationOfABuilderDerivedFromAnotherBuilder,
  }) => {
    expect(declarationOfABuilderDerivedFromAnotherBuilder).toBe(true);
  });

  it("a binding taken from a binding that was derived earlier declares the same way", ({
    declarationOfABindingTakenFromABindingDerivedEarlier,
  }) => {
    expect(declarationOfABindingTakenFromABindingDerivedEarlier).toBe(true);
  });

  it("a member that is not the builder binds no block", ({
    declarationOfAMemberThatIsNotTheBuilder,
  }) => {
    expect(declarationOfAMemberThatIsNotTheBuilder).toBe(false);
  });

  it("a binding initialised by a plain call binds no block", ({
    declarationOfABindingInitialisedByAPlainCall,
  }) => {
    expect(declarationOfABindingInitialisedByAPlainCall).toBe(false);
  });

  it("a binding initialised by a value that is no call binds no block", ({
    declarationOfABindingInitialisedByAValueThatIsNoCall,
  }) => {
    expect(declarationOfABindingInitialisedByAValueThatIsNoCall).toBe(false);
  });

  it("a binding taken apart from an object binds no block", ({
    declarationOfABindingTakenApartFromAnObject,
  }) => {
    expect(declarationOfABindingTakenApartFromAnObject).toBe(false);
  });

  it("a binding declared without an initialiser binds no block", ({
    declarationOfABindingDeclaredWithoutAnInitialiser,
  }) => {
    expect(declarationOfABindingDeclaredWithoutAnInitialiser).toBe(false);
  });

  it("both function shapes handed to a block are read as its callbacks", ({
    callbackShapesOfAnArrowHandedToABlock,
  }) => {
    expect(callbackShapesOfAnArrowHandedToABlock).toStrictEqual(["ArrowFunctionExpression"]);
  });

  it("a function expression handed to a block is read as its callback as well", ({
    callbackShapesOfAFunctionExpressionHandedToABlock,
  }) => {
    expect(callbackShapesOfAFunctionExpressionHandedToABlock).toStrictEqual(["FunctionExpression"]);
  });

  it("a value handed to a block that is no function is no callback", ({
    callbackShapesOfAValueThatIsNoFunction,
  }) => {
    expect(callbackShapesOfAValueThatIsNoFunction).toStrictEqual([]);
  });

  it("a function handed through a wrapping call is still the callback", ({
    callbackShapesOfAFunctionHandedThroughAWrappingCall,
  }) => {
    expect(callbackShapesOfAFunctionHandedThroughAWrappingCall).toStrictEqual([
      "ArrowFunctionExpression",
    ]);
  });

  it("a callback spread into the block hides itself from this reading", ({
    callbackShapesOfACallbackSpreadIntoTheBlock,
  }) => {
    expect(callbackShapesOfACallbackSpreadIntoTheBlock).toStrictEqual([]);
  });

  it("a callback spread into a wrapping call hides itself the same way", ({
    callbackShapesOfACallbackSpreadIntoAWrappingCall,
  }) => {
    expect(callbackShapesOfACallbackSpreadIntoAWrappingCall).toStrictEqual([]);
  });

  it("a group written with the injected spelling is a grouping block declaration", ({
    groupDeclarationOfTheInjectedGroupingSpelling,
  }) => {
    expect(groupDeclarationOfTheInjectedGroupingSpelling).toBe(true);
  });

  it("a table-driven group written with the injected spelling declares the same way", ({
    groupDeclarationOfATableDrivenGroup,
  }) => {
    expect(groupDeclarationOfATableDrivenGroup).toBe(true);
  });

  it("a test block is not a grouping block declaration", ({ groupDeclarationOfATestBlock }) => {
    expect(groupDeclarationOfATestBlock).toBe(false);
  });

  it("the other test block spelling is not a grouping block declaration either", ({
    groupDeclarationOfTheOtherTestBlockSpelling,
  }) => {
    expect(groupDeclarationOfTheOtherTestBlockSpelling).toBe(false);
  });

  it("a renamed import of the grouping spelling declares under the name it was bound to", ({
    groupDeclarationOfARenamedImportOfTheGroupingSpelling,
  }) => {
    expect(groupDeclarationOfARenamedImportOfTheGroupingSpelling).toBe(true);
  });

  it("a local binding of the grouping spelling declares under its own name", ({
    groupDeclarationOfALocalBindingOfTheGroupingSpelling,
  }) => {
    expect(groupDeclarationOfALocalBindingOfTheGroupingSpelling).toBe(true);
  });

  it("the injected assertion entry stands under its own spelling", ({
    assertionEntryNamesBesideAPlainBinding,
  }) => {
    expect(assertionEntryNamesBesideAPlainBinding).toStrictEqual(new Set(["expect"]));
  });

  it("a renamed import of the assertion entry stands under the name it was bound to", ({
    assertionEntryNamesBesideARenamedImport,
  }) => {
    expect(assertionEntryNamesBesideARenamedImport).toStrictEqual(
      new Set(["assertThat", "expect"]),
    );
  });

  it("a local binding of the assertion entry stands under its own name", ({
    assertionEntryNamesBesideALocalBinding,
  }) => {
    expect(assertionEntryNamesBesideALocalBinding).toStrictEqual(new Set(["assertThat", "expect"]));
  });

  it("a test block spelling binds no assertion entry", ({
    assertionEntryNamesBesideATestBlockSpelling,
  }) => {
    expect(assertionEntryNamesBesideATestBlockSpelling).toStrictEqual(new Set(["expect"]));
  });

  it("a spelling the runner injects stands as a root while nothing in the file takes its name", ({
    runnerRootedNamesBesideAPlainBinding,
  }) => {
    expect(runnerRootedNamesBesideAPlainBinding).toStrictEqual(new Set(["it", "test"]));
  });

  it("a renamed import from the test runner stands as a root under the name it was bound to", ({
    runnerRootedNamesBesideARenamedRunnerImport,
  }) => {
    expect(runnerRootedNamesBesideARenamedRunnerImport).toStrictEqual(
      new Set(["check", "it", "test"]),
    );
  });

  it("an import of a spelling from a module that is no test runner takes that name away", ({
    runnerRootedNamesBesideAnImportFromAnotherModule,
  }) => {
    expect(runnerRootedNamesBesideAnImportFromAnotherModule).toStrictEqual(new Set(["test"]));
  });

  it("a binding derived from the runner stands as a root under its own name", ({
    runnerRootedNamesBesideABindingDerivedFromTheRunner,
  }) => {
    expect(runnerRootedNamesBesideABindingDerivedFromTheRunner).toStrictEqual(
      new Set(["it", "test"]),
    );
  });

  it("a binding of a spelling that reaches no runner takes that name away", ({
    runnerRootedNamesBesideABindingReachingNoRunner,
  }) => {
    expect(runnerRootedNamesBesideABindingReachingNoRunner).toStrictEqual(new Set(["test"]));
  });

  it("a function declaration taking a spelling takes that name away", ({
    runnerRootedNamesBesideAFunctionDeclarationTakingASpelling,
  }) => {
    expect(runnerRootedNamesBesideAFunctionDeclarationTakingASpelling).toStrictEqual(
      new Set(["test"]),
    );
  });

  it("a function declared without a name leaves every spelling standing", ({
    runnerRootedNamesBesideAFunctionDeclaredWithoutAName,
  }) => {
    expect(runnerRootedNamesBesideAFunctionDeclaredWithoutAName).toStrictEqual(
      new Set(["it", "test"]),
    );
  });

  it("a binding taken apart from an object leaves every spelling standing", ({
    runnerRootedNamesBesideABindingTakenApartFromAnObject,
  }) => {
    expect(runnerRootedNamesBesideABindingTakenApartFromAnObject).toStrictEqual(
      new Set(["it", "test"]),
    );
  });

  it("a binding declared without an initialiser takes that name away", ({
    runnerRootedNamesBesideABindingDeclaredWithoutAnInitialiser,
  }) => {
    expect(runnerRootedNamesBesideABindingDeclaredWithoutAnInitialiser).toStrictEqual(
      new Set(["test"]),
    );
  });

  it("a name written out as a string is a spelled title", ({
    titleSpellingOfANameWrittenOutAsAString,
  }) => {
    expect(titleSpellingOfANameWrittenOutAsAString).toBe(true);
  });

  it("a name assembled by a template is a spelled title", ({
    titleSpellingOfANameAssembledByATemplate,
  }) => {
    expect(titleSpellingOfANameAssembledByATemplate).toBe(true);
  });

  it("a name that is no string leaves the block without a spelled title", ({
    titleSpellingOfANumberName,
  }) => {
    expect(titleSpellingOfANumberName).toBe(false);
  });

  it("a name held by a binding leaves the block without a spelled title as well", ({
    titleSpellingOfANameHeldByABinding,
  }) => {
    expect(titleSpellingOfANameHeldByABinding).toBe(false);
  });

  it("a block opening with its callback carries no spelled title", ({
    titleSpellingOfABlockOpeningWithItsCallback,
  }) => {
    expect(titleSpellingOfABlockOpeningWithItsCallback).toBe(false);
  });

  it("a block whose first argument is spread carries no spelled title", ({
    titleSpellingOfABlockWhoseFirstArgumentIsSpread,
  }) => {
    expect(titleSpellingOfABlockWhoseFirstArgumentIsSpread).toBe(false);
  });

  it("a block handed nothing carries no spelled title", ({
    titleSpellingOfABlockHandedNothing,
  }) => {
    expect(titleSpellingOfABlockHandedNothing).toBe(false);
  });

  it("a named block hands over the function that carries its body", ({
    bodyShapeOfANamedBlockHandedAnArrow,
  }) => {
    expect(bodyShapeOfANamedBlockHandedAnArrow).toBe("ArrowFunctionExpression");
  });

  it("a named block handed a function expression hands that function over", ({
    bodyShapeOfANamedBlockHandedAFunctionExpression,
  }) => {
    expect(bodyShapeOfANamedBlockHandedAFunctionExpression).toBe("FunctionExpression");
  });

  it("a body written behind an options object is still the body", ({
    bodyShapeOfABodyWrittenBehindAnOptionsObject,
  }) => {
    expect(bodyShapeOfABodyWrittenBehindAnOptionsObject).toBe("ArrowFunctionExpression");
  });

  it("a body reached through a derived builder is read the same way", ({
    bodyShapeOfABodyReachedThroughADerivedBuilder,
  }) => {
    expect(bodyShapeOfABodyReachedThroughADerivedBuilder).toBe("ArrowFunctionExpression");
  });

  it("a block handed no callback hands over no body", ({ bodyShapeOfABlockHandedNoCallback }) => {
    expect(bodyShapeOfABlockHandedNoCallback).toBe(null);
  });

  it("a block without a spelled title hands over no body", ({
    bodyShapeOfABlockWithoutASpelledTitle,
  }) => {
    expect(bodyShapeOfABlockWithoutASpelledTitle).toBe(null);
  });

  it("a call that declares no test block hands over no body", ({
    bodyShapeOfACallThatDeclaresNoTestBlock,
  }) => {
    expect(bodyShapeOfACallThatDeclaresNoTestBlock).toBe(null);
  });
});
