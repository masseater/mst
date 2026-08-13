import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { loadCanonicalValuesCatalog } from "./loaded-catalog.ts";

const TAG = "@canonical-values";

const ORDER_STATUS = `/**\n * ${TAG} order.status\n */\nexport const ORDER_STATUSES = ["draft"] as const;\n`;

const ARTICLE_STATUS = `/**\n * ${TAG} article.status\n */\nexport const ARTICLE_STATUSES = ["published"] as const;\n`;

describe("loadCanonicalValuesCatalog", () => {
  describe("a repository root whose source changed after the first load", () => {
    const it = test
      .extend("secondLoadVerdict", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-"));
        onCleanup(() => {
          rmSync(root, { recursive: true, force: true });
        });
        writeFileSync(join(root, "order-status.ts"), ORDER_STATUS);
        const firstlyLoaded = loadCanonicalValuesCatalog({ repositoryRoot: root });
        writeFileSync(join(root, "order-status.ts"), ARTICLE_STATUS);
        return loadCanonicalValuesCatalog({ repositoryRoot: root }) === firstlyLoaded;
      })
      .extend("conceptIds", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-"));
        onCleanup(() => {
          rmSync(root, { recursive: true, force: true });
        });
        writeFileSync(join(root, "order-status.ts"), ORDER_STATUS);
        loadCanonicalValuesCatalog({ repositoryRoot: root });
        writeFileSync(join(root, "order-status.ts"), ARTICLE_STATUS);
        return loadCanonicalValuesCatalog({ repositoryRoot: root }).entries.map(
          (declaration) => declaration.conceptId,
        );
      });

    it("is built once per repository root within a process", ({ secondLoadVerdict }) => {
      expect(secondLoadVerdict).toBe(true);
    });

    it("still carries what the first load read", ({ conceptIds }) => {
      expect(conceptIds).toStrictEqual(["order.status"]);
    });
  });

  describe("a repository root that is not on disk", () => {
    const it = test
      .extend("conceptIds", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-"));
        onCleanup(() => {
          rmSync(root, { recursive: true, force: true });
        });
        return loadCanonicalValuesCatalog({
          repositoryRoot: join(root, "pruned-checkout"),
        }).entries.map((declaration) => declaration.conceptId);
      })
      .extend("rootExistsAfterLoading", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-"));
        onCleanup(() => {
          rmSync(root, { recursive: true, force: true });
        });
        loadCanonicalValuesCatalog({ repositoryRoot: join(root, "pruned-checkout") });
        return existsSync(join(root, "pruned-checkout"));
      });

    it("yields an empty catalog", ({ conceptIds }) => {
      expect(conceptIds).toStrictEqual([]);
    });

    it("is not created by loading it", ({ rootExistsAfterLoading }) => {
      expect(rootExistsAfterLoading).toBe(false);
    });
  });
});
