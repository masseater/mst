import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { defaultDependencyCatalogChecksConfig } from "./config.ts";
import { runDependencyCatalogChecks } from "./run-dependency-catalog-checks.ts";

describe("runDependencyCatalogChecks", () => {
  describe("a repository where no workspace definition marks pnpm usage", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "dont-review-it-catalog-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      writeFileSync(
        join(repositoryRoot, "package.json"),
        `{"dependencies": {"react": "^19.0.0"}}`,
        "utf8",
      );
      return runDependencyCatalogChecks({
        repositoryRoot,
        config: defaultDependencyCatalogChecksConfig,
      });
    });

    it("stays silent and says the definition is missing", ({ report }) => {
      expect(report).toStrictEqual({
        problems: [],
        definitionUnreadable: false,
        definitionMissing: true,
        scanned: 0,
      });
    });
  });

  describe("a workspace definition that does not parse", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "dont-review-it-catalog-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      writeFileSync(join(repositoryRoot, "pnpm-workspace.yaml"), "packages: [\n", "utf8");
      return runDependencyCatalogChecks({
        repositoryRoot,
        config: defaultDependencyCatalogChecksConfig,
      });
    });

    it("is the one problem, reported against the definition itself", ({ report }) => {
      expect(report).toStrictEqual({
        problems: [
          {
            file: "pnpm-workspace.yaml",
            line: null,
            message:
              "A workspace definition that does not parse must not stay in the repository, because every dependency check reads it as an empty file and reports nothing. Fix the YAML here so the definition can be read.",
          },
        ],
        definitionUnreadable: true,
        definitionMissing: false,
        scanned: 0,
      });
    });
  });

  describe("a catalog entry that only one manifest uses", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "dont-review-it-catalog-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      writeFileSync(
        join(repositoryRoot, "pnpm-workspace.yaml"),
        "packages:\n  - packages/*\ncatalog:\n  react: ^19.0.0\n",
        "utf8",
      );
      writeFileSync(join(repositoryRoot, "package.json"), `{"name": "root"}`, "utf8");
      mkdirSync(join(repositoryRoot, "packages", "web"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "packages", "web", "package.json"),
        `{"dependencies": {"react": "catalog:"}}`,
        "utf8",
      );
      return runDependencyCatalogChecks({
        repositoryRoot,
        config: defaultDependencyCatalogChecksConfig,
      });
    });

    it("is reported with the manifest that is its only user named", ({ report }) => {
      expect(report).toStrictEqual({
        problems: [
          {
            file: "pnpm-workspace.yaml",
            line: null,
            message:
              "The default catalog must not hold react while packages/web/package.json is the only manifest that uses it, because a catalog entry exists to share one version between manifests. Write ^19.0.0 into that manifest and delete the entry.",
          },
        ],
        definitionUnreadable: false,
        definitionMissing: false,
        scanned: 2,
      });
    });
  });

  describe("a catalog entry that a workspace override references", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "dont-review-it-catalog-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      writeFileSync(
        join(repositoryRoot, "pnpm-workspace.yaml"),
        `packages:\n  - packages/*\ncatalog:\n  vite: ^6.0.0\noverrides:\n  vite: "catalog:"\n`,
        "utf8",
      );
      mkdirSync(join(repositoryRoot, "packages", "web"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "packages", "web", "package.json"),
        `{"dependencies": {"vite": "catalog:"}}`,
        "utf8",
      );
      return runDependencyCatalogChecks({
        repositoryRoot,
        config: defaultDependencyCatalogChecksConfig,
      });
    });

    it("stays quiet even though a single manifest uses it", ({ report }) => {
      expect(report).toStrictEqual({
        problems: [],
        definitionUnreadable: false,
        definitionMissing: false,
        scanned: 1,
      });
    });
  });

  describe("a catalog entry that a root manifest override references", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "dont-review-it-catalog-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      writeFileSync(
        join(repositoryRoot, "pnpm-workspace.yaml"),
        "packages:\n  - packages/*\ncatalog:\n  vite: ^6.0.0\n",
        "utf8",
      );
      writeFileSync(
        join(repositoryRoot, "package.json"),
        `{"pnpm": {"overrides": {"vite": "catalog:"}}}`,
        "utf8",
      );
      mkdirSync(join(repositoryRoot, "packages", "web"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "packages", "web", "package.json"),
        `{"dependencies": {"vite": "catalog:"}}`,
        "utf8",
      );
      return runDependencyCatalogChecks({
        repositoryRoot,
        config: defaultDependencyCatalogChecksConfig,
      });
    });

    it("stays quiet even though a single manifest uses it", ({ report }) => {
      expect(report).toStrictEqual({
        problems: [],
        definitionUnreadable: false,
        definitionMissing: false,
        scanned: 2,
      });
    });
  });

  describe("a catalog entry whose only user pins the version directly", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "dont-review-it-catalog-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      writeFileSync(
        join(repositoryRoot, "pnpm-workspace.yaml"),
        "packages:\n  - packages/*\ncatalog:\n  react: ^19.0.0\n",
        "utf8",
      );
      mkdirSync(join(repositoryRoot, "packages", "web"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "packages", "web", "package.json"),
        `{"dependencies": {"react": "^19.0.0"}}`,
        "utf8",
      );
      return runDependencyCatalogChecks({
        repositoryRoot,
        config: defaultDependencyCatalogChecksConfig,
      });
    });

    it("tells that manifest to inline the entry rather than to reference it", ({ report }) => {
      expect(report).toStrictEqual({
        problems: [
          {
            file: "pnpm-workspace.yaml",
            line: null,
            message:
              "The default catalog must not hold react while packages/web/package.json is the only manifest that uses it, because a catalog entry exists to share one version between manifests. Write ^19.0.0 into that manifest and delete the entry.",
          },
        ],
        definitionUnreadable: false,
        definitionMissing: false,
        scanned: 1,
      });
    });
  });

  describe("a catalog reference beside a direct pin of a different version", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "dont-review-it-catalog-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      writeFileSync(
        join(repositoryRoot, "pnpm-workspace.yaml"),
        "packages:\n  - packages/*\ncatalog:\n  react: ^19.0.0\n",
        "utf8",
      );
      mkdirSync(join(repositoryRoot, "packages", "web"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "packages", "web", "package.json"),
        `{"dependencies": {"react": "catalog:"}}`,
        "utf8",
      );
      mkdirSync(join(repositoryRoot, "packages", "legacy"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "packages", "legacy", "package.json"),
        `{"dependencies": {"react": "^18.0.0"}}`,
        "utf8",
      );
      return runDependencyCatalogChecks({
        repositoryRoot,
        config: defaultDependencyCatalogChecksConfig,
      });
    });

    it("reports the disagreement instead of treating the catalog entry as single-use", ({
      report,
    }) => {
      expect(report).toStrictEqual({
        problems: [
          {
            file: "packages/legacy/package.json",
            line: null,
            message:
              "react is pinned to ^18.0.0 here while the catalog pins ^19.0.0. Choose the intended version, keep it in one catalog entry, and replace this manifest's specifier with a reference to that entry.",
          },
        ],
        definitionUnreadable: false,
        definitionMissing: false,
        scanned: 2,
      });
    });
  });

  describe("a catalog entry beside one direct user of a different version", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "dont-review-it-catalog-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      writeFileSync(
        join(repositoryRoot, "pnpm-workspace.yaml"),
        "packages:\n  - packages/*\ncatalog:\n  react: ^19.0.0\n",
        "utf8",
      );
      mkdirSync(join(repositoryRoot, "packages", "legacy"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "packages", "legacy", "package.json"),
        `{"dependencies": {"react": "^18.0.0"}}`,
        "utf8",
      );
      return runDependencyCatalogChecks({
        repositoryRoot,
        config: defaultDependencyCatalogChecksConfig,
      });
    });

    it("still reports the disagreement before suggesting removal of the catalog entry", ({
      report,
    }) => {
      expect(report).toStrictEqual({
        problems: [
          {
            file: "packages/legacy/package.json",
            line: null,
            message:
              "react is pinned to ^18.0.0 here while the catalog pins ^19.0.0. Choose the intended version, keep it in one catalog entry, and replace this manifest's specifier with a reference to that entry.",
          },
        ],
        definitionUnreadable: false,
        definitionMissing: false,
        scanned: 1,
      });
    });
  });

  describe("a single-use named entry beside a shared default entry", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "dont-review-it-catalog-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      writeFileSync(
        join(repositoryRoot, "pnpm-workspace.yaml"),
        "packages:\n  - packages/*\ncatalog:\n  react: ^19.0.0\ncatalogs:\n  legacy:\n    react: ^18.0.0\n",
        "utf8",
      );
      mkdirSync(join(repositoryRoot, "packages", "web"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "packages", "web", "package.json"),
        `{"dependencies": {"react": "catalog:"}}`,
        "utf8",
      );
      mkdirSync(join(repositoryRoot, "packages", "site"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "packages", "site", "package.json"),
        `{"dependencies": {"react": "catalog:"}}`,
        "utf8",
      );
      mkdirSync(join(repositoryRoot, "packages", "legacy"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "packages", "legacy", "package.json"),
        `{"dependencies": {"react": "^18.0.0"}}`,
        "utf8",
      );
      return runDependencyCatalogChecks({
        repositoryRoot,
        config: defaultDependencyCatalogChecksConfig,
      });
    });

    it("reports removal of that named entry without also reporting a version disagreement", ({
      report,
    }) => {
      expect(report).toStrictEqual({
        problems: [
          {
            file: "pnpm-workspace.yaml",
            line: null,
            message:
              'The named "legacy" catalog must not hold react while packages/legacy/package.json is the only manifest that uses it, because a catalog entry exists to share one version between manifests. Write ^18.0.0 into that manifest and delete the entry.',
          },
        ],
        definitionUnreadable: false,
        definitionMissing: false,
        scanned: 3,
      });
    });
  });

  describe("a single-use named entry with the same version as a shared default entry", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "dont-review-it-catalog-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      writeFileSync(
        join(repositoryRoot, "pnpm-workspace.yaml"),
        "packages:\n  - packages/*\ncatalog:\n  react: ^19.0.0\ncatalogs:\n  legacy:\n    react: ^19.0.0\n",
        "utf8",
      );
      mkdirSync(join(repositoryRoot, "packages", "web"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "packages", "web", "package.json"),
        `{"dependencies": {"react": "catalog:"}}`,
        "utf8",
      );
      mkdirSync(join(repositoryRoot, "packages", "site"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "packages", "site", "package.json"),
        `{"dependencies": {"react": "catalog:"}}`,
        "utf8",
      );
      mkdirSync(join(repositoryRoot, "packages", "legacy"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "packages", "legacy", "package.json"),
        `{"dependencies": {"react": "^19.0.0"}}`,
        "utf8",
      );
      return runDependencyCatalogChecks({
        repositoryRoot,
        config: defaultDependencyCatalogChecksConfig,
      });
    });

    it("reports only removal of the named entry in the first run", ({ report }) => {
      expect(report).toStrictEqual({
        problems: [
          {
            file: "pnpm-workspace.yaml",
            line: null,
            message:
              'The named "legacy" catalog must not hold react while packages/legacy/package.json is the only manifest that uses it, because a catalog entry exists to share one version between manifests. Write ^19.0.0 into that manifest and delete the entry.',
          },
        ],
        definitionUnreadable: false,
        definitionMissing: false,
        scanned: 3,
      });
    });
  });

  describe("the direct pin after its single-use named entry is removed", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "dont-review-it-catalog-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      writeFileSync(
        join(repositoryRoot, "pnpm-workspace.yaml"),
        "packages:\n  - packages/*\ncatalog:\n  react: ^19.0.0\n",
        "utf8",
      );
      mkdirSync(join(repositoryRoot, "packages", "web"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "packages", "web", "package.json"),
        `{"dependencies": {"react": "catalog:"}}`,
        "utf8",
      );
      mkdirSync(join(repositoryRoot, "packages", "site"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "packages", "site", "package.json"),
        `{"dependencies": {"react": "catalog:"}}`,
        "utf8",
      );
      mkdirSync(join(repositoryRoot, "packages", "legacy"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "packages", "legacy", "package.json"),
        `{"dependencies": {"react": "^19.0.0"}}`,
        "utf8",
      );
      return runDependencyCatalogChecks({
        repositoryRoot,
        config: defaultDependencyCatalogChecksConfig,
      });
    });

    it("reports use of the retained default entry in the next run", ({ report }) => {
      expect(report).toStrictEqual({
        problems: [
          {
            file: "packages/legacy/package.json",
            line: null,
            message:
              "react must not carry ^19.0.0 directly while the catalog already pins that version. Replace the specifier with catalog: so one declaration keeps the version.",
          },
        ],
        definitionUnreadable: false,
        definitionMissing: false,
        scanned: 3,
      });
    });
  });

  describe("a second manifest that pins the version the catalog already holds", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "dont-review-it-catalog-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      writeFileSync(
        join(repositoryRoot, "pnpm-workspace.yaml"),
        "packages:\n  - packages/*\ncatalog:\n  react: ^19.0.0\n",
        "utf8",
      );
      mkdirSync(join(repositoryRoot, "packages", "web"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "packages", "web", "package.json"),
        `{"dependencies": {"react": "catalog:"}}`,
        "utf8",
      );
      mkdirSync(join(repositoryRoot, "packages", "site"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "packages", "site", "package.json"),
        `{"dependencies": {"react": "^19.0.0"}}`,
        "utf8",
      );
      return runDependencyCatalogChecks({
        repositoryRoot,
        config: defaultDependencyCatalogChecksConfig,
      });
    });

    it("is told to reference the catalog instead", ({ report }) => {
      expect(report).toStrictEqual({
        problems: [
          {
            file: "packages/site/package.json",
            line: null,
            message:
              "react must not carry ^19.0.0 directly while the catalog already pins that version. Replace the specifier with catalog: so one declaration keeps the version.",
          },
        ],
        definitionUnreadable: false,
        definitionMissing: false,
        scanned: 2,
      });
    });
  });

  describe("a version that two manifests pin outside the catalog", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "dont-review-it-catalog-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      writeFileSync(
        join(repositoryRoot, "pnpm-workspace.yaml"),
        "packages:\n  - packages/*\n",
        "utf8",
      );
      mkdirSync(join(repositoryRoot, "packages", "web"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "packages", "web", "package.json"),
        `{"devDependencies": {"typescript": "^5.0.0"}}`,
        "utf8",
      );
      mkdirSync(join(repositoryRoot, "packages", "site"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "packages", "site", "package.json"),
        `{"devDependencies": {"typescript": "^5.0.0"}}`,
        "utf8",
      );
      return runDependencyCatalogChecks({
        repositoryRoot,
        config: defaultDependencyCatalogChecksConfig,
      });
    });

    it("is asked to move into the catalog", ({ report }) => {
      expect(report).toStrictEqual({
        problems: [
          {
            file: "pnpm-workspace.yaml",
            line: null,
            message:
              "typescript must not be pinned to ^5.0.0 separately by packages/site/package.json and packages/web/package.json, because pins that repeat drift apart silently. Add typescript to the catalog and reference it with catalog: from each manifest.",
          },
        ],
        definitionUnreadable: false,
        definitionMissing: false,
        scanned: 2,
      });
    });
  });

  describe("two manifests whose pinned versions disagree", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "dont-review-it-catalog-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      writeFileSync(
        join(repositoryRoot, "pnpm-workspace.yaml"),
        "packages:\n  - packages/*\n",
        "utf8",
      );
      mkdirSync(join(repositoryRoot, "packages", "web"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "packages", "web", "package.json"),
        `{"devDependencies": {"typescript": "^5.0.0"}}`,
        "utf8",
      );
      mkdirSync(join(repositoryRoot, "packages", "site"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "packages", "site", "package.json"),
        `{"devDependencies": {"typescript": "^5.5.0"}}`,
        "utf8",
      );
      return runDependencyCatalogChecks({
        repositoryRoot,
        config: defaultDependencyCatalogChecksConfig,
      });
    });

    it("are reported as a problem without choosing a version", ({ report }) => {
      expect(report).toStrictEqual({
        problems: [
          {
            file: "pnpm-workspace.yaml",
            line: null,
            message:
              "typescript is pinned to different specifiers: packages/site/package.json pins ^5.5.0, packages/web/package.json pins ^5.0.0. Choose the intended version, add it to the catalog, and reference it with catalog: from every listed manifest.",
          },
        ],
        definitionUnreadable: false,
        definitionMissing: false,
        scanned: 2,
      });
    });
  });

  describe("findings that several checks raised at once", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "dont-review-it-catalog-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      writeFileSync(
        join(repositoryRoot, "pnpm-workspace.yaml"),
        "packages:\n  - packages/*\ncatalog:\n  react: ^19.0.0\n  zod: ^4.0.0\n  axios: ^1.0.0\n",
        "utf8",
      );
      mkdirSync(join(repositoryRoot, "packages", "web"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "packages", "web", "package.json"),
        `{"dependencies": {"react": "catalog:", "zod": "catalog:", "axios": "catalog:"}}`,
        "utf8",
      );
      mkdirSync(join(repositoryRoot, "packages", "site"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "packages", "site", "package.json"),
        `{"dependencies": {"react": "^19.0.0"}}`,
        "utf8",
      );
      return runDependencyCatalogChecks({
        repositoryRoot,
        config: defaultDependencyCatalogChecksConfig,
      });
    });

    it("are ordered by file and then by message", ({ report }) => {
      expect(report).toStrictEqual({
        problems: [
          {
            file: "packages/site/package.json",
            line: null,
            message:
              "react must not carry ^19.0.0 directly while the catalog already pins that version. Replace the specifier with catalog: so one declaration keeps the version.",
          },
          {
            file: "pnpm-workspace.yaml",
            line: null,
            message:
              "The default catalog must not hold axios while packages/web/package.json is the only manifest that uses it, because a catalog entry exists to share one version between manifests. Write ^1.0.0 into that manifest and delete the entry.",
          },
          {
            file: "pnpm-workspace.yaml",
            line: null,
            message:
              "The default catalog must not hold zod while packages/web/package.json is the only manifest that uses it, because a catalog entry exists to share one version between manifests. Write ^4.0.0 into that manifest and delete the entry.",
          },
        ],
        definitionUnreadable: false,
        definitionMissing: false,
        scanned: 2,
      });
    });
  });
});
