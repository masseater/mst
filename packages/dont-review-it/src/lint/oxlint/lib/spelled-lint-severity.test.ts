import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { spelledSeverityOf } from "./spelled-lint-severity.ts";

import type { ESTree } from "@oxlint/plugins";

const spelledIn = (written: string): string | null => {
  const [statement] = parseSync("severity.ts", `const held = ${written};`).program.body.map(
    (parsed) => parsed as ESTree.Statement,
  );
  if (statement?.type !== "VariableDeclaration") throw new Error(`no declaration in ${written}`);
  const [binding] = statement.declarations;
  const initializer = binding?.init;
  if (initializer === null || initializer === undefined) throw new Error(`no value in ${written}`);
  return spelledSeverityOf(initializer);
};

describe("spelled-lint-severity", () => {
  test("a severity written as a word is read in lower case", () => {
    expect(spelledIn(`"error"`)).toBe("error");
    expect(spelledIn(`"OFF"`)).toBe("off");
  });

  test("a severity written as a number is read as the digits", () => {
    expect(spelledIn("0")).toBe("0");
    expect(spelledIn("2")).toBe("2");
  });

  test("a severity written as a named constant is read by its member name", () => {
    expect(spelledIn("LINT_SEVERITY.OFF")).toBe("off");
  });

  test("the head of a list is the severity that counts", () => {
    expect(spelledIn(`["warn", { max: 1 }]`)).toBe("warn");
    expect(spelledIn("[LINT_SEVERITY.ERROR]")).toBe("error");
  });

  test("a value that spells no severity is read as nothing", () => {
    expect(spelledIn("chosenSeverity")).toBeNull();
    expect(spelledIn("true")).toBeNull();
    expect(spelledIn("[]")).toBeNull();
    expect(spelledIn("[...carried]")).toBeNull();
    expect(spelledIn("[, 1]")).toBeNull();
    expect(spelledIn("held[chosen]")).toBeNull();
  });
});
