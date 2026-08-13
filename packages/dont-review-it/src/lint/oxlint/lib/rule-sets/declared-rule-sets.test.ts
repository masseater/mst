import { describe, expect, test } from "vite-plus/test";

import { DECLARED_RULE_SETS, memberNamedBy } from "./declared-rule-sets.ts";

const SINGLE_ASSIGNMENT = "single-assignment";

const FAILURE_ROUTING = "failure-routing";

describe("DECLARED_RULE_SETS", () => {
  describe("the single-assignment set", () => {
    const it = test.extend("rulesOfTheSet", () =>
      DECLARED_RULE_SETS.filter((declared) => declared.name === SINGLE_ASSIGNMENT).flatMap(
        (declared) => declared.members.map((member) => member.rule),
      ));

    it("carries the eight rules that share the invariant", ({ rulesOfTheSet }) => {
      expect(rulesOfTheSet).toStrictEqual([
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
  });

  describe("the failure-routing set", () => {
    const it = test.extend("rulesOfTheSet", () =>
      DECLARED_RULE_SETS.filter((declared) => declared.name === FAILURE_ROUTING).flatMap(
        (declared) => declared.members.map((member) => member.rule),
      ));

    it("carries the chain rule together with the clause it feeds", ({ rulesOfTheSet }) => {
      expect(rulesOfTheSet).toStrictEqual([
        "no-promise-chain--use-async-await",
        "no-empty-catch--throw-or-handle",
        "no-silent-catch--rethrow-or-handle",
        "no-floating-promise--await-the-result",
      ]);
    });
  });

  describe("the members of the single-assignment set that read type information", () => {
    const it = test.extend("typeReadingRulesOfTheSet", () =>
      DECLARED_RULE_SETS.filter((declared) => declared.name === SINGLE_ASSIGNMENT).flatMap(
        (declared) =>
          declared.members
            .filter((member) => member.readsTypeInformation)
            .map((member) => member.rule),
      ));

    it("are the ones a typeless run cannot host", ({ typeReadingRulesOfTheSet }) => {
      expect(typeReadingRulesOfTheSet).toStrictEqual([
        "no-array-mutation--derive-new-array",
        "no-receiver-mutation--derive-new-value",
        "no-class-as-mutable-cell--decide-in-an-iife",
        "no-promise-chain--use-async-await",
        "no-floating-promise--await-the-result",
      ]);
    });
  });

  describe("the members of every declared set", () => {
    const it = test.extend("membersStatingNoHole", () =>
      DECLARED_RULE_SETS.flatMap((declared) => declared.members).filter(
        (member) => member.hole === "",
      ));

    it("each state the hole their absence opens", ({ membersStatingNoHole }) => {
      expect(membersStatingNoHole).toStrictEqual([]);
    });
  });
});

describe("memberNamedBy", () => {
  describe("the bare name a configuration spells", () => {
    const it = test.extend("membersNamed", () =>
      DECLARED_RULE_SETS.filter((declared) => declared.name === SINGLE_ASSIGNMENT).flatMap(
        (singleAssignmentSet) =>
          memberNamedBy({
            set: singleAssignmentSet,
            ruleName: "no-reassign--use-spread-or-iife",
          }) ?? [],
      ));

    it("finds the rule of the set that carries it", ({ membersNamed }) => {
      expect(membersNamed).toStrictEqual([
        {
          rule: "no-reassign--use-spread-or-iife",
          readsTypeInformation: false,
          hole: "a rebindable declaration and every assignment shaped write pass",
        },
      ]);
    });
  });

  describe("the name a configuration qualifies with its plugin", () => {
    const it = test.extend("membersNamed", () =>
      DECLARED_RULE_SETS.filter((declared) => declared.name === SINGLE_ASSIGNMENT).flatMap(
        (singleAssignmentSet) =>
          memberNamedBy({
            set: singleAssignmentSet,
            ruleName: "dont-review-it/no-array-mutation--derive-new-array",
          }) ?? [],
      ));

    it("finds the same rule the bare name reaches", ({ membersNamed }) => {
      expect(membersNamed).toStrictEqual([
        {
          rule: "no-array-mutation--derive-new-array",
          readsTypeInformation: true,
          hole: "a mutating method call on an array passes whole",
        },
      ]);
    });
  });

  describe("a name the set does not carry", () => {
    const it = test.extend("membersNamed", () =>
      DECLARED_RULE_SETS.filter((declared) => declared.name === SINGLE_ASSIGNMENT).flatMap(
        (singleAssignmentSet) =>
          memberNamedBy({ set: singleAssignmentSet, ruleName: "no-console" }) ?? [],
      ));

    it("reaches no member", ({ membersNamed }) => {
      expect(membersNamed).toStrictEqual([]);
    });
  });
});
