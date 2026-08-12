import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, onTestFinished, test } from "vite-plus/test";

import { readAnnotatedSources } from "./annotated-sources.ts";
import { listRepositoryFiles } from "./source-files.ts";

describe("readAnnotatedSources", () => {
  const repositoryWith = (files: Readonly<Record<string, string>>): string => {
    const root = mkdtempSync(join(tmpdir(), "annotated-sources-"));
    onTestFinished(() => {
      rmSync(root, { recursive: true, force: true });
    });
    for (const [path, text] of Object.entries(files)) {
      const target = join(root, path);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, text, "utf8");
    }
    return root;
  };

  const annotated = (conceptId: string): string =>
    `/** @canonical-values ${conceptId} */
export const STATUSES = ["draft"] as const;
`;

  test("a source that vanished after the listing is left out instead of stopping the scan", () => {
    const root = repositoryWith({
      "src/gone.ts": annotated("user.status"),
      "src/kept.ts": annotated("article.status"),
    });
    const listed = listRepositoryFiles(root);
    rmSync(join(root, "src/gone.ts"));

    expect(readAnnotatedSources(listed).map((source) => source.relativePath)).toStrictEqual([
      "src/kept.ts",
    ]);
  });

  test("a source carrying no annotation is left out", () => {
    const root = repositoryWith({
      "src/plain.ts": "export const total = 1;\n",
      "src/annotated.ts": annotated("user.status"),
    });

    expect(
      readAnnotatedSources(listRepositoryFiles(root)).map((source) => source.relativePath),
    ).toStrictEqual(["src/annotated.ts"]);
  });

  test("a test file carries its problems but declares no concept", () => {
    const root = repositoryWith({
      "src/user.test.ts": annotated("user.status"),
    });

    expect(
      readAnnotatedSources(listRepositoryFiles(root)).map((source) => source.declarations),
    ).toStrictEqual([[]]);
  });
});
