import { describe, expect, test } from "vite-plus/test";

import { protectedRulesFrom, protectionSettingsIn } from "./protected-rules.ts";

import type { Options } from "@oxlint/plugins";

const KEPT_RULE =
  "no-inline-suppression-of-protected-rule--register-the-exception-in-configuration";

const A_PROTECTED_RULE = "forbid-target-file--delete-or-relocate";

const protectedAfter = (ruleOptions: Readonly<Options>): readonly string[] =>
  protectedRulesFrom({ settings: protectionSettingsIn(ruleOptions), keptRule: KEPT_RULE });

describe("protected-rules", () => {
  test("the default protected set is the bundle this package carries", () => {
    const protectedRules = protectedAfter([]);
    expect(protectedRules).toHaveLength(20);
    expect(protectedRules).toContain(A_PROTECTED_RULE);
    expect(protectedRules).toContain(KEPT_RULE);
  });

  test("ruleOptions this rule cannot read leave the default set standing", () => {
    expect(protectedAfter([["forbid-target-file--delete-or-relocate"]])).toHaveLength(20);
    expect(protectedAfter([null])).toHaveLength(20);
    expect(protectedAfter([{ protectedRules: "no-console" }])).toHaveLength(20);
    expect(protectedAfter([{ protectedRules: [1, true] }])).toHaveLength(20);
  });

  test("a rule the ruleOptions name is added to the default set", () => {
    expect(protectedAfter([{ protectedRules: ["no-console"] }])).toContain("no-console");
  });

  test("a rule named twice is carried once", () => {
    expect(protectedAfter([{ protectedRules: [A_PROTECTED_RULE] }])).toHaveLength(20);
  });

  test("a deviation carrying grounds takes its rule out of the set", () => {
    const ruleOptions = [
      { unprotected: [{ rule: A_PROTECTED_RULE, reason: "the registry owns it" }] },
    ];
    expect(protectedAfter(ruleOptions)).not.toContain(A_PROTECTED_RULE);
  });

  test("a deviation spelled with the plugin prefix reaches the same rule", () => {
    const ruleOptions = [
      {
        unprotected: [
          { rule: `dont-review-it/${A_PROTECTED_RULE}`, reason: "the registry owns it" },
        ],
      },
    ];
    expect(protectedAfter(ruleOptions)).not.toContain(A_PROTECTED_RULE);
  });

  test("a deviation without grounds leaves its rule in the set", () => {
    expect(protectedAfter([{ unprotected: [{ rule: A_PROTECTED_RULE }] }])).toContain(
      A_PROTECTED_RULE,
    );
    expect(protectedAfter([{ unprotected: [{ rule: A_PROTECTED_RULE, reason: " " }] }])).toContain(
      A_PROTECTED_RULE,
    );
    expect(protectedAfter([{ unprotected: [{ rule: A_PROTECTED_RULE, reason: 1 }] }])).toContain(
      A_PROTECTED_RULE,
    );
  });

  test("a deviation naming the rule this set always keeps changes nothing", () => {
    const ruleOptions = [
      { unprotected: [{ rule: KEPT_RULE, reason: "this repository writes rules" }] },
    ];
    expect(protectedAfter(ruleOptions)).toContain(KEPT_RULE);
  });

  test("deviation entries this rule cannot read are dropped", () => {
    expect(protectedAfter([{ unprotected: "everything" }])).toHaveLength(20);
    expect(
      protectedAfter([{ unprotected: [null, ["rule"], 1, {}, { rule: "" }, { rule: 1 }] }]),
    ).toHaveLength(20);
  });

  test("the settings carry the lists the ruleOptions spell out", () => {
    const settings = protectionSettingsIn([
      {
        protectedRules: ["no-console"],
        unprotected: [{ rule: A_PROTECTED_RULE, reason: " the registry owns it " }],
        generatedPaths: ["**/schema/**"],
        suppressionSpellings: ["hush-lint"],
      },
    ]);
    expect(settings).toStrictEqual({
      addedRules: ["no-console"],
      deviations: [{ rule: A_PROTECTED_RULE, grounds: "the registry owns it" }],
      generatedPaths: ["**/schema/**"],
      suppressionSpellings: ["hush-lint"],
    });
  });

  test("settings read from ruleOptions that spell nothing are empty", () => {
    expect(protectionSettingsIn([])).toStrictEqual({
      addedRules: [],
      deviations: [],
      generatedPaths: [],
      suppressionSpellings: [],
    });
  });
});
