import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { scopedCallExpressionsIn } from "./scoped-call-expressions.ts";
import { absenceVerificationsIn } from "./verification-source.ts";

describe("scopedCallExpressionsIn", () => {
  describe("a program with value declarations and destructured bindings", () => {
    const it = test.extend("programOccurrences", () => {
      const source =
        "export const { property: assigned = true, ...objectRest } = sourceObject; export const [arrayValue, ...arrayRest] = sourceArray; export default function exportedFunction() {} class DeclaredClass {} export { DeclaredClass }; enum DeclaredEnum { Value } namespace DeclaredNamespace {} import importedValue = Other.value; target();";
      return scopedCallExpressionsIn(parseSync("source.test.ts", source).program);
    });

    it("collects every value declaration", ({ programOccurrences }) => {
      expect(programOccurrences).toStrictEqual([
        {
          call: {
            arguments: [],
            callee: {
              decorators: [],
              end: 325,
              name: "target",
              optional: false,
              start: 319,
              type: "Identifier",
              typeAnnotation: null,
            },
            end: 327,
            optional: false,
            start: 319,
            type: "CallExpression",
            typeArguments: null,
          },
          localBindings: new Set([
            "assigned",
            "objectRest",
            "arrayValue",
            "arrayRest",
            "exportedFunction",
            "DeclaredClass",
            "DeclaredEnum",
            "DeclaredNamespace",
            "importedValue",
          ]),
        },
      ]);
    });
  });

  describe("catch, loop, switch, class, and named function scopes", () => {
    const it = test.extend("bindings", () => {
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
      return scopedCallExpressionsIn(parseSync("source.test.ts", source).program)
        .filter(({ call }) => call.callee.type === "Identifier" && call.callee.name === "target")
        .flatMap(({ localBindings }) => [...localBindings]);
    });

    it("tracks their value bindings", ({ bindings }) => {
      expect(bindings).toStrictEqual([
        "namedFunction",
        "namedExpression",
        "NamedClass",
        "functionBinding",
        "namedFunction",
        "namedExpression",
        "NamedClass",
        "innerName",
        "namedFunction",
        "namedExpression",
        "NamedClass",
        "caught",
        "namedFunction",
        "namedExpression",
        "NamedClass",
        "initialized",
        "namedFunction",
        "namedExpression",
        "NamedClass",
        "forOfBinding",
        "namedFunction",
        "namedExpression",
        "NamedClass",
        "forInBinding",
        "namedFunction",
        "namedExpression",
        "NamedClass",
        "switched",
        "namedFunction",
        "namedExpression",
        "NamedClass",
        "InnerClass",
      ]);
    });
  });

  describe("a var binding inside a class static block", () => {
    const it = test.extend("bindingStates", () => {
      const source =
        "class Probe { static { if (true) { var expect = (value: boolean) => value; } expect(true); } }";
      return scopedCallExpressionsIn(parseSync("source.test.ts", source).program).flatMap(
        ({ call, localBindings }) =>
          call.callee.type === "Identifier" && call.callee.name === "expect"
            ? [localBindings.has("expect")]
            : [],
      );
    });

    it("hoists the binding within the block", ({ bindingStates }) => {
      expect(bindingStates).toStrictEqual([true]);
    });
  });

  describe("a var binding inside a TypeScript module block", () => {
    const it = test.extend("bindingStates", () => {
      const source =
        "namespace Probe { if (true) { var expect = (value: boolean) => value; } expect(true); }";
      return scopedCallExpressionsIn(parseSync("source.test.ts", source).program).flatMap(
        ({ call, localBindings }) =>
          call.callee.type === "Identifier" && call.callee.name === "expect"
            ? [localBindings.has("expect")]
            : [],
      );
    });

    it("hoists the binding within the block", ({ bindingStates }) => {
      expect(bindingStates).toStrictEqual([true]);
    });
  });

  describe("a class static block nested in a function", () => {
    const it = test.extend("bindingStates", () => {
      const source =
        "const run = () => { class Probe { static { var expect = true; } } expect(true); };";
      return scopedCallExpressionsIn(parseSync("source.test.ts", source).program).flatMap(
        ({ call, localBindings }) =>
          call.callee.type === "Identifier" && call.callee.name === "expect"
            ? [localBindings.has("expect")]
            : [],
      );
    });

    it("does not leak the static-block var into the function", ({ bindingStates }) => {
      expect(bindingStates).toStrictEqual([false]);
    });
  });

  describe("a binding in another lexical scope beside an imported assertion", () => {
    const it = test.extend("verifications", () => {
      const source =
        'import { existsSync } from "node:fs";\nimport { expect, test } from "vite-plus/test";\n\nconst helper = (expect: boolean) => expect;\n\ntest("legacy is gone", () => {\n  expect(existsSync("src/legacy.ts")).toBe(false);\n});\n';
      return absenceVerificationsIn({ file: "src/repository.test.ts", source });
    });

    it("keeps resolving the imported assertion", ({ verifications }) => {
      expect(verifications).toStrictEqual([
        {
          kind: "file",
          locator: "file:src/legacy.ts",
          subjectPath: "src/legacy.ts",
          file: "src/repository.test.ts",
          line: 7,
          endLine: 7,
        },
      ]);
    });
  });

  describe("an imported assertion shadowed by a parameter", () => {
    const it = test.extend("verifications", () => {
      const source =
        'import { existsSync } from "node:fs";\nimport { expect, test } from "vite-plus/test";\n\ntest("legacy is gone", (expect) => {\n  expect(existsSync("src/legacy.ts")).toBe(false);\n});\n';
      return absenceVerificationsIn({ file: "src/repository.test.ts", source });
    });

    it("does not resolve through the parameter", ({ verifications }) => {
      expect(verifications).toStrictEqual([]);
    });
  });

  describe("an imported assertion shadowed by a static-block binding", () => {
    const it = test.extend("verifications", () => {
      const source =
        'import { existsSync } from "node:fs";\nimport { expect } from "vite-plus/test";\n\nclass Probe {\n  static {\n    const expect = (value: boolean) => ({ toBe: (expected: boolean) => value === expected });\n    expect(existsSync("src/legacy.ts")).toBe(false);\n  }\n}\n';
      return absenceVerificationsIn({ file: "src/repository.test.ts", source });
    });

    it("does not resolve through the static-block binding", ({ verifications }) => {
      expect(verifications).toStrictEqual([]);
    });
  });

  describe("an imported assertion shadowed by a TypeScript module binding", () => {
    const it = test.extend("verifications", () => {
      const source =
        'import { existsSync } from "node:fs";\nimport { expect } from "vite-plus/test";\n\nnamespace Probe {\n  const expect = (value: boolean) => ({ toBe: (expected: boolean) => value === expected });\n  expect(existsSync("src/legacy.ts")).toBe(false);\n}\n';
      return absenceVerificationsIn({ file: "src/repository.test.ts", source });
    });

    it("does not resolve through the module binding", ({ verifications }) => {
      expect(verifications).toStrictEqual([]);
    });
  });

  describe("a static-block var beside an outer imported assertion", () => {
    const it = test.extend("verifications", () => {
      const source =
        'import { existsSync } from "node:fs";\nimport { expect, test } from "vite-plus/test";\n\ntest("legacy is gone", () => {\n  class Probe {\n    static {\n      var expect = true;\n    }\n  }\n  expect(existsSync("src/legacy.ts")).toBe(false);\n});\n';
      return absenceVerificationsIn({ file: "src/repository.test.ts", source });
    });

    it("does not let the static-block var hide the outer import", ({ verifications }) => {
      expect(verifications).toStrictEqual([
        {
          kind: "file",
          locator: "file:src/legacy.ts",
          subjectPath: "src/legacy.ts",
          file: "src/repository.test.ts",
          line: 10,
          endLine: 10,
        },
      ]);
    });
  });

  describe("an imported assertion shadowed by a constructor parameter property", () => {
    const it = test.extend("verifications", () => {
      const source =
        'import { existsSync } from "node:fs";\nimport { expect } from "vite-plus/test";\n\nclass Probe {\n  constructor(private expect: (value: boolean) => { toBe(expected: boolean): boolean }) {\n    expect(existsSync("src/legacy.ts")).toBe(false);\n  }\n}\n';
      return absenceVerificationsIn({ file: "src/repository.test.ts", source });
    });

    it("does not resolve through the parameter property", ({ verifications }) => {
      expect(verifications).toStrictEqual([]);
    });
  });

  describe("a namespace import shadowed by a constructor parameter property", () => {
    const it = test.extend("verifications", () => {
      const source =
        'import * as legacy from "./legacy.ts";\nimport { expect } from "vite-plus/test";\n\nclass Probe {\n  constructor(private legacy: object) {\n    expect(legacy).not.toHaveProperty("legacyMode");\n  }\n}\n';
      return absenceVerificationsIn({ file: "src/legacy-api.test.ts", source });
    });

    it("does not resolve through the parameter property", ({ verifications }) => {
      expect(verifications).toStrictEqual([]);
    });
  });

  describe("a namespace import shadowed by a local enum", () => {
    const it = test.extend("verifications", () => {
      const source =
        'import * as legacy from "./legacy.ts";\nimport { expect } from "vite-plus/test";\n\nfunction probe() {\n  enum legacy { current }\n  expect(legacy).not.toHaveProperty("legacyMode");\n}\n';
      return absenceVerificationsIn({ file: "src/legacy-api.test.ts", source });
    });

    it("does not resolve through the enum", ({ verifications }) => {
      expect(verifications).toStrictEqual([]);
    });
  });

  describe("a namespace import shadowed by a local namespace", () => {
    const it = test.extend("verifications", () => {
      const source =
        'import * as legacy from "./legacy.ts";\nimport { expect } from "vite-plus/test";\n\nnamespace Probe {\n  export namespace legacy { export const current = true; }\n  expect(legacy).not.toHaveProperty("legacyMode");\n}\n';
      return absenceVerificationsIn({ file: "src/legacy-api.test.ts", source });
    });

    it("does not resolve through the namespace", ({ verifications }) => {
      expect(verifications).toStrictEqual([]);
    });
  });

  describe("a namespace import shadowed by a qualified local namespace", () => {
    const it = test.extend("verifications", () => {
      const source =
        'import * as legacy from "./legacy.ts";\nimport { expect } from "vite-plus/test";\n\nnamespace Probe {\n  namespace legacy.inner { export const current = true; }\n  expect(legacy).not.toHaveProperty("legacyMode");\n}\n';
      return absenceVerificationsIn({ file: "src/legacy-api.test.ts", source });
    });

    it("does not resolve through the qualified namespace", ({ verifications }) => {
      expect(verifications).toStrictEqual([]);
    });
  });

  describe("a namespace import beside a string-literal module declaration", () => {
    const it = test.extend("verifications", () => {
      const source =
        'import * as legacy from "./legacy.ts";\nimport { expect } from "vite-plus/test";\n\ndeclare module "legacy" {}\nexpect(legacy).not.toHaveProperty("legacyMode");\n';
      return absenceVerificationsIn({ file: "src/legacy-api.test.ts", source });
    });

    it("keeps resolving the namespace import", ({ verifications }) => {
      expect(verifications).toStrictEqual([
        {
          kind: "export",
          locator: '["declaration","src/legacy.ts","legacyMode"]',
          modulePath: "src/legacy.ts",
          exportName: "legacyMode",
          file: "src/legacy-api.test.ts",
          line: 5,
          endLine: 5,
        },
      ]);
    });
  });

  describe("a namespace import shadowed by an import-equals binding", () => {
    const it = test.extend("verifications", () => {
      const source =
        'import * as legacy from "./legacy.ts";\nimport { expect } from "vite-plus/test";\n\nnamespace Probe {\n  import legacy = Other.legacy;\n  expect(legacy).not.toHaveProperty("legacyMode");\n}\n';
      return absenceVerificationsIn({ file: "src/legacy-api.test.ts", source });
    });

    it("does not resolve through the import-equals binding", ({ verifications }) => {
      expect(verifications).toStrictEqual([]);
    });
  });

  describe("a namespace import beside a type-only declaration of the same name", () => {
    const it = test.extend("verifications", () => {
      const source =
        'import * as legacy from "./legacy.ts";\nimport { expect } from "vite-plus/test";\n\nfunction probe() {\n  interface legacy {}\n  expect(legacy).not.toHaveProperty("legacyMode");\n}\n';
      return absenceVerificationsIn({ file: "src/legacy-api.test.ts", source });
    });

    it("keeps resolving the namespace import", ({ verifications }) => {
      expect(verifications).toStrictEqual([
        {
          kind: "export",
          locator: '["declaration","src/legacy.ts","legacyMode"]',
          modulePath: "src/legacy.ts",
          exportName: "legacyMode",
          file: "src/legacy-api.test.ts",
          line: 6,
          endLine: 6,
        },
      ]);
    });
  });
});
