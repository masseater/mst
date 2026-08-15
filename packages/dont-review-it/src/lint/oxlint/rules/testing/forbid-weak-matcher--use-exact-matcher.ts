import { createDontReviewItRule } from "../../../../create-rule.ts";
import {
  isAssertionChain,
  isAssertionEntryReference,
} from "../../lib/spec-syntax/assertion-entries.ts";
import {
  CANONICAL_SPELLING_BY_REDUNDANT_MATCHER,
  EXACT_MATCHERS,
  UNVERIFIED_REGION_BY_WEAK_ASYMMETRIC_MATCHER,
  UNVERIFIED_REGION_BY_WEAK_MATCHER,
} from "../../lib/spec-syntax/matcher-vocabulary.ts";
import { isSpecFile, specFileSuffixesFrom } from "../../lib/spec-syntax/spec-files.ts";
import { staticMemberName } from "../../lib/spec-syntax/static-names.ts";
import { unwrapSubject } from "../../lib/spec-syntax/subject-expressions.ts";

import type { ESTree, Options } from "@oxlint/plugins";
import type { RuleMessage } from "../../lib/rule-message.ts";

const spelledMatcherOf = (call: string): string => call.slice(0, call.indexOf("("));

const exactRestatements: ReadonlyMap<string, string> = new Map(
  [...CANONICAL_SPELLING_BY_REDUNDANT_MATCHER].filter(([, writeInstead]) =>
    EXACT_MATCHERS.has(spelledMatcherOf(writeInstead)),
  ),
);

const ALLOWED_MATCHERS_OPTION = "allowedMatchers";

const allowedMatchersFrom = (ruleOptions: Readonly<Options>): ReadonlySet<string> => {
  const [first] = ruleOptions;
  if (typeof first !== "object" || first === null || Array.isArray(first)) return new Set();

  const configured = first[ALLOWED_MATCHERS_OPTION];
  if (!Array.isArray(configured)) return new Set();
  return new Set(
    configured.filter((candidate): candidate is string => typeof candidate === "string"),
  );
};

const asymmetricReportFor = (matcher: string): RuleMessage | null => {
  const unverified = UNVERIFIED_REGION_BY_WEAK_ASYMMETRIC_MATCHER.get(matcher);
  if (unverified === undefined) return null;
  return { messageId: "weakAsymmetricMatcher", data: { matcher, unverified } };
};

const chainReportFor = (matcher: string): RuleMessage | null => {
  const unverified = UNVERIFIED_REGION_BY_WEAK_MATCHER.get(matcher);
  if (unverified !== undefined) return { messageId: "weakMatcher", data: { matcher, unverified } };

  const writeInstead = exactRestatements.get(matcher);
  if (writeInstead === undefined) return null;
  return { messageId: "restatedExactMatcher", data: { matcher, writeInstead } };
};

const reportFor = (callee: ESTree.MemberExpression, matcher: string): RuleMessage | null => {
  if (isAssertionEntryReference(callee.object)) return asymmetricReportFor(matcher);
  if (!isAssertionChain(callee.object)) return null;
  return chainReportFor(matcher);
};

export const forbidWeakMatcher = createDontReviewItRule({
  name: "forbid-weak-matcher--use-exact-matcher",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow a matcher that reads only part of the value or the shape of its subject inside a spec file, so an assertion passes only for a subject that equals what the spec says it must equal",
      relatedGuidelines: [],
    },
    messages: {
      weakMatcher:
        "An assertion must not reach its subject through `{{matcher}}`. This matcher reads a projection of the subject and leaves unverified {{unverified}}, so the assertion keeps passing after the value it was written for has decayed into a different one. Replace it with `toBe` against the value the subject has to equal, or with `toStrictEqual` against the structure it has to equal. Put a seam in front of a clock, a random source or a generated identifier, make that value deterministic, and keep the comparison exact. Splitting this assertion into one assertion per interesting field is forbidden as a repair: every field nobody names stays unverified.",
      weakAsymmetricMatcher:
        "An expected value must not hand part of itself to `expect.{{matcher}}(...)`. This asymmetric matcher leaves unverified {{unverified}} inside an expression that still reads as an exact comparison. Write the value that has to be there. Put a seam in front of a clock, a random source or a generated identifier and make that value deterministic. Binding this call to a name and burying it deeper in the expected value are forbidden as repairs: the report lands on the call wherever it is written.",
      restatedExactMatcher:
        "An assertion must not spell an exact comparison as `{{matcher}}()`. The two exact matchers `toBe` and `toStrictEqual` are the whole vocabulary a value assertion has, and a second spelling of one of them forces every reader to carry the knowledge that both mean the same thing. Write `{{writeInstead}}`.",
    },
    schema: [
      {
        type: "object",
        properties: {
          allowedMatchers: { type: "array", items: { type: "string" } },
          specFileSuffixes: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
  },
  create(inspection) {
    if (!isSpecFile(inspection.filename, specFileSuffixesFrom(inspection.options))) return {};

    const allowedMatchers = allowedMatchersFrom(inspection.options);

    return {
      CallExpression(node: ESTree.CallExpression) {
        const callee = unwrapSubject(node.callee);
        if (callee.type !== "MemberExpression") return;

        const matcher = staticMemberName(callee);
        if (matcher === null || allowedMatchers.has(matcher)) return;

        const report = reportFor(callee, matcher);
        if (report === null) return;
        inspection.report({ node: callee.property, ...report });
      },
    };
  },
});
