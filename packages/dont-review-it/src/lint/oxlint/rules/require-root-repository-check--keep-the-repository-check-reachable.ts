import { dirname, join, resolve } from "node:path";

import { recordOf } from "../../../dependency-catalog/record-fields.ts";
import {
  DONT_REVIEW_IT_CHECK_COMMAND_MESSAGE,
  rootDontReviewItCheckInvocationMessagesIn,
} from "../../../test-execution/root-test-invocation.ts";
import { createDontReviewItRule } from "../../../create-rule.ts";
import { findWorkspaceRoot } from "../lib/canonical-values/workspace-root.ts";
import { readJsonFile } from "../lib/canonical-values/read-json-file.ts";

import type { ESTree } from "@oxlint/plugins";

const ROOT_CONFIG_FILE_NAME = "vite.config.ts";

export const requireRootRepositoryCheck = createDontReviewItRule({
  name: "require-root-repository-check--keep-the-repository-check-reachable",
  meta: {
    type: "problem",
    docs: {
      description:
        "Require the root guard to invoke the repository check that inspects whether the lint gate remains reachable",
      relatedGuidelines: [],
    },
    messages: {
      unreachableRepositoryCheck: DONT_REVIEW_IT_CHECK_COMMAND_MESSAGE,
    },
    schema: [],
  },
  create(inspection) {
    return {
      Program(node: ESTree.Program) {
        const inspectedPath = resolve(inspection.cwd, inspection.filename);
        const repositoryRoot = findWorkspaceRoot(dirname(inspectedPath));
        if (inspectedPath !== join(repositoryRoot, ROOT_CONFIG_FILE_NAME)) return;

        const manifest = recordOf(readJsonFile(join(repositoryRoot, "package.json")));
        const scripts = recordOf(manifest.scripts);
        if (rootDontReviewItCheckInvocationMessagesIn(scripts).length === 0) return;

        inspection.report({ node, messageId: "unreachableRepositoryCheck" });
      },
    };
  },
});
