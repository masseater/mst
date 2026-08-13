import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { extendsOneOf, nearestTsconfigExtends } from "./nearest-tsconfig.ts";

const LIBRARY_PRESET = "dont-review-it/tsconfig/library.json";

const APP_PRESET = "dont-review-it/tsconfig/app.json";

describe("nearestTsconfigExtends", () => {
  const workspaceTest = test.extend("workspaceRoot", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "nearest-tsconfig-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    return root;
  });

  describe("a tsconfig carrying a single extends entry", () => {
    const it = workspaceTest.extend("extendsRead", ({ workspaceRoot }) => {
      const directory = join(workspaceRoot, "single");
      mkdirSync(directory, { recursive: true });
      writeFileSync(join(directory, "tsconfig.json"), '{ "extends": "./preset.json" }\n');
      return nearestTsconfigExtends(join(directory, "index.ts"));
    });

    it("reads it as a list of one beside the path it was read from", ({
      extendsRead,
      workspaceRoot,
    }) => {
      expect(extendsRead).toStrictEqual({
        tsconfigPath: join(workspaceRoot, "single", "tsconfig.json"),
        specifiers: ["./preset.json"],
      });
    });
  });

  describe("a tsconfig carrying several extends entries", () => {
    const it = workspaceTest.extend("specifiers", ({ workspaceRoot }) => {
      const directory = join(workspaceRoot, "several");
      mkdirSync(directory, { recursive: true });
      writeFileSync(
        join(directory, "tsconfig.json"),
        '{ "extends": ["./first.json", "./second.json"] }\n',
      );
      const read = nearestTsconfigExtends(join(directory, "index.ts"));
      return read === null ? null : read.specifiers;
    });

    it("keeps every entry in the order they were written", ({ specifiers }) => {
      expect(specifiers).toStrictEqual(["./first.json", "./second.json"]);
    });
  });

  describe("a tsconfig whose extends array mixes texts with other values", () => {
    const it = workspaceTest.extend("specifiers", ({ workspaceRoot }) => {
      const directory = join(workspaceRoot, "mixed");
      mkdirSync(directory, { recursive: true });
      writeFileSync(join(directory, "tsconfig.json"), '{ "extends": ["./first.json", 7, null] }\n');
      const read = nearestTsconfigExtends(join(directory, "index.ts"));
      return read === null ? null : read.specifiers;
    });

    it("drops the entries that are not strings", ({ specifiers }) => {
      expect(specifiers).toStrictEqual(["./first.json"]);
    });
  });

  describe("a tsconfig carrying comments and a trailing comma", () => {
    const it = workspaceTest.extend("specifiers", ({ workspaceRoot }) => {
      const directory = join(workspaceRoot, "jsonc");
      mkdirSync(directory, { recursive: true });
      writeFileSync(
        join(directory, "tsconfig.json"),
        '{\n  // the preset\n  "extends": "./preset.json",\n}\n',
      );
      const read = nearestTsconfigExtends(join(directory, "index.ts"));
      return read === null ? null : read.specifiers;
    });

    it("reads it all the same", ({ specifiers }) => {
      expect(specifiers).toStrictEqual(["./preset.json"]);
    });
  });

  describe("a tsconfig without an extends field", () => {
    const it = workspaceTest.extend("specifiers", ({ workspaceRoot }) => {
      const directory = join(workspaceRoot, "bare");
      mkdirSync(directory, { recursive: true });
      writeFileSync(
        join(directory, "tsconfig.json"),
        '{ "compilerOptions": { "strict": true } }\n',
      );
      const read = nearestTsconfigExtends(join(directory, "index.ts"));
      return read === null ? null : read.specifiers;
    });

    it("reports no specifier", ({ specifiers }) => {
      expect(specifiers).toStrictEqual([]);
    });
  });

  describe("a tsconfig that cannot be read as JSON", () => {
    const it = workspaceTest.extend("specifiers", ({ workspaceRoot }) => {
      const directory = join(workspaceRoot, "broken");
      mkdirSync(directory, { recursive: true });
      writeFileSync(join(directory, "tsconfig.json"), "{ not json\n");
      const read = nearestTsconfigExtends(join(directory, "index.ts"));
      return read === null ? null : read.specifiers;
    });

    it("reports no specifier", ({ specifiers }) => {
      expect(specifiers).toStrictEqual([]);
    });
  });

  describe("a source sitting deeper than the tsconfig above it", () => {
    const it = workspaceTest.extend("extendsRead", ({ workspaceRoot }) => {
      const directory = join(workspaceRoot, "nested");
      mkdirSync(join(directory, "src", "deep"), { recursive: true });
      writeFileSync(join(directory, "tsconfig.json"), '{ "extends": "./preset.json" }\n');
      return nearestTsconfigExtends(join(directory, "src", "deep", "index.ts"));
    });

    it("walks up until it meets a tsconfig", ({ extendsRead, workspaceRoot }) => {
      expect(extendsRead).toStrictEqual({
        tsconfigPath: join(workspaceRoot, "nested", "tsconfig.json"),
        specifiers: ["./preset.json"],
      });
    });
  });

  describe("a source with a tsconfig beside it and another one further up", () => {
    const it = workspaceTest.extend("specifiers", ({ workspaceRoot }) => {
      const outer = join(workspaceRoot, "outer");
      mkdirSync(join(outer, "inner"), { recursive: true });
      writeFileSync(join(outer, "tsconfig.json"), '{ "extends": "./outer.json" }\n');
      writeFileSync(join(outer, "inner", "tsconfig.json"), '{ "extends": "./inner.json" }\n');
      const read = nearestTsconfigExtends(join(outer, "inner", "index.ts"));
      return read === null ? null : read.specifiers;
    });

    it("stops at the nearest tsconfig instead of the outermost one", ({ specifiers }) => {
      expect(specifiers).toStrictEqual(["./inner.json"]);
    });
  });

  describe("a tsconfig removed after it was read once", () => {
    const it = workspaceTest.extend("specifiers", ({ workspaceRoot }) => {
      const directory = join(workspaceRoot, "remembered");
      mkdirSync(directory, { recursive: true });
      writeFileSync(join(directory, "tsconfig.json"), '{ "extends": "./preset.json" }\n');
      nearestTsconfigExtends(join(directory, "index.ts"));
      rmSync(join(directory, "tsconfig.json"));
      const read = nearestTsconfigExtends(join(directory, "index.ts"));
      return read === null ? null : read.specifiers;
    });

    it("still answers, because the reading is remembered", ({ specifiers }) => {
      expect(specifiers).toStrictEqual(["./preset.json"]);
    });
  });
});

