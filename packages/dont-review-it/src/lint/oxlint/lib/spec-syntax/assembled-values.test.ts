import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { assembledShapeOf, isEmptyContainer, WRITTEN_OUT_SHAPE } from "./assembled-values.ts";

import type { ESTree } from "@oxlint/plugins";

const it = test
  .extend("shapeOfAStringSpelledOutInTheSource", () => {
    const declared = parseSync("spec.ts", 'const written = "a";').program
      .body[0] as ESTree.VariableDeclaration;
    const declarator = declared.declarations[0] as ESTree.VariableDeclarator;
    return assembledShapeOf(declarator.init as ESTree.Expression);
  })
  .extend("shapeOfATemplateWithoutSubstitutions", () => {
    const declared = parseSync("spec.ts", "const written = `a`;").program
      .body[0] as ESTree.VariableDeclaration;
    const declarator = declared.declarations[0] as ESTree.VariableDeclarator;
    return assembledShapeOf(declarator.init as ESTree.Expression);
  })
  .extend("shapeOfATemplateCarryingASubstitution", () => {
    const declared = parseSync("spec.ts", "const written = `id ${report.id}`;").program
      .body[0] as ESTree.VariableDeclaration;
    const declarator = declared.declarations[0] as ESTree.VariableDeclarator;
    return assembledShapeOf(declarator.init as ESTree.Expression);
  })
  .extend("shapeOfTheNameOfTheAbsentValue", () => {
    const declared = parseSync("spec.ts", "const written = undefined;").program
      .body[0] as ESTree.VariableDeclaration;
    const declarator = declared.declarations[0] as ESTree.VariableDeclarator;
    return assembledShapeOf(declarator.init as ESTree.Expression);
  })
  .extend("shapeOfANameOtherThanTheAbsentValue", () => {
    const declared = parseSync("spec.ts", "const written = report;").program
      .body[0] as ESTree.VariableDeclaration;
    const declarator = declared.declarations[0] as ESTree.VariableDeclarator;
    return assembledShapeOf(declarator.init as ESTree.Expression);
  })
  .extend("shapeOfADiscardedExpression", () => {
    const declared = parseSync("spec.ts", "const written = void 0;").program
      .body[0] as ESTree.VariableDeclaration;
    const declarator = declared.declarations[0] as ESTree.VariableDeclarator;
    return assembledShapeOf(declarator.init as ESTree.Expression);
  })
  .extend("shapeOfASignedNumber", () => {
    const declared = parseSync("spec.ts", "const written = -1;").program
      .body[0] as ESTree.VariableDeclaration;
    const declarator = declared.declarations[0] as ESTree.VariableDeclarator;
    return assembledShapeOf(declarator.init as ESTree.Expression);
  })
  .extend("shapeOfASignInFrontOfAName", () => {
    const declared = parseSync("spec.ts", "const written = -count;").program
      .body[0] as ESTree.VariableDeclaration;
    const declarator = declared.declarations[0] as ESTree.VariableDeclarator;
    return assembledShapeOf(declarator.init as ESTree.Expression);
  })
  .extend("shapeOfAnOperatorStandingInFrontOfAName", () => {
    const declared = parseSync("spec.ts", "const written = !flag;").program
      .body[0] as ESTree.VariableDeclaration;
    const declarator = declared.declarations[0] as ESTree.VariableDeclarator;
    return assembledShapeOf(declarator.init as ESTree.Expression);
  })
  .extend("shapeOfAnOperatorStandingInFrontOfASpelledOutValue", () => {
    const declared = parseSync("spec.ts", "const written = !true;").program
      .body[0] as ESTree.VariableDeclaration;
    const declarator = declared.declarations[0] as ESTree.VariableDeclarator;
    return assembledShapeOf(declarator.init as ESTree.Expression);
  })
  .extend("shapeOfAnObjectLiteral", () => {
    const declared = parseSync("spec.ts", 'const written = { id: "a" };').program
      .body[0] as ESTree.VariableDeclaration;
    const declarator = declared.declarations[0] as ESTree.VariableDeclarator;
    return assembledShapeOf(declarator.init as ESTree.Expression);
  })
  .extend("shapeOfAnArrayLiteral", () => {
    const declared = parseSync("spec.ts", 'const written = ["a"];').program
      .body[0] as ESTree.VariableDeclaration;
    const declarator = declared.declarations[0] as ESTree.VariableDeclarator;
    return assembledShapeOf(declarator.init as ESTree.Expression);
  })
  .extend("shapeOfAConstructorCall", () => {
    const declared = parseSync("spec.ts", "const written = new Report(input);").program
      .body[0] as ESTree.VariableDeclaration;
    const declarator = declared.declarations[0] as ESTree.VariableDeclarator;
    return assembledShapeOf(declarator.init as ESTree.Expression);
  })
  .extend("shapeOfATypeAssertionAroundAnAssembledShape", () => {
    const declared = parseSync("spec.ts", 'const written = ({ id: "a" }) as Report;').program
      .body[0] as ESTree.VariableDeclaration;
    const declarator = declared.declarations[0] as ESTree.VariableDeclarator;
    return assembledShapeOf(declarator.init as ESTree.Expression);
  })
  .extend("shapeOfACall", () => {
    const declared = parseSync("spec.ts", "const written = summarise(input);").program
      .body[0] as ESTree.VariableDeclaration;
    const declarator = declared.declarations[0] as ESTree.VariableDeclarator;
    return assembledShapeOf(declarator.init as ESTree.Expression);
  })
  .extend("emptinessOfAnArrayLiteralHoldingNothing", () => {
    const declared = parseSync("spec.ts", "const written = [];").program
      .body[0] as ESTree.VariableDeclaration;
    const declarator = declared.declarations[0] as ESTree.VariableDeclarator;
    return isEmptyContainer(declarator.init as ESTree.Expression);
  })
  .extend("emptinessOfAnObjectLiteralHoldingNothing", () => {
    const declared = parseSync("spec.ts", "const written = ({});").program
      .body[0] as ESTree.VariableDeclaration;
    const declarator = declared.declarations[0] as ESTree.VariableDeclarator;
    return isEmptyContainer(declarator.init as ESTree.Expression);
  })
  .extend("emptinessOfAnArrayLiteralHoldingAnElement", () => {
    const declared = parseSync("spec.ts", "const written = [seed];").program
      .body[0] as ESTree.VariableDeclaration;
    const declarator = declared.declarations[0] as ESTree.VariableDeclarator;
    return isEmptyContainer(declarator.init as ESTree.Expression);
  })
  .extend("emptinessOfAnObjectLiteralHoldingAProperty", () => {
    const declared = parseSync("spec.ts", 'const written = ({ id: "a" });').program
      .body[0] as ESTree.VariableDeclaration;
    const declarator = declared.declarations[0] as ESTree.VariableDeclarator;
    return isEmptyContainer(declarator.init as ESTree.Expression);
  })
  .extend("emptinessOfACall", () => {
    const declared = parseSync("spec.ts", "const written = summarise(input);").program
      .body[0] as ESTree.VariableDeclaration;
    const declarator = declared.declarations[0] as ESTree.VariableDeclarator;
    return isEmptyContainer(declarator.init as ESTree.Expression);
  });

