import { createDontReviewItRule } from "../../../../create-rule.ts";
import {
  declaringWorkspaceOf,
  type DeclaringWorkspace,
} from "../../lib/dependency-catalog/declaring-workspace.ts";
import {
  rangedCatalogEntries,
  rangedManifestDeclarations,
} from "../../lib/dependency-catalog/ranged-version-index.ts";
import {
  REPOSITORY_ROOT_WORKSPACE,
  type WorkspaceDependenciesLoader,
} from "../../lib/dependency-catalog/shared-dependency-index.ts";

import type { WorkspaceLintRule } from "@mst/lint-rule-authoring";
import type { Context, ESTree } from "@oxlint/plugins";
import type { CatalogEntriesLoader } from "../../lib/dependency-catalog/catalog-entries.ts";
import type { DeclaredDependency } from "../../lib/dependency-catalog/declared-dependencies.ts";

const dataOf = ({ packageName, declaredVersion }: DeclaredDependency): Record<string, string> => ({
  packageName,
  declaredVersion,
});

const intentionalRangesFrom = (ruleOptions: Context["options"]): ReadonlySet<string> =>
  new Set(
    ((ruleOptions[0] ?? {}) as { readonly intentionalRanges?: readonly string[] })
      .intentionalRanges ?? [],
  );

export const createNoVersionRange = ({
  loadWorkspaces,
  loadCatalog,
}: {
  readonly loadWorkspaces: WorkspaceDependenciesLoader;
  readonly loadCatalog: CatalogEntriesLoader;
}): WorkspaceLintRule =>
  createDontReviewItRule({
    name: "no-version-range--pin-the-exact-version",
    meta: {
      type: "problem",
      docs: {
        description:
          "Disallow every dependency version that matches more than one release, in workspace manifests and in the catalog alike, so the release a workspace installs is decided by the declaration instead of by the moment the install ran",
        relatedGuidelines: [],
      },
      messages: {
        rangedManifestVersion:
          "A dependency version that matches more than one release must not stand in a manifest. `{{packageName}}` is declared as `{{declaredVersion}}` in `{{workspace}}`. Write the single release this repository installs in place of the range.",
        rangedCatalogVersion:
          "A catalog listed that matches more than one release is forbidden. `{{packageName}}` is registered as `{{declaredVersion}}`. Write the single release this repository installs in place of the range.",
      },
      schema: [
        {
          type: "object",
          properties: {
            intentionalRanges: { type: "array", items: { type: "string" } },
          },
          additionalProperties: false,
        },
      ],
    },
    create(carried: Context) {
      const intentionalRanges = intentionalRangesFrom(carried.options);

      const reportManifest = ({
        node,
        declaring,
      }: {
        readonly node: ESTree.Program;
        readonly declaring: DeclaringWorkspace;
      }): void => {
        const index = rangedManifestDeclarations({
          workspaces: loadWorkspaces({ repositoryRoot: declaring.repositoryRoot }),
          intentionalRanges,
        });
        for (const declaration of index.get(declaring.relativeDir) ?? []) {
          carried.report({
            node,
            messageId: "rangedManifestVersion",
            data: { ...dataOf(declaration), workspace: declaring.relativeDir },
          });
        }
      };

      const reportCatalog = ({
        node,
        repositoryRoot,
      }: {
        readonly node: ESTree.Program;
        readonly repositoryRoot: string;
      }): void => {
        const listedEntries = rangedCatalogEntries({
          catalogEntries: loadCatalog({ repositoryRoot }),
          intentionalRanges,
        });
        for (const listed of listedEntries) {
          carried.report({ node, messageId: "rangedCatalogVersion", data: dataOf(listed) });
        }
      };

      return {
        Program(node: ESTree.Program) {
          const declaring = declaringWorkspaceOf(carried);
          if (declaring === null) return;

          reportManifest({ node, declaring });
          if (declaring.relativeDir !== REPOSITORY_ROOT_WORKSPACE) return;
          reportCatalog({ node, repositoryRoot: declaring.repositoryRoot });
        },
      };
    },
  });
