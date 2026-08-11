import { objectValueOf, propertyKeyOf } from "../object-literal.ts";
import { severityLevelOf } from "./severity-levels.ts";

import type { ESTree } from "@oxlint/plugins";

export type ConfiguredRule = {
  readonly property: ESTree.ObjectProperty;
  readonly ruleName: string;
  readonly level: string | null;
};

export type ConfiguredRuleBlock = {
  readonly rules: readonly ConfiguredRule[];
  readonly scope: readonly string[] | null;
  readonly declaresTypeAwareness: boolean;
};

const configuredRulesIn = (rules: ESTree.ObjectExpression): readonly ConfiguredRule[] =>
  rules.properties.flatMap<ConfiguredRule>((property) => {
    if (property.type !== "Property") return [];
    const ruleName = propertyKeyOf(property);
    if (ruleName === null) return [];
    return [{ property, ruleName, level: severityLevelOf(property.value) }];
  });

const scopeOf = (object: ESTree.ObjectExpression): readonly string[] | null => {
  const files = objectValueOf({ object, key: "files" });
  if (files === null) return null;
  if (files.type !== "ArrayExpression") return [];
  return files.elements.flatMap((element) =>
    element?.type === "Literal" && typeof element.value === "string" ? [element.value] : [],
  );
};

const spellsTypeAwareness = (node: ESTree.Node): boolean => {
  if (node.type !== "ObjectExpression") return false;
  const options = objectValueOf({ object: node, key: "options" });
  if (options?.type !== "ObjectExpression") return false;
  const declared = objectValueOf({ object: options, key: "typeAware" });
  return declared?.type === "Literal" && declared.value === true;
};

export const ruleBlockObjectOf = (
  object: ESTree.ObjectExpression,
): ESTree.ObjectExpression | null => {
  const rules = objectValueOf({ object, key: "rules" });
  return rules?.type === "ObjectExpression" ? rules : null;
};

export const configuredRuleBlockOf = ({
  object,
  rules,
  ancestors,
}: {
  readonly object: ESTree.ObjectExpression;
  readonly rules: ESTree.ObjectExpression;
  readonly ancestors: readonly ESTree.Node[];
}): ConfiguredRuleBlock => ({
  rules: configuredRulesIn(rules),
  scope: scopeOf(object),
  declaresTypeAwareness: [object, ...ancestors].some(spellsTypeAwareness),
});
