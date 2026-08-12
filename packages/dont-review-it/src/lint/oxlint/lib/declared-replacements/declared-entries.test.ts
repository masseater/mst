import { describe, expect, test } from "vite-plus/test";

import {
  deadWithdrawals,
  declaredReplacementsIn,
  DEFAULT_DECLARED_REPLACEMENTS,
  groundlessWithdrawals,
  replacementNamed,
  replacementsInForce,
  withdrawalsIn,
} from "./declared-entries.ts";

const RETIRED_LERNA = { name: "lerna", substitute: "Run the workspace task runner." };

const it = test
  .extend("standingReplacementsBeforeAnyoneDeclares", () => DEFAULT_DECLARED_REPLACEMENTS)
  .extend("replacementsAfterTheConsumerDeclaresOne", () =>
    declaredReplacementsIn({
      options: [{ declared: [{ name: "gulp", substitute: "Run the workspace task runner." }] }],
      standing: [RETIRED_LERNA],
    }),
  )
  .extend("replacementsFromAnEntryWithoutAName", () =>
    declaredReplacementsIn({ options: [{ declared: [{ substitute: "x" }] }], standing: [] }),
  )
  .extend("replacementsFromAnEntryWithAnEmptyName", () =>
    declaredReplacementsIn({
      options: [{ declared: [{ name: "", substitute: "x" }] }],
      standing: [],
    }),
  )
  .extend("replacementsFromAnEntryWithoutASubstitute", () =>
    declaredReplacementsIn({ options: [{ declared: [{ name: "lerna" }] }], standing: [] }),
  )
  .extend("withdrawalsFromAnEntryWithoutAName", () =>
    withdrawalsIn([{ withdrawn: [{ grounds: "the runner is not published" }] }]),
  )
  .extend("withdrawalsFromAnEntryWithoutGrounds", () =>
    withdrawalsIn([{ withdrawn: [{ name: "lerna" }] }]),
  )
  .extend("withdrawalsFromGroundsWrittenAsBlankSpace", () =>
    withdrawalsIn([{ withdrawn: [{ name: "lerna", grounds: "  " }] }]),
  )
  .extend("replacementsLeftByAWithdrawalCarryingGrounds", () =>
    replacementsInForce({
      declared: [RETIRED_LERNA],
      withdrawals: [{ name: "lerna", grounds: "the release job runs it" }],
    }),
  )
  .extend("replacementsLeftByAWithdrawalCarryingNoGrounds", () =>
    replacementsInForce({
      declared: [RETIRED_LERNA],
      withdrawals: [{ name: "lerna", grounds: "" }],
    }),
  )
  .extend("groundlessAmongTwoWithdrawals", () =>
    groundlessWithdrawals([
      { name: "lerna", grounds: "" },
      { name: "gulp", grounds: "the release job runs it" },
    ]),
  )
  .extend("deadAmongTwoWithdrawals", () =>
    deadWithdrawals({
      declared: [RETIRED_LERNA],
      withdrawals: [
        { name: "lerna", grounds: "the release job runs it" },
        { name: "gulp", grounds: "the release job runs it" },
      ],
    }),
  )
  .extend("replacementFoundUnderANameTheListCarries", () =>
    replacementNamed({ entries: [RETIRED_LERNA], name: "lerna" }),
  )
  .extend("replacementFoundUnderANameTheListDoesNotCarry", () =>
    replacementNamed({ entries: [RETIRED_LERNA], name: "gulp" }),
  );

describe("declared-replacements/declared-entries", () => {
  it("the shared list starts out carrying no entry", ({
    standingReplacementsBeforeAnyoneDeclares,
  }) => {
    expect(standingReplacementsBeforeAnyoneDeclares).toStrictEqual([]);
  });

  it("what the consumer declares is added to what already stands", ({
    replacementsAfterTheConsumerDeclaresOne,
  }) => {
    expect(replacementsAfterTheConsumerDeclaresOne).toStrictEqual([
      RETIRED_LERNA,
      { name: "gulp", substitute: "Run the workspace task runner." },
    ]);
  });

  it("an entry written without a name is left out", ({ replacementsFromAnEntryWithoutAName }) => {
    expect(replacementsFromAnEntryWithoutAName).toStrictEqual([]);
  });

  it("an entry written with an empty name is left out", ({
    replacementsFromAnEntryWithAnEmptyName,
  }) => {
    expect(replacementsFromAnEntryWithAnEmptyName).toStrictEqual([]);
  });

  it("an entry written without a substitute is left out", ({
    replacementsFromAnEntryWithoutASubstitute,
  }) => {
    expect(replacementsFromAnEntryWithoutASubstitute).toStrictEqual([]);
  });

  it("a withdrawal written without a name is left out", ({
    withdrawalsFromAnEntryWithoutAName,
  }) => {
    expect(withdrawalsFromAnEntryWithoutAName).toStrictEqual([]);
  });

  it("a withdrawal written without grounds carries none", ({
    withdrawalsFromAnEntryWithoutGrounds,
  }) => {
    expect(withdrawalsFromAnEntryWithoutGrounds).toStrictEqual([{ name: "lerna", grounds: "" }]);
  });

  it("grounds written as blank space carry none", ({
    withdrawalsFromGroundsWrittenAsBlankSpace,
  }) => {
    expect(withdrawalsFromGroundsWrittenAsBlankSpace).toStrictEqual([
      { name: "lerna", grounds: "" },
    ]);
  });

  it("a withdrawal carrying grounds lifts the entry it names", ({
    replacementsLeftByAWithdrawalCarryingGrounds,
  }) => {
    expect(replacementsLeftByAWithdrawalCarryingGrounds).toStrictEqual([]);
  });

  it("a withdrawal carrying no grounds lifts nothing", ({
    replacementsLeftByAWithdrawalCarryingNoGrounds,
  }) => {
    expect(replacementsLeftByAWithdrawalCarryingNoGrounds).toStrictEqual([RETIRED_LERNA]);
  });

  it("a withdrawal carrying no grounds is groundless", ({ groundlessAmongTwoWithdrawals }) => {
    expect(groundlessAmongTwoWithdrawals).toStrictEqual([{ name: "lerna", grounds: "" }]);
  });

  it("a withdrawal naming what no entry declares is dead", ({ deadAmongTwoWithdrawals }) => {
    expect(deadAmongTwoWithdrawals).toStrictEqual([
      { name: "gulp", grounds: "the release job runs it" },
    ]);
  });

  it("a name the list carries comes back with its substitute", ({
    replacementFoundUnderANameTheListCarries,
  }) => {
    expect(replacementFoundUnderANameTheListCarries).toStrictEqual(RETIRED_LERNA);
  });

  it("a name the list does not carry comes back as nothing", ({
    replacementFoundUnderANameTheListDoesNotCarry,
  }) => {
    expect(replacementFoundUnderANameTheListDoesNotCarry).toBe(null);
  });
});
