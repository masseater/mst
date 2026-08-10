import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, onTestFinished, test, vi } from "vite-plus/test";

import { loadStyleClassIndex } from "./builder.ts";

const VANISHED_FILE_NAME = "vanished.css";

class MissingStyleSheetError extends Error {
  readonly code = "ENOENT";

  constructor() {
    super("the style sheet is gone");
  }
}

vi.mock(import("node:fs"), async (importOriginal) => {
  const real = await importOriginal();
  const readFileSync = ((...call: Parameters<typeof real.readFileSync>) => {
    const [path] = call;
    if (String(path).endsWith(VANISHED_FILE_NAME)) throw new MissingStyleSheetError();
    return real.readFileSync(...call);
  }) as typeof real.readFileSync;
  return { ...real, readFileSync };
});

const ORPHAN_STYLE_SHEET = ".orphan {\n  color: red;\n}\n";

describe("loadStyleClassIndex", () => {
  const repositoryWith = (files: Readonly<Record<string, string>>): string => {
    const root = mkdtempSync(join(tmpdir(), "style-classes-builder-"));
    onTestFinished(() => {
      rmSync(root, { recursive: true, force: true });
    });
    for (const [path, text] of Object.entries(files)) {
      const target = join(root, path);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, text, "utf8");
    }
    return root;
  };

  const styleSheetsWithUnusedClasses = (repositoryRoot: string): readonly string[] => [
    ...loadStyleClassIndex({ repositoryRoot }).unusedByStyleSheet.keys(),
  ];

  test("a class no script spells is listed under its style sheet", () => {
    const repositoryRoot = repositoryWith({
      "src/style.css": ORPHAN_STYLE_SHEET,
      "src/main.ts": 'import "./style.css";\n',
    });

    expect(styleSheetsWithUnusedClasses(repositoryRoot)).toStrictEqual(["src/style.css"]);
  });

  test("a class a markup file spells is left out", () => {
    const repositoryRoot = repositoryWith({
      "src/style.css": ORPHAN_STYLE_SHEET,
      "index.html": '<div class="orphan"></div>\n',
    });

    expect(styleSheetsWithUnusedClasses(repositoryRoot)).toStrictEqual([]);
  });

  test("a style sheet that vanished after the listing is left out of the index", () => {
    const repositoryRoot = repositoryWith({
      "src/style.css": ORPHAN_STYLE_SHEET,
      [`src/${VANISHED_FILE_NAME}`]: ".ghost {\n  color: red;\n}\n",
    });

    expect(styleSheetsWithUnusedClasses(repositoryRoot)).toStrictEqual(["src/style.css"]);
  });

  test("a directory that holds no file at all yields an empty index", () => {
    const repositoryRoot = repositoryWith({});

    expect(styleSheetsWithUnusedClasses(repositoryRoot)).toStrictEqual([]);
  });

  test("the index of a repository is built once and handed back on every later ask", () => {
    const repositoryRoot = repositoryWith({ "src/style.css": ORPHAN_STYLE_SHEET });

    expect(loadStyleClassIndex({ repositoryRoot })).toBe(loadStyleClassIndex({ repositoryRoot }));
  });
});
