import { mkdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vite-plus/test";

import { restrictedTargetReachedBy, type RestrictedReach } from "./relayed-reach.ts";

import type { InternalAlias, RestrictedTargetEntry } from "./restricted-entries.ts";

const fixtureDir = join(realpathSync(tmpdir()), "dont-review-it-relayed-reach");
rmSync(fixtureDir, { recursive: true, force: true });

const RETIRED_LIB: RestrictedTargetEntry = {
  module: "retired-lib",
  exports: [],
  allowedPositions: [],
  substitute: "Read the same value through the reader this package owns.",
};

const workspaceHolding = (name: string, held: Readonly<Record<string, string>>): string => {
  const root = join(fixtureDir, name);
  for (const [spelled, source] of Object.entries(held)) {
    const path = join(root, spelled);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, source);
  }
  return root;
};

const reachedFrom = ({
  workspaceRoot,
  specifier,
  aliases = [],
}: {
  readonly workspaceRoot: string;
  readonly specifier: string;
  readonly aliases?: readonly InternalAlias[];
}): RestrictedReach | null =>
  restrictedTargetReachedBy({
    specifier,
    fromFile: join(workspaceRoot, "src", "index.ts"),
    policy: { workspaceRoot, entries: [RETIRED_LIB], aliases },
  });

const installedUnder = ({
  workspaceRoot,
  name,
  directory,
}: {
  readonly workspaceRoot: string;
  readonly name: string;
  readonly directory: string;
}): void => {
  const link = join(workspaceRoot, "node_modules", name);
  mkdirSync(dirname(link), { recursive: true });
  symlinkSync(join(workspaceRoot, directory), link, "dir");
};

describe("restrictedTargetReachedBy", () => {
  it("reaches the restricted target a local module forwards", () => {
    const root = workspaceHolding("one-relay", {
      "src/index.ts": 'import { readFile } from "./relay.ts";\n',
      "src/relay.ts": 'export { readFile } from "retired-lib";\n',
    });

    expect(reachedFrom({ workspaceRoot: root, specifier: "./relay.ts" })).toStrictEqual({
      entry: RETIRED_LIB,
      target: "retired-lib",
      relays: ["src/relay.ts"],
    });
  });

  it("names every module it walked through on the way to the target", () => {
    const root = workspaceHolding("two-relays", {
      "src/index.ts": 'import { readFile } from "./first.ts";\n',
      "src/first.ts": 'export * from "./second.ts";\n',
      "src/second.ts": 'export * from "retired-lib";\n',
    });

    expect(reachedFrom({ workspaceRoot: root, specifier: "./first.ts" })).toStrictEqual({
      entry: RETIRED_LIB,
      target: "retired-lib",
      relays: ["src/first.ts", "src/second.ts"],
    });
  });

  it("picks the restricted forward out of a module that forwards several modules", () => {
    const root = workspaceHolding("mixed-relay", {
      "src/index.ts": 'import { readFile } from "./relay.ts";\n',
      "src/relay.ts":
        'export { join } from "node:path";\nexport { readFile } from "retired-lib";\n',
    });

    expect(reachedFrom({ workspaceRoot: root, specifier: "./relay.ts" })).toStrictEqual({
      entry: RETIRED_LIB,
      target: "retired-lib",
      relays: ["src/relay.ts"],
    });
  });

  it("follows an internal alias prefix to the directory it stands for", () => {
    const root = workspaceHolding("aliased-relay", {
      "src/index.ts": 'import { readFile } from "~/relay.ts";\n',
      "src/relay.ts": 'export * from "retired-lib";\n',
    });

    expect(
      reachedFrom({
        workspaceRoot: root,
        specifier: "~/relay.ts",
        aliases: [{ prefix: "~/", directory: "src" }],
      }),
    ).toStrictEqual({ entry: RETIRED_LIB, target: "retired-lib", relays: ["src/relay.ts"] });
  });

  it("reaches nothing through a module that forwards no restricted target", () => {
    const root = workspaceHolding("plain-relay", {
      "src/index.ts": 'import { join } from "./relay.ts";\n',
      "src/relay.ts": 'export { join } from "node:path";\n',
    });

    expect(reachedFrom({ workspaceRoot: root, specifier: "./relay.ts" })).toBeNull();
  });

  it("stops at a module it has already walked through", () => {
    const root = workspaceHolding("cycle", {
      "src/index.ts": 'import { readFile } from "./first.ts";\n',
      "src/first.ts": 'export * from "./second.ts";\n',
      "src/second.ts": 'export * from "./first.ts";\n',
    });

    expect(reachedFrom({ workspaceRoot: root, specifier: "./first.ts" })).toBeNull();
  });

  it("reaches nothing through a specifier that names no module in the repository", () => {
    const root = workspaceHolding("named-outright", {
      "src/index.ts": 'import { readFile } from "retired-lib";\n',
    });

    expect(reachedFrom({ workspaceRoot: root, specifier: "retired-lib" })).toBeNull();
  });

  it("walks past a public entry a package declares but does not carry on disk", () => {
    const root = workspaceHolding("unbuilt-entry", {
      "src/index.ts": 'import { readFile } from "@fixture/relay";\n',
      "packages/relay/package.json":
        '{"name":"@fixture/relay","exports":{".":{"import":"./built.ts","default":"./relay.ts"}}}',
      "packages/relay/relay.ts": 'export * from "retired-lib";\n',
    });
    installedUnder({ workspaceRoot: root, name: "@fixture/relay", directory: "packages/relay" });

    expect(reachedFrom({ workspaceRoot: root, specifier: "@fixture/relay" })).toStrictEqual({
      entry: RETIRED_LIB,
      target: "retired-lib",
      relays: ["packages/relay/relay.ts"],
    });
  });

  it("stands by the forwards it read the first time it walked a module", () => {
    const root = workspaceHolding("remembered", {
      "src/index.ts": 'import { readFile } from "./relay.ts";\n',
      "src/relay.ts": 'export * from "retired-lib";\n',
    });
    expect(reachedFrom({ workspaceRoot: root, specifier: "./relay.ts" })).toStrictEqual({
      entry: RETIRED_LIB,
      target: "retired-lib",
      relays: ["src/relay.ts"],
    });

    writeFileSync(join(root, "src", "relay.ts"), 'export { join } from "node:path";\n');

    expect(reachedFrom({ workspaceRoot: root, specifier: "./relay.ts" })).toStrictEqual({
      entry: RETIRED_LIB,
      target: "retired-lib",
      relays: ["src/relay.ts"],
    });
  });
});
