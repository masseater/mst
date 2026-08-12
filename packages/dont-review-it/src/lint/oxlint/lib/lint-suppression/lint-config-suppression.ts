import {
  defaultExportedObject,
  objectExpressionOf,
  type ProgramStatements,
} from "../default-exported-object.ts";
import { objectValueOf, propertyKeyOf } from "../object-literal.ts";
import { spelledSeverityOf } from "../spelled-lint-severity.ts";
import { bareRuleNameOf } from "./suppression-directives.ts";

import type { ESTree } from "@oxlint/plugins";

export const LINT_CONFIGURATION_FILE = /(?:^|\/)vite\.config\.[cm]?[jt]s$/u;

const FAILING_SPELLINGS: ReadonlySet<string> = new Set(["error", "deny"]);

const PASSING_SPELLINGS: ReadonlySet<string> = new Set(["off", "allow", "warn"]);

const LOWEST_FAILING_NUMBER = 2;

export type WeakenedRule = {
  readonly property: ESTree.ObjectProperty;
  readonly ruleName: string;
  readonly severity: string;
};

export type IgnoreEntry = {
  readonly element: ESTree.Expression;
  readonly pattern: string;
};

export const lintBlockOf = (program: ProgramStatements): ESTree.ObjectExpression | null => {
  const config = defaultExportedObject(program);
  if (config === null) return null;
  const lint = objectValueOf({ object: config, key: "lint" });
  return lint === null ? null : objectExpressionOf(lint);
};

const weakenedSeverityOf = (held: ESTree.Expression): string | null => {
  const spelled = spelledSeverityOf(held);
  if (spelled === null) return null;
  if (FAILING_SPELLINGS.has(spelled)) return null;
  if (PASSING_SPELLINGS.has(spelled)) return spelled;
  const numbered = Number(spelled);
  if (Number.isNaN(numbered)) return null;
  return numbered >= LOWEST_FAILING_NUMBER ? null : spelled;
};

const weakenedRulesIn = ({
  rules,
  targetRules,
}: {
  readonly rules: ESTree.ObjectExpression;
  readonly targetRules: readonly string[];
}): readonly WeakenedRule[] => {
  const targeted = new Set(targetRules.map(bareRuleNameOf));
  return rules.properties.flatMap<WeakenedRule>((property) => {
    if (property.type !== "Property") return [];
    const named = propertyKeyOf(property);
    if (named === null) return [];
    if (!targeted.has(bareRuleNameOf(named))) return [];
    const severity = weakenedSeverityOf(property.value);
    return severity === null ? [] : [{ property, ruleName: named, severity }];
  });
};

export const ruleBlocksIn = (lint: ESTree.ObjectExpression): readonly ESTree.ObjectExpression[] => {
  const own = objectValueOf({ object: lint, key: "rules" });
  const overrides = objectValueOf({ object: lint, key: "overrides" });
  const overridden =
    overrides?.type === "ArrayExpression"
      ? overrides.elements.flatMap((held) =>
          held?.type === "ObjectExpression" ? [objectValueOf({ object: held, key: "rules" })] : [],
        )
      : [];
  return [own, ...overridden].filter(
    (block): block is ESTree.ObjectExpression => block?.type === "ObjectExpression",
  );
};

export const weakenedTargetRulesIn = ({
  lint,
  targetRules,
}: {
  readonly lint: ESTree.ObjectExpression;
  readonly targetRules: readonly string[];
}): readonly WeakenedRule[] =>
  ruleBlocksIn(lint).flatMap((rules) => weakenedRulesIn({ rules, targetRules }));

export const ignoreEntriesIn = (lint: ESTree.ObjectExpression): readonly IgnoreEntry[] => {
  const patterns = objectValueOf({ object: lint, key: "ignorePatterns" });
  if (patterns?.type !== "ArrayExpression") return [];
  return patterns.elements.flatMap<IgnoreEntry>((held) =>
    held?.type === "Literal" && typeof held.value === "string"
      ? [{ element: held, pattern: held.value }]
      : [],
  );
};
