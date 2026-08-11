import { bareRuleNameOf } from "../lint-suppression/suppression-directives.ts";

export type RuleSetMember = {
  readonly rule: string;
  readonly readsTypeInformation: boolean;
  readonly hole: string;
};

export type RuleSet = {
  readonly name: string;
  readonly members: readonly RuleSetMember[];
};

const NO_PROMISE_CHAIN: RuleSetMember = {
  rule: "no-promise-chain--use-async-await",
  readsTypeInformation: true,
  hole: "failure handling spread over chained handlers stays out of every catch clause",
};

const NO_FLOATING_PROMISE: RuleSetMember = {
  rule: "no-floating-promise--await-the-result",
  readsTypeInformation: true,
  hole: "a promise nothing waits for drops its failure on the floor",
};

const SINGLE_ASSIGNMENT_MEMBERS: readonly RuleSetMember[] = [
  {
    rule: "no-reassign--use-spread-or-iife",
    readsTypeInformation: false,
    hole: "a rebindable declaration and every assignment shaped write pass",
  },
  {
    rule: "no-array-mutation--derive-new-array",
    readsTypeInformation: true,
    hole: "a mutating method call on an array passes whole",
  },
  {
    rule: "no-receiver-mutation--derive-new-value",
    readsTypeInformation: true,
    hole: "a mutating method call on a map, a set, a date, or a hand written class passes whole",
  },
  {
    rule: "no-class-as-mutable-cell--decide-in-an-iife",
    readsTypeInformation: true,
    hole: "local mutable state wrapped in a class passes",
  },
  NO_PROMISE_CHAIN,
  NO_FLOATING_PROMISE,
  {
    rule: "no-blanket-suppression--name-and-record",
    readsTypeInformation: false,
    hole: "a directive naming no rule silences every rule of this set at once",
  },
  {
    rule: "no-partial-rule-set--enable-the-whole-set",
    readsTypeInformation: false,
    hole: "a configuration holding part of a set passes",
  },
];

const FAILURE_ROUTING_MEMBERS: readonly RuleSetMember[] = [
  NO_PROMISE_CHAIN,
  {
    rule: "no-empty-catch--throw-or-handle",
    readsTypeInformation: false,
    hole: "a catch clause carrying no statement passes",
  },
  {
    rule: "no-silent-catch--rethrow-or-handle",
    readsTypeInformation: false,
    hole: "a catch clause that records the failure nowhere passes",
  },
  NO_FLOATING_PROMISE,
];

export const DECLARED_RULE_SETS: readonly RuleSet[] = [
  { name: "single-assignment", members: SINGLE_ASSIGNMENT_MEMBERS },
  { name: "failure-routing", members: FAILURE_ROUTING_MEMBERS },
];

export const memberNamedBy = ({
  set,
  ruleName,
}: {
  readonly set: RuleSet;
  readonly ruleName: string;
}): RuleSetMember | null =>
  set.members.find((member) => bareRuleNameOf(member.rule) === bareRuleNameOf(ruleName)) ?? null;
