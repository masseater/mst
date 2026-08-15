---
description: "Disallow any lint suppression that fails to name its rule, to stop at the one statement below it, to carry its grounds, or to stand against a row in the repository ledger, so what a run has stopped saying and whose name it was stopped under can be read off the source alone"
---

# no-blanket-suppression--name-and-record

<!-- BEGIN GENERATED rule-header -->

Disallow any lint suppression that fails to name its rule, to stop at the one statement below it, to carry its grounds, or to stand against a row in the repository ledger, so what a run has stopped saying and whose name it was stopped under can be read off the source alone

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: no
- Shipped in the preset: yes
- Source: [`no-blanket-suppression--name-and-record.ts`](../../src/lint/oxlint/rules/no-blanket-suppression--name-and-record.ts)

<!-- END GENERATED rule-header -->

## Violation

A suppression comment failing any of four conditions, and a ledger row that no longer stands.

- It names no rule
- It takes a scope other than the one statement below it, so anything but the next-line spelling
- It carries no grounds after `--`. Grounds repeating the rule name, or reading only as "false positive", count as none
- The repository ledger holds no row naming that path, that rule, the grounds and whoever approved them, or the row it holds leaves one of those empty

Read from the lint configuration file, a row naming a path this repository no longer holds, and a row whose file no longer carries the suppression, are reported as well.

## Fix

Rewrite the code the rule reports. Where the report is wrong, correct the condition that produced it.

Where a suppression genuinely has to stand, write it as `oxlint-disable-next-line` above the one statement it covers, name the rule, state the grounds after `--`, and add the matching row to the ledger.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a whole-file directive naming no rule is reported for naming none
// oxlint-disable
element.total = 1;
```

```ts
// a directive the ledger does not record is reported for the missing row
// oxlint-disable-next-line no-reassign--use-spread-or-iife -- the platform interface writes the total back into the element
element.total = 1;
```

Code this rule accepts.

```ts
// a rule name carrying its plugin prefix reaches the row that names it bare
// oxlint-disable-next-line dont-review-it/no-reassign--use-spread-or-iife -- the platform interface writes the total back into the element
element.total = 1;
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Writing grounds that name the rule again, or that say only "false positive". Neither reads as grounds
- Adding the ledger row and leaving a column empty. An incomplete row is reported
- Widening the suppression to a range so one comment covers several statements

## Messages

<!-- BEGIN GENERATED messages -->

This rule declares no message of its own. A report carries the rule name alone.

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads no options. A consumer turns it on or off as a whole.

<!-- END GENERATED runtime -->
