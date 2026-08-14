import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { noSilentSuppression } from "./no-silent-suppression--fix-or-justify-inline.ts";

const GUARDED_RULE = "no-duplicate-exported-type--reuse-authoritative-type";

const SELF_RULE = "no-silent-suppression--fix-or-justify-inline";

const DECLARATION = "export type Cart = { readonly total: number };";

const CONFIG_FILE = "vite.config.ts";

describe("dont-review-it/no-silent-suppression--fix-or-justify-inline", () => {
  testLintRule(noSilentSuppression, {
    valid: [
      { name: "source that suppresses nothing passes", code: DECLARATION },
      {
        name: "a comment that opens with no directive is judged by another rule",
        code: `// the cart the checkout screen reads\n${DECLARATION}`,
      },
      {
        name: "re-enabling a rule is not a suppression",
        code: `// oxlint-enable ${GUARDED_RULE}\n${DECLARATION}`,
      },
      {
        name: "a registered deviation is one of the paths this rule leaves open",
        code: `// mock-factory-exemption ${GUARDED_RULE} -- the generator owns this copy\n${DECLARATION}`,
      },
      {
        name: "a next-line suppression carrying grounds is the path this rule leaves open",
        documented: true,
        code: `// oxlint-disable-next-line ${GUARDED_RULE} -- the generator writes both copies from one schema\n${DECLARATION}`,
      },
      {
        name: "a same-line suppression carrying grounds is left alone too",
        code: `${DECLARATION} // oxlint-disable-line ${GUARDED_RULE} -- the generator writes both copies`,
      },
      {
        name: "a suppression naming only rules outside the guarded set is another rule's business",
        documented: true,
        code: `// oxlint-disable-next-line no-console\nconsole.log(1);`,
      },
      {
        name: "a whole-file suppression naming only rules outside the guarded set passes",
        code: `// oxlint-disable no-console\nconsole.log(1);`,
      },
      {
        name: "a next-line suppression naming no rule passes once it carries grounds",
        code: `// oxlint-disable-next-line -- the generator writes both copies from one schema\n${DECLARATION}`,
      },
      {
        name: "a doc block that mentions a directive is not a directive",
        code: `/**\n * @see oxlint-disable\n */\n${DECLARATION}`,
      },
      {
        name: "a guarded rule held at the level that fails a run passes",
        code: `export default { lint: { rules: { "dont-review-it/${GUARDED_RULE}": "error" } } };`,
        filename: CONFIG_FILE,
      },
      {
        name: "a rule outside the guarded set may sit at any level",
        code: `export default { lint: { rules: { "no-console": "off" } } };`,
        filename: CONFIG_FILE,
      },
      {
        name: "ignore patterns naming the declared regions are the walk's own definition",
        code: `export default { lint: { ignorePatterns: ["**/dist/**", "node_modules", "coverage/**"] } };`,
        filename: CONFIG_FILE,
      },
      {
        name: "a lint configuration this rule cannot read holds nothing to report",
        code: "export default { test: { coverage: {} } };",
        filename: CONFIG_FILE,
      },
      {
        name: "a file that is not the lint configuration is read for its comments alone",
        code: `export default { lint: { rules: { "dont-review-it/${GUARDED_RULE}": "off" } } };`,
        filename: "rules-snapshot.ts",
      },
      {
        name: "a rule taken out of the guarded set by the options is no longer covered",
        code: `// oxlint-disable-next-line ${GUARDED_RULE}\n${DECLARATION}`,
        options: [{ guardedRules: ["forbid-target-file--delete-or-relocate"] }],
      },
      {
        name: "a region declared by the options is part of the walk's definition",
        code: `export default { lint: { ignorePatterns: ["**/generated/**"] } };`,
        filename: CONFIG_FILE,
        options: [{ excludedRegions: ["generated"] }],
      },
      {
        name: "an ignore pattern that reaches no registered forbidden path passes",
        code: `export default { lint: { ignorePatterns: ["**/dist/**"] } };`,
        filename: CONFIG_FILE,
        options: [{ forbiddenPaths: ["legacy/settings.json"] }],
      },
    ],
    invalid: [
      {
        name: "a next-line suppression of a guarded rule without grounds is reported",
        documented: true,
        code: `// oxlint-disable-next-line ${GUARDED_RULE}\n${DECLARATION}`,
        errors: [
          {
            messageId: "groundlessSuppression",
            data: {
              spelling: "oxlint-disable-next-line",
              covered: `\`${GUARDED_RULE}\``,
            },
          },
        ],
      },
      {
        name: "grounds spelled as the rule name alone are no grounds",
        code: `// eslint-disable-next-line ${GUARDED_RULE} -- ${GUARDED_RULE}\n${DECLARATION}`,
        errors: [{ messageId: "groundlessSuppression" }],
      },
      {
        name: "grounds spelled as a claim of a wrong report are no grounds",
        code: `// oxlint-disable-next-line ${GUARDED_RULE} -- false positive\n${DECLARATION}`,
        errors: [{ messageId: "groundlessSuppression" }],
      },
      {
        name: "a same-line suppression of a guarded rule without grounds is reported",
        code: `${DECLARATION} // oxlint-disable-line ${GUARDED_RULE}`,
        errors: [{ messageId: "groundlessSuppression" }],
      },
      {
        name: "a next-line suppression naming no rule and carrying no grounds covers everything",
        code: `// oxlint-disable-next-line\n${DECLARATION}`,
        errors: [
          {
            messageId: "groundlessSuppression",
            data: {
              spelling: "oxlint-disable-next-line",
              covered: "every rule this package enforces",
            },
          },
        ],
      },
      {
        name: "a bare whole-file suppression is reported even though it names no rule",
        code: `// oxlint-disable\n${DECLARATION}`,
        errors: [
          {
            messageId: "wholeFileSuppression",
            data: { spelling: "oxlint-disable", covered: "every rule this package enforces" },
          },
        ],
      },
      {
        name: "a whole-file suppression of a guarded rule is reported even with grounds",
        documented: true,
        code: `/* oxlint-disable ${GUARDED_RULE} -- the generator writes both copies */\n${DECLARATION}`,
        errors: [
          {
            messageId: "wholeFileSuppression",
            data: { spelling: "oxlint-disable", covered: `\`${GUARDED_RULE}\`` },
          },
        ],
      },
      {
        name: "the eslint spelling of a whole-file suppression is reported the same way",
        code: `// eslint-disable ${GUARDED_RULE}\n${DECLARATION}`,
        errors: [{ messageId: "wholeFileSuppression" }],
      },
      {
        name: "a suppression naming this rule is reported even with grounds",
        code: `// oxlint-disable-next-line dont-review-it/${SELF_RULE} -- the whole file is generated\n${DECLARATION}`,
        errors: [{ messageId: "selfSuppression", data: { ruleName: SELF_RULE } }],
      },
      {
        name: "a whole-file suppression naming this rule is reported as naming it",
        code: `// oxlint-disable ${SELF_RULE}\n${DECLARATION}`,
        errors: [{ messageId: "selfSuppression" }],
      },
      {
        name: "each suppression in a file is reported on its own",
        code: `// oxlint-disable-next-line ${GUARDED_RULE}\n${DECLARATION}\n// oxlint-disable-next-line ${GUARDED_RULE}\nexport type Order = { readonly total: number };`,
        errors: [{ messageId: "groundlessSuppression" }, { messageId: "groundlessSuppression" }],
      },
      {
        name: "a guarded rule turned off in the configuration is reported",
        code: `export default { lint: { rules: { "dont-review-it/${GUARDED_RULE}": "off" } } };`,
        filename: CONFIG_FILE,
        errors: [
          {
            messageId: "weakenedRule",
            data: { ruleName: `dont-review-it/${GUARDED_RULE}`, severity: "off" },
          },
        ],
      },
      {
        name: "a guarded rule lowered to a warning inside an override is reported",
        code: `export default { lint: { overrides: [{ files: ["apps/**"], rules: { "${GUARDED_RULE}": "warn" } }] } };`,
        filename: CONFIG_FILE,
        errors: [{ messageId: "weakenedRule", data: { ruleName: GUARDED_RULE, severity: "warn" } }],
      },
      {
        name: "a guarded rule lowered inside the call that wraps the lint block is reported",
        code: `export default { lint: withGitExcludes({ rules: { "${GUARDED_RULE}": ["off", {}] } }) };`,
        filename: CONFIG_FILE,
        errors: [{ messageId: "weakenedRule" }],
      },
      {
        name: "an ignore pattern naming a place outside the declared regions is reported",
        code: `export default { lint: { ignorePatterns: ["**/dist/**", "packages/legacy/**"] } };`,
        filename: CONFIG_FILE,
        errors: [{ messageId: "undeclaredIgnoredRegion", data: { pattern: "packages/legacy/**" } }],
      },
      {
        name: "an ignore pattern covering a registered forbidden path names that path",
        code: `export default { lint: { ignorePatterns: ["**/dist/**"] } };`,
        filename: CONFIG_FILE,
        options: [{ forbiddenPaths: ["packages/cart/dist/settings.json"] }],
        errors: [
          {
            messageId: "ignoredForbiddenPath",
            data: { forbiddenPath: "packages/cart/dist/settings.json" },
          },
        ],
      },
    ],
  });
});
