import { createDontReviewItRule } from "../../../../create-rule.ts";
import { resolveBinding, type ScopeLookup } from "../../lib/resolved-bindings.ts";
import { isAssertionCall } from "../../lib/spec-syntax/assertion-entries.ts";
import { isSpecFile, specFileSuffixesFrom } from "../../lib/spec-syntax/spec-files.ts";
import {
  isSpecClosedValue,
  type SpecNameReach,
} from "../../lib/sut-independent-assertions/closed-origins.ts";
import {
  comparedOperandsOf,
  unwrapCopiedValue,
  type ComparedOperands,
} from "../../lib/sut-independent-assertions/compared-operands.ts";

import type { ESTree, Variable } from "@oxlint/plugins";
import type { RuleMessage } from "../../lib/rule-message.ts";

const writtenValueOf = (binding: Variable): ESTree.Expression | null => {
  const [held, ...rival] = binding.defs.flatMap((definition) =>
    definition.node.type === "VariableDeclarator" && definition.node.init !== null
      ? [definition.node.init]
      : [],
  );
  if (held === undefined || rival.length !== 0) return null;

  const rewritten = binding.references.flatMap((reference) => reference.writeExpr ?? []);
  return rewritten.every((written) => written === held) ? held : null;
};

const rootBindingOf = (input: {
  readonly scopeAt: ScopeLookup;
  readonly written: ESTree.Expression;
  readonly walked?: ReadonlySet<Variable>;
}): Variable | null => {
  const { scopeAt, written, walked = new Set<Variable>() } = input;
  const bare = unwrapCopiedValue(written);
  if (bare.type !== "Identifier") return null;

  const binding = resolveBinding(scopeAt(bare), bare.name);
  if (binding === null || walked.has(binding)) return null;

  const bound = writtenValueOf(binding);
  if (bound === null) return binding;
  return (
    rootBindingOf({ scopeAt, written: bound, walked: new Set([...walked, binding]) }) ?? binding
  );
};

const selfComparisonOf = (input: {
  readonly scopeAt: ScopeLookup;
  readonly operands: ComparedOperands;
}): RuleMessage | null => {
  const { scopeAt, operands } = input;
  const held = rootBindingOf({ scopeAt, written: operands.subject });
  if (held === null) return null;

  const mirrored = operands.expectations.some(
    (expectation) => rootBindingOf({ scopeAt, written: expectation }) === held,
  );
  return mirrored ? { messageId: "selfComparedSubject", data: { subject: held.name } } : null;
};

const assertionReportOf = (input: {
  readonly scopeAt: ScopeLookup;
  readonly reach: SpecNameReach;
  readonly operands: ComparedOperands;
}): RuleMessage | null => {
  const { scopeAt, reach, operands } = input;
  const compared = [operands.subject, ...operands.expectations];
  if (compared.every((written) => isSpecClosedValue({ written, reach }))) {
    return { messageId: "sutIndependentAssertion", data: {} };
  }
  return selfComparisonOf({ scopeAt, operands });
};

export const noSutIndependentAssertion = createDontReviewItRule({
  name: "no-sut-independent-assertion--assert-fixture-subject",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow an assertion whose operands never went through the code under test, so a passing assertion states something the code has to keep true rather than something the spec compared with itself",
      relatedGuidelines: [],
    },
    messages: {
      sutIndependentAssertion:
        "An assertion must not compare values that never reached the code under test. Every value this one reads is written in the spec itself, and it lands the same way whatever the code is changed to. Assert the subject a fixture hands back against the value the code has to produce. Delete the `it` that has nothing to pin instead of adding an assertion to it.",
      selfComparedSubject:
        "An assertion must not compare a value against itself. Both sides of this one reach `{{subject}}`, and a `not` in front only turns it into an assertion that always fails. Write the expected value out in the spec beside the subject the fixture hands back. Delete the `it` that has nothing to pin.",
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
  create(inspection) {
    if (!isSpecFile(inspection.filename, specFileSuffixesFrom(inspection.options))) return {};

    const scopeAt: ScopeLookup = (node) => inspection.sourceCode.getScope(node);
    const bindingAt = (written: ESTree.IdentifierReference): Variable | null =>
      resolveBinding(scopeAt(written), written.name);

    const reach: SpecNameReach = {
      boundValueOf: (written) => {
        const binding = bindingAt(written);
        return binding === null ? null : writtenValueOf(binding);
      },
      isDeclaredHere: (written) => (bindingAt(written)?.defs.length ?? 0) !== 0,
    };

    return {
      CallExpression(node: ESTree.CallExpression) {
        const operands = isAssertionCall(node) ? comparedOperandsOf(node) : null;
        if (operands === null) return;

        const report = assertionReportOf({ scopeAt, reach, operands });
        if (report === null) return;
        inspection.report({ node: operands.subject, ...report });
      },
    };
  },
});
