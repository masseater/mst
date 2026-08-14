---
description: "Disallow taking a rule of the parallel determinism gate out of a run through a suppression comment, a lowered severity, or an ignore entry, leaving the code the rule stands on as the only place a report ends"
---

# no-rule-suppression--fix-the-violation

<!-- BEGIN GENERATED rule-header -->

Disallow taking a rule of the parallel determinism gate out of a run through a suppression comment, a lowered severity, or an ignore entry, leaving the code the rule stands on as the only place a report ends

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: yes
- Shipped in the preset: yes
- Source: [`no-rule-suppression--fix-the-violation.ts`](../../src/lint/oxlint/rules/no-rule-suppression--fix-the-violation.ts)

<!-- END GENERATED rule-header -->

## Violation

Text taking the rules that protect the determinism of parallel execution (below, "this gate") off by any means other than repairing what the spec wrote. Four routes are in scope.

### 1. Suppression comments

Comments are read lexically, and those whose opening token is a spelling that directs a lint suppression are read.

| The suppression's range | Spelling | Report |
| --- | --- | --- |
| That line | `oxlint-disable-line` / `eslint-disable-line` | `lineScopedSuppression` |
| The next line | `oxlint-disable-next-line` / `eslint-disable-next-line` | `lineScopedSuppression` |
| The whole file, and the start of a range | `oxlint-disable` / `eslint-disable` | `fileScopedSuppression` |
| The end of a range | `oxlint-enable` / `eslint-enable` | `suppressionRangeEnd` |

Whether it is reported is settled by whether the directive covers a rule of the target set.

- Where it lists rule names and one of them belongs to this gate, it is reported wherever it stands. Writing the name is itself proof that the rule reaches that file
- Where it lists no rule name, its range covers "every rule that checks that file". Then only those placed in a file this gate reads (a spec file, or a lint configuration file) are reported
- Where it lists rule names and none belongs to this gate, it is not reported

Grounds written after `--` do not change the report. Condition it on grounds and a route stays open where writing a reason lets it through.

### 2. A rule's severity in the configuration

Object literals carrying `rules` are read, and the severity of entries whose name belongs to this gate is read.

| The severity written | Handling |
| --- | --- |
| `error` / `deny` / `2` or above | Not reported |
| `off` / `allow` / `0` / `warn` / `1` | `weakenedRule` |
| Any of the above inside an ancestor carrying `files` | `scopedWeakenedRule` (the covered paths ride along) |
| A value not readable as a literal | `unreadableSeverity` |

The judgment does not condition on the file name. An object carrying `rules` takes the same shape in the runner's own configuration file, in a shared configuration it loads, and in a per-package override. That is why all three are read through one route without following imports. Only entries whose name belongs to this gate get a reaction, so an object using the name `rules` for something else is not swept in.

An unreadable severity is reported because assembling the value elsewhere and handing it over builds the state where "reading the configuration does not say whether this gate is running". This gate is not a declared rule set, so [no-partial-rule-set--enable-the-whole-set](./no-partial-rule-set--enable-the-whole-set.md) does not read here.

### 3. Configuration narrowing what is walked

Where an ignore pattern in the runner's configuration covers a spec file in the working tree, `ignoredSpecFile` is reported. The pattern and the paths actually covered ride along in the report.

### 4. Configuration giving suppression comments their force back

Text setting `respectEslintDisableDirectives` to `true` is reported as `respectedDisableDirectives`.

This package's shared lint configuration keeps that value `false`. Suppression comments being disabled at the checker is exactly what lets route 1 report a comment. Set it back to `true` and suppression comments naming this gate's rules start working again — and route 1's own reports disappear with them. That is a route for taking every gate off without rewriting one rule name, so the route itself is reported.

### Deliberately not widened

| Shape | Why it is left out |
| --- | --- |
| A suppression listing only rules outside this gate | A different owner. This gate is not in its range |
| A comment opening with `mock-factory-exemption` | Not a suppression the lint runner interprets, but an exception registration one rule reads. Adding it does not take the invariant off |
| A directive to the type checker such as `@ts-nocheck` | Not a lint suppression |
| A suppression naming no rule, placed in a file this gate does not read | Not one rule of this gate runs in that file |
| Text enabling this gate's rules at `error` in the configuration | That is the gate standing |
| Narrowing the range a rule is enabled over to a tighter target pattern | Whether it was narrowed cannot be settled without reading the baseline configuration. Named below as a prohibition |
| Renaming the suppression spelling and registering the alias in the configuration | The registration appears on the configuration side. Adding a registration without lowering this gate's severities is named below as a prohibition |

### The invariant

The rules of this gate do not come off by any means other than repairing what the spec wrote.

The first layer is what the other rules of this gate read: each reads only the offending text inside a spec. The route of rewriting configuration and the route of placing a suppression comment can void the discipline without repairing one line of the offending text, and no rule that reads text alone reports them.

The second layer is how the state of being taken off looks afterwards. A suppressed violation does not appear in the check's output, so the route by which anybody notices it is gone. The violation itself stays in the output for whoever touches it next; a suppressed violation meets nobody's eye. That difference is what makes a suppression worse than a violation.

