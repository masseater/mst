import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { sortBy } from "es-toolkit";
import { describe, expect, test } from "vite-plus/test";

import { buildCanonicalValuesCatalog } from "./builder.ts";
import { scanCanonicalValuesText } from "./declarations.ts";
import { listRepositoryFiles } from "./source-files.ts";

const TAG = "@canonical-values";

const ORDER_STATUS_ARRAY = `/**\n * ${TAG} order.status\n */\nexport const ORDER_STATUSES = ["draft", "published"] as const;\n`;

const ORDER_STATUS_DRAFT_ONLY = `/**\n * ${TAG} order.status\n */\nexport const ORDER_STATUSES = ["draft"] as const;\n`;

const ORDER_STATUS_WITH_ARCHIVED = `/**\n * ${TAG} order.status\n */\nexport const ORDER_STATUSES = ["draft", "archived"] as const;\n`;

const ARTICLE_STATUS_PUBLISHED_ONLY = `/**\n * ${TAG} article.status\n */\nexport const ARTICLE_STATUSES = ["published"] as const;\n`;

const CACHE_SEGMENTS = ["node_modules", ".cache", "mst-dont-review-it", "canonical-values.json"];

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

const it = test
  .extend("conceptIdsFromACacheLeftBehind", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "canonical-values-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    writeFileSync(join(root, "order-status.ts"), ORDER_STATUS_DRAFT_ONLY);
    buildCanonicalValuesCatalog({ repositoryRoot: root });
    const written = JSON.parse(readFileSync(join(root, ...CACHE_SEGMENTS), "utf8")) as {
      readonly version: number;
      readonly fingerprint: string;
    };
    writeFileSync(
      join(root, ...CACHE_SEGMENTS),
      JSON.stringify({
        version: written.version,
        fingerprint: written.fingerprint,
        entries: [
          {
            conceptId: "left.behind.by.the.cache",
            declarationPath: "order-status.ts",
            exportPath: null,
            values: ["cached"],
            fingerprint: "fingerprint-of-cached",
          },
        ],
      }),
    );
    return buildCanonicalValuesCatalog({ repositoryRoot: root }).entries.map(
      (entry) => entry.conceptId,
    );
  })
  .extend("valuesAfterAChangedInput", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "canonical-values-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    writeFileSync(join(root, "order-status.ts"), ORDER_STATUS_DRAFT_ONLY);
    buildCanonicalValuesCatalog({ repositoryRoot: root });
    writeFileSync(join(root, "order-status.ts"), ORDER_STATUS_WITH_ARCHIVED);
    return buildCanonicalValuesCatalog({ repositoryRoot: root }).entries.map(
      (entry) => entry.values,
    );
  })
  .extend("conceptIdsOfTwoWorkspaces", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "canonical-values-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    mkdirSync(join(root, "packages", "kept", "src"), { recursive: true });
    mkdirSync(join(root, "packages", "pruned", "src"), { recursive: true });
    writeFileSync(join(root, "packages", "kept", "src", "order.ts"), ORDER_STATUS_DRAFT_ONLY);
    writeFileSync(
      join(root, "packages", "pruned", "src", "article.ts"),
      ARTICLE_STATUS_PUBLISHED_ONLY,
    );
    return buildCanonicalValuesCatalog({ repositoryRoot: root }).entries.map(
      (entry) => entry.conceptId,
    );
  })
  .extend("conceptIdsAfterAWorkspaceIsPruned", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "canonical-values-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    mkdirSync(join(root, "packages", "kept", "src"), { recursive: true });
    mkdirSync(join(root, "packages", "pruned", "src"), { recursive: true });
    writeFileSync(join(root, "packages", "kept", "src", "order.ts"), ORDER_STATUS_DRAFT_ONLY);
    writeFileSync(
      join(root, "packages", "pruned", "src", "article.ts"),
      ARTICLE_STATUS_PUBLISHED_ONLY,
    );
    buildCanonicalValuesCatalog({ repositoryRoot: root });
    rmSync(join(root, "packages", "pruned"), { recursive: true, force: true });
    return buildCanonicalValuesCatalog({ repositoryRoot: root }).entries.map(
      (entry) => entry.conceptId,
    );
  })
  .extend("commentSourcePathsOfATestFile", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "canonical-values-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    writeFileSync(join(root, "order-status.test.ts"), ORDER_STATUS_ARRAY);
    return listRepositoryFiles(root).commentSources.map((file) => file.relativePath);
  })
  .extend("declarationSourcePathsOfATestFile", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "canonical-values-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    writeFileSync(join(root, "order-status.test.ts"), ORDER_STATUS_ARRAY);
    return listRepositoryFiles(root).declarationSources.map((file) => file.relativePath);
  })
  .extend("conceptIdsOfATestFile", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "canonical-values-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    writeFileSync(join(root, "order-status.test.ts"), ORDER_STATUS_ARRAY);
    return buildCanonicalValuesCatalog({ repositoryRoot: root }).entries.map(
      (entry) => entry.conceptId,
    );
  })
  .extend("catalogRowsOfEveryDeclarationForm", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "canonical-values-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    for (const { conceptId, declaration } of sortBy(DECLARATION_FORMS, ["conceptId"])) {
      writeFileSync(
        join(root, `${conceptId}.ts`),
        `/**\n * ${TAG} ${conceptId}\n */\n${declaration}\n`,
      );
    }
    return buildCanonicalValuesCatalog({ repositoryRoot: root }).entries.map((entry) => [
      entry.conceptId,
      entry.values,
    ]);
  })
  .extend("conceptIdsOfEveryDeclarationForm", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "canonical-values-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    for (const { conceptId, declaration } of sortBy(DECLARATION_FORMS, ["conceptId"])) {
      writeFileSync(
        join(root, `${conceptId}.ts`),
        `/**\n * ${TAG} ${conceptId}\n */\n${declaration}\n`,
      );
    }
    return buildCanonicalValuesCatalog({ repositoryRoot: root }).entries.map(
      (entry) => entry.conceptId,
    );
  });

