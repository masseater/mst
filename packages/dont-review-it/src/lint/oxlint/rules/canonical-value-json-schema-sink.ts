import { flatMap } from "es-toolkit";

import {
  closedCandidateSet,
  filterCandidateSet,
  flatMapCandidateSet,
  mapCandidateSet,
  openCandidateSet,
  type CandidateSet,
} from "../lib/canonical-values/candidate-set.ts";
import { JSON_SCHEMA_ENUM_KEY } from "../lib/canonical-values/finite-value-syntax.ts";
import { type PropertyPathInput } from "../lib/canonical-values/property-path.ts";
import { canonicalValueDomainFactIdentity } from "./canonical-value-domain-fact.ts";
import { reportCanonicalValueDomainCandidates } from "./canonical-value-domain-report.ts";
import {
  appendCanonicalValueOriginProjection,
  canonicalValueOriginKey,
  type CanonicalValueOrigin,
  type CanonicalValueOriginProjection,
} from "./canonical-value-property-origin.ts";
import { type CanonicalValueSinkEnvironment } from "./canonical-value-sink-environment.ts";
import { canonicalValueStandardPropertyMutationFacts } from "./canonical-value-standard-property-mutation.ts";

import type { ESTree } from "@oxlint/plugins";

export type CanonicalValueJsonSchemaSinkEnvironment = CanonicalValueSinkEnvironment;

type CanonicalValueAssignmentSource = {
  readonly expression: ESTree.Expression;
  readonly path: readonly PropertyPathInput[];
  readonly projections: readonly CanonicalValueOriginProjection[];
};

const presentOrigins = (
  origins: CandidateSet<CanonicalValueOrigin>,
): CandidateSet<CanonicalValueOrigin> => {
  const candidates = origins.candidates.filter((origin) => origin.kind !== "absent");
  return origins.complete
    ? closedCandidateSet(candidates, canonicalValueOriginKey)
    : openCandidateSet(candidates, canonicalValueOriginKey);
};

const appendSourceProperty = (
  source: CanonicalValueAssignmentSource,
  property: string,
): CanonicalValueAssignmentSource =>
  source.projections.length === 0
    ? { ...source, path: [...source.path, property] }
    : {
        ...source,
        projections: [...source.projections, { kind: "property", path: [property] }],
      };

const appendSourceProjection = (
  source: CanonicalValueAssignmentSource,
  projection: CanonicalValueOriginProjection,
): CanonicalValueAssignmentSource => ({
  ...source,
  projections: [...source.projections, projection],
});

const memberNames = ({
  assignment,
  environment,
  member,
}: {
  readonly assignment: ESTree.AssignmentExpression;
  readonly environment: CanonicalValueJsonSchemaSinkEnvironment;
  readonly member: ESTree.MemberExpression;
}): CandidateSet<string> =>
  environment.propertyState.propertyKeys({
    computed: member.computed,
    cutoff: assignment.start,
    executionContext: environment.bindingIndex.executionContextAt(assignment),
    key: member.property,
  });

const objectPropertySources = ({
  assignment,
  environment,
  source,
  target,
}: {
  readonly assignment: ESTree.AssignmentExpression;
  readonly environment: CanonicalValueJsonSchemaSinkEnvironment;
  readonly source: CanonicalValueAssignmentSource;
  readonly target: ESTree.ObjectAssignmentTarget;
}): readonly CanonicalValueAssignmentSource[] =>
  flatMap(target.properties, (property) => {
    if (property.type === "RestElement") return [];
    const names = environment.propertyState.propertyKeys({
      computed: property.computed,
      cutoff: assignment.start,
      executionContext: environment.bindingIndex.executionContextAt(assignment),
      key: property.key,
    });
    return flatMap(names.candidates, (name) =>
      enumAssignmentSources({
        assignment,
        environment,
        source: appendSourceProperty(source, name),
        target: property.value,
      }),
    );
  });

const arrayElementSources = ({
  assignment,
  environment,
  source,
  target,
}: {
  readonly assignment: ESTree.AssignmentExpression;
  readonly environment: CanonicalValueJsonSchemaSinkEnvironment;
  readonly source: CanonicalValueAssignmentSource;
  readonly target: ESTree.ArrayAssignmentTarget;
}): readonly CanonicalValueAssignmentSource[] =>
  flatMap(target.elements, (element, index) => {
    if (element === null) return [];
    const nextSource =
      element.type === "RestElement"
        ? appendSourceProjection(source, { kind: "array-slice", startIndex: index })
        : appendSourceProperty(source, String(index));
    return enumAssignmentSources({
      assignment,
      environment,
      source: nextSource,
      target: element.type === "RestElement" ? element.argument : element,
    });
  });

