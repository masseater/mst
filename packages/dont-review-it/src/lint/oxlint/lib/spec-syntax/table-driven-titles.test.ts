import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { tableDrivenTitlesOf } from "./table-driven-titles.ts";

import type { ESTree } from "@oxlint/plugins";

describe("tableDrivenTitlesOf", () => {
  describe("a scalar table", () => {
    const it = test.extend("titlesOfAScalarTable", () => {
      const declared = parseSync("spec.ts", "const rows = [1, 2];").program
        .body[0] as ESTree.VariableDeclaration;
      const [declarator] = declared.declarations;
      const table = declarator?.init ?? null;
      return table === null ? null : tableDrivenTitlesOf(table, "scalar %s");
    });

    it("spells one title per case through the string placeholder", ({ titlesOfAScalarTable }) => {
      expect(titlesOfAScalarTable).toStrictEqual({
        kind: "spelled",
        titles: ["scalar 1", "scalar 2"],
      });
    });
  });

  describe("a string case", () => {
    const it = test.extend("titlesOfAStringTable", () => {
      const declared = parseSync("spec.ts", 'const rows = ["one", "two"];').program
        .body[0] as ESTree.VariableDeclaration;
      const [declarator] = declared.declarations;
      const table = declarator?.init ?? null;
      return table === null ? null : tableDrivenTitlesOf(table, "word %s");
    });

    it("is spelled without quotes through the string placeholder", ({ titlesOfAStringTable }) => {
      expect(titlesOfAStringTable).toStrictEqual({
        kind: "spelled",
        titles: ["word one", "word two"],
      });
    });
  });

  describe("a tuple table", () => {
    const it = test.extend("titlesOfATupleTable", () => {
      const declared = parseSync("spec.ts", 'const rows = [[1, "one"], [2, "two"]];').program
        .body[0] as ESTree.VariableDeclaration;
      const [declarator] = declared.declarations;
      const table = declarator?.init ?? null;
      return table === null ? null : tableDrivenTitlesOf(table, "tuple %i is %s");
    });

    it("takes one case value per positional placeholder", ({ titlesOfATupleTable }) => {
      expect(titlesOfATupleTable).toStrictEqual({
        kind: "spelled",
        titles: ["tuple 1 is one", "tuple 2 is two"],
      });
    });
  });

  describe("an object table", () => {
    const it = test.extend("titlesOfAnObjectTable", () => {
      const declared = parseSync(
        "spec.ts",
        'const rows = [{ name: "alpha", size: 1 }, { name: "beta", size: 2 }];',
      ).program.body[0] as ESTree.VariableDeclaration;
      const [declarator] = declared.declarations;
      const table = declarator?.init ?? null;
      return table === null ? null : tableDrivenTitlesOf(table, "object $name of $size");
    });

    it("spells a named value the way the runner displays it", ({ titlesOfAnObjectTable }) => {
      expect(titlesOfAnObjectTable).toStrictEqual({
        kind: "spelled",
        titles: ["object 'alpha' of 1", "object 'beta' of 2"],
      });
    });
  });

  describe("the index placeholder", () => {
    const it = test.extend("titlesOfBothIndexPlaceholders", () => {
      const declared = parseSync("spec.ts", "const rows = [1, 2];").program
        .body[0] as ESTree.VariableDeclaration;
      const [declarator] = declared.declarations;
      const table = declarator?.init ?? null;
      return table === null ? null : tableDrivenTitlesOf(table, "case %# and %$");
    });

    it("counts from zero and its companion counts from one", ({
      titlesOfBothIndexPlaceholders,
    }) => {
      expect(titlesOfBothIndexPlaceholders).toStrictEqual({
        kind: "spelled",
        titles: ["case 0 and 1", "case 1 and 2"],
      });
    });
  });

  describe("a doubled percent", () => {
    const it = test.extend("titlesOfADoubledPercent", () => {
      const declared = parseSync("spec.ts", "const rows = [1];").program
        .body[0] as ESTree.VariableDeclaration;
      const [declarator] = declared.declarations;
      const table = declarator?.init ?? null;
      return table === null ? null : tableDrivenTitlesOf(table, "100%% done");
    });

    it("stands for one percent and takes no case value", ({ titlesOfADoubledPercent }) => {
      expect(titlesOfADoubledPercent).toStrictEqual({ kind: "spelled", titles: ["100% done"] });
    });
  });

  describe("a template without a placeholder", () => {
    const it = test.extend("titlesOfATemplateCarryingNoPlaceholder", () => {
      const declared = parseSync("spec.ts", "const rows = [1, 2];").program
        .body[0] as ESTree.VariableDeclaration;
      const [declarator] = declared.declarations;
      const table = declarator?.init ?? null;
      return table === null ? null : tableDrivenTitlesOf(table, "no placeholder");
    });

    it("repeats one title for every case", ({ titlesOfATemplateCarryingNoPlaceholder }) => {
      expect(titlesOfATemplateCarryingNoPlaceholder).toStrictEqual({
        kind: "spelled",
        titles: ["no placeholder", "no placeholder"],
      });
    });
  });

  describe("a negative number", () => {
    const it = test.extend("titlesOfANegativeNumberCase", () => {
      const declared = parseSync("spec.ts", "const rows = [-1];").program
        .body[0] as ESTree.VariableDeclaration;
      const [declarator] = declared.declarations;
      const table = declarator?.init ?? null;
      return table === null ? null : tableDrivenTitlesOf(table, "below %s");
    });

    it("reads as the number it spells", ({ titlesOfANegativeNumberCase }) => {
      expect(titlesOfANegativeNumberCase).toStrictEqual({ kind: "spelled", titles: ["below -1"] });
    });
  });

  describe("a table that is not written out", () => {
    const it = test.extend("titlesOfATableThatIsNotWrittenOut", () => {
      const declared = parseSync("spec.ts", "const rows = written;").program
        .body[0] as ESTree.VariableDeclaration;
      const [declarator] = declared.declarations;
      const table = declarator?.init ?? null;
      return table === null ? null : tableDrivenTitlesOf(table, "scalar %s");
    });

    it("is runtime", ({ titlesOfATableThatIsNotWrittenOut }) => {
      expect(titlesOfATableThatIsNotWrittenOut).toStrictEqual({ kind: "runtime" });
    });
  });

  describe("a table that spreads another value", () => {
    const it = test.extend("titlesOfATableThatSpreadsAnotherValue", () => {
      const declared = parseSync("spec.ts", "const rows = [...cases];").program
        .body[0] as ESTree.VariableDeclaration;
      const [declarator] = declared.declarations;
      const table = declarator?.init ?? null;
      return table === null ? null : tableDrivenTitlesOf(table, "scalar %s");
    });

    it("is runtime", ({ titlesOfATableThatSpreadsAnotherValue }) => {
      expect(titlesOfATableThatSpreadsAnotherValue).toStrictEqual({ kind: "runtime" });
    });
  });

  describe("a case object that computes a key", () => {
    const it = test.extend("titlesOfAnObjectCaseThatComputesAKey", () => {
      const declared = parseSync("spec.ts", "const rows = [{ [key]: 1 }];").program
        .body[0] as ESTree.VariableDeclaration;
      const [declarator] = declared.declarations;
      const table = declarator?.init ?? null;
      return table === null ? null : tableDrivenTitlesOf(table, "object $name");
    });

    it("is runtime", ({ titlesOfAnObjectCaseThatComputesAKey }) => {
      expect(titlesOfAnObjectCaseThatComputesAKey).toStrictEqual({ kind: "runtime" });
    });
  });

  describe("an integer placeholder against a fractional case", () => {
    const it = test.extend("titlesOfAnIntegerPlaceholderAgainstAFractionalCase", () => {
      const declared = parseSync("spec.ts", "const rows = [1.5];").program
        .body[0] as ESTree.VariableDeclaration;
      const [declarator] = declared.declarations;
      const table = declarator?.init ?? null;
      return table === null ? null : tableDrivenTitlesOf(table, "count %i");
    });

    it("spells only the whole part of that case", ({
      titlesOfAnIntegerPlaceholderAgainstAFractionalCase,
    }) => {
      expect(titlesOfAnIntegerPlaceholderAgainstAFractionalCase).toStrictEqual({
        kind: "spelled",
        titles: ["count 1"],
      });
    });
  });

  describe("a case value that is not written out", () => {
    const it = test.extend("titlesOfACaseValueThatIsNotWrittenOut", () => {
      const declared = parseSync("spec.ts", "const rows = [compute()];").program
        .body[0] as ESTree.VariableDeclaration;
      const [declarator] = declared.declarations;
      const table = declarator?.init ?? null;
      return table === null ? null : tableDrivenTitlesOf(table, "scalar %s");
    });

    it("is runtime", ({ titlesOfACaseValueThatIsNotWrittenOut }) => {
      expect(titlesOfACaseValueThatIsNotWrittenOut).toStrictEqual({ kind: "runtime" });
    });
  });

  describe("a named value that is not written out", () => {
    const it = test.extend("titlesOfANamedValueThatIsNotWrittenOut", () => {
      const declared = parseSync("spec.ts", "const rows = [{ name: compute() }];").program
        .body[0] as ESTree.VariableDeclaration;
      const [declarator] = declared.declarations;
      const table = declarator?.init ?? null;
      return table === null ? null : tableDrivenTitlesOf(table, "object $name");
    });

    it("is runtime", ({ titlesOfANamedValueThatIsNotWrittenOut }) => {
      expect(titlesOfANamedValueThatIsNotWrittenOut).toStrictEqual({ kind: "runtime" });
    });
  });

  describe("a placeholder outside the spelled set", () => {
    const it = test.extend("titlesOfAPlaceholderOutsideTheSpelledSet", () => {
      const declared = parseSync("spec.ts", "const rows = [1];").program
        .body[0] as ESTree.VariableDeclaration;
      const [declarator] = declared.declarations;
      const table = declarator?.init ?? null;
      return table === null ? null : tableDrivenTitlesOf(table, "inspected %o");
    });

    it("leaves the title unreadable", ({ titlesOfAPlaceholderOutsideTheSpelledSet }) => {
      expect(titlesOfAPlaceholderOutsideTheSpelledSet).toStrictEqual({ kind: "unreadable" });
    });
  });

  describe("a named reference the case does not carry", () => {
    const it = test.extend("titlesOfANamedReferenceTheCaseDoesNotCarry", () => {
      const declared = parseSync("spec.ts", 'const rows = [{ name: "alpha" }];').program
        .body[0] as ESTree.VariableDeclaration;
      const [declarator] = declared.declarations;
      const table = declarator?.init ?? null;
      return table === null ? null : tableDrivenTitlesOf(table, "object $missing");
    });

    it("leaves the title unreadable", ({ titlesOfANamedReferenceTheCaseDoesNotCarry }) => {
      expect(titlesOfANamedReferenceTheCaseDoesNotCarry).toStrictEqual({ kind: "unreadable" });
    });
  });

  describe("a number placeholder against a string case", () => {
    const it = test.extend("titlesOfANumberPlaceholderAgainstAString", () => {
      const declared = parseSync("spec.ts", 'const rows = ["one"];').program
        .body[0] as ESTree.VariableDeclaration;
      const [declarator] = declared.declarations;
      const table = declarator?.init ?? null;
      return table === null ? null : tableDrivenTitlesOf(table, "count %d");
    });

    it("leaves the title unreadable", ({ titlesOfANumberPlaceholderAgainstAString }) => {
      expect(titlesOfANumberPlaceholderAgainstAString).toStrictEqual({ kind: "unreadable" });
    });
  });

  describe("a positional placeholder against an object case", () => {
    const it = test.extend("titlesOfAPositionalPlaceholderAgainstAnObject", () => {
      const declared = parseSync("spec.ts", 'const rows = [{ name: "alpha" }];').program
        .body[0] as ESTree.VariableDeclaration;
      const [declarator] = declared.declarations;
      const table = declarator?.init ?? null;
      return table === null ? null : tableDrivenTitlesOf(table, "object %s");
    });

    it("leaves the title unreadable", ({ titlesOfAPositionalPlaceholderAgainstAnObject }) => {
      expect(titlesOfAPositionalPlaceholderAgainstAnObject).toStrictEqual({ kind: "unreadable" });
    });
  });

  describe("a number placeholder against a number case", () => {
    const it = test.extend("titlesOfANumberPlaceholderAgainstANumber", () => {
      const declared = parseSync("spec.ts", "const rows = [1];").program
        .body[0] as ESTree.VariableDeclaration;
      const [declarator] = declared.declarations;
      const table = declarator?.init ?? null;
      return table === null ? null : tableDrivenTitlesOf(table, "count %d");
    });

    it("spells the number", ({ titlesOfANumberPlaceholderAgainstANumber }) => {
      expect(titlesOfANumberPlaceholderAgainstANumber).toStrictEqual({
        kind: "spelled",
        titles: ["count 1"],
      });
    });
  });

  describe("a truncating placeholder against a string case", () => {
    const it = test.extend("titlesOfATruncatingPlaceholderAgainstAString", () => {
      const declared = parseSync("spec.ts", 'const rows = ["one"];').program
        .body[0] as ESTree.VariableDeclaration;
      const [declarator] = declared.declarations;
      const table = declarator?.init ?? null;
      return table === null ? null : tableDrivenTitlesOf(table, "count %i");
    });

    it("leaves the title unreadable", ({ titlesOfATruncatingPlaceholderAgainstAString }) => {
      expect(titlesOfATruncatingPlaceholderAgainstAString).toStrictEqual({ kind: "unreadable" });
    });
  });

  describe("a case written as nothing", () => {
    const it = test.extend("titlesOfACaseWrittenAsNothing", () => {
      const declared = parseSync("spec.ts", "const rows = [null];").program
        .body[0] as ESTree.VariableDeclaration;
      const [declarator] = declared.declarations;
      const table = declarator?.init ?? null;
      return table === null ? null : tableDrivenTitlesOf(table, "held %s");
    });

    it("spells the absence it stands for", ({ titlesOfACaseWrittenAsNothing }) => {
      expect(titlesOfACaseWrittenAsNothing).toStrictEqual({
        kind: "spelled",
        titles: ["held null"],
      });
    });
  });

  describe("a case written as a flag", () => {
    const it = test.extend("titlesOfACaseWrittenAsAFlag", () => {
      const declared = parseSync("spec.ts", "const rows = [true];").program
        .body[0] as ESTree.VariableDeclaration;
      const [declarator] = declared.declarations;
      const table = declarator?.init ?? null;
      return table === null ? null : tableDrivenTitlesOf(table, "held %s");
    });

    it("spells the flag", ({ titlesOfACaseWrittenAsAFlag }) => {
      expect(titlesOfACaseWrittenAsAFlag).toStrictEqual({
        kind: "spelled",
        titles: ["held true"],
      });
    });
  });

  describe("a case written as a whole number literal", () => {
    const it = test.extend("titlesOfACaseWrittenAsAWholeNumberLiteral", () => {
      const declared = parseSync("spec.ts", "const rows = [1n];").program
        .body[0] as ESTree.VariableDeclaration;
      const [declarator] = declared.declarations;
      const table = declarator?.init ?? null;
      return table === null ? null : tableDrivenTitlesOf(table, "held %s");
    });

    it("is a value this reading cannot spell", ({ titlesOfACaseWrittenAsAWholeNumberLiteral }) => {
      expect(titlesOfACaseWrittenAsAWholeNumberLiteral).toStrictEqual({ kind: "runtime" });
    });
  });

  describe("a negation of something that is no number", () => {
    const it = test.extend("titlesOfANegatedValueThatIsNoNumber", () => {
      const declared = parseSync("spec.ts", 'const rows = [-"one"];').program
        .body[0] as ESTree.VariableDeclaration;
      const [declarator] = declared.declarations;
      const table = declarator?.init ?? null;
      return table === null ? null : tableDrivenTitlesOf(table, "held %s");
    });

    it("spells no case value", ({ titlesOfANegatedValueThatIsNoNumber }) => {
      expect(titlesOfANegatedValueThatIsNoNumber).toStrictEqual({ kind: "runtime" });
    });
  });

  describe("a case written as a template carrying no substitution", () => {
    const it = test.extend("titlesOfACaseWrittenAsATemplate", () => {
      const declared = parseSync("spec.ts", "const rows = [`one`];").program
        .body[0] as ESTree.VariableDeclaration;
      const [declarator] = declared.declarations;
      const table = declarator?.init ?? null;
      return table === null ? null : tableDrivenTitlesOf(table, "word %s");
    });

    it("reads as the text it spells", ({ titlesOfACaseWrittenAsATemplate }) => {
      expect(titlesOfACaseWrittenAsATemplate).toStrictEqual({
        kind: "spelled",
        titles: ["word one"],
      });
    });
  });

  describe("an object case that spreads another object", () => {
    const it = test.extend("titlesOfAnObjectCaseThatSpreadsAnother", () => {
      const declared = parseSync("spec.ts", "const rows = [{ ...held }];").program
        .body[0] as ESTree.VariableDeclaration;
      const [declarator] = declared.declarations;
      const table = declarator?.init ?? null;
      return table === null ? null : tableDrivenTitlesOf(table, "object $name");
    });

    it("carries no named value this reading can take", ({
      titlesOfAnObjectCaseThatSpreadsAnother,
    }) => {
      expect(titlesOfAnObjectCaseThatSpreadsAnother).toStrictEqual({ kind: "runtime" });
    });
  });

  describe("an object case keyed by a number", () => {
    const it = test.extend("titlesOfAnObjectCaseKeyedByANumber", () => {
      const declared = parseSync("spec.ts", 'const rows = [{ 1: "alpha" }];').program
        .body[0] as ESTree.VariableDeclaration;
      const [declarator] = declared.declarations;
      const table = declarator?.init ?? null;
      return table === null ? null : tableDrivenTitlesOf(table, "object $name");
    });

    it("carries no name this reading can take", ({ titlesOfAnObjectCaseKeyedByANumber }) => {
      expect(titlesOfAnObjectCaseKeyedByANumber).toStrictEqual({ kind: "runtime" });
    });
  });

  describe("an object case whose value is a name", () => {
    const it = test.extend("titlesOfAnObjectCaseHoldingAName", () => {
      const declared = parseSync("spec.ts", "const rows = [{ name: held }];").program
        .body[0] as ESTree.VariableDeclaration;
      const [declarator] = declared.declarations;
      const table = declarator?.init ?? null;
      return table === null ? null : tableDrivenTitlesOf(table, "object $name");
    });

    it("settles only while the program runs", ({ titlesOfAnObjectCaseHoldingAName }) => {
      expect(titlesOfAnObjectCaseHoldingAName).toStrictEqual({ kind: "runtime" });
    });
  });

  describe("a tuple case carrying a hole", () => {
    const it = test.extend("titlesOfATupleCaseCarryingAHole", () => {
      const declared = parseSync("spec.ts", "const rows = [[, 1]];").program
        .body[0] as ESTree.VariableDeclaration;
      const [declarator] = declared.declarations;
      const table = declarator?.init ?? null;
      return table === null ? null : tableDrivenTitlesOf(table, "tuple %s");
    });

    it("spells no case value", ({ titlesOfATupleCaseCarryingAHole }) => {
      expect(titlesOfATupleCaseCarryingAHole).toStrictEqual({ kind: "runtime" });
    });
  });

  describe("a named value too long for the runner to display", () => {
    const it = test.extend("titlesOfANamedValueTooLongToDisplay", () => {
      const declared = parseSync("spec.ts", 'const rows = [{ name: "aaaaaaaaaaaaaaaaaaaaaaaaa" }];')
        .program.body[0] as ESTree.VariableDeclaration;
      const [declarator] = declared.declarations;
      const table = declarator?.init ?? null;
      return table === null ? null : tableDrivenTitlesOf(table, "object $name");
    });

    it("leaves the title unreadable", ({ titlesOfANamedValueTooLongToDisplay }) => {
      expect(titlesOfANamedValueTooLongToDisplay).toStrictEqual({ kind: "unreadable" });
    });
  });

  describe("a table carrying a hole", () => {
    const it = test.extend("titlesOfATableCarryingAHole", () => {
      const declared = parseSync("spec.ts", "const rows = [, 1];").program
        .body[0] as ESTree.VariableDeclaration;
      const [declarator] = declared.declarations;
      const table = declarator?.init ?? null;
      return table === null ? null : tableDrivenTitlesOf(table, "case %s");
    });

    it("spells no case at all", ({ titlesOfATableCarryingAHole }) => {
      expect(titlesOfATableCarryingAHole).toStrictEqual({ kind: "runtime" });
    });
  });
});
