---
description: "Require a configuration naming any rule of a declared set to name the whole set at one severity in one scope on a run carrying the type information those rules read, so a set stands whole or stands nowhere"
---

# no-partial-rule-set--enable-the-whole-set

<!-- BEGIN GENERATED rule-header -->

Require a configuration naming any rule of a declared set to name the whole set at one severity in one scope on a run carrying the type information those rules read, so a set stands whole or stands nowhere

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: no
- Shipped in the preset: yes
- Source: [`no-partial-rule-set--enable-the-whole-set.ts`](../../src/lint/oxlint/rules/no-partial-rule-set--enable-the-whole-set.ts)

<!-- END GENERATED rule-header -->

## Violation

A lint configuration block naming part of a declared rule set. Five reports, each naming the hole the missing or weakened rule leaves.

- A block naming one rule of a set and leaving others out
- An override taking part of a set out of scope while the rest keeps the wider one
- A set held at more than one severity
- A severity on a set member this rule cannot read
- A run carrying no type information hosting a set member that reads types

The sets themselves are declared in this package, each member carrying the hole it covers.

## Fix

Name every rule of the set in the same block, at one severity and one scope, or name none of them. Where a member reads types, set `options.typeAware` to `true` in that configuration.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a configuration naming one rule of a set is reported with the rules it leaves out
export default { lint: { rules: { "no-reassign--use-spread-or-iife": "error" } } };
```

```ts
// a rule belonging to two sets is reported once for each set it splits
export default { lint: { rules: { "no-promise-chain--use-async-await": "off" } } };
```

Code this rule accepts.

```ts
// a rules block naming only rules outside every set is another rule's business
export default { lint: { rules: { "no-console": "error", "max-params": ["error", { max: 2 }] } } };
```

```ts
// a rule name a configuration assembles at run time names no rule of a set
export default { lint: { rules: { [chosenRule]: "off" } } };
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Lowering one member to `warn` and calling the set milder. The weaker rule leaves its hole open
- Narrowing one member with an override while the others keep the wider scope
- Writing the severity behind a variable so it cannot be read

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `PARTIAL_RULE_SET_MESSAGE_ID` | A lint configuration must not hold part of the \`{{ruleSet}}\` rule set. This block names \`{{namedRule}}\` and leaves out {{missingRules}}, and each rule left out opens a hole: {{holes}}. Name every rule of the set in this block at one severity, or name none of them. Part of a set is not a milder discipline, it is the look of one laid over the holes it leaves. |
| `SCOPED_PARTIAL_RULE_SET_MESSAGE_ID` | An override must not take part of the \`{{ruleSet}}\` rule set out of scope. It covers {{scope}}, names \`{{namedRule}}\`, and leaves out {{missingRules}}, leaving those paths with the holes: {{holes}}. Give every rule of the set the same scope in this override, or delete the override. Part of a set is not a milder discipline, it is the look of one laid over the paths it covers. |
| `UNEVEN_SEVERITY_MESSAGE_ID` | A lint configuration must not hold the \`{{ruleSet}}\` rule set at more than one severity. \`{{ruleName}}\` sits at \`{{severity}}\` and \`{{matchedRule}}\` sits at \`{{matchedSeverity}}\`, and the weaker of the two leaves a hole: {{hole}}. Raise \`{{ruleName}}\` to \`{{matchedSeverity}}\`, or lower every rule of the set to one severity. A set split across two severities is not a milder discipline, it is the look of one laid over the half nobody has to obey. |
| `UNREADABLE_SEVERITY_MESSAGE_ID` | A severity this rule cannot read must not stand on \`{{ruleName}}\`, a rule of the \`{{ruleSet}}\` set. Write the severity of every rule of the set as a literal in this block, or name none of them. |
| `TYPELESS_RULE_SET_HOST_MESSAGE_ID` | A run carrying no type information must not host \`{{ruleName}}\`, a rule of the \`{{ruleSet}}\` set that reads types. Set \`options.typeAware\` to \`true\` in this configuration, or take every rule of the set out of it. A typeless run leaves that rule reporting nothing, and this hole stays open: {{hole}}. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads no options. A consumer turns it on or off as a whole.

<!-- END GENERATED runtime -->
