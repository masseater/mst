import { identity } from "es-toolkit";
import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { comparedPositionsOf, isSettledShape } from "./compared-positions.ts";

import type { ESTree } from "@oxlint/plugins";

const it = test
  .extend("spellingsOfTheComparisonBetweenANameAndAConstruction", () => {
    const left = parseSync("spec.ts", "const written = subject;").program
      .body[0] as ESTree.VariableDeclaration;
    const right = parseSync("spec.ts", "const written = new Response('a');").program
      .body[0] as ESTree.VariableDeclaration;
    return comparedPositionsOf({
      left: left.declarations[0]?.init as ESTree.Expression,
      right: right.declarations[0]?.init as ESTree.Expression,
      resolve: identity,
    }).map(
      (pair) =>
        `${pair.left === null ? "none" : pair.left.type}/${pair.right === null ? "none" : pair.right.type}`,
    );
  })
  .extend("spellingsOfTheComparisonWithNothingOnTheRight", () => {
    const left = parseSync("spec.ts", "const written = new Response('a');").program
      .body[0] as ESTree.VariableDeclaration;
    return comparedPositionsOf({
      left: left.declarations[0]?.init as ESTree.Expression,
      right: null,
      resolve: identity,
    }).map(
      (pair) =>
        `${pair.left === null ? "none" : pair.left.type}/${pair.right === null ? "none" : pair.right.type}`,
    );
  })
  .extend("spellingsOfTheComparisonWithNothingOnTheLeft", () => {
    const right = parseSync("spec.ts", "const written = new Response('a');").program
      .body[0] as ESTree.VariableDeclaration;
    return comparedPositionsOf({
      left: null,
      right: right.declarations[0]?.init as ESTree.Expression,
      resolve: identity,
    }).map(
      (pair) =>
        `${pair.left === null ? "none" : pair.left.type}/${pair.right === null ? "none" : pair.right.type}`,
    );
  })
  .extend("spellingsOfTheComparisonsBetweenTwoObjects", () => {
    const left = parseSync("spec.ts", "const written = { a: subject, b: 1 };").program
      .body[0] as ESTree.VariableDeclaration;
    const right = parseSync("spec.ts", "const written = { b: 2, a: new Response('a') };").program
      .body[0] as ESTree.VariableDeclaration;
    return comparedPositionsOf({
      left: left.declarations[0]?.init as ESTree.Expression,
      right: right.declarations[0]?.init as ESTree.Expression,
      resolve: identity,
    }).map(
      (pair) =>
        `${pair.left === null ? "none" : pair.left.type}/${pair.right === null ? "none" : pair.right.type}`,
    );
  })
  .extend("spellingsOfTheComparisonsBetweenANumberedKeyAndASpelledKey", () => {
    const left = parseSync("spec.ts", "const written = { 1: subject };").program
      .body[0] as ESTree.VariableDeclaration;
    const right = parseSync("spec.ts", "const written = { '1': new Response('a') };").program
      .body[0] as ESTree.VariableDeclaration;
    return comparedPositionsOf({
      left: left.declarations[0]?.init as ESTree.Expression,
      right: right.declarations[0]?.init as ESTree.Expression,
      resolve: identity,
    }).map(
      (pair) =>
        `${pair.left === null ? "none" : pair.left.type}/${pair.right === null ? "none" : pair.right.type}`,
    );
  })
  .extend("spellingsOfTheComparisonsBetweenATemplateKeyAndASpelledKey", () => {
    const left = parseSync("spec.ts", "const written = { [`a`]: subject };").program
      .body[0] as ESTree.VariableDeclaration;
    const right = parseSync("spec.ts", "const written = { a: new Response('a') };").program
      .body[0] as ESTree.VariableDeclaration;
    return comparedPositionsOf({
      left: left.declarations[0]?.init as ESTree.Expression,
      right: right.declarations[0]?.init as ESTree.Expression,
      resolve: identity,
    }).map(
      (pair) =>
        `${pair.left === null ? "none" : pair.left.type}/${pair.right === null ? "none" : pair.right.type}`,
    );
  })
  .extend("spellingsOfTheComparisonsUnderADuplicatedKey", () => {
    const left = parseSync("spec.ts", "const written = { a: 1, a: subject };").program
      .body[0] as ESTree.VariableDeclaration;
    const right = parseSync("spec.ts", "const written = { a: new Response('a') };").program
      .body[0] as ESTree.VariableDeclaration;
    return comparedPositionsOf({
      left: left.declarations[0]?.init as ESTree.Expression,
      right: right.declarations[0]?.init as ESTree.Expression,
      resolve: identity,
    }).map(
      (pair) =>
        `${pair.left === null ? "none" : pair.left.type}/${pair.right === null ? "none" : pair.right.type}`,
    );
  })
  .extend("spellingsOfTheComparisonsBetweenAnObjectAndAnOpenValue", () => {
    const left = parseSync("spec.ts", "const written = { a: new Response('a') };").program
      .body[0] as ESTree.VariableDeclaration;
    const right = parseSync("spec.ts", "const written = subject;").program
      .body[0] as ESTree.VariableDeclaration;
    return comparedPositionsOf({
      left: left.declarations[0]?.init as ESTree.Expression,
      right: right.declarations[0]?.init as ESTree.Expression,
      resolve: identity,
    }).map(
      (pair) =>
        `${pair.left === null ? "none" : pair.left.type}/${pair.right === null ? "none" : pair.right.type}`,
    );
  })
  .extend("spellingsOfTheComparisonsBetweenAnOpenValueAndAnObject", () => {
    const left = parseSync("spec.ts", "const written = subject;").program
      .body[0] as ESTree.VariableDeclaration;
    const right = parseSync("spec.ts", "const written = { a: new Response('a') };").program
      .body[0] as ESTree.VariableDeclaration;
    return comparedPositionsOf({
      left: left.declarations[0]?.init as ESTree.Expression,
      right: right.declarations[0]?.init as ESTree.Expression,
      resolve: identity,
    }).map(
      (pair) =>
        `${pair.left === null ? "none" : pair.left.type}/${pair.right === null ? "none" : pair.right.type}`,
    );
  })
  .extend("spellingsOfTheComparisonsBetweenTwoArrays", () => {
    const left = parseSync("spec.ts", "const written = [subject, 1];").program
      .body[0] as ESTree.VariableDeclaration;
    const right = parseSync("spec.ts", "const written = [new Response('a'), 2];").program
      .body[0] as ESTree.VariableDeclaration;
    return comparedPositionsOf({
      left: left.declarations[0]?.init as ESTree.Expression,
      right: right.declarations[0]?.init as ESTree.Expression,
      resolve: identity,
    }).map(
      (pair) =>
        `${pair.left === null ? "none" : pair.left.type}/${pair.right === null ? "none" : pair.right.type}`,
    );
  })
  .extend("spellingsOfTheComparisonsBetweenArraysHoldingHolesAtTheSameIndex", () => {
    const left = parseSync("spec.ts", "const written = [, subject];").program
      .body[0] as ESTree.VariableDeclaration;
    const right = parseSync("spec.ts", "const written = [, new Response('a')];").program
      .body[0] as ESTree.VariableDeclaration;
    return comparedPositionsOf({
      left: left.declarations[0]?.init as ESTree.Expression,
      right: right.declarations[0]?.init as ESTree.Expression,
      resolve: identity,
    }).map(
      (pair) =>
        `${pair.left === null ? "none" : pair.left.type}/${pair.right === null ? "none" : pair.right.type}`,
    );
  })
  .extend("spellingsOfTheComparisonsBetweenAnArrayAndAnOpenValue", () => {
    const left = parseSync("spec.ts", "const written = [new Response('a')];").program
      .body[0] as ESTree.VariableDeclaration;
    const right = parseSync("spec.ts", "const written = subject;").program
      .body[0] as ESTree.VariableDeclaration;
    return comparedPositionsOf({
      left: left.declarations[0]?.init as ESTree.Expression,
      right: right.declarations[0]?.init as ESTree.Expression,
      resolve: identity,
    }).map(
      (pair) =>
        `${pair.left === null ? "none" : pair.left.type}/${pair.right === null ? "none" : pair.right.type}`,
    );
  })
  .extend("spellingsOfTheComparisonsBetweenAnOpenValueAndAnArray", () => {
    const left = parseSync("spec.ts", "const written = subject;").program
      .body[0] as ESTree.VariableDeclaration;
    const right = parseSync("spec.ts", "const written = [new Response('a')];").program
      .body[0] as ESTree.VariableDeclaration;
    return comparedPositionsOf({
      left: left.declarations[0]?.init as ESTree.Expression,
      right: right.declarations[0]?.init as ESTree.Expression,
      resolve: identity,
    }).map(
      (pair) =>
        `${pair.left === null ? "none" : pair.left.type}/${pair.right === null ? "none" : pair.right.type}`,
    );
  })
  .extend("spellingsOfTheComparisonsBetweenAnArrayHoldingAHoleAndAnOpenValue", () => {
    const left = parseSync("spec.ts", "const written = [, new Response('a')];").program
      .body[0] as ESTree.VariableDeclaration;
    const right = parseSync("spec.ts", "const written = subject;").program
      .body[0] as ESTree.VariableDeclaration;
    return comparedPositionsOf({
      left: left.declarations[0]?.init as ESTree.Expression,
      right: right.declarations[0]?.init as ESTree.Expression,
      resolve: identity,
    }).map(
      (pair) =>
        `${pair.left === null ? "none" : pair.left.type}/${pair.right === null ? "none" : pair.right.type}`,
    );
  })
  .extend("spellingsOfTheComparisonsBetweenContainersNestedInsideContainers", () => {
    const left = parseSync("spec.ts", "const written = { body: [subject] };").program
      .body[0] as ESTree.VariableDeclaration;
    const right = parseSync("spec.ts", "const written = { body: [new Response('a')] };").program
      .body[0] as ESTree.VariableDeclaration;
    return comparedPositionsOf({
      left: left.declarations[0]?.init as ESTree.Expression,
      right: right.declarations[0]?.init as ESTree.Expression,
      resolve: identity,
    }).map(
      (pair) =>
        `${pair.left === null ? "none" : pair.left.type}/${pair.right === null ? "none" : pair.right.type}`,
    );
  })
  .extend("positionsBetweenObjectsKeyedDifferently", () => {
    const left = parseSync("spec.ts", "const written = { a: subject };").program
      .body[0] as ESTree.VariableDeclaration;
    const right = parseSync("spec.ts", "const written = { b: subject };").program
      .body[0] as ESTree.VariableDeclaration;
    return comparedPositionsOf({
      left: left.declarations[0]?.init as ESTree.Expression,
      right: right.declarations[0]?.init as ESTree.Expression,
      resolve: identity,
    });
  })
  .extend("positionsBetweenObjectsCarryingDifferentKeyCounts", () => {
    const left = parseSync("spec.ts", "const written = { a: subject };").program
      .body[0] as ESTree.VariableDeclaration;
    const right = parseSync("spec.ts", "const written = { a: subject, b: subject };").program
      .body[0] as ESTree.VariableDeclaration;
    return comparedPositionsOf({
      left: left.declarations[0]?.init as ESTree.Expression,
      right: right.declarations[0]?.init as ESTree.Expression,
      resolve: identity,
    });
  })
  .extend("positionsBetweenAnObjectHoldingASpreadAndAnObjectHoldingAKey", () => {
    const left = parseSync("spec.ts", "const written = { ...rest };").program
      .body[0] as ESTree.VariableDeclaration;
    const right = parseSync("spec.ts", "const written = { a: subject };").program
      .body[0] as ESTree.VariableDeclaration;
    return comparedPositionsOf({
      left: left.declarations[0]?.init as ESTree.Expression,
      right: right.declarations[0]?.init as ESTree.Expression,
      resolve: identity,
    });
  })
  .extend("positionsBetweenAnObjectHoldingAKeyAndAnObjectHoldingASpread", () => {
    const left = parseSync("spec.ts", "const written = { a: subject };").program
      .body[0] as ESTree.VariableDeclaration;
    const right = parseSync("spec.ts", "const written = { ...rest };").program
      .body[0] as ESTree.VariableDeclaration;
    return comparedPositionsOf({
      left: left.declarations[0]?.init as ESTree.Expression,
      right: right.declarations[0]?.init as ESTree.Expression,
      resolve: identity,
    });
  })
  .extend("positionsBetweenAnObjectKeyedAtRunTimeAndAnObjectKeyedBySpelling", () => {
    const left = parseSync("spec.ts", "const written = { [field]: subject };").program
      .body[0] as ESTree.VariableDeclaration;
    const right = parseSync("spec.ts", "const written = { a: subject };").program
      .body[0] as ESTree.VariableDeclaration;
    return comparedPositionsOf({
      left: left.declarations[0]?.init as ESTree.Expression,
      right: right.declarations[0]?.init as ESTree.Expression,
      resolve: identity,
    });
  })
  .extend("positionsBetweenAnObjectAndASettledString", () => {
    const left = parseSync("spec.ts", "const written = { a: subject };").program
      .body[0] as ESTree.VariableDeclaration;
    const right = parseSync("spec.ts", "const written = 'ok';").program
      .body[0] as ESTree.VariableDeclaration;
    return comparedPositionsOf({
      left: left.declarations[0]?.init as ESTree.Expression,
      right: right.declarations[0]?.init as ESTree.Expression,
      resolve: identity,
    });
  })
  .extend("positionsBetweenAnObjectAndASettledArray", () => {
    const left = parseSync("spec.ts", "const written = { a: subject };").program
      .body[0] as ESTree.VariableDeclaration;
    const right = parseSync("spec.ts", "const written = [subject];").program
      .body[0] as ESTree.VariableDeclaration;
    return comparedPositionsOf({
      left: left.declarations[0]?.init as ESTree.Expression,
      right: right.declarations[0]?.init as ESTree.Expression,
      resolve: identity,
    });
  })
  .extend("positionsBetweenArraysOfDifferentLengths", () => {
    const left = parseSync("spec.ts", "const written = [subject];").program
      .body[0] as ESTree.VariableDeclaration;
    const right = parseSync("spec.ts", "const written = [subject, subject];").program
      .body[0] as ESTree.VariableDeclaration;
    return comparedPositionsOf({
      left: left.declarations[0]?.init as ESTree.Expression,
      right: right.declarations[0]?.init as ESTree.Expression,
      resolve: identity,
    });
  })
  .extend("positionsBetweenAnArrayHoldingAHoleAndAnArrayHoldingAnElement", () => {
    const left = parseSync("spec.ts", "const written = [, subject];").program
      .body[0] as ESTree.VariableDeclaration;
    const right = parseSync("spec.ts", "const written = [subject, subject];").program
      .body[0] as ESTree.VariableDeclaration;
    return comparedPositionsOf({
      left: left.declarations[0]?.init as ESTree.Expression,
      right: right.declarations[0]?.init as ESTree.Expression,
      resolve: identity,
    });
  })
  .extend("positionsBetweenAnArrayHoldingASpreadAndAnArrayHoldingAnElement", () => {
    const left = parseSync("spec.ts", "const written = [...rest];").program
      .body[0] as ESTree.VariableDeclaration;
    const right = parseSync("spec.ts", "const written = [subject];").program
      .body[0] as ESTree.VariableDeclaration;
    return comparedPositionsOf({
      left: left.declarations[0]?.init as ESTree.Expression,
      right: right.declarations[0]?.init as ESTree.Expression,
      resolve: identity,
    });
  })
  .extend("positionsBetweenAnArrayHoldingAnElementAndAnArrayHoldingASpread", () => {
    const left = parseSync("spec.ts", "const written = [subject];").program
      .body[0] as ESTree.VariableDeclaration;
    const right = parseSync("spec.ts", "const written = [...rest];").program
      .body[0] as ESTree.VariableDeclaration;
    return comparedPositionsOf({
      left: left.declarations[0]?.init as ESTree.Expression,
      right: right.declarations[0]?.init as ESTree.Expression,
      resolve: identity,
    });
  })
  .extend("positionsBetweenAnArrayAndASettledString", () => {
    const left = parseSync("spec.ts", "const written = [subject];").program
      .body[0] as ESTree.VariableDeclaration;
    const right = parseSync("spec.ts", "const written = 'ok';").program
      .body[0] as ESTree.VariableDeclaration;
    return comparedPositionsOf({
      left: left.declarations[0]?.init as ESTree.Expression,
      right: right.declarations[0]?.init as ESTree.Expression,
      resolve: identity,
    });
  })
  .extend("settledReadingOfAString", () => {
    const declared = parseSync("spec.ts", "const written = 'ok';").program
      .body[0] as ESTree.VariableDeclaration;
    return isSettledShape(declared.declarations[0]?.init as ESTree.Expression);
  })
  .extend("settledReadingOfATemplate", () => {
    const declared = parseSync("spec.ts", "const written = `ok`;").program
      .body[0] as ESTree.VariableDeclaration;
    return isSettledShape(declared.declarations[0]?.init as ESTree.Expression);
  })
  .extend("settledReadingOfAnObjectLiteral", () => {
    const declared = parseSync("spec.ts", "const written = { a: 1 };").program
      .body[0] as ESTree.VariableDeclaration;
    return isSettledShape(declared.declarations[0]?.init as ESTree.Expression);
  })
  .extend("settledReadingOfAnArrayLiteral", () => {
    const declared = parseSync("spec.ts", "const written = [1];").program
      .body[0] as ESTree.VariableDeclaration;
    return isSettledShape(declared.declarations[0]?.init as ESTree.Expression);
  })
  .extend("settledReadingOfAnArrowFunction", () => {
    const declared = parseSync("spec.ts", "const written = () => 1;").program
      .body[0] as ESTree.VariableDeclaration;
    return isSettledShape(declared.declarations[0]?.init as ESTree.Expression);
  })
  .extend("settledReadingOfAFunctionExpression", () => {
    const declared = parseSync("spec.ts", "const written = function () { return 1; };").program
      .body[0] as ESTree.VariableDeclaration;
    return isSettledShape(declared.declarations[0]?.init as ESTree.Expression);
  })
  .extend("settledReadingOfAClassExpression", () => {
    const declared = parseSync("spec.ts", "const written = class {};").program
      .body[0] as ESTree.VariableDeclaration;
    return isSettledShape(declared.declarations[0]?.init as ESTree.Expression);
  })
  .extend("settledReadingOfAConstruction", () => {
    const declared = parseSync("spec.ts", "const written = new Response('a');").program
      .body[0] as ESTree.VariableDeclaration;
    return isSettledShape(declared.declarations[0]?.init as ESTree.Expression);
  })
  .extend("settledReadingOfABareName", () => {
    const declared = parseSync("spec.ts", "const written = subject;").program
      .body[0] as ESTree.VariableDeclaration;
    return isSettledShape(declared.declarations[0]?.init as ESTree.Expression);
  })
  .extend("settledReadingOfACall", () => {
    const declared = parseSync("spec.ts", "const written = read();").program
      .body[0] as ESTree.VariableDeclaration;
    return isSettledShape(declared.declarations[0]?.init as ESTree.Expression);
  })
  .extend("settledReadingOfAMemberRead", () => {
    const declared = parseSync("spec.ts", "const written = order.body;").program
      .body[0] as ESTree.VariableDeclaration;
    return isSettledShape(declared.declarations[0]?.init as ESTree.Expression);
  });

