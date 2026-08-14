import { staticMemberName, staticPropertyName, staticSpelling } from "./static-names.ts";
import {
  argumentsPassedTo,
  asSpecFunction,
  returnedExpressionsOf,
  unwrapSubject,
  type SpecFunction,
} from "./subject-expressions.ts";

import type { ESTree } from "@oxlint/plugins";

const parameterNameAt = (takenFunction: SpecFunction, index: number): string | null => {
  const parameter = takenFunction.params[index];
  if (parameter === undefined) return null;
  return parameter.type === "Identifier" ? parameter.name : null;
};

export const fixtureContextParameterName = (takenFunction: SpecFunction): string | null =>
  parameterNameAt(takenFunction, 0);

export type FixtureDependency = {
  readonly name: string;
  readonly boundAs: string | null;
  readonly property: ESTree.BindingProperty;
};

export const fixtureDependenciesOf = (
  takenFunction: SpecFunction,
): readonly FixtureDependency[] | null => {
  const [parameter] = takenFunction.params;
  if (parameter?.type !== "ObjectPattern") return null;

  return parameter.properties.flatMap((property) => {
    if (property.type !== "Property") return [];
    const spelled = staticPropertyName(property);
    if (spelled === null) return [];
    const boundAs = property.value.type === "Identifier" ? property.value.name : null;
    return [{ name: spelled, boundAs, property }];
  });
};

export const FIXTURE_BUILDER_MEMBER = "extend";

const CUSTOM_MATCHER_RECEIVER = "expect";

export const isFixtureBuilderCall = (call: ESTree.CallExpression): boolean => {
  const callee = unwrapSubject(call.callee);
  if (callee.type !== "MemberExpression") return false;
  if (staticMemberName(callee) !== FIXTURE_BUILDER_MEMBER) return false;

  const receiver = unwrapSubject(callee.object);
  return !(receiver.type === "Identifier" && receiver.name === CUSTOM_MATCHER_RECEIVER);
};

const FIXTURE_FORMS = ["builder", "object"] as const;

export type FixtureDeclaration = {
  readonly name: string;
  readonly nameNode: ESTree.Node;
  readonly form: (typeof FIXTURE_FORMS)[number];
  readonly factory: SpecFunction | null;
  readonly subjects: readonly ESTree.Expression[];
};

const builderDeclaration = ({
  name,
  nameNode,
  rest,
}: {
  readonly name: string;
  readonly nameNode: ESTree.Node;
  readonly rest: readonly ESTree.Expression[];
}): FixtureDeclaration => {
  const handed = rest.at(-1);
  if (handed === undefined) {
    return { name, nameNode, form: "builder", factory: null, subjects: [] };
  }

  const factory = asSpecFunction(handed);
  return factory === null
    ? { name, nameNode, form: "builder", factory: null, subjects: [handed] }
    : {
        name,
        nameNode,
        form: "builder",
        factory,
        subjects: returnedExpressionsOf(factory),
      };
};

const scopedFixtureExpression = (written: ESTree.Expression): ESTree.Expression | null => {
  const bare = unwrapSubject(written);
  if (bare.type !== "ArrayExpression") return bare;

  const [head] = bare.elements;
  return head === undefined || head === null || head.type === "SpreadElement" ? null : head;
};

const HANDOFF_PARAMETER_INDEX = 1;

const objectDeclaration = ({
  name,
  nameNode,
  written,
}: {
  readonly name: string;
  readonly nameNode: ESTree.Node;
  readonly written: ESTree.Expression;
}): FixtureDeclaration => {
  const scoped = scopedFixtureExpression(written);
  if (scoped === null) return { name, nameNode, form: "object", factory: null, subjects: [] };

  const factory = asSpecFunction(scoped);
  if (factory === null) {
    return { name, nameNode, form: "object", factory: null, subjects: [scoped] };
  }

  const handoff = parameterNameAt(factory, HANDOFF_PARAMETER_INDEX);
  return {
    name,
    nameNode,
    form: "object",
    factory,
    subjects: handoff === null ? [] : argumentsPassedTo(factory, handoff),
  };
};

const objectDeclarations = (holder: ESTree.ObjectExpression): readonly FixtureDeclaration[] =>
  holder.properties.flatMap((property) => {
    if (property.type !== "Property") return [];
    const spelled = staticPropertyName(property);
    return spelled === null
      ? []
      : [objectDeclaration({ name: spelled, nameNode: property.key, written: property.value })];
  });

export const fixtureDeclarationsOf = (
  call: ESTree.CallExpression,
): readonly FixtureDeclaration[] => {
  if (!isFixtureBuilderCall(call)) return [];

  const written = call.arguments.flatMap((argument) =>
    argument.type === "SpreadElement" ? [] : [argument],
  );
  if (written.length !== call.arguments.length) return [];

  const [head, ...rest] = written;
  if (head === undefined) return [];

  const declaredName = staticSpelling(head);
  if (declaredName !== null) {
    return [builderDeclaration({ name: declaredName, nameNode: head, rest })];
  }

  const holder = unwrapSubject(head);
  return holder.type === "ObjectExpression" ? objectDeclarations(holder) : [];
};
