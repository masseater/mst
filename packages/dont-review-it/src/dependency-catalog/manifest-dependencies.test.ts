import { describe, expect, it } from "vite-plus/test";

import { defaultDependencyCatalogChecksConfig } from "./config.ts";
import { dependencyReferencesIn } from "./manifest-dependencies.ts";

const config = defaultDependencyCatalogChecksConfig;

describe("dependencyReferencesIn", () => {
  it("collects the references from every dependency field", () => {
    const references = dependencyReferencesIn({
      manifestPath: "packages/left/package.json",
      manifest: {
        dependencies: { react: "^19.0.0" },
        devDependencies: { typescript: "catalog:" },
        peerDependencies: { vite: "^6.0.0" },
        optionalDependencies: { fsevents: "^2.3.0" },
      },
      config,
    });

    expect(references.map((reference) => reference.dependencyName)).toStrictEqual([
      "react",
      "typescript",
      "vite",
      "fsevents",
    ]);
  });

  it("reads a manifest that is not a record as no references", () => {
    expect(
      dependencyReferencesIn({ manifestPath: "package.json", manifest: "broken", config }),
    ).toStrictEqual([]);
  });

  it("drops the entries whose specifier is not a string", () => {
    expect(
      dependencyReferencesIn({
        manifestPath: "package.json",
        manifest: { dependencies: { react: 19 } },
        config,
      }),
    ).toStrictEqual([]);
  });
});
