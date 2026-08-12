import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { tableDrivenTitlesOf } from "./table-driven-titles.ts";

import type { ESTree } from "@oxlint/plugins";

const it = test
  .extend("titlesOfANumberPlaceholderAgainstANumber", () => {
    const declared = parseSync("spec.ts", "const rows = [1];").program
      .body[0] as ESTree.VariableDeclaration;
    const [declarator] = declared.declarations;
    const table = declarator?.init ?? null;
    return table === null ? null : tableDrivenTitlesOf(table, "count %d");
  })
  .extend("titlesOfATruncatingPlaceholderAgainstAString", () => {
    const declared = parseSync("spec.ts", 'const rows = ["one"];').program
      .body[0] as ESTree.VariableDeclaration;
    const [declarator] = declared.declarations;
    const table = declarator?.init ?? null;
    return table === null ? null : tableDrivenTitlesOf(table, "count %i");
  })
  .extend("titlesOfACaseWrittenAsNothing", () => {
    const declared = parseSync("spec.ts", "const rows = [null];").program
      .body[0] as ESTree.VariableDeclaration;
    const [declarator] = declared.declarations;
    const table = declarator?.init ?? null;
    return table === null ? null : tableDrivenTitlesOf(table, "held %s");
  })
  .extend("titlesOfACaseWrittenAsAFlag", () => {
    const declared = parseSync("spec.ts", "const rows = [true];").program
      .body[0] as ESTree.VariableDeclaration;
    const [declarator] = declared.declarations;
    const table = declarator?.init ?? null;
    return table === null ? null : tableDrivenTitlesOf(table, "held %s");
  })
  .extend("titlesOfACaseWrittenAsAWholeNumberLiteral", () => {
    const declared = parseSync("spec.ts", "const rows = [1n];").program
      .body[0] as ESTree.VariableDeclaration;
    const [declarator] = declared.declarations;
    const table = declarator?.init ?? null;
    return table === null ? null : tableDrivenTitlesOf(table, "held %s");
  })
  .extend("titlesOfANegatedValueThatIsNoNumber", () => {
    const declared = parseSync("spec.ts", 'const rows = [-"one"];').program
      .body[0] as ESTree.VariableDeclaration;
    const [declarator] = declared.declarations;
    const table = declarator?.init ?? null;
    return table === null ? null : tableDrivenTitlesOf(table, "held %s");
  })
  .extend("titlesOfACaseWrittenAsATemplate", () => {
    const declared = parseSync("spec.ts", "const rows = [`one`];").program
      .body[0] as ESTree.VariableDeclaration;
    const [declarator] = declared.declarations;
    const table = declarator?.init ?? null;
    return table === null ? null : tableDrivenTitlesOf(table, "word %s");
  })
  .extend("titlesOfAnObjectCaseThatSpreadsAnother", () => {
    const declared = parseSync("spec.ts", "const rows = [{ ...held }];").program
      .body[0] as ESTree.VariableDeclaration;
    const [declarator] = declared.declarations;
    const table = declarator?.init ?? null;
    return table === null ? null : tableDrivenTitlesOf(table, "object $name");
  })
  .extend("titlesOfAnObjectCaseKeyedByANumber", () => {
    const declared = parseSync("spec.ts", 'const rows = [{ 1: "alpha" }];').program
      .body[0] as ESTree.VariableDeclaration;
    const [declarator] = declared.declarations;
    const table = declarator?.init ?? null;
    return table === null ? null : tableDrivenTitlesOf(table, "object $name");
  })
  .extend("titlesOfAnObjectCaseHoldingAName", () => {
    const declared = parseSync("spec.ts", "const rows = [{ name: held }];").program
      .body[0] as ESTree.VariableDeclaration;
    const [declarator] = declared.declarations;
    const table = declarator?.init ?? null;
    return table === null ? null : tableDrivenTitlesOf(table, "object $name");
  })
  .extend("titlesOfATupleCaseCarryingAHole", () => {
    const declared = parseSync("spec.ts", "const rows = [[, 1]];").program
      .body[0] as ESTree.VariableDeclaration;
    const [declarator] = declared.declarations;
    const table = declarator?.init ?? null;
    return table === null ? null : tableDrivenTitlesOf(table, "tuple %s");
  })
  .extend("titlesOfANamedValueTooLongToDisplay", () => {
    const declared = parseSync("spec.ts", 'const rows = [{ name: "aaaaaaaaaaaaaaaaaaaaaaaaa" }];')
      .program.body[0] as ESTree.VariableDeclaration;
    const [declarator] = declared.declarations;
    const table = declarator?.init ?? null;
    return table === null ? null : tableDrivenTitlesOf(table, "object $name");
  })
  .extend("titlesOfATableCarryingAHole", () => {
    const declared = parseSync("spec.ts", "const rows = [, 1];").program
      .body[0] as ESTree.VariableDeclaration;
    const [declarator] = declared.declarations;
    const table = declarator?.init ?? null;
    return table === null ? null : tableDrivenTitlesOf(table, "case %s");
  })
  .extend("titlesOfAScalarTable", () => {
    const declared = parseSync("spec.ts", "const rows = [1, 2];").program
      .body[0] as ESTree.VariableDeclaration;
    const [declarator] = declared.declarations;
    const table = declarator?.init ?? null;
    return table === null ? null : tableDrivenTitlesOf(table, "scalar %s");
  })
  .extend("titlesOfAStringTable", () => {
    const declared = parseSync("spec.ts", 'const rows = ["one", "two"];').program
      .body[0] as ESTree.VariableDeclaration;
    const [declarator] = declared.declarations;
    const table = declarator?.init ?? null;
    return table === null ? null : tableDrivenTitlesOf(table, "word %s");
  })
  .extend("titlesOfATupleTable", () => {
    const declared = parseSync("spec.ts", 'const rows = [[1, "one"], [2, "two"]];').program
      .body[0] as ESTree.VariableDeclaration;
    const [declarator] = declared.declarations;
    const table = declarator?.init ?? null;
    return table === null ? null : tableDrivenTitlesOf(table, "tuple %i is %s");
  })
  .extend("titlesOfAnObjectTable", () => {
    const declared = parseSync(
      "spec.ts",
      'const rows = [{ name: "alpha", size: 1 }, { name: "beta", size: 2 }];',
    ).program.body[0] as ESTree.VariableDeclaration;
    const [declarator] = declared.declarations;
    const table = declarator?.init ?? null;
    return table === null ? null : tableDrivenTitlesOf(table, "object $name of $size");
  })
  .extend("titlesOfBothIndexPlaceholders", () => {
    const declared = parseSync("spec.ts", "const rows = [1, 2];").program
      .body[0] as ESTree.VariableDeclaration;
    const [declarator] = declared.declarations;
    const table = declarator?.init ?? null;
    return table === null ? null : tableDrivenTitlesOf(table, "case %# and %$");
  })
  .extend("titlesOfADoubledPercent", () => {
    const declared = parseSync("spec.ts", "const rows = [1];").program
      .body[0] as ESTree.VariableDeclaration;
    const [declarator] = declared.declarations;
    const table = declarator?.init ?? null;
    return table === null ? null : tableDrivenTitlesOf(table, "100%% done");
  })
  .extend("titlesOfATemplateCarryingNoPlaceholder", () => {
    const declared = parseSync("spec.ts", "const rows = [1, 2];").program
      .body[0] as ESTree.VariableDeclaration;
    const [declarator] = declared.declarations;
    const table = declarator?.init ?? null;
    return table === null ? null : tableDrivenTitlesOf(table, "no placeholder");
  })
  .extend("titlesOfANegativeNumberCase", () => {
    const declared = parseSync("spec.ts", "const rows = [-1];").program
      .body[0] as ESTree.VariableDeclaration;
    const [declarator] = declared.declarations;
    const table = declarator?.init ?? null;
    return table === null ? null : tableDrivenTitlesOf(table, "below %s");
  })
  .extend("titlesOfATableThatIsNotWrittenOut", () => {
    const declared = parseSync("spec.ts", "const rows = written;").program
      .body[0] as ESTree.VariableDeclaration;
    const [declarator] = declared.declarations;
    const table = declarator?.init ?? null;
    return table === null ? null : tableDrivenTitlesOf(table, "scalar %s");
  })
  .extend("titlesOfACaseValueThatIsNotWrittenOut", () => {
    const declared = parseSync("spec.ts", "const rows = [compute()];").program
      .body[0] as ESTree.VariableDeclaration;
    const [declarator] = declared.declarations;
    const table = declarator?.init ?? null;
    return table === null ? null : tableDrivenTitlesOf(table, "scalar %s");
  })
  .extend("titlesOfANamedValueThatIsNotWrittenOut", () => {
    const declared = parseSync("spec.ts", "const rows = [{ name: compute() }];").program
      .body[0] as ESTree.VariableDeclaration;
    const [declarator] = declared.declarations;
    const table = declarator?.init ?? null;
    return table === null ? null : tableDrivenTitlesOf(table, "object $name");
  })
  .extend("titlesOfAPlaceholderOutsideTheSpelledSet", () => {
    const declared = parseSync("spec.ts", "const rows = [1];").program
      .body[0] as ESTree.VariableDeclaration;
    const [declarator] = declared.declarations;
    const table = declarator?.init ?? null;
    return table === null ? null : tableDrivenTitlesOf(table, "inspected %o");
  })
  .extend("titlesOfANamedReferenceTheCaseDoesNotCarry", () => {
    const declared = parseSync("spec.ts", 'const rows = [{ name: "alpha" }];').program
      .body[0] as ESTree.VariableDeclaration;
    const [declarator] = declared.declarations;
    const table = declarator?.init ?? null;
    return table === null ? null : tableDrivenTitlesOf(table, "object $missing");
  })
  .extend("titlesOfANumberPlaceholderAgainstAString", () => {
    const declared = parseSync("spec.ts", 'const rows = ["one"];').program
      .body[0] as ESTree.VariableDeclaration;
    const [declarator] = declared.declarations;
    const table = declarator?.init ?? null;
    return table === null ? null : tableDrivenTitlesOf(table, "count %d");
  })
  .extend("titlesOfAPositionalPlaceholderAgainstAnObject", () => {
    const declared = parseSync("spec.ts", 'const rows = [{ name: "alpha" }];').program
      .body[0] as ESTree.VariableDeclaration;
    const [declarator] = declared.declarations;
    const table = declarator?.init ?? null;
    return table === null ? null : tableDrivenTitlesOf(table, "object %s");
  });

