import { parseSync } from "oxc-parser";
import { describe, expect, it } from "vite-plus/test";

import { scopedCallExpressionsIn } from "./scoped-call-expressions.ts";
import { absenceVerificationsIn } from "./verification-source.ts";

const expectBindingStatesIn = (source: string): readonly boolean[] =>
  scopedCallExpressionsIn(parseSync("source.test.ts", source).program).flatMap(
    ({ call, localBindings }) => {
      return call.callee.type === "Identifier" && call.callee.name === "expect"
        ? [localBindings.has("expect")]
        : [];
    },
  );

const onlyCallBindingsIn = (value: unknown): readonly string[] => {
  const [occurrence] = scopedCallExpressionsIn(value);
  expect(occurrence).toBeDefined();
  return [...(occurrence?.localBindings ?? [])].toSorted();
};

const fileVerificationsIn = (source: string) =>
  absenceVerificationsIn({ file: "src/repository.test.ts", source });

const exportVerificationsIn = (source: string) =>
  absenceVerificationsIn({ file: "src/legacy-api.test.ts", source });

const fileVerificationAt = (line: number) => ({
  kind: "file",
  locator: "file:src/legacy.ts",
  subjectPath: "src/legacy.ts",
  file: "src/repository.test.ts",
  line,
  endLine: line,
});

const exportVerificationAt = (line: number) => ({
  kind: "export",
  locator: '["declaration","src/legacy.ts","legacyMode"]',
  modulePath: "src/legacy.ts",
  exportName: "legacyMode",
  file: "src/legacy-api.test.ts",
  line,
  endLine: line,
});

