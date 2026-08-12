import { describe, expect, test } from "vite-plus/test";

import { DECLARED_RULE_SETS, memberNamedBy } from "./declared-rule-sets.ts";

const SINGLE_ASSIGNMENT = "single-assignment";

const FAILURE_ROUTING = "failure-routing";

const it = test
  .extend("rulesOfSingleAssignmentSet", () =>
    DECLARED_RULE_SETS.filter((declared) => declared.name === SINGLE_ASSIGNMENT).flatMap(
      (declared) => declared.members.map((member) => member.rule),
    ))
  .extend("rulesOfFailureRoutingSet", () =>
    DECLARED_RULE_SETS.filter((declared) => declared.name === FAILURE_ROUTING).flatMap((declared) =>
      declared.members.map((member) => member.rule),
    ),
  )
  .extend("typeReadingRulesOfSingleAssignmentSet", () =>
    DECLARED_RULE_SETS.filter((declared) => declared.name === SINGLE_ASSIGNMENT).flatMap(
      (declared) =>
        declared.members
          .filter((member) => member.readsTypeInformation)
          .map((member) => member.rule),
    ),
  )
  .extend("membersStatingNoHole", () =>
    DECLARED_RULE_SETS.flatMap((declared) => declared.members).filter(
      (member) => member.hole === "",
    ),
  )
  .extend("membersReachedByBareName", () =>
    DECLARED_RULE_SETS.filter((declared) => declared.name === SINGLE_ASSIGNMENT).flatMap(
      (set) => memberNamedBy({ set, ruleName: "no-reassign--use-spread-or-iife" }) ?? [],
    ),
  )
  .extend("membersReachedByQualifiedName", () =>
    DECLARED_RULE_SETS.filter((declared) => declared.name === SINGLE_ASSIGNMENT).flatMap(
      (set) =>
        memberNamedBy({ set, ruleName: "dont-review-it/no-array-mutation--derive-new-array" }) ??
        [],
    ),
  )
  .extend("membersReachedByForeignName", () =>
    DECLARED_RULE_SETS.filter((declared) => declared.name === SINGLE_ASSIGNMENT).flatMap(
      (set) => memberNamedBy({ set, ruleName: "no-console" }) ?? [],
    ),
  );

describe("declared-rule-sets", () => {
  it("the single-assignment set carries the eight rules that share the invariant", ({
    rulesOfSingleAssignmentSet,
  }) => {
    expect(rulesOfSingleAssignmentSet).toStrictEqual([
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

  it("the failure-routing set carries the chain rule together with the clause it feeds", ({
    rulesOfFailureRoutingSet,
  }) => {
    expect(rulesOfFailureRoutingSet).toStrictEqual([
      "no-promise-chain--use-async-await",
      "no-empty-catch--throw-or-handle",
      "no-silent-catch--rethrow-or-handle",
      "no-floating-promise--await-the-result",
    ]);
  });

  it("the members that read type information are the ones a typeless run cannot host", ({
    typeReadingRulesOfSingleAssignmentSet,
  }) => {
    expect(typeReadingRulesOfSingleAssignmentSet).toStrictEqual([
      "no-array-mutation--derive-new-array",
      "no-receiver-mutation--derive-new-value",
      "no-class-as-mutable-cell--decide-in-an-iife",
      "no-promise-chain--use-async-await",
      "no-floating-promise--await-the-result",
    ]);
  });

  it("every member states the hole its absence opens", ({ membersStatingNoHole }) => {
    expect(membersStatingNoHole).toStrictEqual([]);
  });

  it("a rule of the set is found through the bare name a configuration spells", ({
    membersReachedByBareName,
  }) => {
    expect(membersReachedByBareName).toStrictEqual([
      {
        rule: "no-reassign--use-spread-or-iife",
        readsTypeInformation: false,
        hole: "a rebindable declaration and every assignment shaped write pass",
      },
    ]);
  });

  it("a rule of the set is found through the name a configuration qualifies with its plugin", ({
    membersReachedByQualifiedName,
  }) => {
    expect(membersReachedByQualifiedName).toStrictEqual([
      {
        rule: "no-array-mutation--derive-new-array",
        readsTypeInformation: true,
        hole: "a mutating method call on an array passes whole",
      },
    ]);
  });

  it("a name the set does not carry reaches no member", ({ membersReachedByForeignName }) => {
    expect(membersReachedByForeignName).toStrictEqual([]);
  });
});
