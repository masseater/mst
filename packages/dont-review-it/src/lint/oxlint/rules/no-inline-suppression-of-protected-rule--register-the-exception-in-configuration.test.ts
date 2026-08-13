import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { noInlineSuppressionOfProtectedRule } from "./no-inline-suppression-of-protected-rule--register-the-exception-in-configuration.ts";

const PROTECTED_RULE = "forbid-target-file--delete-or-relocate";

const SECOND_PROTECTED_RULE = "forbid-tracked-path--untrack-and-ignore";

const SELF_RULE =
  "no-inline-suppression-of-protected-rule--register-the-exception-in-configuration";

const DECLARATION = "export const total = 1;";

const CONFIG_FILE = "vite.config.ts";

describe("dont-review-it/no-inline-suppression-of-protected-rule--register-the-exception-in-configuration", () => {
  testLintRule(noInlineSuppressionOfProtectedRule, {
    valid: [
      { name: "source that suppresses nothing passes", code: DECLARATION },
      {
        name: "a comment that opens with no directive is left alone",
        code: `// the total the checkout screen reads\n${DECLARATION}`,
      },
      {
        name: "re-enabling a rule is not a suppression",
        code: `// oxlint-enable ${PROTECTED_RULE}\n${DECLARATION}`,
      },
      {
        name: "a suppression naming only rules outside the protected set is another rule's business",
        code: `// oxlint-disable-next-line no-console -- the bootstrap has no logger yet\nconsole.log(1);`,
      },
      {
        name: "a suppression inside a build output path is outside the authored surface",
        code: `// oxlint-disable-next-line ${PROTECTED_RULE}\n${DECLARATION}`,
        filename: "packages/cart/dist/settings.ts",
      },
      {
        name: "a suppression inside a declaration file is outside the authored surface",
        code: `// oxlint-disable-next-line ${PROTECTED_RULE}\n${DECLARATION}`,
        filename: "packages/cart/src/settings.d.ts",
      },
      {
        name: "a path the options name as generated is outside the authored surface too",
        code: `// oxlint-disable-next-line ${PROTECTED_RULE}\n${DECLARATION}`,
        filename: "packages/cart/schema/settings.ts",
        options: [{ generatedPaths: ["**/schema/**"] }],
      },
      {
        name: "a deviation carrying grounds takes its rule out of the protected set",
        code: `// oxlint-disable-next-line ${PROTECTED_RULE}\n${DECLARATION}`,
        options: [
          { unprotected: [{ rule: PROTECTED_RULE, reason: "the registry owns this path list" }] },
        ],
      },
      {
        name: "a comment whose opening token is no known suppression spelling passes",
        code: `// hush-lint ${PROTECTED_RULE}\n${DECLARATION}`,
      },
      {
        name: "a protected rule held at the level that fails a run passes",
        code: `export default { lint: { rules: { "dont-review-it/${PROTECTED_RULE}": "error" } } };`,
        filename: CONFIG_FILE,
      },
      {
        name: "a rule outside the protected set may sit at any level",
        code: `export default { lint: { rules: { "no-console": "off" } } };`,
        filename: CONFIG_FILE,
      },
      {
        name: "an override listing the complete path of every file it covers is the registered exception",
        code: `export default { lint: { overrides: [{ files: ["packages/cart/src/settings.ts", "apps/site/src/entry.ts"], rules: { "${PROTECTED_RULE}": "off" } }] } };`,
        filename: CONFIG_FILE,
      },
      {
        name: "a lint configuration this rule cannot read holds nothing to report",
        code: "export default { test: { coverage: {} } };",
        filename: CONFIG_FILE,
      },
      {
        name: "a file that is not the lint configuration is read for its comments alone",
        code: `export default { lint: { rules: { "${PROTECTED_RULE}": "off" } } };`,
        filename: "rules-snapshot.ts",
      },
      {
        name: "a deviation carrying grounds is a registration this rule leaves standing",
        code: `export default { lint: { rules: {} } };`,
        filename: CONFIG_FILE,
        options: [
          { unprotected: [{ rule: PROTECTED_RULE, reason: "the registry owns this path list" }] },
        ],
      },
    ],
    invalid: [
      {
        name: "a next-line suppression naming a protected rule is reported",
        code: `// oxlint-disable-next-line ${PROTECTED_RULE}\n${DECLARATION}`,
        errors: [
          {
            messageId: "namedSuppression",
            data: { spelling: "oxlint-disable-next-line", ruleName: PROTECTED_RULE },
          },
        ],
      },
      {
        name: "grounds do not make a suppression of a protected rule acceptable",
        code: `// oxlint-disable-next-line ${PROTECTED_RULE} -- the generator writes this file\n${DECLARATION}`,
        errors: [{ messageId: "namedSuppression" }],
      },
      {
        name: "a same-line suppression naming a protected rule is reported",
        code: `${DECLARATION} // oxlint-disable-line ${PROTECTED_RULE}`,
        errors: [{ messageId: "namedSuppression" }],
      },
      {
        name: "a whole-file suppression naming a protected rule is reported",
        code: `/* oxlint-disable ${PROTECTED_RULE} */\n${DECLARATION}`,
        errors: [
          {
            messageId: "namedSuppression",
            data: { spelling: "oxlint-disable", ruleName: PROTECTED_RULE },
          },
        ],
      },
      {
        name: "the eslint spelling of a suppression is reported the same way",
        code: `// eslint-disable-next-line dont-review-it/${PROTECTED_RULE}\n${DECLARATION}`,
        errors: [
          {
            messageId: "namedSuppression",
            data: { spelling: "eslint-disable-next-line", ruleName: PROTECTED_RULE },
          },
        ],
      },
      {
        name: "a suppression naming two protected rules is reported once for each",
        code: `// oxlint-disable-next-line ${PROTECTED_RULE}, ${SECOND_PROTECTED_RULE}\n${DECLARATION}`,
        errors: [
          {
            messageId: "namedSuppression",
            data: { spelling: "oxlint-disable-next-line", ruleName: PROTECTED_RULE },
          },
          {
            messageId: "namedSuppression",
            data: { spelling: "oxlint-disable-next-line", ruleName: SECOND_PROTECTED_RULE },
          },
        ],
      },
      {
        name: "a suppression naming this rule is reported like any other protected rule",
        code: `// oxlint-disable-next-line ${SELF_RULE} -- the whole file is generated\n${DECLARATION}`,
        errors: [
          {
            messageId: "namedSuppression",
            data: { spelling: "oxlint-disable-next-line", ruleName: SELF_RULE },
          },
        ],
      },
      {
        name: "a next-line suppression naming no rule covers the protected set",
        code: `// oxlint-disable-next-line\n${DECLARATION}`,
        errors: [
          { messageId: "blanketSuppression", data: { spelling: "oxlint-disable-next-line" } },
        ],
      },
      {
        name: "a bare whole-file suppression covers the protected set as well",
        code: `// oxlint-disable\n${DECLARATION}`,
        errors: [{ messageId: "blanketSuppression", data: { spelling: "oxlint-disable" } }],
      },
      {
        name: "a spelling the options add is read as a suppression",
        code: `// hush-lint ${PROTECTED_RULE}\n${DECLARATION}`,
        options: [{ suppressionSpellings: ["hush-lint"] }],
        errors: [
          {
            messageId: "namedSuppression",
            data: { spelling: "hush-lint", ruleName: PROTECTED_RULE },
          },
        ],
      },
      {
        name: "a rule the options add to the protected set is covered by it",
        code: `// oxlint-disable-next-line no-console\nconsole.log(1);`,
        options: [{ protectedRules: ["no-console"] }],
        errors: [
          {
            messageId: "namedSuppression",
            data: { spelling: "oxlint-disable-next-line", ruleName: "no-console" },
          },
        ],
      },
      {
        name: "a protected rule turned off in the configuration is reported",
        code: `export default { lint: { rules: { "dont-review-it/${PROTECTED_RULE}": "off" } } };`,
        filename: CONFIG_FILE,
        errors: [
          {
            messageId: "weakenedProtectedRule",
            data: { ruleName: `dont-review-it/${PROTECTED_RULE}`, severity: "off" },
          },
        ],
      },
      {
        name: "an exception scoped by a pattern is not a registered exception",
        code: `export default { lint: { overrides: [{ files: ["packages/*/dist/**"], rules: { "${PROTECTED_RULE}": "warn" } }] } };`,
        filename: CONFIG_FILE,
        errors: [
          {
            messageId: "patternScopedException",
            data: { ruleName: PROTECTED_RULE, severity: "warn", pattern: "packages/*/dist/**" },
          },
        ],
      },
      {
        name: "an override that names no file it covers is not a registered exception",
        code: `export default { lint: { overrides: [{ rules: { "${PROTECTED_RULE}": "off" } }] } };`,
        filename: CONFIG_FILE,
        errors: [{ messageId: "weakenedProtectedRule" }],
      },
      {
        name: "an override whose files this rule cannot read is not a registered exception",
        code: `export default { lint: { overrides: [{ files: [chosenPath], rules: { "${PROTECTED_RULE}": "off" } }] } };`,
        filename: CONFIG_FILE,
        errors: [{ messageId: "weakenedProtectedRule" }],
      },
      {
        name: "an override that keeps its file list elsewhere is not a registered exception",
        code: `export default { lint: { overrides: [{ files: chosenPaths, rules: { "${PROTECTED_RULE}": "off" } }] } };`,
        filename: CONFIG_FILE,
        errors: [{ messageId: "weakenedProtectedRule" }],
      },
      {
        name: "a deviation without grounds is reported where the configuration stands",
        code: `export default { lint: { rules: {} } };`,
        filename: CONFIG_FILE,
        options: [{ unprotected: [{ rule: PROTECTED_RULE, reason: "  " }] }],
        errors: [{ messageId: "groundlessDeviation", data: { ruleName: PROTECTED_RULE } }],
      },
      {
        name: "a deviation without grounds leaves its rule protected",
        code: `// oxlint-disable-next-line ${PROTECTED_RULE}\n${DECLARATION}`,
        options: [{ unprotected: [{ rule: PROTECTED_RULE }] }],
        errors: [
          {
            messageId: "namedSuppression",
            data: { spelling: "oxlint-disable-next-line", ruleName: PROTECTED_RULE },
          },
        ],
      },
      {
        name: "a deviation naming this rule is reported and leaves this rule protected",
        code: `// oxlint-disable-next-line ${SELF_RULE}\n${DECLARATION}`,
        filename: CONFIG_FILE,
        options: [
          { unprotected: [{ rule: SELF_RULE, reason: "this repository writes its own rules" }] },
        ],
        errors: [
          {
            messageId: "namedSuppression",
            data: { spelling: "oxlint-disable-next-line", ruleName: SELF_RULE },
          },
          { messageId: "selfDeviation", data: { ruleName: SELF_RULE } },
        ],
      },
    ],
  });
});
