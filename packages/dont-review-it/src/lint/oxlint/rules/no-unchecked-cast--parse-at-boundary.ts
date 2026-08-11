import { createDontReviewItRule } from "../../../create-rule.ts";
import {
  declaredReturnTypeOf,
  isConcreteTypeClaim,
  isTypeAssertion,
  looseTypeNodeOf,
  unwrappedValueOf,
  type LooseTypeNode,
} from "../lib/loose-type-claims.ts";
import {
  resolveBinding,
  type BindingResolution,
  type ScopeLookup,
} from "../lib/resolved-bindings.ts";

import type { Definition, ESTree } from "@oxlint/plugins";

const looseNodeOfDefinition = (
  definition: Definition,
  resolution: BindingResolution,
): LooseTypeNode | null => {
  const annotation = definition.name.typeAnnotation;
  if (annotation !== null && annotation !== undefined) {
    return looseTypeNodeOf(annotation.typeAnnotation);
  }

  const declarator = definition.node;
  if (declarator.type !== "VariableDeclarator") return null;
  if (declarator.init === null) return null;
  return looseNodeOfExpression(declarator.init, resolution);
};

const looseNodeOfBinding = (
  node: ESTree.IdentifierReference,
  { scopeAt, seenBindings }: BindingResolution,
): LooseTypeNode | null => {
  const binding = resolveBinding(scopeAt(node), node.name);
  if (binding === null || seenBindings.has(binding)) return null;

  const seen = new Set([...seenBindings, binding]);
  const declared = binding.defs.map((definition) =>
    looseNodeOfDefinition(definition, { scopeAt, seenBindings: seen }),
  );
  return declared.find((held) => held !== null) ?? null;
};

const looseNodeOfExpression = (
  node: ESTree.Expression,
  resolution: BindingResolution,
): LooseTypeNode | null => {
  const unwrapped = unwrappedValueOf(node);
  return unwrapped.type === "Identifier" ? looseNodeOfBinding(unwrapped, resolution) : null;
};

export const noUncheckedCast = createDontReviewItRule({
  name: "no-unchecked-cast--parse-at-boundary",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow handing a concrete type to a value the source declares as `any` or `unknown`, so every concrete type a value carries reached it through a step that read the value",
      relatedGuidelines: [],
    },
    messages: {
      uncheckedCast:
        "A value declared `{{looseType}}` must not be handed a concrete type by assertion. Parse `{{claimed}}` at the boundary it enters through and take the concrete type from the return type of that parse.",
      uncheckedTypeClaim:
        "A value declared `any` must not be handed a concrete type by annotation. Parse `{{claimed}}` at the boundary it enters through and take the concrete type from the return type of that parse.",
      unexaminedTypePredicate:
        "A type predicate must not stand on a body that leaves `{{parameter}}` unread. Read `{{parameter}}` in the body and return what that reading settles.",
    },
    schema: [],
  },
  create(context) {
    const scopeAt: ScopeLookup = (node) => context.sourceCode.getScope(node);
    const resolution: BindingResolution = { scopeAt, seenBindings: new Set() };

    const reportUncheckedCast = (node: ESTree.TSAsExpression | ESTree.TSTypeAssertion): void => {
      const asserted = unwrappedValueOf(node.expression);
      if (isTypeAssertion(asserted)) return;
      if (!isConcreteTypeClaim(node.typeAnnotation)) return;

      const loose = looseNodeOfExpression(asserted, resolution);
      if (loose === null) return;
      context.report({
        node,
        messageId: "uncheckedCast",
        data: {
          looseType: context.sourceCode.getText(loose),
          claimed: context.sourceCode.getText(asserted),
        },
      });
    };

    const reportUncheckedTypeClaim = (
      annotation: ESTree.TSTypeAnnotation | null | undefined,
      held: ESTree.Expression | null | undefined,
    ): void => {
      const declared = annotation ?? null;
      const carried = held ?? null;
      if (declared === null || carried === null) return;
      if (!isConcreteTypeClaim(declared.typeAnnotation)) return;
      if (looseNodeOfExpression(carried, resolution)?.type !== "TSAnyKeyword") return;
      context.report({
        node: carried,
        messageId: "uncheckedTypeClaim",
        data: { claimed: context.sourceCode.getText(carried) },
      });
    };

    return {
      ArrowFunctionExpression(node: ESTree.ArrowFunctionExpression) {
        const { body } = node;
        if (body.type === "BlockStatement") return;
        reportUncheckedTypeClaim(node.returnType, body);
      },

      PropertyDefinition(node: ESTree.PropertyDefinition) {
        reportUncheckedTypeClaim(node.typeAnnotation, node.value);
      },

      ReturnStatement(node: ESTree.ReturnStatement) {
        const owner = scopeAt(node).variableScope.block;
        reportUncheckedTypeClaim(declaredReturnTypeOf(owner), node.argument);
      },

      TSAsExpression: reportUncheckedCast,

      TSTypeAssertion: reportUncheckedCast,

      TSTypePredicate(node: ESTree.TSTypePredicate) {
        const { parameterName } = node;
        if (parameterName.type !== "Identifier") return;

        const owner = node.parent.parent;
        if (owner === null || !("body" in owner)) return;
        const { body } = owner;
        if (body === null || Array.isArray(body)) return;

        const binding = resolveBinding(scopeAt(owner), parameterName.name);
        const read = binding?.references.some(
          (reference) =>
            reference.identifier.start >= body.start && reference.identifier.end <= body.end,
        );
        if (read === true) return;
        context.report({
          node,
          messageId: "unexaminedTypePredicate",
          data: { parameter: parameterName.name },
        });
      },

      VariableDeclarator(node: ESTree.VariableDeclarator) {
        const { id } = node;
        if (id.type !== "Identifier") return;
        reportUncheckedTypeClaim(id.typeAnnotation, node.init);
      },
    };
  },
});
