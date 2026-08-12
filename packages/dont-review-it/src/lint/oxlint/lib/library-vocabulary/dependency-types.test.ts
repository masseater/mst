import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { dependencyTypeEntries } from "./dependency-types.ts";

const FIXTURE_ROOT = join(tmpdir(), "dont-review-it-dependency-types");

const it = test
  .extend("entriesOfADependencyNamingDeclarationsInItsExportMap", ({}, { onCleanup }) => {
    const packageDirectory = join(FIXTURE_ROOT, "export-map");
    rmSync(packageDirectory, { recursive: true, force: true });
    onCleanup(() => {
      rmSync(packageDirectory, { recursive: true, force: true });
    });
    mkdirSync(join(packageDirectory, "node_modules", "oxlint", "dist"), { recursive: true });
    writeFileSync(
      join(packageDirectory, "package.json"),
      JSON.stringify({ dependencies: { oxlint: "1.76.0" } }),
      "utf8",
    );
    writeFileSync(
      join(packageDirectory, "node_modules", "oxlint", "package.json"),
      JSON.stringify({
        exports: { ".": { types: "./dist/index.d.ts", default: "./dist/index.js" } },
      }),
      "utf8",
    );
    writeFileSync(
      join(packageDirectory, "node_modules", "oxlint", "dist", "index.d.ts"),
      "export {};\n",
      "utf8",
    );
    return dependencyTypeEntries(packageDirectory);
  })
  .extend("entriesOfAnExportMapSpelledAsOnePath", ({}, { onCleanup }) => {
    const packageDirectory = join(FIXTURE_ROOT, "export-map-as-one-path");
    rmSync(packageDirectory, { recursive: true, force: true });
    onCleanup(() => {
      rmSync(packageDirectory, { recursive: true, force: true });
    });
    mkdirSync(join(packageDirectory, "node_modules", "oxlint"), { recursive: true });
    writeFileSync(
      join(packageDirectory, "package.json"),
      JSON.stringify({ dependencies: { oxlint: "1.76.0" } }),
      "utf8",
    );
    writeFileSync(
      join(packageDirectory, "node_modules", "oxlint", "package.json"),
      JSON.stringify({ exports: "./index.d.ts" }),
      "utf8",
    );
    writeFileSync(
      join(packageDirectory, "node_modules", "oxlint", "index.d.ts"),
      "export {};\n",
      "utf8",
    );
    return dependencyTypeEntries(packageDirectory);
  })
  .extend("entriesOfAnExportMapNamingOnlySubpaths", ({}, { onCleanup }) => {
    const packageDirectory = join(FIXTURE_ROOT, "export-map-of-subpaths");
    rmSync(packageDirectory, { recursive: true, force: true });
    onCleanup(() => {
      rmSync(packageDirectory, { recursive: true, force: true });
    });
    mkdirSync(join(packageDirectory, "node_modules", "oxlint"), { recursive: true });
    writeFileSync(
      join(packageDirectory, "package.json"),
      JSON.stringify({ dependencies: { oxlint: "1.76.0" } }),
      "utf8",
    );
    writeFileSync(
      join(packageDirectory, "node_modules", "oxlint", "package.json"),
      JSON.stringify({ exports: { "./plugins": "./plugins.d.ts" }, types: "./index.d.ts" }),
      "utf8",
    );
    writeFileSync(
      join(packageDirectory, "node_modules", "oxlint", "index.d.ts"),
      "export {};\n",
      "utf8",
    );
    return dependencyTypeEntries(packageDirectory);
  })
  .extend("entriesOfAnExportMapWhoseConditionsNameNothing", ({}, { onCleanup }) => {
    const packageDirectory = join(FIXTURE_ROOT, "export-map-of-empty-conditions");
    rmSync(packageDirectory, { recursive: true, force: true });
    onCleanup(() => {
      rmSync(packageDirectory, { recursive: true, force: true });
    });
    mkdirSync(join(packageDirectory, "node_modules", "oxlint"), { recursive: true });
    writeFileSync(
      join(packageDirectory, "package.json"),
      JSON.stringify({ dependencies: { oxlint: "1.76.0" } }),
      "utf8",
    );
    writeFileSync(
      join(packageDirectory, "node_modules", "oxlint", "package.json"),
      JSON.stringify({ exports: { ".": { node: { import: {} } } }, types: "./index.d.ts" }),
      "utf8",
    );
    writeFileSync(
      join(packageDirectory, "node_modules", "oxlint", "index.d.ts"),
      "export {};\n",
      "utf8",
    );
    return dependencyTypeEntries(packageDirectory);
  })
  .extend("entriesOfAnEntryPathCarryingNoSuffix", ({}, { onCleanup }) => {
    const packageDirectory = join(FIXTURE_ROOT, "entry-path-without-a-suffix");
    rmSync(packageDirectory, { recursive: true, force: true });
    onCleanup(() => {
      rmSync(packageDirectory, { recursive: true, force: true });
    });
    mkdirSync(join(packageDirectory, "node_modules", "oxlint"), { recursive: true });
    writeFileSync(
      join(packageDirectory, "package.json"),
      JSON.stringify({ dependencies: { oxlint: "1.76.0" } }),
      "utf8",
    );
    writeFileSync(
      join(packageDirectory, "node_modules", "oxlint", "package.json"),
      JSON.stringify({ exports: { ".": { default: "./index" } }, types: "./index.d.ts" }),
      "utf8",
    );
    writeFileSync(
      join(packageDirectory, "node_modules", "oxlint", "index.d.ts"),
      "export {};\n",
      "utf8",
    );
    return dependencyTypeEntries(packageDirectory);
  })
  .extend("entriesOfADependencyDeclaredForDevelopment", ({}, { onCleanup }) => {
    const packageDirectory = join(FIXTURE_ROOT, "development-dependency");
    rmSync(packageDirectory, { recursive: true, force: true });
    onCleanup(() => {
      rmSync(packageDirectory, { recursive: true, force: true });
    });
    mkdirSync(join(packageDirectory, "node_modules", "vite", "dist", "node"), { recursive: true });
    writeFileSync(
      join(packageDirectory, "package.json"),
      JSON.stringify({ devDependencies: { vite: "8.0.0" } }),
      "utf8",
    );
    writeFileSync(
      join(packageDirectory, "node_modules", "vite", "package.json"),
      JSON.stringify({ types: "./dist/node/index.d.ts" }),
      "utf8",
    );
    writeFileSync(
      join(packageDirectory, "node_modules", "vite", "dist", "node", "index.d.ts"),
      "export {};\n",
      "utf8",
    );
    return dependencyTypeEntries(packageDirectory);
  })
  .extend("entriesOfADependencyDeclaredAsAPeer", ({}, { onCleanup }) => {
    const packageDirectory = join(FIXTURE_ROOT, "peer-dependency");
    rmSync(packageDirectory, { recursive: true, force: true });
    onCleanup(() => {
      rmSync(packageDirectory, { recursive: true, force: true });
    });
    mkdirSync(join(packageDirectory, "node_modules", "oxlint"), { recursive: true });
    writeFileSync(
      join(packageDirectory, "package.json"),
      JSON.stringify({ peerDependencies: { oxlint: "*" } }),
      "utf8",
    );
    writeFileSync(
      join(packageDirectory, "node_modules", "oxlint", "package.json"),
      JSON.stringify({ typings: "./index.d.ts" }),
      "utf8",
    );
    writeFileSync(
      join(packageDirectory, "node_modules", "oxlint", "index.d.ts"),
      "export {};\n",
      "utf8",
    );
    return dependencyTypeEntries(packageDirectory);
  })
  .extend("entriesOfACheckoutHoldingADependencyOfThisRepository", ({}, { onCleanup }) => {
    const packageDirectory = join(FIXTURE_ROOT, "repository-dependency");
    rmSync(packageDirectory, { recursive: true, force: true });
    onCleanup(() => {
      rmSync(packageDirectory, { recursive: true, force: true });
    });
    mkdirSync(join(packageDirectory, "node_modules", "@mst", "lint-rule-authoring", "src"), {
      recursive: true,
    });
    mkdirSync(join(packageDirectory, "node_modules", "oxlint"), { recursive: true });
    writeFileSync(
      join(packageDirectory, "package.json"),
      JSON.stringify({
        dependencies: { "@mst/lint-rule-authoring": "workspace:*", oxlint: "1.76.0" },
      }),
      "utf8",
    );
    writeFileSync(
      join(packageDirectory, "node_modules", "@mst", "lint-rule-authoring", "package.json"),
      JSON.stringify({ exports: { ".": "./src/index.ts" } }),
      "utf8",
    );
    writeFileSync(
      join(packageDirectory, "node_modules", "@mst", "lint-rule-authoring", "src", "index.ts"),
      "export {};\n",
      "utf8",
    );
    writeFileSync(
      join(packageDirectory, "node_modules", "oxlint", "package.json"),
      JSON.stringify({ types: "./index.d.ts" }),
      "utf8",
    );
    writeFileSync(
      join(packageDirectory, "node_modules", "oxlint", "index.d.ts"),
      "export {};\n",
      "utf8",
    );
    return dependencyTypeEntries(packageDirectory);
  })
  .extend("entriesOfATypesConditionNestedUnderAnother", ({}, { onCleanup }) => {
    const packageDirectory = join(FIXTURE_ROOT, "nested-types-condition");
    rmSync(packageDirectory, { recursive: true, force: true });
    onCleanup(() => {
      rmSync(packageDirectory, { recursive: true, force: true });
    });
    mkdirSync(join(packageDirectory, "node_modules", "nested"), { recursive: true });
    writeFileSync(
      join(packageDirectory, "package.json"),
      JSON.stringify({ dependencies: { nested: "1.0.0" } }),
      "utf8",
    );
    writeFileSync(
      join(packageDirectory, "node_modules", "nested", "package.json"),
      JSON.stringify({
        exports: { ".": { import: { types: "./index.d.mts", default: "./index.mjs" } } },
      }),
      "utf8",
    );
    writeFileSync(
      join(packageDirectory, "node_modules", "nested", "index.d.mts"),
      "export {};\n",
      "utf8",
    );
    return dependencyTypeEntries(packageDirectory);
  })
  .extend("entriesOfAnExportMapNamingConditionsWithoutASubpath", ({}, { onCleanup }) => {
    const packageDirectory = join(FIXTURE_ROOT, "conditions-without-a-subpath");
    rmSync(packageDirectory, { recursive: true, force: true });
    onCleanup(() => {
      rmSync(packageDirectory, { recursive: true, force: true });
    });
    mkdirSync(join(packageDirectory, "node_modules", "rootonly"), { recursive: true });
    writeFileSync(
      join(packageDirectory, "package.json"),
      JSON.stringify({ dependencies: { rootonly: "1.0.0" } }),
      "utf8",
    );
    writeFileSync(
      join(packageDirectory, "node_modules", "rootonly", "package.json"),
      JSON.stringify({ exports: { types: "./index.d.ts", default: "./index.js" } }),
      "utf8",
    );
    writeFileSync(
      join(packageDirectory, "node_modules", "rootonly", "index.d.ts"),
      "export {};\n",
      "utf8",
    );
    return dependencyTypeEntries(packageDirectory);
  })
  .extend("entriesOfAPackageNamingOnlyItsRuntimeEntry", ({}, { onCleanup }) => {
    const packageDirectory = join(FIXTURE_ROOT, "runtime-entry-beside-declarations");
    rmSync(packageDirectory, { recursive: true, force: true });
    onCleanup(() => {
      rmSync(packageDirectory, { recursive: true, force: true });
    });
    mkdirSync(join(packageDirectory, "node_modules", "runtimeonly", "dist"), { recursive: true });
    writeFileSync(
      join(packageDirectory, "package.json"),
      JSON.stringify({ dependencies: { runtimeonly: "1.0.0" } }),
      "utf8",
    );
    writeFileSync(
      join(packageDirectory, "node_modules", "runtimeonly", "package.json"),
      JSON.stringify({ main: "./dist/index.js" }),
      "utf8",
    );
    writeFileSync(
      join(packageDirectory, "node_modules", "runtimeonly", "dist", "index.d.ts"),
      "export {};\n",
      "utf8",
    );
    return dependencyTypeEntries(packageDirectory);
  })
  .extend("entriesOfAPackageShippingNoTypeDeclarations", ({}, { onCleanup }) => {
    const packageDirectory = join(FIXTURE_ROOT, "runtime-entry-without-declarations");
    rmSync(packageDirectory, { recursive: true, force: true });
    onCleanup(() => {
      rmSync(packageDirectory, { recursive: true, force: true });
    });
    mkdirSync(join(packageDirectory, "node_modules", "runtimeonly", "dist"), { recursive: true });
    writeFileSync(
      join(packageDirectory, "package.json"),
      JSON.stringify({ dependencies: { runtimeonly: "1.0.0" } }),
      "utf8",
    );
    writeFileSync(
      join(packageDirectory, "node_modules", "runtimeonly", "package.json"),
      JSON.stringify({ main: "./dist/index.js" }),
      "utf8",
    );
    writeFileSync(
      join(packageDirectory, "node_modules", "runtimeonly", "dist", "index.js"),
      "export {};\n",
      "utf8",
    );
    return dependencyTypeEntries(packageDirectory);
  })
  .extend("entriesOfACheckoutMissingOneDependency", ({}, { onCleanup }) => {
    const packageDirectory = join(FIXTURE_ROOT, "pruned-dependency");
    rmSync(packageDirectory, { recursive: true, force: true });
    onCleanup(() => {
      rmSync(packageDirectory, { recursive: true, force: true });
    });
    mkdirSync(join(packageDirectory, "node_modules", "oxlint"), { recursive: true });
    writeFileSync(
      join(packageDirectory, "package.json"),
      JSON.stringify({ dependencies: { oxlint: "1.76.0", pruned: "1.0.0" } }),
      "utf8",
    );
    writeFileSync(
      join(packageDirectory, "node_modules", "oxlint", "package.json"),
      JSON.stringify({ types: "./index.d.ts" }),
      "utf8",
    );
    writeFileSync(
      join(packageDirectory, "node_modules", "oxlint", "index.d.ts"),
      "export {};\n",
      "utf8",
    );
    return dependencyTypeEntries(packageDirectory);
  })
  .extend("entriesOfThreeDependenciesInstalledOutOfOrder", ({}, { onCleanup }) => {
    const packageDirectory = join(FIXTURE_ROOT, "three-dependencies");
    rmSync(packageDirectory, { recursive: true, force: true });
    onCleanup(() => {
      rmSync(packageDirectory, { recursive: true, force: true });
    });
    mkdirSync(join(packageDirectory, "node_modules", "oxlint"), { recursive: true });
    mkdirSync(join(packageDirectory, "node_modules", "@oxlint", "plugins"), { recursive: true });
    mkdirSync(join(packageDirectory, "node_modules", "vite"), { recursive: true });
    writeFileSync(
      join(packageDirectory, "package.json"),
      JSON.stringify({
        dependencies: { oxlint: "1.76.0" },
        devDependencies: { "@oxlint/plugins": "1.76.0", vite: "8.0.0" },
      }),
      "utf8",
    );
    writeFileSync(
      join(packageDirectory, "node_modules", "oxlint", "package.json"),
      JSON.stringify({ types: "./index.d.ts" }),
      "utf8",
    );
    writeFileSync(
      join(packageDirectory, "node_modules", "oxlint", "index.d.ts"),
      "export {};\n",
      "utf8",
    );
    writeFileSync(
      join(packageDirectory, "node_modules", "@oxlint", "plugins", "package.json"),
      JSON.stringify({ types: "./index.d.ts" }),
      "utf8",
    );
    writeFileSync(
      join(packageDirectory, "node_modules", "@oxlint", "plugins", "index.d.ts"),
      "export {};\n",
      "utf8",
    );
    writeFileSync(
      join(packageDirectory, "node_modules", "vite", "package.json"),
      JSON.stringify({ types: "./index.d.ts" }),
      "utf8",
    );
    writeFileSync(
      join(packageDirectory, "node_modules", "vite", "index.d.ts"),
      "export {};\n",
      "utf8",
    );
    return dependencyTypeEntries(packageDirectory);
  })
  .extend("entriesOfAPackageDeclaringNoDependencies", ({}, { onCleanup }) => {
    const packageDirectory = join(FIXTURE_ROOT, "no-dependencies");
    rmSync(packageDirectory, { recursive: true, force: true });
    onCleanup(() => {
      rmSync(packageDirectory, { recursive: true, force: true });
    });
    mkdirSync(packageDirectory, { recursive: true });
    writeFileSync(
      join(packageDirectory, "package.json"),
      JSON.stringify({ name: "alone" }),
      "utf8",
    );
    return dependencyTypeEntries(packageDirectory);
  })
  .extend("entriesOfADirectoryHoldingNoManifest", ({}, { onCleanup }) => {
    const packageDirectory = join(FIXTURE_ROOT, "no-manifest");
    rmSync(packageDirectory, { recursive: true, force: true });
    onCleanup(() => {
      rmSync(packageDirectory, { recursive: true, force: true });
    });
    mkdirSync(packageDirectory, { recursive: true });
    writeFileSync(
      join(packageDirectory, "package.json"),
      JSON.stringify({ name: "alone" }),
      "utf8",
    );
    return dependencyTypeEntries(join(packageDirectory, "src"));
  });