describe("builder", () => {
  it("a catalog left behind by an earlier process is reused while the inputs are unchanged", ({
    conceptIdsFromACacheLeftBehind,
  }) => {
    expect(conceptIdsFromACacheLeftBehind).toStrictEqual(["left.behind.by.the.cache"]);
  });

  it("a changed input rebuilds the catalog without anyone clearing the cache", ({
    valuesAfterAChangedInput,
  }) => {
    expect(valuesAfterAChangedInput).toStrictEqual([["draft", "archived"]]);
  });

  it("every workspace in the checkout contributes the hints it owns", ({
    conceptIdsOfTwoWorkspaces,
  }) => {
    expect(conceptIdsOfTwoWorkspaces).toStrictEqual(["order.status", "article.status"]);
  });

  it("a workspace missing from the checkout costs only the hints that workspace owned", ({
    conceptIdsAfterAWorkspaceIsPruned,
  }) => {
    expect(conceptIdsAfterAWorkspaceIsPruned).toStrictEqual(["order.status"]);
  });

  it("a test file is scanned for comments", ({ commentSourcePathsOfATestFile }) => {
    expect(commentSourcePathsOfATestFile).toStrictEqual(["order-status.test.ts"]);
  });

  it("a test file is no declaration source", ({ declarationSourcePathsOfATestFile }) => {
    expect(declarationSourcePathsOfATestFile).toStrictEqual([]);
  });

  it("an annotation inside a test file declares nothing", ({ conceptIdsOfATestFile }) => {
    expect(conceptIdsOfATestFile).toStrictEqual([]);
  });

  it("the catalog carries exactly what the shared scan reads out of the same source", ({
    catalogRowsOfEveryDeclarationForm,
  }) => {
    expect(catalogRowsOfEveryDeclarationForm).toStrictEqual(
      sortBy(DECLARATION_FORMS, ["conceptId"]).flatMap(({ conceptId, declaration }) =>
        scanCanonicalValuesText(
          `/**\n * ${TAG} ${conceptId}\n */\n${declaration}\n`,
        ).declarations.map((declared) => [declared.conceptId, declared.values]),
      ),
    );
  });

  it("the catalog lists every declaration form the scan reads, in declaration path order", ({
    conceptIdsOfEveryDeclarationForm,
  }) => {
    expect(conceptIdsOfEveryDeclarationForm).toStrictEqual([
      "array.form",
      "enum.form",
      "object.form",
      "type.form",
    ]);
  });
});
