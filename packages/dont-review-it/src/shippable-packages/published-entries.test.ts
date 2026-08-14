import { describe, expect, test } from "vite-plus/test";

import { defaultShippablePackagesConfig } from "./config.ts";
import { publishedEntriesOf, strippedTypeSource } from "./published-entries.ts";

describe("publishedEntriesOf", () => {
  describe("a manifest whose bin is a single string", () => {
    const it = test.extend("binField", () =>
      publishedEntriesOf({
        manifestValueOf: (manifestField) => (manifestField === "bin" ? "./src/cli.ts" : undefined),
        config: defaultShippablePackagesConfig,
      }));

    it("names the bin field itself as one runtime entry", ({ binField }) => {
      expect(binField).toStrictEqual([{ key: "bin", specifier: "./src/cli.ts", runtime: true }]);
    });
  });

  describe("a manifest whose bin maps command names to targets", () => {
    const it = test.extend("namedCommands", () =>
      publishedEntriesOf({
        manifestValueOf: (manifestField) =>
          manifestField === "bin" ? { spool: "./dist/spool/cli.mjs", broken: 7 } : undefined,
        config: defaultShippablePackagesConfig,
      }));

    it("keeps only the commands whose target is a path", ({ namedCommands }) => {
      expect(namedCommands).toStrictEqual([
        { key: "bin.spool", specifier: "./dist/spool/cli.mjs", runtime: true },
      ]);
    });
  });

  describe("a manifest whose bin is neither a string nor a mapping", () => {
    const it = test.extend("unreadableBin", () =>
      publishedEntriesOf({
        manifestValueOf: (manifestField) => (manifestField === "bin" ? 42 : undefined),
        config: defaultShippablePackagesConfig,
      }));

    it("yields nothing to check", ({ unreadableBin }) => {
      expect(unreadableBin).toStrictEqual([]);
    });
  });

  describe("a manifest whose exports is a single string", () => {
    const it = test.extend("exportsField", () =>
      publishedEntriesOf({
        manifestValueOf: (manifestField) =>
          manifestField === "exports" ? "./dist/index.mjs" : undefined,
        config: defaultShippablePackagesConfig,
      }));

    it("names the exports field itself as one runtime entry", ({ exportsField }) => {
      expect(exportsField).toStrictEqual([
        { key: "exports", specifier: "./dist/index.mjs", runtime: true },
      ]);
    });
  });

  describe("a manifest whose exports subpath lists fallbacks in an array", () => {
    const it = test.extend("fallbackAlternatives", () =>
      publishedEntriesOf({
        manifestValueOf: (manifestField) =>
          manifestField === "exports" ? { ".": ["./dist/index.mjs", "./src/index.ts"] } : undefined,
        config: defaultShippablePackagesConfig,
      }));

    it("carries every alternative with its position", ({ fallbackAlternatives }) => {
      expect(fallbackAlternatives).toStrictEqual([
        { key: 'exports["."][0]', specifier: "./dist/index.mjs", runtime: true },
        { key: 'exports["."][1]', specifier: "./src/index.ts", runtime: true },
      ]);
    });
  });

  describe("a manifest whose exports subpath separates types from the runtime target", () => {
    const it = test.extend("separatedConditions", () =>
      publishedEntriesOf({
        manifestValueOf: (manifestField) =>
          manifestField === "exports"
            ? { "./plugin": { types: "./src/plugin.ts", default: "./dist/plugin.mjs" } }
            : undefined,
        config: defaultShippablePackagesConfig,
      }));

    it("marks the types condition as one no runtime resolves", ({ separatedConditions }) => {
      expect(separatedConditions).toStrictEqual([
        { key: 'exports["./plugin"].types', specifier: "./src/plugin.ts", runtime: false },
        { key: 'exports["./plugin"].default', specifier: "./dist/plugin.mjs", runtime: true },
      ]);
    });
  });

  describe("a manifest whose exports holds a value no resolver reads", () => {
    const it = test.extend("unreadableSubpath", () =>
      publishedEntriesOf({
        manifestValueOf: (manifestField) =>
          manifestField === "exports" ? { ".": null } : undefined,
        config: defaultShippablePackagesConfig,
      }));

    it("yields nothing for that subpath", ({ unreadableSubpath }) => {
      expect(unreadableSubpath).toStrictEqual([]);
    });
  });

  describe("a manifest whose publishConfig replaces the bin but leaves exports alone", () => {
    const it = test.extend("publishedTargets", () =>
      publishedEntriesOf({
        manifestValueOf: (manifestField) =>
          manifestField === "publishConfig"
            ? { bin: { app: "./dist/cli.mjs" } }
            : manifestField === "bin"
              ? { app: "./src/cli.ts" }
              : manifestField === "exports"
                ? { ".": "./src/index.ts" }
                : undefined,
        config: defaultShippablePackagesConfig,
      }));

    it("reads the replacement for bin and the manifest for exports", ({ publishedTargets }) => {
      expect(publishedTargets).toStrictEqual([
        { key: "bin.app", specifier: "./dist/cli.mjs", runtime: true },
        { key: 'exports["."]', specifier: "./src/index.ts", runtime: true },
      ]);
    });
  });

  describe("a manifest whose publishConfig is not a mapping", () => {
    const it = test.extend("manifestTargets", () =>
      publishedEntriesOf({
        manifestValueOf: (manifestField) =>
          manifestField === "publishConfig"
            ? "public"
            : manifestField === "bin"
              ? "./dist/cli.mjs"
              : undefined,
        config: defaultShippablePackagesConfig,
      }));

    it("falls back to the fields the manifest declares", ({ manifestTargets }) => {
      expect(manifestTargets).toStrictEqual([
        { key: "bin", specifier: "./dist/cli.mjs", runtime: true },
      ]);
    });
  });
});

describe("strippedTypeSource", () => {
  describe("a specifier ending in a TypeScript extension", () => {
    const it = test.extend("strippedSource", () =>
      strippedTypeSource({ specifier: "./src/cli.ts", config: defaultShippablePackagesConfig }));

    it("is a path Node refuses to load from node_modules", ({ strippedSource }) => {
      expect(strippedSource).toBe(true);
    });
  });

  describe("a specifier naming a declaration file", () => {
    const it = test.extend("strippedSource", () =>
      strippedTypeSource({
        specifier: "./dist/index.d.mts",
        config: defaultShippablePackagesConfig,
      }));

    it("is not a path that has to be stripped", ({ strippedSource }) => {
      expect(strippedSource).toBe(false);
    });
  });

  describe("a specifier naming built output", () => {
    const it = test.extend("strippedSource", () =>
      strippedTypeSource({
        specifier: "./dist/index.mjs",
        config: defaultShippablePackagesConfig,
      }));

    it("is not a path that has to be stripped", ({ strippedSource }) => {
      expect(strippedSource).toBe(false);
    });
  });
});