describe("dependency-types", () => {
  it("a dependency that names its declarations through its export map becomes an entry", ({
    entriesOfADependencyNamingDeclarationsInItsExportMap,
  }) => {
    expect(entriesOfADependencyNamingDeclarationsInItsExportMap).toStrictEqual([
      {
        packageName: "oxlint",
        declarationsPath: join(
          FIXTURE_ROOT,
          "export-map",
          "node_modules",
          "oxlint",
          "dist",
          "index.d.ts",
        ),
      },
    ]);
  });

  it("an export map spelled as one path is read as that path", ({
    entriesOfAnExportMapSpelledAsOnePath,
  }) => {
    expect(entriesOfAnExportMapSpelledAsOnePath).toStrictEqual([
      {
        packageName: "oxlint",
        declarationsPath: join(
          FIXTURE_ROOT,
          "export-map-as-one-path",
          "node_modules",
          "oxlint",
          "index.d.ts",
        ),
      },
    ]);
  });

  it("an export map that names only subpaths hands back no root entry", ({
    entriesOfAnExportMapNamingOnlySubpaths,
  }) => {
    expect(entriesOfAnExportMapNamingOnlySubpaths).toStrictEqual([
      {
        packageName: "oxlint",
        declarationsPath: join(
          FIXTURE_ROOT,
          "export-map-of-subpaths",
          "node_modules",
          "oxlint",
          "index.d.ts",
        ),
      },
    ]);
  });

  it("an export map holding conditions that name nothing hands back no entry", ({
    entriesOfAnExportMapWhoseConditionsNameNothing,
  }) => {
    expect(entriesOfAnExportMapWhoseConditionsNameNothing).toStrictEqual([
      {
        packageName: "oxlint",
        declarationsPath: join(
          FIXTURE_ROOT,
          "export-map-of-empty-conditions",
          "node_modules",
          "oxlint",
          "index.d.ts",
        ),
      },
    ]);
  });

  it("an entry path that carries no suffix names no declarations", ({
    entriesOfAnEntryPathCarryingNoSuffix,
  }) => {
    expect(entriesOfAnEntryPathCarryingNoSuffix).toStrictEqual([
      {
        packageName: "oxlint",
        declarationsPath: join(
          FIXTURE_ROOT,
          "entry-path-without-a-suffix",
          "node_modules",
          "oxlint",
          "index.d.ts",
        ),
      },
    ]);
  });

  it("a dependency declared for development is reachable the same way", ({
    entriesOfADependencyDeclaredForDevelopment,
  }) => {
    expect(entriesOfADependencyDeclaredForDevelopment).toStrictEqual([
      {
        packageName: "vite",
        declarationsPath: join(
          FIXTURE_ROOT,
          "development-dependency",
          "node_modules",
          "vite",
          "dist",
          "node",
          "index.d.ts",
        ),
      },
    ]);
  });

  it("a dependency declared as a peer is reachable the same way", ({
    entriesOfADependencyDeclaredAsAPeer,
  }) => {
    expect(entriesOfADependencyDeclaredAsAPeer).toStrictEqual([
      {
        packageName: "oxlint",
        declarationsPath: join(
          FIXTURE_ROOT,
          "peer-dependency",
          "node_modules",
          "oxlint",
          "index.d.ts",
        ),
      },
    ]);
  });

  it("a dependency inside this repository is left to the repository catalog", ({
    entriesOfACheckoutHoldingADependencyOfThisRepository,
  }) => {
    expect(entriesOfACheckoutHoldingADependencyOfThisRepository).toStrictEqual([
      {
        packageName: "oxlint",
        declarationsPath: join(
          FIXTURE_ROOT,
          "repository-dependency",
          "node_modules",
          "oxlint",
          "index.d.ts",
        ),
      },
    ]);
  });

  it("a types condition nested under another condition is still found", ({
    entriesOfATypesConditionNestedUnderAnother,
  }) => {
    expect(entriesOfATypesConditionNestedUnderAnother).toStrictEqual([
      {
        packageName: "nested",
        declarationsPath: join(
          FIXTURE_ROOT,
          "nested-types-condition",
          "node_modules",
          "nested",
          "index.d.mts",
        ),
      },
    ]);
  });

  it("an export map that names conditions without a subpath is read as the root entry", ({
    entriesOfAnExportMapNamingConditionsWithoutASubpath,
  }) => {
    expect(entriesOfAnExportMapNamingConditionsWithoutASubpath).toStrictEqual([
      {
        packageName: "rootonly",
        declarationsPath: join(
          FIXTURE_ROOT,
          "conditions-without-a-subpath",
          "node_modules",
          "rootonly",
          "index.d.ts",
        ),
      },
    ]);
  });

  it("a package that only names its runtime entry points at the declarations beside it", ({
    entriesOfAPackageNamingOnlyItsRuntimeEntry,
  }) => {
    expect(entriesOfAPackageNamingOnlyItsRuntimeEntry).toStrictEqual([
      {
        packageName: "runtimeonly",
        declarationsPath: join(
          FIXTURE_ROOT,
          "runtime-entry-beside-declarations",
          "node_modules",
          "runtimeonly",
          "dist",
          "index.d.ts",
        ),
      },
    ]);
  });

  it("a package that ships no type declarations is left out", ({
    entriesOfAPackageShippingNoTypeDeclarations,
  }) => {
    expect(entriesOfAPackageShippingNoTypeDeclarations).toStrictEqual([]);
  });

  it("a dependency missing from the checkout costs only that dependency", ({
    entriesOfACheckoutMissingOneDependency,
  }) => {
    expect(entriesOfACheckoutMissingOneDependency).toStrictEqual([
      {
        packageName: "oxlint",
        declarationsPath: join(
          FIXTURE_ROOT,
          "pruned-dependency",
          "node_modules",
          "oxlint",
          "index.d.ts",
        ),
      },
    ]);
  });

  it("entries come back sorted by package name", ({
    entriesOfThreeDependenciesInstalledOutOfOrder,
  }) => {
    expect(entriesOfThreeDependenciesInstalledOutOfOrder).toStrictEqual([
      {
        packageName: "@oxlint/plugins",
        declarationsPath: join(
          FIXTURE_ROOT,
          "three-dependencies",
          "node_modules",
          "@oxlint",
          "plugins",
          "index.d.ts",
        ),
      },
      {
        packageName: "oxlint",
        declarationsPath: join(
          FIXTURE_ROOT,
          "three-dependencies",
          "node_modules",
          "oxlint",
          "index.d.ts",
        ),
      },
      {
        packageName: "vite",
        declarationsPath: join(
          FIXTURE_ROOT,
          "three-dependencies",
          "node_modules",
          "vite",
          "index.d.ts",
        ),
      },
    ]);
  });

  it("a package that declares no dependencies has nothing to offer", ({
    entriesOfAPackageDeclaringNoDependencies,
  }) => {
    expect(entriesOfAPackageDeclaringNoDependencies).toStrictEqual([]);
  });

  it("a directory that holds no manifest has nothing to offer", ({
    entriesOfADirectoryHoldingNoManifest,
  }) => {
    expect(entriesOfADirectoryHoldingNoManifest).toStrictEqual([]);
  });
});
