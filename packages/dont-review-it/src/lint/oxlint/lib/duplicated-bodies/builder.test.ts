import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, onTestFinished, test, vi } from "vite-plus/test";

import { buildRepositoryBodyIndex, loadRepositoryBodyIndex } from "./builder.ts";

const VANISHED_FILE_NAME = "vanished.ts";

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
    if (String(path).endsWith(VANISHED_FILE_NAME)) throw new MissingPathError();
    return real.readFileSync(...call);
  }) as typeof real.readFileSync;
  return { ...real, readFileSync };
});

const TWICE = `export const twice = (value: number): number => {
  const doubled = value * 2;
  return doubled;
};
`;

describe("buildRepositoryBodyIndex", () => {
  const repositoryWith = (files: Readonly<Record<string, string>>): string => {
    const root = mkdtempSync(join(tmpdir(), "duplicated-bodies-builder-"));
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
    ...buildRepositoryBodyIndex({ repositoryRoot }).bodiesByPath.keys(),
  ];

  test("a body spelled in two files is reachable through one fingerprint", () => {
    const repositoryRoot = repositoryWith({ "src/a.ts": TWICE, "src/b.ts": TWICE });

    expect(pathsIn(repositoryRoot)).toStrictEqual(["src/a.ts", "src/b.ts"]);
  });

  test("a repository whose sources are all out of scope is indexed as empty", () => {
    const repositoryRoot = repositoryWith({ "src/a.test.ts": TWICE });

    expect(pathsIn(repositoryRoot)).toStrictEqual([]);
  });

  test("a source that declares no body of its own is left out of the index", () => {
    const repositoryRoot = repositoryWith({
      "src/a.ts": TWICE,
      "src/b.ts": "export {};\n",
    });

    expect(pathsIn(repositoryRoot)).toStrictEqual(["src/a.ts"]);
  });

  test("a source that vanished after the listing is left out of the index", () => {
    const repositoryRoot = repositoryWith({
      "src/a.ts": TWICE,
      [`src/${VANISHED_FILE_NAME}`]: TWICE,
    });

    expect(pathsIn(repositoryRoot)).toStrictEqual(["src/a.ts"]);
  });

  test("the index of a repository is built once and handed back on every later ask", () => {
    const repositoryRoot = repositoryWith({ "src/a.ts": TWICE, "src/b.ts": TWICE });

    expect(loadRepositoryBodyIndex({ repositoryRoot })).toBe(
      loadRepositoryBodyIndex({ repositoryRoot }),
    );
  });
});
