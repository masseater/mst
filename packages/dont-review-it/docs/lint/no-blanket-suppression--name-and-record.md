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

A comment that stops a linter's detection where what was stopped, why, or who approved it cannot be read by a machine. Every suppression comment enters, whatever rule it names.

Exactly one shape of suppression is accepted, meeting all four conditions at once. Missing any one of them is reported.

1. It names the rules it stops
2. It is spelled `oxlint-disable-next-line` or `eslint-disable-next-line`, covering the one statement below it
3. Grounds are written after `--`
4. `approved-lint-suppressions.json` at the repository root carries one row holding that file's path, that rule, the grounds and an approver

Two things are read.

**Suppression directives.** In every file, comments whose first token is in the `eslint-disable` or `oxlint-disable` family are read. For one comment the four conditions are checked in order, and the first one missing raises one report.

- Naming no rule at all. Whether spelled for the whole file or for the next line, naming nothing is reported, because no record survives of what was stopped
- Naming a rule while the spelling covers the whole file or the same line. It is reported even with grounds beside it: once the cover exceeds one statement, violations that arrive later fall silent along with it
- Carrying no grounds. No `--`, whitespace after `--`, a restatement of the rule name, and `false positive` or the like all fail to count as grounds
- Carrying no row in the ledger. One report per rule the directive names. A row that is there but leaves `grounds` or `approver` empty does not stand as a record

**The approval ledger.** Only when reading a file whose name starts with `vite.config` and whose extension is one of `.ts`, `.mts`, `.cts`, `.js`, `.mjs`, `.cjs`, the reconciliation also runs from the ledger's side: the file each row names is read to see whether the directive that row stands for is still there.

- A row naming a path where no file exists
- A row whose file exists but no longer carries a directive naming that rule

A row left behind creates a state where the approval outlives the suppression, and whoever next writes a suppression in that place is accepted without anyone's judgment.

Rule names are matched after the last `/`, so a spelling carrying `dont-review-it/` and one without point at the same rule. Ledger paths are written relative to the repository root.

A suppression naming this rule itself is held to the same four conditions. Treating itself specially would make that the way around.

### The invariant

A hole in suppression runs deeper than a hole in a detection condition. A hole in a detection condition bites on one syntactic shape; a hole in suppression bites on every rule uniformly. However many rules are added, if one disable comment naming nothing silences them all, everything added is void.

Expecting "generic disables are not accepted" from the linter's behaviour leaves no way to notice when the expectation is wrong. Whether a given disable comment bites on an individual rule is implementation-dependent and cannot be observed from a rule's side. So instead of asking whether it bites, what is reported is that such a comment is written in the source at all. Not written, and whether it bites has no effect on the outcome.

Putting the approval in a review conversation or a ticket's state makes it unobservable to a machine. What cannot be observed cannot be a condition of acceptance and survives as a procedure on the operations side, which depends on whoever reads that diff on that day knowing the procedure. Putting the ledger inside the repository closes the reconciliation of directives against records inside the walk. This does not mechanise the act of approving; it moves where the record of approval sits to somewhere observable.

Grounds beside the directive are not enough, because grounds are read only around that line. A ledger row appears as a diff in a shared part of the repository, and whose name settled it stays there.

### Where detection does not reach

Reconciliation from the ledger's side runs only when reading `vite.config`. In an operation that never points the linter at that file, rows left behind go unreported.

Whether a row is still live is judged by reading the comments of the file it names. A directive spelling written inside a string literal makes the row count as live. That error runs in the direction of fewer reports.

Configuration written in JSON or YAML, and the suppression formats used there, are not part of the input.

Where the ledger is loaded from is fixed to one place at the repository root. It cannot be split per workspace.

### How it overlaps other rules reading the same comment

Up to four rules including this one can fire on one suppression comment. The overlap is intended and the strictest conclusion is what stands.

