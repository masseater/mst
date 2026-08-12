import { unwrapExpression } from "../lib/canonical-values/finite-value-syntax.ts";
import {
  canonicalValueExpressionUsesGlobalObject,
  canonicalValueOriginUsesGlobalObject,
} from "./canonical-value-browser-global-origin.ts";
import { canonicalValueIsGlobalIdentifier } from "./canonical-value-global-identifier.ts";
import { canonicalValueInvocationPropertyPath } from "./canonical-value-invocation-target.ts";
import { canonicalValueModuleMemberName } from "./canonical-value-module-invocation.ts";
import { canonicalValueDefinitionIsAmbientVariable } from "./canonical-value-node-source-consumer.ts";
import {
  canonicalValueExpressionOrigin,
  type CanonicalValueExpressionOrigin,
  type CanonicalValueOrigin,
} from "./canonical-value-property-origin.ts";

import type { Definition, ESTree, Variable } from "@oxlint/plugins";
import type { CanonicalValueBindingIndex } from "./canonical-value-binding-index.ts";

const AUDIO_CONTEXT_NAMES: ReadonlySet<string> = new Set(["AudioContext", "OfflineAudioContext"]);
const WORKLET_TYPE_NAMES: ReadonlySet<string> = new Set(["Worklet"]);

const typeNameIsUnshadowed = (input: {
  readonly bindingIndex: CanonicalValueBindingIndex;
  readonly names: ReadonlySet<string>;
  readonly typeName: ESTree.TSTypeReference["typeName"];
}): boolean => {
  if (input.typeName.type !== "Identifier" || !input.names.has(input.typeName.name)) return false;
  const binding = input.bindingIndex.resolveIdentifier(input.typeName);
  return binding === null || input.bindingIndex.definitionsOf(binding).length === 0;
};

const typeHasUnshadowedName = (input: {
  readonly bindingIndex: CanonicalValueBindingIndex;
  readonly names: ReadonlySet<string>;
  readonly type: ESTree.TSType;
}): boolean => {
  if (input.type.type === "TSTypeReference") {
    return typeNameIsUnshadowed({ ...input, typeName: input.type.typeName });
  }
  if (input.type.type === "TSParenthesizedType") {
    return typeHasUnshadowedName({ ...input, type: input.type.typeAnnotation });
  }
  if (input.type.type === "TSIntersectionType" || input.type.type === "TSUnionType") {
    return input.type.types.some((member) => typeHasUnshadowedName({ ...input, type: member }));
  }
  return false;
};

const definitionHasUnshadowedType = (input: {
  readonly bindingIndex: CanonicalValueBindingIndex;
  readonly definition: Definition;
  readonly names: ReadonlySet<string>;
}): boolean => {
  const annotation = input.definition.name.typeAnnotation;
  return (
    annotation !== null &&
    annotation !== undefined &&
    typeHasUnshadowedName({ ...input, type: annotation.typeAnnotation })
  );
};

const globalConstructorExpression = (input: {
  readonly bindingIndex: CanonicalValueBindingIndex;
  readonly expression: ESTree.Expression;
  readonly names: ReadonlySet<string>;
}): boolean => {
  const expression = unwrapExpression(input.expression);
  if (expression.type === "Identifier") {
    return [...input.names].some((name) =>
      canonicalValueIsGlobalIdentifier(input.bindingIndex, { expression, name }),
    );
  }
  if (expression.type !== "MemberExpression" || expression.object.type === "Super") return false;
  const name = canonicalValueModuleMemberName(expression);
  return (
    name !== null &&
    input.names.has(name) &&
    canonicalValueExpressionUsesGlobalObject({
      bindingIndex: input.bindingIndex,
      expression: expression.object,
      name,
    })
  );
};

const definitionAudioContextExpressions = (definition: Definition): readonly ESTree.Expression[] =>
  definition.node.type === "VariableDeclarator" && definition.node.init !== null
    ? [definition.node.init]
    : [];

