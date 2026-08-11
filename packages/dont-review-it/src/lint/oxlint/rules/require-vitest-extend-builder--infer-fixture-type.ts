import { createDontReviewItRule } from "../../../create-rule.ts";
import { builderStagesFor, type FixtureSource } from "../lib/spec-syntax/fixture-builder-stages.ts";
import { isFixtureBuilderCall } from "../lib/spec-syntax/fixture-declarations.ts";
import { unwrapSubject } from "../lib/spec-syntax/subject-expressions.ts";

import type { ESTree, SourceCode } from "@oxlint/plugins";

type BuilderCall = {
  readonly call: ESTree.CallExpression;
  readonly callee: ESTree.MemberExpression;
};

const builderCallOf = (call: ESTree.CallExpression): BuilderCall | null => {
  const callee = unwrapSubject(call.callee);
  if (callee.type !== "MemberExpression" || !isFixtureBuilderCall(call)) return null;
  return { call, callee };
};

const handedObjectOf = (call: ESTree.CallExpression): ESTree.ObjectExpression | null => {
  const [head] = call.arguments;
  if (head === undefined || head.type === "SpreadElement") return null;
  const written = unwrapSubject(head);
  return written.type === "ObjectExpression" ? written : null;
};

const sourceFor = (sourceCode: SourceCode): FixtureSource => ({
  textOf: (node) => sourceCode.getText(node),
  readCountOf: (declared, name) =>
    sourceCode
      .getScope(declared)
      .variables.filter((bound) => bound.name === name)
      .flatMap((bound) => bound.references).length,
});

const chainedCallText = ({ call, callee }: BuilderCall, sourceCode: SourceCode): string | null => {
  const handed = handedObjectOf(call);
  if (handed === null || call.optional) return null;

  const stages = builderStagesFor(handed, sourceFor(sourceCode));
  if (stages === null) return null;

  const reached = sourceCode.getText(callee.object);
  const written = sourceCode.getText(call.callee);
  if (!written.startsWith(reached)) return null;

  const grown = written.slice(reached.length);
  return `${reached}${stages.map((stage) => `${grown}(${stage})`).join("")}`;
};

const rewritesBefore = (written: ESTree.Expression, sourceCode: SourceCode): boolean => {
  const bare = unwrapSubject(written);
  if (bare.type === "MemberExpression") return rewritesBefore(bare.object, sourceCode);
  if (bare.type !== "CallExpression") return false;

  const builder = builderCallOf(bare);
  if (builder !== null && chainedCallText(builder, sourceCode) !== null) return true;

  const callee = unwrapSubject(bare.callee);
  return callee.type === "MemberExpression" && rewritesBefore(callee.object, sourceCode);
};

const rewriteFor = (builder: BuilderCall, sourceCode: SourceCode): string | null =>
  rewritesBefore(builder.callee.object, sourceCode) ? null : chainedCallText(builder, sourceCode);

export const requireVitestExtendBuilder = createDontReviewItRule({
  name: "require-vitest-extend-builder--infer-fixture-type",
  meta: {
    type: "problem",
    docs: {
      description:
        "Require every fixture to be declared as its own builder call whose type is inferred from what the factory returns, so the shape a test destructures is the shape the factory produces rather than a hand-written copy that drifts away from it",
      relatedGuidelines: [],
    },
    messages: {
      objectFixtureDeclaration:
        "A fixture must not be declared by handing an object of fixtures to the builder. Declare each fixture as its own builder call naming the fixture and then its factory, so the fixture type is read off what that factory returns.",
      handWrittenFixtureType:
        "A fixture builder call must not carry a written out type argument. Delete `{{written}}` and let each fixture type be read off what its own factory returns.",
    },
    schema: [],
    fixable: "code",
  },
  create(context) {
    const { sourceCode } = context;
    return {
      CallExpression(node: ESTree.CallExpression) {
        const builder = builderCallOf(node);
        if (builder === null) return;

        const handed = handedObjectOf(node);
        if (handed === null) {
          const [declared] = node.typeArguments?.params ?? [];
          if (declared !== undefined) {
            context.report({
              node: declared,
              messageId: "handWrittenFixtureType",
              data: { written: sourceCode.getText(declared) },
            });
          }
          return;
        }

        const rewritten = rewriteFor(builder, sourceCode);
        context.report({
          node: handed,
          messageId: "objectFixtureDeclaration",
          fix: rewritten === null ? undefined : (fixer) => fixer.replaceText(node, rewritten),
        });
      },
    };
  },
});
