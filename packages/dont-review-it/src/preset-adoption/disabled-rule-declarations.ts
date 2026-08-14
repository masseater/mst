import { LINT_SEVERITY } from "@mst/lint-rule-authoring";
import { parseSync } from "oxc-parser";

import { NODE_TYPE_FIELD } from "../lint/oxlint/lib/ast-node.ts";
import {
  defaultExportedValue,
  fieldsIn,
  keyNameOf,
  LITERAL,
  nodeOfType,
  propertiesOf,
  unwrappedCall,
  valueAt,
} from "../lint/oxlint/lib/config-object.ts";
import { ARRAY_EXPRESSION } from "../lint/oxlint/lib/node-kinds.ts";

import type { PresetAdoptionConfig } from "./config.ts";

export type DisabledRuleDeclaration = {
  readonly ruleId: string;
  readonly line: number;
  readonly filePatterns: readonly string[];
};

const stringLiteralsIn = (held: unknown): readonly string[] =>
  fieldsIn(nodeOfType({ held, type: ARRAY_EXPRESSION })?.elements)
    .filter((held) => String(held[NODE_TYPE_FIELD]) === LITERAL)
    .map((held) => String(held.value));

const disabledEntriesIn = ({
  rules,
  source,
}: {
  readonly rules: unknown;
  readonly source: string;
}): readonly Omit<DisabledRuleDeclaration, "filePatterns">[] =>
  propertiesOf(rules).flatMap((property) => {
    const ruleId = keyNameOf(property);
    const severity = nodeOfType({ held: property.value, type: LITERAL });
    if (ruleId === null || severity === null) return [];
    if (String(severity.value) !== LINT_SEVERITY.OFF) return [];
    return [{ ruleId, line: source.slice(0, Number(property.start)).split("\n").length }];
  });

const overrideDeclarations = ({
  lint,
  source,
  config,
}: {
  readonly lint: unknown;
  readonly source: string;
  readonly config: PresetAdoptionConfig;
}): readonly DisabledRuleDeclaration[] =>
  fieldsIn(
    nodeOfType({
      held: valueAt({ held: lint, key: config.overridesFieldName }),
      type: ARRAY_EXPRESSION,
    })?.elements,
  ).flatMap((override) => {
    const filePatterns = stringLiteralsIn(valueAt({ held: override, key: config.filesFieldName }));
    const rules = valueAt({ held: override, key: config.rulesFieldName });
    return disabledEntriesIn({ rules, source }).map((listed) => ({ ...listed, filePatterns }));
  });

export const disabledRuleDeclarationsIn = ({
  source,
  config,
}: {
  readonly source: string;
  readonly config: PresetAdoptionConfig;
}): readonly DisabledRuleDeclaration[] => {
  const configured = defaultExportedValue(
    parseSync(config.toolchainConfigFileName, source).program,
  );
  const lint = unwrappedCall(valueAt({ held: configured, key: config.lintFieldName }));
  const everywhere = disabledEntriesIn({
    rules: valueAt({ held: lint, key: config.rulesFieldName }),
    source,
  }).map((listed) => ({ ...listed, filePatterns: [] }));

  return [...everywhere, ...overrideDeclarations({ lint, source, config })].filter((declaration) =>
    declaration.ruleId.startsWith(config.presetRulePrefix),
  );
};
