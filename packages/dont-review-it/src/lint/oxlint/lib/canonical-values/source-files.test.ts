import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, onTestFinished, test } from "vite-plus/test";

import { nearestPackageDirectory } from "./source-files.ts";

describe("source-files", () => {
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
});
