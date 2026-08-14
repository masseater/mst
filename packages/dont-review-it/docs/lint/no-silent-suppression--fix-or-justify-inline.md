---
description: "Require every report from the rules that keep one declaration in one place to end in a repair, a registered deviation, or a suppression that carries its grounds, so what the linter stops saying is a decision somebody wrote down"
---

# no-silent-suppression--fix-or-justify-inline

<!-- BEGIN GENERATED rule-header -->

Require every report from the rules that keep one declaration in one place to end in a repair, a registered deviation, or a suppression that carries its grounds, so what the linter stops saying is a decision somebody wrote down

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: yes
- Shipped in the preset: yes
- Source: [`no-silent-suppression--fix-or-justify-inline.ts`](../../src/lint/oxlint/rules/no-silent-suppression--fix-or-justify-inline.ts)

<!-- END GENERATED rule-header -->

## Violation

A report from the rule group protecting "no declaration stands in two places" disappearing without being fixed. Only three ways of disappearing are allowed; every other way is reported.

The allowed ways are fixing it, listing it in the deviation register that rule holds, and placing a line-scoped suppression carrying a reason.

The set of rules in scope is held by `guardedRules`. The default is nine, this rule included, and the default lives in the rule itself.

Two families are read.

**Suppression directives.** In any file, comments whose opening token belongs to the `eslint-disable` / `oxlint-disable` families are read. The list of rule names after the token, and the reason after a `--` surrounded by whitespace, are taken out, and these shapes are reported.

- A line-scoped suppression (`oxlint-disable-next-line` / `oxlint-disable-line` and their `eslint-` spellings) covering a guarded rule and carrying no reason
- A suppression holding wider than a line (`oxlint-disable` / `eslint-disable`) covering a guarded rule. Reported even where a reason is written
- A suppression naming this rule itself. Reported even line-scoped, even with a reason

Whether it covers is settled by the rule names listed. A suppression listing no rule name covers every rule and therefore covers the guarded ones. Listed names are matched after the last `/`, so a spelling with `dont-review-it/` and one without name the same rule. A suppression covering not one guarded rule passes as somebody else's business.

**The linter's configuration.** Only files whose name starts with `vite.config` and whose extension is `.ts`, `.mts`, `.cts`, `.js`, `.mjs` or `.cjs` are additionally read as configuration. The walk descends to the default-exported expression, and where that is wrapped in a function call, to its first argument. The value of `lint` is unwrapped the same way, so a configuration wrapped in `dontReviewItPreset.lint(...)` has its contents visible through this route.

Three things are read from there.

- Guarded rules written in `rules` and `overrides[].rules` sitting at a level that does not fail a run: `off`, `allow`, `warn`, and numbers below 2. For the `[level, options]` form the head is read. Written as a member of a named constant such as `LINT_SEVERITY.OFF`, the member name is read as the level
- Strings in `ignorePatterns` carrying no segment naming a region listed in `excludedRegions`
- Strings in `ignorePatterns` reaching a forbidden path registered in `forbiddenPaths`

The last two are settled by reconciling configuration against configuration: both the definition of regions that may be excluded and the set registered as forbidden paths are written in the configuration. Only the configuration's current state is used; no comparison with a previous state is needed.

### The invariant

The first layer is that a suppression is cheaper than fixing the violation. For whoever received the report, a suppression takes one line, while consolidating or registering a deviation demands a design judgment. Before a deadline the cheaper one gets chosen.

The second layer is that suppressed code drops out of every rule's sight afterwards. The violation is not absent but invisible, and the invisibility is itself invisible. A narrow detection range can be learnt by reading the range; what a suppression removed is indistinguishable from a report count of zero.

The third layer is that suppression is a way out shared by every rule. However thoroughly each rule closes its own bypasses, an unchecked suppression takes them all off in one line. So one rule is placed to receive suppressions, and that place is closed.

Asking for a reason is not for reducing suppressions but for making them readable. With a reason written, somebody looking later can evaluate it. Without one, it stays with no material to evaluate.

A suppression holding over a whole file is reported even with a reason because it erases, ahead of time, not only the violations standing there now but the violations to be written later. Whoever wrote it can evaluate only the former; a reason about the latter cannot exist.

A suppression of this rule itself does not pass because it voids the prohibition on suppression in one move. Let it through and this rule may as well not exist.

### Configuration

- `guardedRules` (a list of strings, optional): the set of rule names whose reports may not disappear. The default is the eight protecting "no declaration stands in two places" plus this rule, nine in all
- `excludedRegions` (a list of strings, optional): the names of regions that may be excluded from the walk. A specification in the ignore settings is divided into "a definition of the population" and "a suppression" by reconciling against this definition. The default is `.git`, `node_modules`, `dist`, `coverage`
- `forbiddenPaths` (a list of strings, optional): the set of paths the file mechanism registered as forbidden. The default is empty

```jsonc
["error", { "excludedRegions": [".git", "node_modules", "dist", "coverage", "generated"] }]
```

