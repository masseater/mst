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

A lint configuration naming only part of a rule set — a group of rules dividing one invariant between them. What is checked is the configuration itself rather than source code.

The set definitions are held by this package. There are two.

**single-assignment** (eight rules), dividing "the declaration settles the final value".

| Rule | The hole its absence opens | Type information |
| --- | --- | --- |
| no-reassign--use-spread-or-iife | Rebindable declarations and writes shaped as assignments pass through | Not needed |
| no-array-mutation--derive-new-array | Every mutation shaped as a method call on an array passes through | Needed |
| no-receiver-mutation--derive-new-value | Every mutation shaped as a method call on a map, a set, a date or a class of your own passes through | Needed |
| no-class-as-mutable-cell--decide-in-an-iife | Local mutable state rewrapped in a class passes through | Needed |
| no-promise-chain--use-async-await | Failure handling scatters across chains and enters no `catch` clause | Needed |
| no-floating-promise--await-the-result | A promise nobody waits for carries on having dropped its failure | Needed |
| no-blanket-suppression--name-and-record | A suppression naming no rule silences the whole set at once | Not needed |
| no-partial-rule-set--enable-the-whole-set | A configuration holding only part of a set passes through | Not needed |

**failure-routing** (four rules), dividing "a failure is always observed somewhere".

| Rule | The hole its absence opens | Type information |
| --- | --- | --- |
| no-promise-chain--use-async-await | Failure handling scatters across chains and enters no `catch` clause | Needed |
| no-empty-catch--throw-or-handle | A `catch` clause holding not one statement passes through | Not needed |
| no-silent-catch--rethrow-or-handle | A `catch` clause recording the failure nowhere passes through | Not needed |
| no-floating-promise--await-the-result | A promise nobody waits for carries on having dropped its failure | Needed |

Two rules belong to both sets. Complete one set and, where the other has a gap, one report stands per set.

What is read is every object whose `rules` key points at an object literal. **There is no narrowing by file name.** Inside `lint` in `vite.config.ts`, and inside a configuration preset a package ships, both enter the same way in. A block naming not one rule of a set reports nothing, so another kind of object merely carrying a `rules` key never comes into scope.

One `rules` object is treated as one configuration layer, and reconciliation closes inside it. The `rules` of an `overrides` element is a layer of its own.

Four shapes are reported.

**1. A layer naming only part of a set.** With even one rule named, the whole set has to stand in the same layer. The missing rule names, and the holes their absence opens, are listed in the report. The severity is not read. Turning one off and leaving the rest untouched falls here too, because the one turned off is the one that left the set.

**2. A layer where the severity is not aligned across the set.** Even with everyone named, the report stands unless the value is one. `error` / `deny` / 2 read as one level, `warn` / 1 as one, and `off` / `allow` / 0 as one. For the `[level, options]` form the head is read, and for a member of a named constant the member name. The report stands on the weaker side.

**3. A layer whose severity this rule cannot read.** A set rule holding an unresolvable expression such as a variable. Treat an unreadable value as aligned and shape 2 is evaded by moving the value outside the configuration.

**4. A layer placed on a runtime without type information.** Some rules of a set do not hold without type information. A layer naming those at anything but `off` is reported unless `options.typeAware` is written as `true` in the same configuration. The judgment reads whether that layer itself, or any object enclosing it, writes it. A layer inside `overrides` receives the declaration the outer configuration wrote.

Names are matched after the last `/`, so a spelling with `dont-review-it/` and one without name the same rule.

### The invariant

The first layer is that the rules of a set stand in a division of labour that means nothing alone. `no-reassign--use-spread-or-iife` takes the assignment shape without reading types and hands method-call shapes to `no-array-mutation--derive-new-array` and `no-receiver-mutation--derive-new-value`. `no-promise-chain--use-async-await` gathers failure handling into `catch` clauses and hands checking their contents to the two failure-routing rules. In a configuration where the receiver is disabled, the handing side has merely declared that it does not detect that shape. A division is a division only on the premise that everyone is present.

