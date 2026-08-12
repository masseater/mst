import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { nodeTypeOf } from "../setup-modules/coupling-edges.ts";
import { chainFrom, fieldOf, innermostOf, kindAt, nodeVisitsIn, visitAt } from "./node-visits.ts";

import type { AstFields } from "../ast-node.ts";

const visitsOf = (sourceText: string) => nodeVisitsIn(parseSync("held.ts", sourceText).program);

const kindsOf = (sourceText: string): readonly string[] =>
  visitsOf(sourceText).map((visit) => nodeTypeOf(visit.node));

const namedVisit = (sourceText: string, spelled: string) => {
  const found = visitsOf(sourceText).find(
    (visit) => nodeTypeOf(visit.node) === "Identifier" && visit.node.name === spelled,
  );
  if (found === undefined) throw new Error(`no ${spelled} is written in: ${sourceText}`);
  return found;
};

const ELSEWHERE: AstFields = { type: "Program" };

describe("nodeVisitsIn", () => {
  test("a name written in a type is left out of the walk", () => {
    expect(kindsOf("const held: Cell = read();")).toStrictEqual([
      "Program",
      "VariableDeclaration",
      "VariableDeclarator",
      "Identifier",
      "CallExpression",
      "Identifier",
    ]);
  });

  test("a name written in a value is walked", () => {
    expect(kindsOf("held;")).toStrictEqual(["Program", "ExpressionStatement", "Identifier"]);
  });

  test("a walked node carries the nodes it sits under", () => {
    expect(namedVisit("held;", "held").ancestors.map(nodeTypeOf)).toStrictEqual([
      "Program",
      "ExpressionStatement",
    ]);
  });
});

describe("fieldOf", () => {
  test("a field of a node is read", () => {
    expect(fieldOf(namedVisit("held;", "held").node, "name")).toBe("held");
  });

  test("a field of something that is no node reads as nothing", () => {
    expect(fieldOf("held", "name")).toBe(undefined);
  });
});

describe("kindAt", () => {
  test("a node reads as its own kind", () => {
    expect(kindAt(namedVisit("held;", "held").node)).toBe("Identifier");
  });

  test("something that is no node reads as no kind", () => {
    expect(kindAt(null)).toBe("");
  });
});

describe("chainFrom", () => {
  test("a chain cut at a node it sits under starts at that node", () => {
    const visit = namedVisit("held;", "held");
    const [boundary] = visit.ancestors.slice(-1);

    expect(chainFrom(visit, boundary ?? ELSEWHERE).map(nodeTypeOf)).toStrictEqual([
      "ExpressionStatement",
    ]);
  });

  test("a chain cut at a node it does not sit under keeps every node", () => {
    expect(chainFrom(namedVisit("held;", "held"), ELSEWHERE).map(nodeTypeOf)).toStrictEqual([
      "Program",
      "ExpressionStatement",
    ]);
  });
});

describe("visitAt", () => {
  test("a node this one sits under is carried with the nodes above it", () => {
    const visit = namedVisit("held;", "held");
    const [boundary] = visit.ancestors.slice(-1);

    expect(visitAt(visit, boundary ?? ELSEWHERE).ancestors.map(nodeTypeOf)).toStrictEqual([
      "Program",
    ]);
  });
});

describe("innermostOf", () => {
  test("the nearest node of a wanted kind is picked", () => {
    const visit = namedVisit("const walk = () => held;", "held");

    expect(
      nodeTypeOf(innermostOf(visit.ancestors, new Set(["ArrowFunctionExpression"])) ?? ELSEWHERE),
    ).toBe("ArrowFunctionExpression");
  });

  test("a chain holding no wanted kind picks nothing", () => {
    expect(innermostOf(namedVisit("held;", "held").ancestors, new Set(["ClassBody"]))).toBe(null);
  });
});
