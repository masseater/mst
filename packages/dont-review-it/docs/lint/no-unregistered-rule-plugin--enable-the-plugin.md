---
description: "Disallow a lint configuration naming a rule of a plugin that no plugin list it can reach enables, so a rule left standing on a dropped plugin is reported instead of resolving to nothing"
---

# no-unregistered-rule-plugin--enable-the-plugin

<!-- BEGIN GENERATED rule-header -->

Disallow a lint configuration naming a rule of a plugin that no plugin list it can reach enables, so a rule left standing on a dropped plugin is reported instead of resolving to nothing

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: yes
- Shipped in the preset: yes
- Source: [`no-unregistered-rule-plugin--enable-the-plugin.ts`](../../src/lint/oxlint/rules/no-unregistered-rule-plugin--enable-the-plugin.ts)

<!-- END GENERATED rule-header -->

## Violation

A rule named by the lint configuration in the form `plugin/rule` whose plugin is enabled nowhere.

Three routes count as enabling a plugin: the plugin names handed to this rule's options, the strings in a `plugins` array written in the same file, and the `name` of each entry of a `jsPlugins` written in the same file. A rule whose plugin appears in none of the three is reported.

A block of rules is recognised through two routes: the object held by an object's `rules` property, and the initialiser of a declaration annotated with a type reaching `OxlintConfig["rules"]`. The second exists because this repository keeps the upstream rule block outside the configuration object, and what sits in that position is read as the same block.

A rule whose severity is `off` is not reported. Turning something off needs no plugin.

### The invariant

A configuration that names a rule is actually running that rule.

In oxlint, the list of enabled plugins and the list of rules given a severity are separate declarations. Dropping one leaves the other grammatically valid. The rule names left behind disappear at resolution, and nothing happens at run time.

Measured in this repository: removing the single `import` line from `UPSTREAM_PLUGINS` made the five rules `UPSTREAM_RULES` names at `error` — `import/default`, `import/export`, `import/namespace`, `import/no-named-as-default` and `import/no-named-as-default-member` — disappear from the resolved configuration. The resolved rule count went from 255 to 250, the exit status stayed zero, and no warning was printed.

What disappeared is indistinguishable from "there were no violations". That is exactly the shape [the enforcement guideline](../../../docs/guidelines/enforcement.md) rules out when it says a check that did not run is not counted as a success, and as long as the declaration is split across two places, a change removing one side passes without dropping anything visible.

The decision to stop this with a lint rule rather than a type or a verification command, and the limits accepted in doing so, are in [EDR 0056](../../../docs/engineering-decision-logs/0056-report-the-rule-whose-plugin-no-list-enables.md).

### What is not a violation

- A rule whose severity is `off`
- A built-in rule carrying no plugin prefix, such as `eqeqeq`
- A rule name written as a computed key. What it points at is not settled there
- A block assembled from spreads alone. No rule name is written there
- A plain object that nothing refers to as `rules`

### Configuration

`plugins` takes the plugin names this configuration enables. It defaults to empty, in which case the `plugins` and `jsPlugins` written in the file are the only grounds for being enabled.

In this repository the preset hands over `UPSTREAM_PLUGINS` and its own js plugin names as they stand. A name leaving that list leaves the option with it, so the names keep one origin.

## Fix

Choose one: enable the plugin, or remove the rule.

To run the rule, add the plugin name to that file's `plugins`. Where the configuration is handed down from a preset, add it to the plugin list the preset carries.

Where the rule was never meant to run, remove the rule name. Keeping it at severity `off` is for when you want to tell whoever reads the configuration that it was turned off deliberately.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a rule of a plugin nothing enables is reported
export const config = { rules: { "vitest/no-focused-tests": "error" } };
```

```ts
// a rule kept at warn still asks for its plugin
export const config = { rules: { "import/default": "warn" } };
```

Code this rule accepts.

```ts
// a plugin list beside the rules enables the plugin
export const config = { plugins: ["vitest"], rules: { "vitest/no-focused-tests": "error" } };
```

```ts
// a rule turned off asks for no plugin
export const config = { rules: { "vitest/no-focused-tests": "off" } };
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Writing the list of enabled plugins into the options by hand, separately from the declaration that actually enables them. The names then have two origins, and a plugin dropped from the real list stops being reported. Hand the options the very declaration that enables the plugins
- Setting a rule you do mean to run to `off` to clear the report
- Rewriting the rule name as a computed key so it cannot be read there
- A suppression directive

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `unregisteredRulePlugin` | A lint configuration must not name \`{{ruleName}}\` while the \`{{plugin}}\` plugin stands outside every plugin list it hands out. Add \`{{plugin}}\` to that plugin list, or delete the rule. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
