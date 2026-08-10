import { describe, expect, test } from "vite-plus/test";

import { declarationsIn } from "./declarations.ts";

const structureOfFirst = (source: string): string => declarationsIn(source)[0].structure;

describe("declarationsIn", () => {
  test("reads an arrow binding under the name it was declared with", () => {
    const [declaration] = declarationsIn("const twice = (value: number): number => value * 2;");
    expect(declaration.name).toBe("twice");
  });

  test("gives two bindings that differ only in name the same structure", () => {
    expect(structureOfFirst("const twice = (value: number) => value * 2;")).toBe(
      structureOfFirst("const doubled = (value: number) => value * 2;"),
    );
  });

  test("gives two bindings that differ only in comments the same structure", () => {
    expect(structureOfFirst("const twice = (value: number) => value * 2;")).toBe(
      structureOfFirst("// doubles it\nconst twice = (value: number) => /* here */ value * 2;"),
    );
  });

  test("gives two bindings that differ only in formatting the same structure", () => {
    expect(structureOfFirst("const twice = (value: number) => value * 2;")).toBe(
      structureOfFirst("const twice = (\n  value: number,\n) =>\n  value * 2;"),
    );
  });

  test("keeps two bindings apart when the body calls a different name", () => {
    expect(structureOfFirst("const read = (path: string) => statSync(path);")).not.toBe(
      structureOfFirst("const read = (path: string) => readFileSync(path);"),
    );
  });

  test("keeps two bindings apart when a parameter is named differently", () => {
    expect(structureOfFirst("const twice = (value: number) => value * 2;")).not.toBe(
      structureOfFirst("const twice = (amount: number) => amount * 2;"),
    );
  });

  test("keeps two bindings apart when only a string literal differs", () => {
    expect(structureOfFirst(`const label = () => report("draft");`)).not.toBe(
      structureOfFirst(`const label = () => report("published");`),
    );
  });

  test("keeps the type annotation of a binding inside the structure", () => {
    expect(structureOfFirst("const parse: (text: string) => unknown = JSON.parse;")).not.toBe(
      structureOfFirst("const parse: (text: string) => string = JSON.parse;"),
    );
  });

  test("reads a function declaration under the name it was declared with", () => {
    const [declaration] = declarationsIn("function twice(value: number) {\n  return value * 2;\n}");
    expect(declaration.name).toBe("twice");
  });

  test("reads an exported binding", () => {
    const [declaration] = declarationsIn("export const twice = (value: number) => value * 2;");
    expect(declaration.name).toBe("twice");
  });

  test("leaves a declaration nested inside another declaration out", () => {
    const declarations = declarationsIn(
      "const outer = () => {\n  const inner = 1;\n  return inner;\n};",
    );
    expect(declarations.map((declaration) => declaration.name)).toStrictEqual(["outer"]);
  });

  test("leaves an anonymous function written at a call site out", () => {
    expect(declarationsIn("register(function () { return 1; });")).toStrictEqual([]);
  });

  test("leaves a destructured binding out because it declares no single name", () => {
    expect(declarationsIn("const { first, second } = readPair();")).toStrictEqual([]);
  });

  test("records the line the declaration starts on", () => {
    const [, second] = declarationsIn("const first = 1;\n\nconst second = 2;");
    expect(second.line).toBe(3);
  });

  test("counts more nodes for a longer body", () => {
    const [small] = declarationsIn("const one = 1;");
    const [large] = declarationsIn("const twice = (value: number): number => value * 2;");
    expect(large.nodeCount).toBeGreaterThan(small.nodeCount);
  });
});
