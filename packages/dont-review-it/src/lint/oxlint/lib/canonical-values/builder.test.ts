import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { isEqual } from "es-toolkit";
import { describe, expect, test } from "vite-plus/test";

import { analyzeCanonicalValuesRepository, loadCanonicalValuesCatalogSnapshot } from "./builder.ts";

const TAG = "@canonical-values";

const ORDER_STATUS_ARRAY = `/** ${TAG} order.status */\nexport const ORDER_STATUSES = ["draft", "published"] as const;\n`;

const ORDER_STATUS_DRAFT_ONLY = `/** ${TAG} order.status */\nexport const ORDER_STATUSES = ["draft"] as const;\n`;

const ORDER_STATUS_FINAL_ONLY = `/** ${TAG} order.status */\nexport const ORDER_STATUSES = ["final"] as const;\n`;

const ORDER_STATUS_AMBIENT = `/** ${TAG} order.status */\nexport declare const ORDER_STATUSES: readonly ["draft", "published"];\n`;

const STORY_STATUS_DRAFT_ONLY = `/** ${TAG} story.status */\nexport const STATUSES = ["draft"] as const;\n`;

const TEST_STATUS_TESTED_ONLY = `/** ${TAG} test.status */\nexport const TEST_STATUSES = ["tested"] as const;\n`;

const TYPE_TEST_STATUS_TYPED_ONLY = `/** ${TAG} type-test.status */\nexport const TYPE_TEST_STATUSES = ["typed"] as const;\n`;

const FIXTURE_STATUS_PUBLISHED_ONLY = `/** ${TAG} fixture.status */\nexport const STATUSES = ["published"] as const;\n`;

const ORDER_STATUS_DRAFT_UNDER_A = `/** ${TAG} order.status */\nexport const A = ["draft"] as const;\n`;

const ORDER_STATUS_PUBLISHED_UNDER_B = `/** ${TAG} order.status */\nexport const B = ["published"] as const;\n`;

const REEXPORTED_ORDER_STATUSES = 'export { ORDER_STATUSES } from "./order-status.ts";\n';

const ALIASED_ORDER_STATUSES =
  'export { ORDER_STATUSES as PUBLIC_STATUSES } from "./order-status.ts";\n';

const SHADOW_STATUSES = 'export const SHADOW_STATUSES = ["draft", "published"] as const;\n';

const GENERATED_ORDER_STATUSES = 'export const ORDER_STATUSES = ["shadow"] as const;\n';

const EXTERNAL_DRAFT = 'export const EXTERNAL = "draft";\n';

