import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import * as ts from "typescript-6";
import { describe, expect, test } from "vite-plus/test";

import { readGitSourceScope } from "../git-ignored-source.ts";
import { gitOutput } from "../git-output.ts";
import { buildCatalog, type CanonicalValuesEntry } from "./catalog.ts";
import {
  matchesConfiguredPathAlias,
  repositoryModulePath,
  resolvedDirectImportEntries,
  resolvedPublicImportEntries,
} from "./import-route-resolution.ts";
import { importRouteStatus } from "./import-route.ts";

const ALIASED_TSCONFIG = JSON.stringify({
  compilerOptions: { baseUrl: ".", paths: { "@internal/status": ["src/status.ts"] } },
});

const WILDCARD_TSCONFIG = JSON.stringify({
  compilerOptions: {
    paths: { "@exact": ["src/exact.ts"], "@one/*": ["src/*"], "@two/*/*": ["src/*"] },
  },
});

const VOCABULARY_MANIFEST = JSON.stringify({
  exports: {
    "./status": {
      import: "./fixtures/status.mjs",
      require: "./src/status.cjs",
    },
  },
  name: "@fixture/vocabulary",
  type: "module",
});

const ORDER_STATUS_OWNER: CanonicalValuesEntry = {
  annotationStart: 0,
  binding: "ORDER_STATUSES",
  bindingStart: 40,
  conceptId: "order.status",
  declarationEnd: 80,
  declarationPath: "src/order-status.ts",
  declarationStart: 20,
  fingerprint: "fixture",
  importRoutes: [],
  packageName: null,
  values: ["draft", "published"],
};

const PUBLIC_DECLARATION_OWNER = {
  annotationStart: 0,
  binding: "STATUS",
  bindingStart: 0,
  conceptId: "order.status",
  declarationEnd: 1,
  declarationPath: "src/owner.ts",
  declarationStart: 0,
  fingerprint: "fingerprint",
  importRoutes: [
    {
      exportName: "STATUS",
      resolvedSourcePaths: ["src/runtime.ts"],
      specifier: "./public.d.ts",
    },
  ],
  packageName: null,
  values: ["draft", "published"],
} as const;

const RE_EXPORTED_OWNER = {
  annotationStart: 0,
  binding: "ORDER_STATUSES",
  bindingStart: 0,
  conceptId: "order.status",
  declarationEnd: 1,
  declarationPath: "src/owner.ts",
  declarationStart: 0,
  fingerprint: "fingerprint",
  importRoutes: [
    {
      exportName: "ORDER_STATUSES",
      resolvedSourcePaths: ["src/public.ts"],
      specifier: "./public.ts",
    },
  ],
  packageName: null,
  values: ["draft", "published"],
} as const;

