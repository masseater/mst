import { propertyKeyOf } from "../lint/oxlint/lib/object-literal.ts";
import { problemAt } from "./inspection-problem.ts";

import type { RepositoryProblem } from "@mst/repository-checks";
import type { ESTree } from "@oxlint/plugins";
import type { PresetAdoptionConfig } from "./config.ts";
import type { StaticPropertyResolution } from "./inspection-types.ts";

const dynamicPropertyIn = (objectExpression: ESTree.ObjectExpression): ESTree.Node | undefined =>
  objectExpression.properties.find(
    (property) =>
      property.type === "SpreadElement" ||
      property.computed ||
      property.kind !== "init" ||
      property.method ||
      propertyKeyOf(property) === "__proto__",
  );

const matchingProperties = ({
  object,
  key,
}: {
  readonly object: ESTree.ObjectExpression;
  readonly key: string;
}): readonly ESTree.ObjectProperty[] =>
  object.properties.filter(
    (property): property is ESTree.ObjectProperty =>
      property.type === "Property" && propertyKeyOf(property) === key,
  );

export const uninspectableObjectProblem = ({
  object,
  source,
  config,
  subject,
}: {
  readonly object: ESTree.ObjectExpression;
  readonly source: string;
  readonly config: PresetAdoptionConfig;
  readonly subject: string;
}): RepositoryProblem | null => {
  const dynamic = dynamicPropertyIn(object);
  return dynamic === undefined
    ? null
    : problemAt({
        source,
        start: dynamic.start,
        config,
        message: `${subject} must contain only static data properties, with no spread, computed property, accessor, method, or __proto__ setter, because its effective own properties must be statically inspectable.`,
      });
};

export const staticPropertyAt = ({
  object,
  key,
  source,
  config,
  subject,
}: {
  readonly object: ESTree.ObjectExpression;
  readonly key: string;
  readonly source: string;
  readonly config: PresetAdoptionConfig;
  readonly subject: string;
}): StaticPropertyResolution => {
  const uninspectable = uninspectableObjectProblem({ object, source, config, subject });
  if (uninspectable !== null) return { kind: "problem", problem: uninspectable };
  const matching = matchingProperties({ object, key });
  const [, duplicate] = matching;
  if (duplicate !== undefined) {
    return {
      kind: "problem",
      problem: problemAt({
        source,
        start: duplicate.start,
        config,
        message: `${subject} must not declare ${key} more than once because only one effective value can be inspected.`,
      }),
    };
  }
  const [property] = matching;
  return property === undefined ? { kind: "missing" } : { kind: "present", property };
};
