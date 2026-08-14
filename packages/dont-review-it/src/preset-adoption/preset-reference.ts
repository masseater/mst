import { isReferenceOf, type ImportedTarget } from "../lint/oxlint/lib/imported-binding.ts";
import { unwrapTransparentExpression } from "../lint/oxlint/lib/transparent-expression.ts";
import { problemAt } from "./inspection-problem.ts";
import {
  isStaticValueImportReference,
  type ValueImportBindings,
} from "./static-import-reference.ts";
import { staticPropertyAt } from "./static-object-property.ts";

import type { RepositoryProblem } from "@mst/repository-checks";
import type { ESTree } from "@oxlint/plugins";
import type { PresetAdoptionConfig } from "./config.ts";

const uninspectableEntryProblem = ({
  element,
  array,
  source,
  config,
  preset,
  valueImports,
}: {
  readonly element: ESTree.ArrayExpression["elements"][number];
  readonly array: ESTree.ArrayExpression;
  readonly source: string;
  readonly config: PresetAdoptionConfig;
  readonly preset: ImportedTarget;
  readonly valueImports: ValueImportBindings;
}): RepositoryProblem | null => {
  if (element === null) {
    return problemAt({
      source,
      start: array.start,
      config,
      message: `The root lint.${config.extendsFieldName} array must not contain an empty entry.`,
    });
  }
  if (element.type === "SpreadElement") {
    return problemAt({
      source,
      start: element.start,
      config,
      message: `The root lint.${config.extendsFieldName} array must not contain a spread because the number of preset references would be dynamic.`,
    });
  }
  const entry = unwrapTransparentExpression(element);
  if (isReferenceOf(entry, preset) || isStaticValueImportReference(entry, valueImports))
    return null;
  return problemAt({
    source,
    start: entry.start,
    config,
    message: `Every root lint.${config.extendsFieldName} entry must directly reference a statically imported value; local relays, calls, computed members, and dynamic imports are not inspectable.`,
  });
};

const presetReferenceCount = (
  elements: ESTree.ArrayExpression["elements"],
  preset: ImportedTarget,
): number =>
  elements.filter(
    (element) =>
      element !== null &&
      element.type !== "SpreadElement" &&
      isReferenceOf(unwrapTransparentExpression(element), preset),
  ).length;

const inspectExtendsArray = ({
  array,
  property,
  source,
  config,
  preset,
  valueImports,
}: {
  readonly array: ESTree.ArrayExpression;
  readonly property: ESTree.ObjectProperty;
  readonly source: string;
  readonly config: PresetAdoptionConfig;
  readonly preset: ImportedTarget;
  readonly valueImports: ValueImportBindings;
}): readonly RepositoryProblem[] => {
  const uninspectable = array.elements.flatMap((element) => {
    const problem = uninspectableEntryProblem({
      element,
      array,
      source,
      config,
      preset,
      valueImports,
    });
    return problem === null ? [] : [problem];
  });
  const count = presetReferenceCount(array.elements, preset);
  if (count === 1) return uninspectable;
  return [
    ...uninspectable,
    problemAt({
      source,
      start: property.start,
      config,
      message: `The root lint.${config.extendsFieldName} array must reference ${config.presetModuleSpecifier}'s statically imported ${config.presetExportName} value exactly once; found ${count}.`,
    }),
  ];
};

export const presetAdoptionProblems = ({
  lint,
  source,
  config,
  preset,
  valueImports,
}: {
  readonly lint: ESTree.ObjectExpression;
  readonly source: string;
  readonly config: PresetAdoptionConfig;
  readonly preset: ImportedTarget;
  readonly valueImports: ValueImportBindings;
}): readonly RepositoryProblem[] => {
  const resolved = staticPropertyAt({
    object: lint,
    key: config.extendsFieldName,
    source,
    config,
    subject: "The root lint configuration",
  });
  if (resolved.kind === "problem") return [resolved.problem];
  if (resolved.kind === "missing") {
    return [
      problemAt({
        source,
        start: lint.start,
        config,
        message: `The root lint configuration must extend ${config.presetModuleSpecifier}'s ${config.presetExportName} value exactly once through a direct static import.`,
      }),
    ];
  }
  const written = unwrapTransparentExpression(resolved.property.value);
  if (written.type !== "ArrayExpression") {
    return [
      problemAt({
        source,
        start: written.start,
        config,
        message: `The root lint.${config.extendsFieldName} value must be an array whose entries are direct static imports.`,
      }),
    ];
  }
  return inspectExtendsArray({
    array: written,
    property: resolved.property,
    source,
    config,
    preset,
    valueImports,
  });
};
