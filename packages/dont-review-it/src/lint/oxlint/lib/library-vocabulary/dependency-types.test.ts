import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, onTestFinished, test } from "vite-plus/test";

import { dependencyTypeEntries } from "./dependency-types.ts";

describe("dependency-types", () => {
  const createPackage = (manifest: Record<string, unknown>): string => {
    const directory = mkdtempSync(join(tmpdir(), "library-vocabulary-"));
    onTestFinished(() => {
      rmSync(directory, { recursive: true, force: true });
    });
    writeFileSync(join(directory, "package.json"), JSON.stringify(manifest), "utf8");
    return directory;
  };

  type PackageFile = {
    readonly relativePath: string;
    readonly contents: string;
  };

  const writeFile = (packageDirectory: string, { relativePath, contents }: PackageFile): void => {
    const absolutePath = join(packageDirectory, relativePath);
    mkdirSync(dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, contents, "utf8");
  };

  type InstalledDependency = {
    readonly name: string;
    readonly manifest: Record<string, unknown>;
    readonly declarationsPath: string | null;
  };

  const installDependency = (
    packageDirectory: string,
    { name, manifest, declarationsPath }: InstalledDependency,
  ): void => {
    writeFile(packageDirectory, {
      relativePath: `node_modules/${name}/package.json`,
      contents: JSON.stringify(manifest),
    });
    if (declarationsPath !== null) {
      writeFile(packageDirectory, {
        relativePath: `node_modules/${name}/${declarationsPath}`,
        contents: "export {};\n",
      });
    }
  };

  const packageNamesOf = (packageDirectory: string): readonly string[] =>
    dependencyTypeEntries(packageDirectory).map((entry) => entry.packageName);

  test("a dependency that names its declarations through its export map becomes an entry", () => {
    const packageDirectory = createPackage({ dependencies: { oxlint: "1.76.0" } });
    installDependency(packageDirectory, {
      name: "oxlint",
      manifest: { exports: { ".": { types: "./dist/index.d.ts", default: "./dist/index.js" } } },
      declarationsPath: "dist/index.d.ts",
    });

    expect(dependencyTypeEntries(packageDirectory)).toStrictEqual([
      {
        packageName: "oxlint",
        declarationsPath: join(packageDirectory, "node_modules", "oxlint", "dist", "index.d.ts"),
      },
    ]);
  });

  test("an export map spelled as one path is read as that path", () => {
    const packageDirectory = createPackage({ dependencies: { oxlint: "1.76.0" } });
    installDependency(packageDirectory, {
      name: "oxlint",
      manifest: { exports: "./index.d.ts" },
      declarationsPath: "index.d.ts",
    });

    expect(packageNamesOf(packageDirectory)).toStrictEqual(["oxlint"]);
  });

  test("an export map that names only subpaths hands back no root entry", () => {
    const packageDirectory = createPackage({ dependencies: { oxlint: "1.76.0" } });
    installDependency(packageDirectory, {
      name: "oxlint",
      manifest: { exports: { "./plugins": "./plugins.d.ts" }, types: "./index.d.ts" },
      declarationsPath: "index.d.ts",
    });

    expect(packageNamesOf(packageDirectory)).toStrictEqual(["oxlint"]);
  });

  test("an export map holding conditions that name nothing hands back no entry", () => {
    const packageDirectory = createPackage({ dependencies: { oxlint: "1.76.0" } });
    installDependency(packageDirectory, {
      name: "oxlint",
      manifest: { exports: { ".": { node: { import: {} } } }, types: "./index.d.ts" },
      declarationsPath: "index.d.ts",
    });

    expect(packageNamesOf(packageDirectory)).toStrictEqual(["oxlint"]);
  });

  test("an entry path that carries no suffix names no declarations", () => {
    const packageDirectory = createPackage({ dependencies: { oxlint: "1.76.0" } });
    installDependency(packageDirectory, {
      name: "oxlint",
      manifest: { exports: { ".": { default: "./index" } }, types: "./index.d.ts" },
      declarationsPath: "index.d.ts",
    });

    expect(packageNamesOf(packageDirectory)).toStrictEqual(["oxlint"]);
  });

  test("a dependency declared for development is reachable the same way", () => {
    const packageDirectory = createPackage({ devDependencies: { vite: "8.0.0" } });
    installDependency(packageDirectory, {
      name: "vite",
      manifest: { types: "./dist/node/index.d.ts" },
      declarationsPath: "dist/node/index.d.ts",
    });

    expect(packageNamesOf(packageDirectory)).toStrictEqual(["vite"]);
  });

  test("a dependency declared as a peer is reachable the same way", () => {
    const packageDirectory = createPackage({ peerDependencies: { oxlint: "*" } });
    installDependency(packageDirectory, {
      name: "oxlint",
      manifest: { typings: "./index.d.ts" },
      declarationsPath: "index.d.ts",
    });

    expect(packageNamesOf(packageDirectory)).toStrictEqual(["oxlint"]);
  });

  test("a dependency inside this repository is left to the repository catalog", () => {
    const packageDirectory = createPackage({
      dependencies: { "@mst/lint-rule-authoring": "workspace:*", oxlint: "1.76.0" },
    });
    installDependency(packageDirectory, {
      name: "@mst/lint-rule-authoring",
      manifest: { exports: { ".": "./src/index.ts" } },
      declarationsPath: "src/index.ts",
    });
    installDependency(packageDirectory, {
      name: "oxlint",
      manifest: { types: "./index.d.ts" },
      declarationsPath: "index.d.ts",
    });

    expect(packageNamesOf(packageDirectory)).toStrictEqual(["oxlint"]);
  });

  test("a types condition nested under another condition is still found", () => {
    const packageDirectory = createPackage({ dependencies: { nested: "1.0.0" } });
    installDependency(packageDirectory, {
      name: "nested",
      manifest: {
        exports: { ".": { import: { types: "./index.d.mts", default: "./index.mjs" } } },
      },
      declarationsPath: "index.d.mts",
    });

    expect(packageNamesOf(packageDirectory)).toStrictEqual(["nested"]);
  });

  test("an export map that names conditions without a subpath is read as the root entry", () => {
    const packageDirectory = createPackage({ dependencies: { rootonly: "1.0.0" } });
    installDependency(packageDirectory, {
      name: "rootonly",
      manifest: { exports: { types: "./index.d.ts", default: "./index.js" } },
      declarationsPath: "index.d.ts",
    });

    expect(packageNamesOf(packageDirectory)).toStrictEqual(["rootonly"]);
  });

  test("a package that only names its runtime entry points at the declarations beside it", () => {
    const packageDirectory = createPackage({ dependencies: { runtimeonly: "1.0.0" } });
    installDependency(packageDirectory, {
      name: "runtimeonly",
      manifest: { main: "./dist/index.js" },
      declarationsPath: "dist/index.d.ts",
    });

    expect(packageNamesOf(packageDirectory)).toStrictEqual(["runtimeonly"]);
  });

  test("a package that ships no type declarations is left out", () => {
    const packageDirectory = createPackage({ dependencies: { runtimeonly: "1.0.0" } });
    installDependency(packageDirectory, {
      name: "runtimeonly",
      manifest: { main: "./dist/index.js" },
      declarationsPath: "dist/index.js",
    });

    expect(packageNamesOf(packageDirectory)).toStrictEqual([]);
  });

  test("a dependency missing from the checkout costs only that dependency", () => {
    const packageDirectory = createPackage({ dependencies: { oxlint: "1.76.0", pruned: "1.0.0" } });
    installDependency(packageDirectory, {
      name: "oxlint",
      manifest: { types: "./index.d.ts" },
      declarationsPath: "index.d.ts",
    });

    expect(packageNamesOf(packageDirectory)).toStrictEqual(["oxlint"]);
  });

  test("entries come back sorted by package name", () => {
    const packageDirectory = createPackage({
      dependencies: { oxlint: "1.76.0" },
      devDependencies: { "@oxlint/plugins": "1.76.0", vite: "8.0.0" },
    });
    installDependency(packageDirectory, {
      name: "oxlint",
      manifest: { types: "./index.d.ts" },
      declarationsPath: "index.d.ts",
    });
    installDependency(packageDirectory, {
      name: "@oxlint/plugins",
      manifest: { types: "./index.d.ts" },
      declarationsPath: "index.d.ts",
    });
    installDependency(packageDirectory, {
      name: "vite",
      manifest: { types: "./index.d.ts" },
      declarationsPath: "index.d.ts",
    });

    expect(packageNamesOf(packageDirectory)).toStrictEqual(["@oxlint/plugins", "oxlint", "vite"]);
  });

  test("a package that declares no dependencies has nothing to offer", () => {
    expect(dependencyTypeEntries(createPackage({ name: "alone" }))).toStrictEqual([]);
  });

  test("a directory that holds no manifest has nothing to offer", () => {
    const packageDirectory = createPackage({ name: "alone" });

    expect(dependencyTypeEntries(join(packageDirectory, "src"))).toStrictEqual([]);
  });
});