There is no list of "rules that may be silenced". Hold one and partial adoption of the discipline starts there.

There is no way in for choosing the reason's format either. The position is fixed to directly above the target line, and the separator to one form — a `--` surrounded by whitespace. With several formats, a reader has to settle which one was used before reading.

### Where the detection does not reach

A configuration reached through `extends`, a level given as a CLI argument, and an operation that never starts the linter are all invisible from reading `vite.config` alone. What falls here is not detected, and it is not permitted.

### Its relationship with the upstream rule of the same kind

`no-broad-lint-disable--use-next-line-with-reason` in [@mst/lint-rule-authoring](../../../lint-rule-authoring/src/lint/oxlint/rules/no-broad-lint-disable--use-next-line-with-reason.ts) reports the spelling of any suppression holding wider than a line, whatever the rule. This rule reads whether a guarded rule's report has disappeared. Both can fire on one comment, and the overlap is intended: the former settles how a suppression is written, the latter whether it is permissible.

## Fix

Fix it. That is the first option.

Where there is a reason it cannot be fixed, list it in the deviation register that rule holds. When listing, write both why it is needed and what would let it be removed — the condition for keeping a deviation something with a plan to disappear. The canonical-values rule's deviation list and the file mechanism's allow list are those registers.

Only where neither is available, place a line-scoped suppression carrying a reason. The format is `// oxlint-disable-next-line <rule name> -- <reason>`, placed directly above the one target line. Write in the reason why that place is an exception: what makes that one line different from the others, and what would have to happen for that circumstance to disappear.

The order is the same for reports about the configuration. Rather than lowering a level to get through, repair the reported code; where it cannot be repaired, register a deviation. Where a region put in the ignore settings is a build product, a fetched dependency or a version control internal, that is a definition of the population rather than a suppression, so update the definition by adding the region name to `excludedRegions`.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a next-line suppression of a guarded rule without grounds is reported
// oxlint-disable-next-line no-duplicate-exported-type--reuse-authoritative-type
export type Cart = { readonly total: number };
```

```ts
// a whole-file suppression of a guarded rule is reported even with grounds
/* oxlint-disable no-duplicate-exported-type--reuse-authoritative-type -- the generator writes both copies */
export type Cart = { readonly total: number };
```

Code this rule accepts.

```ts
// a next-line suppression carrying grounds is the path this rule leaves open
// oxlint-disable-next-line no-duplicate-exported-type--reuse-authoritative-type -- the generator writes both copies from one schema
export type Cart = { readonly total: number };
```

```ts
// a suppression naming only rules outside the guarded set is another rule's business
// oxlint-disable-next-line no-console
console.log(1);
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Writing an empty string in the reason field to satisfy the form. A rule name alone, or "false positive" alone, is not treated as a reason; a plausible-looking but empty string cannot be told apart by a machine. What gets evaluated by a reader is the reason's contents, not whoever wrote it
- Lowering a guarded rule's severity to a level that reports without failing, and operating by ignoring the reports. Levels written in the configuration are read, but one lowered through an argument to `vp lint` leaves no trace in the configuration
- Moving the offending file to a path that looks like an excluded region of the population. Only the destination looks like a build product; not one line of code has been fixed
- Escaping levels or ignore patterns into a variable outside the configuration file. This rule reports nothing where the expression cannot be read, so what escapes there leaves the judgment. Write levels and ignore patterns directly in the configuration file
- Moving them into a configuration reached through `extends`, or into a configuration file under another spelling. What this rule reads is the current state of one file starting with `vite.config`
- Taking a guarded rule out of `guardedRules` to get through. The moment it is out, that rule's reports can be made to disappear silently

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `groundlessSuppression` | A \`{{spelling}}\` comment covering {{covered}} must not stand without grounds. Rewrite the code that rule reports, register the deviation in the list that rule keeps, or write after \`--\` what makes this line an exception. |
| `wholeFileSuppression` | A \`{{spelling}}\` comment covering {{covered}} must not reach past the line below it. Rewrite the code that rule reports, register the deviation in the list that rule keeps, or replace this comment with \`oxlint-disable-next-line\` above the one line, naming the rule and writing its grounds after \`--\`. |
| `selfSuppression` | A suppression naming \`{{ruleName}}\` must not stay in the source. Rewrite the code the covered rule reports, or register the deviation in the list that rule keeps. |
| `weakenedRule` | A lint configuration must not hold \`{{ruleName}}\` at \`{{severity}}\`, a level that leaves a run green. Set it to \`error\`, rewrite the code that rule reports, or register the deviation in the list that rule keeps. |
| `undeclaredIgnoredRegion` | An ignore pattern must not name \`{{pattern}}\`, a place outside the regions this repository excludes from the walk. Delete the pattern and rewrite the code it hides, or declare the region in the definition this configuration receives. |
| `ignoredForbiddenPath` | An ignore pattern must not cover \`{{forbiddenPath}}\`, a path registered as forbidden. Delete the pattern, and delete that file or move it to the place its owner spelledNames. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
