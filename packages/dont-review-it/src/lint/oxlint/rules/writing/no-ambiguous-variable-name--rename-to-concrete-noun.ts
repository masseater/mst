import { createDontReviewItRule } from "../../../../create-rule.ts";
import {
  createForbiddenNameMatcher,
  FORBIDDEN_AMBIGUOUS_NAMES,
  type ForbiddenNamePattern,
} from "../../lib/forbidden-ambiguous-names.ts";

import type { ESTree } from "@oxlint/plugins";

const additionalPatternsOf = (ruleOptions: readonly unknown[]): readonly ForbiddenNamePattern[] =>
  ruleOptions.length === 0 ? [] : (ruleOptions[0] as readonly ForbiddenNamePattern[]);

const boundIdentifiersOf = (
  pattern: ESTree.ParamPattern | ESTree.BindingPattern,
): readonly ESTree.BindingIdentifier[] => {
  if (pattern.type === "Identifier") return [pattern];
  if (pattern.type === "AssignmentPattern") return boundIdentifiersOf(pattern.left);
  if (pattern.type === "RestElement") return boundIdentifiersOf(pattern.argument);
  return [];
};

export const noAmbiguousVariableName = createDontReviewItRule({
  name: "no-ambiguous-variable-name--rename-to-concrete-noun",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow a binding named by one of the ambiguous-name patterns, so the name says what the binding holds instead of sending a reader upstream to the assignment",
      relatedGuidelines: ["docs/guidelines/writing-code.md"],
    },
    messages: {
      ambiguousVariableName:
        "The name `{{name}}` must not be used as a binding name. Rename it to a noun that names the value itself: the parsed config, the rendered fragment, the fetched record, the caught error.",
    },
    schema: [
      {
        type: "array",
        items: {
          type: "object",
          properties: {
            pattern: { type: "string" },
          },
          required: ["pattern"],
          additionalProperties: false,
        },
      },
    ],
  },
  create(inspection) {
    const isForbiddenName = createForbiddenNameMatcher([
      ...FORBIDDEN_AMBIGUOUS_NAMES,
      ...additionalPatternsOf(inspection.options),
    ]);

    const reportForbidden = (
      identifier: ESTree.BindingIdentifier | ESTree.IdentifierName | ESTree.IdentifierReference,
    ): void => {
      if (!isForbiddenName(identifier.name)) return;

      inspection.report({
        node: identifier,
        messageId: "ambiguousVariableName",
        data: { name: identifier.name },
      });
    };

    const reportParameters = (parameters: readonly ESTree.ParamPattern[]): void => {
      parameters.flatMap(boundIdentifiersOf).forEach(reportForbidden);
    };

    return {
      VariableDeclarator(node: ESTree.VariableDeclarator) {
        if (node.id.type !== "Identifier") return;
        reportForbidden(node.id);
      },
      ObjectPattern(node: ESTree.ObjectPattern) {
        node.properties.forEach((property) => {
          if (property.type !== "Property") return;
          if (property.shorthand) return;
          boundIdentifiersOf(property.value).forEach(reportForbidden);
        });
      },
      ArrayPattern(node: ESTree.ArrayPattern) {
        node.elements.forEach((held) => {
          if (held === null) return;
          boundIdentifiersOf(held).forEach(reportForbidden);
        });
      },
      FunctionDeclaration(node: ESTree.Function) {
        reportParameters(node.params);
      },
      FunctionExpression(node: ESTree.Function) {
        reportParameters(node.params);
      },
      ArrowFunctionExpression(node: ESTree.ArrowFunctionExpression) {
        reportParameters(node.params);
      },
      PropertyDefinition(node: ESTree.PropertyDefinition) {
        if (node.computed) return;
        if (node.override === true) return;
        if (node.key.type !== "Identifier") return;
        reportForbidden(node.key);
      },
    };
  },
});
