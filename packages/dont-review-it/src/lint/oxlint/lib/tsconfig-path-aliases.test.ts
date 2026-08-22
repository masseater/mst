import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { aliasedPathsFor } from "./tsconfig-path-aliases.ts";

describe("aliasedPathsFor", () => {
  const testInAWorkspace = test.extend("workspaceRoot", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "tsconfig-path-aliases-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    return root;
  });

  describe("a specifier standing for a path a wildcard declaration spells", () => {
    const it = testInAWorkspace.extend("paths", ({ workspaceRoot }) => {
      const directory = join(workspaceRoot, "wildcard");
      mkdirSync(directory, { recursive: true });
      writeFileSync(
        join(directory, "tsconfig.json"),
        '{ "compilerOptions": { "baseUrl": ".", "paths": { "@data/*": ["./values/*"] } } }\n',
      );
      return aliasedPathsFor({
        specifier: "@data/order.assets.ts",
        fromFile: join(directory, "reader.ts"),
      });
    });

    it("is read as the path the project declares for it", ({ paths, workspaceRoot }) => {
      expect(paths).toStrictEqual([join(workspaceRoot, "wildcard", "values", "order.assets.ts")]);
    });
  });

  describe("a specifier shorter than the declaration", () => {
    const it = testInAWorkspace.extend("paths", ({ workspaceRoot }) => {
      const directory = join(workspaceRoot, "wildcard");
      mkdirSync(directory, { recursive: true });
      writeFileSync(
        join(directory, "tsconfig.json"),
        '{ "compilerOptions": { "baseUrl": ".", "paths": { "@data/*": ["./values/*"] } } }\n',
      );
      return aliasedPathsFor({ specifier: "@data", fromFile: join(directory, "reader.ts") });
    });

    it("stands for nothing", ({ paths }) => {
      expect(paths).toStrictEqual([]);
    });
  });

  describe("a specifier opening differently from the declaration", () => {
    const it = testInAWorkspace.extend("paths", ({ workspaceRoot }) => {
      const directory = join(workspaceRoot, "wildcard");
      mkdirSync(directory, { recursive: true });
      writeFileSync(
        join(directory, "tsconfig.json"),
        '{ "compilerOptions": { "baseUrl": ".", "paths": { "@data/*": ["./values/*"] } } }\n',
      );
      return aliasedPathsFor({
        specifier: "@other/order.assets.ts",
        fromFile: join(directory, "reader.ts"),
      });
    });

    it("stands for nothing", ({ paths }) => {
      expect(paths).toStrictEqual([]);
    });
  });

  describe("a declaration carrying no wildcard", () => {
    describe("the specifier it spells", () => {
      const it = testInAWorkspace.extend("paths", ({ workspaceRoot }) => {
        const directory = join(workspaceRoot, "exact");
        mkdirSync(directory, { recursive: true });
        writeFileSync(
          join(directory, "tsconfig.json"),
          '{ "compilerOptions": { "paths": { "@data/table": ["./values/table.assets.ts"] } } }\n',
        );
        return aliasedPathsFor({
          specifier: "@data/table",
          fromFile: join(directory, "reader.ts"),
        });
      });

      it("stands for exactly the path declared for it", ({ paths, workspaceRoot }) => {
        expect(paths).toStrictEqual([join(workspaceRoot, "exact", "values", "table.assets.ts")]);
      });
    });

    describe("any other specifier", () => {
      const it = testInAWorkspace.extend("paths", ({ workspaceRoot }) => {
        const directory = join(workspaceRoot, "exact");
        mkdirSync(directory, { recursive: true });
        writeFileSync(
          join(directory, "tsconfig.json"),
          '{ "compilerOptions": { "paths": { "@data/table": ["./values/table.assets.ts"] } } }\n',
        );
        return aliasedPathsFor({
          specifier: "@data/other",
          fromFile: join(directory, "reader.ts"),
        });
      });

      it("stands for nothing", ({ paths }) => {
        expect(paths).toStrictEqual([]);
      });
    });
  });

  describe("a specifier standing under two declarations, one opening longer than the other", () => {
    const it = testInAWorkspace.extend("paths", ({ workspaceRoot }) => {
      const directory = join(workspaceRoot, "layered");
      mkdirSync(directory, { recursive: true });
      writeFileSync(
        join(directory, "tsconfig.json"),
        '{ "compilerOptions": { "paths": { "@data/*": ["./shallow/*"], "@data/deep/*": ["./deep/*"] } } }\n',
      );
      return aliasedPathsFor({
        specifier: "@data/deep/order.assets.ts",
        fromFile: join(directory, "reader.ts"),
      });
    });

    it("is read through the declaration spelling the longest opening", ({
      paths,
      workspaceRoot,
    }) => {
      expect(paths).toStrictEqual([join(workspaceRoot, "layered", "deep", "order.assets.ts")]);
    });
  });

  describe("those same two declarations with the longest opening written first", () => {
    const it = testInAWorkspace.extend("paths", ({ workspaceRoot }) => {
      const directory = join(workspaceRoot, "reversed");
      mkdirSync(directory, { recursive: true });
      writeFileSync(
        join(directory, "tsconfig.json"),
        '{ "compilerOptions": { "paths": { "@data/deep/*": ["./deep/*"], "@data/*": ["./shallow/*"] } } }\n',
      );
      return aliasedPathsFor({
        specifier: "@data/deep/order.assets.ts",
        fromFile: join(directory, "reader.ts"),
      });
    });

    it("is read through the longest opening again, because the written order does not decide", ({
      paths,
      workspaceRoot,
    }) => {
      expect(paths).toStrictEqual([join(workspaceRoot, "reversed", "deep", "order.assets.ts")]);
    });
  });

  describe("a declaration spelling two wildcards", () => {
    const it = testInAWorkspace.extend("paths", ({ workspaceRoot }) => {
      const directory = join(workspaceRoot, "wild");
      mkdirSync(directory, { recursive: true });
      writeFileSync(
        join(directory, "tsconfig.json"),
        '{ "compilerOptions": { "paths": { "@data/*/*": ["./values/*"], "@data/held": "./values/held.ts" } } }\n',
      );
      return aliasedPathsFor({
        specifier: "@data/left/right",
        fromFile: join(directory, "reader.ts"),
      });
    });

    it("stands for nothing", ({ paths }) => {
      expect(paths).toStrictEqual([]);
    });
  });

  describe("a declaration holding a single path instead of a list", () => {
    const it = testInAWorkspace.extend("paths", ({ workspaceRoot }) => {
      const directory = join(workspaceRoot, "wild");
      mkdirSync(directory, { recursive: true });
      writeFileSync(
        join(directory, "tsconfig.json"),
        '{ "compilerOptions": { "paths": { "@data/*/*": ["./values/*"], "@data/held": "./values/held.ts" } } }\n',
      );
      return aliasedPathsFor({ specifier: "@data/held", fromFile: join(directory, "reader.ts") });
    });

    it("stands for nothing", ({ paths }) => {
      expect(paths).toStrictEqual([]);
    });
  });

  describe("a project naming a base directory of its own", () => {
    const it = testInAWorkspace.extend("paths", ({ workspaceRoot }) => {
      const directory = join(workspaceRoot, "based");
      mkdirSync(directory, { recursive: true });
      writeFileSync(
        join(directory, "tsconfig.json"),
        '{ "compilerOptions": { "baseUrl": "./src", "paths": { "@data/*": ["./values/*"] } } }\n',
      );
      return aliasedPathsFor({
        specifier: "@data/order.assets.ts",
        fromFile: join(directory, "reader.ts"),
      });
    });

    it("has the paths it declares read from that directory", ({ paths, workspaceRoot }) => {
      expect(paths).toStrictEqual([
        join(workspaceRoot, "based", "src", "values", "order.assets.ts"),
      ]);
    });
  });

  describe("a project that inherits its paths", () => {
    const it = testInAWorkspace.extend("paths", ({ workspaceRoot }) => {
      const directory = join(workspaceRoot, "inherited");
      mkdirSync(directory, { recursive: true });
      writeFileSync(join(directory, "tsconfig.json"), '{ "extends": ["./tsconfig.base.json"] }\n');
      writeFileSync(
        join(directory, "tsconfig.base.json"),
        '{ "compilerOptions": { "paths": { "@data/*": ["./values/*"] } } }\n',
      );
      return aliasedPathsFor({
        specifier: "@data/order.assets.ts",
        fromFile: join(directory, "reader.ts"),
      });
    });

    it("reads them from the configuration it extends", ({ paths, workspaceRoot }) => {
      expect(paths).toStrictEqual([join(workspaceRoot, "inherited", "values", "order.assets.ts")]);
    });
  });

  describe("a configuration inherited from an installed package", () => {
    const it = testInAWorkspace.extend("paths", ({ workspaceRoot }) => {
      const directory = join(workspaceRoot, "packaged");
      mkdirSync(directory, { recursive: true });
      writeFileSync(
        join(directory, "tsconfig.json"),
        '{ "extends": "@fixture/preset/tsconfig.json" }\n',
      );
      return aliasedPathsFor({
        specifier: "@data/order.assets.ts",
        fromFile: join(directory, "reader.ts"),
      });
    });

    it("carries no paths of its own", ({ paths }) => {
      expect(paths).toStrictEqual([]);
    });
  });

  describe("configurations that extend each other in a circle", () => {
    const it = testInAWorkspace.extend("paths", ({ workspaceRoot }) => {
      const directory = join(workspaceRoot, "circular");
      mkdirSync(directory, { recursive: true });
      writeFileSync(join(directory, "tsconfig.json"), '{ "extends": "./tsconfig.other.json" }\n');
      writeFileSync(join(directory, "tsconfig.other.json"), '{ "extends": "./tsconfig.json" }\n');
      return aliasedPathsFor({
        specifier: "@data/order.assets.ts",
        fromFile: join(directory, "reader.ts"),
      });
    });

    it("come to an end", ({ paths }) => {
      expect(paths).toStrictEqual([]);
    });
  });

  describe("a configuration that is not an object of settings", () => {
    const it = testInAWorkspace.extend("paths", ({ workspaceRoot }) => {
      const directory = join(workspaceRoot, "listed");
      mkdirSync(directory, { recursive: true });
      writeFileSync(join(directory, "tsconfig.json"), "[]");
      return aliasedPathsFor({
        specifier: "@data/order.assets.ts",
        fromFile: join(directory, "reader.ts"),
      });
    });

    it("declares no paths", ({ paths }) => {
      expect(paths).toStrictEqual([]);
    });
  });

  describe("a project that declares no paths at all", () => {
    const it = testInAWorkspace.extend("paths", ({ workspaceRoot }) => {
      const directory = join(workspaceRoot, "plain");
      mkdirSync(directory, { recursive: true });
      writeFileSync(
        join(directory, "tsconfig.json"),
        '{ "compilerOptions": { "strict": true } }\n',
      );
      return aliasedPathsFor({
        specifier: "@data/order.assets.ts",
        fromFile: join(directory, "reader.ts"),
      });
    });

    it("stands for nothing", ({ paths }) => {
      expect(paths).toStrictEqual([]);
    });
  });

  describe("a directory holding no configuration at all", () => {
    const it = testInAWorkspace.extend("paths", ({ workspaceRoot }) => {
      const directory = join(workspaceRoot, "bare");
      mkdirSync(directory, { recursive: true });
      return aliasedPathsFor({
        specifier: "@data/order.assets.ts",
        fromFile: join(directory, "reader.ts"),
      });
    });

    it("stands for nothing", ({ paths }) => {
      expect(paths).toStrictEqual([]);
    });
  });

  describe("a specifier naming this directory", () => {
    const it = testInAWorkspace.extend("paths", ({ workspaceRoot }) => {
      const directory = join(workspaceRoot, "wildcard");
      mkdirSync(directory, { recursive: true });
      writeFileSync(
        join(directory, "tsconfig.json"),
        '{ "compilerOptions": { "baseUrl": ".", "paths": { "@data/*": ["./values/*"] } } }\n',
      );
      return aliasedPathsFor({
        specifier: "./order.assets.ts",
        fromFile: join(directory, "reader.ts"),
      });
    });

    it("is never read as a path alias", ({ paths }) => {
      expect(paths).toStrictEqual([]);
    });
  });

  describe("a specifier naming the directory above", () => {
    const it = testInAWorkspace.extend("paths", ({ workspaceRoot }) => {
      const directory = join(workspaceRoot, "wildcard");
      mkdirSync(directory, { recursive: true });
      writeFileSync(
        join(directory, "tsconfig.json"),
        '{ "compilerOptions": { "baseUrl": ".", "paths": { "@data/*": ["./values/*"] } } }\n',
      );
      return aliasedPathsFor({
        specifier: "../order.assets.ts",
        fromFile: join(directory, "reader.ts"),
      });
    });

    it("is never read as a path alias", ({ paths }) => {
      expect(paths).toStrictEqual([]);
    });
  });

  describe("a specifier naming an absolute place", () => {
    const it = testInAWorkspace.extend("paths", ({ workspaceRoot }) => {
      const directory = join(workspaceRoot, "wildcard");
      mkdirSync(directory, { recursive: true });
      writeFileSync(
        join(directory, "tsconfig.json"),
        '{ "compilerOptions": { "baseUrl": ".", "paths": { "@data/*": ["./values/*"] } } }\n',
      );
      return aliasedPathsFor({
        specifier: join(directory, "order.assets.ts"),
        fromFile: join(directory, "reader.ts"),
      });
    });

    it("is never read as a path alias", ({ paths }) => {
      expect(paths).toStrictEqual([]);
    });
  });

  describe("a subpath specifier", () => {
    const it = testInAWorkspace.extend("paths", ({ workspaceRoot }) => {
      const directory = join(workspaceRoot, "wildcard");
      mkdirSync(directory, { recursive: true });
      writeFileSync(
        join(directory, "tsconfig.json"),
        '{ "compilerOptions": { "baseUrl": ".", "paths": { "@data/*": ["./values/*"] } } }\n',
      );
      return aliasedPathsFor({ specifier: "#data", fromFile: join(directory, "reader.ts") });
    });

    it("is never read as a path alias", ({ paths }) => {
      expect(paths).toStrictEqual([]);
    });
  });
});
