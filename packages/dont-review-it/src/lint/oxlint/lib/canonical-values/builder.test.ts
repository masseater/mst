import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { sortBy } from "es-toolkit";
import { expect, onTestFinished, test } from "vite-plus/test";

import { buildCanonicalValuesCatalog, loadCanonicalValuesCatalog } from "./builder.ts";
import { scanCanonicalValuesText } from "./declarations.ts";
import { fingerprintValues, type CanonicalValue } from "./fingerprint.ts";
import { listRepositoryFiles } from "./source-files.ts";

const CANONICAL_VALUES_TAG = "@canonical-values";

const createRepository = (): string => {
  const root = mkdtempSync(join(tmpdir(), "canonical-values-"));
  onTestFinished(() => {
    rmSync(root, { recursive: true, force: true });
  });
  return root;
};

type RepositoryFile = {
  readonly relativePath: string;
  readonly contents: string;
};

const writeRepositoryFile = (root: string, { relativePath, contents }: RepositoryFile): void => {
  const absolutePath = join(root, relativePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, contents, "utf8");
};

const annotate = (conceptId: string, declaration: string): string =>
  ["/**", ` * ${CANONICAL_VALUES_TAG} ${conceptId}`, " */", declaration, ""].join("\n");

const cachePathOf = (root: string): string =>
  join(root, "node_modules", ".cache", "mst-dont-review-it", "canonical-values.json");

const conceptIdsOf = (root: string): readonly string[] =>
  buildCanonicalValuesCatalog({ repositoryRoot: root }).entries.map((entry) => entry.conceptId);

test("an annotated array declaration becomes the catalog entry for its concept", () => {
  const root = createRepository();
  writeRepositoryFile(root, {
    relativePath: "src/order-status.ts",
    contents: annotate(
      "order.status",
      'export const ORDER_STATUSES = ["draft", "published"] as const;',
    ),
  });

  const catalog = buildCanonicalValuesCatalog({ repositoryRoot: root });

  expect(catalog.entries).toStrictEqual([
    {
      conceptId: "order.status",
      declarationPath: "src/order-status.ts",
      exportPath: null,
      values: ["draft", "published"],
      fingerprint: fingerprintValues(["draft", "published"]),
    },
  ]);
});

test("an annotated object declaration takes the values its keys point at", () => {
  const root = createRepository();
  writeRepositoryFile(root, {
    relativePath: "src/order-status.ts",
    contents: annotate(
      "order.status",
      'export const ORDER_STATUS = { Draft: "draft", Published: "published" } as const;',
    ),
  });

  const catalog = buildCanonicalValuesCatalog({ repositoryRoot: root });

  expect(catalog.entries.map((entry) => entry.values)).toStrictEqual([["draft", "published"]]);
});

test("an annotated type alias takes the members of its union", () => {
  const root = createRepository();
  writeRepositoryFile(root, {
    relativePath: "src/order-status.ts",
    contents: annotate("order.status", 'export type OrderStatus = "draft" | "published";'),
  });

  const catalog = buildCanonicalValuesCatalog({ repositoryRoot: root });

  expect(catalog.entries.map((entry) => entry.values)).toStrictEqual([["draft", "published"]]);
});

test("a declaration the package export map reaches carries the specifier that reaches it", () => {
  const root = createRepository();
  writeRepositoryFile(root, {
    relativePath: "packages/vocabulary/package.json",
    contents: JSON.stringify({ name: "@fixture/vocabulary", exports: { ".": "./src/index.ts" } }),
  });
  writeRepositoryFile(root, {
    relativePath: "packages/vocabulary/src/index.ts",
    contents: 'export { ORDER_STATUSES } from "./order-status.ts";\n',
  });
  writeRepositoryFile(root, {
    relativePath: "packages/vocabulary/src/order-status.ts",
    contents: annotate("order.status", 'export const ORDER_STATUSES = ["draft"] as const;'),
  });

  const catalog = buildCanonicalValuesCatalog({ repositoryRoot: root });

  expect(catalog.entries.map((entry) => entry.exportPath)).toStrictEqual(["@fixture/vocabulary"]);
});

