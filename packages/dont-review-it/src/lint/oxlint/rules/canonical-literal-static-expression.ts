import {
  canonicalLiteralAncestorsOf,
  type CanonicalLiteralCandidate,
} from "./canonical-literal-candidate.ts";

import type { ESTree } from "@oxlint/plugins";
import type { CanonicalValue } from "../lib/canonical-values/fingerprint.ts";
import type { CanonicalValuePropertyState } from "./canonical-value-property-state.ts";

export type CanonicalLiteralStaticExpressionSink = {
  readonly evaluate: () => void;
  readonly recordCall: (node: ESTree.CallExpression) => void;
  readonly recordExpression: (
    node:
      | ESTree.BinaryExpression
      | ESTree.MemberExpression
      | ESTree.TemplateLiteral
      | ESTree.UnaryExpression,
  ) => void;
};

export const createCanonicalLiteralStaticExpressionSink = (input: {
  readonly covered: (candidate: CanonicalLiteralCandidate) => boolean;
  readonly inspect: (candidate: CanonicalLiteralCandidate) => void;
  readonly propertyState: CanonicalValuePropertyState;
}): CanonicalLiteralStaticExpressionSink => {
  const calls = new Set<ESTree.CallExpression>();
  const expressions = new Set<ESTree.Expression>();
  const reported = new Set<CanonicalLiteralCandidate>();
  const contains = (container: ESTree.Node, contained: ESTree.Node): boolean =>
    container.start <= contained.start && container.end >= contained.end;
  const reportedThroughOrigin = (node: ESTree.Expression, spelling: CanonicalValue): boolean => {
    if (node.type !== "Identifier") return false;
    return input.propertyState
      .origins({ expression: node })
      .candidates.some(
        (origin) =>
          origin.kind === "expression" &&
          Array.from(reported).some(
            (candidate) =>
              Object.is(candidate.spelling, spelling) &&
              contains(candidate.node, origin.expression),
          ),
      );
  };
  const inspect = (node: ESTree.Expression, spelling: CanonicalValue): void => {
    const candidate = { ancestors: canonicalLiteralAncestorsOf(node), node, spelling };
    if (input.covered(candidate) || reportedThroughOrigin(node, spelling)) return;
    input.inspect(candidate);
    if (input.covered(candidate)) reported.add(candidate);
  };
  const evaluate = (): void => {
    for (const expression of [...expressions, ...calls]) {
      const primitives = input.propertyState.primitives({
        expression,
      });
      for (const primitive of primitives.candidates) {
        if (primitive !== undefined && typeof primitive !== "bigint") {
          inspect(expression, primitive);
        }
      }
    }
  };
  return {
    evaluate,
    recordCall: (node) => {
      calls.add(node);
      for (const argument of node.arguments) {
        expressions.add(argument.type === "SpreadElement" ? argument.argument : argument);
      }
    },
    recordExpression: (node) => {
      expressions.add(node);
    },
  };
};
