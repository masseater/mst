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

describe("declared-replacements/declared-entries", () => {
  test("the shared list starts out carrying no entry", () => {
    expect(DEFAULT_DECLARED_REPLACEMENTS).toStrictEqual([]);
  });

  test("what the consumer declares is added to what already stands", () => {
    expect(
      declaredReplacementsIn({
        options: [{ declared: [{ name: "gulp", substitute: "Run the workspace task runner." }] }],
        standing: [RETIRED_LERNA],
      }),
    ).toStrictEqual([
      RETIRED_LERNA,
      { name: "gulp", substitute: "Run the workspace task runner." },
    ]);
  });

  test("an entry written without a name is left out", () => {
    expect(
      declaredReplacementsIn({ options: [{ declared: [{ substitute: "x" }] }], standing: [] }),
    ).toStrictEqual([]);
  });

  test("an entry written with an empty name is left out", () => {
    expect(
      declaredReplacementsIn({
        options: [{ declared: [{ name: "", substitute: "x" }] }],
        standing: [],
      }),
    ).toStrictEqual([]);
  });

  test("an entry written without a substitute is left out", () => {
    expect(
      declaredReplacementsIn({ options: [{ declared: [{ name: "lerna" }] }], standing: [] }),
    ).toStrictEqual([]);
  });

  test("a withdrawal written without a name is left out", () => {
    expect(
      withdrawalsIn([{ withdrawn: [{ grounds: "the runner is not published" }] }]),
    ).toStrictEqual([]);
  });

  test("a withdrawal written without grounds carries none", () => {
    expect(withdrawalsIn([{ withdrawn: [{ name: "lerna" }] }])).toStrictEqual([
      { name: "lerna", grounds: "" },
    ]);
  });

  test("grounds written as blank space carry none", () => {
    expect(withdrawalsIn([{ withdrawn: [{ name: "lerna", grounds: "  " }] }])).toStrictEqual([
      { name: "lerna", grounds: "" },
    ]);
  });

  test("a withdrawal carrying grounds lifts the entry it names", () => {
    expect(
      replacementsInForce({
        declared: [RETIRED_LERNA],
        withdrawals: [{ name: "lerna", grounds: "the release job runs it" }],
      }),
    ).toStrictEqual([]);
  });

  test("a withdrawal carrying no grounds lifts nothing", () => {
    expect(
      replacementsInForce({
        declared: [RETIRED_LERNA],
        withdrawals: [{ name: "lerna", grounds: "" }],
      }),
    ).toStrictEqual([RETIRED_LERNA]);
  });

  test("a withdrawal carrying no grounds is groundless", () => {
    expect(
      groundlessWithdrawals([
        { name: "lerna", grounds: "" },
        { name: "gulp", grounds: "the release job runs it" },
      ]),
    ).toStrictEqual([{ name: "lerna", grounds: "" }]);
  });

  test("a withdrawal naming what no entry declares is dead", () => {
    expect(
      deadWithdrawals({
        declared: [RETIRED_LERNA],
        withdrawals: [
          { name: "lerna", grounds: "the release job runs it" },
          { name: "gulp", grounds: "the release job runs it" },
        ],
      }),
    ).toStrictEqual([{ name: "gulp", grounds: "the release job runs it" }]);
  });

  test("a name the list carries comes back with its substitute", () => {
    expect(replacementNamed({ entries: [RETIRED_LERNA], name: "lerna" })).toStrictEqual(
      RETIRED_LERNA,
    );
  });

  test("a name the list does not carry comes back as nothing", () => {
    expect(replacementNamed({ entries: [RETIRED_LERNA], name: "gulp" })).toBeNull();
  });
});
