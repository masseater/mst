import { uniqBy } from "es-toolkit";

import { unwrapExpression } from "../lib/canonical-values/finite-value-syntax.ts";

import type { ESTree } from "@oxlint/plugins";
import type {
  CanonicalValueCallableCandidate,
  CanonicalValueCallableResolver,
  CanonicalValueCallableRuntime,
  CanonicalValueIdentifierSourceResolver,
} from "./canonical-value-binding-call-types.ts";
import type {
  CanonicalValueCallArgumentSegment,
  CanonicalValueClassNode,
  CanonicalValueExecutionNode,
  CanonicalValueFunctionExpression,
  CanonicalValuePropertyDefinition,
} from "./canonical-value-binding-types.ts";

type MemberRuntime = CanonicalValueCallableRuntime & {
  readonly callable: CanonicalValueCallableResolver;
  readonly identifierSources: CanonicalValueIdentifierSourceResolver;
};

type ClassOwner = {
  readonly node: CanonicalValueClassNode;
  readonly static: boolean;
};

const staticName = (node: {
  readonly computed: boolean;
  readonly property: ESTree.Expression | ESTree.PrivateIdentifier;
}): string | null => {
  if (!node.computed && node.property.type === "Identifier") return node.property.name;
  if (node.property.type !== "Literal") return null;
  return typeof node.property.value === "string" || typeof node.property.value === "number"
    ? String(node.property.value)
    : null;
};

export const canonicalValueStaticMemberName = staticName;

const classSources = (
  runtime: MemberRuntime,
  expression: ESTree.Expression,
): readonly CanonicalValueClassNode[] => {
  const unwrapped = unwrapExpression(expression);
  if (unwrapped.type === "ClassExpression") return [unwrapped];
  if (unwrapped.type !== "Identifier") return [];
  return runtime.identifierSources(runtime, unwrapped).flatMap(({ runtime: next, source }) => {
    if (source.type === "ClassDeclaration" || source.type === "ClassExpression") return [source];
    return source.type === "Identifier" ? classSources({ ...runtime, ...next }, source) : [];
  });
};

const enclosingMethod = (node: ESTree.Node): ESTree.MethodDefinition | null => {
  const parent = node.parent;
  if (parent === null) return null;
  if (parent.type === "MethodDefinition") return parent;
  return enclosingMethod(parent);
};

const enclosingClassOwner = (expression: ESTree.ThisExpression): ClassOwner | null => {
  const method = enclosingMethod(expression);
  if (method?.parent.type !== "ClassBody") return null;
  const owner = method.parent.parent;
  return owner.type === "ClassDeclaration" || owner.type === "ClassExpression"
    ? { node: owner, static: method.static }
    : null;
};

type MemberOwner = ClassOwner | { readonly node: ESTree.ObjectExpression; readonly static: false };

const memberExpressionKey = (expression: ESTree.Expression): string =>
  `${expression.type}:${expression.start}:${expression.end}`;

const directMemberOwners = (
  runtime: MemberRuntime,
  expression: ESTree.Expression,
): readonly MemberOwner[] | null => {
  if (expression.type === "ObjectExpression") return [{ node: expression, static: false }];
  if (expression.type === "ClassExpression") return [{ node: expression, static: true }];
  if (expression.type === "ThisExpression") {
    const owner = enclosingClassOwner(expression);
    return owner === null ? [] : [owner];
  }
  if (expression.type === "NewExpression") {
    return classSources(runtime, expression.callee).map((node) => ({ node, static: false }));
  }
  return expression.type === "Identifier" ? null : [];
};

const memberOwnersWithin = (
  runtime: MemberRuntime,
  input: {
    readonly expression: ESTree.Expression;
    readonly seen: ReadonlySet<string>;
  },
): readonly MemberOwner[] => {
  const unwrapped = unwrapExpression(input.expression);
  const key = memberExpressionKey(unwrapped);
  if (input.seen.has(key)) return [];
  const direct = directMemberOwners(runtime, unwrapped);
  if (direct !== null) return direct;
  if (unwrapped.type !== "Identifier") return [];
  const seen = new Set([...input.seen, key]);
  return runtime.identifierSources(runtime, unwrapped).flatMap(({ runtime: next, source }) => {
    if (source.type === "ClassDeclaration" || source.type === "ClassExpression") {
      return [{ node: source, static: true }];
    }
    return memberOwnersWithin({ ...runtime, ...next }, { expression: source, seen });
  });
};

const memberOwners = (
  runtime: MemberRuntime,
  expression: ESTree.Expression,
): readonly MemberOwner[] => memberOwnersWithin(runtime, { expression, seen: new Set() });

const propertyName = (
  property: ESTree.ObjectProperty | CanonicalValuePropertyDefinition,
): string | null => {
  if (!property.computed && property.key.type === "Identifier") return property.key.name;
  if (property.key.type !== "Literal") return null;
  return typeof property.key.value === "string" || typeof property.key.value === "number"
    ? String(property.key.value)
    : null;
};

