import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, onTestFinished, test, vi } from "vite-plus/test";

import { loadRepositoryTypeAuthorityIndex } from "./builder.ts";

const UNREADABLE_FILE_NAME = "unreadable.ts";

class MissingPathError extends Error {
  readonly code = "ENOENT";

  constructor() {
    super("the path is gone");
  }
}

vi.mock(import("node:fs"), async (importOriginal) => {
  const real = await importOriginal();
  const readFileSync = ((...call: Parameters<typeof real.readFileSync>) => {
    const [path] = call;
    if (String(path).endsWith(UNREADABLE_FILE_NAME)) throw new MissingPathError();
    return real.readFileSync(...call);
  }) as typeof real.readFileSync;
  return { ...real, readFileSync };
});

const SHAPE =
  "export type Shape = { readonly a: string; readonly b: number; readonly c: Named };\n";

describe("loadRepositoryTypeAuthorityIndex", () => {
  const repositoryWith = (files: Readonly<Record<string, string>>): string => {
    const root = mkdtempSync(join(tmpdir(), "split-type-authority-builder-"));
    onTestFinished(() => {
      rmSync(root, { recursive: true, force: true });
    });
    for (const [path, source] of Object.entries(files)) {
      const absolutePath = join(root, path);
      mkdirSync(dirname(absolutePath), { recursive: true });
      writeFileSync(absolutePath, source, "utf8");
    }
    return root;
  };

  const pathsIn = (repositoryRoot: string): readonly string[] => [
    ...loadRepositoryTypeAuthorityIndex({ repositoryRoot }).typesByPath.keys(),
  ];

  test("a source declaring an exported type is placed in the index", () => {
    expect(pathsIn(repositoryWith({ "src/a.ts": SHAPE }))).toStrictEqual(["src/a.ts"]);
  });

  test("a source declaring no exported type is left out of the index", () => {
    expect(
      pathsIn(repositoryWith({ "src/a.ts": SHAPE, "src/b.ts": "export {};\n" })),
    ).toStrictEqual(["src/a.ts"]);
  });

  test("a test file is left out of the index", () => {
    expect(pathsIn(repositoryWith({ "src/a.test.ts": SHAPE }))).toStrictEqual([]);
  });

  test("a repository holding no source at all is indexed as empty", () => {
    expect(pathsIn(repositoryWith({ "README.md": "# held\n" }))).toStrictEqual([]);
  });

  test("a source that cannot be read is left out of the index", () => {
    expect(
      pathsIn(repositoryWith({ "src/a.ts": SHAPE, [`src/${UNREADABLE_FILE_NAME}`]: SHAPE })),
    ).toStrictEqual(["src/a.ts"]);
  });

  test("a type is placed in the workspace whose manifest stands nearest to it", () => {
    const root = repositoryWith({
      "packages/order/package.json": "{}",
      "packages/order/src/a.ts": SHAPE,
    });

    expect(
      loadRepositoryTypeAuthorityIndex({ repositoryRoot: root }).typesByPath.get(
        "packages/order/src/a.ts",
      )?.[0]?.workspacePath,
    ).toBe("packages/order");
  });

  test("a type under no manifest at all belongs to the workspace at the repository root", () => {
    const repositoryRoot = repositoryWith({ "src/a.ts": SHAPE });

    expect(
      loadRepositoryTypeAuthorityIndex({ repositoryRoot }).typesByPath.get("src/a.ts")?.[0]
        ?.workspacePath,
    ).toBe("");
  });

  test("the index of a repository is built once and handed back on every later ask", () => {
    const repositoryRoot = repositoryWith({ "src/a.ts": SHAPE });

    expect(loadRepositoryTypeAuthorityIndex({ repositoryRoot })).toBe(
      loadRepositoryTypeAuthorityIndex({ repositoryRoot }),
    );
  });
});
