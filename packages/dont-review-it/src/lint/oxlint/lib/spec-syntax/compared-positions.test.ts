import { identity } from "es-toolkit";
import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { comparedPositionsOf, isSettledShape } from "./compared-positions.ts";

import type { ESTree } from "@oxlint/plugins";

describe("comparedPositionsOf", () => {
  describe("two values that are not containers", () => {
    const it = test.extend("spellingsOfTheComparisonBetweenANameAndAConstruction", () => {
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
    });

    it("line up as one pair", ({ spellingsOfTheComparisonBetweenANameAndAConstruction }) => {
      expect(spellingsOfTheComparisonBetweenANameAndAConstruction).toStrictEqual([
        "Identifier/NewExpression",
      ]);
    });
  });

  describe("a value with nothing on the right", () => {
    const it = test.extend("spellingsOfTheComparisonWithNothingOnTheRight", () => {
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
    });

    it("still lines up as a pair", ({ spellingsOfTheComparisonWithNothingOnTheRight }) => {
      expect(spellingsOfTheComparisonWithNothingOnTheRight).toStrictEqual(["NewExpression/none"]);
    });
  });

  describe("a value with nothing on the left", () => {
    const it = test.extend("spellingsOfTheComparisonWithNothingOnTheLeft", () => {
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
    });

    it("still lines up as a pair", ({ spellingsOfTheComparisonWithNothingOnTheLeft }) => {
      expect(spellingsOfTheComparisonWithNothingOnTheLeft).toStrictEqual(["none/NewExpression"]);
    });
  });

  describe("two objects", () => {
    const it = test.extend("spellingsOfTheComparisonsBetweenTwoObjects", () => {
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
    });

    it("line up key by key", ({ spellingsOfTheComparisonsBetweenTwoObjects }) => {
      expect(spellingsOfTheComparisonsBetweenTwoObjects).toStrictEqual([
        "Identifier/NewExpression",
        "Literal/Literal",
      ]);
    });
  });

  describe("a key written as a number", () => {
    const it = test.extend("spellingsOfTheComparisonsBetweenANumberedKeyAndASpelledKey", () => {
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
    });

    it("lines up with the same key written as text", ({
      spellingsOfTheComparisonsBetweenANumberedKeyAndASpelledKey,
    }) => {
      expect(spellingsOfTheComparisonsBetweenANumberedKeyAndASpelledKey).toStrictEqual([
        "Identifier/NewExpression",
      ]);
    });
  });

  describe("a key reached through a template without substitutions", () => {
    const it = test.extend("spellingsOfTheComparisonsBetweenATemplateKeyAndASpelledKey", () => {
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
    });

    it("is the same key", ({ spellingsOfTheComparisonsBetweenATemplateKeyAndASpelledKey }) => {
      expect(spellingsOfTheComparisonsBetweenATemplateKeyAndASpelledKey).toStrictEqual([
        "Identifier/NewExpression",
      ]);
    });
  });

  describe("key sets that differ", () => {
    const it = test.extend("positionsBetweenObjectsKeyedDifferently", () => {
      const left = parseSync("spec.ts", "const written = { a: subject };").program
        .body[0] as ESTree.VariableDeclaration;
      const right = parseSync("spec.ts", "const written = { b: subject };").program
        .body[0] as ESTree.VariableDeclaration;
      return comparedPositionsOf({
        left: left.declarations[0]?.init as ESTree.Expression,
        right: right.declarations[0]?.init as ESTree.Expression,
        resolve: identity,
      });
    });

    it("leave the outer comparison to fall on its own", ({
      positionsBetweenObjectsKeyedDifferently,
    }) => {
      expect(positionsBetweenObjectsKeyedDifferently).toStrictEqual([]);
    });
  });

  describe("key counts that differ", () => {
    const it = test.extend("positionsBetweenObjectsCarryingDifferentKeyCounts", () => {
      const left = parseSync("spec.ts", "const written = { a: subject };").program
        .body[0] as ESTree.VariableDeclaration;
      const right = parseSync("spec.ts", "const written = { a: subject, b: subject };").program
        .body[0] as ESTree.VariableDeclaration;
      return comparedPositionsOf({
        left: left.declarations[0]?.init as ESTree.Expression,
        right: right.declarations[0]?.init as ESTree.Expression,
        resolve: identity,
      });
    });

    it("leave the outer comparison to fall on its own", ({
      positionsBetweenObjectsCarryingDifferentKeyCounts,
    }) => {
      expect(positionsBetweenObjectsCarryingDifferentKeyCounts).toStrictEqual([]);
    });
  });

  describe("a spread on the left of an object", () => {
    const it = test.extend("positionsBetweenAnObjectHoldingASpreadAndAnObjectHoldingAKey", () => {
      const left = parseSync("spec.ts", "const written = { ...rest };").program
        .body[0] as ESTree.VariableDeclaration;
      const right = parseSync("spec.ts", "const written = { a: subject };").program
        .body[0] as ESTree.VariableDeclaration;
      return comparedPositionsOf({
        left: left.declarations[0]?.init as ESTree.Expression,
        right: right.declarations[0]?.init as ESTree.Expression,
        resolve: identity,
      });
    });

    it("leaves the corresponding positions undecided", ({
      positionsBetweenAnObjectHoldingASpreadAndAnObjectHoldingAKey,
    }) => {
      expect(positionsBetweenAnObjectHoldingASpreadAndAnObjectHoldingAKey).toStrictEqual([]);
    });
  });

  describe("a spread on the right of an object", () => {
    const it = test.extend("positionsBetweenAnObjectHoldingAKeyAndAnObjectHoldingASpread", () => {
      const left = parseSync("spec.ts", "const written = { a: subject };").program
        .body[0] as ESTree.VariableDeclaration;
      const right = parseSync("spec.ts", "const written = { ...rest };").program
        .body[0] as ESTree.VariableDeclaration;
      return comparedPositionsOf({
        left: left.declarations[0]?.init as ESTree.Expression,
        right: right.declarations[0]?.init as ESTree.Expression,
        resolve: identity,
      });
    });

    it("leaves the corresponding positions undecided", ({
      positionsBetweenAnObjectHoldingAKeyAndAnObjectHoldingASpread,
    }) => {
      expect(positionsBetweenAnObjectHoldingAKeyAndAnObjectHoldingASpread).toStrictEqual([]);
    });
  });

  describe("a key decided at run time", () => {
    const it =
      test.extend("positionsBetweenAnObjectKeyedAtRunTimeAndAnObjectKeyedBySpelling", () => {
        const left = parseSync("spec.ts", "const written = { [field]: subject };").program
          .body[0] as ESTree.VariableDeclaration;
        const right = parseSync("spec.ts", "const written = { a: subject };").program
          .body[0] as ESTree.VariableDeclaration;
        return comparedPositionsOf({
          left: left.declarations[0]?.init as ESTree.Expression,
          right: right.declarations[0]?.init as ESTree.Expression,
          resolve: identity,
        });
      });

    it("leaves the corresponding positions undecided", ({
      positionsBetweenAnObjectKeyedAtRunTimeAndAnObjectKeyedBySpelling,
    }) => {
      expect(positionsBetweenAnObjectKeyedAtRunTimeAndAnObjectKeyedBySpelling).toStrictEqual([]);
    });
  });

  describe("a duplicated key", () => {
    const it = test.extend("spellingsOfTheComparisonsUnderADuplicatedKey", () => {
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
    });

    it("keeps the value written last, the way the language does", ({
      spellingsOfTheComparisonsUnderADuplicatedKey,
    }) => {
      expect(spellingsOfTheComparisonsUnderADuplicatedKey).toStrictEqual([
        "Identifier/NewExpression",
      ]);
    });
  });

  describe("an object standing against a settled string", () => {
    const it = test.extend("positionsBetweenAnObjectAndASettledString", () => {
      const left = parseSync("spec.ts", "const written = { a: subject };").program
        .body[0] as ESTree.VariableDeclaration;
      const right = parseSync("spec.ts", "const written = 'ok';").program
        .body[0] as ESTree.VariableDeclaration;
      return comparedPositionsOf({
        left: left.declarations[0]?.init as ESTree.Expression,
        right: right.declarations[0]?.init as ESTree.Expression,
        resolve: identity,
      });
    });

    it("leaves the comparison to fall", ({ positionsBetweenAnObjectAndASettledString }) => {
      expect(positionsBetweenAnObjectAndASettledString).toStrictEqual([]);
    });
  });

  describe("an object standing against a settled array", () => {
    const it = test.extend("positionsBetweenAnObjectAndASettledArray", () => {
      const left = parseSync("spec.ts", "const written = { a: subject };").program
        .body[0] as ESTree.VariableDeclaration;
      const right = parseSync("spec.ts", "const written = [subject];").program
        .body[0] as ESTree.VariableDeclaration;
      return comparedPositionsOf({
        left: left.declarations[0]?.init as ESTree.Expression,
        right: right.declarations[0]?.init as ESTree.Expression,
        resolve: identity,
      });
    });

    it("leaves the comparison to fall", ({ positionsBetweenAnObjectAndASettledArray }) => {
      expect(positionsBetweenAnObjectAndASettledArray).toStrictEqual([]);
    });
  });

  describe("an object standing against a value nothing is known about", () => {
    const it = test.extend("spellingsOfTheComparisonsBetweenAnObjectAndAnOpenValue", () => {
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
    });

    it("keeps its positions open", ({ spellingsOfTheComparisonsBetweenAnObjectAndAnOpenValue }) => {
      expect(spellingsOfTheComparisonsBetweenAnObjectAndAnOpenValue).toStrictEqual([
        "NewExpression/none",
      ]);
    });
  });

  describe("a value nothing is known about standing against an object", () => {
    const it = test.extend("spellingsOfTheComparisonsBetweenAnOpenValueAndAnObject", () => {
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
    });

    it("keeps its positions open", ({ spellingsOfTheComparisonsBetweenAnOpenValueAndAnObject }) => {
      expect(spellingsOfTheComparisonsBetweenAnOpenValueAndAnObject).toStrictEqual([
        "NewExpression/none",
      ]);
    });
  });

  describe("two arrays", () => {
    const it = test.extend("spellingsOfTheComparisonsBetweenTwoArrays", () => {
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
    });

    it("line up index by index", ({ spellingsOfTheComparisonsBetweenTwoArrays }) => {
      expect(spellingsOfTheComparisonsBetweenTwoArrays).toStrictEqual([
        "Identifier/NewExpression",
        "Literal/Literal",
      ]);
    });
  });

  describe("lengths that differ", () => {
    const it = test.extend("positionsBetweenArraysOfDifferentLengths", () => {
      const left = parseSync("spec.ts", "const written = [subject];").program
        .body[0] as ESTree.VariableDeclaration;
      const right = parseSync("spec.ts", "const written = [subject, subject];").program
        .body[0] as ESTree.VariableDeclaration;
      return comparedPositionsOf({
        left: left.declarations[0]?.init as ESTree.Expression,
        right: right.declarations[0]?.init as ESTree.Expression,
        resolve: identity,
      });
    });

    it("leave the outer comparison to fall on its own", ({
      positionsBetweenArraysOfDifferentLengths,
    }) => {
      expect(positionsBetweenArraysOfDifferentLengths).toStrictEqual([]);
    });
  });

  describe("a hole standing against a written element", () => {
    const it = test.extend("positionsBetweenAnArrayHoldingAHoleAndAnArrayHoldingAnElement", () => {
      const left = parseSync("spec.ts", "const written = [, subject];").program
        .body[0] as ESTree.VariableDeclaration;
      const right = parseSync("spec.ts", "const written = [subject, subject];").program
        .body[0] as ESTree.VariableDeclaration;
      return comparedPositionsOf({
        left: left.declarations[0]?.init as ESTree.Expression,
        right: right.declarations[0]?.init as ESTree.Expression,
        resolve: identity,
      });
    });

    it("is a difference in shape", ({
      positionsBetweenAnArrayHoldingAHoleAndAnArrayHoldingAnElement,
    }) => {
      expect(positionsBetweenAnArrayHoldingAHoleAndAnArrayHoldingAnElement).toStrictEqual([]);
    });
  });

  describe("holes on both sides", () => {
    const it =
      test.extend("spellingsOfTheComparisonsBetweenArraysHoldingHolesAtTheSameIndex", () => {
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
      });

    it("line up, and nothing is compared at that index", ({
      spellingsOfTheComparisonsBetweenArraysHoldingHolesAtTheSameIndex,
    }) => {
      expect(spellingsOfTheComparisonsBetweenArraysHoldingHolesAtTheSameIndex).toStrictEqual([
        "Identifier/NewExpression",
      ]);
    });
  });

  describe("a spread on the left of an array", () => {
    const it =
      test.extend("positionsBetweenAnArrayHoldingASpreadAndAnArrayHoldingAnElement", () => {
        const left = parseSync("spec.ts", "const written = [...rest];").program
          .body[0] as ESTree.VariableDeclaration;
        const right = parseSync("spec.ts", "const written = [subject];").program
          .body[0] as ESTree.VariableDeclaration;
        return comparedPositionsOf({
          left: left.declarations[0]?.init as ESTree.Expression,
          right: right.declarations[0]?.init as ESTree.Expression,
          resolve: identity,
        });
      });

    it("leaves the corresponding positions undecided", ({
      positionsBetweenAnArrayHoldingASpreadAndAnArrayHoldingAnElement,
    }) => {
      expect(positionsBetweenAnArrayHoldingASpreadAndAnArrayHoldingAnElement).toStrictEqual([]);
    });
  });

  describe("a spread on the right of an array", () => {
    const it =
      test.extend("positionsBetweenAnArrayHoldingAnElementAndAnArrayHoldingASpread", () => {
        const left = parseSync("spec.ts", "const written = [subject];").program
          .body[0] as ESTree.VariableDeclaration;
        const right = parseSync("spec.ts", "const written = [...rest];").program
          .body[0] as ESTree.VariableDeclaration;
        return comparedPositionsOf({
          left: left.declarations[0]?.init as ESTree.Expression,
          right: right.declarations[0]?.init as ESTree.Expression,
          resolve: identity,
        });
      });

    it("leaves the corresponding positions undecided", ({
      positionsBetweenAnArrayHoldingAnElementAndAnArrayHoldingASpread,
    }) => {
      expect(positionsBetweenAnArrayHoldingAnElementAndAnArrayHoldingASpread).toStrictEqual([]);
    });
  });

  describe("an array standing against a settled shape", () => {
    const it = test.extend("positionsBetweenAnArrayAndASettledString", () => {
      const left = parseSync("spec.ts", "const written = [subject];").program
        .body[0] as ESTree.VariableDeclaration;
      const right = parseSync("spec.ts", "const written = 'ok';").program
        .body[0] as ESTree.VariableDeclaration;
      return comparedPositionsOf({
        left: left.declarations[0]?.init as ESTree.Expression,
        right: right.declarations[0]?.init as ESTree.Expression,
        resolve: identity,
      });
    });

    it("leaves the comparison to fall", ({ positionsBetweenAnArrayAndASettledString }) => {
      expect(positionsBetweenAnArrayAndASettledString).toStrictEqual([]);
    });
  });

  describe("an array standing against a value nothing is known about", () => {
    const it = test.extend("spellingsOfTheComparisonsBetweenAnArrayAndAnOpenValue", () => {
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
    });

    it("keeps its positions open", ({ spellingsOfTheComparisonsBetweenAnArrayAndAnOpenValue }) => {
      expect(spellingsOfTheComparisonsBetweenAnArrayAndAnOpenValue).toStrictEqual([
        "NewExpression/none",
      ]);
    });
  });

  describe("a value nothing is known about standing against an array", () => {
    const it = test.extend("spellingsOfTheComparisonsBetweenAnOpenValueAndAnArray", () => {
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
    });

    it("keeps its positions open", ({ spellingsOfTheComparisonsBetweenAnOpenValueAndAnArray }) => {
      expect(spellingsOfTheComparisonsBetweenAnOpenValueAndAnArray).toStrictEqual([
        "NewExpression/none",
      ]);
    });
  });

  describe("a hole in an array standing against an open value", () => {
    const it =
      test.extend("spellingsOfTheComparisonsBetweenAnArrayHoldingAHoleAndAnOpenValue", () => {
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
      });

    it("is compared with nothing", ({
      spellingsOfTheComparisonsBetweenAnArrayHoldingAHoleAndAnOpenValue,
    }) => {
      expect(spellingsOfTheComparisonsBetweenAnArrayHoldingAHoleAndAnOpenValue).toStrictEqual([
        "NewExpression/none",
      ]);
    });
  });

  describe("containers nested inside containers", () => {
    const it =
      test.extend("spellingsOfTheComparisonsBetweenContainersNestedInsideContainers", () => {
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
      });

    it("line up all the way down", ({
      spellingsOfTheComparisonsBetweenContainersNestedInsideContainers,
    }) => {
      expect(spellingsOfTheComparisonsBetweenContainersNestedInsideContainers).toStrictEqual([
        "Identifier/NewExpression",
      ]);
    });
  });
});

