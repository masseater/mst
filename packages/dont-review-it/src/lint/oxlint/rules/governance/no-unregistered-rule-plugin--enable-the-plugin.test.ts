import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { noUnregisteredRulePlugin } from "./no-unregistered-rule-plugin--enable-the-plugin.ts";

const ENABLES_VITEST = [{ plugins: ["vitest"] }];

const ENABLES_NOTHING = [{ plugins: [] }];

describe("dont-review-it/no-unregistered-rule-plugin--enable-the-plugin", () => {
  testLintRule(noUnregisteredRulePlugin, {
    valid: [
      {
        name: "a rule of a plugin the options enable is registered",
        code: 'export const config = { rules: { "vitest/no-focused-tests": "error" } };',
        options: ENABLES_VITEST,
      },
      {
        name: "a plugin list beside the rules enables the plugin",
        documented: true,
        code: 'export const config = { plugins: ["vitest"], rules: { "vitest/no-focused-tests": "error" } };',
        options: ENABLES_NOTHING,
      },
      {
        name: "a js plugin declared beside the rules enables its name",
        code: 'export const config = { jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }], rules: { "vite-plus/prefer-vite-plus-imports": "error" } };',
        options: ENABLES_NOTHING,
      },
      {
        name: "a plugin enabled in one object reaches the rules of another",
        code: 'export const plugins = { plugins: ["vitest"] };\nexport const config = { rules: { "vitest/no-focused-tests": "error" } };',
        options: ENABLES_NOTHING,
      },
      {
        name: "a rule carrying no plugin prefix stands on no plugin",
        code: 'export const config = { rules: { eqeqeq: "error" } };',
        options: ENABLES_NOTHING,
      },
      {
        name: "a rule turned off asks for no plugin",
        documented: true,
        code: 'export const config = { rules: { "vitest/no-focused-tests": "off" } };',
        options: ENABLES_NOTHING,
      },
      {
        name: "a rule silenced by the numeric spelling asks for no plugin",
        code: 'export const config = { rules: { "vitest/no-focused-tests": 0 } };',
        options: ENABLES_NOTHING,
      },
      {
        name: "a record declared as the rules of a configuration passes when the plugin is enabled",
        code: 'export const UPSTREAM_RULES: NonNullable<OxlintConfig["rules"]> = { "vitest/no-focused-tests": "error" };',
        options: ENABLES_VITEST,
      },
      {
        name: "an object that names no rules block is not a rules record",
        code: 'export const routes = { "vitest/no-focused-tests": "error" };',
        options: ENABLES_NOTHING,
      },
      {
        name: "a record declared under another indexed type is not a rules record",
        code: 'export const paths: NonNullable<OxlintConfig["overrides"]> = { "vitest/no-focused-tests": "error" };',
        options: ENABLES_NOTHING,
      },
      {
        name: "a record declared under another configuration type is not a rules record",
        code: 'export const paths: NonNullable<OtherConfig["rules"]> = { "vitest/no-focused-tests": "error" };',
        options: ENABLES_NOTHING,
      },
      {
        name: "a record declared under a type carrying no arguments is not a rules record",
        code: 'export const paths: OxlintConfig = { "vitest/no-focused-tests": "error" };',
        options: ENABLES_NOTHING,
      },
      {
        name: "a declaration typed as a keyword reaches no indexed access",
        code: "export const counted: number = 1;",
        options: ENABLES_NOTHING,
      },
      {
        name: "a destructured declaration carries no name to read a type off",
        code: 'export const { rules } = { rules: { "vitest/no-focused-tests": "error" } };',
        options: ENABLES_VITEST,
      },
      {
        name: "a rule reached through a computed key cannot be read as a rule name",
        code: 'export const config = { rules: { [named]: "error" } };',
        options: ENABLES_NOTHING,
      },
      {
        name: "a rules block spread in from elsewhere names no rule here",
        code: "export const config = { rules: { ...shared } };",
        options: ENABLES_NOTHING,
      },
      {
        name: "a rules key holding something other than an object declares no rules",
        code: 'export const config = { rules: "every" };',
        options: ENABLES_NOTHING,
      },
      {
        name: "a declaration carrying the rules type but no object literal declares no rules",
        code: 'export const UPSTREAM_RULES: NonNullable<OxlintConfig["rules"]> = shared;',
        options: ENABLES_NOTHING,
      },
      {
        name: "a plugin list holding something other than text enables nothing and asks for nothing",
        code: "export const config = { plugins: [named], rules: {} };",
        options: ENABLES_NOTHING,
      },
      {
        name: "a js plugin entry without a name enables nothing and asks for nothing",
        code: 'export const config = { jsPlugins: [{ specifier: "x" }, named], rules: {} };',
        options: ENABLES_NOTHING,
      },
      {
        name: "a rule handed no options at all is read with no plugin enabled and no rule named",
        code: "export const config = { rules: {} };",
      },
      {
        name: "options carrying no plugin list enable nothing and the file names nothing",
        code: "export const config = { rules: {} };",
        options: [{}],
      },
    ],
    invalid: [
      {
        name: "a rule of a plugin nothing enables is reported",
        documented: true,
        code: 'export const config = { rules: { "vitest/no-focused-tests": "error" } };',
        options: ENABLES_NOTHING,
        errors: [{ messageId: "unregisteredRulePlugin" }],
      },
      {
        name: "a record declared as the rules of a configuration is read the same way",
        code: 'export const UPSTREAM_RULES: NonNullable<OxlintConfig["rules"]> = { "import/default": "error" };',
        options: ENABLES_VITEST,
        errors: [{ messageId: "unregisteredRulePlugin" }],
      },
      {
        name: "the rules type named without the wrapper is read the same way",
        code: 'export const UPSTREAM_RULES: OxlintConfig["rules"] = { "import/default": "error" };',
        options: ENABLES_VITEST,
        errors: [{ messageId: "unregisteredRulePlugin" }],
      },
      {
        name: "a rule inside an override is reported",
        code: 'export const config = { overrides: [{ files: ["**/*.ts"], rules: { "import/default": "error" } }] };',
        options: ENABLES_VITEST,
        errors: [{ messageId: "unregisteredRulePlugin" }],
      },
      {
        name: "every rule left standing on a dropped plugin is reported",
        code: 'export const config = { rules: { "import/default": "error", "import/export": "error" } };',
        options: ENABLES_VITEST,
        errors: [{ messageId: "unregisteredRulePlugin" }, { messageId: "unregisteredRulePlugin" }],
      },
      {
        name: "a plugin enabled elsewhere does not cover a second unregistered plugin",
        code: 'export const config = { plugins: ["vitest"], rules: { "vitest/no-focused-tests": "error", "import/default": "error" } };',
        options: ENABLES_NOTHING,
        errors: [{ messageId: "unregisteredRulePlugin" }],
      },
      {
        name: "a rule kept at warn still asks for its plugin",
        documented: true,
        code: 'export const config = { rules: { "import/default": "warn" } };',
        options: ENABLES_VITEST,
        errors: [{ messageId: "unregisteredRulePlugin" }],
      },
    ],
  });
});