describe("assembled-values", () => {
  it("a string spelled out in the source is a value the spec wrote", ({
    shapeOfAStringSpelledOutInTheSource,
  }) => {
    expect(shapeOfAStringSpelledOutInTheSource).toBe(WRITTEN_OUT_SHAPE);
  });

  it("a template without substitutions is a value the spec wrote", ({
    shapeOfATemplateWithoutSubstitutions,
  }) => {
    expect(shapeOfATemplateWithoutSubstitutions).toBe(WRITTEN_OUT_SHAPE);
  });

  it("a template carrying a substitution is not a value this reading can spell", ({
    shapeOfATemplateCarryingASubstitution,
  }) => {
    expect(shapeOfATemplateCarryingASubstitution).toBe(null);
  });

  it("the name of the absent value is a value the spec wrote", ({
    shapeOfTheNameOfTheAbsentValue,
  }) => {
    expect(shapeOfTheNameOfTheAbsentValue).toBe(WRITTEN_OUT_SHAPE);
  });

  it("a name other than the absent value is not a value this reading can spell", ({
    shapeOfANameOtherThanTheAbsentValue,
  }) => {
    expect(shapeOfANameOtherThanTheAbsentValue).toBe(null);
  });

  it("discarding an expression spells the absent value out", ({ shapeOfADiscardedExpression }) => {
    expect(shapeOfADiscardedExpression).toBe(WRITTEN_OUT_SHAPE);
  });

  it("a signed number is still a number spelled out in the source", ({ shapeOfASignedNumber }) => {
    expect(shapeOfASignedNumber).toBe(WRITTEN_OUT_SHAPE);
  });

  it("a sign in front of a name spells nothing out", ({ shapeOfASignInFrontOfAName }) => {
    expect(shapeOfASignInFrontOfAName).toBe(null);
  });

  it("an operator standing in front of a name spells nothing out", ({
    shapeOfAnOperatorStandingInFrontOfAName,
  }) => {
    expect(shapeOfAnOperatorStandingInFrontOfAName).toBe(null);
  });

  it("an operator standing in front of a spelled-out value spells one out", ({
    shapeOfAnOperatorStandingInFrontOfASpelledOutValue,
  }) => {
    expect(shapeOfAnOperatorStandingInFrontOfASpelledOutValue).toBe(WRITTEN_OUT_SHAPE);
  });

  it("an object literal is a shape the spec assembled", ({ shapeOfAnObjectLiteral }) => {
    expect(shapeOfAnObjectLiteral).toBe("an object literal");
  });

  it("an array literal is a shape the spec assembled", ({ shapeOfAnArrayLiteral }) => {
    expect(shapeOfAnArrayLiteral).toBe("an array literal");
  });

  it("a constructor call is a shape the spec assembled", ({ shapeOfAConstructorCall }) => {
    expect(shapeOfAConstructorCall).toBe("a value a constructor built here");
  });

  it("a type assertion around an assembled shape is stripped before it is read", ({
    shapeOfATypeAssertionAroundAnAssembledShape,
  }) => {
    expect(shapeOfATypeAssertionAroundAnAssembledShape).toBe("an object literal");
  });

  it("a call is not a shape the spec assembled", ({ shapeOfACall }) => {
    expect(shapeOfACall).toBe(null);
  });

  it("an array literal holding nothing is an empty container", ({
    emptinessOfAnArrayLiteralHoldingNothing,
  }) => {
    expect(emptinessOfAnArrayLiteralHoldingNothing).toBe(true);
  });

  it("an object literal holding nothing is an empty container", ({
    emptinessOfAnObjectLiteralHoldingNothing,
  }) => {
    expect(emptinessOfAnObjectLiteralHoldingNothing).toBe(true);
  });

  it("an array literal holding an element is not an empty container", ({
    emptinessOfAnArrayLiteralHoldingAnElement,
  }) => {
    expect(emptinessOfAnArrayLiteralHoldingAnElement).toBe(false);
  });

  it("an object literal holding a property is not an empty container", ({
    emptinessOfAnObjectLiteralHoldingAProperty,
  }) => {
    expect(emptinessOfAnObjectLiteralHoldingAProperty).toBe(false);
  });

  it("a call is not a container this reading can see into", ({ emptinessOfACall }) => {
    expect(emptinessOfACall).toBe(false);
  });
});
