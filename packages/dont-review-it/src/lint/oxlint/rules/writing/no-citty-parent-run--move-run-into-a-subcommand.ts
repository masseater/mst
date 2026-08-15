import { createDontReviewItRule } from "../../../../create-rule.ts";
import { collectBinding, isReferenceTo, newBinding } from "../../lib/imported-binding.ts";
import { objectPropertyOf } from "../../lib/object-literal.ts";

import type { ESTree } from "@oxlint/plugins";

const COMMAND_FRAMEWORK_SPECIFIER = "citty";

const COMMAND_FACTORY_NAME = "defineCommand";

export const noCittyParentRun = createDontReviewItRule({
  name: "no-citty-parent-run--move-run-into-a-subcommand",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow a `run` handler on a citty command that declares `subCommands`, so a matched subcommand's output is never followed by the parent's",
      relatedGuidelines: [],
    },
    messages: {
      parentRun:
        "A citty command that declares `subCommands` must not register `run`. Delete the parent `run` and move its behavior into a subcommand of its own.",
    },
    schema: [],
  },
  create(inspection) {
    const factory = { exportedName: COMMAND_FACTORY_NAME, binding: newBinding() };

    return {
      ImportDeclaration(node: ESTree.ImportDeclaration) {
        if (node.source.value !== COMMAND_FRAMEWORK_SPECIFIER) return;
        collectBinding(node, factory);
      },
      CallExpression(node: ESTree.CallExpression) {
        if (!isReferenceTo(node.callee, factory)) return;
        const [definition] = node.arguments;
        if (definition?.type !== "ObjectExpression") return;
        if (objectPropertyOf({ object: definition, key: "subCommands" }) === null) return;
        const runProperty = objectPropertyOf({ object: definition, key: "run" });
        if (runProperty === null) return;
        inspection.report({ node: runProperty, messageId: "parentRun" });
      },
    };
  },
});
