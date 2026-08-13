import { dirname, relative, resolve } from "node:path";

import { createDontReviewItRule } from "../../../create-rule.ts";
import { findWorkspaceRoot } from "../lib/canonical-values/workspace-root.ts";
import { toPosixPath } from "../lib/posix-path.ts";
import { unscannedDirectoryNamesFrom } from "../lib/repository-scan/worktree-files.ts";
import {
  FOREIGN_FILE_IN_SPEC_DIRECTORY_MESSAGE_ID,
  foreignFilesIn,
  holdingWorkspaceOf,
} from "../lib/spec-directory-contents/foreign-files.ts";
import { assetsNameMarkersFrom } from "../lib/spec-syntax/assets-files.ts";
import { specDirectoryNamesFrom } from "../lib/spec-syntax/spec-directories.ts";
import { specFileSuffixesFrom } from "../lib/spec-syntax/spec-files.ts";

import type { ESTree } from "@oxlint/plugins";

export const requireSpecOrAssetsOnlyInSpecDirectory = createDontReviewItRule({
  name: "require-spec-or-assets-only-in-spec-directory--move-out-or-inline",
  meta: {
    type: "problem",
    docs: {
      description:
        "Require every file under a directory named for specs to be a spec or the test data one of those specs owns, so setup carved out of a spec is reported where it sits instead of only where a spec imports it",
      relatedGuidelines: [],
    },
    messages: {
      [FOREIGN_FILE_IN_SPEC_DIRECTORY_MESSAGE_ID]:
        "A directory named for specs must not hold a file that is neither a spec nor test data. `{{foreignPath}}` sits under `{{specDirectory}}`, which holds only files named {{specNames}} and files named {{assetsNames}}. Write what this file holds into the spec that reads it, move its static values into a test data file carrying that spec's stem, or move it out of `{{specDirectory}}` into the production code that reads it. Renaming it to claim either kind brings that kind's conditions with it: a spec must hold a test that runs, and test data must have a spec of its stem beside it and hold nothing but static values.",
    },
    schema: [
      {
        type: "object",
        properties: {
          specDirectoryNames: { type: "array", items: { type: "string" } },
          specFileSuffixes: { type: "array", items: { type: "string" } },
          assetsNameMarkers: { type: "array", items: { type: "string" } },
          unscannedDirectories: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
  },
  create(inspection) {
    const convention = {
      specDirectoryNames: specDirectoryNamesFrom(inspection.options),
      specFileSuffixes: specFileSuffixesFrom(inspection.options),
      assetsNameMarkers: assetsNameMarkersFrom(inspection.options),
    };

    return {
      Program(node: ESTree.Program) {
        const visitedPath = resolve(inspection.cwd, inspection.filename);
        const repositoryRoot = findWorkspaceRoot(dirname(visitedPath));
        const held = foreignFilesIn({
          repositoryRoot,
          convention,
          unscannedDirectoryNames: unscannedDirectoryNamesFrom(inspection.options),
        });
        const workspace = holdingWorkspaceOf({
          repositoryRoot,
          relativePath: toPosixPath(relative(repositoryRoot, visitedPath)),
        });

        for (const foreign of held.get(workspace) ?? []) {
          inspection.report({ node, messageId: foreign.messageId, data: foreign.data });
        }
      },
    };
  },
});
