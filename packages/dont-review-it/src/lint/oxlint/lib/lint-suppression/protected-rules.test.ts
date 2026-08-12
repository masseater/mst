import { describe, expect, test } from "vite-plus/test";

import { protectedRulesFrom, protectionSettingsIn } from "./protected-rules.ts";

const KEPT_RULE =
  "no-inline-suppression-of-protected-rule--register-the-exception-in-configuration";

const A_PROTECTED_RULE = "forbid-target-file--delete-or-relocate";

const it = test
  .extend("protectedAfterNoOptions", () =>
    protectedRulesFrom({ settings: protectionSettingsIn([]), keptRule: KEPT_RULE }))
  .extend("protectedAfterARuleListedWithoutAKey", () =>
    protectedRulesFrom({
      settings: protectionSettingsIn([[A_PROTECTED_RULE]]),
      keptRule: KEPT_RULE,
    }),
  )
  .extend("protectedAfterNothingAtAll", () =>
    protectedRulesFrom({ settings: protectionSettingsIn([null]), keptRule: KEPT_RULE }),
  )
  .extend("protectedAfterOneRuleSpelledAsText", () =>
    protectedRulesFrom({
      settings: protectionSettingsIn([{ protectedRules: "no-console" }]),
      keptRule: KEPT_RULE,
    }),
  )
  .extend("protectedAfterRulesThatAreNotSpellings", () =>
    protectedRulesFrom({
      settings: protectionSettingsIn([{ protectedRules: [1, true] }]),
      keptRule: KEPT_RULE,
    }),
  )
  .extend("protectedAfterAnAddedRule", () =>
    protectedRulesFrom({
      settings: protectionSettingsIn([{ protectedRules: ["no-console"] }]),
      keptRule: KEPT_RULE,
    }),
  )
  .extend("protectedAfterARuleNamedTwice", () =>
    protectedRulesFrom({
      settings: protectionSettingsIn([{ protectedRules: [A_PROTECTED_RULE] }]),
      keptRule: KEPT_RULE,
    }),
  )
  .extend("protectedAfterADeviationCarryingGrounds", () =>
    protectedRulesFrom({
      settings: protectionSettingsIn([
        { unprotected: [{ rule: A_PROTECTED_RULE, reason: "the registry owns it" }] },
      ]),
      keptRule: KEPT_RULE,
    }),
  )
  .extend("protectedAfterADeviationSpelledWithThePluginPrefix", () =>
    protectedRulesFrom({
      settings: protectionSettingsIn([
        {
          unprotected: [
            { rule: `dont-review-it/${A_PROTECTED_RULE}`, reason: "the registry owns it" },
          ],
        },
      ]),
      keptRule: KEPT_RULE,
    }),
  )
  .extend("protectedAfterADeviationWithoutGrounds", () =>
    protectedRulesFrom({
      settings: protectionSettingsIn([{ unprotected: [{ rule: A_PROTECTED_RULE }] }]),
      keptRule: KEPT_RULE,
    }),
  )
  .extend("protectedAfterADeviationWhoseGroundsAreBlank", () =>
    protectedRulesFrom({
      settings: protectionSettingsIn([{ unprotected: [{ rule: A_PROTECTED_RULE, reason: " " }] }]),
      keptRule: KEPT_RULE,
    }),
  )
  .extend("protectedAfterADeviationWhoseGroundsAreANumber", () =>
    protectedRulesFrom({
      settings: protectionSettingsIn([{ unprotected: [{ rule: A_PROTECTED_RULE, reason: 1 }] }]),
      keptRule: KEPT_RULE,
    }),
  )
  .extend("protectedAfterADeviationNamingTheKeptRule", () =>
    protectedRulesFrom({
      settings: protectionSettingsIn([
        { unprotected: [{ rule: KEPT_RULE, reason: "this repository writes rules" }] },
      ]),
      keptRule: KEPT_RULE,
    }),
  )
  .extend("protectedAfterDeviationsSpelledAsText", () =>
    protectedRulesFrom({
      settings: protectionSettingsIn([{ unprotected: "everything" }]),
      keptRule: KEPT_RULE,
    }),
  )
  .extend("protectedAfterDeviationEntriesThatCannotBeRead", () =>
    protectedRulesFrom({
      settings: protectionSettingsIn([
        { unprotected: [null, ["rule"], 1, {}, { rule: "" }, { rule: 1 }] },
      ]),
      keptRule: KEPT_RULE,
    }),
  )
  .extend("settingsOfOptionsThatSpellEveryList", () =>
    protectionSettingsIn([
      {
        protectedRules: ["no-console"],
        unprotected: [{ rule: A_PROTECTED_RULE, reason: " the registry owns it " }],
        generatedPaths: ["**/schema/**"],
        suppressionSpellings: ["hush-lint"],
      },
    ]),
  )
  .extend("settingsOfOptionsThatSpellNothing", () => protectionSettingsIn([]));

