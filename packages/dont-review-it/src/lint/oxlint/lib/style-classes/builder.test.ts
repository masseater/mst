import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test, vi } from "vite-plus/test";

import { readTextFile } from "../canonical-values/source-files.ts";
import { loadStyleClassIndex } from "./builder.ts";

vi.mock(import("../canonical-values/source-files.ts"), { spy: true });

const VANISHED_FILE_NAME = "vanished.css";

const ORPHAN_STYLE_SHEET = ".orphan {\n  color: red;\n}\n";

const ORPHAN_SITES = [{ name: "orphan", line: 1 }];

describe("loadStyleClassIndex", () => {
  describe("a class no script spells", () => {
    const it = test.extend("index", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "style-classes-builder-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(join(repositoryRoot, "src", "style.css"), ORPHAN_STYLE_SHEET, "utf8");
      writeFileSync(join(repositoryRoot, "src", "main.ts"), 'import "./style.css";\n', "utf8");
      return loadStyleClassIndex({ repositoryRoot });
    });

    it("is listed under its style sheet", ({ index }) => {
      expect(index).toStrictEqual({
        unusedByStyleSheet: new Map([["src/style.css", ORPHAN_SITES]]),
      });
    });
  });

  describe("a class a markup file spells", () => {
    const it = test.extend("index", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "style-classes-builder-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(join(repositoryRoot, "src", "style.css"), ORPHAN_STYLE_SHEET, "utf8");
      writeFileSync(join(repositoryRoot, "index.html"), '<div class="orphan"></div>\n', "utf8");
      return loadStyleClassIndex({ repositoryRoot });
    });

    it("is left out of the index", ({ index }) => {
      expect(index).toStrictEqual({ unusedByStyleSheet: new Map() });
    });
  });

  describe("a style sheet that vanished after the listing", () => {
    const it = test.extend("index", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "style-classes-builder-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(join(repositoryRoot, "src", "style.css"), ORPHAN_STYLE_SHEET, "utf8");
      writeFileSync(
        join(repositoryRoot, "src", VANISHED_FILE_NAME),
        ".ghost {\n  color: red;\n}\n",
        "utf8",
      );
      // mock-factory-exemption no-replaced-double-behaviour--let-the-replaced-module-answer -- whether a style sheet is still there when the boundary reads it is settled between the listing and the read, both of which happen inside the boundary this spec replaces
      vi.mocked(readTextFile).mockImplementation((path) =>
        path.endsWith(VANISHED_FILE_NAME) ? null : readFileSync(path, "utf8"),
      );
      return loadStyleClassIndex({ repositoryRoot });
    });

    it("is left out of the index, and the style sheets beside it stay in", ({ index }) => {
      expect(index).toStrictEqual({
        unusedByStyleSheet: new Map([["src/style.css", ORPHAN_SITES]]),
      });
    });
  });

  describe("a directory that holds no file at all", () => {
    const it = test.extend("index", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "style-classes-builder-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      return loadStyleClassIndex({ repositoryRoot });
    });

    it("yields an empty index", ({ index }) => {
      expect(index).toStrictEqual({ unusedByStyleSheet: new Map() });
    });
  });

  describe("the index of a repository asked for twice", () => {
    const it = test.extend("sameIndexOnASecondAsk", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "style-classes-builder-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(join(repositoryRoot, "src", "style.css"), ORPHAN_STYLE_SHEET, "utf8");
      return loadStyleClassIndex({ repositoryRoot }) === loadStyleClassIndex({ repositoryRoot });
    });

    it("is built once and handed back on every later ask", ({ sameIndexOnASecondAsk }) => {
      expect(sameIndexOnASecondAsk).toBe(true);
    });
  });
});