type CanonicalValueWrappedAssignmentTarget = Extract<
  ESTree.AssignmentTargetMaybeDefault,
  {
    readonly type:
      | "TSAsExpression"
      | "TSNonNullExpression"
      | "TSSatisfiesExpression"
      | "TSTypeAssertion";
  }
>;

const isWrappedAssignmentTarget = (
  target: ESTree.AssignmentTargetMaybeDefault,
): target is CanonicalValueWrappedAssignmentTarget =>
  target.type === "TSAsExpression" ||
  target.type === "TSSatisfiesExpression" ||
  target.type === "TSNonNullExpression" ||
  target.type === "TSTypeAssertion";

const wrappedMemberTarget = (
  target: CanonicalValueWrappedAssignmentTarget,
): ESTree.MemberExpression | null => {
  if (target.type === "TSAsExpression") {
    return target.expression.type === "MemberExpression" ? target.expression : null;
  }
  if (target.type === "TSSatisfiesExpression") {
    return target.expression.type === "MemberExpression" ? target.expression : null;
  }
  if (target.type === "TSNonNullExpression") {
    return target.expression.type === "MemberExpression" ? target.expression : null;
  }
  return target.expression.type === "MemberExpression" ? target.expression : null;
};

const enumAssignmentSources = ({
  assignment,
  environment,
  source,
  target,
}: {
  readonly assignment: ESTree.AssignmentExpression;
  readonly environment: CanonicalValueJsonSchemaSinkEnvironment;
  readonly source: CanonicalValueAssignmentSource;
  readonly target: ESTree.AssignmentTargetMaybeDefault;
}): readonly CanonicalValueAssignmentSource[] => {
  if (target.type === "MemberExpression") {
    return memberNames({ assignment, environment, member: target }).candidates.includes(
      JSON_SCHEMA_ENUM_KEY,
    )
      ? [source]
      : [];
  }
  if (isWrappedAssignmentTarget(target)) {
    const wrapped = wrappedMemberTarget(target);
    return wrapped === null
      ? []
      : enumAssignmentSources({ assignment, environment, source, target: wrapped });
  }
  if (target.type === "Identifier") return [];
  if (target.type === "AssignmentPattern") {
    return [
      ...enumAssignmentSources({
        assignment,
        environment,
        source,
        target: target.left,
      }),
      ...enumAssignmentSources({
        assignment,
        environment,
        source: { expression: target.right, path: [], projections: [] },
        target: target.left,
      }),
    ];
  }
  return target.type === "ObjectPattern"
    ? objectPropertySources({ assignment, environment, source, target })
    : arrayElementSources({ assignment, environment, source, target });
};

const projectedOrigins = (
  source: CanonicalValueAssignmentSource,
  environment: CanonicalValueJsonSchemaSinkEnvironment,
): CandidateSet<CanonicalValueOrigin> =>
  source.projections.reduce<CandidateSet<CanonicalValueOrigin>>(
    (origins, projection) =>
      mapCandidateSet(origins, {
        candidateKey: canonicalValueOriginKey,
        mapCandidate: (origin) => appendCanonicalValueOriginProjection(origin, projection),
      }),
    environment.propertyState.origins({ expression: source.expression, path: source.path }),
  );

const reportOrigins = (
  origins: CandidateSet<CanonicalValueOrigin>,
  environment: CanonicalValueJsonSchemaSinkEnvironment,
): void => {
  const candidates = flatMapCandidateSet(presentOrigins(origins), {
    candidateKey: canonicalValueDomainFactIdentity,
    mapCandidate: (origin) => environment.domain.origin({ origin }),
  });
  reportCanonicalValueDomainCandidates({
    candidates,
    onlyWhenOwned: false,
    reportIncompleteValues: false,
    reporter: environment.reporter,
  });
};

const opaqueCallEnumOrigin = (
  call: ESTree.CallExpression,
  origin: CanonicalValueOrigin,
): boolean => {
  if (origin.kind === "absent" || origin.expression !== call || origin.projections.length !== 1) {
    return false;
  }
  const [projection] = origin.projections;
  return (
    projection?.kind === "property" &&
    projection.path.length === 1 &&
    projection.path[0] === JSON_SCHEMA_ENUM_KEY
  );
};

const callIntroducesOrigin = (call: ESTree.CallExpression, origin: CanonicalValueOrigin): boolean =>
  origin.kind !== "absent" &&
  origin.expression.start >= call.start &&
  origin.expression.end <= call.end;

