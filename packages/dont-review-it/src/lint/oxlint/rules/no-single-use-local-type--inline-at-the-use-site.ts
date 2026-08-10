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
        "A type that this file declares without exporting must be referenced from more than one place in the file, and `{{name}}` is referenced from {{count}}. A name that stands for a shape used once buys no agreement between two places and costs the reader a jump: the line that needs the shape shows a name, and the shape is somewhere else. Write the shape where it is used and delete the declaration. If a type argument is declared here, substitute it at the use site. If the file references it from nowhere at all, delete it outright. If the shape really is shared, then the second place that should agree with it is what is missing: make that place use this type instead of spelling the shape again. Exporting the declaration removes the report without moving the shape anywhere, so it is not a fix.",
    },
    schema: [],
  },
  create(context) {
    if (isOutOfScopeSource(context.filename)) return {};

    const declaredNodeByName = new Map<string, ESTree.Node>();
    const referenceCountByName = new Map<string, number>();

    const countReference = (name: string): void => {
      referenceCountByName.set(name, (referenceCountByName.get(name) ?? 0) + 1);
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
        for (const [name, node] of declaredNodeByName) {
          const count = referenceCountByName.get(name) ?? 0;
          if (count >= REFERENCES_A_SHARED_TYPE) continue;
          context.report({
            node,
            messageId: "singleUseLocalType",
            data: { name, count: count === 0 ? "nowhere" : "one place" },
          });
        }
      },
    };
  },
});
