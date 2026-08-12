import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vite-plus/test";

import { extendsOneOf, nearestTsconfigExtends } from "./nearest-tsconfig.ts";

const fixtureDir = mkdtempSync(join(tmpdir(), "dont-review-it-nearest-tsconfig-"));

const writeWorkspaceFixture = (name: string, tsconfig: string): string => {
  const directory = join(fixtureDir, name);
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, "tsconfig.json"), tsconfig);
  return join(directory, "index.ts");
};

describe("nearestTsconfigExtends", () => {
  it("reads a single extends entry as a list of one", () => {
    const sourcePath = writeWorkspaceFixture("single", '{ "extends": "./preset.json" }\n');

    expect(nearestTsconfigExtends(sourcePath)).toStrictEqual({
      tsconfigPath: join(fixtureDir, "single", "tsconfig.json"),
      specifiers: ["./preset.json"],
    });
  });

  it("keeps every entry of an extends array in the order they were written", () => {
    const sourcePath = writeWorkspaceFixture(
      "several",
      '{ "extends": ["./first.json", "./second.json"] }\n',
    );

    expect(nearestTsconfigExtends(sourcePath)?.specifiers).toStrictEqual([
      "./first.json",
      "./second.json",
    ]);
  });

  it("drops entries of an extends array that are not strings", () => {
    const sourcePath = writeWorkspaceFixture("mixed", '{ "extends": ["./first.json", 7, null] }\n');

    expect(nearestTsconfigExtends(sourcePath)?.specifiers).toStrictEqual(["./first.json"]);
  });

  it("reads a tsconfig that carries comments and a trailing comma", () => {
    const sourcePath = writeWorkspaceFixture(
      "jsonc",
      '{\n  // the preset\n  "extends": "./preset.json",\n}\n',
    );

    expect(nearestTsconfigExtends(sourcePath)?.specifiers).toStrictEqual(["./preset.json"]);
  });

  it("reports no specifier for a tsconfig without an extends field", () => {
    const sourcePath = writeWorkspaceFixture("bare", '{ "compilerOptions": { "strict": true } }\n');

    expect(nearestTsconfigExtends(sourcePath)?.specifiers).toStrictEqual([]);
  });

  it("reports no specifier for a tsconfig that cannot be read as JSON", () => {
    const sourcePath = writeWorkspaceFixture("broken", "{ not json\n");

    expect(nearestTsconfigExtends(sourcePath)?.specifiers).toStrictEqual([]);
  });

  it("walks up until it meets a tsconfig", () => {
    writeWorkspaceFixture("nested", '{ "extends": "./preset.json" }\n');
    mkdirSync(join(fixtureDir, "nested", "src", "deep"), { recursive: true });

    expect(
      nearestTsconfigExtends(join(fixtureDir, "nested", "src", "deep", "index.ts")),
    ).toStrictEqual({
      tsconfigPath: join(fixtureDir, "nested", "tsconfig.json"),
      specifiers: ["./preset.json"],
    });
  });

  it("stops at the nearest tsconfig instead of the outermost one", () => {
    writeWorkspaceFixture("outer", '{ "extends": "./outer.json" }\n');
    const innerSourcePath = writeWorkspaceFixture(
      join("outer", "inner"),
      '{ "extends": "./inner.json" }\n',
    );

    expect(nearestTsconfigExtends(innerSourcePath)?.specifiers).toStrictEqual(["./inner.json"]);
  });

  it("remembers its answer, so a tsconfig removed afterwards still answers", () => {
    const sourcePath = writeWorkspaceFixture("remembered", '{ "extends": "./preset.json" }\n');
    expect(nearestTsconfigExtends(sourcePath)?.specifiers).toStrictEqual(["./preset.json"]);

    rmSync(join(fixtureDir, "remembered", "tsconfig.json"));

    expect(nearestTsconfigExtends(sourcePath)?.specifiers).toStrictEqual(["./preset.json"]);
  });
});

describe("extendsOneOf", () => {
  it("matches a package specifier by the tail that names the preset file", () => {
    expect(
      extendsOneOf(
        ["@mst/dont-review-it/tsconfig/library.json"],
        ["dont-review-it/tsconfig/library.json"],
      ),
    ).toBe(true);
  });

  it("matches a relative specifier that reaches the same file", () => {
    expect(
      extendsOneOf(
        ["../dont-review-it/tsconfig/library.json"],
        ["dont-review-it/tsconfig/library.json"],
      ),
    ).toBe(true);
  });

  it("accepts a list where only one entry names an allowed preset", () => {
    expect(
      extendsOneOf(
        ["./local.json", "@mst/dont-review-it/tsconfig/app.json"],
        ["dont-review-it/tsconfig/library.json", "dont-review-it/tsconfig/app.json"],
      ),
    ).toBe(true);
  });

  it("rejects a preset of the same name owned by somebody else", () => {
    expect(
      extendsOneOf(["@other/tsconfig/library.json"], ["dont-review-it/tsconfig/library.json"]),
    ).toBe(false);
  });

  it("rejects an empty list of specifiers", () => {
    expect(extendsOneOf([], ["dont-review-it/tsconfig/library.json"])).toBe(false);
  });
});