describe("extendsOneOf", () => {
  describe("a package specifier naming an allowed preset", () => {
    const it = test.extend("verdict", () =>
      extendsOneOf(["@mst/dont-review-it/tsconfig/library.json"], [LIBRARY_PRESET]));

    it("matches it by the tail that names the preset file", ({ verdict }) => {
      expect(verdict).toBe(true);
    });
  });

  describe("a relative specifier reaching the same file", () => {
    const it = test.extend("verdict", () =>
      extendsOneOf(["../dont-review-it/tsconfig/library.json"], [LIBRARY_PRESET]));

    it("matches it", ({ verdict }) => {
      expect(verdict).toBe(true);
    });
  });

  describe("a list where only one entry names an allowed preset", () => {
    const it = test.extend("verdict", () =>
      extendsOneOf(
        ["./local.json", "@mst/dont-review-it/tsconfig/app.json"],
        [LIBRARY_PRESET, APP_PRESET],
      ));

    it("accepts it", ({ verdict }) => {
      expect(verdict).toBe(true);
    });
  });

  describe("a preset of the same name owned by somebody else", () => {
    const it = test.extend("verdict", () =>
      extendsOneOf(["@other/tsconfig/library.json"], [LIBRARY_PRESET]));

    it("rejects it", ({ verdict }) => {
      expect(verdict).toBe(false);
    });
  });

  describe("an empty list of specifiers", () => {
    const it = test.extend("verdict", () => extendsOneOf([], [LIBRARY_PRESET]));

    it("rejects it", ({ verdict }) => {
      expect(verdict).toBe(false);
    });
  });
});
