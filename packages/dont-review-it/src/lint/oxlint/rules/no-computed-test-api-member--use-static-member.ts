import { createDontReviewItRule } from "../../../create-rule.ts";
import { staticSpelling } from "../lib/spec-syntax/static-names.ts";
import { unwrapSubject } from "../lib/spec-syntax/subject-expressions.ts";
import {
  assertionEntryBindings,
  testBlockBindings,
} from "../lib/spec-syntax/test-block-declarations.ts";

import type { ESTree } from "@oxlint/plugins";

const STATIC_MEMBER_SHAPE = /^[A-Za-z_$][A-Za-z0-9_$]*$/u;

const chainRootName = (node: ESTree.Expression): string | null => {
  const written = unwrapSubject(node);
  if (written.type === "Identifier") return written.name;
  if (written.type === "MemberExpression") return chainRootName(written.object);
  if (written.type === "CallExpression") return chainRootName(written.callee);
  if (written.type === "TaggedTemplateExpression") return chainRootName(written.tag);
  return null;
};

export const noComputedTestApiMember = createDontReviewItRule({
  name: "no-computed-test-api-member--use-static-member",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow reaching a member of the test block API or the assertion entry through a subscript, so every rule reading the suite settles what a call means from the name the source spells out",
      relatedGuidelines: [],
    },
    messages: {
      spelledSubscript:
        "A member of the test block API or the assertion entry must not be reached through a subscript. This one spells `{{member}}`. Write it as a static member.",
      unreadableSubscript:
        "A member of the test block API or the assertion entry must not be reached through a subscript. This one settles its name while the program runs, and no rule can read the member it stands for. Write the member you mean as a static member.",
    },
    schema: [],
    fixable: "code",
  },
  create(inspection) {
    const blocks = testBlockBindings();
    const listedEntries = assertionEntryBindings();
    const subscripts = new Set<ESTree.ComputedMemberExpression>();

    const reportSubscript = (node: ESTree.ComputedMemberExpression): void => {
      const member = staticSpelling(node.property);
      if (member === null) {
        inspection.report({ node: node.property, messageId: "unreadableSubscript" });
        return;
      }

      const written = `${node.optional ? "?." : "."}${member}`;
      inspection.report({
        node: node.property,
        messageId: "spelledSubscript",
        data: { member },
        fix: STATIC_MEMBER_SHAPE.test(member)
          ? (fixer) => fixer.replaceTextRange([node.object.end, node.end], written)
          : undefined,
      });
    };

    return {
      ImportDeclaration(node: ESTree.ImportDeclaration) {
        blocks.takeImport(node);
        listedEntries.takeImport(node);
      },
      VariableDeclarator(node: ESTree.VariableDeclarator) {
        blocks.takeLocalBinding(node);
        listedEntries.takeLocalBinding(node);
      },
      MemberExpression(node: ESTree.MemberExpression) {
        if (node.computed) subscripts.add(node);
      },
      "Program:exit"() {
        const rootNames = new Set([...blocks.rootNames(), ...listedEntries.rootNames()]);
        for (const node of subscripts) {
          if (rootNames.has(chainRootName(node.object) ?? "")) reportSubscript(node);
        }
      },
    };
  },
});
