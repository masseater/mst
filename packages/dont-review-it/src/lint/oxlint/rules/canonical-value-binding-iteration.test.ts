import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import {
  canonicalValueForInCandidates,
  canonicalValueForOfCandidates,
} from "./canonical-value-binding-iteration.ts";

import type { ESTree } from "@oxlint/plugins";

const expressionFrom = (source: string): ESTree.Expression => {
  const parsed = parseSync("source.ts", source);
  const [statement] = parsed.program.body;
  if (parsed.errors.length !== 0 || statement?.type !== "ExpressionStatement") {
    throw new Error(`Expected one expression statement: ${source}`);
  }
  return statement.expression as ESTree.Expression;
};

const literalValues = (expressions: readonly ESTree.Expression[]): readonly unknown[] =>
  expressions.map((expression) =>
    expression.type === "Literal" ? expression.value : expression.type,
  );

const noAliases = (): readonly ESTree.Expression[] => [];

describe("canonical value binding iteration", () => {
  test("for of flattens static array spreads", () => {
    const candidates = canonicalValueForOfCandidates({
      resolveAlias: noAliases,
      source: expressionFrom('["draft", ...["published"]];'),
    });
    expect(literalValues(candidates)).toStrictEqual(["draft", "published"]);
  });

  test("for of retains both static conditional iterables", () => {
    const candidates = canonicalValueForOfCandidates({
      resolveAlias: noAliases,
      source: expressionFrom('enabled ? ["draft"] : ["published"];'),
    });
    expect(literalValues(candidates)).toStrictEqual(["draft", "published"]);
  });

  test("for in converts static object keys to string candidates", () => {
    const candidates = canonicalValueForInCandidates({
      resolveAlias: noAliases,
      source: expressionFrom('({ draft: true, 2: true, ["published"]: true });'),
    });
    expect(literalValues(candidates)).toStrictEqual(["draft", "2", "published"]);
  });

  test("for in converts static string indexes to string candidates", () => {
    const candidates = canonicalValueForInCandidates({
      resolveAlias: noAliases,
      source: expressionFrom('"ab";'),
    });
    expect(literalValues(candidates)).toStrictEqual(["0", "1"]);
  });
});
