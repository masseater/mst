import { LINT_SEVERITY } from "@mst/lint-rule-authoring";

import { isReferenceTo, type ImportedTarget } from "../lint/oxlint/lib/imported-binding.ts";
import { propertyKeyOf } from "../lint/oxlint/lib/object-literal.ts";
import { severityLevelOf, SILENT_LEVEL } from "../lint/oxlint/lib/rule-sets/severity-levels.ts";
import { staticMemberOf } from "../lint/oxlint/lib/static-member.ts";
import { unwrapTransparentExpression } from "../lint/oxlint/lib/transparent-expression.ts";
import { lineAt, problemAt } from "./inspection-problem.ts";

import type { ESTree } from "@oxlint/plugins";
import type { PresetAdoptionConfig } from "./config.ts";
import type { RuleBlockInspection } from "./inspection-types.ts";

const severityExpressionOf = (writtenSeverity: ESTree.Expression): ESTree.Expression | null => {
  const unwrapped = unwrapTransparentExpression(writtenSeverity);
  if (unwrapped.type !== "ArrayExpression") return unwrapped;
  const first = unwrapped.elements[0] ?? null;
  return first === null || first.type === "SpreadElement"
    ? null
    : unwrapTransparentExpression(first);
};

const provenSeverityLevel = ({
  severity,
  severityConstant,
}: {
  readonly severity: ESTree.Expression;
  readonly severityConstant: ImportedTarget;
}): string | null => {
  if (
    severity.type === "Literal" &&
    (typeof severity.value === "string" || typeof severity.value === "number")
  ) {
    return severityLevelOf(severity);
  }
  const member = staticMemberOf(severity);
  return member !== null && isReferenceTo(member.object, severityConstant)
    ? severityLevelOf(severity)
    : null;
};

const severityOf = ({
  writtenSeverity,
  severityConstant,
}: {
  readonly writtenSeverity: ESTree.Expression;
  readonly severityConstant: ImportedTarget;
}) => {
  const severity = severityExpressionOf(writtenSeverity);
  if (severity === null) {
    return { kind: "uninspectable" as const, node: writtenSeverity };
  }
  const level = provenSeverityLevel({ severity, severityConstant });
  if (level === null) {
    return { kind: "uninspectable" as const, node: severity };
  }
  return level === SILENT_LEVEL
    ? { kind: "disabled" as const, node: severity }
    : level === LINT_SEVERITY.WARN
      ? { kind: "warning" as const, node: severity }
      : { kind: "enabled" as const, node: severity };
};

const presetRuleProperties = ({
  object,
  ruleIds,
}: {
  readonly object: ESTree.ObjectExpression;
  readonly ruleIds: readonly string[];
}): readonly ESTree.ObjectProperty[] =>
  object.properties.filter(
    (property): property is ESTree.ObjectProperty =>
      property.type === "Property" && ruleIds.includes(String(propertyKeyOf(property))),
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
    message: `A ${config.rulesFieldName} block that can affect preset-owned rules must be an object literal.`,
  });

const inspectStaticRuleObject = ({
  object,
  source,
  config,
  severityConstant,
}: {
  readonly object: ESTree.ObjectExpression;
  readonly source: string;
  readonly config: PresetAdoptionConfig;
  readonly severityConstant: ImportedTarget;
}): RuleBlockInspection => {
  const dynamic = object.properties.find(
    (property) =>
      property.type === "SpreadElement" ||
      property.computed ||
      property.kind !== "init" ||
      property.method ||
      propertyKeyOf(property) === "__proto__",
  );
  if (dynamic !== undefined) {
    return {
      disabledDeclarations: [],
      problems: [
        problemAt({
          source,
          start: dynamic.start,
          config,
          message: `A ${config.rulesFieldName} block must contain only static data properties, with no spread, computed rule name, accessor, method, or __proto__ setter, because preset-owned rules must be statically inspectable.`,
        }),
      ],
    };
  }
  const properties = presetRuleProperties({ object, ruleIds: config.presetOwnedRuleIds });
  const duplicated = duplicatedRuleProperty(properties);
  if (duplicated !== undefined) {
    return {
      disabledDeclarations: [],
      problems: [
        problemAt({
          source,
          start: duplicated.start,
          config,
          message: `A preset-owned rule must not be declared more than once in the same ${config.rulesFieldName} block.`,
        }),
      ],
    };
  }
  const inspected = properties.map((property) => ({
    property,
    ruleId: String(propertyKeyOf(property)),
    severity: severityOf({ writtenSeverity: property.value, severityConstant }),
  }));
  return {
    disabledDeclarations: inspected.flatMap(({ property, ruleId, severity }) =>
      severity.kind === "disabled"
        ? [{ ruleId, line: lineAt({ source, start: property.start }) }]
        : [],
    ),
    problems: inspected.flatMap(({ ruleId, severity }) => {
      if (severity.kind === "warning") {
        return [
          problemAt({
            source,
            start: severity.node.start,
            config,
            message: `The severity of ${ruleId} must fail the lint run. Raise warn or 1 to error, deny, 2, or a statically imported ${config.severityExportName}.ERROR, optionally as the first array element.`,
          }),
        ];
      }
      if (severity.kind === "enabled") {
        return [
          problemAt({
            source,
            start: severity.node.start,
            config,
            message: `${ruleId} is owned by dontReviewItPreset and must not be redeclared with caller severity or options. Delete the declaration and use the preset setting.`,
          }),
        ];
      }
      return severity.kind === "uninspectable"
        ? [
            problemAt({
              source,
              start: severity.node.start,
              config,
              message: `The severity of ${ruleId} must be statically provable as error, deny, 2, or a statically imported ${config.severityExportName}.ERROR, optionally as the first array element.`,
            }),
          ]
        : [];
    }),
  };
};

export const inspectRuleBlock = ({
  written,
  source,
  config,
  severityConstant,
}: {
  readonly written: ESTree.Expression;
  readonly source: string;
  readonly config: PresetAdoptionConfig;
  readonly severityConstant: ImportedTarget;
}): RuleBlockInspection => {
  const unwrapped = unwrapTransparentExpression(written);
  if (unwrapped.type !== "ObjectExpression") {
    return {
      disabledDeclarations: [],
      problems: [invalidRuleObjectProblem({ written, source, config })],
    };
  }
  return inspectStaticRuleObject({ object: unwrapped, source, config, severityConstant });
};