test("a declaration no export map reaches carries no specifier", () => {
  const root = createRepository();
  writeRepositoryFile(root, {
    relativePath: "packages/vocabulary/package.json",
    contents: JSON.stringify({ name: "@fixture/vocabulary", exports: { ".": "./src/index.ts" } }),
  });
  writeRepositoryFile(root, {
    relativePath: "packages/vocabulary/src/index.ts",
    contents: "export const marker = 1;\n",
  });
  writeRepositoryFile(root, {
    relativePath: "packages/vocabulary/src/order-status.ts",
    contents: annotate("order.status", 'export const ORDER_STATUSES = ["draft"] as const;'),
  });

  const catalog = buildCanonicalValuesCatalog({ repositoryRoot: root });

  expect(catalog.entries.map((entry) => entry.exportPath)).toStrictEqual([null]);
});

test("a concept written outside the vocabulary drops the hint instead of failing the build", () => {
  const root = createRepository();
  writeRepositoryFile(root, {
    relativePath: "src/order-status.ts",
    contents: annotate("Order Status", 'export const ORDER_STATUSES = ["draft"] as const;'),
  });

  expect(conceptIdsOf(root)).toStrictEqual([]);
});

test("an annotation on a declaration that holds no literals drops the hint", () => {
  const root = createRepository();
  writeRepositoryFile(root, {
    relativePath: "src/order-status.ts",
    contents: annotate("order.status", "export const ORDER_STATUSES = buildStatuses();"),
  });

  expect(conceptIdsOf(root)).toStrictEqual([]);
});

test("the tag written outside a documentation block declares nothing", () => {
  const root = createRepository();
  writeRepositoryFile(root, {
    relativePath: "src/order-status.ts",
    contents: [
      `export const documentation = "${CANONICAL_VALUES_TAG} order.status";`,
      'export const ORDER_STATUSES = ["draft"] as const;',
      "",
    ].join("\n"),
  });

  expect(conceptIdsOf(root)).toStrictEqual([]);
});

test("the catalog is built once per repository root within a process", () => {
  const root = createRepository();
  writeRepositoryFile(root, {
    relativePath: "src/order-status.ts",
    contents: annotate("order.status", 'export const ORDER_STATUSES = ["draft"] as const;'),
  });

  const first = loadCanonicalValuesCatalog({ repositoryRoot: root });
  writeRepositoryFile(root, {
    relativePath: "src/order-status.ts",
    contents: annotate("article.status", 'export const ARTICLE_STATUSES = ["published"] as const;'),
  });
  const second = loadCanonicalValuesCatalog({ repositoryRoot: root });

  expect(second).toBe(first);
  expect(second.entries.map((entry) => entry.conceptId)).toStrictEqual(["order.status"]);
});

test("a catalog left behind by an earlier process is reused while the inputs are unchanged", () => {
  const root = createRepository();
  writeRepositoryFile(root, {
    relativePath: "src/order-status.ts",
    contents: annotate("order.status", 'export const ORDER_STATUSES = ["draft"] as const;'),
  });
  buildCanonicalValuesCatalog({ repositoryRoot: root });

  const cachePath = cachePathOf(root);
  const written: { readonly version: number; readonly fingerprint: string } = JSON.parse(
    readFileSync(cachePath, "utf8"),
  );
  writeFileSync(
    cachePath,
    JSON.stringify({
      version: written.version,
      fingerprint: written.fingerprint,
      entries: [
        {
          conceptId: "left.behind.by.the.cache",
          declarationPath: "src/order-status.ts",
          exportPath: null,
          values: ["cached"],
          fingerprint: fingerprintValues(["cached"]),
        },
      ],
    }),
    "utf8",
  );

  expect(conceptIdsOf(root)).toStrictEqual(["left.behind.by.the.cache"]);
});

