import { describe, expect, it } from "vite-plus/test";

import { defaultDependencyCatalogChecksConfig } from "./config.ts";
import { dependencyUsagesIn } from "./dependency-usage.ts";

import type { DependencyReference } from "./manifest-dependencies.ts";

const config = defaultDependencyCatalogChecksConfig;

const usagesFor = (references: readonly DependencyReference[]) =>
  dependencyUsagesIn({ references, config });

describe("dependencyUsagesIn", () => {
  it("separates the catalog references from the direct ones", () => {
    const [usage] = usagesFor([
      { manifestPath: "package.json", dependencyName: "react", specifier: "catalog:" },
      { manifestPath: "apps/web/package.json", dependencyName: "react", specifier: "^19.0.0" },
    ]);

    expect(usage).toStrictEqual({
      dependencyName: "react",
      catalogReferences: [{ manifestPath: "package.json", catalogName: "" }],
      directReferences: [{ manifestPath: "apps/web/package.json", specifier: "^19.0.0" }],
    });
  });

  it("reads the catalog name that follows the protocol", () => {
    const [usage] = usagesFor([
      { manifestPath: "package.json", dependencyName: "react", specifier: "catalog:legacy" },
    ]);

    expect(usage?.catalogReferences).toStrictEqual([
      { manifestPath: "package.json", catalogName: "legacy" },
    ]);
  });

  it("leaves the specifiers that a catalog cannot hold out of the usage", () => {
    const [usage] = usagesFor([
      { manifestPath: "package.json", dependencyName: "utils", specifier: "workspace:*" },
      { manifestPath: "package.json", dependencyName: "utils", specifier: "link:../utils" },
      { manifestPath: "package.json", dependencyName: "utils", specifier: "file:../utils" },
    ]);

    expect(usage).toStrictEqual({
      dependencyName: "utils",
      catalogReferences: [],
      directReferences: [],
    });
  });

  it("counts a manifest that repeats the same reference in two fields once", () => {
    const [usage] = usagesFor([
      { manifestPath: "package.json", dependencyName: "react", specifier: "^19.0.0" },
      { manifestPath: "package.json", dependencyName: "react", specifier: "^19.0.0" },
    ]);

    expect(usage?.directReferences).toStrictEqual([
      { manifestPath: "package.json", specifier: "^19.0.0" },
    ]);
  });

  it("keeps a manifest that declares two different specifiers as two references", () => {
    const [usage] = usagesFor([
      { manifestPath: "package.json", dependencyName: "react", specifier: "^19.0.0" },
      { manifestPath: "package.json", dependencyName: "react", specifier: "^18.0.0" },
    ]);

    expect(usage?.directReferences.length).toBe(2);
  });
});
