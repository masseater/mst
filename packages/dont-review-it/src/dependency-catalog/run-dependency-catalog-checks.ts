import { join } from "node:path";

import { attempt } from "es-toolkit";

import { readTextFile } from "../lint/oxlint/lib/canonical-values/source-files.ts";
import { bypassedCatalogFindings } from "./checks/bypassed-catalog-entry.ts";
import { singleUseCatalogEntryFindings } from "./checks/single-use-catalog-entry.ts";
import { sharedDependencyFindings } from "./checks/uncataloged-shared-dependency.ts";
import { dependencyUsagesIn } from "./dependency-usage.ts";
import { dependencyReferencesIn } from "./manifest-dependencies.ts";
import { readWorkspaceManifests, type WorkspaceManifest } from "./manifest-files.ts";
import {
  NO_DEPENDENCY_CATALOG_FINDINGS,
  type DependencyCatalogFindings,
  type DependencyCatalogProblem,
} from "./problem.ts";
import { recordOf } from "./record-fields.ts";
import {
  catalogReferencingOverridesIn,
  parseWorkspaceDefinition,
  type OverrideCatalogReference,
  type WorkspaceDefinition,
} from "./workspace-definition.ts";

import type { DependencyCatalogChecksConfig } from "./config.ts";

const byFileThenMessage = (
  left: DependencyCatalogProblem,
  right: DependencyCatalogProblem,
): number =>
  left.file === right.file
    ? left.message.localeCompare(right.message)
    : left.file.localeCompare(right.file);

const parsedDefinitionOrNull = ({
  source,
  config,
}: {
  readonly source: string;
  readonly config: DependencyCatalogChecksConfig;
}): WorkspaceDefinition | null => {
  const [unparsableSource, definition] = attempt(() =>
    parseWorkspaceDefinition({ source, config }),
  );
  return unparsableSource === null ? definition : null;
};

const rootOverrideReferences = ({
  manifests,
  config,
}: {
  readonly manifests: readonly WorkspaceManifest[];
  readonly config: DependencyCatalogChecksConfig;
}): readonly OverrideCatalogReference[] => {
  const rootManifest = manifests.find(
    (candidate) => candidate.relativePath === config.manifestFileName,
  );
  const settings = recordOf(recordOf(rootManifest?.manifest)[config.rootManifestSettingsKey]);
  return catalogReferencingOverridesIn({ overrides: settings[config.overridesKey], config });
};

const findingsIn = ({
  repositoryRoot,
  definition,
  definitionPath,
  config,
}: {
  readonly repositoryRoot: string;
  readonly definition: WorkspaceDefinition;
  readonly definitionPath: string;
  readonly config: DependencyCatalogChecksConfig;
}): DependencyCatalogFindings => {
  const manifests = readWorkspaceManifests({
    repositoryRoot,
    packagePatterns: definition.packagePatterns,
    config,
  });
  const usages = dependencyUsagesIn({
    references: manifests.flatMap((workspaceManifest) =>
      dependencyReferencesIn({
        manifestPath: workspaceManifest.relativePath,
        manifest: workspaceManifest.manifest,
        config,
      }),
    ),
    config,
  });
  const overrideReferences = [
    ...definition.catalogReferencingOverrides,
    ...rootOverrideReferences({ manifests, config }),
  ];

  const singleUse = singleUseCatalogEntryFindings({
    catalogEntries: definition.catalogEntries,
    definitionPath,
    usages,
    overrideReferences,
  });
  const singleUseEntries = singleUse.map((finding) => finding.entry);
  const bypassed = bypassedCatalogFindings({
    catalogEntries: definition.catalogEntries.filter((entry) => !singleUseEntries.includes(entry)),
    usages,
    config,
  });
  const shared = sharedDependencyFindings({
    usages,
    catalogedNames: definition.catalogEntries.map((entry) => entry.dependencyName),
    definitionPath,
    config,
  });

  return [...singleUse.map((finding) => finding.problem), ...bypassed, ...shared].toSorted(
    byFileThenMessage,
  );
};

export const runDependencyCatalogChecks = ({
  repositoryRoot,
  config,
}: {
  readonly repositoryRoot: string;
  readonly config: DependencyCatalogChecksConfig;
}): DependencyCatalogFindings => {
  const definitionPath = config.workspaceDefinitionFileName;
  const source = readTextFile(join(repositoryRoot, definitionPath));
  if (source === null) return NO_DEPENDENCY_CATALOG_FINDINGS;

  const definition = parsedDefinitionOrNull({ source, config });
  if (definition === null) {
    return [
      {
        file: definitionPath,
        line: null,
        message: `A workspace definition that does not parse must not stay in the repository, because every dependency check reads it as an empty file and reports nothing. Fix the YAML here so the definition can be read.`,
      },
    ];
  }

  return findingsIn({ repositoryRoot, definition, definitionPath, config });
};