describe("protected-rules", () => {
  it("the default protected set is the bundle this package carries", ({
    protectedAfterNoOptions,
  }) => {
    expect(protectedAfterNoOptions).toStrictEqual([
      "forbid-javascript-source-file--author-in-typescript",
      A_PROTECTED_RULE,
      "forbid-declared-module-import--use-declared-replacement",
      "forbid-module-import-outside-owner--import-through-owner",
      "forbid-unlisted-specifier-form--use-permitted-form",
      "forbid-declared-export-reference--use-declared-replacement",
      "no-retired-tool-in-manifest--use-designated-replacement",
      "require-pinned-runtime-direct-execution--invoke-canonical-entry",
      "no-shell-logic-outside-bootstrap--move-to-typescript-command",
      "no-repository-root-script-directory--own-by-workspace-or-package",
      "no-pre-install-external-dependency--use-builtin-or-relative",
      "forbid-unresolvable-module-specifier--write-a-statically-resolvable-specifier",
      "forbid-restricted-target-relay--delete-the-relay",
      "forbid-declared-command-invocation--use-designated-replacement",
      "forbid-tracked-path--untrack-and-ignore",
      "require-registered-file--restore-it-at-the-registered-path",
      "no-mixed-package-surface--declare-one-surface",
      KEPT_RULE,
      "forbid-generic-restriction-rule--use-the-declared-rule",
      "no-unchecked-authored-path--include-it-in-every-declared-check",
    ]);
  });

  it("a rule listed without a key leaves the default set standing", ({
    protectedAfterARuleListedWithoutAKey,
    protectedAfterNoOptions,
  }) => {
    expect(protectedAfterARuleListedWithoutAKey).toStrictEqual(protectedAfterNoOptions);
  });

  it("nothing at all where the options belong leaves the default set standing", ({
    protectedAfterNothingAtAll,
    protectedAfterNoOptions,
  }) => {
    expect(protectedAfterNothingAtAll).toStrictEqual(protectedAfterNoOptions);
  });

  it("one rule spelled as text rather than a list leaves the default set standing", ({
    protectedAfterOneRuleSpelledAsText,
    protectedAfterNoOptions,
  }) => {
    expect(protectedAfterOneRuleSpelledAsText).toStrictEqual(protectedAfterNoOptions);
  });

  it("rules that are not spellings leave the default set standing", ({
    protectedAfterRulesThatAreNotSpellings,
    protectedAfterNoOptions,
  }) => {
    expect(protectedAfterRulesThatAreNotSpellings).toStrictEqual(protectedAfterNoOptions);
  });

  it("a rule the options name is added to the default set", ({
    protectedAfterAnAddedRule,
    protectedAfterNoOptions,
  }) => {
    expect(protectedAfterAnAddedRule).toStrictEqual([...protectedAfterNoOptions, "no-console"]);
  });

  it("a rule named twice is carried once", ({
    protectedAfterARuleNamedTwice,
    protectedAfterNoOptions,
  }) => {
    expect(protectedAfterARuleNamedTwice).toStrictEqual(protectedAfterNoOptions);
  });

  it("a deviation carrying grounds takes its rule out of the set", ({
    protectedAfterADeviationCarryingGrounds,
    protectedAfterNoOptions,
  }) => {
    expect(protectedAfterADeviationCarryingGrounds).toStrictEqual(
      protectedAfterNoOptions.filter((rule) => rule !== A_PROTECTED_RULE),
    );
  });

  it("a deviation spelled with the plugin prefix reaches the same rule", ({
    protectedAfterADeviationSpelledWithThePluginPrefix,
    protectedAfterNoOptions,
  }) => {
    expect(protectedAfterADeviationSpelledWithThePluginPrefix).toStrictEqual(
      protectedAfterNoOptions.filter((rule) => rule !== A_PROTECTED_RULE),
    );
  });

  it("a deviation without grounds leaves its rule in the set", ({
    protectedAfterADeviationWithoutGrounds,
    protectedAfterNoOptions,
  }) => {
    expect(protectedAfterADeviationWithoutGrounds).toStrictEqual(protectedAfterNoOptions);
  });

  it("a deviation whose grounds are blank leaves its rule in the set", ({
    protectedAfterADeviationWhoseGroundsAreBlank,
    protectedAfterNoOptions,
  }) => {
    expect(protectedAfterADeviationWhoseGroundsAreBlank).toStrictEqual(protectedAfterNoOptions);
  });

  it("a deviation whose grounds are a number leaves its rule in the set", ({
    protectedAfterADeviationWhoseGroundsAreANumber,
    protectedAfterNoOptions,
  }) => {
    expect(protectedAfterADeviationWhoseGroundsAreANumber).toStrictEqual(protectedAfterNoOptions);
  });

  it("a deviation naming the rule this set always keeps changes nothing", ({
    protectedAfterADeviationNamingTheKeptRule,
    protectedAfterNoOptions,
  }) => {
    expect(protectedAfterADeviationNamingTheKeptRule).toStrictEqual(protectedAfterNoOptions);
  });

  it("deviations spelled as text rather than a list are dropped", ({
    protectedAfterDeviationsSpelledAsText,
    protectedAfterNoOptions,
  }) => {
    expect(protectedAfterDeviationsSpelledAsText).toStrictEqual(protectedAfterNoOptions);
  });

  it("deviation entries this rule cannot read are dropped", ({
    protectedAfterDeviationEntriesThatCannotBeRead,
    protectedAfterNoOptions,
  }) => {
    expect(protectedAfterDeviationEntriesThatCannotBeRead).toStrictEqual(protectedAfterNoOptions);
  });

  it("the settings carry the lists the options spell out", ({
    settingsOfOptionsThatSpellEveryList,
  }) => {
    expect(settingsOfOptionsThatSpellEveryList).toStrictEqual({
      addedRules: ["no-console"],
      deviations: [{ rule: A_PROTECTED_RULE, grounds: "the registry owns it" }],
      generatedPaths: ["**/schema/**"],
      suppressionSpellings: ["hush-lint"],
    });
  });

  it("settings read from options that spell nothing are empty", ({
    settingsOfOptionsThatSpellNothing,
  }) => {
    expect(settingsOfOptionsThatSpellNothing).toStrictEqual({
      addedRules: [],
      deviations: [],
      generatedPaths: [],
      suppressionSpellings: [],
    });
  });
});
