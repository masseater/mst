import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { gitOutput } from "../git-output.ts";
import { listRepositoryFiles, nearestPackageDirectory } from "./source-files.ts";

const UNREACHABLE_TARGET_ROOT = join(tmpdir(), "source-files-unreachable-target");

const DIRECTORY_TARGET_ROOT = join(tmpdir(), "source-files-directory-target");

const OWN_MANIFEST_ROOT = join(tmpdir(), "source-files-own-manifest");

const MANIFEST_ABOVE_ROOT = join(tmpdir(), "source-files-manifest-above");

const RIVAL_MANIFESTS_ROOT = join(tmpdir(), "source-files-rival-manifests");

const ROOT_ONLY_MANIFEST_ROOT = join(tmpdir(), "source-files-root-only-manifest");

const NO_MANIFEST_ROOT = join(tmpdir(), "source-files-no-manifest");

const MIXED_ASSET_SCRIPTS_ROOT = join(tmpdir(), "source-files-mixed-assets-scripts");

const MIXED_ASSET_STYLES_ROOT = join(tmpdir(), "source-files-mixed-assets-styles");

const MIXED_ASSET_MARKUP_ROOT = join(tmpdir(), "source-files-mixed-assets-markup");

const MIXED_ASSET_MANIFESTS_ROOT = join(tmpdir(), "source-files-mixed-assets-manifests");

