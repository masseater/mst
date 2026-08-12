import { describe, expect, test } from "vite-plus/test";

import {
  bareRuleNameOf,
  coveredRulesOf,
  namesRule,
  suppressionDirectiveOf,
} from "./suppression-directives.ts";

const DUPLICATE_TYPE_RULE = "no-duplicate-exported-type--reuse-authoritative-type";

const TARGET_RULES = [DUPLICATE_TYPE_RULE, "forbid-target-file--delete-or-relocate"];

const it = test
  .extend("directiveOfACommentHoldingAWord", () =>
    suppressionDirectiveOf({ value: " the running total" }))
  .extend("directiveOfACommentThatEnables", () =>
    suppressionDirectiveOf({ value: " oxlint-enable no-console" }),
  )
  .extend("directiveOfACommentNamingAnExemption", () =>
    suppressionDirectiveOf({ value: " mock-factory-exemption some-rule -- grounds" }),
  )
  .extend("directiveOfADocCommentMentioningADisable", () =>
    suppressionDirectiveOf({ value: "* @see oxlint-disable" }),
  )
  .extend("directiveOfANextLineSpelling", () =>
    suppressionDirectiveOf({ value: " oxlint-disable-next-line no-console" }),
  )
  .extend("directiveOfASameLineSpelling", () =>
    suppressionDirectiveOf({ value: " eslint-disable-line no-console" }),
  )
  .extend("directiveOfABareOxlintSpelling", () =>
    suppressionDirectiveOf({ value: " oxlint-disable no-console" }),
  )
  .extend("directiveOfABareEslintSpelling", () =>
    suppressionDirectiveOf({ value: " eslint-disable " }),
  )
  .extend("directiveOfTwoRuleNamesBeforeTheGrounds", () =>
    suppressionDirectiveOf({
      value: " oxlint-disable-next-line no-console, no-empty -- the CLI prints here",
    }),
  )
  .extend("directiveOfASpellingWithNothingAfterIt", () =>
    suppressionDirectiveOf({ value: " oxlint-disable-next-line" }),
  )
  .extend("directiveOfGroundsWithNoRuleNames", () =>
    suppressionDirectiveOf({ value: " oxlint-disable-next-line -- the CLI prints here" }),
  )
  .extend("directiveOfARuleNameSpelledWithADoubleDash", () =>
    suppressionDirectiveOf({
      value: ` oxlint-disable-next-line ${DUPLICATE_TYPE_RULE} -- the generator writes both`,
    }),
  )
  .extend("directiveOfGroundsHoldingASecondSeparator", () =>
    suppressionDirectiveOf({
      value: " oxlint-disable-next-line no-console -- keep -- the second half",
    }),
  )
  .extend("directiveOfARuleNameWithoutASeparator", () =>
    suppressionDirectiveOf({ value: ` oxlint-disable-next-line ${DUPLICATE_TYPE_RULE}` }),
  )
  .extend("directiveOfGroundsSpelledAsTheRuleNameAlone", () =>
    suppressionDirectiveOf({
      value: ` oxlint-disable-next-line ${DUPLICATE_TYPE_RULE} -- ${DUPLICATE_TYPE_RULE}`,
    }),
  )
  .extend("directiveOfGroundsSpelledAsThePrefixedRuleNameAlone", () =>
    suppressionDirectiveOf({
      value: ` oxlint-disable-next-line dont-review-it/${DUPLICATE_TYPE_RULE} -- ${DUPLICATE_TYPE_RULE}.`,
    }),
  )
  .extend("directiveOfGroundsClaimingAFalsePositive", () =>
    suppressionDirectiveOf({ value: " oxlint-disable-next-line no-console -- false positive" }),
  )
  .extend("directiveOfGroundsClaimingFalsePositivesInBrackets", () =>
    suppressionDirectiveOf({ value: " oxlint-disable-next-line no-console -- (false positives)" }),
  )
  .extend("directiveOfGroundsClaimingAWrongReportInJapanese", () =>
    suppressionDirectiveOf({ value: " oxlint-disable-next-line no-console -- 誤検出" }),
  )
  .extend("directiveOfGroundsThatAreBlank", () =>
    suppressionDirectiveOf({ value: " oxlint-disable-next-line no-console --  " }),
  )
  .extend("directiveOfGroundsNamingTheRuleAndThenSaying", () =>
    suppressionDirectiveOf({
      value: ` oxlint-disable-next-line ${DUPLICATE_TYPE_RULE} -- ${DUPLICATE_TYPE_RULE} reads the generated copy`,
    }),
  )
  .extend("rulesCoveredByADirectiveListingNoRule", () => {
    const directive = suppressionDirectiveOf({ value: " oxlint-disable" });
    if (directive === null) throw new Error("the comment holds no suppression directive");
    return coveredRulesOf({ directive, targetRules: TARGET_RULES });
  })
  .extend("rulesCoveredByADirectiveListingRules", () => {
    const directive = suppressionDirectiveOf({
      value: ` oxlint-disable-next-line dont-review-it/${DUPLICATE_TYPE_RULE}, no-console`,
    });
    if (directive === null) throw new Error("the comment holds no suppression directive");
    return coveredRulesOf({ directive, targetRules: TARGET_RULES });
  })
  .extend("rulesCoveredByADirectiveListingNoTarget", () => {
    const directive = suppressionDirectiveOf({ value: " oxlint-disable-next-line no-console" });
    if (directive === null) throw new Error("the comment holds no suppression directive");
    return coveredRulesOf({ directive, targetRules: TARGET_RULES });
  })
  .extend("ruleNamedByAPrefixedDirective", () => {
    const directive = suppressionDirectiveOf({
      value: ` oxlint-disable-next-line dont-review-it/${DUPLICATE_TYPE_RULE}`,
    });
    if (directive === null) throw new Error("the comment holds no suppression directive");
    return namesRule({ directive, ruleName: DUPLICATE_TYPE_RULE });
  })
  .extend("ruleNamedByADirectiveListingNoRule", () => {
    const directive = suppressionDirectiveOf({ value: " oxlint-disable" });
    if (directive === null) throw new Error("the comment holds no suppression directive");
    return namesRule({ directive, ruleName: DUPLICATE_TYPE_RULE });
  })
  .extend("directiveOfAnAdditionalSpelling", () =>
    suppressionDirectiveOf({ value: " hush-lint no-console -- the CLI prints" }, ["hush-lint"]),
  )
  .extend("directiveOfASpellingOutsideTheListHandedIn", () =>
    suppressionDirectiveOf({ value: " hush-lint no-console" }, ["quiet-lint"]),
  )
  .extend("bareNameOfARuleWithoutAPrefix", () => bareRuleNameOf("no-console"))
  .extend("bareNameOfARuleWithAPrefix", () => bareRuleNameOf("dont-review-it/no-console"));