describe("compared-positions", () => {
  it("two values that are not containers line up as one pair", ({
    spellingsOfTheComparisonBetweenANameAndAConstruction,
  }) => {
    expect(spellingsOfTheComparisonBetweenANameAndAConstruction).toStrictEqual([
      "Identifier/NewExpression",
    ]);
  });

  it("a value with nothing on the right still lines up as a pair", ({
    spellingsOfTheComparisonWithNothingOnTheRight,
  }) => {
    expect(spellingsOfTheComparisonWithNothingOnTheRight).toStrictEqual(["NewExpression/none"]);
  });

  it("a value with nothing on the left still lines up as a pair", ({
    spellingsOfTheComparisonWithNothingOnTheLeft,
  }) => {
    expect(spellingsOfTheComparisonWithNothingOnTheLeft).toStrictEqual(["none/NewExpression"]);
  });

  it("two objects line up key by key", ({ spellingsOfTheComparisonsBetweenTwoObjects }) => {
    expect(spellingsOfTheComparisonsBetweenTwoObjects).toStrictEqual([
      "Identifier/NewExpression",
      "Literal/Literal",
    ]);
  });

  it("a key written as a number lines up with the same key written as text", ({
    spellingsOfTheComparisonsBetweenANumberedKeyAndASpelledKey,
  }) => {
    expect(spellingsOfTheComparisonsBetweenANumberedKeyAndASpelledKey).toStrictEqual([
      "Identifier/NewExpression",
    ]);
  });

  it("a key reached through a template without substitutions is the same key", ({
    spellingsOfTheComparisonsBetweenATemplateKeyAndASpelledKey,
  }) => {
    expect(spellingsOfTheComparisonsBetweenATemplateKeyAndASpelledKey).toStrictEqual([
      "Identifier/NewExpression",
    ]);
  });

  it("key sets that differ leave the outer comparison to fall on its own", ({
    positionsBetweenObjectsKeyedDifferently,
  }) => {
    expect(positionsBetweenObjectsKeyedDifferently).toStrictEqual([]);
  });

  it("key counts that differ leave the outer comparison to fall on its own", ({
    positionsBetweenObjectsCarryingDifferentKeyCounts,
  }) => {
    expect(positionsBetweenObjectsCarryingDifferentKeyCounts).toStrictEqual([]);
  });

  it("a spread on the left leaves the corresponding positions undecided", ({
    positionsBetweenAnObjectHoldingASpreadAndAnObjectHoldingAKey,
  }) => {
    expect(positionsBetweenAnObjectHoldingASpreadAndAnObjectHoldingAKey).toStrictEqual([]);
  });

  it("a spread on the right leaves the corresponding positions undecided", ({
    positionsBetweenAnObjectHoldingAKeyAndAnObjectHoldingASpread,
  }) => {
    expect(positionsBetweenAnObjectHoldingAKeyAndAnObjectHoldingASpread).toStrictEqual([]);
  });

  it("a key decided at run time leaves the corresponding positions undecided", ({
    positionsBetweenAnObjectKeyedAtRunTimeAndAnObjectKeyedBySpelling,
  }) => {
    expect(positionsBetweenAnObjectKeyedAtRunTimeAndAnObjectKeyedBySpelling).toStrictEqual([]);
  });

  it("a duplicated key keeps the value written last, the way the language does", ({
    spellingsOfTheComparisonsUnderADuplicatedKey,
  }) => {
    expect(spellingsOfTheComparisonsUnderADuplicatedKey).toStrictEqual([
      "Identifier/NewExpression",
    ]);
  });

  it("an object standing against a settled string leaves the comparison to fall", ({
    positionsBetweenAnObjectAndASettledString,
  }) => {
    expect(positionsBetweenAnObjectAndASettledString).toStrictEqual([]);
  });

  it("an object standing against a settled array leaves the comparison to fall", ({
    positionsBetweenAnObjectAndASettledArray,
  }) => {
    expect(positionsBetweenAnObjectAndASettledArray).toStrictEqual([]);
  });

  it("an object standing against a value nothing is known about keeps its positions open", ({
    spellingsOfTheComparisonsBetweenAnObjectAndAnOpenValue,
  }) => {
    expect(spellingsOfTheComparisonsBetweenAnObjectAndAnOpenValue).toStrictEqual([
      "NewExpression/none",
    ]);
  });

  it("a value nothing is known about standing against an object keeps its positions open", ({
    spellingsOfTheComparisonsBetweenAnOpenValueAndAnObject,
  }) => {
    expect(spellingsOfTheComparisonsBetweenAnOpenValueAndAnObject).toStrictEqual([
      "NewExpression/none",
    ]);
  });

  it("two arrays line up index by index", ({ spellingsOfTheComparisonsBetweenTwoArrays }) => {
    expect(spellingsOfTheComparisonsBetweenTwoArrays).toStrictEqual([
      "Identifier/NewExpression",
      "Literal/Literal",
    ]);
  });

  it("lengths that differ leave the outer comparison to fall on its own", ({
    positionsBetweenArraysOfDifferentLengths,
  }) => {
    expect(positionsBetweenArraysOfDifferentLengths).toStrictEqual([]);
  });

  it("a hole standing against a written element is a difference in shape", ({
    positionsBetweenAnArrayHoldingAHoleAndAnArrayHoldingAnElement,
  }) => {
    expect(positionsBetweenAnArrayHoldingAHoleAndAnArrayHoldingAnElement).toStrictEqual([]);
  });

  it("holes on both sides line up, and nothing is compared at that index", ({
    spellingsOfTheComparisonsBetweenArraysHoldingHolesAtTheSameIndex,
  }) => {
    expect(spellingsOfTheComparisonsBetweenArraysHoldingHolesAtTheSameIndex).toStrictEqual([
      "Identifier/NewExpression",
    ]);
  });

  it("a spread on the left of an array leaves the corresponding positions undecided", ({
    positionsBetweenAnArrayHoldingASpreadAndAnArrayHoldingAnElement,
  }) => {
    expect(positionsBetweenAnArrayHoldingASpreadAndAnArrayHoldingAnElement).toStrictEqual([]);
  });

  it("a spread on the right of an array leaves the corresponding positions undecided", ({
    positionsBetweenAnArrayHoldingAnElementAndAnArrayHoldingASpread,
  }) => {
    expect(positionsBetweenAnArrayHoldingAnElementAndAnArrayHoldingASpread).toStrictEqual([]);
  });

  it("an array standing against a settled shape leaves the comparison to fall", ({
    positionsBetweenAnArrayAndASettledString,
  }) => {
    expect(positionsBetweenAnArrayAndASettledString).toStrictEqual([]);
  });

  it("an array standing against a value nothing is known about keeps its positions open", ({
    spellingsOfTheComparisonsBetweenAnArrayAndAnOpenValue,
  }) => {
    expect(spellingsOfTheComparisonsBetweenAnArrayAndAnOpenValue).toStrictEqual([
      "NewExpression/none",
    ]);
  });

  it("a value nothing is known about standing against an array keeps its positions open", ({
    spellingsOfTheComparisonsBetweenAnOpenValueAndAnArray,
  }) => {
    expect(spellingsOfTheComparisonsBetweenAnOpenValueAndAnArray).toStrictEqual([
      "NewExpression/none",
    ]);
  });

  it("a hole in an array standing against an open value is compared with nothing", ({
    spellingsOfTheComparisonsBetweenAnArrayHoldingAHoleAndAnOpenValue,
  }) => {
    expect(spellingsOfTheComparisonsBetweenAnArrayHoldingAHoleAndAnOpenValue).toStrictEqual([
      "NewExpression/none",
    ]);
  });

  it("containers nested inside containers line up all the way down", ({
    spellingsOfTheComparisonsBetweenContainersNestedInsideContainers,
  }) => {
    expect(spellingsOfTheComparisonsBetweenContainersNestedInsideContainers).toStrictEqual([
      "Identifier/NewExpression",
    ]);
  });

  it("a string written out is a shape the reader can settle from the syntax alone", ({
    settledReadingOfAString,
  }) => {
    expect(settledReadingOfAString).toBe(true);
  });

  it("a template is a shape the reader can settle from the syntax alone", ({
    settledReadingOfATemplate,
  }) => {
    expect(settledReadingOfATemplate).toBe(true);
  });

  it("an object literal is a shape the reader can settle from the syntax alone", ({
    settledReadingOfAnObjectLiteral,
  }) => {
    expect(settledReadingOfAnObjectLiteral).toBe(true);
  });

  it("an array literal is a shape the reader can settle from the syntax alone", ({
    settledReadingOfAnArrayLiteral,
  }) => {
    expect(settledReadingOfAnArrayLiteral).toBe(true);
  });

  it("an arrow function is a shape the reader can settle from the syntax alone", ({
    settledReadingOfAnArrowFunction,
  }) => {
    expect(settledReadingOfAnArrowFunction).toBe(true);
  });

  it("a function expression is a shape the reader can settle from the syntax alone", ({
    settledReadingOfAFunctionExpression,
  }) => {
    expect(settledReadingOfAFunctionExpression).toBe(true);
  });

  it("a class expression is a shape the reader can settle from the syntax alone", ({
    settledReadingOfAClassExpression,
  }) => {
    expect(settledReadingOfAClassExpression).toBe(true);
  });

  it("a construction is a shape the reader can settle from the syntax alone", ({
    settledReadingOfAConstruction,
  }) => {
    expect(settledReadingOfAConstruction).toBe(true);
  });

  it("a bare name is not a shape the reader can settle from the syntax alone", ({
    settledReadingOfABareName,
  }) => {
    expect(settledReadingOfABareName).toBe(false);
  });

  it("a call is not a shape the reader can settle from the syntax alone", ({
    settledReadingOfACall,
  }) => {
    expect(settledReadingOfACall).toBe(false);
  });

  it("a member read is not a shape the reader can settle from the syntax alone", ({
    settledReadingOfAMemberRead,
  }) => {
    expect(settledReadingOfAMemberRead).toBe(false);
  });
});
