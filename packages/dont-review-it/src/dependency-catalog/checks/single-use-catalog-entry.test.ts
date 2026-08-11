import { describe, expect, it } from "vite-plus/test";

import { singleUseCatalogEntryFindings } from "./single-use-catalog-entry.ts";

import type { DependencyUsage } from "../dependency-usage.ts";
import type { CatalogEntry, OverrideCatalogReference } from "../workspace-definition.ts";

const DEFINITION_PATH = "pnpm-workspace.yaml";

const REACT_ENTRY: CatalogEntry = {
  catalogName: "",
  dependencyName: "react",
  version: "^19.0.0",
};

const findingsFor = ({
  usages,
  overrideReferences = [],
}: {
  readonly usages: readonly DependencyUsage[];
  readonly overrideReferences?: readonly OverrideCatalogReference[];
}) =>
  singleUseCatalogEntryFindings({
    catalogEntries: [REACT_ENTRY],
    definitionPath: DEFINITION_PATH,
    usages,
    overrideReferences,
  });

describe("singleUseCatalogEntryFindings", () => {
  it("reports the entry that only one manifest references", () => {
    const findings = findingsFor({
      usages: [
        {
          dependencyName: "react",
          catalogReferences: [{ manifestPath: "apps/web/package.json", catalogName: "" }],
          directReferences: [],
        },
      ],
    });

    expect(findings.length).toBe(1);
    expect(findings[0]?.entry).toBe(REACT_ENTRY);
    expect(findings[0]?.problem.file).toBe(DEFINITION_PATH);
    expect(findings[0]?.problem.message).toContain("apps/web/package.json");
    expect(findings[0]?.problem.message).toContain("^19.0.0");
  });

  it("counts a direct pin of the same version as a second user", () => {
    const findings = findingsFor({
      usages: [
        {
          dependencyName: "react",
          catalogReferences: [{ manifestPath: "apps/web/package.json", catalogName: "" }],
          directReferences: [{ manifestPath: "package.json", specifier: "^19.0.0" }],
        },
      ],
    });

    expect(findings).toStrictEqual([]);
  });

  it("leaves an entry alone when a reference points at another catalog", () => {
    const findings = findingsFor({
      usages: [
        {
          dependencyName: "react",
          catalogReferences: [{ manifestPath: "apps/web/package.json", catalogName: "legacy" }],
          directReferences: [],
        },
      ],
    });

    expect(findings).toStrictEqual([]);
  });

  it("leaves an entry that nothing references to the unused-dependency tooling", () => {
    expect(findingsFor({ usages: [] })).toStrictEqual([]);
  });

  it("leaves an entry alone when an override references the catalog for it", () => {
    const findings = findingsFor({
      usages: [
        {
          dependencyName: "react",
          catalogReferences: [{ manifestPath: "apps/web/package.json", catalogName: "" }],
          directReferences: [],
        },
      ],
      overrideReferences: [{ catalogName: "", dependencyName: "react" }],
    });

    expect(findings).toStrictEqual([]);
  });

  it("reports an entry whose name an override references from another catalog", () => {
    const findings = findingsFor({
      usages: [
        {
          dependencyName: "react",
          catalogReferences: [{ manifestPath: "apps/web/package.json", catalogName: "" }],
          directReferences: [],
        },
      ],
      overrideReferences: [{ catalogName: "legacy", dependencyName: "react" }],
    });

    expect(findings.length).toBe(1);
  });

  it("leaves an entry alone when a second manifest also references it", () => {
    const findings = findingsFor({
      usages: [
        {
          dependencyName: "react",
          catalogReferences: [
            { manifestPath: "apps/web/package.json", catalogName: "" },
            { manifestPath: "package.json", catalogName: "" },
          ],
          directReferences: [],
        },
      ],
    });

    expect(findings).toStrictEqual([]);
  });
});