describe("isSettledShape", () => {
  describe("a string written out", () => {
    const it = test.extend("settledReadingOfAString", () => {
      const declared = parseSync("spec.ts", "const written = 'ok';").program
        .body[0] as ESTree.VariableDeclaration;
      return isSettledShape(declared.declarations[0]?.init as ESTree.Expression);
    });

    it("is a shape the reader can settle from the syntax alone", ({ settledReadingOfAString }) => {
      expect(settledReadingOfAString).toBe(true);
    });
  });

  describe("a template", () => {
    const it = test.extend("settledReadingOfATemplate", () => {
      const declared = parseSync("spec.ts", "const written = `ok`;").program
        .body[0] as ESTree.VariableDeclaration;
      return isSettledShape(declared.declarations[0]?.init as ESTree.Expression);
    });

    it("is a shape the reader can settle from the syntax alone", ({
      settledReadingOfATemplate,
    }) => {
      expect(settledReadingOfATemplate).toBe(true);
    });
  });

  describe("an object literal", () => {
    const it = test.extend("settledReadingOfAnObjectLiteral", () => {
      const declared = parseSync("spec.ts", "const written = { a: 1 };").program
        .body[0] as ESTree.VariableDeclaration;
      return isSettledShape(declared.declarations[0]?.init as ESTree.Expression);
    });

    it("is a shape the reader can settle from the syntax alone", ({
      settledReadingOfAnObjectLiteral,
    }) => {
      expect(settledReadingOfAnObjectLiteral).toBe(true);
    });
  });

  describe("an array literal", () => {
    const it = test.extend("settledReadingOfAnArrayLiteral", () => {
      const declared = parseSync("spec.ts", "const written = [1];").program
        .body[0] as ESTree.VariableDeclaration;
      return isSettledShape(declared.declarations[0]?.init as ESTree.Expression);
    });

    it("is a shape the reader can settle from the syntax alone", ({
      settledReadingOfAnArrayLiteral,
    }) => {
      expect(settledReadingOfAnArrayLiteral).toBe(true);
    });
  });

  describe("an arrow function", () => {
    const it = test.extend("settledReadingOfAnArrowFunction", () => {
      const declared = parseSync("spec.ts", "const written = () => 1;").program
        .body[0] as ESTree.VariableDeclaration;
      return isSettledShape(declared.declarations[0]?.init as ESTree.Expression);
    });

    it("is a shape the reader can settle from the syntax alone", ({
      settledReadingOfAnArrowFunction,
    }) => {
      expect(settledReadingOfAnArrowFunction).toBe(true);
    });
  });

  describe("a function expression", () => {
    const it = test.extend("settledReadingOfAFunctionExpression", () => {
      const declared = parseSync("spec.ts", "const written = function () { return 1; };").program
        .body[0] as ESTree.VariableDeclaration;
      return isSettledShape(declared.declarations[0]?.init as ESTree.Expression);
    });

    it("is a shape the reader can settle from the syntax alone", ({
      settledReadingOfAFunctionExpression,
    }) => {
      expect(settledReadingOfAFunctionExpression).toBe(true);
    });
  });

  describe("a class expression", () => {
    const it = test.extend("settledReadingOfAClassExpression", () => {
      const declared = parseSync("spec.ts", "const written = class {};").program
        .body[0] as ESTree.VariableDeclaration;
      return isSettledShape(declared.declarations[0]?.init as ESTree.Expression);
    });

    it("is a shape the reader can settle from the syntax alone", ({
      settledReadingOfAClassExpression,
    }) => {
      expect(settledReadingOfAClassExpression).toBe(true);
    });
  });

  describe("a construction", () => {
    const it = test.extend("settledReadingOfAConstruction", () => {
      const declared = parseSync("spec.ts", "const written = new Response('a');").program
        .body[0] as ESTree.VariableDeclaration;
      return isSettledShape(declared.declarations[0]?.init as ESTree.Expression);
    });

    it("is a shape the reader can settle from the syntax alone", ({
      settledReadingOfAConstruction,
    }) => {
      expect(settledReadingOfAConstruction).toBe(true);
    });
  });

  describe("a bare name", () => {
    const it = test.extend("settledReadingOfABareName", () => {
      const declared = parseSync("spec.ts", "const written = subject;").program
        .body[0] as ESTree.VariableDeclaration;
      return isSettledShape(declared.declarations[0]?.init as ESTree.Expression);
    });

    it("is not a shape the reader can settle from the syntax alone", ({
      settledReadingOfABareName,
    }) => {
      expect(settledReadingOfABareName).toBe(false);
    });
  });

  describe("a call", () => {
    const it = test.extend("settledReadingOfACall", () => {
      const declared = parseSync("spec.ts", "const written = read();").program
        .body[0] as ESTree.VariableDeclaration;
      return isSettledShape(declared.declarations[0]?.init as ESTree.Expression);
    });

    it("is not a shape the reader can settle from the syntax alone", ({
      settledReadingOfACall,
    }) => {
      expect(settledReadingOfACall).toBe(false);
    });
  });

  describe("a member read", () => {
    const it = test.extend("settledReadingOfAMemberRead", () => {
      const declared = parseSync("spec.ts", "const written = order.body;").program
        .body[0] as ESTree.VariableDeclaration;
      return isSettledShape(declared.declarations[0]?.init as ESTree.Expression);
    });

    it("is not a shape the reader can settle from the syntax alone", ({
      settledReadingOfAMemberRead,
    }) => {
      expect(settledReadingOfAMemberRead).toBe(false);
    });
  });
});