test("a changed input rebuilds the catalog without anyone clearing the cache", () => {
  const root = createRepository();
  writeRepositoryFile(root, {
    relativePath: "src/order-status.ts",
    contents: annotate("order.status", 'export const ORDER_STATUSES = ["draft"] as const;'),
  });
  buildCanonicalValuesCatalog({ repositoryRoot: root });

  writeRepositoryFile(root, {
    relativePath: "src/order-status.ts",
    contents: annotate(
      "order.status",
      'export const ORDER_STATUSES = ["draft", "archived"] as const;',
    ),
  });
  const catalog = buildCanonicalValuesCatalog({ repositoryRoot: root });

  expect(catalog.entries.map((entry) => entry.values)).toStrictEqual([["draft", "archived"]]);
});

test("a repository root that is not on disk yields an empty catalog and creates nothing", () => {
  const root = createRepository();
  const pruned = join(root, "pruned-checkout");

  const catalog = loadCanonicalValuesCatalog({ repositoryRoot: pruned });

  expect(catalog.entries).toStrictEqual([]);
  expect(existsSync(pruned)).toBe(false);
});

test("a workspace missing from the checkout costs only the hints that workspace owned", () => {
  const root = createRepository();
  writeRepositoryFile(root, {
    relativePath: "packages/kept/src/order-status.ts",
    contents: annotate("order.status", 'export const ORDER_STATUSES = ["draft"] as const;'),
  });
  writeRepositoryFile(root, {
    relativePath: "packages/pruned/src/article-status.ts",
    contents: annotate("article.status", 'export const ARTICLE_STATUSES = ["published"] as const;'),
  });

  expect(conceptIdsOf(root)).toStrictEqual(["order.status", "article.status"]);

  rmSync(join(root, "packages", "pruned"), { recursive: true, force: true });

  expect(conceptIdsOf(root)).toStrictEqual(["order.status"]);
});

const annotateAsLineComment = (conceptId: string, declaration: string): string =>
  [`// ${CANONICAL_VALUES_TAG} ${conceptId}`, declaration, ""].join("\n");

const ANNOTATION_FORMS: readonly {
  readonly form: string;
  readonly write: (conceptId: string, declaration: string) => string;
}[] = [
  { form: "a documentation block", write: annotate },
  { form: "a line comment", write: annotateAsLineComment },
];

const valuesOf = (root: string): readonly (readonly CanonicalValue[])[] =>
  buildCanonicalValuesCatalog({ repositoryRoot: root }).entries.map((entry) => entry.values);

for (const { form, write } of ANNOTATION_FORMS) {
  test(`an annotation written as ${form} declares its concept`, () => {
    const root = createRepository();
    writeRepositoryFile(root, {
      relativePath: "src/order-status.ts",
      contents: write(
        "order.status",
        'export const ORDER_STATUSES = ["draft", "published"] as const;',
      ),
    });

    expect(conceptIdsOf(root)).toStrictEqual(["order.status"]);
    expect(valuesOf(root)).toStrictEqual([["draft", "published"]]);
  });

  test(`an enum annotated with ${form} declares the values of its members`, () => {
    const root = createRepository();
    writeRepositoryFile(root, {
      relativePath: "src/order-status.ts",
      contents: write(
        "order.status",
        'export enum OrderStatus {\n  Draft = "draft",\n  Published = "published",\n}',
      ),
    });

    expect(conceptIdsOf(root)).toStrictEqual(["order.status"]);
    expect(valuesOf(root)).toStrictEqual([["draft", "published"]]);
  });
}

test("a declaration that spells its type before its values keeps both", () => {
  const root = createRepository();
  writeRepositoryFile(root, {
    relativePath: "src/order-status.ts",
    contents: annotate(
      "order.status",
      'export const ORDER_STATUSES: readonly OrderStatus[] = ["draft", "published"];',
    ),
  });

  expect(valuesOf(root)).toStrictEqual([["draft", "published"]]);
});

