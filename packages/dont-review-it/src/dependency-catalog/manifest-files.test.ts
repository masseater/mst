import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, it, onTestFinished } from "vite-plus/test";

import { defaultDependencyCatalogChecksConfig } from "./config.ts";
import { readWorkspaceManifests } from "./manifest-files.ts";

const config = defaultDependencyCatalogChecksConfig;

const repositoryWith = (files: Readonly<Record<string, string>>): string => {
  const root = mkdtempSync(join(tmpdir(), "dont-review-it-manifests-"));
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

describe("readWorkspaceManifests", () => {
  it("reads the root manifest and every manifest a star pattern reaches", () => {
    const repositoryRoot = repositoryWith({
      "package.json": `{"name": "root"}`,
      "packages/left/package.json": `{"name": "left"}`,
      "packages/right/package.json": `{"name": "right"}`,
    });

    const manifests = readWorkspaceManifests({
      repositoryRoot,
      packagePatterns: ["packages/*"],
      config,
    });

    expect(manifests.map((workspaceManifest) => workspaceManifest.relativePath)).toStrictEqual([
      "package.json",
      "packages/left/package.json",
      "packages/right/package.json",
    ]);
  });

  it("reads a pattern without a star as a directory name", () => {
    const repositoryRoot = repositoryWith({
      "package.json": `{"name": "root"}`,
      "docs/package.json": `{"name": "docs"}`,
    });

    const manifests = readWorkspaceManifests({
      repositoryRoot,
      packagePatterns: ["docs"],
      config,
    });

    expect(manifests.map((workspaceManifest) => workspaceManifest.relativePath)).toStrictEqual([
      "package.json",
      "docs/package.json",
    ]);
  });

  it("skips a negated pattern instead of guessing what it removes", () => {
    const repositoryRoot = repositoryWith({
      "package.json": `{"name": "root"}`,
      "packages/left/package.json": `{"name": "left"}`,
    });

    const manifests = readWorkspaceManifests({
      repositoryRoot,
      packagePatterns: ["!packages/left"],
      config,
    });

    expect(manifests.map((workspaceManifest) => workspaceManifest.relativePath)).toStrictEqual([
      "package.json",
    ]);
  });

  it("reads a star pattern whose parent directory is missing as no manifests", () => {
    const repositoryRoot = repositoryWith({ "package.json": `{"name": "root"}` });

    const manifests = readWorkspaceManifests({
      repositoryRoot,
      packagePatterns: ["packages/*"],
      config,
    });

    expect(manifests.map((workspaceManifest) => workspaceManifest.relativePath)).toStrictEqual([
      "package.json",
    ]);
  });

  it("leaves the files sitting between the package directories alone", () => {
    const repositoryRoot = repositoryWith({
      "package.json": `{"name": "root"}`,
      "packages/README.md": "packages",
      "packages/left/package.json": `{"name": "left"}`,
    });

    const manifests = readWorkspaceManifests({
      repositoryRoot,
      packagePatterns: ["packages/*"],
      config,
    });

    expect(manifests.map((workspaceManifest) => workspaceManifest.relativePath)).toStrictEqual([
      "package.json",
      "packages/left/package.json",
    ]);
  });

  it("counts the root manifest once when a pattern names the root itself", () => {
    const repositoryRoot = repositoryWith({
      "package.json": `{"name": "root"}`,
      "packages/left/package.json": `{"name": "left"}`,
    });

    const manifests = readWorkspaceManifests({
      repositoryRoot,
      packagePatterns: [".", "packages/*"],
      config,
    });

    expect(manifests.map((workspaceManifest) => workspaceManifest.relativePath)).toStrictEqual([
      "package.json",
      "packages/left/package.json",
    ]);
  });

  it("skips a package directory that carries no manifest", () => {
    const repositoryRoot = repositoryWith({
      "packages/empty/.gitkeep": "",
      "packages/left/package.json": `{"name": "left"}`,
    });

    const manifests = readWorkspaceManifests({
      repositoryRoot,
      packagePatterns: ["packages/*"],
      config,
    });

    expect(manifests.map((workspaceManifest) => workspaceManifest.relativePath)).toStrictEqual([
      "packages/left/package.json",
    ]);
  });
});
