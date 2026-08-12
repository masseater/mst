import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { syntaxShapeOf } from "./expression-shape.ts";

import type { ESTree } from "@oxlint/plugins";

const it = test
  .extend("shapeOfAnObjectHoldingASingleQuotedString", () => {
    const declared = parseSync("spec.ts", "const written = { id: 'a' };").program
      .body[0] as ESTree.VariableDeclaration;
    return syntaxShapeOf(declared.declarations[0]?.init);
  })
  .extend("shapeOfAnObjectHoldingADoubleQuotedString", () => {
    const declared = parseSync("spec.ts", 'const written = { id: "a" };').program
      .body[0] as ESTree.VariableDeclaration;
    return syntaxShapeOf(declared.declarations[0]?.init);
  })
  .extend("shapeOfATemplateWithoutSubstitutions", () => {
    const declared = parseSync("spec.ts", "const written = `a`;").program
      .body[0] as ESTree.VariableDeclaration;
    return syntaxShapeOf(declared.declarations[0]?.init);
  })
  .extend("shapeOfAStringSpelledWithQuotes", () => {
    const declared = parseSync("spec.ts", 'const written = "a";').program
      .body[0] as ESTree.VariableDeclaration;
    return syntaxShapeOf(declared.declarations[0]?.init);
  })
  .extend("shapeOfAWholeNumber", () => {
    const declared = parseSync("spec.ts", "const written = 2;").program
      .body[0] as ESTree.VariableDeclaration;
    return syntaxShapeOf(declared.declarations[0]?.init);
  })
  .extend("shapeOfANumberCarryingATrailingZero", () => {
    const declared = parseSync("spec.ts", "const written = 2.0;").program
      .body[0] as ESTree.VariableDeclaration;
    return syntaxShapeOf(declared.declarations[0]?.init);
  })
  .extend("shapeOfANumberWrittenInHexadecimal", () => {
    const declared = parseSync("spec.ts", "const written = 0x2;").program
      .body[0] as ESTree.VariableDeclaration;
    return syntaxShapeOf(declared.declarations[0]?.init);
  })
  .extend("shapeOfAnObjectNamingTheIdFirst", () => {
    const declared = parseSync("spec.ts", 'const written = { id: "a", total: 2 };').program
      .body[0] as ESTree.VariableDeclaration;
    return syntaxShapeOf(declared.declarations[0]?.init);
  })
  .extend("shapeOfAnObjectNamingTheTotalFirst", () => {
    const declared = parseSync("spec.ts", 'const written = { total: 2, id: "a" };').program
      .body[0] as ESTree.VariableDeclaration;
    return syntaxShapeOf(declared.declarations[0]?.init);
  })
  .extend("shapeOfAPropertyWrittenInShorthand", () => {
    const declared = parseSync("spec.ts", "const written = { id };").program
      .body[0] as ESTree.VariableDeclaration;
    return syntaxShapeOf(declared.declarations[0]?.init);
  })
  .extend("shapeOfAPropertyWrittenOutInFull", () => {
    const declared = parseSync("spec.ts", "const written = { id: id };").program
      .body[0] as ESTree.VariableDeclaration;
    return syntaxShapeOf(declared.declarations[0]?.init);
  })
  .extend("shapeOfAnObjectClosedWithATrailingComma", () => {
    const declared = parseSync("spec.ts", 'const written = { id: "a", };').program
      .body[0] as ESTree.VariableDeclaration;
    return syntaxShapeOf(declared.declarations[0]?.init);
  })
  .extend("shapeOfAnObjectWrappedInParentheses", () => {
    const declared = parseSync("spec.ts", 'const written = ({ id: "a" });').program
      .body[0] as ESTree.VariableDeclaration;
    return syntaxShapeOf(declared.declarations[0]?.init);
  })
  .extend("shapeOfAnObjectBrokenAcrossLines", () => {
    const declared = parseSync("spec.ts", 'const written = {\n  id: "a",\n  total: 2,\n};').program
      .body[0] as ESTree.VariableDeclaration;
    return syntaxShapeOf(declared.declarations[0]?.init);
  })
  .extend("shapeOfAnObjectUnderATypeAssertion", () => {
    const declared = parseSync("spec.ts", 'const written = { id: "a" } as Report;').program
      .body[0] as ESTree.VariableDeclaration;
    return syntaxShapeOf(declared.declarations[0]?.init);
  })
  .extend("shapeOfAnObjectUnderASatisfiesClause", () => {
    const declared = parseSync("spec.ts", 'const written = { id: "a" } satisfies Report;').program
      .body[0] as ESTree.VariableDeclaration;
    return syntaxShapeOf(declared.declarations[0]?.init);
  })
  .extend("shapeOfANameUnderANonNullAssertion", () => {
    const declared = parseSync("spec.ts", "const written = report!;").program
      .body[0] as ESTree.VariableDeclaration;
    return syntaxShapeOf(declared.declarations[0]?.init);
  })
  .extend("shapeOfABareName", () => {
    const declared = parseSync("spec.ts", "const written = report;").program
      .body[0] as ESTree.VariableDeclaration;
    return syntaxShapeOf(declared.declarations[0]?.init);
  })
  .extend("shapeOfAnOptionalMemberAccess", () => {
    const declared = parseSync("spec.ts", "const written = report?.id;").program
      .body[0] as ESTree.VariableDeclaration;
    return syntaxShapeOf(declared.declarations[0]?.init);
  })
  .extend("shapeOfAPlainMemberAccess", () => {
    const declared = parseSync("spec.ts", "const written = report.id;").program
      .body[0] as ESTree.VariableDeclaration;
    return syntaxShapeOf(declared.declarations[0]?.init);
  })
  .extend("shapeOfAnAwaitedCall", () => {
    const declared = parseSync("spec.ts", "const written = await summarise();").program
      .body[0] as ESTree.VariableDeclaration;
    return syntaxShapeOf(declared.declarations[0]?.init);
  })
  .extend("shapeOfTheSameCallWithoutTheAwait", () => {
    const declared = parseSync("spec.ts", "const written = summarise();").program
      .body[0] as ESTree.VariableDeclaration;
    return syntaxShapeOf(declared.declarations[0]?.init);
  })
  .extend("shapeOfAnObjectHoldingTheNameTotal", () => {
    const declared = parseSync("spec.ts", "const written = { id: total };").program
      .body[0] as ESTree.VariableDeclaration;
    return syntaxShapeOf(declared.declarations[0]?.init);
  })
  .extend("shapeOfAnObjectHoldingTheNameCount", () => {
    const declared = parseSync("spec.ts", "const written = { id: count };").program
      .body[0] as ESTree.VariableDeclaration;
    return syntaxShapeOf(declared.declarations[0]?.init);
  })
  .extend("shapeOfAnObjectKeyedByName", () => {
    const declared = parseSync("spec.ts", 'const written = { name: "a" };').program
      .body[0] as ESTree.VariableDeclaration;
    return syntaxShapeOf(declared.declarations[0]?.init);
  })
  .extend("shapeOfACallToSummarise", () => {
    const declared = parseSync("spec.ts", "const written = summarise(1);").program
      .body[0] as ESTree.VariableDeclaration;
    return syntaxShapeOf(declared.declarations[0]?.init);
  })
  .extend("shapeOfACallToReport", () => {
    const declared = parseSync("spec.ts", "const written = report(1);").program
      .body[0] as ESTree.VariableDeclaration;
    return syntaxShapeOf(declared.declarations[0]?.init);
  })
  .extend("shapeOfAnArrayWrittenLowestFirst", () => {
    const declared = parseSync("spec.ts", "const written = [1, 2];").program
      .body[0] as ESTree.VariableDeclaration;
    return syntaxShapeOf(declared.declarations[0]?.init);
  })
  .extend("shapeOfAnArrayWrittenHighestFirst", () => {
    const declared = parseSync("spec.ts", "const written = [2, 1];").program
      .body[0] as ESTree.VariableDeclaration;
    return syntaxShapeOf(declared.declarations[0]?.init);
  })
  .extend("shapeOfTheTextOne", () => {
    const declared = parseSync("spec.ts", 'const written = "1";').program
      .body[0] as ESTree.VariableDeclaration;
    return syntaxShapeOf(declared.declarations[0]?.init);
  })
  .extend("shapeOfTheNumberOne", () => {
    const declared = parseSync("spec.ts", "const written = 1;").program
      .body[0] as ESTree.VariableDeclaration;
    return syntaxShapeOf(declared.declarations[0]?.init);
  })
  .extend("shapeOfThePatternMatchingA", () => {
    const declared = parseSync("spec.ts", "const written = /a/u;").program
      .body[0] as ESTree.VariableDeclaration;
    return syntaxShapeOf(declared.declarations[0]?.init);
  })
  .extend("shapeOfThePatternMatchingB", () => {
    const declared = parseSync("spec.ts", "const written = /b/u;").program
      .body[0] as ESTree.VariableDeclaration;
    return syntaxShapeOf(declared.declarations[0]?.init);
  })
  .extend("shapeOfThePatternMatchingAWrittenAgain", () => {
    const declared = parseSync("spec.ts", "const written = /a/u;").program
      .body[0] as ESTree.VariableDeclaration;
    return syntaxShapeOf(declared.declarations[0]?.init);
  })
  .extend("shapeOfAWideIntegerOne", () => {
    const declared = parseSync("spec.ts", "const written = 1n;").program
      .body[0] as ESTree.VariableDeclaration;
    return syntaxShapeOf(declared.declarations[0]?.init);
  })
  .extend("shapeOfAWideIntegerOneWrittenAgain", () => {
    const declared = parseSync("spec.ts", "const written = 1n;").program
      .body[0] as ESTree.VariableDeclaration;
    return syntaxShapeOf(declared.declarations[0]?.init);
  })
  .extend("shapeOfATemplateSubstitutingTheId", () => {
    const declared = parseSync("spec.ts", "const written = `a${id}`;").program
      .body[0] as ESTree.VariableDeclaration;
    return syntaxShapeOf(declared.declarations[0]?.init);
  })
  .extend("shapeOfATemplateSubstitutingTheTotal", () => {
    const declared = parseSync("spec.ts", "const written = `a${total}`;").program
      .body[0] as ESTree.VariableDeclaration;
    return syntaxShapeOf(declared.declarations[0]?.init);
  })
  .extend("shapeOfATemplateSubstitutingTheIdWrittenAgain", () => {
    const declared = parseSync("spec.ts", "const written = `a${id}`;").program
      .body[0] as ESTree.VariableDeclaration;
    return syntaxShapeOf(declared.declarations[0]?.init);
  })
  .extend("shapeOfAValueHandedNowhere", () => {
    const declared = parseSync("spec.ts", "const written = undefined;").program
      .body[0] as ESTree.VariableDeclaration;
    return syntaxShapeOf(declared.declarations[0]?.init);
  })
  .extend("shapeOfAValueHandedToACall", () => {
    const declared = parseSync("spec.ts", "const written = summarise(undefined);").program
      .body[0] as ESTree.VariableDeclaration;
    return syntaxShapeOf(declared.declarations[0]?.init);
  })
  .extend("shapeOfATemplateHoldingNoPieceOfText", () =>
    syntaxShapeOf({ type: "TemplateLiteral", expressions: [], quasis: [] }),
  )
  .extend("shapeOfAnEmptyString", () => {
    const declared = parseSync("spec.ts", 'const written = "";').program
      .body[0] as ESTree.VariableDeclaration;
    return syntaxShapeOf(declared.declarations[0]?.init);
  });

