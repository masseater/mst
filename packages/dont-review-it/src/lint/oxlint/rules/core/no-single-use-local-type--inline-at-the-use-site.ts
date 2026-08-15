import { createDontReviewItRule } from "../../../../create-rule.ts";
import { nodesOfType } from "../../lib/nodes-of-type.ts";
import { isOutOfScopeSource } from "../../lib/out-of-scope-source.ts";
import { REFERENCES_A_SHARED_TYPE } from "../../lib/shared-type-references.ts";

import type { ESTree } from "@oxlint/plugins";

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

    return {
      "Program:exit"(program: ESTree.Program) {
        const referencedNames = [
          ...nodesOfType(program, "TSTypeReference").flatMap((node) =>
            node.typeName.type === "Identifier" ? [node.typeName.name] : [],
          ),
          ...nodesOfType(program, "TSInterfaceHeritage").flatMap((node) =>
            node.expression.type === "Identifier" ? [node.expression.name] : [],
          ),
          ...nodesOfType(program, "TSClassImplements").flatMap((node) =>
            node.expression.type === "Identifier" ? [node.expression.name] : [],
          ),
        ];
        const declaredNodeByName = new Map(
          program.body
            .flatMap((statement) =>
              statement.type === "TSTypeAliasDeclaration" ||
              statement.type === "TSInterfaceDeclaration"
                ? [statement]
                : [],
            )
            .map((declared) => [declared.id.name, declared] as const),
        );

        for (const [declaredTypeName, declaration] of declaredNodeByName) {
          const referenceCount = referencedNames.filter(
            (referenced) => referenced === declaredTypeName,
          ).length;
          if (referenceCount >= REFERENCES_A_SHARED_TYPE) continue;
          inspection.report({
            node: declaration,
            messageId: "singleUseLocalType",
            data: {
              name: declaredTypeName,
              count: referenceCount === 0 ? "nowhere" : "one place",
            },
          });
        }
      },
    };
  },
});
