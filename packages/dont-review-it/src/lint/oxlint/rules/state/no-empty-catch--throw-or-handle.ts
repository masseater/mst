import { createDontReviewItRule } from "../../../../create-rule.ts";
import { bodyCarriesNoWork } from "../../lib/catch-clause-bodies.ts";

import type { ESTree } from "@oxlint/plugins";

export const noEmptyCatch = createDontReviewItRule({
  name: "no-empty-catch--throw-or-handle",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow a catch clause whose body carries no statement, so catching a failure is a decision about what happens next instead of a place for the failure to stop being visible",
      relatedGuidelines: [],
    },
    messages: {
      emptyCatch:
        "A catch clause must not stand with a body that carries no statement. Write the ending the caller can act on into this body: rethrow the failure, throw one that names this layer's part in it with the original passed as `cause`, or return the value the caller should use in place of the one that never arrived.",
    },
    schema: [],
  },
  create(inspection) {
    return {
      CatchClause(node: ESTree.CatchClause) {
        if (!bodyCarriesNoWork(node)) return;

        inspection.report({ node, messageId: "emptyCatch" });
      },
    };
  },
});
