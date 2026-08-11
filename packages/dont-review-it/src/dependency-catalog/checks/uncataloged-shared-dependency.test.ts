import { describe, expect, it } from "vite-plus/test";

import { defaultDependencyCatalogChecksConfig } from "../config.ts";
import { sharedDependencyFindings } from "./uncataloged-shared-dependency.ts";

import type { DependencyUsage } from "../dependency-usage.ts";

const config = defaultDependencyCatalogChecksConfig;

const DEFINITION_PATH = "pnpm-workspace.yaml";

const findingsFor = ({
  usages,
  catalogedNames = [],
}: {
  readonly usages: readonly DependencyUsage[];
  readonly catalogedNames?: readonly string[];
}) => sharedDependencyFindings({ usages, catalogedNames, definitionPath: DEFINITION_PATH, config });

describe("sharedDependencyFindings", () => {
  it("reports a version that two manifests pin outside the catalog", () => {
    const { problems, warnings } = findingsFor({
      usages: [
        {
          dependencyName: "typescript",
          catalogReferences: [],
          directReferences: [
            { manifestPath: "apps/web/package.json", specifier: "^5.0.0" },
            { manifestPath: "packages/repository-checks/package.json", specifier: "^5.0.0" },
          ],
        },
      ],
    });

    expect(warnings).toStrictEqual([]);
    expect(problems.length).toBe(1);
    expect(problems[0]?.file).toBe(DEFINITION_PATH);
    expect(problems[0]?.message).toContain("apps/web/package.json");
    expect(problems[0]?.message).toContain("packages/repository-checks/package.json");
    expect(problems[0]?.message).toContain("^5.0.0");
  });

  it("warns instead when the pinned versions disagree", () => {
    const { problems, warnings } = findingsFor({
      usages: [
        {
          dependencyName: "typescript",
          catalogReferences: [],
          directReferences: [
            { manifestPath: "apps/web/package.json", specifier: "^5.0.0" },
            { manifestPath: "packages/repository-checks/package.json", specifier: "^5.5.0" },
          ],
        },
      ],
    });

    expect(problems).toStrictEqual([]);
    expect(warnings.length).toBe(1);
    expect(warnings[0]?.message).toContain("apps/web/package.json pins ^5.0.0");
    expect(warnings[0]?.message).toContain("packages/repository-checks/package.json pins ^5.5.0");
  });

  it("leaves a version that only one manifest pins alone", () => {
    const { problems, warnings } = findingsFor({
      usages: [
        {
          dependencyName: "typescript",
          catalogReferences: [],
          directReferences: [{ manifestPath: "apps/web/package.json", specifier: "^5.0.0" }],
        },
      ],
    });

    expect(problems).toStrictEqual([]);
    expect(warnings).toStrictEqual([]);
  });

  it("leaves a dependency that the catalog holds to the catalog checks", () => {
    const { problems, warnings } = findingsFor({
      usages: [
        {
          dependencyName: "typescript",
          catalogReferences: [],
          directReferences: [
            { manifestPath: "apps/web/package.json", specifier: "^5.0.0" },
            { manifestPath: "packages/repository-checks/package.json", specifier: "^5.0.0" },
          ],
        },
      ],
      catalogedNames: ["typescript"],
    });

    expect(problems).toStrictEqual([]);
    expect(warnings).toStrictEqual([]);
  });
});
