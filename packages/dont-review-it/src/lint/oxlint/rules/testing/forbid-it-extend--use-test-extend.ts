import { createDontReviewItRule } from "../../../../create-rule.ts";
import { FIXTURE_BUILDER_MEMBER } from "../../lib/spec-syntax/fixture-declarations.ts";
import { staticMemberName, staticSpelling } from "../../lib/spec-syntax/static-names.ts";
import { unwrapSubject } from "../../lib/spec-syntax/subject-expressions.ts";

import type { ESTree, Scope, SourceCode, Variable } from "@oxlint/plugins";

const FIXTURE_FACTORY_BASE = "test";

const variableNamed = (scope: Scope | null, spelled: string): Variable | null =>
  scope === null ? null : (scope.set.get(spelled) ?? variableNamed(scope.upper, spelled));

const importedSpelling = (specifier: ESTree.ImportSpecifier): string | null =>
  specifier.imported.type === "Identifier"
    ? specifier.imported.name
    : staticSpelling(specifier.imported);

const TEST_BLOCK_SPELLING = "it";

const standsOnTestBlock = (
  identifier: ESTree.IdentifierReference,
  {
    sourceCode,
    followed,
  }: { readonly sourceCode: SourceCode; readonly followed: readonly Variable[] },
): boolean => {
  const binding = variableNamed(sourceCode.getScope(identifier), identifier.name);
  if (binding === null) return identifier.name === TEST_BLOCK_SPELLING;
  if (followed.includes(binding)) return false;

  const reached = [...followed, binding];
  return binding.defs.some((definition) => {
    const declared = definition.node;
    if (declared.type === "ImportSpecifier") {
      return importedSpelling(declared) === TEST_BLOCK_SPELLING;
    }
    if (declared.type !== "VariableDeclarator" || declared.init === null) return false;

    const initializer = unwrapSubject(declared.init);
    return (
      initializer.type === "Identifier" &&
      standsOnTestBlock(initializer, { sourceCode, followed: reached })
    );
  });
};

export const forbidItExtend = createDontReviewItRule({
  name: "forbid-it-extend--use-test-extend",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow a fixture factory that stands on the test block spelling, so the name that declares test blocks carries that one role and everything scanning the suite can settle what that name means by reading it",
      relatedGuidelines: [],
    },
    messages: {
      itExtend:
        "A fixture factory must not stand on `it`, the spelling reserved for declaring test blocks. Replace `{{base}}` with `test` and leave the rest of the chain alone.",
    },
    schema: [],
    fixable: "code",
  },
  create(inspection) {
    return {
      MemberExpression(node: ESTree.MemberExpression) {
        if (staticMemberName(node) !== FIXTURE_BUILDER_MEMBER) return;

        const base = unwrapSubject(node.object);
        if (base.type !== "Identifier") return;
        if (!standsOnTestBlock(base, { sourceCode: inspection.sourceCode, followed: [] })) return;

        const scope = inspection.sourceCode.getScope(base);
        const replaceable =
          !node.computed &&
          base.name === TEST_BLOCK_SPELLING &&
          (variableNamed(scope, TEST_BLOCK_SPELLING) === null ||
            variableNamed(scope, FIXTURE_FACTORY_BASE) !== null);

        inspection.report({
          node: base,
          messageId: "itExtend",
          data: { base: base.name },
          fix: replaceable ? (fixer) => fixer.replaceText(base, FIXTURE_FACTORY_BASE) : undefined,
        });
      },
    };
  },
});
