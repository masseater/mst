import { dirname, resolve } from "node:path";

import { createDontReviewItRule } from "../../../../create-rule.ts";
import { nearestPackageDirectory } from "../../lib/canonical-values/source-files.ts";
import { findWorkspaceRoot } from "../../lib/canonical-values/workspace-root.ts";
import {
  coverageDeclarationsFrom,
  DECLARED_COVERAGE_SCHEMA,
} from "../../lib/declared-coverage/coverage-declarations.ts";
import { coverageFindingsIn } from "../../lib/declared-coverage/reconciliation.ts";
import {
  DEAD_REGISTRATION_MESSAGE_ID,
  EXCLUDED_REGISTRATION_MESSAGE_ID,
  UNDECLARED_RECEIVER_MESSAGE_ID,
  UNOPENED_REGISTRATION_MESSAGE_ID,
} from "../../lib/declared-coverage/registration-reach.ts";
import { UNREGISTERED_SCOPE_REACH_MESSAGE_ID } from "../../lib/declared-coverage/scope-closure.ts";
import {
  BROAD_UNCHECKED_DECLARATION_MESSAGE_ID,
  UNCHECKED_AUTHORED_PATH_MESSAGE_ID,
} from "../../lib/declared-coverage/uncovered-paths.ts";
import {
  REPOSITORY_ROOT_WORKSPACE,
  workspaceDirectoryOf,
} from "../../lib/dependency-catalog/shared-dependency-index.ts";
import { unscannedDirectoryNamesFrom } from "../../lib/repository-scan/worktree-files.ts";

import type { ESTree } from "@oxlint/plugins";

const holdingWorkspaceOf = (asked: {
  readonly repositoryRoot: string;
  readonly fileDirectory: string;
}): string => {
  const packageDirectory = nearestPackageDirectory(asked.fileDirectory, asked.repositoryRoot);
  return packageDirectory === null
    ? REPOSITORY_ROOT_WORKSPACE
    : workspaceDirectoryOf({ repositoryRoot: asked.repositoryRoot, packageDirectory });
};

export const noUncheckedAuthoredPath = createDontReviewItRule({
  name: "no-unchecked-authored-path--include-it-in-every-declared-check",
  meta: {
    type: "problem",
    docs: {
      description:
        "Require every authored path to sit inside a check this repository declares, and every registration row to sit inside the check that consumes it, so a check that opens nothing is reported instead of passing for a check that found nothing",
      relatedGuidelines: [],
    },
    messages: {
      [UNCHECKED_AUTHORED_PATH_MESSAGE_ID]:
        "An authored path must not sit outside every check this repository declares. `{{authoredPath}}` is opened by none of {{declaredChecks}}. Add it to the paths one of those checks opens, or declare its extension among the paths no check reads and write the reason on that declaration.",
      [BROAD_UNCHECKED_DECLARATION_MESSAGE_ID]:
        "A declaration of paths no check reads must not cover a whole directory. `{{pattern}}` names a directory rather than an extension or a single path. Split it into the extensions carried under that directory, or name each path this repository leaves unread.",
      [EXCLUDED_REGISTRATION_MESSAGE_ID]:
        "A registration row must not aim at paths the check that consumes it leaves out. Row `{{pattern}}` of {{registry}} matches `{{matchedPath}}`, and `{{check}}` leaves that path out through {{exclusion}}. Move the row to a registry that a check reading those paths consumes, or take that exclusion out of `{{check}}`.",
      [UNOPENED_REGISTRATION_MESSAGE_ID]:
        "A registration row must not aim at paths the check that consumes it never opens. Row `{{pattern}}` of {{registry}} matches `{{matchedPath}}`, and `{{check}}` opens only {{coveredPaths}}. Move the row to a registry that a check reading those paths consumes, or add that path to the paths `{{check}}` opens.",
      [DEAD_REGISTRATION_MESSAGE_ID]:
        "A row that allows an exception must not stand for files this repository does not hold. Row `{{pattern}}` of {{registry}} matches no authored path, and it states: {{reason}}. Delete the row, or move the pattern to the path that took the exception over.",
      [UNDECLARED_RECEIVER_MESSAGE_ID]:
        "A record must not name a receiver this repository does not declare. {{record}} names `{{receiver}}`, and the declared checks are {{declaredChecks}}. Declare that receiver among them, or delete the record and take the duty back.",
      [UNREGISTERED_SCOPE_REACH_MESSAGE_ID]:
        "A file that a registered file reaches must not stay outside the scope registration. `{{reachingPath}}` reaches `{{reachedPath}}`, and the registration for `{{scope}}` leaves it out. Register the reached path in that scope, or delete the coupling that reaches it.",
    },
    schema: DECLARED_COVERAGE_SCHEMA,
  },
  create(inspection) {
    const declarations = coverageDeclarationsFrom(inspection.options);
    if (declarations.checks.length === 0) return {};

    return {
      Program(node: ESTree.Program) {
        const fileDirectory = dirname(resolve(inspection.cwd, inspection.filename));
        const repositoryRoot = findWorkspaceRoot(fileDirectory);
        const held = coverageFindingsIn({
          repositoryRoot,
          declarations,
          unscannedDirectoryNames: unscannedDirectoryNamesFrom(inspection.options),
        });
        const findings = held.get(holdingWorkspaceOf({ repositoryRoot, fileDirectory })) ?? [];

        for (const finding of findings) {
          inspection.report({ node, messageId: finding.messageId, data: finding.data });
        }
      },
    };
  },
});
