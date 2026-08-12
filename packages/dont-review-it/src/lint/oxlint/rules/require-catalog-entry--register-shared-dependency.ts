import { createDontReviewItRule } from "../../../create-rule.ts";
import {
  CATALOG_ENTRY_SCHEMA,
  catalogFrom,
  deviationsFrom,
} from "../lib/dependency-catalog/catalog-options.ts";
import { declaringWorkspaceOf } from "../lib/dependency-catalog/declaring-workspace.ts";
import {
  describeSites,
  sharedDependencyIndex,
  type UnregisteredSharedDependency,
  type WorkspaceDependenciesLoader,
} from "../lib/dependency-catalog/shared-dependency-index.ts";

import type { WorkspaceLintRule } from "@mst/lint-rule-authoring";
import type { Context, ESTree } from "@oxlint/plugins";

const unregisteredSharedFor = (lookup: {
  readonly context: Context;
  readonly loadWorkspaces: WorkspaceDependenciesLoader;
}): readonly UnregisteredSharedDependency[] => {
  const { context, loadWorkspaces } = lookup;
  const declaring = declaringWorkspaceOf(context);
  if (declaring === null) return [];

  const index = sharedDependencyIndex({
    workspaces: loadWorkspaces({ repositoryRoot: declaring.repositoryRoot }),
    catalog: catalogFrom(context.options),
    deviations: deviationsFrom(context.options),
  });
  return index.get(declaring.relativeDir) ?? [];
};

export const createRequireCatalogEntry = ({
  loadWorkspaces,
}: {
  readonly loadWorkspaces: WorkspaceDependenciesLoader;
}): WorkspaceLintRule =>
  createDontReviewItRule({
    name: "require-catalog-entry--register-shared-dependency",
    meta: {
      type: "problem",
      docs: {
        description:
          "Require every package that more than one workspace declares to be registered in the catalog, so the version they resolve to is decided in one place instead of workspace by workspace",
        relatedGuidelines: [],
      },
      messages: {
        unregisteredSharedDependency:
          "A package that more than one workspace declares must not stay outside the catalog. `{{packageName}}` is declared by {{sites}}. Decide which version all of them take, register `{{packageName}}` in the catalog at that version, then replace every declared value with the catalog reference.",
      },
      schema: CATALOG_ENTRY_SCHEMA,
    },
    create(context) {
      if (catalogFrom(context.options).size === 0) return {};

      return {
        Program(node: ESTree.Program) {
          for (const entry of unregisteredSharedFor({ context, loadWorkspaces })) {
            context.report({
              node,
              messageId: "unregisteredSharedDependency",
              data: { packageName: entry.packageName, sites: describeSites(entry.sites) },
            });
          }
        },
      };
    },
  });
