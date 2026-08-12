import { describe, expect, test } from "vite-plus/test";

import { analyzeCanonicalValuesRepository } from "./builder.ts";
import {
  annotateCanonicalValues,
  createCanonicalValuesTestRepository,
  writeCanonicalValuesTestFile,
} from "./canonical-values-test-fixture.ts";

const analyzeSources = (sources: Readonly<Record<string, string>>) => {
  const repositoryRoot = createCanonicalValuesTestRepository();
  Object.entries(sources).forEach(([relativePath, contents]) => {
    writeCanonicalValuesTestFile({ repositoryRoot, relativePath, contents });
  });
  return analyzeCanonicalValuesRepository({ repositoryRoot });
};

describe("canonical owner runtime domain", () => {
  test.each([
    `declare function load(): readonly ["draft", "published"];
${annotateCanonicalValues("order.status", "export const VALUES = load();")}`,
    `const load = () => ["archived"] as unknown as readonly ["draft", "published"];
${annotateCanonicalValues("order.status", "export const VALUES = load();")}`,
    `const load = () => ["archived"] as unknown as readonly ["draft", "published"];
${annotateCanonicalValues(
  "order.status",
  'export const VALUES: readonly ["draft", "published"] = load();',
)}`,
    `type Values = { readonly draft: 0; readonly published: 1 };
const load = () => ({ archived: 2 }) as unknown as Values;
${annotateCanonicalValues("order.status", "export const VALUES = load();")}`,
  ])("a type-only runtime claim cannot register an owner", (source) => {
    const analyzed = analyzeSources({ "src/values.ts": source });

    expect(analyzed.catalog.entries).toStrictEqual([]);
    expect(analyzed.problems[0]).toMatchObject({
      kind: "vocabulary-without-values",
      filePath: "src/values.ts",
      conceptId: "order.status",
    });
  });

  test("an imported asserted return cannot register an owner", () => {
    const analyzed = analyzeSources({
      "src/load.ts":
        'export const load = () => ["archived"] as unknown as readonly ["draft", "published"];',
      "src/values.ts": `import { load } from "./load.ts";
${annotateCanonicalValues("order.status", "export const VALUES = load();")}`,
    });

    expect(analyzed.catalog.entries).toStrictEqual([]);
  });

  test("a proven runtime array registers an owner", () => {
    const analyzed = analyzeSources({
      "src/values.ts": annotateCanonicalValues(
        "order.status",
        'export const VALUES = ["draft", "published"] as const;',
      ),
    });

    expect(analyzed.problems).toStrictEqual([]);
    expect(analyzed.catalog.entries[0]?.values).toStrictEqual(["draft", "published"]);
  });

  test("a preceding Object identity-method write cannot supply an owner runtime domain", () => {
    const analyzed = analyzeSources({
      "src/values.ts": `Object.freeze = () => ["archived"];
${annotateCanonicalValues(
  "order.status",
  'export const VALUES = Object.freeze(["draft", "published"] as const);',
)}`,
    });

    expect(analyzed.catalog.entries).toStrictEqual([]);
    expect(analyzed.problems[0]).toMatchObject({
      kind: "vocabulary-without-values",
      filePath: "src/values.ts",
      conceptId: "order.status",
    });
  });

  test("an Object identity-method write after owner initialization leaves it registered", () => {
    const analyzed = analyzeSources({
      "src/values.ts": `${annotateCanonicalValues(
        "order.status",
        'export const VALUES = Object.freeze(["draft", "published"] as const);',
      )}Object.freeze = () => ["archived"];`,
    });

    expect(analyzed.problems).toStrictEqual([]);
    expect(analyzed.catalog.entries[0]?.values).toStrictEqual(["draft", "published"]);
  });

  test("a prototype setter cannot register a nonexistent owner key", () => {
    const analyzed = analyzeSources({
      "src/values.ts": annotateCanonicalValues(
        "order.status",
        "export const VALUES = { __proto__: null, draft: 0, published: 1 } as const;",
      ),
    });

    expect(analyzed.catalog.entries).toStrictEqual([]);
    expect(analyzed.problems[0]).toMatchObject({
      kind: "vocabulary-without-values",
      filePath: "src/values.ts",
      conceptId: "order.status",
    });
  });

  test.each([
    ["", "export const VALUES = { ['__proto__']: null, draft: 0, published: 1 } as const;"],
    [
      "const __proto__ = null;\n",
      "export const VALUES = { __proto__, draft: 0, published: 1 } as const;",
    ],
  ])("an own __proto__ property registers its runtime key", (prelude, declaration) => {
    const analyzed = analyzeSources({
      "src/values.ts": `${prelude}${annotateCanonicalValues("order.status", declaration)}`,
    });

    expect(analyzed.problems).toStrictEqual([]);
    expect(analyzed.catalog.entries[0]?.values).toStrictEqual(["__proto__", "draft", "published"]);
  });
});
