import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { noLintSuppressionInSpec } from "./no-lint-suppression-in-spec--fix-the-violation.ts";

const ASSERTION = 'it("adds", () => {\n  expect(runSut()).toBe(3);\n});';

const BUNDLE_RULE = "forbid-weak-matcher--use-exact-matcher";

const SECOND_BUNDLE_RULE = "require-it-only-expect--move-setup-into-fixture";

const SELF_RULE = "no-lint-suppression-in-spec--fix-the-violation";

const EVERY_RULE_REACHING_HERE = "every rule this file is checked by";

const spelled = (ruleName: string): string => `\`${ruleName}\``;

describe("dont-review-it/no-lint-suppression-in-spec--fix-the-violation", () => {
  testLintRule(noLintSuppressionInSpec, {
    valid: [
      { name: "a spec carrying no comment passes", code: ASSERTION },
      {
        name: "a comment that opens with no directive is another rule's business",
        code: `// the total the checkout screen reads\n${ASSERTION}`,
      },
      {
        name: "a line direction to the type checker is not a lint suppression",
        code: `// @ts-ignore the parse rejects this shape\nconst row = readRow(1);`,
      },
      {
        name: "a whole-file direction to the type checker is not a lint suppression either",
        code: `// @ts-nocheck\n${ASSERTION}`,
      },
      {
        name: "a comment whose opening token is no suppression spelling passes",
        code: `// hush-lint ${BUNDLE_RULE}\n${ASSERTION}`,
      },
      {
        name: "a shebang is not a suppression comment",
        code: `#!/usr/bin/env node\n${ASSERTION}`,
      },
      {
        name: "a mock factory exemption is a registration the rule reading it owns",
        code: '// mock-factory-exemption no-vi-mock-factory-behavior--use-spy-true-and-fixture -- this spec replaces the child module boundary\nvi.mock("./child.ts", () => ({ read: vi.fn() }));',
      },
      {
        name: "prose naming a directive spelling past the opening token passes",
        code: `// this spec used to carry an oxlint-disable comment\n${ASSERTION}`,
      },
    ],
    invalid: [
      {
        name: "a next-line suppression naming a rule is reported and deleted",
        code: `// oxlint-disable-next-line ${BUNDLE_RULE}\n${ASSERTION}`,
        errors: [
          {
            messageId: "namedSuppression",
            data: { spelling: "oxlint-disable-next-line", silenced: spelled(BUNDLE_RULE) },
          },
        ],
        output: `\n${ASSERTION}`,
      },
      {
        name: "grounds written after the separator leave the suppression standing",
        code: `// oxlint-disable-next-line ${BUNDLE_RULE} -- the matcher reads a floating clock\n${ASSERTION}`,
        errors: [
          {
            messageId: "namedSuppression",
            data: { spelling: "oxlint-disable-next-line", silenced: spelled(BUNDLE_RULE) },
          },
        ],
        output: `\n${ASSERTION}`,
      },
      {
        name: "a same-line suppression is reported and deleted",
        code: `expect(runSut()).toBe(3); // oxlint-disable-line ${BUNDLE_RULE}`,
        errors: [
          {
            messageId: "namedSuppression",
            data: { spelling: "oxlint-disable-line", silenced: spelled(BUNDLE_RULE) },
          },
        ],
        output: "expect(runSut()).toBe(3); ",
      },
      {
        name: "a whole-file suppression naming no rule is reported as covering the whole set",
        code: `/* oxlint-disable */\n${ASSERTION}`,
        errors: [
          {
            messageId: "blanketSuppression",
            data: { spelling: "oxlint-disable", silenced: EVERY_RULE_REACHING_HERE },
          },
        ],
        output: `\n${ASSERTION}`,
      },
      {
        name: "a whole-file suppression naming a rule is reported too",
        code: `/* oxlint-disable ${BUNDLE_RULE} */\n${ASSERTION}`,
        errors: [
          {
            messageId: "namedSuppression",
            data: { spelling: "oxlint-disable", silenced: spelled(BUNDLE_RULE) },
          },
        ],
        output: `\n${ASSERTION}`,
      },
      {
        name: "a next-line suppression naming no rule is reported as covering the whole set",
        code: `// oxlint-disable-next-line\n${ASSERTION}`,
        errors: [
          {
            messageId: "blanketSuppression",
            data: { spelling: "oxlint-disable-next-line", silenced: EVERY_RULE_REACHING_HERE },
          },
        ],
        output: `\n${ASSERTION}`,
      },
      {
        name: "the eslint spelling of a suppression is reported the same way",
        code: `// eslint-disable-next-line dont-review-it/${BUNDLE_RULE}\n${ASSERTION}`,
        errors: [
          {
            messageId: "namedSuppression",
            data: {
              spelling: "eslint-disable-next-line",
              silenced: spelled(`dont-review-it/${BUNDLE_RULE}`),
            },
          },
        ],
        output: `\n${ASSERTION}`,
      },
      {
        name: "a suppression naming two rules stands as one comment to delete",
        code: `// oxlint-disable-next-line ${BUNDLE_RULE}, ${SECOND_BUNDLE_RULE}\n${ASSERTION}`,
        errors: [
          {
            messageId: "namedSuppression",
            data: {
              spelling: "oxlint-disable-next-line",
              silenced: `${spelled(BUNDLE_RULE)}, ${spelled(SECOND_BUNDLE_RULE)}`,
            },
          },
        ],
        output: `\n${ASSERTION}`,
      },
      {
        name: "a suppression naming this rule is reported like any other",
        code: `// oxlint-disable-next-line ${SELF_RULE}\n${ASSERTION}`,
        errors: [
          {
            messageId: "namedSuppression",
            data: { spelling: "oxlint-disable-next-line", silenced: spelled(SELF_RULE) },
          },
        ],
        output: `\n${ASSERTION}`,
      },
      {
        name: "a suppression reaching no report is residue and is reported",
        code: `// oxlint-disable-next-line ${BUNDLE_RULE}\nconst total = 1;`,
        errors: [
          {
            messageId: "namedSuppression",
            data: { spelling: "oxlint-disable-next-line", silenced: spelled(BUNDLE_RULE) },
          },
        ],
        output: "\nconst total = 1;",
      },
      {
        name: "the closing end of a suppression range is reported on its own",
        code: `${ASSERTION}\n/* oxlint-enable ${BUNDLE_RULE} */`,
        errors: [{ messageId: "suppressionRangeEnd", data: { spelling: "oxlint-enable" } }],
        output: `${ASSERTION}\n`,
      },
      {
        name: "both ends of a suppression range are reported and deleted",
        code: `/* oxlint-disable ${BUNDLE_RULE} */\n${ASSERTION}\n/* eslint-enable ${BUNDLE_RULE} */`,
        errors: [
          {
            messageId: "namedSuppression",
            data: { spelling: "oxlint-disable", silenced: spelled(BUNDLE_RULE) },
          },
          { messageId: "suppressionRangeEnd", data: { spelling: "eslint-enable" } },
        ],
        output: `\n${ASSERTION}\n`,
      },
    ],
  });
});
