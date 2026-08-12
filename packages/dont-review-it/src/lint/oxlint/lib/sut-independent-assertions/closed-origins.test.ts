import { parseSync } from "oxc-parser";
import { describe, expect, it } from "vite-plus/test";

import { isSpecClosedValue, type SpecNameReach } from "./closed-origins.ts";

import type { ESTree } from "@oxlint/plugins";

const expressionIn = (sourceText: string): ESTree.Expression => {
  const written = parseSync("spec.ts", `${sourceText};`).program.body[0] as ESTree.Statement;
  const bare = (written as ESTree.ExpressionStatement).expression;
  return bare.type === "ParenthesizedExpression" ? bare.expression : bare;
};

const reachOf = (declarations: Readonly<Record<string, string | null>>): SpecNameReach => {
  const declared = new Map(
    Object.entries(declarations).map(([declaredName, spelled]) => [
      declaredName,
      spelled === null ? null : expressionIn(spelled),
    ]),
  );
  return {
    boundValueOf: (written) => declared.get(written.name) ?? null,
    isDeclaredHere: (written) => declared.has(written.name),
  };
};

const NOTHING_DECLARED = reachOf({});

const isClosed = (sourceText: string, reach: SpecNameReach = NOTHING_DECLARED): boolean =>
  isSpecClosedValue({ written: expressionIn(sourceText), reach });

describe("isSpecClosedValue", () => {
  it("reads a written-out value as closed inside the spec", () => {
    expect(isClosed('"a"')).toBe(true);
    expect(isClosed("true")).toBe(true);
    expect(isClosed("undefined")).toBe(true);
  });

  it("reads a value composed only of written-out values as closed", () => {
    expect(isClosed("1 + 1")).toBe(true);
    expect(isClosed('["a", "b"]')).toBe(true);
    expect(isClosed('({ id: "a", carried: [1] })')).toBe(true);
    expect(isClosed("`a`")).toBe(true);
    expect(isClosed('true ? "a" : "b"')).toBe(true);
  });

  it("reads a spelled the spec filled with a written-out value as closed", () => {
    expect(isClosed("id", reachOf({ id: '"a"' }))).toBe(true);
  });

  it("follows a chain of names to the value at its end", () => {
    expect(isClosed("carried", reachOf({ carried: "id", id: '"a"' }))).toBe(true);
  });

  it("reads a spelled whose value the spec never wrote as open", () => {
    expect(isClosed("report")).toBe(false);
  });

  it("reads a spelled declared without a value the spec can read as open", () => {
    expect(isClosed("report", reachOf({ report: null }))).toBe(false);
  });

  it("stops at a spelled that reaches itself instead of walking forever", () => {
    expect(isClosed("looped", reachOf({ looped: "looped" }))).toBe(false);
  });

  it("reads a call as open however it is written", () => {
    expect(isClosed('summarise("a")')).toBe(false);
    expect(isClosed('String("a")')).toBe(false);
    expect(isClosed("sql`a`")).toBe(false);
  });

  it("reads a construction on a spelled this file declares as open", () => {
    expect(isClosed('new Report("a")', reachOf({ Report: null }))).toBe(false);
  });

  it("reads a construction on a spelled from outside the spec as closed", () => {
    expect(isClosed('new Headers({ accept: "text/plain" })')).toBe(true);
  });

  it("reads a construction carrying an open argument as open", () => {
    expect(isClosed("new Headers(sent)")).toBe(false);
  });

  it("reads a value carried through a wrapper the way it reads the value", () => {
    expect(isClosed('"a" as Spelling')).toBe(true);
    expect(isClosed("sent!")).toBe(false);
  });

  it("reads a member of a shape written out on the spot as closed", () => {
    expect(isClosed('({ id: "a" }).id')).toBe(true);
    expect(isClosed('["a"][0]')).toBe(true);
  });

  it("reads a member of an open value as open", () => {
    expect(isClosed("report.id")).toBe(false);
  });

  it("reads a member picked by an open key as open", () => {
    expect(isClosed('({ id: "a" })[picked]')).toBe(false);
  });

  it("reads a container a spelled holds as open, since anything holding it can write into it", () => {
    expect(isClosed("sink", reachOf({ sink: "({})" }))).toBe(false);
    expect(isClosed("ids", reachOf({ ids: '["a"]' }))).toBe(false);
    expect(isClosed("sink", reachOf({ sink: "new Set()" }))).toBe(false);
    expect(isClosed("sink.size", reachOf({ sink: "new Set()" }))).toBe(false);
  });

  it("reads a value a spelled holds that nothing can write into as closed", () => {
    expect(isClosed("spelled", reachOf({ spelled: '"a" + "b"' }))).toBe(true);
    expect(isClosed("spelled", reachOf({ spelled: "`a`" }))).toBe(true);
  });

  it("reads a function written in the spec as open", () => {
    expect(isClosed('() => parse("")')).toBe(false);
  });

  it("reads a spread of an open value inside a written-out shape as open", () => {
    expect(isClosed('({ ...report, id: "a" })')).toBe(false);
    expect(isClosed('[...ids, "a"]')).toBe(false);
  });
});
