import { describe, expect, test } from "vite-plus/test";

import { analyzeCanonicalValuesRepository } from "./builder.ts";
import {
  annotateCanonicalValues,
  createCanonicalValuesTestRepository,
  writeCanonicalValuesTestFile,
} from "./canonical-values-test-fixture.ts";

const analyze = (source: string) => {
  const repositoryRoot = createCanonicalValuesTestRepository();
  writeCanonicalValuesTestFile({
    repositoryRoot,
    relativePath: "src/values.ts",
    contents: source,
  });
  return analyzeCanonicalValuesRepository({ repositoryRoot });
};

describe("canonical owner stability", () => {
  test.each([
    {
      kind: "mutable tuple",
      declaration: 'export const VALUES: ["draft", "published"] = ["draft", "published"];',
      mutation: "",
    },
    {
      kind: "mutable object",
      declaration: "export const VALUES = { draft: 0, published: 1 };",
      mutation: "",
    },
    {
      kind: "array alias mutation",
      declaration: 'export const VALUES = ["draft", "published"] as const;',
      mutation: "const alias = VALUES; alias.pop();",
    },
    {
      kind: "member assignment",
      declaration: "export const VALUES = { draft: 0, published: 1 } as const;",
      mutation: 'VALUES["draft"] = 2;',
    },
    {
      kind: "delete expression",
      declaration: "export const VALUES = { draft: 0, published: 1 } as const;",
      mutation: 'delete VALUES["draft"];',
    },
    {
      kind: "Reflect deletion",
      declaration: "export const VALUES = { draft: 0, published: 1 } as const;",
      mutation: 'Reflect.deleteProperty(VALUES, "draft");',
    },
    {
      kind: "Object assignment",
      declaration: "export const VALUES = { draft: 0, published: 1 } as const;",
      mutation: "Object.assign(VALUES, { archived: 2 });",
    },
    {
      kind: "prototype mutator call",
      declaration: 'export const VALUES = ["draft", "published"] as const;',
      mutation: "Array.prototype.pop.call(VALUES);",
    },
  ])("a $kind cannot become a canonical owner", ({ declaration, mutation }) => {
    const analyzed = analyze(`${annotateCanonicalValues("order.status", declaration)}${mutation}`);

    expect(analyzed.catalog.entries).toStrictEqual([]);
    expect(analyzed.problems).toContainEqual({
      kind: "vocabulary-without-values",
      filePath: "src/values.ts",
      line: 1,
      conceptId: "order.status",
    });
  });

  test.each([
    'export const VALUES = ["draft", "published"] as const;',
    "export const VALUES = { draft: 0, published: 1 } as const;",
    "export const VALUES = { push: () => 0, published: 1 } as const;\nVALUES.push();",
    'export const VALUES = ["draft", "published"] as const;\nfunction unused() { (VALUES as unknown as string[]).pop(); }',
  ])("a readonly owner remains registered", (declaration) => {
    const analyzed = analyze(annotateCanonicalValues("order.status", declaration));

    expect(analyzed.problems).toStrictEqual([]);
    expect(analyzed.catalog.entries).toHaveLength(1);
  });

  test.each([
    `interface Values { readonly draft: 0; readonly published: 1 }
${annotateCanonicalValues(
  "order.status",
  "export const VALUES: Values = { draft: 0, published: 1 };",
)}`,
    `const Object = { assign(_target: unknown, _source: unknown) {} };
${annotateCanonicalValues(
  "order.status",
  "export const VALUES = { draft: 0, published: 1 } as const;",
)}Object.assign(VALUES, { archived: 2 });`,
  ])("a readonly object remains registered through a precise type or local shadow", (source) => {
    const analyzed = analyze(source);

    expect(analyzed.problems).toStrictEqual([]);
    expect(analyzed.catalog.entries).toHaveLength(1);
  });

  test.each([
    "let alias: readonly string[] = []; alias = VALUES; (alias as string[]).pop();",
    "const [alias] = [VALUES]; (alias as unknown as string[]).pop();",
    "const holder = { values: VALUES }; (holder.values as unknown as string[]).pop();",
    "function remove(values: readonly string[]) { (values as string[]).pop(); } remove(VALUES);",
    "const { pop } = Array.prototype; pop.call(VALUES);",
  ])("a runtime owner alias cannot be mutated", (mutation) => {
    const analyzed = analyze(
      `${annotateCanonicalValues(
        "order.status",
        'export const VALUES = ["draft", "published"] as const;',
      )}${mutation}`,
    );

    expect(analyzed.catalog.entries).toStrictEqual([]);
    expect(analyzed.problems).toContainEqual({
      kind: "vocabulary-without-values",
      filePath: "src/values.ts",
      line: 1,
      conceptId: "order.status",
    });
  });

  test.each([
    "const holder = [VALUES]; const alias = holder.slice()[0]; (alias as unknown as string[]).pop();",
    "const holder = ([] as (readonly string[])[]).concat([VALUES]); const alias = holder[0]; (alias as unknown as string[]).pop();",
    "const holder = Array.from([VALUES]); const alias = holder[0]; (alias as unknown as string[]).pop();",
    "const holder = [VALUES].filter(Boolean); const alias = holder[0]; (alias as unknown as string[]).pop();",
    "const holder = [VALUES].map((value) => value); const alias = holder[0]; (alias as unknown as string[]).pop();",
    "const holder = Object.values({ value: VALUES }); const alias = holder[0]; (alias as unknown as string[]).pop();",
    "const holder = new Set([VALUES]); for (const alias of holder) (alias as unknown as string[]).pop();",
    'const holder = new Map([["value", VALUES]]); for (const alias of holder.values()) (alias as unknown as string[]).pop();',
    "const key = {}; const holder = new WeakMap([[key, VALUES]]); const alias = holder.get(key)!; (alias as unknown as string[]).pop();",
    "Promise.resolve(VALUES).then((alias) => { (alias as unknown as string[]).pop(); });",
    "function* supply() { yield VALUES; } const alias = supply().next().value; (alias as unknown as string[]).pop();",
  ])("a derived container reference cannot mutate the owner", (mutation) => {
    const analyzed = analyze(
      `${annotateCanonicalValues(
        "order.status",
        'export const VALUES = ["draft", "published"] as const;',
      )}${mutation}`,
    );

    expect(analyzed.catalog.entries).toStrictEqual([]);
    expect(analyzed.problems).toContainEqual({
      kind: "vocabulary-without-values",
      filePath: "src/values.ts",
      line: 1,
      conceptId: "order.status",
    });
  });

  test.each([
    'const key = "value" as const; const holder = { [key]: VALUES }; (holder[key] as unknown as string[]).pop();',
    'const key = "value" as const; const holder: Record<string, readonly string[]> = {}; holder[key] = VALUES; (holder[key] as unknown as string[]).pop();',
    "const key = `value` as const; const holder: Record<string, readonly string[]> = {}; holder[key] = VALUES; (holder[key] as unknown as string[]).pop();",
    'const key = Symbol("value"); const holder: Record<PropertyKey, readonly string[]> = {}; holder[key] = VALUES; (holder[key] as unknown as string[]).pop();',
    "const holder: (readonly string[])[] = []; holder.push(VALUES); (holder[0] as unknown as string[]).pop();",
    "const holder: (readonly string[])[] = []; holder.splice(0, 0, VALUES); (holder[0] as unknown as string[]).pop();",
    'const holder = new Map<string, readonly string[]>(); holder.set("value", VALUES); (holder.get("value") as unknown as string[]).pop();',
    "const key = {}; const holder = new WeakMap<object, readonly string[]>(); holder.set(key, VALUES); (holder.get(key) as unknown as string[]).pop();",
    "const holder = new Set<readonly string[]>(); holder.add(VALUES); for (const alias of holder) (alias as unknown as string[]).pop();",
    "const holder: { value?: readonly string[] } = {}; Object.assign(holder, { value: VALUES }); (holder.value as unknown as string[]).pop();",
    'const holder: { value?: readonly string[] } = {}; Object.defineProperty(holder, "value", { value: VALUES }); (holder.value as unknown as string[]).pop();',
  ])("a container write cannot hide an owner reference", (mutation) => {
    const analyzed = analyze(
      `${annotateCanonicalValues(
        "order.status",
        'export const VALUES = ["draft", "published"] as const;',
      )}${mutation}`,
    );

    expect(analyzed.catalog.entries).toStrictEqual([]);
    expect(analyzed.problems).toContainEqual({
      kind: "vocabulary-without-values",
      filePath: "src/values.ts",
      line: 1,
      conceptId: "order.status",
    });
  });

  test.each([
    'eval("VALUES.pop()");',
    'Function("values", "values.pop()")(VALUES);',
    "declare function mutate(values: any): void; mutate(VALUES);",
    "declare function mutate(values: string[]): void; mutate(VALUES as unknown as string[]);",
  ])("an opaque mutable invocation cannot receive the owner", (mutation) => {
    const analyzed = analyze(
      `${annotateCanonicalValues(
        "order.status",
        'export const VALUES = ["draft", "published"] as const;',
      )}${mutation}`,
    );

    expect(analyzed.catalog.entries).toStrictEqual([]);
    expect(analyzed.problems).toContainEqual({
      kind: "vocabulary-without-values",
      filePath: "src/values.ts",
      line: 1,
      conceptId: "order.status",
    });
  });

  test.each([
    'const assign = Object.assign; assign(VALUES as unknown as object, { 0: "archived" });',
    'const { assign } = Object; assign(VALUES as unknown as object, { 0: "archived" });',
    'Object.assign.call(null, VALUES as unknown as object, { 0: "archived" });',
    'Reflect.apply(Object.assign, null, [VALUES as unknown as object, { 0: "archived" }]);',
    'const mutate = Object.assign.bind(null, VALUES as unknown as object); mutate({ 0: "archived" });',
    'const set = Reflect.set; set(VALUES as unknown as object, "0", "archived");',
    'Reflect.set.call(Reflect, VALUES as unknown as object, "0", "archived");',
    'const O = Object; O.assign(VALUES as unknown as object, { 0: "archived" });',
    'const api = { mutate: Object.assign }; api.mutate(VALUES as unknown as object, { 0: "archived" });',
    "const pop = (VALUES as unknown as string[]).pop; pop.call(VALUES);",
    "const { pop } = VALUES as unknown as string[]; pop.call(VALUES);",
    "const pop = (VALUES as unknown as string[]).pop.bind(VALUES); pop();",
    "Reflect.apply((VALUES as unknown as string[]).pop, VALUES, []);",
  ])("a normalized mutator invocation cannot mutate the owner", (mutation) => {
    const analyzed = analyze(
      `${annotateCanonicalValues(
        "order.status",
        'export const VALUES = ["draft", "published"] as const;',
      )}${mutation}`,
    );

    expect(analyzed.catalog.entries).toStrictEqual([]);
    expect(analyzed.problems).toContainEqual({
      kind: "vocabulary-without-values",
      filePath: "src/values.ts",
      line: 1,
      conceptId: "order.status",
    });
  });

  test.each([
    "const alias = structuredClone(VALUES) as unknown as string[]; alias.pop();",
    "const copy = [...VALUES] as string[]; copy.pop();",
    "declare function consume(values: readonly string[]): void; consume(VALUES);",
    'eval("1 + 1");',
    'let alias: readonly string[] = VALUES; alias = ["archived"];',
    "const assign = Object.assign; consume(assign);",
  ])("a non-mutating runtime boundary leaves the owner registered", (boundary) => {
    const analyzed = analyze(
      `${annotateCanonicalValues(
        "order.status",
        'export const VALUES = ["draft", "published"] as const;',
      )}${boundary}`,
    );

    expect(analyzed.problems).toStrictEqual([]);
    expect(analyzed.catalog.entries).toHaveLength(1);
  });

  test.each([
    {
      line: 1,
      source: `${annotateCanonicalValues(
        "order.status",
        'export let VALUES = ["draft", "published"] as readonly ["draft", "published"];',
      )}VALUES = ["archived"] as unknown as typeof VALUES;`,
    },
    {
      line: 1,
      source: `${annotateCanonicalValues(
        "order.status",
        'export let VALUES = ["draft", "published"] as readonly ["draft", "published"];',
      )}[VALUES] = [["archived"] as unknown as typeof VALUES];`,
    },
    {
      line: 3,
      source: `let source = ["draft", "published"] as readonly ["draft", "published"];
source = ["archived"] as unknown as typeof source;
${annotateCanonicalValues("order.status", "export const VALUES = source;")}`,
    },
    {
      line: 4,
      source: `let source = ["draft", "published"] as readonly ["draft", "published"];
source = ["archived"] as unknown as typeof source;
function load() { return source; }
${annotateCanonicalValues("order.status", "export const VALUES = load();")}`,
    },
  ])("a binding write before owner capture rejects the owner", ({ line, source }) => {
    const analyzed = analyze(source);

    expect(analyzed.catalog.entries).toStrictEqual([]);
    expect(analyzed.problems).toContainEqual({
      kind: "vocabulary-without-values",
      filePath: "src/values.ts",
      line,
      conceptId: "order.status",
    });
  });

  test("a detached binding write leaves the captured owner registered", () => {
    const source = `${annotateCanonicalValues(
      "order.status",
      'export const VALUES = ["draft", "published"] as const;',
    )}let alias: readonly string[] = VALUES;
alias = ["archived"];`;
    const analyzed = analyze(source);

    expect(analyzed.problems).toStrictEqual([]);
    expect(analyzed.catalog.entries).toHaveLength(1);
  });

  test("an imported opaque mutable function cannot receive the owner", () => {
    const repositoryRoot = createCanonicalValuesTestRepository();
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "src/mutator.ts",
      contents: "export declare function mutate(values: any): void;\n",
    });
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "src/owner.ts",
      contents: `import { mutate } from "./mutator.ts";
${annotateCanonicalValues(
  "order.status",
  'export const VALUES = ["draft", "published"] as const;',
)}mutate(VALUES);`,
    });

    const analyzed = analyzeCanonicalValuesRepository({ repositoryRoot });

    expect(analyzed.catalog.entries).toStrictEqual([]);
    expect(analyzed.problems).toContainEqual({
      kind: "vocabulary-without-values",
      filePath: "src/owner.ts",
      line: 2,
      conceptId: "order.status",
    });
  });

  test("a production import cannot mutate the owner from another module", () => {
    const repositoryRoot = createCanonicalValuesTestRepository();
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "src/owner.ts",
      contents: annotateCanonicalValues(
        "order.status",
        'export const VALUES = ["draft", "published"] as const;',
      ),
    });
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "src/consumer.ts",
      contents:
        'import { VALUES } from "./owner.ts";\nfunction remove(values: readonly string[]) { (values as string[]).shift(); }\nremove(VALUES);\n',
    });

    const analyzed = analyzeCanonicalValuesRepository({ repositoryRoot });

    expect(analyzed.catalog.entries).toStrictEqual([]);
    expect(analyzed.problems).toContainEqual({
      kind: "vocabulary-without-values",
      filePath: "src/owner.ts",
      line: 1,
      conceptId: "order.status",
    });
  });
});