const wellKnownSymbolName = (
  runtime: MemberRuntime,
  expression: ESTree.Expression | ESTree.PrivateIdentifier,
): string | null => {
  if (expression.type !== "MemberExpression" || expression.object.type !== "Identifier") {
    return null;
  }
  if (expression.object.name !== "Symbol") return null;
  const binding = runtime.resolveIdentifier(expression.object);
  if (binding !== null && binding.defs.length !== 0) return null;
  return staticName(expression);
};

const objectSymbolCandidates = (
  runtime: MemberRuntime,
  input: { readonly name: string; readonly owner: ESTree.ObjectExpression },
): readonly CanonicalValueCallableCandidate[] =>
  input.owner.properties.flatMap((property) =>
    property.type === "Property" &&
    property.computed &&
    wellKnownSymbolName(runtime, property.key) === input.name
      ? runtime.callable(runtime, property.value)
      : [],
  );

const classSymbolCandidates = (
  runtime: MemberRuntime,
  input: { readonly name: string; readonly owner: ClassOwner },
): readonly CanonicalValueCallableCandidate[] =>
  input.owner.node.body.body.flatMap((element) =>
    element.type === "MethodDefinition" &&
    element.static === input.owner.static &&
    element.computed &&
    wellKnownSymbolName(runtime, element.key) === input.name
      ? [{ argumentSegments: [], node: element.value }]
      : [],
  );

export const canonicalValueWellKnownSymbolCallableCandidates = (
  runtime: MemberRuntime,
  input: { readonly expression: ESTree.Expression; readonly name: string },
): readonly CanonicalValueCallableCandidate[] => {
  const candidates = memberOwners(runtime, input.expression).flatMap((owner) =>
    owner.node.type === "ObjectExpression"
      ? objectSymbolCandidates(runtime, { name: input.name, owner: owner.node })
      : classSymbolCandidates(runtime, {
          name: input.name,
          owner: { node: owner.node, static: owner.static },
        }),
  );
  const unique = uniqBy(candidates, (candidate) => candidate.node);
  return unique.length === 1 ? unique : [];
};

const methodName = (method: ESTree.MethodDefinition): string | null => {
  if (!method.computed && method.key.type === "Identifier") return method.key.name;
  if (method.key.type !== "Literal") return null;
  return typeof method.key.value === "string" || typeof method.key.value === "number"
    ? String(method.key.value)
    : null;
};

const isFunctionExpression = (node: ESTree.Node): node is CanonicalValueFunctionExpression =>
  node.type === "FunctionExpression" && "body" in node && node.body !== null;

const objectAccessors = (input: {
  readonly kind: "get" | "set";
  readonly name: string;
  readonly owner: ESTree.ObjectExpression;
}): readonly CanonicalValueFunctionExpression[] =>
  input.owner.properties.flatMap((property) =>
    property.type === "Property" &&
    property.kind === input.kind &&
    propertyName(property) === input.name &&
    isFunctionExpression(property.value)
      ? [property.value]
      : [],
  );

const classAccessors = (input: {
  readonly kind: "get" | "set";
  readonly name: string;
  readonly owner: CanonicalValueClassNode;
  readonly staticMember: boolean;
}): readonly CanonicalValueFunctionExpression[] =>
  input.owner.body.body.flatMap((element) =>
    element.type === "MethodDefinition" &&
    element.static === input.staticMember &&
    element.kind === input.kind &&
    methodName(element) === input.name &&
    isFunctionExpression(element.value)
      ? [element.value]
      : [],
  );

export const canonicalValueMemberAccessorCandidates = (input: {
  readonly kind: "get" | "set";
  readonly member: ESTree.MemberExpression;
  readonly runtime: MemberRuntime;
}): readonly CanonicalValueFunctionExpression[] => {
  if (input.member.object.type === "Super") return [];
  const name = staticName(input.member);
  if (name === null) return [];
  const candidates = memberOwners(input.runtime, input.member.object).flatMap((owner) =>
    owner.node.type === "ObjectExpression"
      ? objectAccessors({ kind: input.kind, name, owner: owner.node })
      : classAccessors({
          kind: input.kind,
          name,
          owner: owner.node,
          staticMember: owner.static,
        }),
  );
  const unique = uniqBy(candidates, (candidate) => candidate);
  return unique.length === 1 ? unique : [];
};

const objectMemberCandidates = (
  runtime: MemberRuntime,
  input: { readonly name: string; readonly owner: ESTree.ObjectExpression },
): readonly CanonicalValueCallableCandidate[] =>
  input.owner.properties.flatMap((property) =>
    property.type === "Property" &&
    property.kind === "init" &&
    propertyName(property) === input.name
      ? runtime.callable(runtime, property.value)
      : [],
  );