describe("repositoryModulePath", () => {
  describe("a relative specifier written with the TypeScript extension", () => {
    const it = test
      .extend("repositoryRoot", ({}, { onCleanup }) => {
        const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
        onCleanup(() => {
          rmSync(repositoryRoot, { recursive: true, force: true });
        });
        mkdirSync(join(repositoryRoot, "src"), { recursive: true });
        writeFileSync(join(repositoryRoot, "tsconfig.json"), ALIASED_TSCONFIG, "utf8");
        writeFileSync(join(repositoryRoot, "src/consumer.ts"), "export {};\n", "utf8");
        writeFileSync(join(repositoryRoot, "src/status.ts"), "export const status = 1;\n", "utf8");
        return repositoryRoot;
      })
      .extend("moduleSourcePath", ({ repositoryRoot }) =>
        repositoryModulePath({
          filename: join(repositoryRoot, "src/consumer.ts"),
          importedName: "status",
          repositoryRoot,
          specifier: "./status.ts",
        }),
      );

    it("names the repository source the extension points at", ({
      moduleSourcePath,
      repositoryRoot,
    }) => {
      expect(moduleSourcePath).toBe(realpathSync.native(join(repositoryRoot, "src/status.ts")));
    });
  });

  describe("a relative specifier written without an extension", () => {
    const it = test
      .extend("repositoryRoot", ({}, { onCleanup }) => {
        const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
        onCleanup(() => {
          rmSync(repositoryRoot, { recursive: true, force: true });
        });
        mkdirSync(join(repositoryRoot, "src"), { recursive: true });
        writeFileSync(join(repositoryRoot, "tsconfig.json"), ALIASED_TSCONFIG, "utf8");
        writeFileSync(join(repositoryRoot, "src/consumer.ts"), "export {};\n", "utf8");
        writeFileSync(join(repositoryRoot, "src/status.ts"), "export const status = 1;\n", "utf8");
        return repositoryRoot;
      })
      .extend("moduleSourcePath", ({ repositoryRoot }) =>
        repositoryModulePath({
          filename: join(repositoryRoot, "src/consumer.ts"),
          importedName: "status",
          repositoryRoot,
          specifier: "./status",
        }),
      );

    it("names the repository source carrying the TypeScript extension", ({
      moduleSourcePath,
      repositoryRoot,
    }) => {
      expect(moduleSourcePath).toBe(realpathSync.native(join(repositoryRoot, "src/status.ts")));
    });
  });

  describe("a relative specifier written with the JavaScript extension", () => {
    const it = test
      .extend("repositoryRoot", ({}, { onCleanup }) => {
        const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
        onCleanup(() => {
          rmSync(repositoryRoot, { recursive: true, force: true });
        });
        mkdirSync(join(repositoryRoot, "src"), { recursive: true });
        writeFileSync(join(repositoryRoot, "tsconfig.json"), ALIASED_TSCONFIG, "utf8");
        writeFileSync(join(repositoryRoot, "src/consumer.ts"), "export {};\n", "utf8");
        writeFileSync(join(repositoryRoot, "src/status.ts"), "export const status = 1;\n", "utf8");
        return repositoryRoot;
      })
      .extend("moduleSourcePath", ({ repositoryRoot }) =>
        repositoryModulePath({
          filename: join(repositoryRoot, "src/consumer.ts"),
          importedName: "status",
          repositoryRoot,
          specifier: "./status.js",
        }),
      );

    it("names the TypeScript source the emitted extension stands for", ({
      moduleSourcePath,
      repositoryRoot,
    }) => {
      expect(moduleSourcePath).toBe(realpathSync.native(join(repositoryRoot, "src/status.ts")));
    });
  });

  describe("a specifier written as a configured path alias", () => {
    const it = test
      .extend("repositoryRoot", ({}, { onCleanup }) => {
        const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
        onCleanup(() => {
          rmSync(repositoryRoot, { recursive: true, force: true });
        });
        mkdirSync(join(repositoryRoot, "src"), { recursive: true });
        writeFileSync(join(repositoryRoot, "tsconfig.json"), ALIASED_TSCONFIG, "utf8");
        writeFileSync(join(repositoryRoot, "src/consumer.ts"), "export {};\n", "utf8");
        writeFileSync(join(repositoryRoot, "src/status.ts"), "export const status = 1;\n", "utf8");
        return repositoryRoot;
      })
      .extend("moduleSourcePath", ({ repositoryRoot }) =>
        repositoryModulePath({
          filename: join(repositoryRoot, "src/consumer.ts"),
          importedName: "status",
          repositoryRoot,
          specifier: "@internal/status",
        }),
      );

    it("names the repository source the alias is mapped to", ({
      moduleSourcePath,
      repositoryRoot,
    }) => {
      expect(moduleSourcePath).toBe(realpathSync.native(join(repositoryRoot, "src/status.ts")));
    });
  });

  describe("a relative specifier naming no file in the repository", () => {
    const it = test.extend("moduleSourcePath", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(join(repositoryRoot, "tsconfig.json"), ALIASED_TSCONFIG, "utf8");
      writeFileSync(join(repositoryRoot, "src/consumer.ts"), "export {};\n", "utf8");
      writeFileSync(join(repositoryRoot, "src/status.ts"), "export const status = 1;\n", "utf8");
      return repositoryModulePath({
        filename: join(repositoryRoot, "src/consumer.ts"),
        importedName: "status",
        repositoryRoot,
        specifier: "./missing",
      });
    });

    it("names no repository source", ({ moduleSourcePath }) => {
      expect(moduleSourcePath).toBe(null);
    });
  });

  describe("a package subpath read in the ECMAScript module resolution mode", () => {
    const it = test
      .extend("repositoryRoot", ({}, { onCleanup }) => {
        const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
        onCleanup(() => {
          rmSync(repositoryRoot, { recursive: true, force: true });
        });
        mkdirSync(join(repositoryRoot, "packages/vocabulary/fixtures"), { recursive: true });
        mkdirSync(join(repositoryRoot, "packages/vocabulary/src"), { recursive: true });
        mkdirSync(join(repositoryRoot, "node_modules/@fixture"), { recursive: true });
        mkdirSync(join(repositoryRoot, "src"), { recursive: true });
        writeFileSync(
          join(repositoryRoot, "packages/vocabulary/fixtures/status.mjs"),
          'export const status = "fixture";\n',
          "utf8",
        );
        writeFileSync(
          join(repositoryRoot, "packages/vocabulary/package.json"),
          VOCABULARY_MANIFEST,
          "utf8",
        );
        writeFileSync(
          join(repositoryRoot, "packages/vocabulary/src/status.cjs"),
          'exports.status = "production";\n',
          "utf8",
        );
        writeFileSync(join(repositoryRoot, "src/main.cjs"), "export {};\n", "utf8");
        symlinkSync(
          join(repositoryRoot, "packages/vocabulary"),
          join(repositoryRoot, "node_modules/@fixture/vocabulary"),
          "dir",
        );
        return repositoryRoot;
      })
      .extend("moduleSourcePath", ({ repositoryRoot }) =>
        repositoryModulePath({
          filename: join(repositoryRoot, "src/main.cjs"),
          importedName: "status",
          repositoryRoot,
          resolutionMode: ts.ModuleKind.ESNext,
          specifier: "@fixture/vocabulary/status",
        }),
      );

    it("names the source the import condition points at", ({
      moduleSourcePath,
      repositoryRoot,
    }) => {
      expect(moduleSourcePath).toBe(
        realpathSync.native(join(repositoryRoot, "packages/vocabulary/fixtures/status.mjs")),
      );
    });
  });

  describe("a package subpath read in the CommonJS resolution mode", () => {
    const it = test
      .extend("repositoryRoot", ({}, { onCleanup }) => {
        const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
        onCleanup(() => {
          rmSync(repositoryRoot, { recursive: true, force: true });
        });
        mkdirSync(join(repositoryRoot, "packages/vocabulary/fixtures"), { recursive: true });
        mkdirSync(join(repositoryRoot, "packages/vocabulary/src"), { recursive: true });
        mkdirSync(join(repositoryRoot, "node_modules/@fixture"), { recursive: true });
        mkdirSync(join(repositoryRoot, "src"), { recursive: true });
        writeFileSync(
          join(repositoryRoot, "packages/vocabulary/fixtures/status.mjs"),
          'export const status = "fixture";\n',
          "utf8",
        );
        writeFileSync(
          join(repositoryRoot, "packages/vocabulary/package.json"),
          VOCABULARY_MANIFEST,
          "utf8",
        );
        writeFileSync(
          join(repositoryRoot, "packages/vocabulary/src/status.cjs"),
          'exports.status = "production";\n',
          "utf8",
        );
        writeFileSync(join(repositoryRoot, "src/main.cjs"), "export {};\n", "utf8");
        symlinkSync(
          join(repositoryRoot, "packages/vocabulary"),
          join(repositoryRoot, "node_modules/@fixture/vocabulary"),
          "dir",
        );
        return repositoryRoot;
      })
      .extend("moduleSourcePath", ({ repositoryRoot }) =>
        repositoryModulePath({
          filename: join(repositoryRoot, "src/main.cjs"),
          importedName: "status",
          repositoryRoot,
          resolutionMode: ts.ModuleKind.CommonJS,
          specifier: "@fixture/vocabulary/status",
        }),
      );

    it("names the source the require condition points at", ({
      moduleSourcePath,
      repositoryRoot,
    }) => {
      expect(moduleSourcePath).toBe(
        realpathSync.native(join(repositoryRoot, "packages/vocabulary/src/status.cjs")),
      );
    });
  });

  describe("a file URL naming a repository source", () => {
    const it = test
      .extend("repositoryRoot", ({}, { onCleanup }) => {
        const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
        onCleanup(() => {
          rmSync(repositoryRoot, { recursive: true, force: true });
        });
        mkdirSync(join(repositoryRoot, "src"), { recursive: true });
        writeFileSync(join(repositoryRoot, "src/consumer.ts"), "export {};\n", "utf8");
        writeFileSync(join(repositoryRoot, "src/status.ts"), "export const status = 1;\n", "utf8");
        return repositoryRoot;
      })
      .extend("moduleSourcePath", ({ repositoryRoot }) =>
        repositoryModulePath({
          filename: join(repositoryRoot, "src/consumer.ts"),
          importedName: "status",
          repositoryRoot,
          specifier: new URL(`file://${join(repositoryRoot, "src/status.ts")}`).href,
        }),
      );

    it("names the repository source the URL points at", ({ moduleSourcePath, repositoryRoot }) => {
      expect(moduleSourcePath).toBe(realpathSync.native(join(repositoryRoot, "src/status.ts")));
    });
  });

  describe("a file URL that cannot be read as a path", () => {
    const it = test.extend("moduleSourcePath", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(join(repositoryRoot, "src/consumer.ts"), "export {};\n", "utf8");
      writeFileSync(join(repositoryRoot, "src/status.ts"), "export const status = 1;\n", "utf8");
      return repositoryModulePath({
        filename: join(repositoryRoot, "src/consumer.ts"),
        importedName: "status",
        repositoryRoot,
        specifier: "file:%",
      });
    });

    it("names no repository source", ({ moduleSourcePath }) => {
      expect(moduleSourcePath).toBe(null);
    });
  });

  describe("a file URL naming a path outside the repository", () => {
    const it = test.extend("moduleSourcePath", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(join(repositoryRoot, "src/consumer.ts"), "export {};\n", "utf8");
      writeFileSync(join(repositoryRoot, "src/status.ts"), "export const status = 1;\n", "utf8");
      return repositoryModulePath({
        filename: join(repositoryRoot, "src/consumer.ts"),
        importedName: "status",
        repositoryRoot,
        specifier: "file:///vendor/status.ts",
      });
    });

    it("names no repository source", ({ moduleSourcePath }) => {
      expect(moduleSourcePath).toBe(null);
    });
  });

  describe("a specifier naming a Node builtin", () => {
    const it = test.extend("moduleSourcePath", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(join(repositoryRoot, "src/consumer.ts"), "export {};\n", "utf8");
      writeFileSync(join(repositoryRoot, "src/status.ts"), "export const status = 1;\n", "utf8");
      return repositoryModulePath({
        filename: join(repositoryRoot, "src/consumer.ts"),
        importedName: "status",
        repositoryRoot,
        specifier: "node:fs",
      });
    });

    it("names no repository source", ({ moduleSourcePath }) => {
      expect(moduleSourcePath).toBe(null);
    });
  });

  describe("a relative specifier read under unparsable compiler configuration", () => {
    const it = test
      .extend("repositoryRoot", ({}, { onCleanup }) => {
        const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
        onCleanup(() => {
          rmSync(repositoryRoot, { recursive: true, force: true });
        });
        mkdirSync(join(repositoryRoot, "src"), { recursive: true });
        writeFileSync(join(repositoryRoot, "tsconfig.json"), "{ invalid", "utf8");
        writeFileSync(join(repositoryRoot, "src/consumer.ts"), "export {};\n", "utf8");
        writeFileSync(join(repositoryRoot, "src/status.ts"), "export const status = 1;\n", "utf8");
        return repositoryRoot;
      })
      .extend("moduleSourcePath", ({ repositoryRoot }) =>
        repositoryModulePath({
          filename: "src/consumer.ts",
          importedName: "status",
          repositoryRoot,
          specifier: "./status.ts",
        }),
      );

    it("still names the repository source the specifier points at", ({
      moduleSourcePath,
      repositoryRoot,
    }) => {
      expect(moduleSourcePath).toBe(realpathSync.native(join(repositoryRoot, "src/status.ts")));
    });
  });

  describe("a specifier naming an installed dependency", () => {
    const it = test.extend("moduleSourcePath", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "node_modules/dependency"), { recursive: true });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "node_modules/dependency/index.d.ts"),
        "export const status: string;\n",
        "utf8",
      );
      writeFileSync(
        join(repositoryRoot, "node_modules/dependency/package.json"),
        JSON.stringify({ name: "dependency", types: "index.d.ts" }),
        "utf8",
      );
      writeFileSync(join(repositoryRoot, "src/consumer.ts"), "export {};\n", "utf8");
      return repositoryModulePath({
        filename: "src/consumer.ts",
        importedName: "status",
        repositoryRoot,
        specifier: "dependency",
      });
    });

    it("names no repository source", ({ moduleSourcePath }) => {
      expect(moduleSourcePath).toBe(null);
    });
  });

  describe("a consumer file lying outside the repository", () => {
    const it = test.extend("moduleSourcePath", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      return repositoryModulePath({
        filename: join(dirname(repositoryRoot), "consumer.ts"),
        importedName: "status",
        repositoryRoot,
        specifier: "./status.ts",
      });
    });

    it("names no repository source", ({ moduleSourcePath }) => {
      expect(moduleSourcePath).toBe(null);
    });
  });
});

