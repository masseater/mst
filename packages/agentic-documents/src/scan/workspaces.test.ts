import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { collectWorkspaces } from "./workspaces.ts";

const DEFINITION_FILE = "pnpm-workspace.yaml";

const DEFINITION_FIELD = "packages";

const it = test
  .extend("collectionFromAPatternEndingInAStar", async ({}, { onCleanup }) => {
    const repositoryRoot = mkdtempSync(join(tmpdir(), "workspaces-"));
    onCleanup(() => {
      rmSync(repositoryRoot, { recursive: true, force: true });
    });
    for (const [path, text] of Object.entries({
      [DEFINITION_FILE]: "packages:\n  - packages/*\n",
      "packages/session/package.json": '{"name":"session","description":"接続"}',
      "packages/user/package.json": '{"name":"user","description":"利用者"}',
    })) {
      const target = join(repositoryRoot, path);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, text, "utf8");
    }
    return collectWorkspaces({
      repositoryRoot,
      definitionFile: DEFINITION_FILE,
      definitionField: DEFINITION_FIELD,
    });
  })
  .extend("collectionFromAPatternNamingOneDirectory", async ({}, { onCleanup }) => {
    const repositoryRoot = mkdtempSync(join(tmpdir(), "workspaces-"));
    onCleanup(() => {
      rmSync(repositoryRoot, { recursive: true, force: true });
    });
    for (const [path, text] of Object.entries({
      [DEFINITION_FILE]: "packages:\n  - tools/build\n",
      "tools/build/package.json": '{"name":"build","description":"組み立て"}',
    })) {
      const target = join(repositoryRoot, path);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, text, "utf8");
    }
    return collectWorkspaces({
      repositoryRoot,
      definitionFile: DEFINITION_FILE,
      definitionField: DEFINITION_FIELD,
    });
  })
  .extend("collectionFromWorkspacesMissingWhatTheyDeclare", async ({}, { onCleanup }) => {
    const repositoryRoot = mkdtempSync(join(tmpdir(), "workspaces-"));
    onCleanup(() => {
      rmSync(repositoryRoot, { recursive: true, force: true });
    });
    for (const [path, text] of Object.entries({
      [DEFINITION_FILE]: "packages:\n  - packages/*\n",
      "packages/session/package.json": '{"name":"session"}',
      "packages/user/README.md": "# user\n",
    })) {
      const target = join(repositoryRoot, path);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, text, "utf8");
    }
    return collectWorkspaces({
      repositoryRoot,
      definitionFile: DEFINITION_FILE,
      definitionField: DEFINITION_FIELD,
    });
  })
  .extend("collectionFromARepositoryWithoutADefinition", async ({}, { onCleanup }) => {
    const repositoryRoot = mkdtempSync(join(tmpdir(), "workspaces-"));
    onCleanup(() => {
      rmSync(repositoryRoot, { recursive: true, force: true });
    });
    writeFileSync(join(repositoryRoot, "README.md"), "# read me\n", "utf8");
    return collectWorkspaces({
      repositoryRoot,
      definitionFile: DEFINITION_FILE,
      definitionField: DEFINITION_FIELD,
    });
  })
  .extend("collectionFromADefinitionThatIsNotAMapping", async ({}, { onCleanup }) => {
    const repositoryRoot = mkdtempSync(join(tmpdir(), "workspaces-"));
    onCleanup(() => {
      rmSync(repositoryRoot, { recursive: true, force: true });
    });
    writeFileSync(join(repositoryRoot, DEFINITION_FILE), "- packages/*\n", "utf8");
    return collectWorkspaces({
      repositoryRoot,
      definitionFile: DEFINITION_FILE,
      definitionField: DEFINITION_FIELD,
    });
  })
  .extend("collectionFromADefinitionHoldingNothing", async ({}, { onCleanup }) => {
    const repositoryRoot = mkdtempSync(join(tmpdir(), "workspaces-"));
    onCleanup(() => {
      rmSync(repositoryRoot, { recursive: true, force: true });
    });
    writeFileSync(join(repositoryRoot, DEFINITION_FILE), "\n", "utf8");
    return collectWorkspaces({
      repositoryRoot,
      definitionFile: DEFINITION_FILE,
      definitionField: DEFINITION_FIELD,
    });
  })
  .extend("collectionFromAFieldThatIsNotAList", async ({}, { onCleanup }) => {
    const repositoryRoot = mkdtempSync(join(tmpdir(), "workspaces-"));
    onCleanup(() => {
      rmSync(repositoryRoot, { recursive: true, force: true });
    });
    writeFileSync(join(repositoryRoot, DEFINITION_FILE), "packages: all\n", "utf8");
    return collectWorkspaces({
      repositoryRoot,
      definitionFile: DEFINITION_FILE,
      definitionField: DEFINITION_FIELD,
    });
  })
  .extend("collectionFromAListHoldingAPatternThatIsNotAWord", async ({}, { onCleanup }) => {
    const repositoryRoot = mkdtempSync(join(tmpdir(), "workspaces-"));
    onCleanup(() => {
      rmSync(repositoryRoot, { recursive: true, force: true });
    });
    for (const [path, text] of Object.entries({
      [DEFINITION_FILE]: "packages:\n  - 1\n  - tools/build\n",
      "tools/build/package.json": '{"name":"build","description":"組み立て"}',
    })) {
      const target = join(repositoryRoot, path);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, text, "utf8");
    }
    return collectWorkspaces({
      repositoryRoot,
      definitionFile: DEFINITION_FILE,
      definitionField: DEFINITION_FIELD,
    });
  });

