import { createDontReviewItRule } from "../../../create-rule.ts";

import type { Definition, ESTree, Scope, Variable } from "@oxlint/plugins";

const IN_PLACE_ARRAY_METHODS: ReadonlySet<string> = new Set([
  "copyWithin",
  "fill",
  "pop",
  "push",
  "reverse",
  "shift",
  "sort",
  "splice",
  "unshift",
]);

const ARRAY_RETURNING_ARRAY_METHODS: ReadonlySet<string> = new Set([
  "concat",
  "copyWithin",
  "fill",
  "filter",
  "flat",
  "flatMap",
  "map",
  "reverse",
  "slice",
  "sort",
  "splice",
  "toReversed",
  "toSorted",
  "toSpliced",
  "with",
]);

const ARRAY_GLOBAL_FACTORY_METHODS: ReadonlySet<string> = new Set(["from", "of"]);

const ARRAY_TYPE_NAMES: ReadonlySet<string> = new Set(["Array", "ReadonlyArray"]);

type ScopeLookup = (node: ESTree.Node) => Scope;

type BindingResolution = {
  readonly scopeAt: ScopeLookup;
  readonly seenBindings: ReadonlySet<Variable>;
};

const staticPropertyName = (node: ESTree.MemberExpression): string | null => {
  if (!node.computed) return node.property.type === "Identifier" ? node.property.name : null;

  const key = node.property;
  if (key.type === "Literal") return typeof key.value === "string" ? key.value : null;
  if (key.type !== "TemplateLiteral") return null;
  if (key.expressions.length !== 0) return null;
  return key.quasis
    .slice(0, 1)
    .map((quasi) => quasi.value.cooked)
    .join("");
};

const isArrayGlobalReference = (node: ESTree.Expression): boolean =>
  node.type === "Identifier" && node.name === "Array";

const declaredTypeParameterConstraint = (node: ESTree.Node, name: string): ESTree.TSType | null => {
  if (node.parent === null) return null;

  const declared = "typeParameters" in node.parent ? node.parent.typeParameters : null;
  const matched = declared?.params.find((parameter) => parameter.name.name === name);
  if (matched !== undefined) return matched.constraint;

  return declaredTypeParameterConstraint(node.parent, name);
};

const isArrayLikeTypeReference = (
  node: ESTree.TSTypeReference,
  seenTypeParameterNames: ReadonlySet<string>,
): boolean => {
  if (node.typeName.type !== "Identifier") return false;

  const referenced = node.typeName.name;
  if (ARRAY_TYPE_NAMES.has(referenced)) return true;
  if (seenTypeParameterNames.has(referenced)) return false;

  const constraint = declaredTypeParameterConstraint(node, referenced);
  if (constraint === null) return false;

  return isArrayLikeType(constraint, new Set([...seenTypeParameterNames, referenced]));
};

const isArrayLikeType = (
  node: ESTree.TSType,
  seenTypeParameterNames: ReadonlySet<string>,
): boolean => {
  switch (node.type) {
    case "TSArrayType":
    case "TSTupleType":
      return true;
    case "TSTypeOperator":
      return (
        node.operator === "readonly" && isArrayLikeType(node.typeAnnotation, seenTypeParameterNames)
      );
    case "TSIntersectionType":
    case "TSUnionType":
      return node.types.some((member) => isArrayLikeType(member, seenTypeParameterNames));
    case "TSTypeReference":
      return isArrayLikeTypeReference(node, seenTypeParameterNames);
    default:
      return false;
  }
};

const resolveBinding = (scope: Scope | null, name: string): Variable | null => {
  if (scope === null) return null;
  return scope.set.get(name) ?? resolveBinding(scope.upper, name);
};

const isArrayLikeDefinition = (definition: Definition, resolution: BindingResolution): boolean => {
  const annotation = definition.name.typeAnnotation;
  if (annotation !== null && annotation !== undefined) {
    if (isArrayLikeType(annotation.typeAnnotation, new Set())) return true;
  }

  const declarator = definition.node;
  if (declarator.type !== "VariableDeclarator") return false;
  if (declarator.id.type !== "Identifier" || declarator.init === null) return false;
  return isArrayLikeExpression(declarator.init, resolution);
};

const isArrayLikeBinding = (
  node: ESTree.IdentifierReference,
  { scopeAt, seenBindings }: BindingResolution,
): boolean => {
  const binding = resolveBinding(scopeAt(node), node.name);
  if (binding === null || seenBindings.has(binding)) return false;

  const seen = new Set([...seenBindings, binding]);
  return binding.defs.some((definition) =>
    isArrayLikeDefinition(definition, { scopeAt, seenBindings: seen }),
  );
};

const isArrayProducingCall = (
  node: ESTree.CallExpression,
  resolution: BindingResolution,
): boolean => {
  const { callee } = node;
  if (callee.type !== "MemberExpression") return false;

  const methodName = staticPropertyName(callee);
  if (methodName === null) return false;
  if (ARRAY_GLOBAL_FACTORY_METHODS.has(methodName) && isArrayGlobalReference(callee.object)) {
    return true;
  }
  return (
    ARRAY_RETURNING_ARRAY_METHODS.has(methodName) &&
    isArrayLikeExpression(callee.object, resolution)
  );
};

const isArrayLikeThroughWrapper = (
  node: ESTree.Expression,
  resolution: BindingResolution,
): boolean | null => {
  switch (node.type) {
    case "ChainExpression":
    case "TSNonNullExpression":
      return isArrayLikeExpression(node.expression, resolution);
    case "TSAsExpression":
    case "TSSatisfiesExpression":
    case "TSTypeAssertion":
      return (
        isArrayLikeType(node.typeAnnotation, new Set()) ||
        isArrayLikeExpression(node.expression, resolution)
      );
    default:
      return null;
  }
};

const isArrayLikeExpression = (node: ESTree.Expression, resolution: BindingResolution): boolean => {
  const throughWrapper = isArrayLikeThroughWrapper(node, resolution);
  if (throughWrapper !== null) return throughWrapper;

  switch (node.type) {
    case "ArrayExpression":
      return true;
    case "NewExpression":
      return isArrayGlobalReference(node.callee);
    case "CallExpression":
      return isArrayProducingCall(node, resolution);
    case "Identifier":
      return isArrayLikeBinding(node, resolution);
    default:
      return false;
  }
};

export const noArrayMutation = createDontReviewItRule({
  name: "no-array-mutation--derive-new-array",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow calling an array method that changes the receiver in place, so a changed array always appears as a newly derived binding",
      relatedGuidelines: [],
    },
    messages: {
      inPlaceArrayMutation:
        "`{{method}}` must not be called on an array. Derive a new array and bind it: spread the old one to add elements, `filter` or `map` or `reduce` to narrow or transform, and `toSorted` or `toReversed` or `toSpliced` or `with` to order, reverse, splice or replace.",
    },
    schema: [],
  },
  create(context) {
    const scopeAt: ScopeLookup = (node) => context.sourceCode.getScope(node);

    return {
      CallExpression(node: ESTree.CallExpression) {
        const { callee } = node;
        if (callee.type !== "MemberExpression") return;

        const methodName = staticPropertyName(callee);
        if (methodName === null) return;
        if (!IN_PLACE_ARRAY_METHODS.has(methodName)) return;
        if (!isArrayLikeExpression(callee.object, { scopeAt, seenBindings: new Set() })) return;

        context.report({
          node: callee.property,
          messageId: "inPlaceArrayMutation",
          data: { method: methodName },
        });
      },
    };
  },
});