describe("matchesConfiguredPathAlias", () => {
  describe("a configured pattern carrying no wildcard", () => {
    const it = test.extend("configuredAliasMatch", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(join(repositoryRoot, "tsconfig.json"), WILDCARD_TSCONFIG, "utf8");
      writeFileSync(join(repositoryRoot, "src/consumer.ts"), "export {};\n", "utf8");
      return matchesConfiguredPathAlias({
        filename: join(repositoryRoot, "src/consumer.ts"),
        importedName: "status",
        repositoryRoot,
        specifier: "@exact",
      });
    });

    it("claims the specifier that spells the pattern out", ({ configuredAliasMatch }) => {
      expect(configuredAliasMatch).toBe(true);
    });
  });

  describe("a configured pattern carrying one wildcard met by one segment", () => {
    const it = test.extend("configuredAliasMatch", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(join(repositoryRoot, "tsconfig.json"), WILDCARD_TSCONFIG, "utf8");
      writeFileSync(join(repositoryRoot, "src/consumer.ts"), "export {};\n", "utf8");
      return matchesConfiguredPathAlias({
        filename: join(repositoryRoot, "src/consumer.ts"),
        importedName: "status",
        repositoryRoot,
        specifier: "@one/status",
      });
    });

    it("claims the specifier the wildcard covers", ({ configuredAliasMatch }) => {
      expect(configuredAliasMatch).toBe(true);
    });
  });

  describe("a configured pattern carrying one wildcard met by several segments", () => {
    const it = test.extend("configuredAliasMatch", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(join(repositoryRoot, "tsconfig.json"), WILDCARD_TSCONFIG, "utf8");
      writeFileSync(join(repositoryRoot, "src/consumer.ts"), "export {};\n", "utf8");
      return matchesConfiguredPathAlias({
        filename: join(repositoryRoot, "src/consumer.ts"),
        importedName: "status",
        repositoryRoot,
        specifier: "@one/status/extra",
      });
    });

    it("lets the wildcard reach across the segment boundary", ({ configuredAliasMatch }) => {
      expect(configuredAliasMatch).toBe(true);
    });
  });

  describe("a configured pattern carrying two wildcards", () => {
    const it = test.extend("configuredAliasMatch", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(join(repositoryRoot, "tsconfig.json"), WILDCARD_TSCONFIG, "utf8");
      writeFileSync(join(repositoryRoot, "src/consumer.ts"), "export {};\n", "utf8");
      return matchesConfiguredPathAlias({
        filename: join(repositoryRoot, "src/consumer.ts"),
        importedName: "status",
        repositoryRoot,
        specifier: "@two/a/b",
      });
    });

    it("claims nothing, because a pattern may carry only one wildcard", ({
      configuredAliasMatch,
    }) => {
      expect(configuredAliasMatch).toBe(false);
    });
  });

  describe("a specifier meeting none of the configured patterns", () => {
    const it = test.extend("configuredAliasMatch", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(join(repositoryRoot, "tsconfig.json"), WILDCARD_TSCONFIG, "utf8");
      writeFileSync(join(repositoryRoot, "src/consumer.ts"), "export {};\n", "utf8");
      return matchesConfiguredPathAlias({
        filename: join(repositoryRoot, "src/consumer.ts"),
        importedName: "status",
        repositoryRoot,
        specifier: "@other/status",
      });
    });

    it("claims nothing", ({ configuredAliasMatch }) => {
      expect(configuredAliasMatch).toBe(false);
    });
  });

  describe("a specifier read under unparsable compiler configuration", () => {
    const it = test.extend("configuredAliasMatch", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(join(repositoryRoot, "tsconfig.json"), "{ invalid", "utf8");
      writeFileSync(join(repositoryRoot, "src/consumer.ts"), "export {};\n", "utf8");
      writeFileSync(join(repositoryRoot, "src/status.ts"), "export const status = 1;\n", "utf8");
      return matchesConfiguredPathAlias({
        filename: "src/consumer.ts",
        importedName: "status",
        repositoryRoot,
        specifier: "./status.ts",
      });
    });

    it("claims nothing, because no pattern was read", ({ configuredAliasMatch }) => {
      expect(configuredAliasMatch).toBe(false);
    });
  });
});

