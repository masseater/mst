import { mkdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { restrictedTargetReachedBy } from "./relayed-reach.ts";

import type { RestrictedTargetEntry } from "./restricted-entries.ts";

const FIXTURE_ROOT = join(realpathSync(tmpdir()), "dont-review-it-relayed-reach");

const RETIRED_LIB: RestrictedTargetEntry = {
  module: "retired-lib",
  exports: [],
  allowedPositions: [],
  substitute: "Read the same value through the reader this package owns.",
};

describe("restrictedTargetReachedBy", () => {
  describe("a specifier that resolves to no file in the repository", () => {
    const it = test.extend("reach", () =>
      restrictedTargetReachedBy({
        specifier: "./never-written-relay.ts",
        fromFile: resolve("/repository", "reader.ts"),
        policy: { workspaceRoot: resolve("/repository"), entries: [], aliases: [] },
      }));

    it("reaches no restricted target", ({ reach }) => {
      expect(reach).toBe(null);
    });
  });

  describe("a published path the package never wrote", () => {
    const it = test.extend("reach", () =>
      restrictedTargetReachedBy({
        specifier: "@mst/dont-review-it/tsconfig/*",
        fromFile: resolve(import.meta.dirname, "relayed-reach.ts"),
        policy: {
          workspaceRoot: resolve(import.meta.dirname, "..", "..", "..", "..", "..", "..", ".."),
          entries: [],
          aliases: [],
        },
      }));

    it("reaches no restricted target", ({ reach }) => {
      expect(reach).toBe(null);
    });
  });

  describe("a local module that forwards the restricted target", () => {
    const it = test.extend("reach", ({}, { onCleanup }) => {
      const root = join(FIXTURE_ROOT, "one-relay");
      rmSync(root, { recursive: true, force: true });
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "src"), { recursive: true });
      writeFileSync(join(root, "src", "index.ts"), 'import { readFile } from "./relay.ts";\n');
      writeFileSync(join(root, "src", "relay.ts"), 'export { readFile } from "retired-lib";\n');
      return restrictedTargetReachedBy({
        specifier: "./relay.ts",
        fromFile: join(root, "src", "index.ts"),
        policy: { workspaceRoot: root, entries: [RETIRED_LIB], aliases: [] },
      });
    });

    it("is reached through it", ({ reach }) => {
      expect(reach).toStrictEqual({
        entry: RETIRED_LIB,
        target: "retired-lib",
        relays: ["src/relay.ts"],
      });
    });
  });

  describe("a target reached through two modules", () => {
    const it = test.extend("reach", ({}, { onCleanup }) => {
      const root = join(FIXTURE_ROOT, "two-relays");
      rmSync(root, { recursive: true, force: true });
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "src"), { recursive: true });
      writeFileSync(join(root, "src", "index.ts"), 'import { readFile } from "./first.ts";\n');
      writeFileSync(join(root, "src", "first.ts"), 'export * from "./second.ts";\n');
      writeFileSync(join(root, "src", "second.ts"), 'export * from "retired-lib";\n');
      return restrictedTargetReachedBy({
        specifier: "./first.ts",
        fromFile: join(root, "src", "index.ts"),
        policy: { workspaceRoot: root, entries: [RETIRED_LIB], aliases: [] },
      });
    });

    it("names every module walked through on the way", ({ reach }) => {
      expect(reach).toStrictEqual({
        entry: RETIRED_LIB,
        target: "retired-lib",
        relays: ["src/first.ts", "src/second.ts"],
      });
    });
  });

  describe("a module that forwards several modules", () => {
    const it = test.extend("reach", ({}, { onCleanup }) => {
      const root = join(FIXTURE_ROOT, "mixed-relay");
      rmSync(root, { recursive: true, force: true });
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "src"), { recursive: true });
      writeFileSync(join(root, "src", "index.ts"), 'import { readFile } from "./relay.ts";\n');
      writeFileSync(
        join(root, "src", "relay.ts"),
        'export { join } from "node:path";\nexport { readFile } from "retired-lib";\n',
      );
      return restrictedTargetReachedBy({
        specifier: "./relay.ts",
        fromFile: join(root, "src", "index.ts"),
        policy: { workspaceRoot: root, entries: [RETIRED_LIB], aliases: [] },
      });
    });

    it("has its restricted forward picked out", ({ reach }) => {
      expect(reach).toStrictEqual({
        entry: RETIRED_LIB,
        target: "retired-lib",
        relays: ["src/relay.ts"],
      });
    });
  });

  describe("an internal alias prefix", () => {
    const it = test.extend("reach", ({}, { onCleanup }) => {
      const root = join(FIXTURE_ROOT, "aliased-relay");
      rmSync(root, { recursive: true, force: true });
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "src"), { recursive: true });
      writeFileSync(join(root, "src", "index.ts"), 'import { readFile } from "~/relay.ts";\n');
      writeFileSync(join(root, "src", "relay.ts"), 'export * from "retired-lib";\n');
      return restrictedTargetReachedBy({
        specifier: "~/relay.ts",
        fromFile: join(root, "src", "index.ts"),
        policy: {
          workspaceRoot: root,
          entries: [RETIRED_LIB],
          aliases: [{ prefix: "~/", directory: "src" }],
        },
      });
    });

    it("is followed to the directory it stands for", ({ reach }) => {
      expect(reach).toStrictEqual({
        entry: RETIRED_LIB,
        target: "retired-lib",
        relays: ["src/relay.ts"],
      });
    });
  });

  describe("a module that forwards no restricted target", () => {
    const it = test.extend("reach", ({}, { onCleanup }) => {
      const root = join(FIXTURE_ROOT, "plain-relay");
      rmSync(root, { recursive: true, force: true });
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "src"), { recursive: true });
      writeFileSync(join(root, "src", "index.ts"), 'import { join } from "./relay.ts";\n');
      writeFileSync(join(root, "src", "relay.ts"), 'export { join } from "node:path";\n');
      return restrictedTargetReachedBy({
        specifier: "./relay.ts",
        fromFile: join(root, "src", "index.ts"),
        policy: { workspaceRoot: root, entries: [RETIRED_LIB], aliases: [] },
      });
    });

    it("reaches nothing", ({ reach }) => {
      expect(reach).toBe(null);
    });
  });

  describe("a module already walked through", () => {
    const it = test.extend("reach", ({}, { onCleanup }) => {
      const root = join(FIXTURE_ROOT, "cycle");
      rmSync(root, { recursive: true, force: true });
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "src"), { recursive: true });
      writeFileSync(join(root, "src", "index.ts"), 'import { readFile } from "./first.ts";\n');
      writeFileSync(join(root, "src", "first.ts"), 'export * from "./second.ts";\n');
      writeFileSync(join(root, "src", "second.ts"), 'export * from "./first.ts";\n');
      return restrictedTargetReachedBy({
        specifier: "./first.ts",
        fromFile: join(root, "src", "index.ts"),
        policy: { workspaceRoot: root, entries: [RETIRED_LIB], aliases: [] },
      });
    });

    it("stops the walk", ({ reach }) => {
      expect(reach).toBe(null);
    });
  });

  describe("a specifier that names no module in the repository", () => {
    const it = test.extend("reach", ({}, { onCleanup }) => {
      const root = join(FIXTURE_ROOT, "named-outright");
      rmSync(root, { recursive: true, force: true });
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "src"), { recursive: true });
      writeFileSync(join(root, "src", "index.ts"), 'import { readFile } from "retired-lib";\n');
      return restrictedTargetReachedBy({
        specifier: "retired-lib",
        fromFile: join(root, "src", "index.ts"),
        policy: { workspaceRoot: root, entries: [RETIRED_LIB], aliases: [] },
      });
    });

    it("reaches nothing", ({ reach }) => {
      expect(reach).toBe(null);
    });
  });

  describe("a public entry a package declares but does not carry on disk", () => {
    const it = test.extend("reach", ({}, { onCleanup }) => {
      const root = join(FIXTURE_ROOT, "unbuilt-entry");
      rmSync(root, { recursive: true, force: true });
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "src"), { recursive: true });
      mkdirSync(join(root, "packages", "relay"), { recursive: true });
      mkdirSync(join(root, "node_modules", "@fixture"), { recursive: true });
      writeFileSync(join(root, "src", "index.ts"), 'import { readFile } from "@fixture/relay";\n');
      writeFileSync(
        join(root, "packages", "relay", "package.json"),
        '{"name":"@fixture/relay","exports":{".":{"import":"./built.ts","default":"./relay.ts"}}}',
      );
      writeFileSync(join(root, "packages", "relay", "relay.ts"), 'export * from "retired-lib";\n');
      symlinkSync(
        join(root, "packages", "relay"),
        join(root, "node_modules", "@fixture", "relay"),
        "dir",
      );
      return restrictedTargetReachedBy({
        specifier: "@fixture/relay",
        fromFile: join(root, "src", "index.ts"),
        policy: { workspaceRoot: root, entries: [RETIRED_LIB], aliases: [] },
      });
    });

    it("is walked past", ({ reach }) => {
      expect(reach).toStrictEqual({
        entry: RETIRED_LIB,
        target: "retired-lib",
        relays: ["packages/relay/relay.ts"],
      });
    });
  });

  describe("a relay rewritten after it was walked once", () => {
    const it = test.extend("reach", ({}, { onCleanup }) => {
      const root = join(FIXTURE_ROOT, "remembered");
      rmSync(root, { recursive: true, force: true });
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "src"), { recursive: true });
      writeFileSync(join(root, "src", "index.ts"), 'import { readFile } from "./relay.ts";\n');
      writeFileSync(join(root, "src", "relay.ts"), 'export * from "retired-lib";\n');
      restrictedTargetReachedBy({
        specifier: "./relay.ts",
        fromFile: join(root, "src", "index.ts"),
        policy: { workspaceRoot: root, entries: [RETIRED_LIB], aliases: [] },
      });
      writeFileSync(join(root, "src", "relay.ts"), 'export { join } from "node:path";\n');
      return restrictedTargetReachedBy({
        specifier: "./relay.ts",
        fromFile: join(root, "src", "index.ts"),
        policy: { workspaceRoot: root, entries: [RETIRED_LIB], aliases: [] },
      });
    });

    it("keeps the forwards read the first time it was walked", ({ reach }) => {
      expect(reach).toStrictEqual({
        entry: RETIRED_LIB,
        target: "retired-lib",
        relays: ["src/relay.ts"],
      });
    });
  });
});