The second layer is that writing this condition as a note in each rule's document makes whoever wrote the configuration responsible for it, with nobody confirming it was kept. A configuration file sits in the repository and can be walked. There is no reason to entrust to human attention what can be walked.

The third layer is that partial adoption is not a weaker version of the discipline. Under a configuration where only part is enabled, a writer learns the shape the machine does not stop. The learnt detour either erupts as a mass of violations when everyone is later enabled, or stays as the default. Both leave the state worse than adding nothing at all.

Whether type information is required is read from the runtime's configuration because writing the precondition in a document alone lets a configuration placing a set on an untyped runtime pass silently. Under that configuration, the rules that read types report nothing and it goes green.

### Configuration

None.

Give this rule options and they become the way in for permitting partial adoption through configuration. A shape letting the set definition be rewritten from the configuration side, and one letting exclusion ranges be given from there, are refused for the same reason.

There is no automatic fix either. There are two directions for aligning — "enable the disabled ones" and "disable the enabled ones" — and which to take is the judgment of whether to adopt the discipline at all. That is not a machine's to settle.

Type information is not needed.

### Where the detection does not reach

A configuration reached through `extends` is not read. Reconciliation closes inside one `rules` block. So the layer shipping the defaults and the layer receiving them are checked separately. Where the receiving side wants to pass options to one rule of a set, it too lines the whole set up at the same severity in that layer. It looks redundant, and it leaves a state where reading that layer alone shows the set is complete.

Rule names assembled at run time are not read. A block using a template literal or a variable as a key cannot be settled on which rule it names, so it does not count as naming a set member. A plugin registering its own rules in bulk takes this shape.

Conversely, where a plugin writes rule names as string literals under `rules` with rule implementations as the values, this rule sees a configuration naming part of a set. The implementation cannot be read as a severity, so shape 3 comes out too. Writing it with the rule object's `name` as a computed key keeps that text out of this rule's way in.

A severity given as a CLI argument, configuration written in JSON or YAML, and an operation that never starts the linter do not enter this rule's input. Holding the same invariant on those hosts needs a separate receiver.

Whether type information is present is read only from `options.typeAware` being written as `true`. That spelling is vite-plus's lint option. Where another host passes type information under another spelling, this rule sees an untyped runtime.

Which rules go into a set is written by a person. The soundness of the definition itself sits outside this rule.

## Fix

Two directions, with nothing in between.

**Enable everyone.** Write the whole set in the same `rules` block at the same severity. Where the set holds rules that read types, write `options.typeAware: true` in the same configuration. This is the default.

**Disable everyone.** The decision not to adopt a set is outside this rule. A layer lining everyone up at `off` is not reported.

To set an exclusion range, give the whole set the same range: add one `overrides` entry and line the whole set up under its `files`. The soundness of the range is each rule's own decision; this rule reads only whether the set is aligned.

Where part of a set cannot be introduced for reasons at the destination, decide not to introduce any of it. Report the reason itself, as material for reconsidering the set's definition.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a configuration naming one rule of a set is reported with the rules it leaves out
export default { lint: { rules: { "no-reassign--use-spread-or-iife": "error" } } };
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Nominally enabling part of a set at the weakest severity. Shape 2 reports it
- Enabling part of a set through an `overrides` that excludes almost every file. That `overrides` holds only part of the set, so shape 1 reports it
- Escaping the severity into a variable outside the configuration file. Shape 3 reports it
- Splitting the set across two configuration files so each holds part. Reconciliation runs per layer, so both are reported
- Silencing this rule itself with a general lint-disabling comment. `no-blanket-suppression--name-and-record` reports it
- Removing a rule from the set definition to make it look aligned. The definition lives inside this package and cannot be moved from a configuration

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
