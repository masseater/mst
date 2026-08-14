import { objectValueOf, propertyKeyOf } from "../object-literal.ts";
import { severityLevelOf } from "./severity-levels.ts";

import type { ESTree } from "@oxlint/plugins";

export const ruleBlockObjectOf = (
  holder: ESTree.ObjectExpression,
): ESTree.ObjectExpression | null => {
  const rules = objectValueOf({ object: holder, key: "rules" });
  return rules?.type === "ObjectExpression" ? rules : null;
};

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

const scopeOf = (holder: ESTree.ObjectExpression): readonly string[] | null => {
  const files = objectValueOf({ object: holder, key: "files" });
  if (files === null) return null;
  if (files.type !== "ArrayExpression") return [];
  return files.elements.flatMap((held) =>
    held?.type === "Literal" && typeof held.value === "string" ? [held.value] : [],
  );
};

const spellsTypeAwareness = (node: ESTree.Node): boolean => {
  if (node.type !== "ObjectExpression") return false;
  const ruleOptions = objectValueOf({ object: node, key: "options" });
  if (ruleOptions?.type !== "ObjectExpression") return false;
  const declared = objectValueOf({ object: ruleOptions, key: "typeAware" });
  return declared?.type === "Literal" && declared.value === true;
};

export const configuredRuleBlockOf = ({
  object: holder,
  rules,
  ancestors,
}: {
  readonly object: ESTree.ObjectExpression;
  readonly rules: ESTree.ObjectExpression;
  readonly ancestors: readonly ESTree.Node[];
}): ConfiguredRuleBlock => ({
  rules: configuredRulesIn(rules),
  scope: scopeOf(holder),
  declaresTypeAwareness: [holder, ...ancestors].some(spellsTypeAwareness),
});
