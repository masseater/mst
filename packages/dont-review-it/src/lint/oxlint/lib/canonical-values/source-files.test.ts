import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";

import { expect, onTestFinished, test, vi } from "vite-plus/test";

import { listRepositoryFiles, nearestPackageDirectory } from "./source-files.ts";

const VANISHED_FILE_NAME = "vanished.ts";

vi.mock("node:fs", async (importOriginal) => {
  const real = await importOriginal<typeof import("node:fs")>();
  return {
    ...real,
    statSync: (path: Parameters<typeof real.statSync>[0]) => {
      if (String(path).endsWith(VANISHED_FILE_NAME)) throw new Error("the file is gone");
      return real.statSync(path);
    },
  };
});

const createRepository = (): string => {
  const root = mkdtempSync(join(tmpdir(), "source-files-"));
  onTestFinished(() => {
    rmSync(root, { recursive: true, force: true });
  });
  return root;
};

const createDirectory = (root: string, relativePath: string): string => {
  const absolutePath = join(root, relativePath);
  mkdirSync(absolutePath, { recursive: true });
  return absolutePath;
};

const createManifest = (directory: string): void => {
  writeFileSync(join(directory, "package.json"), "{}", "utf8");
};

test("a directory that holds a manifest is its own package", () => {
  const root = createRepository();
  const workspace = createDirectory(root, "packages/order");
  createManifest(workspace);

  expect(nearestPackageDirectory(workspace, root)).toBe(workspace);
});

test("a directory below a manifest belongs to the package that holds it", () => {
  const root = createRepository();
  const workspace = createDirectory(root, "packages/order");
  createManifest(workspace);
  const nested = createDirectory(root, "packages/order/src/lint");

  expect(nearestPackageDirectory(nested, root)).toBe(workspace);
});

test("the nearer manifest wins over the one further up", () => {
  const root = createRepository();
  createManifest(root);
  const workspace = createDirectory(root, "packages/order");
  createManifest(workspace);

  expect(nearestPackageDirectory(join(workspace, "src"), root)).toBe(workspace);
});

test("a directory under a repository whose root holds the only manifest belongs to the root", () => {
  const root = createRepository();
  createManifest(root);
  const nested = createDirectory(root, "scripts");

  expect(nearestPackageDirectory(nested, root)).toBe(root);
});

test("a repository whose root holds no manifest leaves the file in no package", () => {
  const root = createRepository();
  const nested = createDirectory(root, "scripts");

  expect(nearestPackageDirectory(nested, root)).toBe(null);
});

test("a climb that reaches the top of the filesystem stops there", () => {
  expect(nearestPackageDirectory(sep, join(sep, "a-root-that-is-never-reached"))).toBe(null);
});

test("a file that disappears between the listing and the reading is left out", () => {
  const root = createRepository();
  const source = createDirectory(root, "src");
  writeFileSync(join(source, "present.ts"), "export const total = 1;\n", "utf8");
  writeFileSync(join(source, VANISHED_FILE_NAME), "export const gone = 1;\n", "utf8");

  expect(listRepositoryFiles(root).commentSources.map((file) => file.relativePath)).toStrictEqual([
    "src/present.ts",
  ]);
});
