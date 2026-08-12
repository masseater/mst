import { uniqBy } from "es-toolkit";

import { unwrapExpression } from "../lib/canonical-values/finite-value-syntax.ts";
import { canonicalValueImportDeclarationOf } from "./canonical-value-import-definition.ts";
import { canonicalValueImportedDefinitionName } from "./canonical-value-imported-name.ts";
import {
  canonicalValueModuleArrayExpressionsAt,
  canonicalValueModuleInvocationArgumentsAt,
} from "./canonical-value-module-arguments.ts";
import {
  canonicalValueModuleMemberName,
  canonicalValueNormalizedModuleInvocation,
} from "./canonical-value-module-invocation.ts";
import {
  COMMONJS_MODULE,
  CREATE_REQUIRE,
  GET_BUILTIN_MODULE,
  IMPORT_META,
  MODULE_LOADER,
  MODULE_RESOLVER,
  NODE_MODULE,
  PROCESS_GLOBAL,
  REFLECT_CONSTRUCT,
  REFLECT_GLOBAL,
  type ModuleCallableFact,
  type ModuleLoaderInvocation as Invocation,
  uniqueModuleCallableFacts,
} from "./canonical-value-module-loader-fact.ts";
import { bindingInScope } from "./scope-resolution.ts";

import type { Context, Definition, ESTree, Variable } from "@oxlint/plugins";
import type { PropertyPathSegment } from "../lib/canonical-values/property-path.ts";
import type { CanonicalValueModuleResolution as Resolution } from "./canonical-value-module-resolution.ts";
import type { CanonicalValueOriginProjection } from "./canonical-value-property-origin.ts";
import type { CanonicalValuePropertyState } from "./canonical-value-property-state.ts";

export const NODE_MODULE_SPECIFIERS: ReadonlySet<string> = new Set(["module", "node:module"]);

const isNodeModuleDeclaration = (definition: Definition): boolean => {
  const declaration = canonicalValueImportDeclarationOf(definition);
  return declaration !== null && NODE_MODULE_SPECIFIERS.has(declaration.source.value);
};

const importDefinitionFacts = (definition: Definition): readonly ModuleCallableFact[] => {
  const node = definition.node;
  if (!isNodeModuleDeclaration(definition)) return [];
  if (node.type === "ImportSpecifier") {
    return canonicalValueImportedDefinitionName(definition) === "createRequire"
      ? [{ boundFirst: null, kind: CREATE_REQUIRE }]
      : [];
  }
  return node.type === "ImportDefaultSpecifier" || node.type === "ImportNamespaceSpecifier"
    ? [{ boundFirst: null, kind: NODE_MODULE }]
    : [];
};

const importEqualsDefinitionFacts = (definition: Definition): readonly ModuleCallableFact[] => {
  const node = definition.node;
  return node.type === "TSImportEqualsDeclaration" &&
    node.moduleReference.type === "TSExternalModuleReference" &&
    NODE_MODULE_SPECIFIERS.has(node.moduleReference.expression.value)
    ? [{ boundFirst: null, kind: NODE_MODULE }]
    : [];
};

const definitionFacts = (
  resolution: Resolution,
  definition: Definition,
): readonly ModuleCallableFact[] => {
  const node = definition.node;
  if (node.type === "VariableDeclarator" && node.init !== null) {
    return expressionFacts(resolution, node.init);
  }
  const imported = importDefinitionFacts(definition);
  return imported.length === 0 ? importEqualsDefinitionFacts(definition) : imported;
};

const bindingFacts = (resolution: Resolution, binding: Variable): readonly ModuleCallableFact[] => {
  if (resolution.seen.has(binding)) return [];
  const next = { ...resolution, seen: new Set([...resolution.seen, binding]) };
  return uniqueModuleCallableFacts([
    ...binding.defs.flatMap((definition) =>
      definition.node.start < resolution.cutoff ? definitionFacts(next, definition) : [],
    ),
    ...binding.references.flatMap((reference) => {
      const writeExpression = reference.writeExpr ?? null;
      return writeExpression !== null && reference.identifier.start < resolution.cutoff
        ? expressionFacts(next, writeExpression)
        : [];
    }),
  ]);
};

const identifierFacts = (
  resolution: Resolution,
  identifier: ESTree.IdentifierReference,
): readonly ModuleCallableFact[] => {
  const binding = bindingInScope(
    resolution.context.sourceCode.getScope(identifier),
    identifier.name,
  );
  if (binding === null || binding.defs.length === 0) {
    if (identifier.name === "require") return [{ boundFirst: null, kind: MODULE_LOADER }];
    if (identifier.name === "module") return [{ boundFirst: null, kind: COMMONJS_MODULE }];
    if (identifier.name === "process") return [{ boundFirst: null, kind: PROCESS_GLOBAL }];
    return identifier.name === "Reflect" ? [{ boundFirst: null, kind: REFLECT_GLOBAL }] : [];
  }
  return bindingFacts(resolution, binding);
};

