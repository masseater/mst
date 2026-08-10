import { type AstNodeFields } from "@mst/utils";
import { isPlainObject } from "es-toolkit";
import { parseSync } from "oxc-parser";
import { describe, expect, it } from "vite-plus/test";

import { checkTestRepository as check } from "../check-test-repository.ts";
import { withTestRepository } from "../test-repository.ts";
import { scopedCallExpressionsIn } from "./scoped-call-expressions.ts";

const expectBindingStatesIn = (source: string): readonly boolean[] =>
  scopedCallExpressionsIn(parseSync("source.test.ts", source).program).flatMap(
    ({ call, localBindings }) => {
      if (!isPlainObject(call.callee)) return [];
      const callee: AstNodeFields = call.callee;
      return callee.type === "Identifier" && callee.name === "expect"
        ? [localBindings.has("expect")]
        : [];
    },
  );

describe("scopedCallExpressionsIn", () => {
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

  it("does not let a binding in another lexical scope hide an imported assertion", async () => {
    await withTestRepository(async (repository) => {
      const base = repository.commit({
        files: { "src/legacy.ts": "export const legacy = true;\n" },
      });
      const head = repository.commit({
        files: {
          "src/repository.test.ts":
            'import { existsSync } from "node:fs";\nimport { expect, test } from "vite-plus/test";\n\nconst helper = (expect: boolean) => expect;\n\ntest("legacy is gone", () => {\n  expect(existsSync("src/legacy.ts")).toBe(false);\n});\n',
        },
        removed: ["src/legacy.ts"],
      });

      const scopedBindingReport = await check({ repository, base, head });

      expect(scopedBindingReport).toStrictEqual({
        exitCode: 1,
        out: 'src/repository.test.ts:7 no-removal-verification: Do not assert that deleted file "src/legacy.ts" remains absent; remove the assertion.\n',
        error: "",
      });
    });
  });

  it("does not resolve an imported assertion through a shadowing parameter", async () => {
    await withTestRepository(async (repository) => {
      const base = repository.commit({
        files: { "src/legacy.ts": "export const legacy = true;\n" },
      });
      const head = repository.commit({
        files: {
          "src/repository.test.ts":
            'import { existsSync } from "node:fs";\nimport { expect, test } from "vite-plus/test";\n\ntest("legacy is gone", (expect) => {\n  expect(existsSync("src/legacy.ts")).toBe(false);\n});\n',
        },
        removed: ["src/legacy.ts"],
      });

      expect(await check({ repository, base, head })).toStrictEqual({
        exitCode: 0,
        out: "",
        error: "",
      });
    });
  });

  it("does not resolve an imported assertion through a static block binding", async () => {
    await withTestRepository(async (repository) => {
      const base = repository.commit({
        files: { "src/legacy.ts": "export const legacy = true;\n" },
      });
      const head = repository.commit({
        files: {
          "src/repository.test.ts":
            'import { existsSync } from "node:fs";\nimport { expect } from "vite-plus/test";\n\nclass Probe {\n  static {\n    const expect = (value: boolean) => ({ toBe: (expected: boolean) => value === expected });\n    expect(existsSync("src/legacy.ts")).toBe(false);\n  }\n}\n',
        },
        removed: ["src/legacy.ts"],
      });

      expect(await check({ repository, base, head })).toStrictEqual({
        exitCode: 0,
        out: "",
        error: "",
      });
    });
  });

  it("does not resolve an imported assertion through a TypeScript module binding", async () => {
    await withTestRepository(async (repository) => {
      const base = repository.commit({
        files: { "src/legacy.ts": "export const legacy = true;\n" },
      });
      const head = repository.commit({
        files: {
          "src/repository.test.ts":
            'import { existsSync } from "node:fs";\nimport { expect } from "vite-plus/test";\n\nnamespace Probe {\n  const expect = (value: boolean) => ({ toBe: (expected: boolean) => value === expected });\n  expect(existsSync("src/legacy.ts")).toBe(false);\n}\n',
        },
        removed: ["src/legacy.ts"],
      });

      expect(await check({ repository, base, head })).toStrictEqual({
        exitCode: 0,
        out: "",
        error: "",
      });
    });
  });

  it("does not let a static block var hide an outer imported assertion", async () => {
    await withTestRepository(async (repository) => {
      const base = repository.commit({
        files: { "src/legacy.ts": "export const legacy = true;\n" },
      });
      const head = repository.commit({
        files: {
          "src/repository.test.ts":
            'import { existsSync } from "node:fs";\nimport { expect, test } from "vite-plus/test";\n\ntest("legacy is gone", () => {\n  class Probe {\n    static {\n      var expect = true;\n    }\n  }\n  expect(existsSync("src/legacy.ts")).toBe(false);\n});\n',
        },
        removed: ["src/legacy.ts"],
      });

      const staticVarReport = await check({ repository, base, head });

      expect(staticVarReport).toStrictEqual({
        exitCode: 1,
        out: 'src/repository.test.ts:10 no-removal-verification: Do not assert that deleted file "src/legacy.ts" remains absent; remove the assertion.\n',
        error: "",
      });
    });
  });

  it("does not resolve an imported assertion through a parameter property", async () => {
    await withTestRepository(async (repository) => {
      const base = repository.commit({
        files: { "src/legacy.ts": "export const legacy = true;\n" },
      });
      const head = repository.commit({
        files: {
          "src/repository.test.ts":
            'import { existsSync } from "node:fs";\nimport { expect } from "vite-plus/test";\n\nclass Probe {\n  constructor(private expect: (value: boolean) => { toBe(expected: boolean): boolean }) {\n    expect(existsSync("src/legacy.ts")).toBe(false);\n  }\n}\n',
        },
        removed: ["src/legacy.ts"],
      });

      expect(await check({ repository, base, head })).toStrictEqual({
        exitCode: 0,
        out: "",
        error: "",
      });
    });
  });

  it("does not resolve a namespace import through a parameter property", async () => {
    await withTestRepository(async (repository) => {
      const base = repository.commit({
        files: {
          "src/legacy.ts": "export const current = true;\nexport const legacyMode = true;\n",
        },
      });
      const head = repository.commit({
        files: {
          "src/legacy.ts": "export const current = true;\n",
          "src/legacy-api.test.ts":
            'import * as legacy from "./legacy.ts";\nimport { expect } from "vite-plus/test";\n\nclass Probe {\n  constructor(private legacy: object) {\n    expect(legacy).not.toHaveProperty("legacyMode");\n  }\n}\n',
        },
      });

      expect(await check({ repository, base, head })).toStrictEqual({
        exitCode: 0,
        out: "",
        error: "",
      });
    });
  });

  it("does not resolve a namespace import through a local enum", async () => {
    await withTestRepository(async (repository) => {
      const base = repository.commit({
        files: {
          "src/legacy.ts": "export const current = true;\nexport const legacyMode = true;\n",
        },
      });
      const head = repository.commit({
        files: {
          "src/legacy.ts": "export const current = true;\n",
          "src/legacy-api.test.ts":
            'import * as legacy from "./legacy.ts";\nimport { expect } from "vite-plus/test";\n\nfunction probe() {\n  enum legacy { current }\n  expect(legacy).not.toHaveProperty("legacyMode");\n}\n',
        },
      });

      expect(await check({ repository, base, head })).toStrictEqual({
        exitCode: 0,
        out: "",
        error: "",
      });
    });
  });

  it("does not resolve a namespace import through a local namespace", async () => {
    await withTestRepository(async (repository) => {
      const base = repository.commit({
        files: {
          "src/legacy.ts": "export const current = true;\nexport const legacyMode = true;\n",
        },
      });
      const head = repository.commit({
        files: {
          "src/legacy.ts": "export const current = true;\n",
          "src/legacy-api.test.ts":
            'import * as legacy from "./legacy.ts";\nimport { expect } from "vite-plus/test";\n\nnamespace Probe {\n  export namespace legacy { export const current = true; }\n  expect(legacy).not.toHaveProperty("legacyMode");\n}\n',
        },
      });

      expect(await check({ repository, base, head })).toStrictEqual({
        exitCode: 0,
        out: "",
        error: "",
      });
    });
  });

  it("does not resolve a namespace import through a qualified local namespace", async () => {
    await withTestRepository(async (repository) => {
      const base = repository.commit({
        files: {
          "src/legacy.ts": "export const current = true;\nexport const legacyMode = true;\n",
        },
      });
      const head = repository.commit({
        files: {
          "src/legacy.ts": "export const current = true;\n",
          "src/legacy-api.test.ts":
            'import * as legacy from "./legacy.ts";\nimport { expect } from "vite-plus/test";\n\nnamespace Probe {\n  namespace legacy.inner { export const current = true; }\n  expect(legacy).not.toHaveProperty("legacyMode");\n}\n',
        },
      });

      expect(await check({ repository, base, head })).toStrictEqual({
        exitCode: 0,
        out: "",
        error: "",
      });
    });
  });

  it("keeps resolving a namespace import past a string-literal module declaration", async () => {
    await withTestRepository(async (repository) => {
      const base = repository.commit({
        files: {
          "src/legacy.ts": "export const current = true;\nexport const legacyMode = true;\n",
        },
      });
      const head = repository.commit({
        files: {
          "src/legacy.ts": "export const current = true;\n",
          "src/legacy-api.test.ts":
            'import * as legacy from "./legacy.ts";\nimport { expect } from "vite-plus/test";\n\ndeclare module "legacy" {}\nexpect(legacy).not.toHaveProperty("legacyMode");\n',
        },
      });

      expect(await check({ repository, base, head })).toStrictEqual({
        exitCode: 1,
        out: 'src/legacy-api.test.ts:5 no-removal-verification: Do not assert that removed export "legacyMode" from "src/legacy.ts" remains absent; remove the assertion.\n',
        error: "",
      });
    });
  });

  it("does not resolve a namespace import through an import-equals binding", async () => {
    await withTestRepository(async (repository) => {
      const base = repository.commit({
        files: {
          "src/legacy.ts": "export const current = true;\nexport const legacyMode = true;\n",
        },
      });
      const head = repository.commit({
        files: {
          "src/legacy.ts": "export const current = true;\n",
          "src/legacy-api.test.ts":
            'import * as legacy from "./legacy.ts";\nimport { expect } from "vite-plus/test";\n\nnamespace Probe {\n  import legacy = Other.legacy;\n  expect(legacy).not.toHaveProperty("legacyMode");\n}\n',
        },
      });

      expect(await check({ repository, base, head })).toStrictEqual({
        exitCode: 0,
        out: "",
        error: "",
      });
    });
  });

  it("keeps resolving a namespace import past a type-only declaration", async () => {
    await withTestRepository(async (repository) => {
      const base = repository.commit({
        files: {
          "src/legacy.ts": "export const current = true;\nexport const legacyMode = true;\n",
        },
      });
      const head = repository.commit({
        files: {
          "src/legacy.ts": "export const current = true;\n",
          "src/legacy-api.test.ts":
            'import * as legacy from "./legacy.ts";\nimport { expect } from "vite-plus/test";\n\nfunction probe() {\n  interface legacy {}\n  expect(legacy).not.toHaveProperty("legacyMode");\n}\n',
        },
      });

      expect(await check({ repository, base, head })).toStrictEqual({
        exitCode: 1,
        out: 'src/legacy-api.test.ts:6 no-removal-verification: Do not assert that removed export "legacyMode" from "src/legacy.ts" remains absent; remove the assertion.\n',
        error: "",
      });
    });
  });
});