describe("dont-review-it/spec-syntax/table-driven-titles", () => {
  it("a scalar table spells one title per case through the string placeholder", ({
    titlesOfAScalarTable,
  }) => {
    expect(titlesOfAScalarTable).toStrictEqual({
      kind: "spelled",
      titles: ["scalar 1", "scalar 2"],
    });
  });

  it("a string case is spelled without quotes through the string placeholder", ({
    titlesOfAStringTable,
  }) => {
    expect(titlesOfAStringTable).toStrictEqual({
      kind: "spelled",
      titles: ["word one", "word two"],
    });
  });

  it("a tuple table takes one case value per positional placeholder", ({ titlesOfATupleTable }) => {
    expect(titlesOfATupleTable).toStrictEqual({
      kind: "spelled",
      titles: ["tuple 1 is one", "tuple 2 is two"],
    });
  });

  it("an object table spells a named value the way the runner displays it", ({
    titlesOfAnObjectTable,
  }) => {
    expect(titlesOfAnObjectTable).toStrictEqual({
      kind: "spelled",
      titles: ["object 'alpha' of 1", "object 'beta' of 2"],
    });
  });

  it("the index placeholder counts from zero and its companion counts from one", ({
    titlesOfBothIndexPlaceholders,
  }) => {
    expect(titlesOfBothIndexPlaceholders).toStrictEqual({
      kind: "spelled",
      titles: ["case 0 and 1", "case 1 and 2"],
    });
  });

  it("a doubled percent stands for one percent and takes no case value", ({
    titlesOfADoubledPercent,
  }) => {
    expect(titlesOfADoubledPercent).toStrictEqual({ kind: "spelled", titles: ["100% done"] });
  });

  it("a template without a placeholder repeats one title for every case", ({
    titlesOfATemplateCarryingNoPlaceholder,
  }) => {
    expect(titlesOfATemplateCarryingNoPlaceholder).toStrictEqual({
      kind: "spelled",
      titles: ["no placeholder", "no placeholder"],
    });
  });

  it("a negative number reads as the number it spells", ({ titlesOfANegativeNumberCase }) => {
    expect(titlesOfANegativeNumberCase).toStrictEqual({ kind: "spelled", titles: ["below -1"] });
  });

  it("a table that is not written out is runtime", ({ titlesOfATableThatIsNotWrittenOut }) => {
    expect(titlesOfATableThatIsNotWrittenOut).toStrictEqual({ kind: "runtime" });
  });

  it("a case value that is not written out is runtime", ({
    titlesOfACaseValueThatIsNotWrittenOut,
  }) => {
    expect(titlesOfACaseValueThatIsNotWrittenOut).toStrictEqual({ kind: "runtime" });
  });

  it("a named value that is not written out is runtime", ({
    titlesOfANamedValueThatIsNotWrittenOut,
  }) => {
    expect(titlesOfANamedValueThatIsNotWrittenOut).toStrictEqual({ kind: "runtime" });
  });

  it("a placeholder outside the spelled set leaves the title unreadable", ({
    titlesOfAPlaceholderOutsideTheSpelledSet,
  }) => {
    expect(titlesOfAPlaceholderOutsideTheSpelledSet).toStrictEqual({ kind: "unreadable" });
  });

  it("a named reference the case does not carry leaves the title unreadable", ({
    titlesOfANamedReferenceTheCaseDoesNotCarry,
  }) => {
    expect(titlesOfANamedReferenceTheCaseDoesNotCarry).toStrictEqual({ kind: "unreadable" });
  });

  it("a number placeholder against a string case leaves the title unreadable", ({
    titlesOfANumberPlaceholderAgainstAString,
  }) => {
    expect(titlesOfANumberPlaceholderAgainstAString).toStrictEqual({ kind: "unreadable" });
  });

  it("a positional placeholder against an object case leaves the title unreadable", ({
    titlesOfAPositionalPlaceholderAgainstAnObject,
  }) => {
    expect(titlesOfAPositionalPlaceholderAgainstAnObject).toStrictEqual({ kind: "unreadable" });
  });

  it("a number placeholder against a number case spells the number", ({
    titlesOfANumberPlaceholderAgainstANumber,
  }) => {
    expect(titlesOfANumberPlaceholderAgainstANumber).toStrictEqual({
      kind: "spelled",
      titles: ["count 1"],
    });
  });

  it("a truncating placeholder against a string case leaves the title unreadable", ({
    titlesOfATruncatingPlaceholderAgainstAString,
  }) => {
    expect(titlesOfATruncatingPlaceholderAgainstAString).toStrictEqual({ kind: "unreadable" });
  });

  it("a case written as nothing spells the absence it stands for", ({
    titlesOfACaseWrittenAsNothing,
  }) => {
    expect(titlesOfACaseWrittenAsNothing).toStrictEqual({
      kind: "spelled",
      titles: ["held null"],
    });
  });

  it("a case written as a flag spells the flag", ({ titlesOfACaseWrittenAsAFlag }) => {
    expect(titlesOfACaseWrittenAsAFlag).toStrictEqual({
      kind: "spelled",
      titles: ["held true"],
    });
  });

  it("a case written as a whole number literal is a value this reading cannot spell", ({
    titlesOfACaseWrittenAsAWholeNumberLiteral,
  }) => {
    expect(titlesOfACaseWrittenAsAWholeNumberLiteral).toStrictEqual({ kind: "runtime" });
  });

  it("a negation of something that is no number spells no case value", ({
    titlesOfANegatedValueThatIsNoNumber,
  }) => {
    expect(titlesOfANegatedValueThatIsNoNumber).toStrictEqual({ kind: "runtime" });
  });

  it("a case written as a template carrying no substitution reads as the text it spells", ({
    titlesOfACaseWrittenAsATemplate,
  }) => {
    expect(titlesOfACaseWrittenAsATemplate).toStrictEqual({
      kind: "spelled",
      titles: ["word one"],
    });
  });

  it("an object case that spreads another object carries no named value this reading can take", ({
    titlesOfAnObjectCaseThatSpreadsAnother,
  }) => {
    expect(titlesOfAnObjectCaseThatSpreadsAnother).toStrictEqual({ kind: "runtime" });
  });

  it("an object case keyed by a number carries no name this reading can take", ({
    titlesOfAnObjectCaseKeyedByANumber,
  }) => {
    expect(titlesOfAnObjectCaseKeyedByANumber).toStrictEqual({ kind: "runtime" });
  });

  it("an object case whose value is a name settles only while the program runs", ({
    titlesOfAnObjectCaseHoldingAName,
  }) => {
    expect(titlesOfAnObjectCaseHoldingAName).toStrictEqual({ kind: "runtime" });
  });

  it("a tuple case carrying a hole spells no case value", ({ titlesOfATupleCaseCarryingAHole }) => {
    expect(titlesOfATupleCaseCarryingAHole).toStrictEqual({ kind: "runtime" });
  });

  it("a named value too long for the runner to display leaves the title unreadable", ({
    titlesOfANamedValueTooLongToDisplay,
  }) => {
    expect(titlesOfANamedValueTooLongToDisplay).toStrictEqual({ kind: "unreadable" });
  });

  it("a table carrying a hole spells no case at all", ({ titlesOfATableCarryingAHole }) => {
    expect(titlesOfATableCarryingAHole).toStrictEqual({ kind: "runtime" });
  });
});
