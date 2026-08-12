import { createDontReviewItRule } from "../../../create-rule.ts";
import { isOutOfScopeSource } from "../lib/out-of-scope-source.ts";

import type { ESTree } from "@oxlint/plugins";

const REFERENCES_A_SHARED_TYPE = 2;

export const noSingleUseLocalType = createDontReviewItRule({
  name: "no-single-use-local-type--inline-at-the-use-site",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow a type declared at the top level of a file without being exported when the file references it at most once, so a name is given to a shape only where more than one place has to agree on it",
      relatedGuidelines: [],
    },
    messages: {
      singleUseLocalType:
        "A type that this file declares without exporting must not be referenced from fewer than two places in the file. `{{name}}` is referenced from {{count}}. Write the shape where it is used and delete the declaration.",
    },
    schema: [],
  },
  create(inspection) {
    if (isOutOfScopeSource(inspection.filename)) return {};

    const declaredNodeByName = new Map<string, ESTree.Node>();
    const referenceCountByName = new Map<string, number>();

    const countReference = (spelled: string): void => {
      referenceCountByName.set(spelled, (referenceCountByName.get(spelled) ?? 0) + 1);
    };

    const declare = (node: ESTree.TSTypeAliasDeclaration | ESTree.TSInterfaceDeclaration): void => {
      if (node.parent.type !== "Program") return;
      declaredNodeByName.set(node.id.name, node);
    };

    return {
      TSTypeAliasDeclaration: declare,
      TSInterfaceDeclaration: declare,
      TSTypeReference(node: ESTree.TSTypeReference) {
        if (node.typeName.type === "Identifier") countReference(node.typeName.name);
      },
      TSInterfaceHeritage(node: ESTree.TSInterfaceHeritage) {
        if (node.expression.type === "Identifier") countReference(node.expression.name);
      },
      TSClassImplements(node: ESTree.TSClassImplements) {
        if (node.expression.type === "Identifier") countReference(node.expression.name);
      },
      "Program:exit"() {
        for (const [spelled, node] of declaredNodeByName) {
          const counted = referenceCountByName.get(spelled) ?? 0;
          if (counted >= REFERENCES_A_SHARED_TYPE) continue;
          inspection.report({
            node,
            messageId: "singleUseLocalType",
            data: { name: spelled, count: counted === 0 ? "nowhere" : "one place" },
          });
        }
      },
    };
  },
});
