import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, expect, test } from "vite-plus/test";

import { dependencyTypeEntries } from "./dependency-types.ts";

const createdRoots: string[] = [];

afterEach(() => {
  for (const root of createdRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const createPackage = (manifest: Record<string, unknown>): string => {
  const directory = mkdtempSync(join(tmpdir(), "library-vocabulary-"));
  createdRoots.push(directory);
  writeFileSync(join(directory, "package.json"), JSON.stringify(manifest), "utf8");
  return directory;
};

const writeFile = (packageDirectory: string, relativePath: string, contents: string): void => {
  const absolutePath = join(packageDirectory, relativePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, contents, "utf8");
};

const installDependency = (
  packageDirectory: string,
  name: string,
  manifest: Record<string, unknown>,
  declarationsPath: string | null,
): void => {
  writeFile(packageDirectory, `node_modules/${name}/package.json`, JSON.stringify(manifest));
  if (declarationsPath !== null) {
    writeFile(packageDirectory, `node_modules/${name}/${declarationsPath}`, "export {};\n");
  }
};

const packageNamesOf = (packageDirectory: string): readonly string[] =>
  dependencyTypeEntries(packageDirectory).map((entry) => entry.packageName);

test("a dependency that names its declarations through its export map becomes an entry", () => {
  const packageDirectory = createPackage({ dependencies: { oxlint: "1.76.0" } });
  installDependency(
    packageDirectory,
    "oxlint",
    { exports: { ".": { types: "./dist/index.d.ts", default: "./dist/index.js" } } },
    "dist/index.d.ts",
  );

  expect(dependencyTypeEntries(packageDirectory)).toStrictEqual([
    {
      packageName: "oxlint",
      declarationsPath: join(packageDirectory, "node_modules", "oxlint", "dist", "index.d.ts"),
    },
  ]);
});

test("a dependency declared for development is reachable the same way", () => {
  const packageDirectory = createPackage({ devDependencies: { vite: "8.0.0" } });
  installDependency(
    packageDirectory,
    "vite",
    { types: "./dist/node/index.d.ts" },
    "dist/node/index.d.ts",
  );

  expect(packageNamesOf(packageDirectory)).toStrictEqual(["vite"]);
});

test("a dependency declared as a peer is reachable the same way", () => {
  const packageDirectory = createPackage({ peerDependencies: { oxlint: "*" } });
  installDependency(packageDirectory, "oxlint", { typings: "./index.d.ts" }, "index.d.ts");

  expect(packageNamesOf(packageDirectory)).toStrictEqual(["oxlint"]);
});

test("a dependency inside this repository is left to the repository catalog", () => {
  const packageDirectory = createPackage({
    dependencies: { "@mst/lint-rule-authoring": "workspace:*", oxlint: "1.76.0" },
  });
  installDependency(
    packageDirectory,
    "@mst/lint-rule-authoring",
    { exports: { ".": "./src/index.ts" } },
    "src/index.ts",
  );
  installDependency(packageDirectory, "oxlint", { types: "./index.d.ts" }, "index.d.ts");

  expect(packageNamesOf(packageDirectory)).toStrictEqual(["oxlint"]);
});

test("a types condition nested under another condition is still found", () => {
  const packageDirectory = createPackage({ dependencies: { nested: "1.0.0" } });
  installDependency(
    packageDirectory,
    "nested",
    { exports: { ".": { import: { types: "./index.d.mts", default: "./index.mjs" } } } },
    "index.d.mts",
  );

  expect(packageNamesOf(packageDirectory)).toStrictEqual(["nested"]);
});

test("an export map that names conditions without a subpath is read as the root entry", () => {
  const packageDirectory = createPackage({ dependencies: { rootonly: "1.0.0" } });
  installDependency(
    packageDirectory,
    "rootonly",
    { exports: { types: "./index.d.ts", default: "./index.js" } },
    "index.d.ts",
  );

  expect(packageNamesOf(packageDirectory)).toStrictEqual(["rootonly"]);
});

test("a package that only names its runtime entry points at the declarations beside it", () => {
  const packageDirectory = createPackage({ dependencies: { runtimeonly: "1.0.0" } });
  installDependency(
    packageDirectory,
    "runtimeonly",
    { main: "./dist/index.js" },
    "dist/index.d.ts",
  );

  expect(packageNamesOf(packageDirectory)).toStrictEqual(["runtimeonly"]);
});

test("a package that ships no type declarations is left out", () => {
  const packageDirectory = createPackage({ dependencies: { runtimeonly: "1.0.0" } });
  installDependency(packageDirectory, "runtimeonly", { main: "./dist/index.js" }, "dist/index.js");

  expect(packageNamesOf(packageDirectory)).toStrictEqual([]);
});

test("a dependency missing from the checkout costs only that dependency", () => {
  const packageDirectory = createPackage({ dependencies: { oxlint: "1.76.0", pruned: "1.0.0" } });
  installDependency(packageDirectory, "oxlint", { types: "./index.d.ts" }, "index.d.ts");

  expect(packageNamesOf(packageDirectory)).toStrictEqual(["oxlint"]);
});

test("entries come back sorted by package name", () => {
  const packageDirectory = createPackage({
    dependencies: { oxlint: "1.76.0" },
    devDependencies: { "@oxlint/plugins": "1.76.0", vite: "8.0.0" },
  });
  installDependency(packageDirectory, "oxlint", { types: "./index.d.ts" }, "index.d.ts");
  installDependency(packageDirectory, "@oxlint/plugins", { types: "./index.d.ts" }, "index.d.ts");
  installDependency(packageDirectory, "vite", { types: "./index.d.ts" }, "index.d.ts");

  expect(packageNamesOf(packageDirectory)).toStrictEqual(["@oxlint/plugins", "oxlint", "vite"]);
});

test("a package that declares no dependencies has nothing to offer", () => {
  expect(dependencyTypeEntries(createPackage({ name: "alone" }))).toStrictEqual([]);
});

test("a directory that holds no manifest has nothing to offer", () => {
  const packageDirectory = createPackage({ name: "alone" });

  expect(dependencyTypeEntries(join(packageDirectory, "src"))).toStrictEqual([]);
});