describe("notation this reading absorbs", () => {
  it("the quotes a string is written in are notation", ({
    shapeOfAnObjectHoldingASingleQuotedString,
    shapeOfAnObjectHoldingADoubleQuotedString,
  }) => {
    expect(shapeOfAnObjectHoldingASingleQuotedString).toBe(
      shapeOfAnObjectHoldingADoubleQuotedString,
    );
  });

  it("a template with nothing substituted into it spells the same string", ({
    shapeOfATemplateWithoutSubstitutions,
    shapeOfAStringSpelledWithQuotes,
  }) => {
    expect(shapeOfATemplateWithoutSubstitutions).toBe(shapeOfAStringSpelledWithQuotes);
  });

  it("the notation a number is written in is notation", ({
    shapeOfAWholeNumber,
    shapeOfANumberCarryingATrailingZero,
  }) => {
    expect(shapeOfAWholeNumber).toBe(shapeOfANumberCarryingATrailingZero);
  });

  it("a number written in hexadecimal is the same number", ({
    shapeOfAWholeNumber,
    shapeOfANumberWrittenInHexadecimal,
  }) => {
    expect(shapeOfAWholeNumber).toBe(shapeOfANumberWrittenInHexadecimal);
  });

  it("the order properties are written in is notation", ({
    shapeOfAnObjectNamingTheIdFirst,
    shapeOfAnObjectNamingTheTotalFirst,
  }) => {
    expect(shapeOfAnObjectNamingTheIdFirst).toBe(shapeOfAnObjectNamingTheTotalFirst);
  });

  it("a property written in shorthand names the same property", ({
    shapeOfAPropertyWrittenInShorthand,
    shapeOfAPropertyWrittenOutInFull,
  }) => {
    expect(shapeOfAPropertyWrittenInShorthand).toBe(shapeOfAPropertyWrittenOutInFull);
  });

  it("a trailing comma is notation", ({
    shapeOfAnObjectHoldingADoubleQuotedString,
    shapeOfAnObjectClosedWithATrailingComma,
  }) => {
    expect(shapeOfAnObjectHoldingADoubleQuotedString).toBe(shapeOfAnObjectClosedWithATrailingComma);
  });

  it("parentheses around an expression are notation", ({
    shapeOfAnObjectWrappedInParentheses,
    shapeOfAnObjectHoldingADoubleQuotedString,
  }) => {
    expect(shapeOfAnObjectWrappedInParentheses).toBe(shapeOfAnObjectHoldingADoubleQuotedString);
  });

  it("line breaks and indentation are notation", ({
    shapeOfAnObjectBrokenAcrossLines,
    shapeOfAnObjectNamingTheIdFirst,
  }) => {
    expect(shapeOfAnObjectBrokenAcrossLines).toBe(shapeOfAnObjectNamingTheIdFirst);
  });

  it("a type assertion around an expression leaves the expression it wraps", ({
    shapeOfAnObjectUnderATypeAssertion,
    shapeOfAnObjectHoldingADoubleQuotedString,
  }) => {
    expect(shapeOfAnObjectUnderATypeAssertion).toBe(shapeOfAnObjectHoldingADoubleQuotedString);
  });

  it("a satisfies clause around an expression leaves the expression it wraps", ({
    shapeOfAnObjectUnderASatisfiesClause,
    shapeOfAnObjectHoldingADoubleQuotedString,
  }) => {
    expect(shapeOfAnObjectUnderASatisfiesClause).toBe(shapeOfAnObjectHoldingADoubleQuotedString);
  });

  it("a non-null assertion leaves the expression it wraps", ({
    shapeOfANameUnderANonNullAssertion,
    shapeOfABareName,
  }) => {
    expect(shapeOfANameUnderANonNullAssertion).toBe(shapeOfABareName);
  });

  it("an optional member access reaches the same member", ({
    shapeOfAnOptionalMemberAccess,
    shapeOfAPlainMemberAccess,
  }) => {
    expect(shapeOfAnOptionalMemberAccess).toBe(shapeOfAPlainMemberAccess);
  });

  it("awaiting an expression leaves the expression it wraps", ({
    shapeOfAnAwaitedCall,
    shapeOfTheSameCallWithoutTheAwait,
  }) => {
    expect(shapeOfAnAwaitedCall).toBe(shapeOfTheSameCallWithoutTheAwait);
  });
});