describe("listRepositoryFiles", () => {
  describe("an entry the directory lists but the file system cannot reach", () => {
    const it = test.extend("commentSourcePathsBesideALinkToNothing", ({}, { onCleanup }) => {
      rmSync(UNREACHABLE_TARGET_ROOT, { recursive: true, force: true });
      mkdirSync(join(UNREACHABLE_TARGET_ROOT, "src"), { recursive: true });
      onCleanup(() => {
        rmSync(UNREACHABLE_TARGET_ROOT, { recursive: true, force: true });
      });
      writeFileSync(
        join(UNREACHABLE_TARGET_ROOT, "src", "present.ts"),
        "export const total = 1;\n",
      );
      symlinkSync(
        join(UNREACHABLE_TARGET_ROOT, "src", "removed.ts"),
        join(UNREACHABLE_TARGET_ROOT, "src", "gone.ts"),
      );
      return listRepositoryFiles(UNREACHABLE_TARGET_ROOT).commentSources.map(
        (file) => file.relativePath,
      );
    });

    it("is left out", ({ commentSourcePathsBesideALinkToNothing }) => {
      expect(commentSourcePathsBesideALinkToNothing).toStrictEqual(["src/present.ts"]);
    });
  });

  describe("an entry that resolves to a directory", () => {
    const it = test.extend("commentSourcePathsBesideALinkToADirectory", ({}, { onCleanup }) => {
      rmSync(DIRECTORY_TARGET_ROOT, { recursive: true, force: true });
      mkdirSync(join(DIRECTORY_TARGET_ROOT, "src", "nested"), { recursive: true });
      onCleanup(() => {
        rmSync(DIRECTORY_TARGET_ROOT, { recursive: true, force: true });
      });
      writeFileSync(join(DIRECTORY_TARGET_ROOT, "src", "present.ts"), "export const total = 1;\n");
      symlinkSync(
        join(DIRECTORY_TARGET_ROOT, "src", "nested"),
        join(DIRECTORY_TARGET_ROOT, "src", "linked.ts"),
      );
      return listRepositoryFiles(DIRECTORY_TARGET_ROOT).commentSources.map(
        (file) => file.relativePath,
      );
    });

    it("is left out of the listing", ({ commentSourcePathsBesideALinkToADirectory }) => {
      expect(commentSourcePathsBesideALinkToADirectory).toStrictEqual(["src/present.ts"]);
    });
  });

  describe("a script standing beside a style sheet and a markup file", () => {
    const it = test.extend("commentSourcePathsBesideAssets", ({}, { onCleanup }) => {
      rmSync(MIXED_ASSET_SCRIPTS_ROOT, { recursive: true, force: true });
      mkdirSync(join(MIXED_ASSET_SCRIPTS_ROOT, "src"), { recursive: true });
      onCleanup(() => {
        rmSync(MIXED_ASSET_SCRIPTS_ROOT, { recursive: true, force: true });
      });
      writeFileSync(join(MIXED_ASSET_SCRIPTS_ROOT, "package.json"), "{}");
      writeFileSync(join(MIXED_ASSET_SCRIPTS_ROOT, "src", "order.ts"), "export const total = 1;\n");
      writeFileSync(
        join(MIXED_ASSET_SCRIPTS_ROOT, "src", "order.css"),
        ".total {\n  color: red;\n}\n",
      );
      writeFileSync(join(MIXED_ASSET_SCRIPTS_ROOT, "src", "icon.svg"), "<svg></svg>\n");
      writeFileSync(join(MIXED_ASSET_SCRIPTS_ROOT, "index.html"), "<div></div>\n");
      return listRepositoryFiles(MIXED_ASSET_SCRIPTS_ROOT).commentSources.map(
        (file) => file.relativePath,
      );
    });

    it("is listed as a script", ({ commentSourcePathsBesideAssets }) => {
      expect(commentSourcePathsBesideAssets).toStrictEqual(["src/order.ts"]);
    });
  });

  describe("a style sheet standing beside a script", () => {
    const it = test.extend("styleSheetPathsBesideScripts", ({}, { onCleanup }) => {
      rmSync(MIXED_ASSET_STYLES_ROOT, { recursive: true, force: true });
      mkdirSync(join(MIXED_ASSET_STYLES_ROOT, "src"), { recursive: true });
      onCleanup(() => {
        rmSync(MIXED_ASSET_STYLES_ROOT, { recursive: true, force: true });
      });
      writeFileSync(join(MIXED_ASSET_STYLES_ROOT, "package.json"), "{}");
      writeFileSync(join(MIXED_ASSET_STYLES_ROOT, "src", "order.ts"), "export const total = 1;\n");
      writeFileSync(
        join(MIXED_ASSET_STYLES_ROOT, "src", "order.css"),
        ".total {\n  color: red;\n}\n",
      );
      writeFileSync(join(MIXED_ASSET_STYLES_ROOT, "src", "icon.svg"), "<svg></svg>\n");
      writeFileSync(join(MIXED_ASSET_STYLES_ROOT, "index.html"), "<div></div>\n");
      return listRepositoryFiles(MIXED_ASSET_STYLES_ROOT).styleSheets.map(
        (file) => file.relativePath,
      );
    });

    it("is listed apart from the scripts", ({ styleSheetPathsBesideScripts }) => {
      expect(styleSheetPathsBesideScripts).toStrictEqual(["src/order.css"]);
    });
  });

  describe("a markup file standing beside a script", () => {
    const it = test.extend("markupSourcePathsBesideScripts", ({}, { onCleanup }) => {
      rmSync(MIXED_ASSET_MARKUP_ROOT, { recursive: true, force: true });
      mkdirSync(join(MIXED_ASSET_MARKUP_ROOT, "src"), { recursive: true });
      onCleanup(() => {
        rmSync(MIXED_ASSET_MARKUP_ROOT, { recursive: true, force: true });
      });
      writeFileSync(join(MIXED_ASSET_MARKUP_ROOT, "package.json"), "{}");
      writeFileSync(join(MIXED_ASSET_MARKUP_ROOT, "src", "order.ts"), "export const total = 1;\n");
      writeFileSync(
        join(MIXED_ASSET_MARKUP_ROOT, "src", "order.css"),
        ".total {\n  color: red;\n}\n",
      );
      writeFileSync(join(MIXED_ASSET_MARKUP_ROOT, "src", "icon.svg"), "<svg></svg>\n");
      writeFileSync(join(MIXED_ASSET_MARKUP_ROOT, "index.html"), "<div></div>\n");
      return listRepositoryFiles(MIXED_ASSET_MARKUP_ROOT).markupSources.map(
        (file) => file.relativePath,
      );
    });

    it("is listed apart from the scripts", ({ markupSourcePathsBesideScripts }) => {
      expect(markupSourcePathsBesideScripts).toStrictEqual(["index.html", "src/icon.svg"]);
    });
  });

  describe("a manifest standing beside a script", () => {
    const it = test.extend("manifestPathsBesideScripts", ({}, { onCleanup }) => {
      rmSync(MIXED_ASSET_MANIFESTS_ROOT, { recursive: true, force: true });
      mkdirSync(join(MIXED_ASSET_MANIFESTS_ROOT, "src"), { recursive: true });
      onCleanup(() => {
        rmSync(MIXED_ASSET_MANIFESTS_ROOT, { recursive: true, force: true });
      });
      writeFileSync(join(MIXED_ASSET_MANIFESTS_ROOT, "package.json"), "{}");
      writeFileSync(
        join(MIXED_ASSET_MANIFESTS_ROOT, "src", "order.ts"),
        "export const total = 1;\n",
      );
      writeFileSync(
        join(MIXED_ASSET_MANIFESTS_ROOT, "src", "order.css"),
        ".total {\n  color: red;\n}\n",
      );
      writeFileSync(join(MIXED_ASSET_MANIFESTS_ROOT, "src", "icon.svg"), "<svg></svg>\n");
      writeFileSync(join(MIXED_ASSET_MANIFESTS_ROOT, "index.html"), "<div></div>\n");
      return listRepositoryFiles(MIXED_ASSET_MANIFESTS_ROOT).manifests.map(
        (file) => file.relativePath,
      );
    });

    it("is listed apart from the scripts", ({ manifestPathsBesideScripts }) => {
      expect(manifestPathsBesideScripts).toStrictEqual(["package.json"]);
    });
  });

  describe("production sources standing beside tests, stories, fixtures, and declarations", () => {
    const it = test
      .extend("declarationSourcePathsBesideNonProductionScripts", ({}, { onCleanup }) => {
        const repositoryRoot = mkdtempSync(join(tmpdir(), "source-files-"));
        onCleanup(() => {
          rmSync(repositoryRoot, { recursive: true, force: true });
        });
        for (const relativePath of [
          "src/order-status.ts",
          "src/order-status.test.ts",
          "src/order-status.test.helper.ts",
          "src/order-status.test-d.ts",
          "src/OrderStatus.stories.tsx",
          "src/Owner.stories.fixture.ts",
          "fixtures/order-status.ts",
          "src/order-status.d.ts",
          "src/contest.ts",
          "src/latest.ts",
        ]) {
          const absolutePath = join(repositoryRoot, relativePath);
          mkdirSync(dirname(absolutePath), { recursive: true });
          writeFileSync(absolutePath, "export const total = 1;\n");
        }
        return listRepositoryFiles(repositoryRoot).declarationSources.map(
          (file) => file.relativePath,
        );
      })
      .extend("commentSourcePathsBesideNonProductionScripts", ({}, { onCleanup }) => {
        const repositoryRoot = mkdtempSync(join(tmpdir(), "source-files-"));
        onCleanup(() => {
          rmSync(repositoryRoot, { recursive: true, force: true });
        });
        for (const relativePath of [
          "src/order-status.ts",
          "src/order-status.test.ts",
          "src/order-status.test.helper.ts",
          "src/order-status.test-d.ts",
          "src/OrderStatus.stories.tsx",
          "src/Owner.stories.fixture.ts",
          "fixtures/order-status.ts",
          "src/order-status.d.ts",
          "src/contest.ts",
          "src/latest.ts",
        ]) {
          const absolutePath = join(repositoryRoot, relativePath);
          mkdirSync(dirname(absolutePath), { recursive: true });
          writeFileSync(absolutePath, "export const total = 1;\n");
        }
        return listRepositoryFiles(repositoryRoot).commentSources.map((file) => file.relativePath);
      });

    it("let only the production TypeScript sources declare canonical values", ({
      declarationSourcePathsBesideNonProductionScripts,
    }) => {
      expect(declarationSourcePathsBesideNonProductionScripts).toStrictEqual([
        "src/contest.ts",
        "src/latest.ts",
        "src/order-status.ts",
      ]);
    });

    it("are all listed as scripts whatever their role", ({
      commentSourcePathsBesideNonProductionScripts,
    }) => {
      expect(commentSourcePathsBesideNonProductionScripts).toStrictEqual([
        "fixtures/order-status.ts",
        "src/OrderStatus.stories.tsx",
        "src/Owner.stories.fixture.ts",
        "src/contest.ts",
        "src/latest.ts",
        "src/order-status.d.ts",
        "src/order-status.test-d.ts",
        "src/order-status.test.helper.ts",
        "src/order-status.test.ts",
        "src/order-status.ts",
      ]);
    });
  });

  describe("a repository holding lock files, manifests, JSON, and a readme", () => {
    const it = test
      .extend("cacheInputPathsOfADependencyConfiguration", ({}, { onCleanup }) => {
        const repositoryRoot = mkdtempSync(join(tmpdir(), "source-files-"));
        onCleanup(() => {
          rmSync(repositoryRoot, { recursive: true, force: true });
        });
        for (const relativePath of [
          ".npmrc",
          ".yarnrc.yml",
          "bun.lock",
          "bun.lockb",
          "deno.lock",
          "dist/generated.d.ts",
          "package.json",
          "pnpm-lock.yaml",
          "pnpm-workspace.yaml",
          "src/data.json",
          "src/runtime.ts",
          "src/types.d.ts",
          "tsconfig.json",
          "yarn.lock",
          "README.md",
        ]) {
          const absolutePath = join(repositoryRoot, relativePath);
          mkdirSync(dirname(absolutePath), { recursive: true });
          writeFileSync(absolutePath, "{}\n");
        }
        return listRepositoryFiles(repositoryRoot).cacheInputs.map((file) => file.relativePath);
      })
      .extend("commentSourcePathsOfADependencyConfiguration", ({}, { onCleanup }) => {
        const repositoryRoot = mkdtempSync(join(tmpdir(), "source-files-"));
        onCleanup(() => {
          rmSync(repositoryRoot, { recursive: true, force: true });
        });
        for (const relativePath of [
          ".npmrc",
          ".yarnrc.yml",
          "bun.lock",
          "bun.lockb",
          "deno.lock",
          "dist/generated.d.ts",
          "package.json",
          "pnpm-lock.yaml",
          "pnpm-workspace.yaml",
          "src/data.json",
          "src/runtime.ts",
          "src/types.d.ts",
          "tsconfig.json",
          "yarn.lock",
          "README.md",
        ]) {
          const absolutePath = join(repositoryRoot, relativePath);
          mkdirSync(dirname(absolutePath), { recursive: true });
          writeFileSync(absolutePath, "{}\n");
        }
        return listRepositoryFiles(repositoryRoot).commentSources.map((file) => file.relativePath);
      })
      .extend("manifestPathsOfADependencyConfiguration", ({}, { onCleanup }) => {
        const repositoryRoot = mkdtempSync(join(tmpdir(), "source-files-"));
        onCleanup(() => {
          rmSync(repositoryRoot, { recursive: true, force: true });
        });
        for (const relativePath of [
          ".npmrc",
          ".yarnrc.yml",
          "bun.lock",
          "bun.lockb",
          "deno.lock",
          "dist/generated.d.ts",
          "package.json",
          "pnpm-lock.yaml",
          "pnpm-workspace.yaml",
          "src/data.json",
          "src/runtime.ts",
          "src/types.d.ts",
          "tsconfig.json",
          "yarn.lock",
          "README.md",
        ]) {
          const absolutePath = join(repositoryRoot, relativePath);
          mkdirSync(dirname(absolutePath), { recursive: true });
          writeFileSync(absolutePath, "{}\n");
        }
        return listRepositoryFiles(repositoryRoot).manifests.map((file) => file.relativePath);
      });

    it("cover the checker sources, declarations, JSON, and dependency configuration", ({
      cacheInputPathsOfADependencyConfiguration,
    }) => {
      expect(cacheInputPathsOfADependencyConfiguration).toStrictEqual([
        ".npmrc",
        ".yarnrc.yml",
        "bun.lock",
        "bun.lockb",
        "deno.lock",
        "dist/generated.d.ts",
        "package.json",
        "pnpm-lock.yaml",
        "pnpm-workspace.yaml",
        "src/data.json",
        "src/runtime.ts",
        "src/types.d.ts",
        "tsconfig.json",
        "yarn.lock",
      ]);
    });

    it("leave the readme and the generated declaration out of the scripts", ({
      commentSourcePathsOfADependencyConfiguration,
    }) => {
      expect(commentSourcePathsOfADependencyConfiguration).toStrictEqual([
        "src/runtime.ts",
        "src/types.d.ts",
      ]);
    });

    it("hold the manifest apart from the rest", ({ manifestPathsOfADependencyConfiguration }) => {
      expect(manifestPathsOfADependencyConfiguration).toStrictEqual(["package.json"]);
    });
  });

  describe("a script reached through a link into a generated directory", () => {
    const it = test
      .extend("commentSourcePathsOfALinkToGeneratedSource", ({}, { onCleanup }) => {
        const repositoryRoot = mkdtempSync(join(tmpdir(), "source-files-"));
        onCleanup(() => {
          rmSync(repositoryRoot, { recursive: true, force: true });
        });
        const generatedSource = join(repositoryRoot, "dist/generated/consumer.ts");
        const linkPath = join(repositoryRoot, "src/consumer.ts");
        mkdirSync(dirname(generatedSource), { recursive: true });
        mkdirSync(dirname(linkPath), { recursive: true });
        writeFileSync(
          generatedSource,
          '// eslint-disable-next-line -- escape\nexport const status = "draft";\n',
        );
        symlinkSync(generatedSource, linkPath);
        return listRepositoryFiles(repositoryRoot).commentSources.map((file) => file.relativePath);
      })
      .extend("declarationSourcePathsOfALinkToGeneratedSource", ({}, { onCleanup }) => {
        const repositoryRoot = mkdtempSync(join(tmpdir(), "source-files-"));
        onCleanup(() => {
          rmSync(repositoryRoot, { recursive: true, force: true });
        });
        const generatedSource = join(repositoryRoot, "dist/generated/consumer.ts");
        const linkPath = join(repositoryRoot, "src/consumer.ts");
        mkdirSync(dirname(generatedSource), { recursive: true });
        mkdirSync(dirname(linkPath), { recursive: true });
        writeFileSync(
          generatedSource,
          '// eslint-disable-next-line -- escape\nexport const status = "draft";\n',
        );
        symlinkSync(generatedSource, linkPath);
        return listRepositoryFiles(repositoryRoot).declarationSources.map(
          (file) => file.relativePath,
        );
      })
      .extend("cacheInputPathsOfALinkToGeneratedSource", ({}, { onCleanup }) => {
        const repositoryRoot = mkdtempSync(join(tmpdir(), "source-files-"));
        onCleanup(() => {
          rmSync(repositoryRoot, { recursive: true, force: true });
        });
        const generatedSource = join(repositoryRoot, "dist/generated/consumer.ts");
        const linkPath = join(repositoryRoot, "src/consumer.ts");
        mkdirSync(dirname(generatedSource), { recursive: true });
        mkdirSync(dirname(linkPath), { recursive: true });
        writeFileSync(
          generatedSource,
          '// eslint-disable-next-line -- escape\nexport const status = "draft";\n',
        );
        symlinkSync(generatedSource, linkPath);
        return listRepositoryFiles(repositoryRoot).cacheInputs.map((file) => file.relativePath);
      })
      .extend("problemPathsOfALinkToGeneratedSource", ({}, { onCleanup }) => {
        const repositoryRoot = mkdtempSync(join(tmpdir(), "source-files-"));
        onCleanup(() => {
          rmSync(repositoryRoot, { recursive: true, force: true });
        });
        const generatedSource = join(repositoryRoot, "dist/generated/consumer.ts");
        const linkPath = join(repositoryRoot, "src/consumer.ts");
        mkdirSync(dirname(generatedSource), { recursive: true });
        mkdirSync(dirname(linkPath), { recursive: true });
        writeFileSync(
          generatedSource,
          '// eslint-disable-next-line -- escape\nexport const status = "draft";\n',
        );
        symlinkSync(generatedSource, linkPath);
        return listRepositoryFiles(repositoryRoot).problems.map((problem) => problem.filePath);
      });

    it("is listed as a script under the path inside the sources", ({
      commentSourcePathsOfALinkToGeneratedSource,
    }) => {
      expect(commentSourcePathsOfALinkToGeneratedSource).toStrictEqual(["src/consumer.ts"]);
    });

    it("cannot declare canonical values through the link", ({
      declarationSourcePathsOfALinkToGeneratedSource,
    }) => {
      expect(declarationSourcePathsOfALinkToGeneratedSource).toStrictEqual([]);
    });

    it("keeps the cache identity of both paths", ({ cacheInputPathsOfALinkToGeneratedSource }) => {
      expect(cacheInputPathsOfALinkToGeneratedSource).toStrictEqual([
        "dist/generated/consumer.ts",
        "src/consumer.ts",
      ]);
    });

    it("raises no problem", ({ problemPathsOfALinkToGeneratedSource }) => {
      expect(problemPathsOfALinkToGeneratedSource).toStrictEqual([]);
    });
  });

  describe("a script standing beside an alias of itself", () => {
    const it = test
      .extend("commentSourcePathsOfAnAliasedScript", ({}, { onCleanup }) => {
        const repositoryRoot = mkdtempSync(join(tmpdir(), "source-files-"));
        onCleanup(() => {
          rmSync(repositoryRoot, { recursive: true, force: true });
        });
        const scriptPath = join(repositoryRoot, "src/status.ts");
        mkdirSync(dirname(scriptPath), { recursive: true });
        writeFileSync(scriptPath, "export const status = 'draft';\n");
        symlinkSync("status.ts", join(repositoryRoot, "src/status-alias.ts"));
        return listRepositoryFiles(repositoryRoot).commentSources.map((file) => file.relativePath);
      })
      .extend("cacheInputPathsOfAnAliasedScript", ({}, { onCleanup }) => {
        const repositoryRoot = mkdtempSync(join(tmpdir(), "source-files-"));
        onCleanup(() => {
          rmSync(repositoryRoot, { recursive: true, force: true });
        });
        const scriptPath = join(repositoryRoot, "src/status.ts");
        mkdirSync(dirname(scriptPath), { recursive: true });
        writeFileSync(scriptPath, "export const status = 'draft';\n");
        symlinkSync("status.ts", join(repositoryRoot, "src/status-alias.ts"));
        return listRepositoryFiles(repositoryRoot).cacheInputs.map((file) => file.relativePath);
      });

    it("is scanned once under its physical path", ({ commentSourcePathsOfAnAliasedScript }) => {
      expect(commentSourcePathsOfAnAliasedScript).toStrictEqual(["src/status.ts"]);
    });

    it("keeps both paths in the cache inputs", ({ cacheInputPathsOfAnAliasedScript }) => {
      expect(cacheInputPathsOfAnAliasedScript).toStrictEqual([
        "src/status-alias.ts",
        "src/status.ts",
      ]);
    });
  });

  describe("a directory reached through an alias inside the repository", () => {
    const it = test
      .extend("cacheInputPathsOfAnAliasedDirectory", ({}, { onCleanup }) => {
        const repositoryRoot = mkdtempSync(join(tmpdir(), "source-files-"));
        onCleanup(() => {
          rmSync(repositoryRoot, { recursive: true, force: true });
        });
        mkdirSync(join(repositoryRoot, "shared"), { recursive: true });
        writeFileSync(join(repositoryRoot, "shared/status.ts"), "export const status = 'draft';\n");
        mkdirSync(join(repositoryRoot, "src"), { recursive: true });
        symlinkSync("../shared", join(repositoryRoot, "src/shared"));
        return listRepositoryFiles(repositoryRoot).cacheInputs.map((file) => file.relativePath);
      })
      .extend("commentSourcePathsOfAnAliasedDirectory", ({}, { onCleanup }) => {
        const repositoryRoot = mkdtempSync(join(tmpdir(), "source-files-"));
        onCleanup(() => {
          rmSync(repositoryRoot, { recursive: true, force: true });
        });
        mkdirSync(join(repositoryRoot, "shared"), { recursive: true });
        writeFileSync(join(repositoryRoot, "shared/status.ts"), "export const status = 'draft';\n");
        mkdirSync(join(repositoryRoot, "src"), { recursive: true });
        symlinkSync("../shared", join(repositoryRoot, "src/shared"));
        return listRepositoryFiles(repositoryRoot).commentSources.map((file) => file.relativePath);
      });

    it("keeps both paths in the cache inputs", ({ cacheInputPathsOfAnAliasedDirectory }) => {
      expect(cacheInputPathsOfAnAliasedDirectory).toStrictEqual([
        "shared/status.ts",
        "src/shared/status.ts",
      ]);
    });

    it("is scanned once under its physical path", ({ commentSourcePathsOfAnAliasedDirectory }) => {
      expect(commentSourcePathsOfAnAliasedDirectory).toStrictEqual(["shared/status.ts"]);
    });
  });

  describe("a link whose name belongs to no scanned kind", () => {
    const it = test.extend("repositoryFilesOfALinkWithAnUnscannedName", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "source-files-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      writeFileSync(join(repositoryRoot, "README.md"), "status\n");
      symlinkSync("README.md", join(repositoryRoot, "README-link.md"));
      return listRepositoryFiles(repositoryRoot);
    });

    it("stays outside the source collections", ({ repositoryFilesOfALinkWithAnUnscannedName }) => {
      expect(repositoryFilesOfALinkWithAnUnscannedName).toStrictEqual({
        cacheInputs: [],
        commentSources: [],
        declarationSources: [],
        manifests: [],
        markupSources: [],
        problems: [],
        styleSheets: [],
      });
    });
  });

  describe("links pointing outside the repository and at nothing", () => {
    const it = test.extend("repositoryFilesOfLinksLeavingTheRepository", ({}, { onCleanup }) => {
      const enclosingDirectory = mkdtempSync(join(tmpdir(), "source-files-"));
      onCleanup(() => {
        rmSync(enclosingDirectory, { recursive: true, force: true });
      });
      const repositoryRoot = join(enclosingDirectory, "repository");
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(join(enclosingDirectory, "external.ts"), 'export const status = "draft";\n');
      symlinkSync(
        join(enclosingDirectory, "external.ts"),
        join(repositoryRoot, "src", "external.ts"),
      );
      symlinkSync(
        join(enclosingDirectory, "missing.ts"),
        join(repositoryRoot, "src", "missing.ts"),
      );
      return listRepositoryFiles(repositoryRoot);
    });

    it("become strict repository problems", ({ repositoryFilesOfLinksLeavingTheRepository }) => {
      expect(repositoryFilesOfLinksLeavingTheRepository).toStrictEqual({
        cacheInputs: [],
        commentSources: [],
        declarationSources: [],
        manifests: [],
        markupSources: [],
        problems: [
          { kind: "unsafe-symbolic-link", line: 1, filePath: "src/external.ts" },
          { kind: "unsafe-symbolic-link", line: 1, filePath: "src/missing.ts" },
        ],
        styleSheets: [],
      });
    });
  });

  describe("a link that closes a cycle onto its own directory", () => {
    const it = test.extend("repositoryFilesOfALinkCycle", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "source-files-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      const sourceDirectory = join(repositoryRoot, "src");
      mkdirSync(sourceDirectory, { recursive: true });
      symlinkSync(sourceDirectory, join(sourceDirectory, "cycle"));
      return listRepositoryFiles(repositoryRoot);
    });

    it("becomes a strict repository problem", ({ repositoryFilesOfALinkCycle }) => {
      expect(repositoryFilesOfALinkCycle).toStrictEqual({
        cacheInputs: [],
        commentSources: [],
        declarationSources: [],
        manifests: [],
        markupSources: [],
        problems: [{ kind: "unsafe-symbolic-link", line: 1, filePath: "src/cycle/cycle" }],
        styleSheets: [],
      });
    });
  });

  describe("a link to an agent-artifact directory outside the repository", () => {
    const it = test.extend("repositoryFilesBesideAnExternalArtifactLink", ({}, { onCleanup }) => {
      const enclosingDirectory = mkdtempSync(join(tmpdir(), "source-files-"));
      onCleanup(() => {
        rmSync(enclosingDirectory, { recursive: true, force: true });
      });
      const repositoryRoot = join(enclosingDirectory, "repository");
      mkdirSync(repositoryRoot, { recursive: true });
      const artifactDirectory = join(enclosingDirectory, "agent-artifacts");
      mkdirSync(artifactDirectory, { recursive: true });
      writeFileSync(join(artifactDirectory, "notes.ts"), 'export const status = "draft";\n');
      symlinkSync(artifactDirectory, join(repositoryRoot, ".local-agents"));
      return listRepositoryFiles(repositoryRoot);
    });

    it("stays outside the repository scan", ({ repositoryFilesBesideAnExternalArtifactLink }) => {
      expect(repositoryFilesBesideAnExternalArtifactLink).toStrictEqual({
        cacheInputs: [],
        commentSources: [],
        declarationSources: [],
        manifests: [],
        markupSources: [],
        problems: [],
        styleSheets: [],
      });
    });
  });

  describe("an ignored source that git never tracked", () => {
    const it = test.extend("repositoryFilesOfAnUntrackedIgnoredSource", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "source-files-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      gitOutput(["init", "--quiet"], { cwd: repositoryRoot, env: process.env });
      mkdirSync(join(repositoryRoot, "ignored"), { recursive: true });
      writeFileSync(join(repositoryRoot, ".gitignore"), "ignored\n");
      writeFileSync(join(repositoryRoot, "ignored/status.ts"), 'export const status = "draft";\n');
      return listRepositoryFiles(repositoryRoot);
    });

    it("enters no repository source collection", ({
      repositoryFilesOfAnUntrackedIgnoredSource,
    }) => {
      expect(repositoryFilesOfAnUntrackedIgnoredSource).toStrictEqual({
        cacheInputs: [],
        commentSources: [],
        declarationSources: [],
        manifests: [],
        markupSources: [],
        problems: [],
        styleSheets: [],
      });
    });
  });

  describe("a tracked source that a later ignore rule covers", () => {
    const it = test
      .extend("cacheInputPathsOfATrackedIgnoredSource", ({}, { onCleanup }) => {
        const repositoryRoot = mkdtempSync(join(tmpdir(), "source-files-"));
        onCleanup(() => {
          rmSync(repositoryRoot, { recursive: true, force: true });
        });
        gitOutput(["init", "--quiet"], { cwd: repositoryRoot, env: process.env });
        mkdirSync(join(repositoryRoot, "ignored"), { recursive: true });
        writeFileSync(
          join(repositoryRoot, "ignored/status.ts"),
          'export const status = "draft";\n',
        );
        gitOutput(["add", "ignored/status.ts"], { cwd: repositoryRoot, env: process.env });
        writeFileSync(join(repositoryRoot, ".gitignore"), "ignored\n");
        return listRepositoryFiles(repositoryRoot).cacheInputs.map((file) => file.relativePath);
      })
      .extend("commentSourcePathsOfATrackedIgnoredSource", ({}, { onCleanup }) => {
        const repositoryRoot = mkdtempSync(join(tmpdir(), "source-files-"));
        onCleanup(() => {
          rmSync(repositoryRoot, { recursive: true, force: true });
        });
        gitOutput(["init", "--quiet"], { cwd: repositoryRoot, env: process.env });
        mkdirSync(join(repositoryRoot, "ignored"), { recursive: true });
        writeFileSync(
          join(repositoryRoot, "ignored/status.ts"),
          'export const status = "draft";\n',
        );
        gitOutput(["add", "ignored/status.ts"], { cwd: repositoryRoot, env: process.env });
        writeFileSync(join(repositoryRoot, ".gitignore"), "ignored\n");
        return listRepositoryFiles(repositoryRoot).commentSources.map((file) => file.relativePath);
      })
      .extend("declarationSourcePathsOfATrackedIgnoredSource", ({}, { onCleanup }) => {
        const repositoryRoot = mkdtempSync(join(tmpdir(), "source-files-"));
        onCleanup(() => {
          rmSync(repositoryRoot, { recursive: true, force: true });
        });
        gitOutput(["init", "--quiet"], { cwd: repositoryRoot, env: process.env });
        mkdirSync(join(repositoryRoot, "ignored"), { recursive: true });
        writeFileSync(
          join(repositoryRoot, "ignored/status.ts"),
          'export const status = "draft";\n',
        );
        gitOutput(["add", "ignored/status.ts"], { cwd: repositoryRoot, env: process.env });
        writeFileSync(join(repositoryRoot, ".gitignore"), "ignored\n");
        return listRepositoryFiles(repositoryRoot).declarationSources.map(
          (file) => file.relativePath,
        );
      });

    it("stays in the cache inputs", ({ cacheInputPathsOfATrackedIgnoredSource }) => {
      expect(cacheInputPathsOfATrackedIgnoredSource).toStrictEqual(["ignored/status.ts"]);
    });

    it("stays among the scripts", ({ commentSourcePathsOfATrackedIgnoredSource }) => {
      expect(commentSourcePathsOfATrackedIgnoredSource).toStrictEqual(["ignored/status.ts"]);
    });

    it("stays able to declare canonical values", ({
      declarationSourcePathsOfATrackedIgnoredSource,
    }) => {
      expect(declarationSourcePathsOfATrackedIgnoredSource).toStrictEqual(["ignored/status.ts"]);
    });
  });

  describe("an ignored link pointing outside the repository", () => {
    const it = test.extend("repositoryFilesOfAnIgnoredExternalLink", ({}, { onCleanup }) => {
      const enclosingDirectory = mkdtempSync(join(tmpdir(), "source-files-"));
      onCleanup(() => {
        rmSync(enclosingDirectory, { recursive: true, force: true });
      });
      const repositoryRoot = join(enclosingDirectory, "repository");
      mkdirSync(repositoryRoot, { recursive: true });
      gitOutput(["init", "--quiet"], { cwd: repositoryRoot, env: process.env });
      writeFileSync(join(repositoryRoot, ".gitignore"), "ignored.ts\n");
      writeFileSync(join(enclosingDirectory, "external.ts"), 'export const status = "draft";\n');
      symlinkSync(join(enclosingDirectory, "external.ts"), join(repositoryRoot, "ignored.ts"));
      return listRepositoryFiles(repositoryRoot);
    });

    it("is omitted before the unsafe-link check", ({ repositoryFilesOfAnIgnoredExternalLink }) => {
      expect(repositoryFilesOfAnIgnoredExternalLink).toStrictEqual({
        cacheInputs: [],
        commentSources: [],
        declarationSources: [],
        manifests: [],
        markupSources: [],
        problems: [],
        styleSheets: [],
      });
    });
  });

  describe("a tracked link pointing outside the repository that a later ignore rule covers", () => {
    const it = test.extend("repositoryFilesOfATrackedIgnoredExternalLink", ({}, { onCleanup }) => {
      const enclosingDirectory = mkdtempSync(join(tmpdir(), "source-files-"));
      onCleanup(() => {
        rmSync(enclosingDirectory, { recursive: true, force: true });
      });
      const repositoryRoot = join(enclosingDirectory, "repository");
      mkdirSync(repositoryRoot, { recursive: true });
      gitOutput(["init", "--quiet"], { cwd: repositoryRoot, env: process.env });
      writeFileSync(join(enclosingDirectory, "external.ts"), 'export const status = "draft";\n');
      symlinkSync(join(enclosingDirectory, "external.ts"), join(repositoryRoot, "ignored.ts"));
      gitOutput(["add", "ignored.ts"], { cwd: repositoryRoot, env: process.env });
      writeFileSync(join(repositoryRoot, ".gitignore"), "ignored.ts\n");
      return listRepositoryFiles(repositoryRoot);
    });

    it("remains an unsafe repository source", ({
      repositoryFilesOfATrackedIgnoredExternalLink,
    }) => {
      expect(repositoryFilesOfATrackedIgnoredExternalLink).toStrictEqual({
        cacheInputs: [],
        commentSources: [],
        declarationSources: [],
        manifests: [],
        markupSources: [],
        problems: [{ kind: "unsafe-symbolic-link", line: 1, filePath: "ignored.ts" }],
        styleSheets: [],
      });
    });
  });
});

