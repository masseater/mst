import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { forbidWeakMatcher } from "./forbid-weak-matcher--use-exact-matcher.ts";

const SPEC_FILENAME = "order.test.ts";

const SOURCE_FILENAME = "order.ts";

describe("dont-review-it/forbid-weak-matcher--use-exact-matcher", () => {
  testLintRule(forbidWeakMatcher, {
    valid: [
      {
        name: "comparing the subject with the value it has to equal is the shape this rule keeps",
        documented: true,
        code: "expect(subject).toBe(1);",
        filename: SPEC_FILENAME,
      },
      {
        name: "comparing the subject with the structure it has to equal is the other shape it keeps",
        documented: true,
        code: "expect(subject).toStrictEqual({ id: 1, spelled: 'ada' });",
        filename: SPEC_FILENAME,
      },
      {
        name: "stating how a mock was called belongs to the call contract family, not to value comparison",
        code: "expect(save).toHaveBeenCalledWith({ id: 1 });\nexpect(save).toHaveBeenCalledTimes(1);\nexpect(save).toHaveBeenCalledOnce();",
        filename: SPEC_FILENAME,
      },
      {
        name: "the older spelling of the call contract family is left to whoever owns that spelling",
        code: "expect(save).toBeCalled();\nexpect(save).toBeCalledWith(1);",
        filename: SPEC_FILENAME,
      },
      {
        name: "recording the subject in a snapshot is left to whoever owns snapshots",
        code: "expect(subject).toMatchSnapshot();\nexpect(subject).toMatchInlineSnapshot();\nexpect(subject).matchSnapshot();",
        filename: SPEC_FILENAME,
      },
      {
        name: "a matcher outside the forbidden set is not read as weak from its meaning",
        code: "expect(subject).toBeSettled();",
        filename: SPEC_FILENAME,
      },
      {
        name: "an unrelated receiver carrying the same method name is not an assertion",
        code: "report.toContain(entry);\nqueue.toHaveLength(2);",
        filename: SPEC_FILENAME,
      },
      {
        name: "a member of an unrelated receiver carrying the same method name is not an assertion",
        code: "fixture.report.toContain(entry);",
        filename: SPEC_FILENAME,
      },
      {
        name: "a modifier chain whose root is not an expect call is not an assertion either",
        code: "checker.not.toBeTruthy();",
        filename: SPEC_FILENAME,
      },
      {
        name: "an entry point spelled like the derived ones on another receiver is not an assertion",
        code: "runner.soft(subject).toBeTruthy();",
        filename: SPEC_FILENAME,
      },
      {
        name: "an assertion entry handed back by another call is not the entry this rule reads",
        code: "makeExpect()(subject).toBeTruthy();",
        filename: SPEC_FILENAME,
      },
      {
        name: "a link in the chain reached through a key decided at run time does not resolve to a modifier",
        code: "expect(subject)[modifier].toBeTruthy();",
        filename: SPEC_FILENAME,
      },
      {
        name: "the expect namespace carries utilities that are not matchers",
        code: "expect.extend({ toBeSettled });\nexpect.assertions(2);\nexpect.hasAssertions();",
        filename: SPEC_FILENAME,
      },
      {
        name: "a file that is not a spec is out of range, since expect is a name anything may carry there",
        code: "expect(subject).toBeTruthy();",
        filename: SOURCE_FILENAME,
      },
      {
        name: "an asymmetric matcher reached through a name is a violation this rule cannot see",
        code: "expect(save).toHaveBeenCalledWith(anyIdentifier);",
        filename: SPEC_FILENAME,
      },
      {
        name: "taking a matcher as a value without calling it is not an assertion",
        code: "const check = expect(subject).toBeTruthy;",
        filename: SPEC_FILENAME,
      },
      {
        name: "a member reached through a key decided at run time does not resolve to a matcher name",
        code: "expect(subject)[matcherName]();",
        filename: SPEC_FILENAME,
      },
      {
        name: "a matcher the repository exempts is left alone",
        code: "expect(subject).toContain('ada');",
        filename: SPEC_FILENAME,
        options: [{ allowedMatchers: ["toContain"] }],
      },
      {
        name: "an asymmetric matcher the repository exempts is left alone as well",
        code: "expect(subject).toStrictEqual(expect.any(Number));",
        filename: SPEC_FILENAME,
        options: [{ allowedMatchers: ["any"] }],
      },
      {
        name: "a repository that spells its specs differently takes this file out of range",
        code: "expect(subject).toBeTruthy();",
        filename: SPEC_FILENAME,
        options: [{ specFileSuffixes: [".spec.ts"] }],
      },
    ],
    invalid: [
      {
        name: "one matcher out of each family the rule forbids is reported",
        code: "expect(subject).toBeTruthy();\nexpect(subject).toEqual({ id: 1 });\nexpect(subject).toMatchObject({ id: 1 });\nexpect(subject).toContain(1);\nexpect(subject).toBeInstanceOf(Error);\nexpect(subject).toBeGreaterThan(1);\nexpect(subject).toThrow('boom');",
        filename: SPEC_FILENAME,
        errors: [
          { messageId: "weakMatcher" },
          { messageId: "weakMatcher" },
          { messageId: "weakMatcher" },
          { messageId: "weakMatcher" },
          { messageId: "weakMatcher" },
          { messageId: "weakMatcher" },
          { messageId: "weakMatcher" },
        ],
      },
      {
        name: "the rest of the forbidden roster is reported the same way",
        code: "expect(subject).toBeFalsy();\nexpect(subject).toBeDefined();\nexpect(subject).toBeNullable();\nexpect(subject).toHaveProperty('id', 1);\nexpect(subject).toHaveLength(2);\nexpect(subject).toContainEqual({ id: 1 });\nexpect(subject).toMatch(/ada/u);\nexpect(subject).toBeTypeOf('string');\nexpect(subject).toSatisfy(isEven);\nexpect(subject).toBeOneOf([1, 2]);\nexpect(subject).toBeGreaterThanOrEqual(1);\nexpect(subject).toBeLessThan(1);\nexpect(subject).toBeLessThanOrEqual(1);\nexpect(subject).toBeCloseTo(1.5);\nexpect(subject).toThrowError('boom');",
        filename: SPEC_FILENAME,
        errors: [
          { messageId: "weakMatcher" },
          { messageId: "weakMatcher" },
          { messageId: "weakMatcher" },
          { messageId: "weakMatcher" },
          { messageId: "weakMatcher" },
          { messageId: "weakMatcher" },
          { messageId: "weakMatcher" },
          { messageId: "weakMatcher" },
          { messageId: "weakMatcher" },
          { messageId: "weakMatcher" },
          { messageId: "weakMatcher" },
          { messageId: "weakMatcher" },
          { messageId: "weakMatcher" },
          { messageId: "weakMatcher" },
          { messageId: "weakMatcher" },
        ],
      },
      {
        name: "a negating modifier in front of the matcher changes nothing",
        code: "expect(subject).not.toBeTruthy();",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "weakMatcher" }],
      },
      {
        name: "a settlement modifier in front of the matcher changes nothing",
        code: "await expect(pending).resolves.toEqual({ id: 1 });\nawait expect(pending).rejects.toThrow();",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "weakMatcher" }, { messageId: "weakMatcher" }],
      },
      {
        name: "modifiers stacked on each other are peeled down to the same root",
        code: "await expect(pending).resolves.not.toBeDefined();",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "weakMatcher" }],
      },
      {
        name: "the soft entry point produces the same chain",
        code: "expect.soft(subject).toBeTruthy();",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "weakMatcher" }],
      },
      {
        name: "the polling entry point produces the same chain",
        code: "await expect.poll(read).toContain('ada');",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "weakMatcher" }],
      },
      {
        name: "reaching the matcher through a static string key resolves to the same name",
        code: "expect(subject)['toBeTruthy']();",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "weakMatcher" }],
      },
      {
        name: "reaching the matcher through a template without substitutions resolves to the same name",
        code: "expect(subject)[`toBeTruthy`]();",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "weakMatcher" }],
      },
      {
        name: "a non-null assertion on the chain leaves the assertion in place",
        code: "expect(subject)!.toBeTruthy();",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "weakMatcher" }],
      },
      {
        name: "an optional link in the chain leaves the assertion in place",
        code: "expect(subject)?.toBeTruthy();",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "weakMatcher" }],
      },
      {
        name: "parentheses around the chain leave the assertion in place",
        code: "(expect(subject)).toBeTruthy();",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "weakMatcher" }],
      },
      {
        name: "a type assertion on the subject leaves the assertion in place",
        code: "expect(subject as Order).toBeTruthy();",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "weakMatcher" }],
      },
      {
        name: "every asymmetric matcher written as a direct call on the expect namespace is reported",
        code: "expect(subject).toStrictEqual(expect.anything());\nexpect(subject).toStrictEqual(expect.any(Number));\nexpect(subject).toStrictEqual(expect.schemaMatching(schema));\nexpect(subject).toStrictEqual(expect.toSatisfy(isEven));\nexpect(subject).toStrictEqual(expect.toBeOneOf([1, 2]));\nexpect(subject).toStrictEqual(expect.objectContaining({ id: 1 }));\nexpect(subject).toStrictEqual(expect.arrayContaining([1]));\nexpect(subject).toStrictEqual(expect.stringContaining('ada'));\nexpect(subject).toStrictEqual(expect.stringMatching(/ada/u));\nexpect(subject).toStrictEqual(expect.closeTo(1.5));",
        filename: SPEC_FILENAME,
        errors: [
          { messageId: "weakAsymmetricMatcher" },
          { messageId: "weakAsymmetricMatcher" },
          { messageId: "weakAsymmetricMatcher" },
          { messageId: "weakAsymmetricMatcher" },
          { messageId: "weakAsymmetricMatcher" },
          { messageId: "weakAsymmetricMatcher" },
          { messageId: "weakAsymmetricMatcher" },
          { messageId: "weakAsymmetricMatcher" },
          { messageId: "weakAsymmetricMatcher" },
          { messageId: "weakAsymmetricMatcher" },
        ],
      },
      {
        name: "an asymmetric matcher nested inside an expected structure is reported where it stands",
        documented: true,
        code: "expect(save).toHaveBeenCalledWith({ id: expect.any(Number), spelled: expect.stringContaining('ada') });",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "weakAsymmetricMatcher" }, { messageId: "weakAsymmetricMatcher" }],
      },
      {
        name: "burying an asymmetric matcher deeper in the expected value does not put it out of reach",
        code: "expect(order).toStrictEqual({ lines: [{ tags: [expect.stringMatching(/ada/u)] }] });",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "weakAsymmetricMatcher" }],
      },
      {
        name: "an asymmetric matcher standing inside another asymmetric matcher is reported on its own",
        code: "expect(order).toStrictEqual(expect.objectContaining({ id: expect.any(Number) }));",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "weakAsymmetricMatcher" }, { messageId: "weakAsymmetricMatcher" }],
      },
      {
        name: "binding an asymmetric matcher to a name reports the call where it was written",
        code: "const anyIdentity = expect.any(Number);\nexpect(save).toHaveBeenCalledWith({ id: anyIdentity });",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "weakAsymmetricMatcher" }],
      },
      {
        name: "a matcher dedicated to a single value restates the exact comparison",
        documented: true,
        code: "expect(subject).toBeNull();\nexpect(subject).toBeUndefined();\nexpect(subject).toBeNaN();",
        filename: SPEC_FILENAME,
        errors: [
          { messageId: "restatedExactMatcher" },
          { messageId: "restatedExactMatcher" },
          { messageId: "restatedExactMatcher" },
        ],
      },
      {
        name: "a negated single value matcher restates the exact comparison as well",
        code: "expect(subject).not.toBeNull();",
        filename: SPEC_FILENAME,
        errors: [{ messageId: "restatedExactMatcher" }],
      },
      {
        name: "each assertion in a spec is reported on its own",
        code: "expect(first).toBeTruthy();\nexpect(second).toBeNull();\nexpect(third).toStrictEqual(expect.anything());",
        filename: SPEC_FILENAME,
        errors: [
          { messageId: "weakMatcher" },
          { messageId: "restatedExactMatcher" },
          { messageId: "weakAsymmetricMatcher" },
        ],
      },
      {
        name: "exempting one matcher leaves the rest of the roster forbidden",
        code: "expect(subject).toContain('ada');\nexpect(subject).toBeTruthy();",
        filename: SPEC_FILENAME,
        options: [{ allowedMatchers: ["toContain"] }],
        errors: [{ messageId: "weakMatcher" }],
      },
      {
        name: "a repository that spells its specs differently brings its own files into range",
        code: "expect(subject).toBeTruthy();",
        filename: "order.spec.ts",
        options: [{ specFileSuffixes: [".spec.ts"] }],
        errors: [{ messageId: "weakMatcher" }],
      },
    ],
  });
});
