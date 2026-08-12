import { describe, expect, test } from "vite-plus/test";

import { analyzeCanonicalValuesRepository } from "./builder.ts";
import {
  annotateCanonicalValues,
  createCanonicalValuesTestRepository,
  writeCanonicalValuesTestFile,
  writeCanonicalValuesTestFiles,
} from "./canonical-values-test-fixture.ts";

const analyzeBoundary = (boundary: string) => {
  const repositoryRoot = createCanonicalValuesTestRepository();
  writeCanonicalValuesTestFile({
    repositoryRoot,
    relativePath: "src/values.ts",
    contents: `${annotateCanonicalValues(
      "order.status",
      'export const VALUES = ["draft", "published"] as const;',
    )}${boundary}`,
  });
  return analyzeCanonicalValuesRepository({ repositoryRoot });
};

const analyzeSource = (source: string) => {
  const repositoryRoot = createCanonicalValuesTestRepository();
  writeCanonicalValuesTestFile({
    repositoryRoot,
    relativePath: "src/values.ts",
    contents: source,
  });
  return analyzeCanonicalValuesRepository({ repositoryRoot });
};

const analyzeFiles = (files: Readonly<Record<string, string>>) => {
  const repositoryRoot = createCanonicalValuesTestRepository();
  writeCanonicalValuesTestFiles({ files, repositoryRoot });
  return analyzeCanonicalValuesRepository({ repositoryRoot });
};