describe("importRouteStatus", () => {
  describe("an ignored source that git does not track", () => {
    const it = test.extend("routeStatus", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "ignored"), { recursive: true });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(join(repositoryRoot, ".gitignore"), "ignored\n", "utf8");
      writeFileSync(
        join(repositoryRoot, "ignored/status.ts"),
        "export const status = 1;\n",
        "utf8",
      );
      writeFileSync(join(repositoryRoot, "src/consumer.ts"), "export {};\n", "utf8");
      gitOutput(["init", "--quiet"], { cwd: repositoryRoot, env: process.env });
      return importRouteStatus(
        {
          filename: join(repositoryRoot, "src/consumer.ts"),
          importedName: "status",
          repositoryRoot,
          specifier: "../ignored/status.ts",
        },
        buildCatalog([], {
          sourceScope: { isIgnored: (sourcePath) => sourcePath.includes("/ignored/") },
        }),
      );
    });

    it("stands outside the repository", ({ routeStatus }) => {
      expect(routeStatus).toBe("external");
    });
  });

  describe("the same ignored source once git tracks it", () => {
    const it = test.extend("routeStatus", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "ignored"), { recursive: true });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(join(repositoryRoot, ".gitignore"), "ignored\n", "utf8");
      writeFileSync(
        join(repositoryRoot, "ignored/status.ts"),
        "export const status = 1;\n",
        "utf8",
      );
      writeFileSync(join(repositoryRoot, "src/consumer.ts"), "export {};\n", "utf8");
      gitOutput(["init", "--quiet"], { cwd: repositoryRoot, env: process.env });
      gitOutput(["add", "-f", "ignored/status.ts"], { cwd: repositoryRoot, env: process.env });
      return importRouteStatus(
        {
          filename: join(repositoryRoot, "src/consumer.ts"),
          importedName: "status",
          repositoryRoot,
          specifier: "../ignored/status.ts",
        },
        buildCatalog([]),
      );
    });

    it("counts as repository code that no catalog entry claims", ({ routeStatus }) => {
      expect(routeStatus).toBe("unregistered");
    });
  });

  describe("a registered owner reached through an ignored symbolic link", () => {
    const it = test.extend("routeStatus", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(join(repositoryRoot, ".gitignore"), "ignored\n", "utf8");
      writeFileSync(
        join(repositoryRoot, "src/order-status.ts"),
        "export const ORDER_STATUSES = [] as const;\n",
        "utf8",
      );
      writeFileSync(join(repositoryRoot, "src/schema.ts"), "export {};\n", "utf8");
      gitOutput(["init", "--quiet"], { cwd: repositoryRoot, env: process.env });
      symlinkSync("src", join(repositoryRoot, "ignored"));
      return importRouteStatus(
        {
          filename: join(repositoryRoot, "src/schema.ts"),
          importedName: "ORDER_STATUSES",
          repositoryRoot,
          specifier: "../ignored/order-status.ts",
        },
        buildCatalog([ORDER_STATUS_OWNER], {
          sourceScope: readGitSourceScope(repositoryRoot),
        }),
      );
    });

    it("stands outside the repository instead of reaching the owner", ({ routeStatus }) => {
      expect(routeStatus).toBe("external");
    });
  });

  describe("a registered owner reached through its own path", () => {
    const it = test.extend("routeStatus", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(join(repositoryRoot, ".gitignore"), "ignored\n", "utf8");
      writeFileSync(
        join(repositoryRoot, "src/order-status.ts"),
        "export const ORDER_STATUSES = [] as const;\n",
        "utf8",
      );
      writeFileSync(join(repositoryRoot, "src/schema.ts"), "export {};\n", "utf8");
      gitOutput(["init", "--quiet"], { cwd: repositoryRoot, env: process.env });
      symlinkSync("src", join(repositoryRoot, "ignored"));
      return importRouteStatus(
        {
          filename: join(repositoryRoot, "src/schema.ts"),
          importedName: "ORDER_STATUSES",
          repositoryRoot,
          specifier: "./order-status.ts",
        },
        buildCatalog([ORDER_STATUS_OWNER], {
          sourceScope: readGitSourceScope(repositoryRoot),
        }),
      );
    });

    it("reaches the catalog entry that owns the binding", ({ routeStatus }) => {
      expect(routeStatus).toBe("registered");
    });
  });

  describe("a registered owner reached through a linked dependency path", () => {
    const it = test.extend("routeStatus", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "node_modules"), { recursive: true });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "src/order-status.ts"),
        "export const ORDER_STATUSES = [] as const;\n",
        "utf8",
      );
      writeFileSync(join(repositoryRoot, "src/schema.ts"), "export {};\n", "utf8");
      symlinkSync("../src", join(repositoryRoot, "node_modules/owner"));
      return importRouteStatus(
        {
          filename: join(repositoryRoot, "src/schema.ts"),
          importedName: "ORDER_STATUSES",
          repositoryRoot,
          specifier: "../node_modules/owner/order-status.ts",
        },
        buildCatalog([ORDER_STATUS_OWNER], {
          sourceScope: { isIgnored: (sourcePath) => sourcePath.includes("/node_modules/") },
        }),
      );
    });

    it("keeps the physical owner identity behind the link", ({ routeStatus }) => {
      expect(routeStatus).toBe("registered");
    });
  });
});

