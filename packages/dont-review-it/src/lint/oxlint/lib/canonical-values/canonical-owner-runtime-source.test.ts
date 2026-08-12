import { symlinkSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { analyzeCanonicalValuesRepository, buildCanonicalValuesCatalog } from "./builder.ts";
import {
  annotateCanonicalValues,
  createCanonicalValuesTestRepository,
  writeCanonicalValuesTestFile,
} from "./canonical-values-test-fixture.ts";

const nodeNextConfig = JSON.stringify({
  compilerOptions: {
    module: "NodeNext",
    moduleResolution: "NodeNext",
    strict: true,
  },
});

describe("canonical owner runtime source", () => {
  test("an out-of-scope runtime source cannot become a production owner", () => {
    const repositoryRoot = createCanonicalValuesTestRepository();
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "fixtures/base.ts",
      contents: 'export const BASE = ["draft", "published"] as const;\n',
    });
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "src/order-status.ts",
      contents: `import { BASE } from "../fixtures/base.ts";
${annotateCanonicalValues("order.status", "export const ORDER_STATUSES = BASE;")}`,
    });

    const analyzed = analyzeCanonicalValuesRepository({ repositoryRoot });

    expect(analyzed.catalog.entries).toStrictEqual([]);
    expect(analyzed.problems).toContainEqual({
      kind: "vocabulary-without-values",
      filePath: "src/order-status.ts",
      line: 2,
      conceptId: "order.status",
    });
  });

  test("an unregistered production runtime alias cannot become an owner source", () => {
    const repositoryRoot = createCanonicalValuesTestRepository();
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "src/base.ts",
      contents: 'export const BASE = ["draft", "published"] as const;\n',
    });
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "src/order-status.ts",
      contents: `import { BASE } from "./base.ts";
${annotateCanonicalValues("order.status", "export const ORDER_STATUSES = BASE;")}`,
    });

    const analyzed = analyzeCanonicalValuesRepository({ repositoryRoot });

    expect(analyzed.catalog.entries).toStrictEqual([]);
    expect(analyzed.problems).toContainEqual({
      kind: "vocabulary-without-values",
      filePath: "src/order-status.ts",
      line: 2,
      conceptId: "order.status",
    });
  });

  test("a registered runtime owner can supply another canonical owner", () => {
    const repositoryRoot = createCanonicalValuesTestRepository();
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "src/base.ts",
      contents: annotateCanonicalValues("base.status", 'export const BASE = ["draft"] as const;'),
    });
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "src/order-status.ts",
      contents: `import { BASE } from "./base.ts";
${annotateCanonicalValues(
  "order.status",
  'export const ORDER_STATUSES = [...BASE, "published"] as const;',
)}`,
    });

    expect(
      buildCanonicalValuesCatalog({ repositoryRoot }).entries.find(
        (entry) => entry.conceptId === "order.status",
      )?.values,
    ).toStrictEqual(["draft", "published"]);
  });

  test("an out-of-scope declaration remains outside catalog analysis", () => {
    const repositoryRoot = createCanonicalValuesTestRepository();
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "fixtures/order-status.ts",
      contents: annotateCanonicalValues(
        "order.status",
        'export const ORDER_STATUSES = ["draft", "published"] as const;',
      ),
    });

    const analyzed = analyzeCanonicalValuesRepository({ repositoryRoot });

    expect(analyzed.catalog.entries).toStrictEqual([]);
    expect(analyzed.problems).toContainEqual({
      kind: "out-of-scope-declaration",
      filePath: "fixtures/order-status.ts",
      line: 1,
      conceptId: "order.status",
    });
  });
});

