import { mkdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { aliasedPathsFor } from "./tsconfig-path-aliases.ts";

const fixtureDir = join(realpathSync(tmpdir()), "dont-review-it-tsconfig-path-aliases");
rmSync(fixtureDir, { recursive: true, force: true });

const fixturePath = (fixtureName: string): string => join(fixtureDir, fixtureName);

const writeFixture = (fixtureName: string, writtenContent: string): string => {
  const path = fixturePath(fixtureName);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, writtenContent);
  return path;
};

const writeConfig = (fixtureName: string, config: unknown): string =>
  writeFixture(fixtureName, JSON.stringify(config));

writeConfig("wildcard/tsconfig.json", {
  compilerOptions: { baseUrl: ".", paths: { "@data/*": ["./values/*"] } },
});

writeConfig("exact/tsconfig.json", {
  compilerOptions: { paths: { "@data/table": ["./values/table.assets.ts"] } },
});

writeConfig("layered/tsconfig.json", {
  compilerOptions: {
    paths: { "@data/*": ["./shallow/*"], "@data/deep/*": ["./deep/*"] },
  },
});

writeConfig("reversed/tsconfig.json", {
  compilerOptions: {
    paths: { "@data/deep/*": ["./deep/*"], "@data/*": ["./shallow/*"] },
  },
});

writeConfig("wild/tsconfig.json", {
  compilerOptions: { paths: { "@data/*/*": ["./values/*"], "@data/held": "./values/held.ts" } },
});

writeConfig("based/tsconfig.json", {
  compilerOptions: { baseUrl: "./src", paths: { "@data/*": ["./values/*"] } },
});

writeConfig("inherited/tsconfig.json", { extends: ["./tsconfig.base.json"] });
writeConfig("inherited/tsconfig.base.json", {
  compilerOptions: { paths: { "@data/*": ["./values/*"] } },
});

writeConfig("packaged/tsconfig.json", { extends: "@fixture/preset/tsconfig.json" });

writeConfig("circular/tsconfig.json", { extends: "./tsconfig.other.json" });
writeConfig("circular/tsconfig.other.json", { extends: "./tsconfig.json" });

writeFixture("listed/tsconfig.json", "[]");

writeConfig("plain/tsconfig.json", { compilerOptions: { strict: true } });

mkdirSync(fixturePath("bare"), { recursive: true });

describe("tsconfig-path-aliases", () => {
  test("a specifier standing for a path is read as the path the project declares for it", () => {
    expect(
      aliasedPathsFor({
        specifier: "@data/order.assets.ts",
        fromFile: fixturePath("wildcard/reader.ts"),
      }),
    ).toStrictEqual([fixturePath("wildcard/values/order.assets.ts")]);
  });

  test("a specifier shorter than the declaration, or opening differently, stands for nothing", () => {
    const fromFile = fixturePath("wildcard/reader.ts");
    expect(aliasedPathsFor({ specifier: "@data", fromFile })).toStrictEqual([]);
    expect(aliasedPathsFor({ specifier: "@other/order.assets.ts", fromFile })).toStrictEqual([]);
  });

  test("a declaration carrying no wildcard stands for exactly the specifier it spells", () => {
    const fromFile = fixturePath("exact/reader.ts");
    expect(aliasedPathsFor({ specifier: "@data/table", fromFile })).toStrictEqual([
      fixturePath("exact/values/table.assets.ts"),
    ]);
    expect(aliasedPathsFor({ specifier: "@data/other", fromFile })).toStrictEqual([]);
  });

  test("the declaration spelling the longest opening is the one that stands for the specifier", () => {
    expect(
      aliasedPathsFor({
        specifier: "@data/deep/order.assets.ts",
        fromFile: fixturePath("layered/reader.ts"),
      }),
    ).toStrictEqual([fixturePath("layered/deep/order.assets.ts")]);
  });

  test("the order the declarations are written in does not decide which one stands", () => {
    expect(
      aliasedPathsFor({
        specifier: "@data/deep/order.assets.ts",
        fromFile: fixturePath("reversed/reader.ts"),
      }),
    ).toStrictEqual([fixturePath("reversed/deep/order.assets.ts")]);
  });

  test("a declaration spelling two wildcards, and one holding a single path, stand for nothing", () => {
    const fromFile = fixturePath("wild/reader.ts");
    expect(aliasedPathsFor({ specifier: "@data/left/right", fromFile })).toStrictEqual([]);
    expect(aliasedPathsFor({ specifier: "@data/held", fromFile })).toStrictEqual([]);
  });

  test("the paths a project declares are read from the base directory it names", () => {
    expect(
      aliasedPathsFor({
        specifier: "@data/order.assets.ts",
        fromFile: fixturePath("based/reader.ts"),
      }),
    ).toStrictEqual([fixturePath("based/src/values/order.assets.ts")]);
  });

  test("a project that inherits its paths reads them from the configuration it extends", () => {
    expect(
      aliasedPathsFor({
        specifier: "@data/order.assets.ts",
        fromFile: fixturePath("inherited/reader.ts"),
      }),
    ).toStrictEqual([fixturePath("inherited/values/order.assets.ts")]);
  });

  test("a configuration inherited from an installed package carries no paths of its own", () => {
    expect(
      aliasedPathsFor({
        specifier: "@data/order.assets.ts",
        fromFile: fixturePath("packaged/reader.ts"),
      }),
    ).toStrictEqual([]);
  });

  test("configurations that extend each other in a circle come to an end", () => {
    expect(
      aliasedPathsFor({
        specifier: "@data/order.assets.ts",
        fromFile: fixturePath("circular/reader.ts"),
      }),
    ).toStrictEqual([]);
  });

  test("a configuration that is not an object of settings declares no paths", () => {
    expect(
      aliasedPathsFor({
        specifier: "@data/order.assets.ts",
        fromFile: fixturePath("listed/reader.ts"),
      }),
    ).toStrictEqual([]);
  });

  test("a project that declares no paths at all stands for nothing", () => {
    expect(
      aliasedPathsFor({
        specifier: "@data/order.assets.ts",
        fromFile: fixturePath("plain/reader.ts"),
      }),
    ).toStrictEqual([]);
    expect(
      aliasedPathsFor({
        specifier: "@data/order.assets.ts",
        fromFile: fixturePath("bare/reader.ts"),
      }),
    ).toStrictEqual([]);
  });

  test("a specifier that already names a place is never read as a path alias", () => {
    const fromFile = fixturePath("wildcard/reader.ts");
    expect(aliasedPathsFor({ specifier: "./order.assets.ts", fromFile })).toStrictEqual([]);
    expect(aliasedPathsFor({ specifier: "../order.assets.ts", fromFile })).toStrictEqual([]);
    expect(
      aliasedPathsFor({ specifier: fixturePath("wildcard/order.assets.ts"), fromFile }),
    ).toStrictEqual([]);
    expect(aliasedPathsFor({ specifier: "#data", fromFile })).toStrictEqual([]);
  });
});