describe("what this reading keeps apart", () => {
  it("two spellings of a name are two names", ({
    shapeOfAnObjectHoldingTheNameTotal,
    shapeOfAnObjectHoldingTheNameCount,
  }) => {
    expect(shapeOfAnObjectHoldingTheNameTotal).not.toBe(shapeOfAnObjectHoldingTheNameCount);
  });

  it("two property names are two properties", ({
    shapeOfAnObjectHoldingADoubleQuotedString,
    shapeOfAnObjectKeyedByName,
  }) => {
    expect(shapeOfAnObjectHoldingADoubleQuotedString).not.toBe(shapeOfAnObjectKeyedByName);
  });

  it("two callees are two calls", ({ shapeOfACallToSummarise, shapeOfACallToReport }) => {
    expect(shapeOfACallToSummarise).not.toBe(shapeOfACallToReport);
  });

  it("the order of array elements is part of the value", ({
    shapeOfAnArrayWrittenLowestFirst,
    shapeOfAnArrayWrittenHighestFirst,
  }) => {
    expect(shapeOfAnArrayWrittenLowestFirst).not.toBe(shapeOfAnArrayWrittenHighestFirst);
  });

  it("a string and a number written the same way are two values", ({
    shapeOfTheTextOne,
    shapeOfTheNumberOne,
  }) => {
    expect(shapeOfTheTextOne).not.toBe(shapeOfTheNumberOne);
  });

  it("two patterns are two regular expressions", ({
    shapeOfThePatternMatchingA,
    shapeOfThePatternMatchingB,
  }) => {
    expect(shapeOfThePatternMatchingA).not.toBe(shapeOfThePatternMatchingB);
  });

  it("the same pattern is the same regular expression", ({
    shapeOfThePatternMatchingA,
    shapeOfThePatternMatchingAWrittenAgain,
  }) => {
    expect(shapeOfThePatternMatchingA).toBe(shapeOfThePatternMatchingAWrittenAgain);
  });

  it("a wide integer and a number are two values", ({
    shapeOfAWideIntegerOne,
    shapeOfTheNumberOne,
  }) => {
    expect(shapeOfAWideIntegerOne).not.toBe(shapeOfTheNumberOne);
  });

  it("the same wide integer is the same value", ({
    shapeOfAWideIntegerOne,
    shapeOfAWideIntegerOneWrittenAgain,
  }) => {
    expect(shapeOfAWideIntegerOne).toBe(shapeOfAWideIntegerOneWrittenAgain);
  });

  it("two substitutions into a template are two strings", ({
    shapeOfATemplateSubstitutingTheId,
    shapeOfATemplateSubstitutingTheTotal,
  }) => {
    expect(shapeOfATemplateSubstitutingTheId).not.toBe(shapeOfATemplateSubstitutingTheTotal);
  });

  it("the same substitution into a template is the same string", ({
    shapeOfATemplateSubstitutingTheId,
    shapeOfATemplateSubstitutingTheIdWrittenAgain,
  }) => {
    expect(shapeOfATemplateSubstitutingTheId).toBe(shapeOfATemplateSubstitutingTheIdWrittenAgain);
  });

  it("a value handed nowhere is spelled apart from a value handed to a call", ({
    shapeOfAValueHandedNowhere,
    shapeOfAValueHandedToACall,
  }) => {
    expect(shapeOfAValueHandedNowhere).not.toBe(shapeOfAValueHandedToACall);
  });

  it("a template holding no piece of text spells no string of its own", ({
    shapeOfATemplateHoldingNoPieceOfText,
    shapeOfAnEmptyString,
  }) => {
    expect(shapeOfATemplateHoldingNoPieceOfText).not.toBe(shapeOfAnEmptyString);
  });
});
