import { describe, expect, test } from "vite-plus/test";

import {
  bareRuleNameOf,
  coveredRulesOf,
  namesRule,
  suppressionDirectiveOf,
  type SuppressionDirective,
} from "./suppression-directives.ts";

const DUPLICATE_TYPE_RULE = "no-duplicate-exported-type--reuse-authoritative-type";

const TARGET_RULES = [DUPLICATE_TYPE_RULE, "forbid-target-file--delete-or-relocate"];

const directiveIn = (written: string): SuppressionDirective => {
  const parsed = suppressionDirectiveOf({ value: written });
  if (parsed === null) throw new Error(`no suppression directive in ${written}`);
  return parsed;
};

describe("suppression-directives", () => {
  test("a comment that opens with no disable spelling is not a suppression", () => {
    expect(suppressionDirectiveOf({ value: " the running total" })).toBeNull();
    expect(suppressionDirectiveOf({ value: " oxlint-enable no-console" })).toBeNull();
    expect(
      suppressionDirectiveOf({ value: " mock-factory-exemption some-rule -- grounds" }),
    ).toBeNull();
    expect(suppressionDirectiveOf({ value: "* @see oxlint-disable" })).toBeNull();
  });

  test("a next-line and a same-line spelling both stay inside one line", () => {
    expect(directiveIn(" oxlint-disable-next-line no-console").coversWholeFile).toBe(false);
    expect(directiveIn(" eslint-disable-line no-console").coversWholeFile).toBe(false);
  });

  test("a bare disable spelling reaches past the line it sits on", () => {
    expect(directiveIn(" oxlint-disable no-console").coversWholeFile).toBe(true);
    expect(directiveIn(" eslint-disable ").coversWholeFile).toBe(true);
  });

  test("the rule names sit between the spelling and the grounds separator", () => {
    expect(
      directiveIn(" oxlint-disable-next-line no-console, no-empty -- the CLI prints here")
        .ruleNames,
    ).toStrictEqual(["no-console", "no-empty"]);
    expect(directiveIn(" oxlint-disable-next-line").ruleNames).toStrictEqual([]);
    expect(directiveIn(" oxlint-disable-next-line -- the CLI prints here").ruleNames).toStrictEqual(
      [],
    );
  });

  test("a rule name spelled with a double dash keeps its own name", () => {
    expect(
      directiveIn(` oxlint-disable-next-line ${DUPLICATE_TYPE_RULE} -- the generator writes both`)
        .ruleNames,
    ).toStrictEqual([DUPLICATE_TYPE_RULE]);
  });

  test("grounds written after the separator count as grounds", () => {
    expect(
      directiveIn(` oxlint-disable-next-line ${DUPLICATE_TYPE_RULE} -- the generator writes both`)
        .carriesGrounds,
    ).toBe(true);
    expect(
      directiveIn(" oxlint-disable-next-line no-console -- keep -- the second half").carriesGrounds,
    ).toBe(true);
  });

  test("a directive without a separator carries no grounds", () => {
    expect(directiveIn(` oxlint-disable-next-line ${DUPLICATE_TYPE_RULE}`).carriesGrounds).toBe(
      false,
    );
  });

  test("grounds spelled as the rule name alone carry no content", () => {
    expect(
      directiveIn(` oxlint-disable-next-line ${DUPLICATE_TYPE_RULE} -- ${DUPLICATE_TYPE_RULE}`)
        .carriesGrounds,
    ).toBe(false);
    expect(
      directiveIn(
        ` oxlint-disable-next-line dont-review-it/${DUPLICATE_TYPE_RULE} -- ${DUPLICATE_TYPE_RULE}.`,
      ).carriesGrounds,
    ).toBe(false);
  });

  test("grounds spelled as a claim of a wrong report carry no content", () => {
    expect(
      directiveIn(" oxlint-disable-next-line no-console -- false positive").carriesGrounds,
    ).toBe(false);
    expect(
      directiveIn(" oxlint-disable-next-line no-console -- (false positives)").carriesGrounds,
    ).toBe(false);
    expect(directiveIn(" oxlint-disable-next-line no-console -- 誤検出").carriesGrounds).toBe(
      false,
    );
    expect(directiveIn(" oxlint-disable-next-line no-console --  ").carriesGrounds).toBe(false);
  });

  test("grounds that name the rule and then say something carry content", () => {
    expect(
      directiveIn(
        ` oxlint-disable-next-line ${DUPLICATE_TYPE_RULE} -- ${DUPLICATE_TYPE_RULE} reads the generated copy`,
      ).carriesGrounds,
    ).toBe(true);
  });

  test("a directive that lists no rule covers every target", () => {
    expect(
      coveredRulesOf({ directive: directiveIn(" oxlint-disable"), targetRules: TARGET_RULES }),
    ).toStrictEqual(TARGET_RULES);
  });

  test("a directive that lists rules covers the targets among them", () => {
    expect(
      coveredRulesOf({
        directive: directiveIn(
          ` oxlint-disable-next-line dont-review-it/${DUPLICATE_TYPE_RULE}, no-console`,
        ),
        targetRules: TARGET_RULES,
      }),
    ).toStrictEqual([DUPLICATE_TYPE_RULE]);
  });

  test("a directive that lists no target covers nothing", () => {
    expect(
      coveredRulesOf({
        directive: directiveIn(" oxlint-disable-next-line no-console"),
        targetRules: TARGET_RULES,
      }),
    ).toStrictEqual([]);
  });

  test("naming a rule is read through the plugin prefix it may carry", () => {
    expect(
      namesRule({
        directive: directiveIn(` oxlint-disable-next-line dont-review-it/${DUPLICATE_TYPE_RULE}`),
        ruleName: DUPLICATE_TYPE_RULE,
      }),
    ).toBe(true);
    expect(
      namesRule({ directive: directiveIn(" oxlint-disable"), ruleName: DUPLICATE_TYPE_RULE }),
    ).toBe(false);
  });

  test("a spelling handed in as an additional one is read as a suppression", () => {
    const directive = suppressionDirectiveOf({ value: " hush-lint no-console -- the CLI prints" }, [
      "hush-lint",
    ]);
    expect(directive?.spelling).toBe("hush-lint");
    expect(directive?.coversWholeFile).toBe(true);
    expect(directive?.ruleNames).toStrictEqual(["no-console"]);
  });

  test("a spelling outside the list handed in stays no suppression", () => {
    expect(suppressionDirectiveOf({ value: " hush-lint no-console" }, ["quiet-lint"])).toBeNull();
  });

  test("a rule name without a plugin prefix is its own bare name", () => {
    expect(bareRuleNameOf("no-console")).toBe("no-console");
    expect(bareRuleNameOf("dont-review-it/no-console")).toBe("no-console");
  });
});
