import { propertyKeyOf } from "../lint/oxlint/lib/object-literal.ts";
import { unwrapTransparentExpression } from "../lint/oxlint/lib/transparent-expression.ts";
import { lineAt, problemAt } from "./inspection-problem.ts";

import type { ESTree } from "@oxlint/plugins";
import type { PresetAdoptionConfig } from "./config.ts";
import type { RuleBlockInspection } from "./inspection-types.ts";

const DISABLED_SEVERITIES: ReadonlySet<unknown> = new Set(["off", "allow", 0]);

const ENABLED_SEVERITIES: ReadonlySet<unknown> = new Set(["warn", "error", "deny", 1, 2]);

const severityExpressionOf = (value: ESTree.Expression): ESTree.Expression | null => {
  const unwrapped = unwrapTransparentExpression(value);
  if (unwrapped.type !== "ArrayExpression") return unwrapped;
  const first = unwrapped.elements[0] ?? null;
  return first === null || first.type === "SpreadElement"
    ? null
    : unwrapTransparentExpression(first);
};

const severityOf = (value: ESTree.Expression) => {
  const severity = severityExpressionOf(value);
  if (severity?.type !== "Literal") {
    return { kind: "uninspectable" as const, node: severity ?? value };
  }
  if (DISABLED_SEVERITIES.has(severity.value)) {
    return { kind: "disabled" as const, node: severity };
  }
  return ENABLED_SEVERITIES.has(severity.value)
    ? { kind: "enabled" as const, node: severity }
    : { kind: "uninspectable" as const, node: severity };
};

const presetRuleProperties = ({
  object,
  prefix,
}: {
  readonly object: ESTree.ObjectExpression;
  readonly prefix: string;
}): readonly ESTree.ObjectProperty[] =>
  object.properties.filter(
    (property): property is ESTree.ObjectProperty =>
      property.type === "Property" && propertyKeyOf(property)?.startsWith(prefix) === true,
  );

const duplicatedRuleProperty = (
  properties: readonly ESTree.ObjectProperty[],
): ESTree.ObjectProperty | undefined =>
  properties.find(
    (property, index) =>
      properties.findIndex((candidate) => propertyKeyOf(candidate) === propertyKeyOf(property)) !==
      index,
  );

const invalidRuleObjectProblem = ({
  written,
  source,
  config,
}: {
  readonly written: ESTree.Expression;
  readonly source: string;
  readonly config: PresetAdoptionConfig;
}) =>
  problemAt({
    source,
    start: written.start,
    config,
    message: `A ${config.rulesFieldName} block that can affect ${config.presetRulePrefix} rules must be an object literal.`,
  });

const inspectStaticRuleObject = ({
  object,
  source,
  config,
}: {
  readonly object: ESTree.ObjectExpression;
  readonly source: string;
  readonly config: PresetAdoptionConfig;
}): RuleBlockInspection => {
  const dynamic = object.properties.find(
    (property) => property.type === "SpreadElement" || property.computed,
  );
  if (dynamic !== undefined) {
    return {
      disabledDeclarations: [],
      problems: [
        problemAt({
          source,
          start: dynamic.start,
          config,
          message: `A ${config.rulesFieldName} block must not contain a spread or computed rule name because disabled preset rules must be statically inspectable.`,
        }),
      ],
    };
  }
  const properties = presetRuleProperties({ object, prefix: config.presetRulePrefix });
  const duplicated = duplicatedRuleProperty(properties);
  if (duplicated !== undefined) {
    return {
      disabledDeclarations: [],
      problems: [
        problemAt({
          source,
          start: duplicated.start,
          config,
          message: `A ${config.presetRulePrefix} rule must not be declared more than once in the same ${config.rulesFieldName} block.`,
        }),
      ],
    };
  }
  const inspected = properties.map((property) => ({
    property,
    ruleId: String(propertyKeyOf(property)),
    severity: severityOf(property.value),
  }));
  return {
    disabledDeclarations: inspected.flatMap(({ property, ruleId, severity }) =>
      severity.kind === "disabled"
        ? [{ ruleId, line: lineAt({ source, start: property.start }) }]
        : [],
    ),
    problems: inspected.flatMap(({ ruleId, severity }) =>
      severity.kind === "uninspectable"
        ? [
            problemAt({
              source,
              start: severity.node.start,
              config,
              message: `The severity of ${ruleId} must be written directly as off, allow, warn, error, deny, 0, 1, or 2, optionally as the first array element.`,
            }),
          ]
        : [],
    ),
  };
};

export const inspectRuleBlock = ({
  written,
  source,
  config,
}: {
  readonly written: ESTree.Expression;
  readonly source: string;
  readonly config: PresetAdoptionConfig;
}): RuleBlockInspection => {
  const unwrapped = unwrapTransparentExpression(written);
  if (unwrapped.type !== "ObjectExpression") {
    return {
      disabledDeclarations: [],
      problems: [invalidRuleObjectProblem({ written, source, config })],
    };
  }
  return inspectStaticRuleObject({ object: unwrapped, source, config });
};
