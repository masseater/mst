import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { dependencyTypeEntries } from "./dependency-types.ts";

const FIXTURE_ROOT = join(tmpdir(), "dont-review-it-dependency-types");

describe("dependencyTypeEntries", () => {
  describe("a dependency that names its declarations through its export map", () => {
    const it = test.extend("entries", ({}, { onCleanup }) => {
      const packageDirectory = join(FIXTURE_ROOT, "export-map");
      rmSync(packageDirectory, { recursive: true, force: true });
      onCleanup(() => {
        rmSync(packageDirectory, { recursive: true, force: true });
      });
      mkdirSync(join(packageDirectory, "node_modules", "oxlint", "dist"), { recursive: true });
      writeFileSync(
        join(packageDirectory, "package.json"),
        JSON.stringify({ dependencies: { oxlint: "1.76.0" } }),
        "utf8",
      );
      writeFileSync(
        join(packageDirectory, "node_modules", "oxlint", "package.json"),
        JSON.stringify({
          exports: { ".": { types: "./dist/index.d.ts", default: "./dist/index.js" } },
        }),
        "utf8",
      );
      writeFileSync(
        join(packageDirectory, "node_modules", "oxlint", "dist", "index.d.ts"),
        "export {};\n",
        "utf8",
      );
      return dependencyTypeEntries(packageDirectory);
    });

    it("becomes an entry", ({ entries }) => {
      expect(entries).toStrictEqual([
        {
          packageName: "oxlint",
          declarationsPath: join(
            FIXTURE_ROOT,
            "export-map",
            "node_modules",
            "oxlint",
            "dist",
            "index.d.ts",
          ),
        },
      ]);
    });
  });

  describe("an export map spelled as one path", () => {
    const it = test.extend("entries", ({}, { onCleanup }) => {
      const packageDirectory = join(FIXTURE_ROOT, "export-map-as-one-path");
      rmSync(packageDirectory, { recursive: true, force: true });
      onCleanup(() => {
        rmSync(packageDirectory, { recursive: true, force: true });
      });
      mkdirSync(join(packageDirectory, "node_modules", "oxlint"), { recursive: true });
      writeFileSync(
        join(packageDirectory, "package.json"),
        JSON.stringify({ dependencies: { oxlint: "1.76.0" } }),
        "utf8",
      );
      writeFileSync(
        join(packageDirectory, "node_modules", "oxlint", "package.json"),
        JSON.stringify({ exports: "./index.d.ts" }),
        "utf8",
      );
      writeFileSync(
        join(packageDirectory, "node_modules", "oxlint", "index.d.ts"),
        "export {};\n",
        "utf8",
      );
      return dependencyTypeEntries(packageDirectory);
    });

    it("is read as that path", ({ entries }) => {
      expect(entries).toStrictEqual([
        {
          packageName: "oxlint",
          declarationsPath: join(
            FIXTURE_ROOT,
            "export-map-as-one-path",
            "node_modules",
            "oxlint",
            "index.d.ts",
          ),
        },
      ]);
    });
  });

  describe("an export map that names only subpaths", () => {
    const it = test.extend("entries", ({}, { onCleanup }) => {
      const packageDirectory = join(FIXTURE_ROOT, "export-map-of-subpaths");
      rmSync(packageDirectory, { recursive: true, force: true });
      onCleanup(() => {
        rmSync(packageDirectory, { recursive: true, force: true });
      });
      mkdirSync(join(packageDirectory, "node_modules", "oxlint"), { recursive: true });
      writeFileSync(
        join(packageDirectory, "package.json"),
        JSON.stringify({ dependencies: { oxlint: "1.76.0" } }),
        "utf8",
      );
      writeFileSync(
        join(packageDirectory, "node_modules", "oxlint", "package.json"),
        JSON.stringify({ exports: { "./plugins": "./plugins.d.ts" }, types: "./index.d.ts" }),
        "utf8",
      );
      writeFileSync(
        join(packageDirectory, "node_modules", "oxlint", "index.d.ts"),
        "export {};\n",
        "utf8",
      );
      return dependencyTypeEntries(packageDirectory);
    });

    it("hands back no root entry, so the declared types field decides", ({ entries }) => {
      expect(entries).toStrictEqual([
        {
          packageName: "oxlint",
          declarationsPath: join(
            FIXTURE_ROOT,
            "export-map-of-subpaths",
            "node_modules",
            "oxlint",
            "index.d.ts",
          ),
        },
      ]);
    });
  });

  describe("an export map holding conditions that name nothing", () => {
    const it = test.extend("entries", ({}, { onCleanup }) => {
      const packageDirectory = join(FIXTURE_ROOT, "export-map-of-empty-conditions");
      rmSync(packageDirectory, { recursive: true, force: true });
      onCleanup(() => {
        rmSync(packageDirectory, { recursive: true, force: true });
      });
      mkdirSync(join(packageDirectory, "node_modules", "oxlint"), { recursive: true });
      writeFileSync(
        join(packageDirectory, "package.json"),
        JSON.stringify({ dependencies: { oxlint: "1.76.0" } }),
        "utf8",
      );
      writeFileSync(
        join(packageDirectory, "node_modules", "oxlint", "package.json"),
        JSON.stringify({ exports: { ".": { node: { import: {} } } }, types: "./index.d.ts" }),
        "utf8",
      );
      writeFileSync(
        join(packageDirectory, "node_modules", "oxlint", "index.d.ts"),
        "export {};\n",
        "utf8",
      );
      return dependencyTypeEntries(packageDirectory);
    });

    it("hands back no entry, so the declared types field decides", ({ entries }) => {
      expect(entries).toStrictEqual([
        {
          packageName: "oxlint",
          declarationsPath: join(
            FIXTURE_ROOT,
            "export-map-of-empty-conditions",
            "node_modules",
            "oxlint",
            "index.d.ts",
          ),
        },
      ]);
    });
  });

  describe("an entry path that carries no suffix", () => {
    const it = test.extend("entries", ({}, { onCleanup }) => {
      const packageDirectory = join(FIXTURE_ROOT, "entry-path-without-a-suffix");
      rmSync(packageDirectory, { recursive: true, force: true });
      onCleanup(() => {
        rmSync(packageDirectory, { recursive: true, force: true });
      });
      mkdirSync(join(packageDirectory, "node_modules", "oxlint"), { recursive: true });
      writeFileSync(
        join(packageDirectory, "package.json"),
        JSON.stringify({ dependencies: { oxlint: "1.76.0" } }),
        "utf8",
      );
      writeFileSync(
        join(packageDirectory, "node_modules", "oxlint", "package.json"),
        JSON.stringify({ exports: { ".": { default: "./index" } }, types: "./index.d.ts" }),
        "utf8",
      );
      writeFileSync(
        join(packageDirectory, "node_modules", "oxlint", "index.d.ts"),
        "export {};\n",
        "utf8",
      );
      return dependencyTypeEntries(packageDirectory);
    });

    it("names no declarations, so the declared types field decides", ({ entries }) => {
      expect(entries).toStrictEqual([
        {
          packageName: "oxlint",
          declarationsPath: join(
            FIXTURE_ROOT,
            "entry-path-without-a-suffix",
            "node_modules",
            "oxlint",
            "index.d.ts",
          ),
        },
      ]);
    });
  });

  describe("a dependency declared for development", () => {
    const it = test.extend("entries", ({}, { onCleanup }) => {
      const packageDirectory = join(FIXTURE_ROOT, "development-dependency");
      rmSync(packageDirectory, { recursive: true, force: true });
      onCleanup(() => {
        rmSync(packageDirectory, { recursive: true, force: true });
      });
      mkdirSync(join(packageDirectory, "node_modules", "vite", "dist", "node"), {
        recursive: true,
      });
      writeFileSync(
        join(packageDirectory, "package.json"),
        JSON.stringify({ devDependencies: { vite: "8.0.0" } }),
        "utf8",
      );
      writeFileSync(
        join(packageDirectory, "node_modules", "vite", "package.json"),
        JSON.stringify({ types: "./dist/node/index.d.ts" }),
        "utf8",
      );
      writeFileSync(
        join(packageDirectory, "node_modules", "vite", "dist", "node", "index.d.ts"),
        "export {};\n",
        "utf8",
      );
      return dependencyTypeEntries(packageDirectory);
    });

    it("is reachable the same way", ({ entries }) => {
      expect(entries).toStrictEqual([
        {
          packageName: "vite",
          declarationsPath: join(
            FIXTURE_ROOT,
            "development-dependency",
            "node_modules",
            "vite",
            "dist",
            "node",
            "index.d.ts",
          ),
        },
      ]);
    });
  });

  describe("a dependency declared as a peer", () => {
    const it = test.extend("entries", ({}, { onCleanup }) => {
      const packageDirectory = join(FIXTURE_ROOT, "peer-dependency");
      rmSync(packageDirectory, { recursive: true, force: true });
      onCleanup(() => {
        rmSync(packageDirectory, { recursive: true, force: true });
      });
      mkdirSync(join(packageDirectory, "node_modules", "oxlint"), { recursive: true });
      writeFileSync(
        join(packageDirectory, "package.json"),
        JSON.stringify({ peerDependencies: { oxlint: "*" } }),
        "utf8",
      );
      writeFileSync(
        join(packageDirectory, "node_modules", "oxlint", "package.json"),
        JSON.stringify({ typings: "./index.d.ts" }),
        "utf8",
      );
      writeFileSync(
        join(packageDirectory, "node_modules", "oxlint", "index.d.ts"),
        "export {};\n",
        "utf8",
      );
      return dependencyTypeEntries(packageDirectory);
    });

    it("is reachable the same way", ({ entries }) => {
      expect(entries).toStrictEqual([
        {
          packageName: "oxlint",
          declarationsPath: join(
            FIXTURE_ROOT,
            "peer-dependency",
            "node_modules",
            "oxlint",
            "index.d.ts",
          ),
        },
      ]);
    });
  });

  describe("a dependency inside this repository", () => {
    const it = test.extend("entries", ({}, { onCleanup }) => {
      const packageDirectory = join(FIXTURE_ROOT, "repository-dependency");
      rmSync(packageDirectory, { recursive: true, force: true });
      onCleanup(() => {
        rmSync(packageDirectory, { recursive: true, force: true });
      });
      mkdirSync(join(packageDirectory, "node_modules", "@mst", "lint-rule-authoring", "src"), {
        recursive: true,
      });
      mkdirSync(join(packageDirectory, "node_modules", "oxlint"), { recursive: true });
      writeFileSync(
        join(packageDirectory, "package.json"),
        JSON.stringify({
          dependencies: { "@mst/lint-rule-authoring": "workspace:*", oxlint: "1.76.0" },
        }),
        "utf8",
      );
      writeFileSync(
        join(packageDirectory, "node_modules", "@mst", "lint-rule-authoring", "package.json"),
        JSON.stringify({ exports: { ".": "./src/index.ts" } }),
        "utf8",
      );
      writeFileSync(
        join(packageDirectory, "node_modules", "@mst", "lint-rule-authoring", "src", "index.ts"),
        "export {};\n",
        "utf8",
      );
      writeFileSync(
        join(packageDirectory, "node_modules", "oxlint", "package.json"),
        JSON.stringify({ types: "./index.d.ts" }),
        "utf8",
      );
      writeFileSync(
        join(packageDirectory, "node_modules", "oxlint", "index.d.ts"),
        "export {};\n",
        "utf8",
      );
      return dependencyTypeEntries(packageDirectory);
    });

    it("is left to the repository catalog", ({ entries }) => {
      expect(entries).toStrictEqual([
        {
          packageName: "oxlint",
          declarationsPath: join(
            FIXTURE_ROOT,
            "repository-dependency",
            "node_modules",
            "oxlint",
            "index.d.ts",
          ),
        },
      ]);
    });
  });

  describe("a types condition nested under another condition", () => {
    const it = test.extend("entries", ({}, { onCleanup }) => {
      const packageDirectory = join(FIXTURE_ROOT, "nested-types-condition");
      rmSync(packageDirectory, { recursive: true, force: true });
      onCleanup(() => {
        rmSync(packageDirectory, { recursive: true, force: true });
      });
      mkdirSync(join(packageDirectory, "node_modules", "nested"), { recursive: true });
      writeFileSync(
        join(packageDirectory, "package.json"),
        JSON.stringify({ dependencies: { nested: "1.0.0" } }),
        "utf8",
      );
      writeFileSync(
        join(packageDirectory, "node_modules", "nested", "package.json"),
        JSON.stringify({
          exports: { ".": { import: { types: "./index.d.mts", default: "./index.mjs" } } },
        }),
        "utf8",
      );
      writeFileSync(
        join(packageDirectory, "node_modules", "nested", "index.d.mts"),
        "export {};\n",
        "utf8",
      );
      return dependencyTypeEntries(packageDirectory);
    });

    it("is still found", ({ entries }) => {
      expect(entries).toStrictEqual([
        {
          packageName: "nested",
          declarationsPath: join(
            FIXTURE_ROOT,
            "nested-types-condition",
            "node_modules",
            "nested",
            "index.d.mts",
          ),
        },
      ]);
    });
  });

  describe("an export map that names conditions without a subpath", () => {
    const it = test.extend("entries", ({}, { onCleanup }) => {
      const packageDirectory = join(FIXTURE_ROOT, "conditions-without-a-subpath");
      rmSync(packageDirectory, { recursive: true, force: true });
      onCleanup(() => {
        rmSync(packageDirectory, { recursive: true, force: true });
      });
      mkdirSync(join(packageDirectory, "node_modules", "rootonly"), { recursive: true });
      writeFileSync(
        join(packageDirectory, "package.json"),
        JSON.stringify({ dependencies: { rootonly: "1.0.0" } }),
        "utf8",
      );
      writeFileSync(
        join(packageDirectory, "node_modules", "rootonly", "package.json"),
        JSON.stringify({ exports: { types: "./index.d.ts", default: "./index.js" } }),
        "utf8",
      );
      writeFileSync(
        join(packageDirectory, "node_modules", "rootonly", "index.d.ts"),
        "export {};\n",
        "utf8",
      );
      return dependencyTypeEntries(packageDirectory);
    });

    it("is read as the root entry", ({ entries }) => {
      expect(entries).toStrictEqual([
        {
          packageName: "rootonly",
          declarationsPath: join(
            FIXTURE_ROOT,
            "conditions-without-a-subpath",
            "node_modules",
            "rootonly",
            "index.d.ts",
          ),
        },
      ]);
    });
  });

  describe("a package that only names its runtime entry", () => {
    const it = test.extend("entries", ({}, { onCleanup }) => {
      const packageDirectory = join(FIXTURE_ROOT, "runtime-entry-beside-declarations");
      rmSync(packageDirectory, { recursive: true, force: true });
      onCleanup(() => {
        rmSync(packageDirectory, { recursive: true, force: true });
      });
      mkdirSync(join(packageDirectory, "node_modules", "runtimeonly", "dist"), {
        recursive: true,
      });
      writeFileSync(
        join(packageDirectory, "package.json"),
        JSON.stringify({ dependencies: { runtimeonly: "1.0.0" } }),
        "utf8",
      );
      writeFileSync(
        join(packageDirectory, "node_modules", "runtimeonly", "package.json"),
        JSON.stringify({ main: "./dist/index.js" }),
        "utf8",
      );
      writeFileSync(
        join(packageDirectory, "node_modules", "runtimeonly", "dist", "index.d.ts"),
        "export {};\n",
        "utf8",
      );
      return dependencyTypeEntries(packageDirectory);
    });

    it("points at the declarations beside it", ({ entries }) => {
      expect(entries).toStrictEqual([
        {
          packageName: "runtimeonly",
          declarationsPath: join(
            FIXTURE_ROOT,
            "runtime-entry-beside-declarations",
            "node_modules",
            "runtimeonly",
            "dist",
            "index.d.ts",
          ),
        },
      ]);
    });
  });

  describe("a package that ships no type declarations", () => {
    const it = test.extend("entries", ({}, { onCleanup }) => {
      const packageDirectory = join(FIXTURE_ROOT, "runtime-entry-without-declarations");
      rmSync(packageDirectory, { recursive: true, force: true });
      onCleanup(() => {
        rmSync(packageDirectory, { recursive: true, force: true });
      });
      mkdirSync(join(packageDirectory, "node_modules", "runtimeonly", "dist"), {
        recursive: true,
      });
      writeFileSync(
        join(packageDirectory, "package.json"),
        JSON.stringify({ dependencies: { runtimeonly: "1.0.0" } }),
        "utf8",
      );
      writeFileSync(
        join(packageDirectory, "node_modules", "runtimeonly", "package.json"),
        JSON.stringify({ main: "./dist/index.js" }),
        "utf8",
      );
      writeFileSync(
        join(packageDirectory, "node_modules", "runtimeonly", "dist", "index.js"),
        "export {};\n",
        "utf8",
      );
      return dependencyTypeEntries(packageDirectory);
    });

    it("is left out", ({ entries }) => {
      expect(entries).toStrictEqual([]);
    });
  });

  describe("a dependency missing from the checkout", () => {
    const it = test.extend("entries", ({}, { onCleanup }) => {
      const packageDirectory = join(FIXTURE_ROOT, "pruned-dependency");
      rmSync(packageDirectory, { recursive: true, force: true });
      onCleanup(() => {
        rmSync(packageDirectory, { recursive: true, force: true });
      });
      mkdirSync(join(packageDirectory, "node_modules", "oxlint"), { recursive: true });
      writeFileSync(
        join(packageDirectory, "package.json"),
        JSON.stringify({ dependencies: { oxlint: "1.76.0", pruned: "1.0.0" } }),
        "utf8",
      );
      writeFileSync(
        join(packageDirectory, "node_modules", "oxlint", "package.json"),
        JSON.stringify({ types: "./index.d.ts" }),
        "utf8",
      );
      writeFileSync(
        join(packageDirectory, "node_modules", "oxlint", "index.d.ts"),
        "export {};\n",
        "utf8",
      );
      return dependencyTypeEntries(packageDirectory);
    });

    it("costs only that dependency", ({ entries }) => {
      expect(entries).toStrictEqual([
        {
          packageName: "oxlint",
          declarationsPath: join(
            FIXTURE_ROOT,
            "pruned-dependency",
            "node_modules",
            "oxlint",
            "index.d.ts",
          ),
        },
      ]);
    });
  });

  describe("three dependencies installed out of order", () => {
    const it = test.extend("entries", ({}, { onCleanup }) => {
      const packageDirectory = join(FIXTURE_ROOT, "three-dependencies");
      rmSync(packageDirectory, { recursive: true, force: true });
      onCleanup(() => {
        rmSync(packageDirectory, { recursive: true, force: true });
      });
      mkdirSync(join(packageDirectory, "node_modules", "oxlint"), { recursive: true });
      mkdirSync(join(packageDirectory, "node_modules", "@oxlint", "plugins"), { recursive: true });
      mkdirSync(join(packageDirectory, "node_modules", "vite"), { recursive: true });
      writeFileSync(
        join(packageDirectory, "package.json"),
        JSON.stringify({
          dependencies: { oxlint: "1.76.0" },
          devDependencies: { "@oxlint/plugins": "1.76.0", vite: "8.0.0" },
        }),
        "utf8",
      );
      writeFileSync(
        join(packageDirectory, "node_modules", "oxlint", "package.json"),
        JSON.stringify({ types: "./index.d.ts" }),
        "utf8",
      );
      writeFileSync(
        join(packageDirectory, "node_modules", "oxlint", "index.d.ts"),
        "export {};\n",
        "utf8",
      );
      writeFileSync(
        join(packageDirectory, "node_modules", "@oxlint", "plugins", "package.json"),
        JSON.stringify({ types: "./index.d.ts" }),
        "utf8",
      );
      writeFileSync(
        join(packageDirectory, "node_modules", "@oxlint", "plugins", "index.d.ts"),
        "export {};\n",
        "utf8",
      );
      writeFileSync(
        join(packageDirectory, "node_modules", "vite", "package.json"),
        JSON.stringify({ types: "./index.d.ts" }),
        "utf8",
      );
      writeFileSync(
        join(packageDirectory, "node_modules", "vite", "index.d.ts"),
        "export {};\n",
        "utf8",
      );
      return dependencyTypeEntries(packageDirectory);
    });

    it("come back sorted by package name", ({ entries }) => {
      expect(entries).toStrictEqual([
        {
          packageName: "@oxlint/plugins",
          declarationsPath: join(
            FIXTURE_ROOT,
            "three-dependencies",
            "node_modules",
            "@oxlint",
            "plugins",
            "index.d.ts",
          ),
        },
        {
          packageName: "oxlint",
          declarationsPath: join(
            FIXTURE_ROOT,
            "three-dependencies",
            "node_modules",
            "oxlint",
            "index.d.ts",
          ),
        },
        {
          packageName: "vite",
          declarationsPath: join(
            FIXTURE_ROOT,
            "three-dependencies",
            "node_modules",
            "vite",
            "index.d.ts",
          ),
        },
      ]);
    });
  });

  describe("a package that declares no dependencies", () => {
    const it = test.extend("entries", ({}, { onCleanup }) => {
      const packageDirectory = join(FIXTURE_ROOT, "no-dependencies");
      rmSync(packageDirectory, { recursive: true, force: true });
      onCleanup(() => {
        rmSync(packageDirectory, { recursive: true, force: true });
      });
      mkdirSync(packageDirectory, { recursive: true });
      writeFileSync(
        join(packageDirectory, "package.json"),
        JSON.stringify({ name: "alone" }),
        "utf8",
      );
      return dependencyTypeEntries(packageDirectory);
    });

    it("has nothing to offer", ({ entries }) => {
      expect(entries).toStrictEqual([]);
    });
  });

  describe("a directory that holds no manifest", () => {
    const it = test.extend("entries", ({}, { onCleanup }) => {
      const packageDirectory = join(FIXTURE_ROOT, "no-manifest");
      rmSync(packageDirectory, { recursive: true, force: true });
      onCleanup(() => {
        rmSync(packageDirectory, { recursive: true, force: true });
      });
      mkdirSync(packageDirectory, { recursive: true });
      writeFileSync(
        join(packageDirectory, "package.json"),
        JSON.stringify({ name: "alone" }),
        "utf8",
      );
      return dependencyTypeEntries(join(packageDirectory, "src"));
    });

    it("has nothing to offer", ({ entries }) => {
      expect(entries).toStrictEqual([]);
    });
  });
});