describe("canonical owner standard calls", () => {
  test.each([
    "const copy = [...VALUES]; copy.pop();",
    "const copy = VALUES.slice(); copy.pop();",
    "const copy = VALUES.concat([]); copy.pop();",
    "const copy = Array.from(VALUES); copy.pop();",
    "const copy = VALUES.filter(Boolean); copy.pop();",
    "const copy = VALUES.map((value) => value); copy.pop();",
    "const copy = VALUES.toReversed(); copy.pop();",
    "const copy = VALUES.toSpliced(0, 1); copy.pop();",
    "const copy = structuredClone(VALUES); (copy as string[]).pop();",
    "export const keys = Object.keys(VALUES);",
    "export const values = Object.values(VALUES);",
    "export const entries = Object.entries(VALUES);",
    "export const names = Object.getOwnPropertyNames(VALUES);",
    "export const keys = Reflect.ownKeys(VALUES);",
    "export const array = Array.isArray(VALUES);",
    "export const json = JSON.stringify(VALUES);",
  ])("a primitive copy or standard read leaves the owner registered", (boundary) => {
    const analyzed = analyzeBoundary(boundary);

    expect(analyzed.problems).toStrictEqual([]);
    expect(analyzed.catalog.entries).toHaveLength(1);
  });

  test.each([
    "const copy = VALUES; (copy as unknown as string[]).pop();",
    "const holder = Array.from([VALUES]); (holder[0] as unknown as string[]).pop();",
    "console.log(VALUES);",
    "consume(VALUES);",
  ])(
    "an identity-preserving or opaque boundary cannot receive owner mutation capability",
    (boundary) => {
      const analyzed = analyzeBoundary(boundary);

      expect(analyzed.catalog.entries).toStrictEqual([]);
      expect(analyzed.problems).toContainEqual({
        kind: "vocabulary-without-values",
        filePath: "src/values.ts",
        line: 1,
        conceptId: "order.status",
      });
    },
  );

  test.each([
    `Array.from = (value) => value;
${annotateCanonicalValues(
  "order.status",
  'export const VALUES = ["draft", "published"] as const;',
)}const copy = Array.from(VALUES); copy.pop();`,
    `Object.keys = (value) => { value.pop(); return []; };
${annotateCanonicalValues(
  "order.status",
  'export const VALUES = ["draft", "published"] as const;',
)}Object.keys(VALUES);`,
    `globalThis.structuredClone = (value) => value;
${annotateCanonicalValues(
  "order.status",
  'export const VALUES = ["draft", "published"] as const;',
)}const copy = structuredClone(VALUES); copy.pop();`,
    `Array.prototype.slice = function () { return this; };
${annotateCanonicalValues(
  "order.status",
  'export const VALUES = ["draft", "published"] as const;',
)}const copy = VALUES.slice(); copy.pop();`,
    `globalThis.Set = function (value) { return value; } as unknown as SetConstructor;
${annotateCanonicalValues(
  "order.status",
  'export const VALUES = ["draft", "published"] as const;',
)}const copy = new Set(VALUES); (copy as unknown as string[]).pop();`,
    `Object.defineProperty(Array, "from", { value: (value: unknown) => value });
${annotateCanonicalValues(
  "order.status",
  'export const VALUES = ["draft", "published"] as const;',
)}const copy = Array.from(VALUES); copy.pop();`,
    `declare const property: string;
Array[property] = (value: unknown) => value;
${annotateCanonicalValues(
  "order.status",
  'export const VALUES = ["draft", "published"] as const;',
)}const copy = Array.from(VALUES); copy.pop();`,
    `Object.assign(Object, { keys: (value: unknown) => value });
${annotateCanonicalValues(
  "order.status",
  'export const VALUES = ["draft", "published"] as const;',
)}Object.keys(VALUES);`,
    `Reflect.deleteProperty(Array, "from");
Object.setPrototypeOf(Array, { from: (value: unknown) => value });
${annotateCanonicalValues(
  "order.status",
  'export const VALUES = ["draft", "published"] as const;',
)}const copy = Array.from(VALUES); copy.pop();`,
    `globalThis.Array = new Proxy(Array, { get: (target, key) => key === "from" ? (value) => value : Reflect.get(target, key) });
${annotateCanonicalValues(
  "order.status",
  'export const VALUES = ["draft", "published"] as const;',
)}const copy = Array.from(VALUES); copy.pop();`,
    `Array.__proto__ = { from: (value: unknown) => value };
${annotateCanonicalValues(
  "order.status",
  'export const VALUES = ["draft", "published"] as const;',
)}const copy = Array.from(VALUES); copy.pop();`,
  ])("a preceding standard API write cannot preserve a copy or pure-read exemption", (source) => {
    const analyzed = analyzeSource(source);

    expect(analyzed.catalog.entries).toStrictEqual([]);
    expect(analyzed.problems[0]).toMatchObject({
      kind: "vocabulary-without-values",
      filePath: "src/values.ts",
      conceptId: "order.status",
    });
  });

  test("a standard API write after its last owner use leaves the owner registered", () => {
    const analyzed = analyzeBoundary(
      "const copy = Array.from(VALUES); copy.pop(); Array.from = (value) => value;",
    );

    expect(analyzed.problems).toStrictEqual([]);
    expect(analyzed.catalog.entries).toHaveLength(1);
  });

  test.each([
    {
      construction: "new Mutator(VALUES);",
      dependency: "export declare class Mutator { constructor(values: any); }",
      dependencyPath: "src/mutator.ts",
      importDeclaration: 'import { Mutator } from "./mutator.ts";',
      line: 2,
    },
    {
      construction: "new Mutator(VALUES);",
      dependency: "declare class Mutator { constructor(values: unknown); }",
      dependencyPath: "src/globals.d.ts",
      importDeclaration: null,
      line: 1,
    },
  ])("an opaque mutable constructor cannot receive the owner", (input) => {
    const ownerSource = `${annotateCanonicalValues(
      "order.status",
      'export const VALUES = ["draft", "published"] as const;',
    )}${input.construction}`;
    const analyzed = analyzeFiles({
      [input.dependencyPath]: input.dependency,
      "src/values.ts":
        input.importDeclaration === null
          ? ownerSource
          : `${input.importDeclaration}\n${ownerSource}`,
    });

    expect(analyzed.catalog.entries).toStrictEqual([]);
    expect(analyzed.problems).toContainEqual({
      kind: "vocabulary-without-values",
      filePath: "src/values.ts",
      line: input.line,
      conceptId: "order.status",
    });
  });

  test("an opaque readonly constructor can receive the owner", () => {
    const analyzed = analyzeFiles({
      "src/consumer.ts":
        "export declare class Consumer { constructor(values: readonly unknown[]); }",
      "src/values.ts": `import { Consumer } from "./consumer.ts";\n${annotateCanonicalValues(
        "order.status",
        'export const VALUES = ["draft", "published"] as const;',
      )}new Consumer(VALUES);`,
    });

    expect(analyzed.problems).toStrictEqual([]);
    expect(analyzed.catalog.entries).toHaveLength(1);
  });

  test.each([
    "const alias = new Proxy(VALUES, {}); (alias as unknown as string[]).pop();",
    "const alias = new Object(VALUES); (alias as unknown as string[]).pop();",
  ])("an identity-preserving default constructor cannot expose the owner", (boundary) => {
    const analyzed = analyzeBoundary(boundary);

    expect(analyzed.catalog.entries).toStrictEqual([]);
    expect(analyzed.problems[0]).toMatchObject({
      kind: "vocabulary-without-values",
      filePath: "src/values.ts",
      conceptId: "order.status",
    });
  });

  test.each([
    "class Mutator { constructor(values: readonly string[]) { (values as string[]).pop(); } } new Mutator(VALUES);",
    "class Mutator { constructor(values: readonly string[]); constructor(values: readonly string[]) { (values as string[]).pop(); } } new Mutator(VALUES);",
  ])("a local constructor parameter preserves owner identity", (boundary) => {
    const analyzed = analyzeBoundary(boundary);

    expect(analyzed.catalog.entries).toStrictEqual([]);
    expect(analyzed.problems[0]).toMatchObject({
      kind: "vocabulary-without-values",
      filePath: "src/values.ts",
      conceptId: "order.status",
    });
  });

  test("a value-copying default constructor leaves the owner registered", () => {
    const analyzed = analyzeBoundary('const copy = new Set(VALUES); copy.delete("draft");');

    expect(analyzed.problems).toStrictEqual([]);
    expect(analyzed.catalog.entries).toHaveLength(1);
  });
});