The third layer is what this gate protects. A test that breaks under parallel execution fails in a form that does not reproduce, and the only handle on a non-reproducing failure is the check's output. That is why erasing the route by which it is noticed costs more here than in other groups.

What this rule reports is that the gate is off, not the violation beyond it. Delete the suppression and the original rule reports its own violation.

### Configuration

Only the set of target rule names.

| Key | Type | Default |
| --- | --- | --- |
| `targetRules` | `string[]` | The names of every rule of this gate |

Names written are added to the default set. There is no shape for removing a name from the default, no specification emptying the set, and none replacing it with the names written. Make rules removable one at a time and this option is itself a suppression route.

Rule names are matched with the prefix dropped, so a spelling with `dont-review-it/` is the same name.

## Fix

Delete the suppression and repair the violation reported there. The fix is in each rule's document.

Where you judge the rule itself wrong as a discipline, change the rule's definition. Do not do it by taking it off case by case on the spec or the configuration side.

There is no automatic fix for deleting a suppression comment. Where one comment lists several rule names, deleting the comment deletes the suppression of rules outside this gate with it. Which names to keep is the writer's decision and does not settle mechanically.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// grounds written after the separator leave the report standing
// in packages/cart/src/basket.test.ts
// eslint-disable-next-line no-redundant-mock-reset--lift-mocks-into-fixture -- the shared setup lands later
export const total = 1;
```

```ts
// a configuration turning a gate rule off is reported
// in vite.config.ts
export default { lint: { rules: { "dont-review-it/no-redundant-mock-reset--lift-mocks-into-fixture": "off" } } };
```

Code this rule accepts.

```ts
// a suppression naming only a rule outside this gate is another rule's business
// in packages/cart/src/basket.test.ts
/* eslint-disable no-console */
export const total = 1;
```

```ts
// a configuration holding a gate rule at error passes
// in vite.config.ts
export default { lint: { rules: { "dont-review-it/no-redundant-mock-reset--lift-mocks-into-fixture": "error" } } };
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Suppressing this rule itself. The target set includes this rule, and text taking this rule off in the configuration is reported too
- Moving the spec outside what is walked to clear the report. Ignore patterns are in scope for exactly that reason
- Moving the offending text into a helper outside the spec and only calling it from the spec. Each rule closes that route individually; what this rule takes on is confirming that the range widened that way has not then been taken off in the configuration
- Assembling the severity value in another module and handing it over. An unreadable value is reported as `unreadableSeverity`
- Giving suppression comments their force back and silencing this gate from the comment side. The configuration side is reported as `respectedDisableDirectives`
- Tightening the target pattern this gate's rules are enabled over and putting the spec directory outside it. Not detected, because it cannot be judged without reading the baseline configuration
- Registering the suppression spelling as an alias on the lint configuration side and writing comments with the alias. A registered spelling appears on the configuration side

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `fileScopedSuppression` | A \`{{spelling}}\` comment must not stand over a file this gate reads. It takes {{silenced}} out of the run for every line of the file, and the invariants those rules carry go unchecked here. Delete the comment, then rewrite the code the reopened reports stand on. Rewrite the definition of a rule to change the discipline it carries. |
| `lineScopedSuppression` | A \`{{spelling}}\` comment must not stand in a file this gate reads. It takes {{silenced}} out of the run at the line it covers, and the invariants those rules carry go unchecked there. Delete the comment, then rewrite the code the reopened report stands on. Rewrite the definition of a rule to change the discipline it carries. |
| `suppressionRangeEnd` | A \`{{spelling}}\` comment must not stand in a file this gate reads. It closes a range that takes {{silenced}} out of the run, and the invariants those rules carry go unchecked across that range. Delete both ends of the range, then rewrite the code the reopened reports stand on. Rewrite the definition of a rule to change the discipline it carries. |
| `weakenedRule` | A lint configuration must not hold \`{{ruleName}}\`, a rule of the parallel determinism gate, at \`{{severity}}\`. This entry takes the rule out of every run, and the invariant it carries goes unchecked across the whole tree. Set this entry to \`error\`, then rewrite the code the rule reports. |
| `scopedWeakenedRule` | An override must not hold \`{{ruleName}}\`, a rule of the parallel determinism gate, at \`{{severity}}\` over {{scope}}. Those paths keep the code the rule reports and lose the report itself. Delete this entry, then rewrite the code the rule reports over those paths. |
| `unreadableSeverity` | A severity this rule cannot read must not stand on \`{{ruleName}}\`, a rule of the parallel determinism gate. A value assembled elsewhere hides the level this gate runs at. Write the severity of this entry as the literal \`error\`. |
| `respectedDisableDirectives` | A lint configuration must not hand the suppression comments of a run back their force. Every comment naming a rule of the parallel determinism gate starts taking that rule out of the run again. Set this entry to \`false\`, then delete the comments it was standing for. |
| `ignoredSpecFile` | An ignore entry must not cover a file this gate reads. \`{{pattern}}\` covers \`{{matchedPath}}\`, an authored spec file, and every rule of the gate stops reporting over it. Narrow that pattern to the generated paths it stands for, or delete it and rewrite the code the gate reports. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