const branchExecutes = ({
  child,
  environment,
  parent,
}: {
  readonly child: ESTree.Node;
  readonly environment: CanonicalValueJsonSchemaSinkEnvironment;
  readonly parent: ESTree.IfStatement | ESTree.ConditionalExpression | ESTree.LogicalExpression;
}): boolean | null => {
  const test = parent.type === "LogicalExpression" ? parent.left : parent.test;
  if (child === test) return true;
  const condition = environment.propertyState.condition({ expression: test });
  if (condition === null) return null;
  if (parent.type === "IfStatement" || parent.type === "ConditionalExpression") {
    return child === (condition.truthy ? parent.consequent : parent.alternate);
  }
  if (child !== parent.right) return true;
  return parent.operator === "??"
    ? condition.nullish
    : parent.operator === "&&"
      ? condition.truthy
      : !condition.truthy;
};

const isBranchExpression = (
  node: ESTree.Node,
): node is ESTree.IfStatement | ESTree.ConditionalExpression | ESTree.LogicalExpression =>
  node.type === "IfStatement" ||
  node.type === "ConditionalExpression" ||
  node.type === "LogicalExpression";

const edgeIsUnreachable = ({
  child,
  environment,
  parent,
}: {
  readonly child: ESTree.Node;
  readonly environment: CanonicalValueJsonSchemaSinkEnvironment;
  readonly parent: ESTree.Node;
}): boolean => {
  if (isBranchExpression(parent)) {
    return branchExecutes({ child, environment, parent }) === false;
  }
  if (parent.type === "WhileStatement" && child === parent.body) {
    return environment.propertyState.condition({ expression: parent.test })?.truthy === false;
  }
  if (parent.type === "ForStatement" && child === parent.body && parent.test !== null) {
    return environment.propertyState.condition({ expression: parent.test })?.truthy === false;
  }
  return false;
};

const staticallyUnreachable = (
  node: ESTree.Node,
  environment: CanonicalValueJsonSchemaSinkEnvironment,
): boolean => {
  if (node.type === "Program") return false;
  const parent = node.parent;
  return (
    edgeIsUnreachable({ child: node, environment, parent }) ||
    staticallyUnreachable(parent, environment)
  );
};

export const evaluateCanonicalValueJsonSchemaObject = (
  node: ESTree.ObjectExpression,
  environment: CanonicalValueJsonSchemaSinkEnvironment,
): void => {
  const executionContext = environment.bindingIndex.executionContextAt(node);
  const hasEnumProperty = node.properties.some(
    (property) =>
      property.type === "Property" &&
      environment.propertyState
        .propertyKeys({
          computed: property.computed,
          cutoff: node.start,
          executionContext,
          key: property.key,
        })
        .candidates.includes(JSON_SCHEMA_ENUM_KEY),
  );
  if (!hasEnumProperty) return;
  reportOrigins(
    environment.propertyState.origins({ expression: node, path: [JSON_SCHEMA_ENUM_KEY] }),
    environment,
  );
};

export const evaluateCanonicalValueJsonSchemaAssignment = (
  node: ESTree.AssignmentExpression,
  environment: CanonicalValueJsonSchemaSinkEnvironment,
): void => {
  if (node.operator !== "=" || staticallyUnreachable(node, environment)) return;
  const initialSource: CanonicalValueAssignmentSource = {
    expression: node.right,
    path: [],
    projections: [],
  };
  for (const source of enumAssignmentSources({
    assignment: node,
    environment,
    source: initialSource,
    target: node.left,
  })) {
    reportOrigins(projectedOrigins(source, environment), environment);
  }
};

export const evaluateCanonicalValueJsonSchemaCall = (
  node: ESTree.CallExpression,
  environment: CanonicalValueJsonSchemaSinkEnvironment,
): void => {
  if (staticallyUnreachable(node, environment)) return;
  reportOrigins(
    filterCandidateSet(
      environment.propertyState.origins({ expression: node, path: [JSON_SCHEMA_ENUM_KEY] }),
      (origin) => !opaqueCallEnumOrigin(node, origin) && callIntroducesOrigin(node, origin),
    ),
    environment,
  );
  for (const { mutation } of canonicalValueStandardPropertyMutationFacts(environment, node)) {
    if (mutation.operation !== "write") continue;
    if (!mutation.keys.candidates.includes(JSON_SCHEMA_ENUM_KEY)) continue;
    reportOrigins(mutation.valueOrigins, environment);
  }
};
