import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { ruleSourceFilesIn } from "./rule-source-files.ts";

const WORKSPACE = { workspaceDir: "packages/example", ruleDirectories: ["src/rules"] };

describe("ruleSourceFilesIn", () => {
  describe("a declared directory that does not exist", () => {
    const it = test.extend("candidates", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "rule-source-files-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      return ruleSourceFilesIn({ repositoryRoot: root, workspace: WORKSPACE });
    });

    it("yields nothing", ({ candidates }) => {
      expect(candidates).toStrictEqual([]);
    });
  });

  describe("a declared directory holding tests, type declarations, and prose", () => {
    const it = test.extend("candidates", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "rule-source-files-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "packages/example/src/rules"), { recursive: true });
      writeFileSync(join(root, "packages/example/src/rules/keep.ts"), "", "utf8");
      writeFileSync(join(root, "packages/example/src/rules/keep.test.ts"), "", "utf8");
      writeFileSync(join(root, "packages/example/src/rules/ambient.d.ts"), "", "utf8");
      writeFileSync(join(root, "packages/example/src/rules/notes.md"), "", "utf8");
      return ruleSourceFilesIn({ repositoryRoot: root, workspace: WORKSPACE });
    });

    it("leaves the tests, the type declarations, and the prose out", ({ candidates }) => {
      expect(candidates).toStrictEqual(["src/rules/keep.ts"]);
    });
  });

  describe("a declared directory holding builds, dependencies, coverage, and shared code", () => {
    const it = test.extend("candidates", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "rule-source-files-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "packages/example/src/rules/nested"), { recursive: true });
      mkdirSync(join(root, "packages/example/src/rules/node_modules"), { recursive: true });
      mkdirSync(join(root, "packages/example/src/rules/dist"), { recursive: true });
      mkdirSync(join(root, "packages/example/src/rules/coverage"), { recursive: true });
      mkdirSync(join(root, "packages/example/src/rules/lib"), { recursive: true });
      writeFileSync(join(root, "packages/example/src/rules/nested/inner.ts"), "", "utf8");
      writeFileSync(join(root, "packages/example/src/rules/node_modules/vendored.ts"), "", "utf8");
      writeFileSync(join(root, "packages/example/src/rules/dist/built.ts"), "", "utf8");
      writeFileSync(join(root, "packages/example/src/rules/coverage/report.ts"), "", "utf8");
      writeFileSync(join(root, "packages/example/src/rules/lib/shared.ts"), "", "utf8");
      return ruleSourceFilesIn({ repositoryRoot: root, workspace: WORKSPACE });
    });

    it("walks none of those directories and keeps the plain nested one", ({ candidates }) => {
      expect(candidates).toStrictEqual(["src/rules/nested/inner.ts"]);
    });
  });

  describe("a workspace declaring more than one rule directory", () => {
    const it = test.extend("candidates", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "rule-source-files-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "packages/example/src/rules"), { recursive: true });
      mkdirSync(join(root, "packages/example/src/more-rules"), { recursive: true });
      writeFileSync(join(root, "packages/example/src/rules/zebra.ts"), "", "utf8");
      writeFileSync(join(root, "packages/example/src/rules/alpha.ts"), "", "utf8");
      writeFileSync(join(root, "packages/example/src/more-rules/extra.ts"), "", "utf8");
      return ruleSourceFilesIn({
        repositoryRoot: root,
        workspace: { ...WORKSPACE, ruleDirectories: ["src/rules", "src/more-rules"] },
      });
    });

    it("lets every declared directory contribute and comes back sorted", ({ candidates }) => {
      expect(candidates).toStrictEqual([
        "src/more-rules/extra.ts",
        "src/rules/alpha.ts",
        "src/rules/zebra.ts",
      ]);
    });
  });
});
