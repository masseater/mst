import { describe, expect, test } from "vite-plus/test";

import { protectedRulesFrom, protectionSettingsIn } from "./protected-rules.ts";

const KEPT_RULE =
  "no-inline-suppression-of-protected-rule--register-the-exception-in-configuration";

const A_PROTECTED_RULE = "forbid-target-file--delete-or-relocate";

describe("protectedRulesFrom", () => {
  const defaultProtectionTest = test.extend("protectedAfterNoOptions", () =>
    protectedRulesFrom({ settings: protectionSettingsIn([]), keptRule: KEPT_RULE }));

  describe("options that spell nothing", () => {
    const it = defaultProtectionTest;

    it("protect the bundle this package carries", ({ protectedAfterNoOptions }) => {
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
  });

  describe("a rule listed without a key", () => {
    const it = defaultProtectionTest.extend("protectedAfterARuleListedWithoutAKey", () =>
      protectedRulesFrom({
        settings: protectionSettingsIn([[A_PROTECTED_RULE]]),
        keptRule: KEPT_RULE,
      }),
    );

    it("leaves the default set standing", ({
      protectedAfterARuleListedWithoutAKey,
      protectedAfterNoOptions,
    }) => {
      expect(protectedAfterARuleListedWithoutAKey).toStrictEqual(protectedAfterNoOptions);
    });
  });

  describe("nothing at all where the options belong", () => {
    const it = defaultProtectionTest.extend("protectedAfterNothingAtAll", () =>
      protectedRulesFrom({ settings: protectionSettingsIn([null]), keptRule: KEPT_RULE }),
    );

    it("leaves the default set standing", ({
      protectedAfterNothingAtAll,
      protectedAfterNoOptions,
    }) => {
      expect(protectedAfterNothingAtAll).toStrictEqual(protectedAfterNoOptions);
    });
  });

  describe("one rule spelled as text rather than a list", () => {
    const it = defaultProtectionTest.extend("protectedAfterOneRuleSpelledAsText", () =>
      protectedRulesFrom({
        settings: protectionSettingsIn([{ protectedRules: "no-console" }]),
        keptRule: KEPT_RULE,
      }),
    );

    it("leaves the default set standing", ({
      protectedAfterOneRuleSpelledAsText,
      protectedAfterNoOptions,
    }) => {
      expect(protectedAfterOneRuleSpelledAsText).toStrictEqual(protectedAfterNoOptions);
    });
  });

  describe("rules that are not spellings", () => {
    const it = defaultProtectionTest.extend("protectedAfterRulesThatAreNotSpellings", () =>
      protectedRulesFrom({
        settings: protectionSettingsIn([{ protectedRules: [1, true] }]),
        keptRule: KEPT_RULE,
      }),
    );

    it("leave the default set standing", ({
      protectedAfterRulesThatAreNotSpellings,
      protectedAfterNoOptions,
    }) => {
      expect(protectedAfterRulesThatAreNotSpellings).toStrictEqual(protectedAfterNoOptions);
    });
  });

  describe("a rule the options name", () => {
    const it = defaultProtectionTest.extend("protectedAfterAnAddedRule", () =>
      protectedRulesFrom({
        settings: protectionSettingsIn([{ protectedRules: ["no-console"] }]),
        keptRule: KEPT_RULE,
      }),
    );

    it("is added to the default set", ({ protectedAfterAnAddedRule, protectedAfterNoOptions }) => {
      expect(protectedAfterAnAddedRule).toStrictEqual([...protectedAfterNoOptions, "no-console"]);
    });
  });

  describe("a rule named twice", () => {
    const it = defaultProtectionTest.extend("protectedAfterARuleNamedTwice", () =>
      protectedRulesFrom({
        settings: protectionSettingsIn([{ protectedRules: [A_PROTECTED_RULE] }]),
        keptRule: KEPT_RULE,
      }),
    );

    it("is carried once", ({ protectedAfterARuleNamedTwice, protectedAfterNoOptions }) => {
      expect(protectedAfterARuleNamedTwice).toStrictEqual(protectedAfterNoOptions);
    });
  });

  describe("a deviation carrying grounds", () => {
    const it = defaultProtectionTest.extend("protectedAfterADeviationCarryingGrounds", () =>
      protectedRulesFrom({
        settings: protectionSettingsIn([
          { unprotected: [{ rule: A_PROTECTED_RULE, reason: "the registry owns it" }] },
        ]),
        keptRule: KEPT_RULE,
      }),
    );

    it("takes its rule out of the set", ({
      protectedAfterADeviationCarryingGrounds,
      protectedAfterNoOptions,
    }) => {
      expect(protectedAfterADeviationCarryingGrounds).toStrictEqual(
        protectedAfterNoOptions.filter((rule) => rule !== A_PROTECTED_RULE),
      );
    });
  });

  describe("a deviation spelled with the plugin prefix", () => {
    const it = defaultProtectionTest.extend(
      "protectedAfterADeviationSpelledWithThePluginPrefix",
      () =>
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
    );

    it("reaches the same rule", ({
      protectedAfterADeviationSpelledWithThePluginPrefix,
      protectedAfterNoOptions,
    }) => {
      expect(protectedAfterADeviationSpelledWithThePluginPrefix).toStrictEqual(
        protectedAfterNoOptions.filter((rule) => rule !== A_PROTECTED_RULE),
      );
    });
  });

  describe("a deviation without grounds", () => {
    const it = defaultProtectionTest.extend("protectedAfterADeviationWithoutGrounds", () =>
      protectedRulesFrom({
        settings: protectionSettingsIn([{ unprotected: [{ rule: A_PROTECTED_RULE }] }]),
        keptRule: KEPT_RULE,
      }),
    );

    it("leaves its rule in the set", ({
      protectedAfterADeviationWithoutGrounds,
      protectedAfterNoOptions,
    }) => {
      expect(protectedAfterADeviationWithoutGrounds).toStrictEqual(protectedAfterNoOptions);
    });
  });

  describe("a deviation whose grounds are blank", () => {
    const it = defaultProtectionTest.extend("protectedAfterADeviationWhoseGroundsAreBlank", () =>
      protectedRulesFrom({
        settings: protectionSettingsIn([
          { unprotected: [{ rule: A_PROTECTED_RULE, reason: " " }] },
        ]),
        keptRule: KEPT_RULE,
      }),
    );

    it("leaves its rule in the set", ({
      protectedAfterADeviationWhoseGroundsAreBlank,
      protectedAfterNoOptions,
    }) => {
      expect(protectedAfterADeviationWhoseGroundsAreBlank).toStrictEqual(protectedAfterNoOptions);
    });
  });

  describe("a deviation whose grounds are a number", () => {
    const it = defaultProtectionTest.extend("protectedAfterADeviationWhoseGroundsAreANumber", () =>
      protectedRulesFrom({
        settings: protectionSettingsIn([{ unprotected: [{ rule: A_PROTECTED_RULE, reason: 1 }] }]),
        keptRule: KEPT_RULE,
      }),
    );

    it("leaves its rule in the set", ({
      protectedAfterADeviationWhoseGroundsAreANumber,
      protectedAfterNoOptions,
    }) => {
      expect(protectedAfterADeviationWhoseGroundsAreANumber).toStrictEqual(protectedAfterNoOptions);
    });
  });

  describe("a deviation naming the rule this set always keeps", () => {
    const it = defaultProtectionTest.extend("protectedAfterADeviationNamingTheKeptRule", () =>
      protectedRulesFrom({
        settings: protectionSettingsIn([
          { unprotected: [{ rule: KEPT_RULE, reason: "this repository writes rules" }] },
        ]),
        keptRule: KEPT_RULE,
      }),
    );

    it("changes nothing", ({
      protectedAfterADeviationNamingTheKeptRule,
      protectedAfterNoOptions,
    }) => {
      expect(protectedAfterADeviationNamingTheKeptRule).toStrictEqual(protectedAfterNoOptions);
    });
  });

  describe("deviations spelled as text rather than a list", () => {
    const it = defaultProtectionTest.extend("protectedAfterDeviationsSpelledAsText", () =>
      protectedRulesFrom({
        settings: protectionSettingsIn([{ unprotected: "everything" }]),
        keptRule: KEPT_RULE,
      }),
    );

    it("are dropped", ({ protectedAfterDeviationsSpelledAsText, protectedAfterNoOptions }) => {
      expect(protectedAfterDeviationsSpelledAsText).toStrictEqual(protectedAfterNoOptions);
    });
  });

  describe("deviation entries this rule cannot read", () => {
    const it = defaultProtectionTest.extend("protectedAfterDeviationEntriesThatCannotBeRead", () =>
      protectedRulesFrom({
        settings: protectionSettingsIn([
          { unprotected: [null, ["rule"], 1, {}, { rule: "" }, { rule: 1 }] },
        ]),
        keptRule: KEPT_RULE,
      }),
    );

    it("are dropped", ({
      protectedAfterDeviationEntriesThatCannotBeRead,
      protectedAfterNoOptions,
    }) => {
      expect(protectedAfterDeviationEntriesThatCannotBeRead).toStrictEqual(protectedAfterNoOptions);
    });
  });
});

describe("protectionSettingsIn", () => {
  describe("options that spell every list", () => {
    const it = test.extend("settingsOfOptionsThatSpellEveryList", () =>
      protectionSettingsIn([
        {
          protectedRules: ["no-console"],
          unprotected: [{ rule: A_PROTECTED_RULE, reason: " the registry owns it " }],
          generatedPaths: ["**/schema/**"],
          suppressionSpellings: ["hush-lint"],
        },
      ]));

    it("carry the lists the options spell out", ({ settingsOfOptionsThatSpellEveryList }) => {
      expect(settingsOfOptionsThatSpellEveryList).toStrictEqual({
        addedRules: ["no-console"],
        deviations: [{ rule: A_PROTECTED_RULE, grounds: "the registry owns it" }],
        generatedPaths: ["**/schema/**"],
        suppressionSpellings: ["hush-lint"],
      });
    });
  });

  describe("options that spell nothing", () => {
    const it = test.extend("settingsOfOptionsThatSpellNothing", () => protectionSettingsIn([]));

    it("are read as empty lists", ({ settingsOfOptionsThatSpellNothing }) => {
      expect(settingsOfOptionsThatSpellNothing).toStrictEqual({
        addedRules: [],
        deviations: [],
        generatedPaths: [],
        suppressionSpellings: [],
      });
    });
  });
});
