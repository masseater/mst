import { unwrapTransparentExpression } from "../lint/oxlint/lib/transparent-expression.ts";
import { inspectRuleBlock } from "./disabled-rule-declarations.ts";
import { problemAt } from "./inspection-problem.ts";
import { staticPropertyAt } from "./static-object-property.ts";

import type { RepositoryProblem } from "@mst/repository-checks";
import type { ESTree } from "@oxlint/plugins";
import type { ImportedTarget } from "../lint/oxlint/lib/imported-binding.ts";
import type { PresetAdoptionConfig } from "./config.ts";
import type { PresetAdoptionInspection } from "./inspection-types.ts";

const missingPatterns = ({
  object,
  key,
  required,
  source,
  config,
}: {
  readonly object: ESTree.ObjectExpression;
  readonly key: string;
  readonly required: boolean;
  readonly source: string;
  readonly config: PresetAdoptionConfig;
}): { readonly patterns: readonly string[]; readonly problems: readonly RepositoryProblem[] } =>
  required
    ? {
        patterns: [],
        problems: [
          problemAt({
            source,
            start: object.start,
            config,
            message: `An override containing a disabled preset rule must declare ${key} as a literal array so its reach is inspectable.`,
          }),
        ],
      }
    : { patterns: [], problems: [] };

const literalPatternsIn = ({
  written,
  key,
  source,
  config,
}: {
  readonly written: ESTree.Expression;
  readonly key: string;
  readonly source: string;
  readonly config: PresetAdoptionConfig;
}): { readonly patterns: readonly string[]; readonly problems: readonly RepositoryProblem[] } => {
  const unwrapped = unwrapTransparentExpression(written);
  if (unwrapped.type !== "ArrayExpression") {
    return {
      patterns: [],
      problems: [
        problemAt({
          source,
          start: unwrapped.start,
          config,
          message: `An override containing a disabled preset rule must declare ${key} as a literal array so its reach is inspectable.`,
        }),
      ],
    };
  }
  return unwrapped.elements.reduce<{
    readonly patterns: readonly string[];
    readonly problems: readonly RepositoryProblem[];
  }>(
    (inspection, patternEntry) => {
      if (inspection.problems.length > 0) return inspection;
      if (patternEntry?.type === "Literal" && typeof patternEntry.value === "string") {
        return { patterns: [...inspection.patterns, patternEntry.value], problems: [] };
      }
      return {
        patterns: [],
        problems: [
          problemAt({
            source,
            start: patternEntry?.start ?? unwrapped.start,
            config,
            message: `Every ${key} entry on an override containing a disabled preset rule must be a string literal.`,
          }),
        ],
      };
    },
    { patterns: [], problems: [] },
  );
};

const staticPatternsAt = ({
  object,
  key,
  required,
  source,
  config,
}: {
  readonly object: ESTree.ObjectExpression;
  readonly key: string;
  readonly required: boolean;
  readonly source: string;
  readonly config: PresetAdoptionConfig;
}): { readonly patterns: readonly string[]; readonly problems: readonly RepositoryProblem[] } => {
  const resolved = staticPropertyAt({
    object,
    key,
    source,
    config,
    subject: "An override containing a disabled preset rule",
  });
  if (resolved.kind === "problem") return { patterns: [], problems: [resolved.problem] };
  if (resolved.kind === "missing") {
    return missingPatterns({ object, key, required, source, config });
  }
  return literalPatternsIn({ written: resolved.property.value, key, source, config });
};

const inspectOverrideObject = ({
  override,
  source,
  config,
  severityConstant,
}: {
  readonly override: ESTree.ObjectExpression;
  readonly source: string;
  readonly config: PresetAdoptionConfig;
  readonly severityConstant: ImportedTarget;
}): PresetAdoptionInspection => {
  const rules = staticPropertyAt({
    object: override,
    key: config.rulesFieldName,
    source,
    config,
    subject: "A lint override",
  });
  if (rules.kind === "missing") return { disabledDeclarations: [], problems: [] };
  if (rules.kind === "problem") return { disabledDeclarations: [], problems: [rules.problem] };
  const inspectedRules = inspectRuleBlock({
    written: rules.property.value,
    source,
    config,
    severityConstant,
  });
  if (inspectedRules.disabledDeclarations.length === 0) {
    return { disabledDeclarations: [], problems: inspectedRules.problems };
  }
  const files = staticPatternsAt({
    object: override,
    key: config.filesFieldName,
    required: true,
    source,
    config,
  });
  const excludeFiles = staticPatternsAt({
    object: override,
    key: config.excludeFilesFieldName,
    required: false,
    source,
    config,
  });
  const problems = [...inspectedRules.problems, ...files.problems, ...excludeFiles.problems];
  return {
    disabledDeclarations: inspectedRules.disabledDeclarations.map((declaration) => ({
      ...declaration,
      filePatterns: files.patterns,
      excludeFilePatterns: excludeFiles.patterns,
      pathReachInspectable: files.problems.length === 0 && excludeFiles.problems.length === 0,
    })),
    problems,
  };
};

const invalidOverride = ({
  start,
  source,
  config,
  message,
}: {
  readonly start: number;
  readonly source: string;
  readonly config: PresetAdoptionConfig;
  readonly message: string;
}): PresetAdoptionInspection => ({
  disabledDeclarations: [],
  problems: [problemAt({ source, start, config, message })],
});

const inspectOverrideElement = ({
  element,
  array,
  source,
  config,
  severityConstant,
}: {
  readonly element: ESTree.ArrayExpression["elements"][number];
  readonly array: ESTree.ArrayExpression;
  readonly source: string;
  readonly config: PresetAdoptionConfig;
  readonly severityConstant: ImportedTarget;
}): PresetAdoptionInspection => {
  if (element === null || element.type === "SpreadElement") {
    return invalidOverride({
      start: element?.start ?? array.start,
      source,
      config,
      message: `The root lint.${config.overridesFieldName} array must contain only object literals and must not contain spreads.`,
    });
  }
  const override = unwrapTransparentExpression(element);
  return override.type === "ObjectExpression"
    ? inspectOverrideObject({ override, source, config, severityConstant })
    : invalidOverride({
        start: override.start,
        source,
        config,
        message: `Every root lint.${config.overridesFieldName} entry must be an object literal.`,
      });
};

const mergeInspections = (
  inspections: readonly PresetAdoptionInspection[],
): PresetAdoptionInspection => ({
  disabledDeclarations: inspections.flatMap((inspection) => inspection.disabledDeclarations),
  problems: inspections.flatMap((inspection) => inspection.problems),
});

export const inspectOverrides = ({
  written,
  source,
  config,
  severityConstant,
}: {
  readonly written: ESTree.Expression;
  readonly source: string;
  readonly config: PresetAdoptionConfig;
  readonly severityConstant: ImportedTarget;
}): PresetAdoptionInspection => {
  const unwrapped = unwrapTransparentExpression(written);
  if (unwrapped.type !== "ArrayExpression") {
    return invalidOverride({
      start: written.start,
      source,
      config,
      message: `The root lint.${config.overridesFieldName} value must be a literal array so disabled preset rules cannot hide in dynamic configuration.`,
    });
  }
  return mergeInspections(
    unwrapped.elements.map((overrideEntry) =>
      inspectOverrideElement({
        element: overrideEntry,
        array: unwrapped,
        source,
        config,
        severityConstant,
      }),
    ),
  );
};
