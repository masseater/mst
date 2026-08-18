import { createDontReviewItRule } from "../../../../create-rule.ts";
import {
  createForbiddenNameMatcher,
  FORBIDDEN_AMBIGUOUS_NAMES,
} from "../../lib/forbidden-ambiguous-names.ts";
import { isAssertionEntryCall } from "../../lib/spec-syntax/assertion-entries.ts";
import { forbiddenSubjectNamesFrom } from "../../lib/spec-syntax/forbidden-subject-names.ts";
import { isSpecFile, specFileSuffixesFrom } from "../../lib/spec-syntax/spec-files.ts";
import {
  asSpecFunction,
  returnedExpressionsOf,
  unwrapSubject,
} from "../../lib/spec-syntax/subject-expressions.ts";

import type { ESTree } from "@oxlint/plugins";

type HandedValue = ESTree.Expression | ESTree.PrivateIdentifier | ESTree.SpreadElement;

const receiverOfCallee = (callee: ESTree.Expression): readonly HandedValue[] => {
  const written = unwrapSubject(callee);
  return written.type === "MemberExpression" ? [written] : [];
};

const keptFromProperty = (property: ESTree.ObjectProperty): readonly HandedValue[] =>
  property.computed ? [property.key, property.value] : [property.value];

const carriedByComposite = (node: ESTree.Expression): readonly HandedValue[] | null => {
  if (node.type === "MemberExpression") {
    return node.computed ? [node.object, node.property] : [node.object];
  }
  if (node.type === "ObjectExpression") {
    return node.properties.flatMap((property) =>
      property.type === "SpreadElement" ? [property] : keptFromProperty(property),
    );
  }
  if (node.type === "ArrayExpression") return node.elements.flatMap((held) => held ?? []);
  if (node.type === "CallExpression" || node.type === "NewExpression") {
    return [...receiverOfCallee(node.callee), ...node.arguments];
  }
  if (node.type === "TaggedTemplateExpression") {
    return [...receiverOfCallee(node.tag), ...node.quasi.expressions];
  }
  return null;
};

const carriedByOperation = (node: ESTree.Expression): readonly HandedValue[] => {
  if (node.type === "TemplateLiteral") return node.expressions;
  if (node.type === "ConditionalExpression") return [node.test, node.consequent, node.alternate];
  if (node.type === "LogicalExpression" || node.type === "BinaryExpression") {
    return [node.left, node.right];
  }
  if (node.type === "UnaryExpression") return [node.argument];
  if (node.type === "SequenceExpression") return node.expressions;

  const thunk = asSpecFunction(node);
  return thunk === null ? [] : returnedExpressionsOf(thunk);
};

const namesInside = (node: HandedValue): readonly ESTree.IdentifierReference[] => {
  if (node.type === "SpreadElement") return namesInside(node.argument);
  if (node.type === "PrivateIdentifier") return [];

  const written = unwrapSubject(node);
  if (written.type === "Identifier") return [written];

  const nested = carriedByComposite(written) ?? carriedByOperation(written);
  return nested.flatMap((carried) => namesInside(carried));
};

export const noExpectForbiddenSubjectName = createDontReviewItRule({
  name: "no-expect-forbidden-subject-name--rename-to-concrete-subject",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow naming the subject of an assertion by one of the configured forbidden-name patterns, so a reader settles what the assertion pins from the assertion alone rather than from the fixture behind it",
      relatedGuidelines: ["docs/guidelines/tests.md"],
    },
    messages: {
      forbiddenSubjectName:
        "The subject of an assertion must not be named `{{name}}`. Rename the fixture and the binding it hands over to the concrete value this assertion pins. Split a fixture that hands over a bag of separate results into one fixture per subject.",
    },
    schema: [
      {
        type: "object",
        properties: {
          forbiddenSubjectNames: {
            type: "array",
            items: {
              type: "object",
              properties: { pattern: { type: "string" } },
              required: ["pattern"],
              additionalProperties: false,
            },
          },
          specFileSuffixes: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
  },
  create(inspection) {
    if (!isSpecFile(inspection.filename, specFileSuffixesFrom(inspection.options))) return {};

    const isForbiddenName = createForbiddenNameMatcher([
      ...FORBIDDEN_AMBIGUOUS_NAMES,
      ...forbiddenSubjectNamesFrom(inspection.options),
    ]);

    return {
      CallExpression(node: ESTree.CallExpression) {
        if (!isAssertionEntryCall(node)) return;

        const [handed] = node.arguments;
        if (handed === undefined) return;

        for (const named of namesInside(handed)) {
          if (!isForbiddenName(named.name)) continue;
          inspection.report({
            node: named,
            messageId: "forbiddenSubjectName",
            data: { name: named.name },
          });
        }
      },
    };
  },
});