const metaPropertyFacts = (expression: ESTree.MetaProperty): readonly ModuleCallableFact[] =>
  expression.meta.name === "import" && expression.property.name === "meta"
    ? [{ boundFirst: null, kind: IMPORT_META }]
    : [];

const PROPERTY_FACT_TRANSITIONS: readonly {
  readonly from: symbol;
  readonly property: string;
  readonly to: symbol;
}[] = [
  { from: NODE_MODULE, property: "createRequire", to: CREATE_REQUIRE },
  { from: MODULE_LOADER, property: "resolve", to: MODULE_RESOLVER },
  { from: COMMONJS_MODULE, property: "require", to: MODULE_LOADER },
  { from: COMMONJS_MODULE, property: "constructor", to: NODE_MODULE },
  { from: MODULE_LOADER, property: "main", to: COMMONJS_MODULE },
  { from: IMPORT_META, property: "resolve", to: MODULE_RESOLVER },
  { from: PROCESS_GLOBAL, property: "getBuiltinModule", to: GET_BUILTIN_MODULE },
  { from: PROCESS_GLOBAL, property: "mainModule", to: COMMONJS_MODULE },
  { from: REFLECT_GLOBAL, property: "construct", to: REFLECT_CONSTRUCT },
];

const factThroughProperty = (
  fact: ModuleCallableFact,
  property: string,
): ModuleCallableFact | null => {
  const transition = PROPERTY_FACT_TRANSITIONS.find(
    (candidate) => candidate.from === fact.kind && candidate.property === property,
  );
  return transition === undefined ? null : { boundFirst: null, kind: transition.to };
};

const factsThroughProperty = (
  facts: readonly ModuleCallableFact[],
  property: PropertyPathSegment,
): readonly ModuleCallableFact[] => {
  if (typeof property !== "string") return [];
  return uniqueModuleCallableFacts(
    facts.flatMap((fact) => {
      const projected = factThroughProperty(fact, property);
      return projected === null ? [] : [projected];
    }),
  );
};

const memberFacts = (
  resolution: Resolution,
  member: ESTree.MemberExpression,
): readonly ModuleCallableFact[] => {
  if (member.object.type === "Super") return [];
  const name = canonicalValueModuleMemberName(member);
  const receiverFacts = expressionFacts(resolution, member.object);
  return name === null ? [] : factsThroughProperty(receiverFacts, name);
};

const boundFacts = (
  resolution: Resolution,
  invocation: Invocation,
): readonly ModuleCallableFact[] => {
  const firstArguments = canonicalValueModuleInvocationArgumentsAt(resolution, {
    index: 0,
    invocation,
  });
  return uniqueModuleCallableFacts(
    expressionFacts(resolution, invocation.target).flatMap((fact) =>
      firstArguments.length === 0
        ? [fact]
        : firstArguments.map((boundFirst) => ({ ...fact, boundFirst })),
    ),
  );
};

const calledFacts = (
  resolution: Resolution,
  invocation: Invocation,
): readonly ModuleCallableFact[] => {
  const firstArguments = canonicalValueModuleInvocationArgumentsAt(resolution, {
    index: 0,
    invocation,
  });
  return uniqueModuleCallableFacts(
    expressionFacts(resolution, invocation.target).flatMap(
      (fact): readonly ModuleCallableFact[] => {
        if (fact.kind === CREATE_REQUIRE) {
          return [{ boundFirst: null, kind: MODULE_LOADER }];
        }
        if (fact.kind !== MODULE_LOADER && fact.kind !== GET_BUILTIN_MODULE) return [];
        const argumentsToInspect = fact.boundFirst === null ? firstArguments : [fact.boundFirst];
        return argumentsToInspect.some(
          (argument) =>
            argument.type === "Literal" &&
            typeof argument.value === "string" &&
            NODE_MODULE_SPECIFIERS.has(argument.value),
        )
          ? [{ boundFirst: null, kind: NODE_MODULE }]
          : [];
      },
    ),
  );
};

const branchFacts = (
  resolution: Resolution,
  expression: ESTree.LogicalExpression,
): readonly ModuleCallableFact[] =>
  uniqueModuleCallableFacts([
    ...expressionFacts(resolution, expression.left),
    ...expressionFacts(resolution, expression.right),
  ]);

const remainingExpressionFacts = (
  resolution: Resolution,
  expression: ESTree.Expression,
): readonly ModuleCallableFact[] => {
  if (expression.type === "ConditionalExpression") {
    return uniqueModuleCallableFacts([
      ...expressionFacts(resolution, expression.consequent),
      ...expressionFacts(resolution, expression.alternate),
    ]);
  }
  if (expression.type === "LogicalExpression") return branchFacts(resolution, expression);
  if (expression.type === "SequenceExpression") {
    const last = expression.expressions.at(-1);
    return last === undefined ? [] : expressionFacts(resolution, last);
  }
  return expression.type === "AssignmentExpression"
    ? expressionFacts(resolution, expression.right)
    : [];
};

