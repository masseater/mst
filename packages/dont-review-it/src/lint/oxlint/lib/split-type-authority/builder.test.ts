import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, onTestFinished, test, vi } from "vite-plus/test";

import {
  buildRepositoryTypeAuthorityIndex,
  loadRepositoryTypeAuthorityIndex,
  workspacePathOf,
} from "./builder.ts";

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

describe("buildRepositoryTypeAuthorityIndex", () => {
  const repositoryWith = (files: Readonly<Record<string, string>>): string => {
    const root = mkdtempSync(join(tmpdir(), "split-type-authority-builder-"));
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

  const pathsIn = (repositoryRoot: string): readonly string[] => [
    ...buildRepositoryTypeAuthorityIndex({ repositoryRoot }).typesByPath.keys(),
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
      buildRepositoryTypeAuthorityIndex({ repositoryRoot: root }).typesByPath.get(
        "packages/order/src/a.ts",
      )?.[0]?.workspacePath,
    ).toBe("packages/order");
  });

  test("the index of a repository is built once and handed back on every later ask", () => {
    const repositoryRoot = repositoryWith({ "src/a.ts": SHAPE });

    expect(loadRepositoryTypeAuthorityIndex({ repositoryRoot })).toBe(
      loadRepositoryTypeAuthorityIndex({ repositoryRoot }),
    );
  });
});

describe("workspacePathOf", () => {
  test("a file under no manifest at all belongs to the repository root", () => {
    const root = mkdtempSync(join(tmpdir(), "split-type-authority-workspace-"));
    onTestFinished(() => {
      rmSync(root, { recursive: true, force: true });
    });
    mkdirSync(join(root, "src"), { recursive: true });

    expect(workspacePathOf({ repositoryRoot: root, absolutePath: join(root, "src/a.ts") })).toBe(
      "",
    );
  });
});
