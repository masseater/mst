import { parseSync } from "oxc-parser";

import { isAstFields, NODE_TYPE_FIELD, type AstFields } from "../lint/oxlint/lib/ast-node.ts";
import { ARRAY_EXPRESSION } from "../lint/oxlint/lib/node-kinds.ts";
import { levelOfSpelling, SILENT_LEVEL } from "../lint/oxlint/lib/rule-sets/severity-levels.ts";

import type { PresetAdoptionConfig } from "./config.ts";

export type DisabledRuleDeclaration = {
  readonly ruleId: string;
  readonly line: number;
  readonly filePatterns: readonly string[];
};

const OBJECT_EXPRESSION = "ObjectExpression";

const CALL_EXPRESSION = "CallExpression";

const LITERAL = "Literal";

const IDENTIFIER = "Identifier";

const MEMBER_EXPRESSION = "MemberExpression";

const EXPORT_DEFAULT = "ExportDefaultDeclaration";

const fieldsIn = (held: unknown): readonly AstFields[] =>
  Array.isArray(held) ? held.filter(isAstFields) : [];

const nodeOfType = ({ held, type }: { readonly held: unknown; readonly type: string }) =>
  isAstFields(held) && String(held[NODE_TYPE_FIELD]) === type ? held : null;

const propertiesOf = (held: unknown): readonly AstFields[] =>
  fieldsIn(nodeOfType({ held, type: OBJECT_EXPRESSION })?.properties);

const keyNameOf = (property: AstFields): string | null => {
  const named = property.key;
  if (nodeOfType({ held: named, type: LITERAL }) !== null)
    return String((named as AstFields).value);
  const identifier = nodeOfType({ held: named, type: IDENTIFIER });
  return identifier === null || property.computed === true ? null : String(identifier.name);
};

const valueAt = ({ held, key }: { readonly held: unknown; readonly key: string }): unknown =>
  propertiesOf(held).findLast((property) => keyNameOf(property) === key)?.value ?? null;

const unwrappedCall = (held: unknown): unknown => {
  const call = nodeOfType({ held, type: CALL_EXPRESSION });
  return call === null ? held : unwrappedCall(fieldsIn(call.arguments)[0]);
};

const stringLiteralsIn = (held: unknown): readonly string[] =>
  fieldsIn(nodeOfType({ held, type: ARRAY_EXPRESSION })?.elements)
    .filter((held) => String(held[NODE_TYPE_FIELD]) === LITERAL)
    .map((held) => String(held.value));

const severitySpellingOf = (held: unknown): string | null => {
  const head = fieldsIn(nodeOfType({ held, type: ARRAY_EXPRESSION })?.elements)[0] ?? held;
  const literal = nodeOfType({ held: head, type: LITERAL });
  if (literal !== null) return String(literal.value).toLowerCase();
  const member = nodeOfType({ held: head, type: MEMBER_EXPRESSION });
  const named = nodeOfType({ held: member?.property, type: IDENTIFIER });
  return named === null || member?.computed === true ? null : String(named.name).toLowerCase();
};

const disabledEntriesIn = ({
  rules,
  source,
}: {
  readonly rules: unknown;
  readonly source: string;
}): readonly Omit<DisabledRuleDeclaration, "filePatterns">[] =>
  propertiesOf(rules).flatMap((property) => {
    const ruleId = keyNameOf(property);
    const spelled = severitySpellingOf(property.value);
    if (ruleId === null || spelled === null) return [];
    if (levelOfSpelling(spelled) !== SILENT_LEVEL) return [];
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
  const program = parseSync(config.toolchainConfigFileName, source).program;
  const exported = fieldsIn(program.body).findLast(
    (statement) => String(statement[NODE_TYPE_FIELD]) === EXPORT_DEFAULT,
  );
  const configured = unwrappedCall(exported?.declaration);
  const lint = unwrappedCall(valueAt({ held: configured, key: config.lintFieldName }));
  const everywhere = disabledEntriesIn({
    rules: valueAt({ held: lint, key: config.rulesFieldName }),
    source,
  }).map((listed) => ({ ...listed, filePatterns: [] }));

  return [...everywhere, ...overrideDeclarations({ lint, source, config })].filter((declaration) =>
    declaration.ruleId.startsWith(config.presetRulePrefix),
  );
};