describe("analyzeCanonicalValuesRepository", () => {
  describe("a declaration two entries of the export map reach", () => {
    const it = test.extend("importRoutesOfADeclarationTwoExportsReach", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "packages", "vocabulary", "src"), { recursive: true });
      writeFileSync(
        join(root, "packages", "vocabulary", "package.json"),
        JSON.stringify({
          name: "@fixture/vocabulary",
          exports: {
            ".": "./src/index.ts",
            "./alias": "./src/alias.ts",
            "./shadow": "./src/shadow.ts",
          },
        }),
      );
      writeFileSync(
        join(root, "packages", "vocabulary", "src", "order-status.ts"),
        ORDER_STATUS_ARRAY,
      );
      writeFileSync(
        join(root, "packages", "vocabulary", "src", "index.ts"),
        REEXPORTED_ORDER_STATUSES,
      );
      writeFileSync(
        join(root, "packages", "vocabulary", "src", "alias.ts"),
        ALIASED_ORDER_STATUSES,
      );
      writeFileSync(join(root, "packages", "vocabulary", "src", "shadow.ts"), SHADOW_STATUSES);
      return analyzeCanonicalValuesRepository({ repositoryRoot: root }).catalog.entries.map(
        (catalogedConcept) => catalogedConcept.importRoutes,
      );
    });

    it("keep the exact symbol each one exports", ({
      importRoutesOfADeclarationTwoExportsReach,
    }) => {
      expect(importRoutesOfADeclarationTwoExportsReach).toStrictEqual([
        [
          {
            exportName: "ORDER_STATUSES",
            resolvedSourcePaths: ["packages/vocabulary/src/index.ts"],
            specifier: "@fixture/vocabulary",
          },
          {
            exportName: "PUBLIC_STATUSES",
            resolvedSourcePaths: ["packages/vocabulary/src/alias.ts"],
            specifier: "@fixture/vocabulary/alias",
          },
        ],
      ]);
    });
  });

  describe("a declaration no entry of the export map reaches", () => {
    const it = test
      .extend("importRoutesOfADeclarationNoExportReaches", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-"));
        onCleanup(() => {
          rmSync(root, { recursive: true, force: true });
        });
        mkdirSync(join(root, "packages", "vocabulary", "src"), { recursive: true });
        writeFileSync(
          join(root, "packages", "vocabulary", "package.json"),
          JSON.stringify({ name: "@fixture/vocabulary", exports: { ".": "./src/index.ts" } }),
        );
        writeFileSync(join(root, "packages", "vocabulary", "src", "index.ts"), SHADOW_STATUSES);
        writeFileSync(
          join(root, "packages", "vocabulary", "src", "order-status.ts"),
          ORDER_STATUS_ARRAY,
        );
        return analyzeCanonicalValuesRepository({ repositoryRoot: root }).catalog.entries.map(
          (catalogedConcept) => catalogedConcept.importRoutes,
        );
      })
      .extend("packageNamesOfADeclarationNoExportReaches", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-"));
        onCleanup(() => {
          rmSync(root, { recursive: true, force: true });
        });
        mkdirSync(join(root, "packages", "vocabulary", "src"), { recursive: true });
        writeFileSync(
          join(root, "packages", "vocabulary", "package.json"),
          JSON.stringify({ name: "@fixture/vocabulary", exports: { ".": "./src/index.ts" } }),
        );
        writeFileSync(join(root, "packages", "vocabulary", "src", "index.ts"), SHADOW_STATUSES);
        writeFileSync(
          join(root, "packages", "vocabulary", "src", "order-status.ts"),
          ORDER_STATUS_ARRAY,
        );
        return analyzeCanonicalValuesRepository({ repositoryRoot: root }).catalog.entries.map(
          (catalogedConcept) => catalogedConcept.packageName,
        );
      });

    it("is reached by no route at all", ({ importRoutesOfADeclarationNoExportReaches }) => {
      expect(importRoutesOfADeclarationNoExportReaches).toStrictEqual([[]]);
    });

    it("keeps the identity of the package that owns it", ({
      packageNamesOfADeclarationNoExportReaches,
    }) => {
      expect(packageNamesOfADeclarationNoExportReaches).toStrictEqual(["@fixture/vocabulary"]);
    });
  });

  describe("an export map that points at generated JavaScript", () => {
    const it = test.extend("importRoutesOfAJavaScriptExportTarget", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "packages", "vocabulary", "src"), { recursive: true });
      writeFileSync(
        join(root, "packages", "vocabulary", "package.json"),
        JSON.stringify({ name: "@fixture/vocabulary", exports: { ".": "./src/index.js" } }),
      );
      writeFileSync(
        join(root, "packages", "vocabulary", "src", "index.js"),
        GENERATED_ORDER_STATUSES,
      );
      writeFileSync(
        join(root, "packages", "vocabulary", "src", "index.ts"),
        REEXPORTED_ORDER_STATUSES,
      );
      writeFileSync(
        join(root, "packages", "vocabulary", "src", "order-status.ts"),
        ORDER_STATUS_ARRAY,
      );
      return analyzeCanonicalValuesRepository({ repositoryRoot: root }).catalog.entries.map(
        (catalogedConcept) => catalogedConcept.importRoutes,
      );
    });

    it("resolves to the TypeScript source behind it", ({
      importRoutesOfAJavaScriptExportTarget,
    }) => {
      expect(importRoutesOfAJavaScriptExportTarget).toStrictEqual([
        [
          {
            exportName: "ORDER_STATUSES",
            resolvedSourcePaths: ["packages/vocabulary/src/index.ts"],
            specifier: "@fixture/vocabulary",
          },
        ],
      ]);
    });
  });

  describe("a package manifest that is not json", () => {
    const it = test
      .extend("declarationPathsOfAManifestThatIsNotJson", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-"));
        onCleanup(() => {
          rmSync(root, { recursive: true, force: true });
        });
        mkdirSync(join(root, "packages", "vocabulary", "src"), { recursive: true });
        writeFileSync(join(root, "packages", "vocabulary", "package.json"), "{not json\n");
        writeFileSync(
          join(root, "packages", "vocabulary", "src", "order-status.ts"),
          ORDER_STATUS_ARRAY,
        );
        return analyzeCanonicalValuesRepository({ repositoryRoot: root }).catalog.entries.map(
          (catalogedConcept) => catalogedConcept.declarationPath,
        );
      })
      .extend("vocabularyProblemsOfAManifestThatIsNotJson", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-"));
        onCleanup(() => {
          rmSync(root, { recursive: true, force: true });
        });
        mkdirSync(join(root, "packages", "vocabulary", "src"), { recursive: true });
        writeFileSync(join(root, "packages", "vocabulary", "package.json"), "{not json\n");
        writeFileSync(
          join(root, "packages", "vocabulary", "src", "order-status.ts"),
          ORDER_STATUS_ARRAY,
        );
        return analyzeCanonicalValuesRepository({ repositoryRoot: root }).problems.filter(
          (reported) => reported.kind === "vocabulary-without-values",
        );
      });

    it("catalogs nothing behind the surface it could not read", ({
      declarationPathsOfAManifestThatIsNotJson,
    }) => {
      expect(declarationPathsOfAManifestThatIsNotJson).toStrictEqual([]);
    });

    it("reports the vocabulary it could not carry instead of crashing", ({
      vocabularyProblemsOfAManifestThatIsNotJson,
    }) => {
      expect(vocabularyProblemsOfAManifestThatIsNotJson).toStrictEqual([
        {
          kind: "vocabulary-without-values",
          filePath: "packages/vocabulary/src/order-status.ts",
          line: 1,
          conceptId: "order.status",
        },
      ]);
    });
  });

  describe("annotations written outside the sources the catalog owns", () => {
    const it = test
      .extend("declarationPathsOfOutOfScopeAnnotations", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-"));
        onCleanup(() => {
          rmSync(root, { recursive: true, force: true });
        });
        mkdirSync(join(root, "src"), { recursive: true });
        mkdirSync(join(root, "fixtures"), { recursive: true });
        writeFileSync(join(root, "src", "Owner.stories.fixture.ts"), STORY_STATUS_DRAFT_ONLY);
        writeFileSync(join(root, "src", "order.test.helper.ts"), TEST_STATUS_TESTED_ONLY);
        writeFileSync(join(root, "src", "order.test-d.ts"), TYPE_TEST_STATUS_TYPED_ONLY);
        writeFileSync(join(root, "fixtures", "order.ts"), FIXTURE_STATUS_PUBLISHED_ONLY);
        return analyzeCanonicalValuesRepository({ repositoryRoot: root }).catalog.entries.map(
          (catalogedConcept) => catalogedConcept.declarationPath,
        );
      })
      .extend("problemKindsAndPathsOfOutOfScopeAnnotations", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-"));
        onCleanup(() => {
          rmSync(root, { recursive: true, force: true });
        });
        mkdirSync(join(root, "src"), { recursive: true });
        mkdirSync(join(root, "fixtures"), { recursive: true });
        writeFileSync(join(root, "src", "Owner.stories.fixture.ts"), STORY_STATUS_DRAFT_ONLY);
        writeFileSync(join(root, "src", "order.test.helper.ts"), TEST_STATUS_TESTED_ONLY);
        writeFileSync(join(root, "src", "order.test-d.ts"), TYPE_TEST_STATUS_TYPED_ONLY);
        writeFileSync(join(root, "fixtures", "order.ts"), FIXTURE_STATUS_PUBLISHED_ONLY);
        return analyzeCanonicalValuesRepository({ repositoryRoot: root }).problems.map(
          (reported) => [reported.kind, reported.filePath],
        );
      });

    it("own no concept", ({ declarationPathsOfOutOfScopeAnnotations }) => {
      expect(declarationPathsOfOutOfScopeAnnotations).toStrictEqual([]);
    });

    it("are reported where they are written", ({ problemKindsAndPathsOfOutOfScopeAnnotations }) => {
      expect(problemKindsAndPathsOfOutOfScopeAnnotations).toStrictEqual([
        ["out-of-scope-declaration", "fixtures/order.ts"],
        ["out-of-scope-declaration", "src/Owner.stories.fixture.ts"],
        ["out-of-scope-declaration", "src/order.test-d.ts"],
        ["out-of-scope-declaration", "src/order.test.helper.ts"],
      ]);
    });
  });

  describe("an ambient declaration written in a source and in a declaration file", () => {
    const it = test
      .extend("declarationPathsOfAnAmbientDeclaration", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-"));
        onCleanup(() => {
          rmSync(root, { recursive: true, force: true });
        });
        mkdirSync(join(root, "src"), { recursive: true });
        writeFileSync(join(root, "src", "order-status.d.ts"), ORDER_STATUS_AMBIENT);
        writeFileSync(join(root, "src", "order-status.ts"), ORDER_STATUS_AMBIENT);
        return analyzeCanonicalValuesRepository({ repositoryRoot: root }).catalog.entries.map(
          (catalogedConcept) => catalogedConcept.declarationPath,
        );
      })
      .extend("problemKindsAndPathsOfAnAmbientDeclaration", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-"));
        onCleanup(() => {
          rmSync(root, { recursive: true, force: true });
        });
        mkdirSync(join(root, "src"), { recursive: true });
        writeFileSync(join(root, "src", "order-status.d.ts"), ORDER_STATUS_AMBIENT);
        writeFileSync(join(root, "src", "order-status.ts"), ORDER_STATUS_AMBIENT);
        return analyzeCanonicalValuesRepository({ repositoryRoot: root }).problems.map(
          (reported) => [reported.kind, reported.filePath],
        );
      });

    it("becomes no runtime owner", ({ declarationPathsOfAnAmbientDeclaration }) => {
      expect(declarationPathsOfAnAmbientDeclaration).toStrictEqual([]);
    });

    it("is reported in both files", ({ problemKindsAndPathsOfAnAmbientDeclaration }) => {
      expect(problemKindsAndPathsOfAnAmbientDeclaration).toStrictEqual([
        ["invalid-declaration", "src/order-status.d.ts"],
        ["invalid-declaration", "src/order-status.ts"],
      ]);
    });
  });

  describe("two declarations of one concept", () => {
    const it = test
      .extend("declarationPathsOfADuplicatedConcept", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-"));
        onCleanup(() => {
          rmSync(root, { recursive: true, force: true });
        });
        mkdirSync(join(root, "src"), { recursive: true });
        writeFileSync(join(root, "package.json"), JSON.stringify({ name: "@fixture/repository" }));
        writeFileSync(join(root, "src", "a.ts"), ORDER_STATUS_DRAFT_UNDER_A);
        writeFileSync(join(root, "src", "b.ts"), ORDER_STATUS_PUBLISHED_UNDER_B);
        return analyzeCanonicalValuesRepository({ repositoryRoot: root }).catalog.entries.map(
          (catalogedConcept) => catalogedConcept.declarationPath,
        );
      })
      .extend("packageNamesOfADuplicatedConcept", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-"));
        onCleanup(() => {
          rmSync(root, { recursive: true, force: true });
        });
        mkdirSync(join(root, "src"), { recursive: true });
        writeFileSync(join(root, "package.json"), JSON.stringify({ name: "@fixture/repository" }));
        writeFileSync(join(root, "src", "a.ts"), ORDER_STATUS_DRAFT_UNDER_A);
        writeFileSync(join(root, "src", "b.ts"), ORDER_STATUS_PUBLISHED_UNDER_B);
        return analyzeCanonicalValuesRepository({ repositoryRoot: root })
          .catalog.packageNames.values()
          .toArray();
      });

    it("are excluded from the catalog together", ({ declarationPathsOfADuplicatedConcept }) => {
      expect(declarationPathsOfADuplicatedConcept).toStrictEqual([]);
    });

    it("still leave the catalog naming the package that holds them", ({
      packageNamesOfADuplicatedConcept,
    }) => {
      expect(packageNamesOfADuplicatedConcept).toStrictEqual(["@fixture/repository"]);
    });
  });

  describe("a symbolic link that leaves the repository", () => {
    const it = test
      .extend("unsafeLinkProblemsOfALinkLeavingTheRepository", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-"));
        const externalRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
        onCleanup(() => {
          rmSync(root, { recursive: true, force: true });
          rmSync(externalRoot, { recursive: true, force: true });
        });
        mkdirSync(join(root, "src"), { recursive: true });
        writeFileSync(join(root, "src", "order-status.ts"), ORDER_STATUS_ARRAY);
        writeFileSync(join(externalRoot, "external.ts"), EXTERNAL_DRAFT);
        symlinkSync(join(externalRoot, "external.ts"), join(root, "src", "external.ts"));
        return analyzeCanonicalValuesRepository({ repositoryRoot: root }).problems.filter(
          (reported) => reported.kind === "unsafe-symbolic-link",
        );
      })
      .extend("declarationPathsOfALinkLeavingTheRepository", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-"));
        const externalRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
        onCleanup(() => {
          rmSync(root, { recursive: true, force: true });
          rmSync(externalRoot, { recursive: true, force: true });
        });
        mkdirSync(join(root, "src"), { recursive: true });
        writeFileSync(join(root, "src", "order-status.ts"), ORDER_STATUS_ARRAY);
        writeFileSync(join(externalRoot, "external.ts"), EXTERNAL_DRAFT);
        symlinkSync(join(externalRoot, "external.ts"), join(root, "src", "external.ts"));
        return analyzeCanonicalValuesRepository({ repositoryRoot: root }).catalog.entries.map(
          (catalogedConcept) => catalogedConcept.declarationPath,
        );
      });

    it("is reported where it is followed", ({ unsafeLinkProblemsOfALinkLeavingTheRepository }) => {
      expect(unsafeLinkProblemsOfALinkLeavingTheRepository).toStrictEqual([
        { kind: "unsafe-symbolic-link", filePath: "src/external.ts", line: 1 },
      ]);
    });

    it("prevents every entry the checkout would have carried", ({
      declarationPathsOfALinkLeavingTheRepository,
    }) => {
      expect(declarationPathsOfALinkLeavingTheRepository).toStrictEqual([]);
    });
  });
});