const classMemberCandidates = (
  runtime: MemberRuntime,
  input: { readonly name: string; readonly owner: ClassOwner },
): readonly CanonicalValueCallableCandidate[] =>
  input.owner.node.body.body.flatMap((element) => {
    if (element.type === "MethodDefinition") {
      return element.static === input.owner.static &&
        element.kind === "method" &&
        methodName(element) === input.name
        ? [{ argumentSegments: [], node: element.value }]
        : [];
    }
    if (element.type !== "PropertyDefinition") return [];
    if (
      element.static !== input.owner.static ||
      propertyName(element) !== input.name ||
      element.value === null
    ) {
      return [];
    }
    return runtime.callable(runtime, element.value);
  });

export const canonicalValueMemberCallableCandidates = (
  runtime: MemberRuntime,
  member: ESTree.MemberExpression,
): readonly CanonicalValueCallableCandidate[] => {
  if (member.object.type === "Super") return [];
  const name = staticName(member);
  if (name === null) return [];
  const candidates = memberOwners(runtime, member.object).flatMap((owner) =>
    owner.node.type === "ObjectExpression"
      ? objectMemberCandidates(runtime, { name, owner: owner.node })
      : classMemberCandidates(runtime, {
          name,
          owner: { node: owner.node, static: owner.static },
        }),
  );
  const unique = uniqBy(candidates, (candidate) => candidate.node);
  return unique.length === 1 ? unique : [];
};

const classConstructor = (node: CanonicalValueClassNode): ESTree.Function | null => {
  const method = node.body.body.find(
    (element) => element.type === "MethodDefinition" && element.kind === "constructor",
  );
  return method?.type === "MethodDefinition" ? method.value : null;
};

const instanceFields = (
  node: CanonicalValueClassNode,
): readonly CanonicalValuePropertyDefinition[] =>
  node.body.body.flatMap((element) =>
    element.type === "PropertyDefinition" && !element.static && element.value !== null
      ? [element]
      : [],
  );

const canonicalValueConstructedClassCandidates = (
  runtime: MemberRuntime,
  input: {
    readonly argumentSegments: readonly CanonicalValueCallArgumentSegment[];
    readonly node: CanonicalValueClassNode;
  },
): readonly CanonicalValueCallableCandidate[] => {
  const constructor = classConstructor(input.node);
  if (input.node.superClass !== null && constructor !== null) {
    return [{ argumentSegments: input.argumentSegments, node: constructor }];
  }
  const inherited =
    input.node.superClass === null
      ? []
      : classSources(runtime, input.node.superClass).flatMap((node) =>
          canonicalValueConstructedClassCandidates(runtime, { argumentSegments: [], node }),
        );
  return [
    ...inherited,
    ...instanceFields(input.node).map((node) => ({ argumentSegments: [], node })),
    ...(constructor === null
      ? []
      : [{ argumentSegments: input.argumentSegments, node: constructor }]),
  ];
};

export const canonicalValueConstructedCandidates = (
  runtime: MemberRuntime,
  input: {
    readonly argumentSegments: readonly CanonicalValueCallArgumentSegment[];
    readonly callee: ESTree.Expression;
  },
): readonly CanonicalValueCallableCandidate[] =>
  classSources(runtime, input.callee).flatMap((node) =>
    canonicalValueConstructedClassCandidates(runtime, { ...input, node }),
  );

export const canonicalValueStaticClassExecutions = (
  node: CanonicalValueClassNode,
): readonly CanonicalValueExecutionNode[] =>
  node.body.body.flatMap((element): readonly CanonicalValueExecutionNode[] => {
    if (element.type === "StaticBlock") return [element];
    return element.type === "PropertyDefinition" && element.static && element.value !== null
      ? [element]
      : [];
  });

const enclosingConstructor = (node: ESTree.Node): ESTree.MethodDefinition | null => {
  const parent = node.parent;
  if (parent === null) return null;
  if (parent.type === "MethodDefinition" && parent.kind === "constructor") return parent;
  return enclosingConstructor(parent);
};

export const canonicalValueDerivedSuperCandidates = (
  runtime: MemberRuntime,
  input: {
    readonly argumentSegments: readonly CanonicalValueCallArgumentSegment[];
    readonly call: ESTree.CallExpression;
  },
): readonly CanonicalValueCallableCandidate[] => {
  const constructor = enclosingConstructor(input.call);
  if (constructor?.parent.type !== "ClassBody") return [];
  const owner = constructor.parent.parent;
  if (
    (owner.type !== "ClassDeclaration" && owner.type !== "ClassExpression") ||
    owner.superClass === null
  ) {
    return [];
  }
  const bases = classSources(runtime, owner.superClass).flatMap((node) =>
    canonicalValueConstructedClassCandidates(runtime, {
      argumentSegments: input.argumentSegments,
      node,
    }),
  );
  const fields = instanceFields(owner).map((node) => ({ argumentSegments: [], node }));
  return [...bases, ...fields];
};