describe("nearestPackageDirectory", () => {
  describe("a directory that holds a manifest", () => {
    const it = test.extend("packageDirectoryOfADirectoryHoldingAManifest", ({}, { onCleanup }) => {
      rmSync(OWN_MANIFEST_ROOT, { recursive: true, force: true });
      mkdirSync(join(OWN_MANIFEST_ROOT, "packages", "order"), { recursive: true });
      onCleanup(() => {
        rmSync(OWN_MANIFEST_ROOT, { recursive: true, force: true });
      });
      writeFileSync(join(OWN_MANIFEST_ROOT, "packages", "order", "package.json"), "{}");
      return nearestPackageDirectory(
        join(OWN_MANIFEST_ROOT, "packages", "order"),
        OWN_MANIFEST_ROOT,
      );
    });

    it("is its own package", ({ packageDirectoryOfADirectoryHoldingAManifest }) => {
      expect(packageDirectoryOfADirectoryHoldingAManifest).toBe(
        join(OWN_MANIFEST_ROOT, "packages", "order"),
      );
    });
  });

  describe("a directory below a manifest", () => {
    const it = test.extend("packageDirectoryOfADirectoryBelowAManifest", ({}, { onCleanup }) => {
      rmSync(MANIFEST_ABOVE_ROOT, { recursive: true, force: true });
      mkdirSync(join(MANIFEST_ABOVE_ROOT, "packages", "order", "src", "lint"), { recursive: true });
      onCleanup(() => {
        rmSync(MANIFEST_ABOVE_ROOT, { recursive: true, force: true });
      });
      writeFileSync(join(MANIFEST_ABOVE_ROOT, "packages", "order", "package.json"), "{}");
      return nearestPackageDirectory(
        join(MANIFEST_ABOVE_ROOT, "packages", "order", "src", "lint"),
        MANIFEST_ABOVE_ROOT,
      );
    });

    it("belongs to the package that holds it", ({ packageDirectoryOfADirectoryBelowAManifest }) => {
      expect(packageDirectoryOfADirectoryBelowAManifest).toBe(
        join(MANIFEST_ABOVE_ROOT, "packages", "order"),
      );
    });
  });

  describe("a directory standing between two manifests", () => {
    const it = test.extend("packageDirectoryBetweenTwoManifests", ({}, { onCleanup }) => {
      rmSync(RIVAL_MANIFESTS_ROOT, { recursive: true, force: true });
      mkdirSync(join(RIVAL_MANIFESTS_ROOT, "packages", "order", "src"), { recursive: true });
      onCleanup(() => {
        rmSync(RIVAL_MANIFESTS_ROOT, { recursive: true, force: true });
      });
      writeFileSync(join(RIVAL_MANIFESTS_ROOT, "package.json"), "{}");
      writeFileSync(join(RIVAL_MANIFESTS_ROOT, "packages", "order", "package.json"), "{}");
      return nearestPackageDirectory(
        join(RIVAL_MANIFESTS_ROOT, "packages", "order", "src"),
        RIVAL_MANIFESTS_ROOT,
      );
    });

    it("belongs to the nearer manifest rather than the one further up", ({
      packageDirectoryBetweenTwoManifests,
    }) => {
      expect(packageDirectoryBetweenTwoManifests).toBe(
        join(RIVAL_MANIFESTS_ROOT, "packages", "order"),
      );
    });
  });

  describe("a directory under a repository whose root holds the only manifest", () => {
    const it = test.extend("packageDirectoryUnderARootHoldingTheOnlyManifest", ({}, {
      onCleanup,
    }) => {
      rmSync(ROOT_ONLY_MANIFEST_ROOT, { recursive: true, force: true });
      mkdirSync(join(ROOT_ONLY_MANIFEST_ROOT, "scripts"), { recursive: true });
      onCleanup(() => {
        rmSync(ROOT_ONLY_MANIFEST_ROOT, { recursive: true, force: true });
      });
      writeFileSync(join(ROOT_ONLY_MANIFEST_ROOT, "package.json"), "{}");
      return nearestPackageDirectory(
        join(ROOT_ONLY_MANIFEST_ROOT, "scripts"),
        ROOT_ONLY_MANIFEST_ROOT,
      );
    });

    it("belongs to the root", ({ packageDirectoryUnderARootHoldingTheOnlyManifest }) => {
      expect(packageDirectoryUnderARootHoldingTheOnlyManifest).toBe(ROOT_ONLY_MANIFEST_ROOT);
    });
  });

  describe("a directory under a repository whose root holds no manifest", () => {
    const it = test.extend("packageDirectoryUnderARootHoldingNoManifest", ({}, { onCleanup }) => {
      rmSync(NO_MANIFEST_ROOT, { recursive: true, force: true });
      mkdirSync(join(NO_MANIFEST_ROOT, "scripts"), { recursive: true });
      onCleanup(() => {
        rmSync(NO_MANIFEST_ROOT, { recursive: true, force: true });
      });
      return nearestPackageDirectory(join(NO_MANIFEST_ROOT, "scripts"), NO_MANIFEST_ROOT);
    });

    it("is left in no package", ({ packageDirectoryUnderARootHoldingNoManifest }) => {
      expect(packageDirectoryUnderARootHoldingNoManifest).toBe(null);
    });
  });

  describe("a directory standing above the repository root", () => {
    const it = test.extend("packageDirectoryOutsideTheRepository", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "source-files-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      return nearestPackageDirectory(dirname(repositoryRoot), repositoryRoot);
    });

    it("cannot acquire a package", ({ packageDirectoryOutsideTheRepository }) => {
      expect(packageDirectoryOutsideTheRepository).toBe(null);
    });
  });
});