describe("scopedCallExpressionsIn", () => {
  it("collects value declarations and destructured bindings in a program", () => {
    const source = `
      export const { property: assigned = true, ...objectRest } = sourceObject;
      export const [arrayValue, ...arrayRest] = sourceArray;
      export default function exportedFunction() {}
      class DeclaredClass {}
      export { DeclaredClass };
      enum DeclaredEnum { Value }
      namespace DeclaredNamespace {}
      import importedValue = Other.value;
      target();
    `;
    const bindings = onlyCallBindingsIn(parseSync("source.test.ts", source).program);

    expect(bindings).toStrictEqual([
      "DeclaredClass",
      "DeclaredEnum",
      "DeclaredNamespace",
      "arrayRest",
      "arrayValue",
      "assigned",
      "exportedFunction",
      "importedValue",
      "objectRest",
    ]);
  });

  it("tracks catch, loop, switch, class, and named function scopes", () => {
    const source = [
      "function namedFunction({ value: functionBinding }) { target(); }",
      "const namedExpression = function innerName() { target(); };",
      "try {} catch (caught) { target(); }",
      "for (let initialized = 0; initialized < 1; initialized += 1) { target(); }",
      "for (const forOfBinding of []) { target(); }",
      "for (const forInBinding in {}) { target(); }",
      "switch (true) { case true: const switched = true; target(); }",
      "const NamedClass = class InnerClass { method() { target(); } };",
    ].join("\n");
    const bindings = scopedCallExpressionsIn(parseSync("source.test.ts", source).program)
      .filter(({ call }) => call.callee.type === "Identifier" && call.callee.name === "target")
      .flatMap(({ localBindings }) => [...localBindings]);

    expect(bindings).toStrictEqual(
      expect.arrayContaining([
        "namedFunction",
        "functionBinding",
        "innerName",
        "caught",
        "initialized",
        "forOfBinding",
        "forInBinding",
        "switched",
        "InnerClass",
      ]),
    );
  });

  it("hoists var bindings inside a class static block", () => {
    const source =
      "class Probe { static { if (true) { var expect = (value: boolean) => value; } expect(true); } }";

    expect(expectBindingStatesIn(source)).toStrictEqual([true]);
  });

  it("hoists var bindings inside a TypeScript module block", () => {
    const source =
      "namespace Probe { if (true) { var expect = (value: boolean) => value; } expect(true); }";

    expect(expectBindingStatesIn(source)).toStrictEqual([true]);
  });

  it("does not leak a static block var into its containing function", () => {
    const source =
      "const run = () => { class Probe { static { var expect = true; } } expect(true); };";

    expect(expectBindingStatesIn(source)).toStrictEqual([false]);
  });

  it("does not let a binding in another lexical scope hide an imported assertion", () => {
    const source =
      'import { existsSync } from "node:fs";\nimport { expect, test } from "vite-plus/test";\n\nconst helper = (expect: boolean) => expect;\n\ntest("legacy is gone", () => {\n  expect(existsSync("src/legacy.ts")).toBe(false);\n});\n';

    expect(fileVerificationsIn(source)).toStrictEqual([fileVerificationAt(7)]);
  });

  it("does not resolve an imported assertion through a shadowing parameter", () => {
    const source =
      'import { existsSync } from "node:fs";\nimport { expect, test } from "vite-plus/test";\n\ntest("legacy is gone", (expect) => {\n  expect(existsSync("src/legacy.ts")).toBe(false);\n});\n';

    expect(fileVerificationsIn(source)).toStrictEqual([]);
  });

  it("does not resolve an imported assertion through a static block binding", () => {
    const source =
      'import { existsSync } from "node:fs";\nimport { expect } from "vite-plus/test";\n\nclass Probe {\n  static {\n    const expect = (value: boolean) => ({ toBe: (expected: boolean) => value === expected });\n    expect(existsSync("src/legacy.ts")).toBe(false);\n  }\n}\n';

    expect(fileVerificationsIn(source)).toStrictEqual([]);
  });

  it("does not resolve an imported assertion through a TypeScript module binding", () => {
    const source =
      'import { existsSync } from "node:fs";\nimport { expect } from "vite-plus/test";\n\nnamespace Probe {\n  const expect = (value: boolean) => ({ toBe: (expected: boolean) => value === expected });\n  expect(existsSync("src/legacy.ts")).toBe(false);\n}\n';

    expect(fileVerificationsIn(source)).toStrictEqual([]);
  });

  it("does not let a static block var hide an outer imported assertion", () => {
    const source =
      'import { existsSync } from "node:fs";\nimport { expect, test } from "vite-plus/test";\n\ntest("legacy is gone", () => {\n  class Probe {\n    static {\n      var expect = true;\n    }\n  }\n  expect(existsSync("src/legacy.ts")).toBe(false);\n});\n';

    expect(fileVerificationsIn(source)).toStrictEqual([fileVerificationAt(10)]);
  });

  it("does not resolve an imported assertion through a parameter property", () => {
    const source =
      'import { existsSync } from "node:fs";\nimport { expect } from "vite-plus/test";\n\nclass Probe {\n  constructor(private expect: (value: boolean) => { toBe(expected: boolean): boolean }) {\n    expect(existsSync("src/legacy.ts")).toBe(false);\n  }\n}\n';

    expect(fileVerificationsIn(source)).toStrictEqual([]);
  });

  it("does not resolve a namespace import through a parameter property", () => {
    const source =
      'import * as legacy from "./legacy.ts";\nimport { expect } from "vite-plus/test";\n\nclass Probe {\n  constructor(private legacy: object) {\n    expect(legacy).not.toHaveProperty("legacyMode");\n  }\n}\n';

    expect(exportVerificationsIn(source)).toStrictEqual([]);
  });

  it("does not resolve a namespace import through a local enum", () => {
    const source =
      'import * as legacy from "./legacy.ts";\nimport { expect } from "vite-plus/test";\n\nfunction probe() {\n  enum legacy { current }\n  expect(legacy).not.toHaveProperty("legacyMode");\n}\n';

    expect(exportVerificationsIn(source)).toStrictEqual([]);
  });

  it("does not resolve a namespace import through a local namespace", () => {
    const source =
      'import * as legacy from "./legacy.ts";\nimport { expect } from "vite-plus/test";\n\nnamespace Probe {\n  export namespace legacy { export const current = true; }\n  expect(legacy).not.toHaveProperty("legacyMode");\n}\n';

    expect(exportVerificationsIn(source)).toStrictEqual([]);
  });

  it("does not resolve a namespace import through a qualified local namespace", () => {
    const source =
      'import * as legacy from "./legacy.ts";\nimport { expect } from "vite-plus/test";\n\nnamespace Probe {\n  namespace legacy.inner { export const current = true; }\n  expect(legacy).not.toHaveProperty("legacyMode");\n}\n';

    expect(exportVerificationsIn(source)).toStrictEqual([]);
  });

  it("keeps resolving a namespace import past a string-literal module declaration", () => {
    const source =
      'import * as legacy from "./legacy.ts";\nimport { expect } from "vite-plus/test";\n\ndeclare module "legacy" {}\nexpect(legacy).not.toHaveProperty("legacyMode");\n';

    expect(exportVerificationsIn(source)).toStrictEqual([exportVerificationAt(5)]);
  });

  it("does not resolve a namespace import through an import-equals binding", () => {
    const source =
      'import * as legacy from "./legacy.ts";\nimport { expect } from "vite-plus/test";\n\nnamespace Probe {\n  import legacy = Other.legacy;\n  expect(legacy).not.toHaveProperty("legacyMode");\n}\n';

    expect(exportVerificationsIn(source)).toStrictEqual([]);
  });

  it("keeps resolving a namespace import past a type-only declaration", () => {
    const source =
      'import * as legacy from "./legacy.ts";\nimport { expect } from "vite-plus/test";\n\nfunction probe() {\n  interface legacy {}\n  expect(legacy).not.toHaveProperty("legacyMode");\n}\n';

    expect(exportVerificationsIn(source)).toStrictEqual([exportVerificationAt(6)]);
  });
});
