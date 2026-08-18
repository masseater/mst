import { createDontReviewItRule } from "../../../../create-rule.ts";
import { defaultExportedObject } from "../../lib/default-exported-object.ts";
import { declaresTrueAt, nestedObjectAt, objectPropertyOf } from "../../lib/object-literal.ts";
import { isTestRunnerConfig } from "../../lib/test-runner-config.ts";

import type { ESTree } from "@oxlint/plugins";

const TEST_BLOCK_PATH = ["test"];

const ISOLATION_SETTINGS = ["mockReset", "restoreMocks"];

export const noSharedDoubleState = createDontReviewItRule({
  name: "no-shared-double-state--reset-doubles-between-tests",
  meta: {
    type: "problem",
    docs: {
      description:
        "Require the test config to declare that doubles are reset and restored before each test, so a spec that passes on the state its neighbour installed is impossible rather than merely unlikely",
      relatedGuidelines: ["docs/guidelines/tests.md"],
    },
    messages: {
      missingTestBlock:
        "A test config must not leave the doubles a test installs standing for the next test. `{{path}}` is absent from this config, so nothing takes them down. Add it and declare {{settings}} as `true`.",
      sharedDoubleState:
        "A double installed by one test must not be left standing for the next one. `{{setting}}` is not declared `true` in `test`, so the call records and the implementations one test set are what the next test starts from. Declare `{{setting}}: true`.",
    },
    schema: [],
  },
  create(inspection) {
    if (!isTestRunnerConfig(inspection.filename)) return {};

    return {
      Program(node: ESTree.Program) {
        const config = defaultExportedObject(node);
        const testBlock =
          config === null ? null : nestedObjectAt({ object: config, path: TEST_BLOCK_PATH });
        if (testBlock === null) {
          inspection.report({
            node,
            messageId: "missingTestBlock",
            data: {
              path: TEST_BLOCK_PATH.join("."),
              settings: ISOLATION_SETTINGS.map((setting) => `\`${setting}\``).join(" and "),
            },
          });
          return;
        }
        for (const setting of ISOLATION_SETTINGS) {
          if (declaresTrueAt({ object: testBlock, key: setting })) continue;
          inspection.report({
            node: objectPropertyOf({ object: testBlock, key: setting }) ?? testBlock,
            messageId: "sharedDoubleState",
            data: { setting },
          });
        }
      },
    };
  },
});
