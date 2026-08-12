import { describe, expect, test } from "vite-plus/test";

import { analyzeCanonicalValuesRepository } from "./builder.ts";
import {
  annotateCanonicalValues,
  createCanonicalValuesTestRepository,
  writeCanonicalValuesTestFile,
} from "./canonical-values-test-fixture.ts";

describe("direct canonical value duplicates", () => {
  test.each([
    {
      kind: "duplicate tuple alias",
      base: 'const BASE = ["draft", "draft", "published"] as const;',
      declaration: "export const VALUES = BASE;",
    },
    {
      kind: "duplicate tuple call",
      base: 'declare function load(): readonly ["draft", "draft", "published"];',
      declaration: "export const VALUES = load();",
    },
    {
      kind: "duplicate object alias",
      base: "const BASE = { draft: 0, draft: 1, published: 2 } as const;",
      declaration: "export const VALUES = BASE;",
    },
    {
      kind: "unbounded array call",
      base: 'declare function load(): readonly ("draft" | "published")[];',
      declaration: "export const VALUES = load();",
    },
    {
      kind: "unknown empty object spread",
      base: "declare function load(): {};",
      declaration: "export const VALUES = { ...load(), draft: 1, published: 2 } as const;",
    },
    {
      kind: "optional object spread",
      base: "declare function load(): { draft?: 0 };",
      declaration: "export const VALUES = { ...load(), published: 2 } as const;",
    },
    {
      kind: "indexed object result",
      base: "declare function load(): { draft: 0; published: 1; [key: string]: number };",
      declaration: "export const VALUES = load();",
    },
    {
      kind: "optional object result",
      base: "declare function load(): { draft?: 0; published: 1 };",
      declaration: "export const VALUES = load();",
    },
  ])("a $kind cannot become a canonical owner", ({ base, declaration }) => {
    const repositoryRoot = createCanonicalValuesTestRepository();
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "src/values.ts",
      contents: `${base}\n${annotateCanonicalValues("order.status", declaration)}`,
    });

    const analyzed = analyzeCanonicalValuesRepository({ repositoryRoot });

    expect(analyzed.catalog.entries).toStrictEqual([]);
    expect(analyzed.problems).toContainEqual({
      kind: "vocabulary-without-values",
      filePath: "src/values.ts",
      line: 2,
      conceptId: "order.status",
    });
  });
});