describe("resolvedPublicImportEntries", () => {
  describe("a public declaration file exporting the imported runtime name", () => {
    const it = test.extend("publicOwnerEntries", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(join(repositoryRoot, "src/consumer.ts"), "export {};\n", "utf8");
      writeFileSync(
        join(repositoryRoot, "src/public.d.ts"),
        "interface Local {}\ndeclare const LOCAL: string;\nexport const STATUS: string;\n",
        "utf8",
      );
      return resolvedPublicImportEntries(
        {
          filename: "src/consumer.ts",
          importedName: "STATUS",
          repositoryRoot,
          specifier: "./public.d.ts",
        },
        [PUBLIC_DECLARATION_OWNER],
      );
    });

    it("hands back the owner the declaration file publishes", ({ publicOwnerEntries }) => {
      expect(publicOwnerEntries).toStrictEqual([PUBLIC_DECLARATION_OWNER]);
    });
  });

  describe("a public declaration file missing the imported runtime name", () => {
    const it = test.extend("publicOwnerEntries", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(join(repositoryRoot, "src/consumer.ts"), "export {};\n", "utf8");
      writeFileSync(
        join(repositoryRoot, "src/public.d.ts"),
        "interface Local {}\ndeclare const LOCAL: string;\nexport const STATUS: string;\n",
        "utf8",
      );
      return resolvedPublicImportEntries(
        {
          filename: "src/consumer.ts",
          importedName: "MISSING",
          repositoryRoot,
          specifier: "./public.d.ts",
        },
        [PUBLIC_DECLARATION_OWNER],
      );
    });

    it("hands back no owner", ({ publicOwnerEntries }) => {
      expect(publicOwnerEntries).toStrictEqual([]);
    });
  });

  describe("a specifier naming a Node builtin instead of a declaration file", () => {
    const it = test.extend("publicOwnerEntries", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(join(repositoryRoot, "src/consumer.ts"), "export {};\n", "utf8");
      writeFileSync(
        join(repositoryRoot, "src/public.d.ts"),
        "interface Local {}\ndeclare const LOCAL: string;\nexport const STATUS: string;\n",
        "utf8",
      );
      return resolvedPublicImportEntries(
        {
          filename: "src/consumer.ts",
          importedName: "STATUS",
          repositoryRoot,
          specifier: "node:fs",
        },
        [PUBLIC_DECLARATION_OWNER],
      );
    });

    it("hands back no owner", ({ publicOwnerEntries }) => {
      expect(publicOwnerEntries).toStrictEqual([]);
    });
  });

  describe("a public module re-exporting the owner binding", () => {
    const it = test.extend("publicOwnerEntries", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(join(repositoryRoot, "src/consumer.ts"), "export {};\n", "utf8");
      writeFileSync(
        join(repositoryRoot, "src/owner.ts"),
        "export const ORDER_STATUSES = [];\n",
        "utf8",
      );
      writeFileSync(
        join(repositoryRoot, "src/public.ts"),
        'export { ORDER_STATUSES } from "./owner.ts";\n',
        "utf8",
      );
      return resolvedPublicImportEntries(
        {
          filename: join(repositoryRoot, "src/consumer.ts"),
          importedName: "ORDER_STATUSES",
          repositoryRoot,
          specifier: "./public.ts",
        },
        [RE_EXPORTED_OWNER],
      );
    });

    it("hands back the owner the public module re-exports", ({ publicOwnerEntries }) => {
      expect(publicOwnerEntries).toStrictEqual([RE_EXPORTED_OWNER]);
    });
  });

  describe("an imported name the public module does not export", () => {
    const it = test.extend("publicOwnerEntries", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(join(repositoryRoot, "src/consumer.ts"), "export {};\n", "utf8");
      writeFileSync(
        join(repositoryRoot, "src/owner.ts"),
        "export const ORDER_STATUSES = [];\n",
        "utf8",
      );
      writeFileSync(
        join(repositoryRoot, "src/public.ts"),
        'export { ORDER_STATUSES } from "./owner.ts";\n',
        "utf8",
      );
      return resolvedPublicImportEntries(
        {
          filename: join(repositoryRoot, "src/consumer.ts"),
          importedName: "SHADOW",
          repositoryRoot,
          specifier: "./public.ts",
        },
        [RE_EXPORTED_OWNER],
      );
    });

    it("hands back no owner", ({ publicOwnerEntries }) => {
      expect(publicOwnerEntries).toStrictEqual([]);
    });
  });

  describe("an owner route whose resolved sources name another module", () => {
    const it = test.extend("publicOwnerEntries", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(join(repositoryRoot, "src/consumer.ts"), "export {};\n", "utf8");
      writeFileSync(
        join(repositoryRoot, "src/owner.ts"),
        "export const ORDER_STATUSES = [];\n",
        "utf8",
      );
      writeFileSync(
        join(repositoryRoot, "src/public.ts"),
        'export { ORDER_STATUSES } from "./owner.ts";\n',
        "utf8",
      );
      return resolvedPublicImportEntries(
        {
          filename: join(repositoryRoot, "src/consumer.ts"),
          importedName: "ORDER_STATUSES",
          repositoryRoot,
          specifier: "./public.ts",
        },
        [
          {
            ...RE_EXPORTED_OWNER,
            importRoutes: [
              {
                exportName: "ORDER_STATUSES",
                resolvedSourcePaths: ["src/runtime.ts"],
                specifier: "./public.ts",
              },
            ],
          },
        ],
      );
    });

    it("hands back no owner", ({ publicOwnerEntries }) => {
      expect(publicOwnerEntries).toStrictEqual([]);
    });
  });
});

