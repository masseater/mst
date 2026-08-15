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
- Bundle: `governance`
- Source: [`no-unregistered-rule-plugin--enable-the-plugin.ts`](../../src/lint/oxlint/rules/governance/no-unregistered-rule-plugin--enable-the-plugin.ts)

<!-- END GENERATED rule-header -->

## Violation

A lint configuration naming a rule of a plugin while that plugin stands outside every plugin list the configuration hands out. The rule resolves to nothing, so the discipline it carries is absent while the entry still reads as enforcement.

`plugins` adds plugin names the configuration is taken to enable.

## Fix

Add the plugin to the plugin list that configuration hands out, or delete the rule entry.

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

- Leaving the entry in place because it is harmless. An entry that resolves to nothing reads as a rule that runs

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
