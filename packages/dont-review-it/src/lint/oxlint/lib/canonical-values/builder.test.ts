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

describe("buildCanonicalValuesCatalog", () => {
  describe("a catalog left behind by an earlier process", () => {
    const it = test.extend("conceptIdsFromACacheLeftBehind", ({}, { onCleanup }) => {
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
        (catalogedConcept) => catalogedConcept.conceptId,
      );
    });

    it("is reused while the inputs are unchanged", ({ conceptIdsFromACacheLeftBehind }) => {
      expect(conceptIdsFromACacheLeftBehind).toStrictEqual(["left.behind.by.the.cache"]);
    });
  });

  describe("a changed input", () => {
    const it = test.extend("valuesAfterAChangedInput", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      writeFileSync(join(root, "order-status.ts"), ORDER_STATUS_DRAFT_ONLY);
      buildCanonicalValuesCatalog({ repositoryRoot: root });
      writeFileSync(join(root, "order-status.ts"), ORDER_STATUS_WITH_ARCHIVED);
      return buildCanonicalValuesCatalog({ repositoryRoot: root }).entries.map(
        (catalogedConcept) => catalogedConcept.values,
      );
    });

    it("rebuilds the catalog without anyone clearing the cache", ({ valuesAfterAChangedInput }) => {
      expect(valuesAfterAChangedInput).toStrictEqual([["draft", "archived"]]);
    });
  });

  describe("every workspace in the checkout", () => {
    const it = test.extend("conceptIdsOfTwoWorkspaces", ({}, { onCleanup }) => {
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
        (catalogedConcept) => catalogedConcept.conceptId,
      );
    });

    it("contributes the hints it owns", ({ conceptIdsOfTwoWorkspaces }) => {
      expect(conceptIdsOfTwoWorkspaces).toStrictEqual(["order.status", "article.status"]);
    });
  });

  describe("a workspace missing from the checkout", () => {
    const it = test.extend("conceptIdsAfterAWorkspaceIsPruned", ({}, { onCleanup }) => {
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
        (catalogedConcept) => catalogedConcept.conceptId,
      );
    });

    it("costs only the hints that workspace owned", ({ conceptIdsAfterAWorkspaceIsPruned }) => {
      expect(conceptIdsAfterAWorkspaceIsPruned).toStrictEqual(["order.status"]);
    });
  });

  describe("an annotation inside a test file", () => {
    const it = test.extend("conceptIdsOfATestFile", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      writeFileSync(join(root, "order-status.test.ts"), ORDER_STATUS_ARRAY);
      return buildCanonicalValuesCatalog({ repositoryRoot: root }).entries.map(
        (catalogedConcept) => catalogedConcept.conceptId,
      );
    });

    it("declares nothing", ({ conceptIdsOfATestFile }) => {
      expect(conceptIdsOfATestFile).toStrictEqual([]);
    });
  });

  describe("every declaration form the shared scan reads", () => {
    const it = test
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
        return buildCanonicalValuesCatalog({ repositoryRoot: root }).entries.map(
          (catalogedConcept) => [catalogedConcept.conceptId, catalogedConcept.values],
        );
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
          (catalogedConcept) => catalogedConcept.conceptId,
        );
      });

    it("is carried into the catalog exactly as the scan reads it out of the same source", ({
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

    it("is listed in declaration path order", ({ conceptIdsOfEveryDeclarationForm }) => {
      expect(conceptIdsOfEveryDeclarationForm).toStrictEqual([
        "array.form",
        "enum.form",
        "object.form",
        "type.form",
      ]);
    });
  });
});

describe("listRepositoryFiles", () => {
  describe("a test file", () => {
    const it = test
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
      });

    it("is scanned for comments", ({ commentSourcePathsOfATestFile }) => {
      expect(commentSourcePathsOfATestFile).toStrictEqual(["order-status.test.ts"]);
    });

    it("is no declaration source", ({ declarationSourcePathsOfATestFile }) => {
      expect(declarationSourcePathsOfATestFile).toStrictEqual([]);
    });
  });
});
