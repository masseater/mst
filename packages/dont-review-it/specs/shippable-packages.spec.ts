import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, it, onTestFinished } from "vite-plus/test";

import { defaultShippablePackagesConfig } from "../src/shippable-packages/config.ts";
import { shippablePackagesProblems } from "../src/shippable-packages/shippable-packages.ts";

const config = defaultShippablePackagesConfig;

const WITHHELD = {
  "packages/internal/package.json": `{
  "name": "@example/internal",
  "private": true
}`,
};

const repositoryWith = async (files: Readonly<Record<string, string>>): Promise<string> => {
  const repositoryRoot = await mkdtemp(join(tmpdir(), "dont-review-it-shippable-packages-"));
  onTestFinished(async () => rm(repositoryRoot, { recursive: true, force: true }));

  await Promise.all(
    Object.entries(files).map(async ([spelled, source]) => {
      const checked = join(repositoryRoot, spelled);
      await mkdir(dirname(checked), { recursive: true });
      await writeFile(checked, source, "utf-8");
    }),
  );
  return repositoryRoot;
};

describe("出荷できるパッケージの検査", () => {
  it("公開できるパッケージが private なワークスペースを依存に載せていることを報告する", async () => {
    const repositoryRoot = await repositoryWith({
      ...WITHHELD,
      "packages/shipped/package.json": `{
  "name": "@example/shipped",
  "dependencies": { "@example/internal": "workspace:*" }
}`,
    });

    expect(shippablePackagesProblems({ repositoryRoot, config }).problems).toStrictEqual([
      {
        file: "packages/shipped/package.json",
        line: 3,
        message:
          'A package that npm can publish must not declare dependencies on @example/internal, because that workspace is marked "private": true and no registry ever serves it. Move it to devDependencies so the build bundles it, or let it publish by removing "private": true.',
      },
    ]);
  });

  it("同じワークスペースを開発依存に置いた公開できるパッケージを黙って通す", async () => {
    const repositoryRoot = await repositoryWith({
      ...WITHHELD,
      "packages/shipped/package.json": `{
  "name": "@example/shipped",
  "devDependencies": { "@example/internal": "workspace:*" }
}`,
    });

    expect(shippablePackagesProblems({ repositoryRoot, config }).problems).toStrictEqual([]);
  });

  it("公開後に実行時が解決する入口が型注釈を持つソースを指していることを報告する", async () => {
    const repositoryRoot = await repositoryWith({
      "packages/shipped/package.json": `{
  "name": "@example/shipped",
  "bin": { "shipped": "./src/cli.ts" }
}`,
    });

    expect(shippablePackagesProblems({ repositoryRoot, config }).problems).toStrictEqual([
      {
        file: "packages/shipped/package.json",
        line: 3,
        message:
          "The published bin.shipped entry must not point at ./src/cli.ts, because Node refuses to strip types from a file under node_modules and an installer finds nothing it can run there. Point it at the built output, through publishConfig when the local path has to stay on the source.",
      },
    ]);
  });

  it("公開後の入口を publishConfig が成果物へ置き換えているパッケージを黙って通す", async () => {
    const repositoryRoot = await repositoryWith({
      "packages/shipped/package.json": `{
  "name": "@example/shipped",
  "files": ["dist"],
  "bin": { "shipped": "./src/cli.ts" },
  "publishConfig": { "bin": { "shipped": "./dist/cli.mjs" } }
}`,
    });

    expect(shippablePackagesProblems({ repositoryRoot, config }).problems).toStrictEqual([]);
  });

  it("型を渡す条件がソースを指していても報告しない", async () => {
    const repositoryRoot = await repositoryWith({
      "packages/shipped/package.json": `{
  "name": "@example/shipped",
  "files": ["dist", "src"],
  "exports": { ".": { "types": "./src/index.ts", "default": "./dist/index.mjs" } }
}`,
    });

    expect(shippablePackagesProblems({ repositoryRoot, config }).problems).toStrictEqual([]);
  });

  it("公開後の入口が指す場所を files の許可リストが載せていないことを報告する", async () => {
    const repositoryRoot = await repositoryWith({
      "packages/shipped/package.json": `{
  "name": "@example/shipped",
  "files": ["skills"],
  "exports": { ".": "./dist/index.mjs" }
}`,
    });

    expect(shippablePackagesProblems({ repositoryRoot, config }).problems).toStrictEqual([
      {
        file: "packages/shipped/package.json",
        line: 3,
        message:
          'The files allowlist must not leave out dist, because npm packs only what files names and a published entry would resolve to a path the archive never carried. Add "dist" to files.',
      },
    ]);
  });

  it("private なパッケージを、公開できるものとして数えない", async () => {
    const repositoryRoot = await repositoryWith({
      ...WITHHELD,
      "packages/shipped/package.json": `{
  "name": "@example/shipped"
}`,
    });

    expect(shippablePackagesProblems({ repositoryRoot, config }).scanned).toBe(1);
  });
});