const factsThroughProjection = (
  facts: readonly ModuleCallableFact[],
  projection: CanonicalValueOriginProjection,
): readonly ModuleCallableFact[] => {
  if (projection.kind !== "property") return [];
  return projection.path.reduce<readonly ModuleCallableFact[]>(factsThroughProperty, facts);
};

const propertyOriginFacts = (
  resolution: Resolution,
  expression: ESTree.Expression,
): readonly ModuleCallableFact[] =>
  uniqueModuleCallableFacts(
    resolution.propertyState.origins({ expression }).candidates.flatMap((origin) => {
      if (origin.kind === "absent" || origin.expression === expression) return [];
      const base = expressionFacts(
        { ...resolution, cutoff: origin.expression.start },
        origin.expression,
      );
      return origin.projections.reduce<readonly ModuleCallableFact[]>(factsThroughProjection, base);
    }),
  );

const expressionFacts = (
  resolution: Resolution,
  rawExpression: ESTree.Expression,
): readonly ModuleCallableFact[] => {
  const expression = unwrapExpression(rawExpression);
  const direct =
    expression.type === "Identifier"
      ? identifierFacts(resolution, expression)
      : expression.type === "MemberExpression"
        ? memberFacts(resolution, expression)
        : expression.type === "MetaProperty"
          ? metaPropertyFacts(expression)
          : [];
  const invoked =
    expression.type === "CallExpression"
      ? (() => {
          const invocation = canonicalValueNormalizedModuleInvocation(resolution, expression);
          return invocation.bind
            ? boundFacts(resolution, invocation)
            : calledFacts(resolution, invocation);
        })()
      : [];
  const remaining = remainingExpressionFacts(resolution, expression);
  return uniqueModuleCallableFacts([
    ...direct,
    ...invoked,
    ...remaining,
    ...propertyOriginFacts(resolution, expression),
  ]);
};

const normalizedLoaderInvocation = (
  resolution: Resolution,
  node: ESTree.CallExpression | ESTree.NewExpression,
): Invocation =>
  node.type === "CallExpression"
    ? canonicalValueNormalizedModuleInvocation(resolution, node)
    : {
        argumentArray: null,
        bind: false,
        directArguments: node.arguments,
        target: unwrapExpression(node.callee),
      };

const loaderArguments = (
  facts: readonly ModuleCallableFact[],
  firstArguments: readonly ESTree.Expression[],
): readonly ESTree.Expression[] =>
  facts.flatMap((fact) =>
    fact.kind !== MODULE_LOADER
      ? []
      : fact.boundFirst === null
        ? firstArguments
        : [fact.boundFirst],
  );

const constructedLoaderArguments = (
  resolution: Resolution,
  invocation: Invocation,
): readonly ESTree.Expression[] => {
  const targets = canonicalValueModuleInvocationArgumentsAt(resolution, { index: 0, invocation });
  const argumentArrays = canonicalValueModuleInvocationArgumentsAt(resolution, {
    index: 1,
    invocation,
  });
  const firstArguments = argumentArrays.flatMap((array) =>
    canonicalValueModuleArrayExpressionsAt(resolution, { expression: array, index: 0 }),
  );
  return targets.flatMap((target) =>
    loaderArguments(expressionFacts(resolution, target), firstArguments),
  );
};

export const canonicalValueModuleLoaderArguments = (input: {
  readonly context: Context;
  readonly invocation: ESTree.CallExpression | ESTree.NewExpression;
  readonly propertyState: CanonicalValuePropertyState;
}): readonly ESTree.Expression[] => {
  const { context, propertyState } = input;
  const resolution = {
    context,
    cutoff: input.invocation.start,
    propertyState,
    seen: new Set<Variable>(),
  };
  const invocation = normalizedLoaderInvocation(resolution, input.invocation);
  if (invocation.bind) return [];
  const targetFacts = expressionFacts(resolution, invocation.target);
  const firstArguments = canonicalValueModuleInvocationArgumentsAt(resolution, {
    index: 0,
    invocation,
  });
  return uniqBy(
    [
      ...loaderArguments(targetFacts, firstArguments),
      ...(targetFacts.some((fact) => fact.kind === REFLECT_CONSTRUCT)
        ? constructedLoaderArguments(resolution, invocation)
        : []),
    ],
    (argument) => `${argument.start}:${argument.end}`,
  );
};

export const canonicalValueModuleResolverArguments = (input: {
  readonly context: Context;
  readonly invocation: ESTree.CallExpression;
  readonly propertyState: CanonicalValuePropertyState;
}): readonly ESTree.Expression[] => {
  const resolution = {
    context: input.context,
    cutoff: input.invocation.start,
    propertyState: input.propertyState,
    seen: new Set<Variable>(),
  };
  const invocation = canonicalValueNormalizedModuleInvocation(resolution, input.invocation);
  if (invocation.bind) return [];
  return expressionFacts(resolution, invocation.target).some(
    (fact) => fact.kind === MODULE_RESOLVER,
  )
    ? canonicalValueModuleInvocationArgumentsAt(resolution, { index: 0, invocation })
    : [];
};
