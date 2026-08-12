import { describe, expect, it } from "vite-plus/test";

import { defaultDependencyCatalogChecksConfig } from "../config.ts";
import { bypassedCatalogFindings } from "./bypassed-catalog-entry.ts";

import type { DependencyUsage } from "../dependency-usage.ts";
import type { CatalogEntry } from "../workspace-definition.ts";

const config = defaultDependencyCatalogChecksConfig;

const findingsFor = ({
  catalogEntries,
  usages,
}: {
  readonly catalogEntries: readonly CatalogEntry[];
  readonly usages: readonly DependencyUsage[];
}) => bypassedCatalogFindings({ catalogEntries, usages, config });

describe("bypassedCatalogFindings", () => {
  it("reports a direct pin whose version the default catalog already holds", () => {
    const findings = findingsFor({
      catalogEntries: [{ catalogName: "", dependencyName: "react", version: "^19.0.0" }],
      usages: [
        {
          dependencyName: "react",
          catalogReferences: [],
          directReferences: [{ manifestPath: "apps/web/package.json", specifier: "^19.0.0" }],
        },
      ],
    });

    expect(findings.length).toBe(1);
    expect(findings[0]?.file).toBe("apps/web/package.json");
    expect(findings[0]?.message).toContain("Replace the specifier with catalog:");
  });

  it("names the catalog that holds the version when it is not the default one", () => {
    const findings = findingsFor({
      catalogEntries: [{ catalogName: "legacy", dependencyName: "react", version: "^18.0.0" }],
      usages: [
        {
          dependencyName: "react",
          catalogReferences: [],
          directReferences: [{ manifestPath: "apps/web/package.json", specifier: "^18.0.0" }],
        },
      ],
    });

    expect(findings[0]?.message).toContain("catalog:legacy");
  });

  it("reports a direct pin that disagrees with the catalog", () => {
    const findings = findingsFor({
      catalogEntries: [{ catalogName: "", dependencyName: "react", version: "^19.0.0" }],
      usages: [
        {
          dependencyName: "react",
          catalogReferences: [],
          directReferences: [{ manifestPath: "apps/web/package.json", specifier: "^18.0.0" }],
        },
      ],
    });

    expect(findings.length).toBe(1);
    expect(findings[0]?.file).toBe("apps/web/package.json");
    expect(findings[0]?.message).toContain("^18.0.0");
    expect(findings[0]?.message).toContain("^19.0.0");
    expect(findings[0]?.message).toContain("Choose the intended version");
  });

  it("leaves a dependency that no catalog holds to the shared-dependency check", () => {
    const findings = findingsFor({
      catalogEntries: [{ catalogName: "", dependencyName: "react", version: "^19.0.0" }],
      usages: [
        {
          dependencyName: "typescript",
          catalogReferences: [],
          directReferences: [{ manifestPath: "apps/web/package.json", specifier: "^5.0.0" }],
        },
      ],
    });

    expect(findings).toStrictEqual([]);
  });
});
