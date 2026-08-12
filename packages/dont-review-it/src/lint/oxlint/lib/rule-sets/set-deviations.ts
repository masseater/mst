import { bareRuleNameOf } from "../lint-suppression/suppression-directives.ts";
import {
  DECLARED_RULE_SETS,
  memberNamedBy,
  type RuleSet,
  type RuleSetMember,
} from "./declared-rule-sets.ts";
import { rankOfLevel, SILENT_LEVEL, strongestLevelAmong } from "./severity-levels.ts";

import type { ESTree } from "@oxlint/plugins";
import type { ConfiguredRule, ConfiguredRuleBlock } from "./configured-rule-blocks.ts";

export const PARTIAL_RULE_SET_MESSAGE_ID = "partialRuleSet";

export const SCOPED_PARTIAL_RULE_SET_MESSAGE_ID = "scopedPartialRuleSet";

export const UNEVEN_SEVERITY_MESSAGE_ID = "unevenRuleSetSeverity";

export const UNREADABLE_SEVERITY_MESSAGE_ID = "unreadableRuleSetSeverity";

export const TYPELESS_RULE_SET_HOST_MESSAGE_ID = "typelessRuleSetHost";

export type SetDeviation = {
  readonly property: ESTree.ObjectProperty;
  readonly messageId: string;
  readonly data: Readonly<Record<string, string>>;
};

type NamedRule = {
  readonly configured: ConfiguredRule;
  readonly member: RuleSetMember;
};

type HeldRule = NamedRule & { readonly level: string };

type SetReading = {
  readonly set: RuleSet;
  readonly block: ConfiguredRuleBlock;
  readonly named: readonly NamedRule[];
  readonly first: NamedRule;
};

const namedRulesIn = ({
  set,
  block,
}: {
  readonly set: RuleSet;
  readonly block: ConfiguredRuleBlock;
}): readonly NamedRule[] =>
  block.rules.flatMap<NamedRule>((configured) => {
    const member = memberNamedBy({ set, ruleName: configured.ruleName });
    return member === null ? [] : [{ configured, member }];
  });

const scopeTextOf = (scope: readonly string[]): string =>
  scope.length === 0 ? "the paths it names" : scope.join(", ");

const partialDeviationsOf = (reading: SetReading): readonly SetDeviation[] => {
  const missing = reading.set.members.filter(
    (member) =>
      !reading.named.some(
        (named) => bareRuleNameOf(named.configured.ruleName) === bareRuleNameOf(member.rule),
      ),
  );
  if (missing.length === 0) return [];
  const { scope } = reading.block;
  const carried = {
    ruleSet: reading.set.name,
    namedRule: reading.first.configured.ruleName,
    missingRules: missing.map((member) => member.rule).join(", "),
    holes: missing.map((member) => member.hole).join("; "),
    scope: scope === null ? "" : scopeTextOf(scope),
  };
  const messageId =
    scope === null ? PARTIAL_RULE_SET_MESSAGE_ID : SCOPED_PARTIAL_RULE_SET_MESSAGE_ID;
  return [{ property: reading.first.configured.property, messageId, data: carried }];
};

const unreadableDeviationsOf = (reading: SetReading): readonly SetDeviation[] =>
  reading.named
    .filter((named) => named.configured.level === null)
    .map((named) => ({
      property: named.configured.property,
      messageId: UNREADABLE_SEVERITY_MESSAGE_ID,
      data: { ruleSet: reading.set.name, ruleName: named.configured.ruleName },
    }));

const heldRulesIn = (named: readonly NamedRule[]): readonly HeldRule[] =>
  named.flatMap<HeldRule>((listed) => {
    const { level } = listed.configured;
    return level === null ? [] : [{ configured: listed.configured, member: listed.member, level }];
  });

const unevenDeviationsOf = (reading: SetReading): readonly SetDeviation[] => {
  const held = heldRulesIn(reading.named);
  const strongest = strongestLevelAmong(held.map((listed) => listed.level));
  const strongestRule = held.find((listed) => listed.level === strongest);
  if (strongestRule === undefined) return [];
  return held
    .filter((listed) => rankOfLevel(listed.level) < rankOfLevel(strongest))
    .map((listed) => ({
      property: listed.configured.property,
      messageId: UNEVEN_SEVERITY_MESSAGE_ID,
      data: {
        ruleSet: reading.set.name,
        ruleName: listed.configured.ruleName,
        severity: listed.level,
        matchedRule: strongestRule.configured.ruleName,
        matchedSeverity: strongest,
        hole: listed.member.hole,
      },
    }));
};

const typelessDeviationsOf = (reading: SetReading): readonly SetDeviation[] => {
  if (reading.block.declaresTypeAwareness) return [];
  return reading.named
    .filter((named) => named.member.readsTypeInformation)
    .filter((named) => named.configured.level !== null && named.configured.level !== SILENT_LEVEL)
    .map((named) => ({
      property: named.configured.property,
      messageId: TYPELESS_RULE_SET_HOST_MESSAGE_ID,
      data: {
        ruleSet: reading.set.name,
        ruleName: named.configured.ruleName,
        hole: named.member.hole,
      },
    }));
};

const deviationsForSet = (reading: SetReading): readonly SetDeviation[] => [
  ...partialDeviationsOf(reading),
  ...unreadableDeviationsOf(reading),
  ...unevenDeviationsOf(reading),
  ...typelessDeviationsOf(reading),
];

export const setDeviationsIn = (block: ConfiguredRuleBlock): readonly SetDeviation[] =>
  DECLARED_RULE_SETS.flatMap((listedSet) => {
    const named = namedRulesIn({ set: listedSet, block });
    const [first] = named;
    return first === undefined ? [] : deviationsForSet({ set: listedSet, block, named, first });
  });
