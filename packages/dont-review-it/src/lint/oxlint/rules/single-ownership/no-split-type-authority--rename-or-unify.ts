import { relative, resolve } from "node:path";

import { memoize } from "es-toolkit";

import { createDontReviewItRule } from "../../../../create-rule.ts";
import { findWorkspaceRoot } from "../../lib/canonical-values/workspace-root.ts";
import { statementCovering } from "../../lib/duplicated-bodies/site-report.ts";
import { isOutOfScopeSource } from "../../lib/out-of-scope-source.ts";
import { toPosixPath } from "../../lib/posix-path.ts";
import {
  SPLIT_NAME_MESSAGE_ID,
  SPLIT_SHAPE_MESSAGE_ID,
  splitTypeReportsIn,
} from "../../lib/split-type-authority/split-reports.ts";

import type { WorkspaceLintRule } from "@mst/lint-rule-authoring";
import type { ESTree } from "@oxlint/plugins";
import type { TypeAuthorityIndexLoader } from "../../lib/split-type-authority/authority-index.ts";

export const createNoSplitTypeAuthority = ({
  loadIndex,
}: {
  readonly loadIndex: TypeAuthorityIndexLoader;
}): WorkspaceLintRule =>
  createDontReviewItRule({
    name: "no-split-type-authority--rename-or-unify",
    meta: {
      type: "problem",
      docs: {
        description:
          "Disallow an exported type whose name carries a second shape inside its workspace, or whose non-trivial shape carries a second name inside the repository, so a name and a structure keep pointing at each other one to one",
        relatedGuidelines: [],
      },
      messages: {
        [SPLIT_SHAPE_MESSAGE_ID]:
          "One name must not stand for two shapes. `{{name}}` is also declared with a different shape at {{sites}} of this workspace. Read both declarations, decide whether they name one concept, and land on a single shape for `{{name}}` or on a separate name for each shape. Shifting one shape until the two stop matching leaves the split standing.",
        [SPLIT_NAME_MESSAGE_ID]:
          "One shape must not stand for two names. `{{name}}` repeats a structure this repository also declares at {{sites}}. Read both declarations, decide whether they name one concept, and keep a single declaration to import everywhere or put the difference between them into the types. Adding a member until the two stop matching leaves the split standing.",
      },
      schema: [],
    },
    create(inspection) {
      if (isOutOfScopeSource(inspection.filename)) return {};

      const repositoryRootOf = memoize((): string => findWorkspaceRoot(inspection.cwd));

      return {
        Program(node: ESTree.Program) {
          const repositoryRoot = repositoryRootOf();
          const reports = splitTypeReportsIn({
            index: loadIndex({ repositoryRoot }),
            relativePath: toPosixPath(relative(repositoryRoot, resolve(inspection.filename))),
          });

          for (const report of reports) {
            inspection.report({
              node: statementCovering(node.body, report.line) ?? node,
              messageId: report.messageId,
              data: report.data,
            });
          }
        },
      };
    },
  });