describe("suppression-directives", () => {
  it("a comment holding a word is no suppression", ({ directiveOfACommentHoldingAWord }) => {
    expect(directiveOfACommentHoldingAWord).toBe(null);
  });

  it("a comment that enables a rule is no suppression", ({ directiveOfACommentThatEnables }) => {
    expect(directiveOfACommentThatEnables).toBe(null);
  });

  it("a comment naming another kind of exemption is no suppression", ({
    directiveOfACommentNamingAnExemption,
  }) => {
    expect(directiveOfACommentNamingAnExemption).toBe(null);
  });

  it("a doc comment that only mentions a disable spelling is no suppression", ({
    directiveOfADocCommentMentioningADisable,
  }) => {
    expect(directiveOfADocCommentMentioningADisable).toBe(null);
  });

  it("a next-line spelling stays inside one line", ({ directiveOfANextLineSpelling }) => {
    expect(directiveOfANextLineSpelling).toStrictEqual({
      spelling: "oxlint-disable-next-line",
      coversWholeFile: false,
      ruleNames: ["no-console"],
      carriesGrounds: false,
    });
  });

  it("a same-line spelling stays inside one line", ({ directiveOfASameLineSpelling }) => {
    expect(directiveOfASameLineSpelling).toStrictEqual({
      spelling: "eslint-disable-line",
      coversWholeFile: false,
      ruleNames: ["no-console"],
      carriesGrounds: false,
    });
  });

  it("a bare oxlint disable spelling reaches past the line it sits on", ({
    directiveOfABareOxlintSpelling,
  }) => {
    expect(directiveOfABareOxlintSpelling).toStrictEqual({
      spelling: "oxlint-disable",
      coversWholeFile: true,
      ruleNames: ["no-console"],
      carriesGrounds: false,
    });
  });

  it("a bare eslint disable spelling reaches past the line it sits on", ({
    directiveOfABareEslintSpelling,
  }) => {
    expect(directiveOfABareEslintSpelling).toStrictEqual({
      spelling: "eslint-disable",
      coversWholeFile: true,
      ruleNames: [],
      carriesGrounds: false,
    });
  });

  it("the rule names sit between the spelling and the grounds separator", ({
    directiveOfTwoRuleNamesBeforeTheGrounds,
  }) => {
    expect(directiveOfTwoRuleNamesBeforeTheGrounds).toStrictEqual({
      spelling: "oxlint-disable-next-line",
      coversWholeFile: false,
      ruleNames: ["no-console", "no-empty"],
      carriesGrounds: true,
    });
  });

  it("a spelling with nothing after it names no rule", ({
    directiveOfASpellingWithNothingAfterIt,
  }) => {
    expect(directiveOfASpellingWithNothingAfterIt).toStrictEqual({
      spelling: "oxlint-disable-next-line",
      coversWholeFile: false,
      ruleNames: [],
      carriesGrounds: false,
    });
  });

  it("grounds written with nothing before the separator name no rule", ({
    directiveOfGroundsWithNoRuleNames,
  }) => {
    expect(directiveOfGroundsWithNoRuleNames).toStrictEqual({
      spelling: "oxlint-disable-next-line",
      coversWholeFile: false,
      ruleNames: [],
      carriesGrounds: true,
    });
  });

  it("a rule name spelled with a double dash keeps its own name and the grounds after it count", ({
    directiveOfARuleNameSpelledWithADoubleDash,
  }) => {
    expect(directiveOfARuleNameSpelledWithADoubleDash).toStrictEqual({
      spelling: "oxlint-disable-next-line",
      coversWholeFile: false,
      ruleNames: [DUPLICATE_TYPE_RULE],
      carriesGrounds: true,
    });
  });

  it("grounds holding a second separator count as grounds", ({
    directiveOfGroundsHoldingASecondSeparator,
  }) => {
    expect(directiveOfGroundsHoldingASecondSeparator).toStrictEqual({
      spelling: "oxlint-disable-next-line",
      coversWholeFile: false,
      ruleNames: ["no-console"],
      carriesGrounds: true,
    });
  });

  it("a directive without a separator carries no grounds", ({
    directiveOfARuleNameWithoutASeparator,
  }) => {
    expect(directiveOfARuleNameWithoutASeparator).toStrictEqual({
      spelling: "oxlint-disable-next-line",
      coversWholeFile: false,
      ruleNames: [DUPLICATE_TYPE_RULE],
      carriesGrounds: false,
    });
  });

  it("grounds spelled as the rule name alone carry no content", ({
    directiveOfGroundsSpelledAsTheRuleNameAlone,
  }) => {
    expect(directiveOfGroundsSpelledAsTheRuleNameAlone).toStrictEqual({
      spelling: "oxlint-disable-next-line",
      coversWholeFile: false,
      ruleNames: [DUPLICATE_TYPE_RULE],
      carriesGrounds: false,
    });
  });

  it("grounds spelled as the rule name the directive carries a plugin prefix for carry no content", ({
    directiveOfGroundsSpelledAsThePrefixedRuleNameAlone,
  }) => {
    expect(directiveOfGroundsSpelledAsThePrefixedRuleNameAlone).toStrictEqual({
      spelling: "oxlint-disable-next-line",
      coversWholeFile: false,
      ruleNames: [`dont-review-it/${DUPLICATE_TYPE_RULE}`],
      carriesGrounds: false,
    });
  });

  it("grounds spelled as a claim of a wrong report carry no content", ({
    directiveOfGroundsClaimingAFalsePositive,
  }) => {
    expect(directiveOfGroundsClaimingAFalsePositive).toStrictEqual({
      spelling: "oxlint-disable-next-line",
      coversWholeFile: false,
      ruleNames: ["no-console"],
      carriesGrounds: false,
    });
  });

  it("grounds spelled as a bracketed claim of wrong reports carry no content", ({
    directiveOfGroundsClaimingFalsePositivesInBrackets,
  }) => {
    expect(directiveOfGroundsClaimingFalsePositivesInBrackets).toStrictEqual({
      spelling: "oxlint-disable-next-line",
      coversWholeFile: false,
      ruleNames: ["no-console"],
      carriesGrounds: false,
    });
  });

  it("grounds spelled as a claim of a wrong report in japanese carry no content", ({
    directiveOfGroundsClaimingAWrongReportInJapanese,
  }) => {
    expect(directiveOfGroundsClaimingAWrongReportInJapanese).toStrictEqual({
      spelling: "oxlint-disable-next-line",
      coversWholeFile: false,
      ruleNames: ["no-console"],
      carriesGrounds: false,
    });
  });

  it("grounds holding only blanks carry no content", ({ directiveOfGroundsThatAreBlank }) => {
    expect(directiveOfGroundsThatAreBlank).toStrictEqual({
      spelling: "oxlint-disable-next-line",
      coversWholeFile: false,
      ruleNames: ["no-console"],
      carriesGrounds: false,
    });
  });

  it("grounds that name the rule and then say something carry content", ({
    directiveOfGroundsNamingTheRuleAndThenSaying,
  }) => {
    expect(directiveOfGroundsNamingTheRuleAndThenSaying).toStrictEqual({
      spelling: "oxlint-disable-next-line",
      coversWholeFile: false,
      ruleNames: [DUPLICATE_TYPE_RULE],
      carriesGrounds: true,
    });
  });

  it("a directive that lists no rule covers every target", ({
    rulesCoveredByADirectiveListingNoRule,
  }) => {
    expect(rulesCoveredByADirectiveListingNoRule).toStrictEqual(TARGET_RULES);
  });

  it("a directive that lists rules covers the targets among them", ({
    rulesCoveredByADirectiveListingRules,
  }) => {
    expect(rulesCoveredByADirectiveListingRules).toStrictEqual([DUPLICATE_TYPE_RULE]);
  });

  it("a directive that lists no target covers nothing", ({
    rulesCoveredByADirectiveListingNoTarget,
  }) => {
    expect(rulesCoveredByADirectiveListingNoTarget).toStrictEqual([]);
  });

  it("naming a rule is read through the plugin prefix it may carry", ({
    ruleNamedByAPrefixedDirective,
  }) => {
    expect(ruleNamedByAPrefixedDirective).toBe(true);
  });

  it("a directive that lists no rule names no rule", ({ ruleNamedByADirectiveListingNoRule }) => {
    expect(ruleNamedByADirectiveListingNoRule).toBe(false);
  });

  it("a spelling handed in as an additional one is read as a suppression", ({
    directiveOfAnAdditionalSpelling,
  }) => {
    expect(directiveOfAnAdditionalSpelling).toStrictEqual({
      spelling: "hush-lint",
      coversWholeFile: true,
      ruleNames: ["no-console"],
      carriesGrounds: true,
    });
  });

  it("a spelling outside the list handed in stays no suppression", ({
    directiveOfASpellingOutsideTheListHandedIn,
  }) => {
    expect(directiveOfASpellingOutsideTheListHandedIn).toBe(null);
  });

  it("a rule name without a plugin prefix is its own bare name", ({
    bareNameOfARuleWithoutAPrefix,
  }) => {
    expect(bareNameOfARuleWithoutAPrefix).toBe("no-console");
  });

  it("a rule name carrying a plugin prefix loses the prefix", ({ bareNameOfARuleWithAPrefix }) => {
    expect(bareNameOfARuleWithAPrefix).toBe("no-console");
  });
});
