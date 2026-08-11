import { dirname, resolve } from "node:path";

import { createDontReviewItRule } from "../../../create-rule.ts";
import { nearestPackageDirectory } from "../lib/canonical-values/source-files.ts";
import { findWorkspaceRoot } from "../lib/canonical-values/workspace-root.ts";
import { workspaceDirectoryOf } from "../lib/dependency-catalog/shared-dependency-index.ts";
import {
  REQUIRED_FILE_SCHEMA,
  requiredFilesFrom,
} from "../lib/registered-files/required-file-entries.ts";
import {
  DEAD_OWNER_REGISTRATION_MESSAGE_ID,
  EMPTY_REGISTERED_FILE_MESSAGE_ID,
  MISSING_REGISTERED_FILE_MESSAGE_ID,
  unmetRegistrationsIn,
} from "../lib/registered-files/unmet-registrations.ts";
import { unscannedDirectoryNamesFrom } from "../lib/repository-scan/worktree-files.ts";

import type { ESTree } from "@oxlint/plugins";

export const requireRegisteredFile = createDontReviewItRule({
  name: "require-registered-file--restore-it-at-the-registered-path",
  meta: {
    type: "problem",
    docs: {
      description:
        "Require every path the required-file table registers to hold a file that is not empty, so a file whose readers sit outside the source keeps its place instead of leaving with the change that stopped mentioning it",
      relatedGuidelines: [],
    },
    messages: {
      [MISSING_REGISTERED_FILE_MESSAGE_ID]:
        "A path the required-file table registers must not stand without a file. Write the file at `{{registeredPath}}`, which {{holder}} is registered to hold, and put in it what the row asks for: {{reason}}. Delete the row instead to retire the requirement, and record that judgement in the commit message. A file that holds nothing is reported the same way. {{contentGuarantee}}",
      [EMPTY_REGISTERED_FILE_MESSAGE_ID]:
        "A file the required-file table registers must not hold nothing. Write into `{{registeredPath}}` under {{holder}} what the row asks for: {{reason}}. Delete the file and the row instead to retire the requirement, and record that judgement in the commit message. {{contentGuarantee}}",
      [DEAD_OWNER_REGISTRATION_MESSAGE_ID]:
        "A row of the required-file table must not name an owner this repository does not have. Delete the row, or point it at the workspace that took over what the row asks for: {{reason}}. {{holder}} matches no workspace, so `{{registeredPath}}` is asked of nobody. Record that judgement in the commit message.",
    },
    schema: REQUIRED_FILE_SCHEMA,
  },
  create(context) {
    const entries = requiredFilesFrom(context.options);
    if (entries.length === 0) return {};

    return {
      Program(node: ESTree.Program) {
        const fileDirectory = dirname(resolve(context.cwd, context.filename));
        const repositoryRoot = findWorkspaceRoot(fileDirectory);
        const packageDirectory = nearestPackageDirectory(fileDirectory, repositoryRoot);
        if (packageDirectory === null) return;

        const unmet = unmetRegistrationsIn({
          repositoryRoot,
          entries,
          unscannedDirectoryNames: unscannedDirectoryNamesFrom(context.options),
        });
        const held = unmet.get(workspaceDirectoryOf({ repositoryRoot, packageDirectory })) ?? [];
        for (const report of held) {
          context.report({ node, messageId: report.messageId, data: report.data });
        }
      },
    };
  },
});