test("the quoted keys of an annotated object stay out of its vocabulary", () => {
  const root = createRepository();
  writeRepositoryFile(root, {
    relativePath: "src/order-status.ts",
    contents: annotate(
      "order.status",
      'export const ORDER_STATUS = { "DRAFT": "draft", "PUBLISHED": "published" } as const;',
    ),
  });

  expect(valuesOf(root)).toStrictEqual([["draft", "published"]]);
});

test("a declaration that holds a single value is declared like any other", () => {
  const root = createRepository();
  writeRepositoryFile(root, {
    relativePath: "src/payment-method.ts",
    contents: annotate("payment.method", 'export const PAYMENT_METHOD = "card";'),
  });

  expect(conceptIdsOf(root)).toStrictEqual(["payment.method"]);
  expect(valuesOf(root)).toStrictEqual([["card"]]);
});

test("a second documentation block between the annotation and the declaration keeps it", () => {
  const root = createRepository();
  writeRepositoryFile(root, {
    relativePath: "src/order-status.ts",
    contents: annotate(
      "order.status",
      '/** @see the order lifecycle */\nexport const ORDER_STATUSES = ["draft", "published"] as const;',
    ),
  });

  expect(conceptIdsOf(root)).toStrictEqual(["order.status"]);
});

test("an annotation written inside a template literal declares nothing", () => {
  const root = createRepository();
  writeRepositoryFile(root, {
    relativePath: "src/documentation.ts",
    contents: [
      "export const EXAMPLE = `",
      `/** ${CANONICAL_VALUES_TAG} doc.example */`,
      'export const STATUSES = ["alpha", "beta"];',
      "`;",
      "",
    ].join("\n"),
  });

  expect(conceptIdsOf(root)).toStrictEqual([]);
});

test("an annotation inside a test file declares nothing, and the scan agrees it is no declaration source", () => {
  const root = createRepository();
  writeRepositoryFile(root, {
    relativePath: "src/order-status.test.ts",
    contents: annotate(
      "order.status",
      'export const ORDER_STATUSES = ["draft", "published"] as const;',
    ),
  });

  const { commentSources, declarationSources } = listRepositoryFiles(root);

  expect(commentSources.map((file) => file.relativePath)).toStrictEqual([
    "src/order-status.test.ts",
  ]);
  expect(declarationSources).toStrictEqual([]);
  expect(conceptIdsOf(root)).toStrictEqual([]);
});

const DECLARATION_FORMS: readonly { readonly conceptId: string; readonly declaration: string }[] = [
  {
    conceptId: "array.form",
    declaration: 'export const ARRAY_FORM: readonly string[] = ["draft", "published"];',
  },
  {
    conceptId: "object.form",
    declaration:
      'export const OBJECT_FORM = { "DRAFT": "draft", Published: "published" } as const;',
  },
  { conceptId: "type.form", declaration: 'export type TypeForm = "draft" | "published";' },
  {
    conceptId: "enum.form",
    declaration: 'export enum EnumForm {\n  Draft = "draft",\n  Published = "published",\n}',
  },
  { conceptId: "empty.form", declaration: "export const EMPTY_FORM = buildStatuses();" },
];

test("the catalog carries exactly what the shared scan reads out of the same source", () => {
  const root = createRepository();
  const sources = sortBy(DECLARATION_FORMS, ["conceptId"]).map(({ conceptId, declaration }) => ({
    conceptId,
    text: annotate(conceptId, declaration),
  }));
  for (const source of sources) {
    writeRepositoryFile(root, {
      relativePath: `src/${source.conceptId}.ts`,
      contents: source.text,
    });
  }

  const catalog = buildCanonicalValuesCatalog({ repositoryRoot: root });

  expect(catalog.entries.map((entry) => [entry.conceptId, entry.values])).toStrictEqual(
    sources.flatMap((source) =>
      scanCanonicalValuesText(source.text).declarations.map((declaration) => [
        declaration.conceptId,
        declaration.values,
      ]),
    ),
  );
  expect(catalog.entries.map((entry) => entry.conceptId)).toStrictEqual([
    "array.form",
    "enum.form",
    "object.form",
    "type.form",
  ]);
});