[no-silent-suppression--fix-or-justify-inline](no-silent-suppression--fix-or-justify-inline.md) forbids the reports of the rules keeping one declaration in one place from disappearing quietly, and leaves a line-level suppression carrying grounds as the way out. This rule demands a ledger row on top, so a suppression that passed there can stop here.

[no-inline-suppression-of-protected-rule--register-the-exception-in-configuration](no-inline-suppression-of-protected-rule--register-the-exception-in-configuration.md) lets no suppression of a rule registered as protected through, grounds and ledger or not. For a rule in its scope, meeting these four conditions still does not let the suppression stand.

`no-broad-lint-disable--use-next-line-with-reason` in `@mst/lint-rule-authoring` reports the spellings that bite wider than a line, whatever the rule. It overlaps this rule's `wideSuppression` on the same comment.

### Configuration

None.

Carrying a condition such as "in this directory, disables naming nothing are allowed" as a setting would put that directory outside this discipline: adoption in parts, which stops the bundle standing. Where the ledger lives is fixed for the same reason — a choosable location is a route for taking the ledger outside the walk.

No automatic fix is offered either. Whether to delete the suppression or rewrite it into the sanctioned shape follows from what is happening at that place.

## Fix

Fix it. That is the first option.

If you think the report is wrong, the next thing to doubt is the detection condition. Where several suppressions of the same kind pile up, fix the condition before adding suppressions. A false report is something to fix in the condition, not something to cover with a suppression.

Only when it is neither, and you judge it structurally unavoidable, write the suppression.

```ts
// oxlint-disable-next-line no-reassign--use-spread-or-iife -- the platform interface writes the total back into the element
element.total = 1;
```

Then add a row to `approved-lint-suppressions.json` at the repository root.

```jsonc
[
  {
    "path": "packages/cart/src/total.ts",
    "rule": "no-reassign--use-spread-or-iife",
    "grounds": "the platform interface writes the total back into the element",
    "approver": "the owner of the cart package",
  },
]
```

`path` is relative to the repository root, `rule` is the rule being stopped, `grounds` is the reason and `approver` is the name of whoever approved it. Rows are matched on the pair of path and rule name, so no line number is written. Delete the row when the suppression goes.

What the machine reads is only that `grounds` and `approver` are non-empty; whether what is written is sound it does not read. That part is read by whoever's name is on `approver`. **A suppression passing mechanically on the four conditions is no grounds for that suppression being sound.**

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
// a directive that names its rule, covers the next statement, carries grounds and is recorded passes
// oxlint-disable-next-line no-reassign--use-spread-or-iife -- the platform interface writes the total back into the element
element.total = 1;
```

```ts
// a rule name carrying its plugin prefix reaches the row that names it bare
// oxlint-disable-next-line dont-review-it/no-reassign--use-spread-or-iife -- the platform interface writes the total back into the element
element.total = 1;
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Widening the one-statement cover in effect by making that statement enormous. Several violations inside one statement is itself the target of another angle
- Adding a row to the ledger for the shape of it. Writing a meaningless string in `grounds` gets it through the machine, and with a name on `approver` the responsibility for it getting through remains
- Using a whole-file spelling with a rule name and grounds attached in place of the next-line spelling. Covering more than one statement is reported
- Using a same-line spelling in place of the next-line spelling. What it covers is not the one statement below, so it is reported
- Disabling the rule in the linter's configuration to avoid writing a suppression comment. Severity and scope on the configuration side are watched by [no-inline-suppression-of-protected-rule--register-the-exception-in-configuration](no-inline-suppression-of-protected-rule--register-the-exception-in-configuration.md)
- Stopping this rule with a suppression naming this rule. The four conditions apply to itself the same way

## Messages

<!-- BEGIN GENERATED messages -->

This rule declares no message of its own. A report carries the rule name alone.

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads no options. A consumer turns it on or off as a whole.

<!-- END GENERATED runtime -->