describe("canonical owner cache boundaries", () => {
  test("a node_modules runtime source cannot become an owner or stale cache input", () => {
    const repositoryRoot = createCanonicalValuesTestRepository();
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "package.json",
      contents: JSON.stringify({ name: "fixture", private: true, type: "module" }),
    });
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "tsconfig.json",
      contents: nodeNextConfig,
    });
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "node_modules/domain/package.json",
      contents: JSON.stringify({ name: "domain", type: "module", exports: "./index.ts" }),
    });
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "node_modules/domain/index.ts",
      contents: 'export const STATUSES = ["draft", "published"] as const;\n',
    });
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "src/owner.ts",
      contents: `import { STATUSES } from "domain";
${annotateCanonicalValues("order.status", "export const ORDER_STATUSES = STATUSES;")}`,
    });

    expect(buildCanonicalValuesCatalog({ repositoryRoot }).entries).toStrictEqual([]);
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "node_modules/domain/index.ts",
      contents: 'export const STATUSES = ["archived", "deleted"] as const;\n',
    });

    expect(buildCanonicalValuesCatalog({ repositoryRoot }).entries).toStrictEqual([]);
    expect(analyzeCanonicalValuesRepository({ repositoryRoot }).catalog.entries).toStrictEqual([]);
  });

  test("an external runtime source symlink invalidates every owner entry", () => {
    const repositoryRoot = createCanonicalValuesTestRepository();
    const externalRoot = createCanonicalValuesTestRepository();
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "package.json",
      contents: JSON.stringify({ name: "fixture", private: true, type: "module" }),
    });
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "tsconfig.json",
      contents: nodeNextConfig,
    });
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "src/owner.ts",
      contents: `import { STATUSES } from "./source.ts";
${annotateCanonicalValues("order.status", "export const ORDER_STATUSES = STATUSES;")}`,
    });
    writeCanonicalValuesTestFile({
      repositoryRoot: externalRoot,
      relativePath: "source.ts",
      contents: 'export const STATUSES = ["draft", "published"] as const;\n',
    });
    symlinkSync(join(externalRoot, "source.ts"), join(repositoryRoot, "src/source.ts"));

    const analyzed = analyzeCanonicalValuesRepository({ repositoryRoot });

    expect(analyzed.catalog.entries).toStrictEqual([]);
    expect(analyzed.problems).toContainEqual({
      kind: "unsafe-symbolic-link",
      line: 1,
      filePath: "src/source.ts",
    });
    expect(buildCanonicalValuesCatalog({ repositoryRoot }).entries).toStrictEqual([]);
  });

  test("an external tsconfig symlink invalidates every owner entry", () => {
    const repositoryRoot = createCanonicalValuesTestRepository();
    const externalRoot = createCanonicalValuesTestRepository();
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "package.json",
      contents: JSON.stringify({ name: "fixture", private: true, type: "module" }),
    });
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "src/base.ts",
      contents: 'export const STATUSES = ["draft", "published"] as const;\n',
    });
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "src/owner.ts",
      contents: `import { STATUSES } from "@domain";
${annotateCanonicalValues("order.status", "export const ORDER_STATUSES = STATUSES;")}`,
    });
    writeCanonicalValuesTestFile({
      repositoryRoot: externalRoot,
      relativePath: "tsconfig.json",
      contents: JSON.stringify({
        compilerOptions: {
          baseUrl: ".",
          module: "NodeNext",
          moduleResolution: "NodeNext",
          paths: { "@domain": [join(repositoryRoot, "src/base.ts")] },
          strict: true,
        },
      }),
    });
    symlinkSync(join(externalRoot, "tsconfig.json"), join(repositoryRoot, "tsconfig.json"));

    const analyzed = analyzeCanonicalValuesRepository({ repositoryRoot });

    expect(analyzed.catalog.entries).toStrictEqual([]);
    expect(analyzed.problems).toContainEqual({
      kind: "unsafe-symbolic-link",
      line: 1,
      filePath: "tsconfig.json",
    });
    expect(buildCanonicalValuesCatalog({ repositoryRoot }).entries).toStrictEqual([]);
  });
});