describe("resolvedDirectImportEntries", () => {
  describe("a specifier naming the owner module", () => {
    const it = test.extend("directOwnerEntries", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(join(repositoryRoot, "src/consumer.ts"), "export {};\n", "utf8");
      writeFileSync(
        join(repositoryRoot, "src/owner.ts"),
        "export const ORDER_STATUSES = [];\n",
        "utf8",
      );
      writeFileSync(
        join(repositoryRoot, "src/public.ts"),
        'export { ORDER_STATUSES } from "./owner.ts";\n',
        "utf8",
      );
      return resolvedDirectImportEntries(
        {
          filename: join(repositoryRoot, "src/consumer.ts"),
          importedName: "ORDER_STATUSES",
          repositoryRoot,
          specifier: "./owner.ts",
        },
        [RE_EXPORTED_OWNER],
      );
    });

    it("hands back the owner declared in that module", ({ directOwnerEntries }) => {
      expect(directOwnerEntries).toStrictEqual([RE_EXPORTED_OWNER]);
    });
  });

  describe("a specifier naming no repository module", () => {
    const it = test.extend("directOwnerEntries", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(join(repositoryRoot, "src/consumer.ts"), "export {};\n", "utf8");
      writeFileSync(
        join(repositoryRoot, "src/owner.ts"),
        "export const ORDER_STATUSES = [];\n",
        "utf8",
      );
      writeFileSync(
        join(repositoryRoot, "src/public.ts"),
        'export { ORDER_STATUSES } from "./owner.ts";\n',
        "utf8",
      );
      return resolvedDirectImportEntries(
        {
          filename: join(repositoryRoot, "src/consumer.ts"),
          importedName: "ORDER_STATUSES",
          repositoryRoot,
          specifier: "./missing.ts",
        },
        [RE_EXPORTED_OWNER],
      );
    });

    it("hands back no owner", ({ directOwnerEntries }) => {
      expect(directOwnerEntries).toStrictEqual([]);
    });
  });
});
