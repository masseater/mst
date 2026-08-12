import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { readAnnotatedSources, readDeclarationSources } from "./annotated-sources.ts";
import { listRepositoryFiles } from "./source-files.ts";

const ANNOTATED_USER_STATUS = `/** @canonical-values user.status */
export const STATUSES = ["draft"] as const;
`;

const ANNOTATED_ARTICLE_STATUS = `/** @canonical-values article.status */
export const STATUSES = ["draft"] as const;
`;

const it = test
  .extend("pathsOfSourcesSurvivingTheListing", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "annotated-sources-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(join(root, "src/gone.ts"), ANNOTATED_USER_STATUS, "utf8");
    writeFileSync(join(root, "src/kept.ts"), ANNOTATED_ARTICLE_STATUS, "utf8");
    const listed = listRepositoryFiles(root);
    rmSync(join(root, "src/gone.ts"));
    return readAnnotatedSources(listed).map((source) => source.relativePath);
  })
  .extend("pathsOfAnnotatedSources", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "annotated-sources-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(join(root, "src/plain.ts"), "export const total = 1;\n", "utf8");
    writeFileSync(join(root, "src/annotated.ts"), ANNOTATED_USER_STATUS, "utf8");
    return readAnnotatedSources(listRepositoryFiles(root)).map((source) => source.relativePath);
  })
  .extend("declarationsOfAnnotatedTestFile", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "annotated-sources-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(join(root, "src/user.test.ts"), ANNOTATED_USER_STATUS, "utf8");
    return readAnnotatedSources(listRepositoryFiles(root)).map((source) => source.declarations);
  })
  .extend("declarationSourcesOfAnnotatedTestFile", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "annotated-sources-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(join(root, "src/user.test.ts"), ANNOTATED_USER_STATUS, "utf8");
    return readDeclarationSources(listRepositoryFiles(root));
  });

describe("readAnnotatedSources", () => {
  it("a source that vanished after the listing is left out instead of stopping the scan", ({
    pathsOfSourcesSurvivingTheListing,
  }) => {
    expect(pathsOfSourcesSurvivingTheListing).toStrictEqual(["src/kept.ts"]);
  });

  it("a source carrying no annotation is left out", ({ pathsOfAnnotatedSources }) => {
    expect(pathsOfAnnotatedSources).toStrictEqual(["src/annotated.ts"]);
  });

  it("a test file carries its problems but declares no concept", ({
    declarationsOfAnnotatedTestFile,
  }) => {
    expect(declarationsOfAnnotatedTestFile).toStrictEqual([[]]);
  });

  it("a test file is no source of a declaration", ({ declarationSourcesOfAnnotatedTestFile }) => {
    expect(declarationSourcesOfAnnotatedTestFile).toStrictEqual([]);
  });
});
