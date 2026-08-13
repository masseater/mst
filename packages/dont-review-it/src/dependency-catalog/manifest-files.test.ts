import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { defaultDependencyCatalogChecksConfig } from "./config.ts";
import { readWorkspaceManifests } from "./manifest-files.ts";

describe("readWorkspaceManifests", () => {
  describe("a star pattern over a directory that holds two packages", () => {
    const it = test.extend("manifestsOfTheRootAndBothPackages", () => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "dont-review-it-manifest-files-"));
      writeFileSync(join(repositoryRoot, "package.json"), `{"name": "root"}`, "utf8");
      mkdirSync(join(repositoryRoot, "packages", "left"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "packages", "left", "package.json"),
        `{"name": "left"}`,
        "utf8",
      );
      mkdirSync(join(repositoryRoot, "packages", "right"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "packages", "right", "package.json"),
        `{"name": "right"}`,
        "utf8",
      );
      return readWorkspaceManifests({
        repositoryRoot,
        packagePatterns: ["packages/*"],
        config: defaultDependencyCatalogChecksConfig,
      });
    });

    it("reads the root manifest and every manifest the pattern reaches", ({
      manifestsOfTheRootAndBothPackages,
    }) => {
      expect(manifestsOfTheRootAndBothPackages).toStrictEqual([
        { relativePath: "package.json", manifest: { name: "root" } },
        { relativePath: "packages/left/package.json", manifest: { name: "left" } },
        { relativePath: "packages/right/package.json", manifest: { name: "right" } },
      ]);
    });
  });

  describe("a pattern that carries no star", () => {
    const it = test.extend("manifestsOfTheRootAndTheNamedDirectory", () => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "dont-review-it-manifest-files-"));
      writeFileSync(join(repositoryRoot, "package.json"), `{"name": "root"}`, "utf8");
      mkdirSync(join(repositoryRoot, "docs"), { recursive: true });
      writeFileSync(join(repositoryRoot, "docs", "package.json"), `{"name": "docs"}`, "utf8");
      return readWorkspaceManifests({
        repositoryRoot,
        packagePatterns: ["docs"],
        config: defaultDependencyCatalogChecksConfig,
      });
    });

    it("reads it as a directory name", ({ manifestsOfTheRootAndTheNamedDirectory }) => {
      expect(manifestsOfTheRootAndTheNamedDirectory).toStrictEqual([
        { relativePath: "package.json", manifest: { name: "root" } },
        { relativePath: "docs/package.json", manifest: { name: "docs" } },
      ]);
    });
  });

  describe("a negated pattern", () => {
    const it = test.extend("manifestsLeftBesideTheNegatedPackage", () => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "dont-review-it-manifest-files-"));
      writeFileSync(join(repositoryRoot, "package.json"), `{"name": "root"}`, "utf8");
      mkdirSync(join(repositoryRoot, "packages", "left"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "packages", "left", "package.json"),
        `{"name": "left"}`,
        "utf8",
      );
      return readWorkspaceManifests({
        repositoryRoot,
        packagePatterns: ["!packages/left"],
        config: defaultDependencyCatalogChecksConfig,
      });
    });

    it("skips it instead of guessing what it removes", ({
      manifestsLeftBesideTheNegatedPackage,
    }) => {
      expect(manifestsLeftBesideTheNegatedPackage).toStrictEqual([
        { relativePath: "package.json", manifest: { name: "root" } },
      ]);
    });
  });

  describe("a star pattern whose parent directory is missing", () => {
    const it = test.extend("manifestsOfARepositoryWithoutThatParentDirectory", () => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "dont-review-it-manifest-files-"));
      writeFileSync(join(repositoryRoot, "package.json"), `{"name": "root"}`, "utf8");
      return readWorkspaceManifests({
        repositoryRoot,
        packagePatterns: ["packages/*"],
        config: defaultDependencyCatalogChecksConfig,
      });
    });

    it("reads no manifest beyond the root", ({
      manifestsOfARepositoryWithoutThatParentDirectory,
    }) => {
      expect(manifestsOfARepositoryWithoutThatParentDirectory).toStrictEqual([
        { relativePath: "package.json", manifest: { name: "root" } },
      ]);
    });
  });

  describe("a file sitting between the package directories", () => {
    const it = test.extend("manifestsBesideThatFile", () => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "dont-review-it-manifest-files-"));
      writeFileSync(join(repositoryRoot, "package.json"), `{"name": "root"}`, "utf8");
      mkdirSync(join(repositoryRoot, "packages", "left"), { recursive: true });
      writeFileSync(join(repositoryRoot, "packages", "README.md"), "packages", "utf8");
      writeFileSync(
        join(repositoryRoot, "packages", "left", "package.json"),
        `{"name": "left"}`,
        "utf8",
      );
      return readWorkspaceManifests({
        repositoryRoot,
        packagePatterns: ["packages/*"],
        config: defaultDependencyCatalogChecksConfig,
      });
    });

    it("leaves it alone", ({ manifestsBesideThatFile }) => {
      expect(manifestsBesideThatFile).toStrictEqual([
        { relativePath: "package.json", manifest: { name: "root" } },
        { relativePath: "packages/left/package.json", manifest: { name: "left" } },
      ]);
    });
  });

  describe("a pattern that names the repository root itself", () => {
    const it = test.extend("manifestsOfTheRootNamedTwice", () => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "dont-review-it-manifest-files-"));
      writeFileSync(join(repositoryRoot, "package.json"), `{"name": "root"}`, "utf8");
      mkdirSync(join(repositoryRoot, "packages", "left"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "packages", "left", "package.json"),
        `{"name": "left"}`,
        "utf8",
      );
      return readWorkspaceManifests({
        repositoryRoot,
        packagePatterns: [".", "packages/*"],
        config: defaultDependencyCatalogChecksConfig,
      });
    });

    it("counts the root manifest once", ({ manifestsOfTheRootNamedTwice }) => {
      expect(manifestsOfTheRootNamedTwice).toStrictEqual([
        { relativePath: "package.json", manifest: { name: "root" } },
        { relativePath: "packages/left/package.json", manifest: { name: "left" } },
      ]);
    });
  });

  describe("a package directory that carries no manifest", () => {
    const it = test.extend("manifestsBesideTheDirectoryWithoutAManifest", () => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "dont-review-it-manifest-files-"));
      mkdirSync(join(repositoryRoot, "packages", "empty"), { recursive: true });
      writeFileSync(join(repositoryRoot, "packages", "empty", ".gitkeep"), "", "utf8");
      mkdirSync(join(repositoryRoot, "packages", "left"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "packages", "left", "package.json"),
        `{"name": "left"}`,
        "utf8",
      );
      return readWorkspaceManifests({
        repositoryRoot,
        packagePatterns: ["packages/*"],
        config: defaultDependencyCatalogChecksConfig,
      });
    });

    it("skips it", ({ manifestsBesideTheDirectoryWithoutAManifest }) => {
      expect(manifestsBesideTheDirectoryWithoutAManifest).toStrictEqual([
        { relativePath: "packages/left/package.json", manifest: { name: "left" } },
      ]);
    });
  });
});
