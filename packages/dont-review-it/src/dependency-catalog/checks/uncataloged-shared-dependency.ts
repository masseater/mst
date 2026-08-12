import { uniq } from "es-toolkit";

import { NO_DEPENDENCY_CATALOG_FINDINGS, type DependencyCatalogFindings } from "../problem.ts";

import type { DependencyCatalogChecksConfig } from "../config.ts";
import type { DependencyUsage } from "../dependency-usage.ts";

const findingsForUsage = ({
  usage,
  definitionPath,
  config,
}: {
  readonly usage: DependencyUsage;
  readonly definitionPath: string;
  readonly config: DependencyCatalogChecksConfig;
}): DependencyCatalogFindings => {
  const manifestPaths = uniq(usage.directReferences.map((reference) => reference.manifestPath));
  if (manifestPaths.length < 2) return NO_DEPENDENCY_CATALOG_FINDINGS;

  const specifiers = uniq(usage.directReferences.map((reference) => reference.specifier));

  if (specifiers.length === 1) {
    return [
      {
        file: definitionPath,
        line: null,
        message: `${usage.dependencyName} must not be pinned to ${specifiers.join(", ")} separately by ${manifestPaths.join(" and ")}, because pins that repeat drift apart silently. Add ${usage.dependencyName} to the catalog and reference it with ${config.catalogProtocol} from each manifest.`,
      },
    ];
  }

  const pins = usage.directReferences
    .map((reference) => `${reference.manifestPath} pins ${reference.specifier}`)
    .join(", ");

  return [
    {
      file: definitionPath,
      line: null,
      message: `${usage.dependencyName} is pinned to different specifiers: ${pins}. Choose the intended version, add it to the catalog, and reference it with ${config.catalogProtocol} from every listed manifest.`,
    },
  ];
};

export const sharedDependencyFindings = ({
  usages,
  catalogedNames,
  definitionPath,
  config,
}: {
  readonly usages: readonly DependencyUsage[];
  readonly catalogedNames: readonly string[];
  readonly definitionPath: string;
  readonly config: DependencyCatalogChecksConfig;
}): DependencyCatalogFindings => {
  return usages
    .filter((usage) => !catalogedNames.includes(usage.dependencyName))
    .flatMap((usage) => findingsForUsage({ usage, definitionPath, config }));
};
