import { describe, expect, test } from "vite-plus/test";

import { DECLARED_RULE_SETS, memberNamedBy, type RuleSet } from "./declared-rule-sets.ts";

const setNamed = (name: string): RuleSet => {
  const found = DECLARED_RULE_SETS.find((declared) => declared.name === name);
  if (found === undefined) throw new Error(`no rule set named ${name}`);
  return found;
};

describe("declared-rule-sets", () => {
  test("the single-assignment set carries the eight rules that share the invariant", () => {
    expect(setNamed("single-assignment").members.map((member) => member.rule)).toStrictEqual([
      "no-reassign--use-spread-or-iife",
      "no-array-mutation--derive-new-array",
      "no-receiver-mutation--derive-new-value",
      "no-class-as-mutable-cell--decide-in-an-iife",
      "no-promise-chain--use-async-await",
      "no-floating-promise--await-the-result",
      "no-blanket-suppression--name-and-record",
      "no-partial-rule-set--enable-the-whole-set",
    ]);
  });

  test("the failure-routing set carries the chain rule together with the clause it feeds", () => {
    expect(setNamed("failure-routing").members.map((member) => member.rule)).toStrictEqual([
      "no-promise-chain--use-async-await",
      "no-empty-catch--throw-or-handle",
      "no-silent-catch--rethrow-or-handle",
      "no-floating-promise--await-the-result",
    ]);
  });

  test("the members that read type information are the ones a typeless run cannot host", () => {
    expect(
      setNamed("single-assignment")
        .members.filter((member) => member.readsTypeInformation)
        .map((member) => member.rule),
    ).toStrictEqual([
      "no-array-mutation--derive-new-array",
      "no-receiver-mutation--derive-new-value",
      "no-class-as-mutable-cell--decide-in-an-iife",
      "no-promise-chain--use-async-await",
      "no-floating-promise--await-the-result",
    ]);
  });

  test("every member states the hole its absence opens", () => {
    expect(
      DECLARED_RULE_SETS.flatMap((declared) => declared.members).filter(
        (member) => member.hole === "",
      ),
    ).toStrictEqual([]);
  });

  test("a rule of the set is found through the name a configuration spells", () => {
    const set = setNamed("single-assignment");
    expect(memberNamedBy({ set, ruleName: "no-reassign--use-spread-or-iife" })?.rule).toBe(
      "no-reassign--use-spread-or-iife",
    );
    expect(
      memberNamedBy({ set, ruleName: "dont-review-it/no-array-mutation--derive-new-array" })?.rule,
    ).toBe("no-array-mutation--derive-new-array");
    expect(memberNamedBy({ set, ruleName: "no-console" })).toBeNull();
  });
});
