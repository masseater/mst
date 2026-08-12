import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { loadCanonicalValuesCatalog } from "./loaded-catalog.ts";

const TAG = "@canonical-values";

const ORDER_STATUS = `/**\n * ${TAG} order.status\n */\nexport const ORDER_STATUSES = ["draft"] as const;\n`;

const ARTICLE_STATUS = `/**\n * ${TAG} article.status\n */\nexport const ARTICLE_STATUSES = ["published"] as const;\n`;

const it = test
  .extend("verdictThatTheSecondLoadIsTheFirstCatalog", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "canonical-values-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    writeFileSync(join(root, "order-status.ts"), ORDER_STATUS);
    const firstlyLoaded = loadCanonicalValuesCatalog({ repositoryRoot: root });
    writeFileSync(join(root, "order-status.ts"), ARTICLE_STATUS);
    return loadCanonicalValuesCatalog({ repositoryRoot: root }) === firstlyLoaded;
  })
  .extend("conceptIdsLoadedAfterAChangedSource", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "canonical-values-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    writeFileSync(join(root, "order-status.ts"), ORDER_STATUS);
    loadCanonicalValuesCatalog({ repositoryRoot: root });
    writeFileSync(join(root, "order-status.ts"), ARTICLE_STATUS);
    return loadCanonicalValuesCatalog({ repositoryRoot: root }).entries.map(
      (entry) => entry.conceptId,
    );
  })
  .extend("conceptIdsOfARootThatIsNotOnDisk", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "canonical-values-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    return loadCanonicalValuesCatalog({
      repositoryRoot: join(root, "pruned-checkout"),
    }).entries.map((entry) => entry.conceptId);
  })
  .extend("existenceOfARootThatWasOnlyLoaded", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "canonical-values-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    loadCanonicalValuesCatalog({ repositoryRoot: join(root, "pruned-checkout") });
    return existsSync(join(root, "pruned-checkout"));
  });

describe("loaded-catalog", () => {
  it("the catalog is built once per repository root within a process", ({
    verdictThatTheSecondLoadIsTheFirstCatalog,
  }) => {
    expect(verdictThatTheSecondLoadIsTheFirstCatalog).toBe(true);
  });

  it("the catalog loaded a second time still carries what the first load read", ({
    conceptIdsLoadedAfterAChangedSource,
  }) => {
    expect(conceptIdsLoadedAfterAChangedSource).toStrictEqual(["order.status"]);
  });

  it("a repository root that is not on disk yields an empty catalog", ({
    conceptIdsOfARootThatIsNotOnDisk,
  }) => {
    expect(conceptIdsOfARootThatIsNotOnDisk).toStrictEqual([]);
  });

  it("a repository root that is not on disk is not created by loading it", ({
    existenceOfARootThatWasOnlyLoaded,
  }) => {
    expect(existenceOfARootThatWasOnlyLoaded).toBe(false);
  });
});
