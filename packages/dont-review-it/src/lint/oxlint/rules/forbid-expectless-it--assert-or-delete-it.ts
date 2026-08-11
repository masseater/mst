import { createDontReviewItRule } from "../../../create-rule.ts";
import { isAssertionCall } from "../lib/spec-syntax/assertion-entries.ts";
import { isSpecFile, specFileSuffixesFrom } from "../lib/spec-syntax/spec-files.ts";
import { testBlockBindings, testBlockBodyOf } from "../lib/spec-syntax/test-block-declarations.ts";

import type { ESTree } from "@oxlint/plugins";

type Block = {
  readonly call: ESTree.CallExpression;
  readonly start: number;
  readonly end: number;
};

const innermostAround = (
  assertion: ESTree.CallExpression,
  blocks: readonly Block[],
): Block | null =>
  blocks
    .filter((block) => block.start <= assertion.start && assertion.end <= block.end)
    .toSorted((held, other) => other.start - held.start)
    .at(0) ?? null;

const claimlessAmong = (
  blocks: readonly Block[],
  assertions: readonly ESTree.CallExpression[],
): readonly ESTree.CallExpression[] => {
  const claiming = new Set(
    assertions.flatMap((assertion) => {
      const around = innermostAround(assertion, blocks);
      return around === null ? [] : [around.call];
    }),
  );
  return blocks.flatMap((block) => (claiming.has(block.call) ? [] : [block.call]));
};

export const forbidExpectlessIt = createDontReviewItRule({
  name: "forbid-expectless-it--assert-or-delete-it",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow a test block whose body carries no assertion, so a passing run only ever means the claims written in the blocks held",
      relatedGuidelines: [],
    },
    messages: {
      expectlessIt:
        "A test block must not stand without an assertion written in its own body. This block claims nothing and passes on every run, while the report lists its name among the behaviours a suite checked. Write the claim the name promises about the subject the fixture hands over, or delete the block. A declaration of how many assertions the block carries claims nothing and does not count here, and neither does an assertion parked in a helper or a fixture this block reaches. Marking the block as skipped, as todo or as expected to fail does not settle the claim either.",
    },
    schema: [
      {
        type: "object",
        properties: {
          specFileSuffixes: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    if (!isSpecFile(context.filename, specFileSuffixesFrom(context.options))) return {};

    const bindings = testBlockBindings();
    const calls = new Set<ESTree.CallExpression>();

    return {
      ImportDeclaration: bindings.takeImport,
      VariableDeclarator: bindings.takeLocalBinding,
      CallExpression(node: ESTree.CallExpression) {
        calls.add(node);
      },
      "Program:exit"() {
        const rootNames = bindings.rootNames();
        const blocks = [...calls].flatMap((call): readonly Block[] => {
          const body = testBlockBodyOf(call, rootNames);
          return body === null ? [] : [{ call, start: body.start, end: body.end }];
        });
        const assertions = [...calls].filter((call) => isAssertionCall(call));

        for (const claimless of claimlessAmong(blocks, assertions)) {
          context.report({ node: claimless, messageId: "expectlessIt" });
        }
      },
    };
  },
});
