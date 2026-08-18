import { relative, resolve } from "node:path";

import { memoize } from "es-toolkit";

import { createDontReviewItRule } from "../../../../create-rule.ts";
import { findWorkspaceRoot } from "../../lib/canonical-values/workspace-root.ts";
import { statementCovering } from "../../lib/duplicated-bodies/site-report.ts";
import { isOutOfScopeSource } from "../../lib/out-of-scope-source.ts";
import { toPosixPath } from "../../lib/posix-path.ts";
import {
  duplicateValueReportsIn,
  type ValueDeclarationIndexLoader,
  type ValueSite,
} from "../../lib/value-declarations/declaration-index.ts";

import type { WorkspaceLintRule } from "@mst/lint-rule-authoring";
import type { ESTree } from "@oxlint/plugins";

const EXPORTED_MARK = "exported";

const KEPT_LOCAL_MARK = "not exported";

const spellRivals = (sites: readonly ValueSite[]): string =>
  sites
    .map(
      (site) =>
        `${site.relativePath}:${site.line} (${site.exported ? EXPORTED_MARK : KEPT_LOCAL_MARK})`,
    )
    .join(", ");

export const createNoDuplicateValueDeclaration = ({
  loadIndex,
}: {
  readonly loadIndex: ValueDeclarationIndexLoader;
}): WorkspaceLintRule =>
  createDontReviewItRule({
    name: "no-duplicate-value-declaration--reuse-authoritative-value",
    meta: {
      type: "problem",
      docs: {
        description:
          "Disallow a constant, function, or class declared under a name another declaration in the repository binds to the same body, so one value keeps one owner instead of drifting between copies",
        relatedGuidelines: ["docs/guidelines/writing-code.md"],
      },
      messages: {
        duplicateValueDeclaration:
          "A value must not be declared under a name that another declaration in this repository binds to the same body. `{{name}}` stands with the same body at {{sites}}. Decide which module owns the value, export it from there, and import it at every other place before those declarations go away. Renaming one side, or respelling its body, leaves two owners standing.",
        hiddenExportedValue:
          "A value must not be re-declared under a name this repository already exports. `{{name}}` is exported with the same body at {{sites}}, so this declaration hides that one from every reader of this file. Decide which of the two modules owns the value, export it from there, and import it here before this declaration goes away.",
      },
      schema: [],
    },
    create(inspection) {
      if (isOutOfScopeSource(inspection.filename)) return {};

      const repositoryRootOf = memoize((): string => findWorkspaceRoot(inspection.cwd));

      return {
        Program(node: ESTree.Program) {
          const repositoryRoot = repositoryRootOf();
          const reports = duplicateValueReportsIn({
            index: loadIndex({ repositoryRoot }),
            relativePath: toPosixPath(relative(repositoryRoot, resolve(inspection.filename))),
          });

          for (const report of reports) {
            inspection.report({
              node: statementCovering(node.body, report.site.line) ?? node,
              messageId: report.site.exported ? "duplicateValueDeclaration" : "hiddenExportedValue",
              data: { name: report.site.name, sites: spellRivals(report.matches) },
            });
          }
        },
      };
    },
  });