const expressionIsAudioContext = (input: {
  readonly bindingIndex: CanonicalValueBindingIndex;
  readonly expression: ESTree.Expression;
  readonly seen: ReadonlySet<Variable>;
}): boolean => {
  const expression = unwrapExpression(input.expression);
  if (expression.type === "NewExpression") {
    return globalConstructorExpression({
      ...input,
      expression: expression.callee,
      names: AUDIO_CONTEXT_NAMES,
    });
  }
  if (expression.type !== "Identifier") return false;
  const binding = input.bindingIndex.resolveIdentifier(expression);
  if (binding === null || input.seen.has(binding)) return false;
  const seen = new Set([...input.seen, binding]);
  return input.bindingIndex.definitionsOf(binding).some(
    (definition) =>
      definitionHasUnshadowedType({
        bindingIndex: input.bindingIndex,
        definition,
        names: AUDIO_CONTEXT_NAMES,
      }) ||
      definitionAudioContextExpressions(definition).some((initializer) =>
        expressionIsAudioContext({ ...input, expression: initializer, seen }),
      ),
  );
};

const expressionIsAmbientWorklet = (input: {
  readonly bindingIndex: CanonicalValueBindingIndex;
  readonly expression: ESTree.Expression;
}): boolean => {
  const expression = unwrapExpression(input.expression);
  if (expression.type !== "Identifier") return false;
  const binding = input.bindingIndex.resolveIdentifier(expression);
  return (
    binding !== null &&
    input.bindingIndex.definitionsOf(binding).some(
      (definition) =>
        canonicalValueDefinitionIsAmbientVariable(definition) &&
        definitionHasUnshadowedType({
          bindingIndex: input.bindingIndex,
          definition,
          names: WORKLET_TYPE_NAMES,
        }),
    )
  );
};

export const canonicalValueOriginIsWorkletAddModule = (input: {
  readonly bindingIndex: CanonicalValueBindingIndex;
  readonly origin: CanonicalValueExpressionOrigin;
}): boolean => {
  const path = canonicalValueInvocationPropertyPath(input.origin);
  if (path?.at(-1) !== "addModule") return false;
  if (path.at(-2) === "audioWorklet") {
    return (
      path.length === 2 &&
      expressionIsAudioContext({
        bindingIndex: input.bindingIndex,
        expression: input.origin.expression,
        seen: new Set(),
      })
    );
  }
  if (path.at(-2) === "paintWorklet") {
    return (
      canonicalValueIsGlobalIdentifier(input.bindingIndex, {
        expression: input.origin.expression,
        name: "CSS",
      }) ||
      canonicalValueOriginUsesGlobalObject({
        ...input,
        path: ["CSS", "paintWorklet", "addModule"],
      })
    );
  }
  return (
    path.length === 1 &&
    expressionIsAmbientWorklet({
      bindingIndex: input.bindingIndex,
      expression: input.origin.expression,
    })
  );
};

const directReceiverIsWorklet = (input: {
  readonly bindingIndex: CanonicalValueBindingIndex;
  readonly receiver: ESTree.Expression;
}): boolean => {
  const receiverName =
    input.receiver.type === "MemberExpression"
      ? canonicalValueModuleMemberName(input.receiver)
      : null;
  return (
    (receiverName === "audioWorklet" &&
      input.receiver.type === "MemberExpression" &&
      input.receiver.object.type !== "Super" &&
      expressionIsAudioContext({
        bindingIndex: input.bindingIndex,
        expression: input.receiver.object,
        seen: new Set(),
      })) ||
    (receiverName === "paintWorklet" &&
      input.receiver.type === "MemberExpression" &&
      input.receiver.object.type !== "Super" &&
      canonicalValueIsGlobalIdentifier(input.bindingIndex, {
        expression: input.receiver.object,
        name: "CSS",
      })) ||
    expressionIsAmbientWorklet({
      bindingIndex: input.bindingIndex,
      expression: input.receiver,
    })
  );
};

export const canonicalValueDirectWorkletModuleOrigin = (input: {
  readonly bindingIndex: CanonicalValueBindingIndex;
  readonly invocation: ESTree.CallExpression | ESTree.NewExpression;
}): CanonicalValueOrigin | null => {
  if (input.invocation.type !== "CallExpression") return null;
  const callee = unwrapExpression(input.invocation.callee);
  if (
    callee.type !== "MemberExpression" ||
    canonicalValueModuleMemberName(callee) !== "addModule"
  ) {
    return null;
  }
  if (callee.object.type === "Super") return null;
  if (!directReceiverIsWorklet({ bindingIndex: input.bindingIndex, receiver: callee.object })) {
    return null;
  }
  const first = input.invocation.arguments[0];
  return first === undefined || first.type === "SpreadElement"
    ? null
    : canonicalValueExpressionOrigin(first);
};