describe("collectWorkspaces", () => {
  it("a pattern that ends in a star names every directory below it", ({
    collectionFromAPatternEndingInAStar,
  }) => {
    expect(collectionFromAPatternEndingInAStar).toStrictEqual({
      entries: [
        { directory: "packages/session", description: "接続" },
        { directory: "packages/user", description: "利用者" },
      ],
      incomplete: [],
    });
  });

  it("a pattern that names one directory is taken as it is", ({
    collectionFromAPatternNamingOneDirectory,
  }) => {
    expect(collectionFromAPatternNamingOneDirectory).toStrictEqual({
      entries: [{ directory: "tools/build", description: "組み立て" }],
      incomplete: [],
    });
  });

  it("a workspace without a readable manifest, or without a description, is incomplete", ({
    collectionFromWorkspacesMissingWhatTheyDeclare,
  }) => {
    expect(collectionFromWorkspacesMissingWhatTheyDeclare).toStrictEqual({
      entries: [],
      incomplete: [
        { directory: "packages/session", reason: "マニフェストに説明が無い" },
        { directory: "packages/user", reason: "マニフェストが無いか読めない" },
      ],
    });
  });

  it("a repository that declares no workspace definition names nothing", ({
    collectionFromARepositoryWithoutADefinition,
  }) => {
    expect(collectionFromARepositoryWithoutADefinition).toStrictEqual({
      entries: [],
      incomplete: [],
    });
  });

  it("a definition that is not a mapping names nothing", ({
    collectionFromADefinitionThatIsNotAMapping,
  }) => {
    expect(collectionFromADefinitionThatIsNotAMapping).toStrictEqual({
      entries: [],
      incomplete: [],
    });
  });

  it("a definition that holds nothing at all names nothing", ({
    collectionFromADefinitionHoldingNothing,
  }) => {
    expect(collectionFromADefinitionHoldingNothing).toStrictEqual({ entries: [], incomplete: [] });
  });

  it("a definition whose field is not a list names nothing", ({
    collectionFromAFieldThatIsNotAList,
  }) => {
    expect(collectionFromAFieldThatIsNotAList).toStrictEqual({ entries: [], incomplete: [] });
  });

  it("a pattern that is not a word is left out of the list", ({
    collectionFromAListHoldingAPatternThatIsNotAWord,
  }) => {
    expect(collectionFromAListHoldingAPatternThatIsNotAWord).toStrictEqual({
      entries: [{ directory: "tools/build", description: "組み立て" }],
      incomplete: [],
    });
  });
});