describe("loadCanonicalValuesCatalogSnapshot", () => {
  describe("a repository rewritten after its first snapshot", () => {
    const it = test
      .extend("theSnapshotReadAgainIsTheFirstSnapshot", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-"));
        onCleanup(() => {
          rmSync(root, { recursive: true, force: true });
        });
        mkdirSync(join(root, "src"), { recursive: true });
        writeFileSync(join(root, "src", "order-status.ts"), ORDER_STATUS_DRAFT_ONLY);
        const firstSnapshot = loadCanonicalValuesCatalogSnapshot({ repositoryRoot: root });
        writeFileSync(join(root, "src", "order-status.ts"), ORDER_STATUS_FINAL_ONLY);
        return loadCanonicalValuesCatalogSnapshot({ repositoryRoot: root }) === firstSnapshot;
      })
      .extend("canonicalValuesOfTheSnapshotReadAgain", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-"));
        onCleanup(() => {
          rmSync(root, { recursive: true, force: true });
        });
        mkdirSync(join(root, "src"), { recursive: true });
        writeFileSync(join(root, "src", "order-status.ts"), ORDER_STATUS_DRAFT_ONLY);
        loadCanonicalValuesCatalogSnapshot({ repositoryRoot: root });
        writeFileSync(join(root, "src", "order-status.ts"), ORDER_STATUS_FINAL_ONLY);
        return loadCanonicalValuesCatalogSnapshot({ repositoryRoot: root }).entries.map(
          (catalogedConcept) => catalogedConcept.values,
        );
      });

    it("hands back the object the first read handed back", ({
      theSnapshotReadAgainIsTheFirstSnapshot,
    }) => {
      expect(theSnapshotReadAgainIsTheFirstSnapshot).toBe(true);
    });

    it("carries what the repository said before it was rewritten", ({
      canonicalValuesOfTheSnapshotReadAgain,
    }) => {
      expect(canonicalValuesOfTheSnapshotReadAgain).toStrictEqual([["draft"]]);
    });
  });

  describe("a second lexical root for one repository", () => {
    const it = test
      .extend("theSnapshotOfASecondLexicalRootIsTheFirstSnapshot", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-"));
        const linkRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
        onCleanup(() => {
          rmSync(root, { recursive: true, force: true });
          rmSync(linkRoot, { recursive: true, force: true });
        });
        mkdirSync(join(root, "src"), { recursive: true });
        writeFileSync(join(root, "src", "order-status.ts"), ORDER_STATUS_DRAFT_ONLY);
        const firstSnapshot = loadCanonicalValuesCatalogSnapshot({ repositoryRoot: root });
        symlinkSync(root, join(linkRoot, "repository"), "dir");
        return (
          loadCanonicalValuesCatalogSnapshot({ repositoryRoot: join(linkRoot, "repository") }) ===
          firstSnapshot
        );
      })
      .extend("theSnapshotOfASecondLexicalRootCarriesTheEntriesOfTheFirst", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-"));
        const linkRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
        onCleanup(() => {
          rmSync(root, { recursive: true, force: true });
          rmSync(linkRoot, { recursive: true, force: true });
        });
        mkdirSync(join(root, "src"), { recursive: true });
        writeFileSync(join(root, "src", "order-status.ts"), ORDER_STATUS_DRAFT_ONLY);
        const firstEntries = loadCanonicalValuesCatalogSnapshot({
          repositoryRoot: root,
        }).entries;
        symlinkSync(root, join(linkRoot, "repository"), "dir");
        return isEqual(
          loadCanonicalValuesCatalogSnapshot({ repositoryRoot: join(linkRoot, "repository") })
            .entries,
          firstEntries,
        );
      });

    it("is a snapshot of its own", ({ theSnapshotOfASecondLexicalRootIsTheFirstSnapshot }) => {
      expect(theSnapshotOfASecondLexicalRootIsTheFirstSnapshot).toBe(false);
    });

    it("is read back from the cache the first root wrote", ({
      theSnapshotOfASecondLexicalRootCarriesTheEntriesOfTheFirst,
    }) => {
      expect(theSnapshotOfASecondLexicalRootCarriesTheEntriesOfTheFirst).toBe(true);
    });
  });

  describe("a repository root that is not on disk", () => {
    const it = test
      .extend("declarationPathsOfARepositoryRootThatIsNotOnDisk", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-"));
        onCleanup(() => {
          rmSync(root, { recursive: true, force: true });
        });
        return loadCanonicalValuesCatalogSnapshot({
          repositoryRoot: join(root, "missing"),
        }).entries.map((catalogedConcept) => catalogedConcept.declarationPath);
      })
      .extend("aRepositoryRootThatIsNotOnDiskExistsAfterTheRead", ({}, { onCleanup }) => {
        const root = mkdtempSync(join(tmpdir(), "canonical-values-"));
        onCleanup(() => {
          rmSync(root, { recursive: true, force: true });
        });
        loadCanonicalValuesCatalogSnapshot({ repositoryRoot: join(root, "missing") });
        return existsSync(join(root, "missing"));
      });

    it("yields an empty catalog", ({ declarationPathsOfARepositoryRootThatIsNotOnDisk }) => {
      expect(declarationPathsOfARepositoryRootThatIsNotOnDisk).toStrictEqual([]);
    });

    it("is left uncreated", ({ aRepositoryRootThatIsNotOnDiskExistsAfterTheRead }) => {
      expect(aRepositoryRootThatIsNotOnDiskExistsAfterTheRead).toBe(false);
    });
  });
});
