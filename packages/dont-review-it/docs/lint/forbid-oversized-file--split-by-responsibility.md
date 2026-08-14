---
description: "Disallow a file carrying more code lines than the budget set for it, so a file is split while it still has one seam instead of after it has accumulated several responsibilities"
---

# forbid-oversized-file--split-by-responsibility

<!-- BEGIN GENERATED rule-header -->

Disallow a file carrying more code lines than the budget set for it, so a file is split while it still has one seam instead of after it has accumulated several responsibilities

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: yes
- Shipped in the preset: yes
- Source: [`forbid-oversized-file--split-by-responsibility.ts`](../../src/lint/oxlint/rules/forbid-oversized-file--split-by-responsibility.ts)

<!-- END GENERATED rule-header -->

## Violation

A file carrying more code lines than the budget that applies to it. Over the budget, the file gets one report.

Code lines are counted as the number of lines holding at least one token.

- Blank lines are not counted
- A line holding only a comment is not counted either. A line comment and a block comment count the same, and a block comment spanning several lines takes all of those lines out of the count. Writing a thick explanation is not punished
- One token spanning several lines (a template literal, say) counts every line it spans, including blank lines inside the literal. The amount physically read has not gone down, so it does not come out of the count either
- A trailing newline adds no code line

A file exactly at the budget is not reported. The budget is the value up to which a file is allowed.

However far past the budget it is, the report is one, and it stands on the whole file (the `Program` node). Pointing at the line that went over means nothing, so the file itself is pointed at.

A file swollen by a large embedded literal (a fixture string, embedded data) is in scope. The reading is real, so being a literal grants no exemption. Where an exemption is needed, it is handled by narrowing the set of files the rule applies to in the configuration, not by changing how the rule counts.

How many responsibilities the file's contents actually carry is not read. There is no way for a machine to settle a count of responsibilities, so it stops at the proxy of a line count. Passing the budget does not mean "good"; it means "this rule has nothing to say".

### The invariant

This repository wants a file to sit inside one responsibility. But there is nothing that notices the moment it becomes two. It gets noticed once it has become hard to read, and by then the line count has already grown.

And the cost of splitting is not proportional to the line count. It is proportional to how much the file is imported from outside. The time it takes to grow large is also the time in which references accumulate, so "split it once it is large" always splits at the most expensive moment.

So this rule is not detecting that a responsibility became two; it is forcing the moment of recounting responsibilities forward. Going over the budget is not the claim "this file has two responsibilities" — it is the signal "recount now, while it is still cheap".

The budget differs by file kind because the healthy distribution of length differs by kind. A source file's job is to hold one abstraction, so its length tracks the complexity of a concept. A spec file's job is to enumerate scenarios, so it grows longer than a source file even while holding the same responsibility. Bind both with the same number and either the source side is too loose or the spec side is forced into splits that only satisfy a number.

### Configuration

- `maxLines` (integer, at least 1, default 500): the budget for a file that is not a spec file
- `maxSpecLines` (integer, at least 1, default 1500): the budget for a spec file
- `specFileSuffixes` (a list of strings): the spelling that decides which files are spec files. Which budget a file draws on follows from this vocabulary

```jsonc
["error", { "maxLines": 500, "maxSpecLines": 1500 }]
```

Unknown keys are refused by the schema (`additionalProperties: false`). A candidate budget cannot be parked under another name.

The rule carries the budget for each kind itself rather than leaving the distinction to per-path overrides in the configuration. A file kind is something the rule can settle by reading the file name, and settling it in the rule keeps one answer for what counts as a spec file across every rule that asks the same question.

Raising a budget is a judgment about how many lines one responsibility is worth in this project — not an operation for letting the file in front of you through. Change it where it applies to every file, and write why in the body of that change's commit message.

## Fix

Name the responsibilities this file has taken on. Where two or more line up, move each into a file of its own. The name of the file it moves into becomes the name of the responsibility. Each file after the split must have a name that explains what it owns, and other modules must import it for that reason.

Where naming them yields only one, what needs cutting out is a block inside the file rather than a responsibility. Lift the procedures you can name into functions, and pare the call site down until all that stays is the sequence.

In a spec file, cutting the number of scenarios is a correct fix as well as splitting. Drop verification that confirms the same thing twice through a second way in.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a template literal spanning lines counts every line it spans, blank ones included
const letters = `a

b`;
```

Code this rule accepts.

```ts
// a line carrying only a line comment is not counted
// what follows is the whole file
// and this line too
const first = 1;
const second = 2;
const third = 3;
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Splitting by a numeric suffix (`foo-1.test.ts` / `foo-2.test.ts`). The responsibility stays "everything about foo", and it is worse by exactly the amount that nobody can now tell which file holds the description they want. Where there are several responsibilities, name them and divide (`foo.create.test.ts` / `foo.update.test.ts`). Where there is one, do not divide — cut scenarios
- Extracting a helper only to reduce the line count: one with a single caller, exported yet meaningless outside that caller, existing because lines had to move somewhere. The caller's responsibility has not shrunk at all; the body has just moved further away
- Raising the budget to let the file in front of you through. One file's convenience moves a scale that applies to every file, and the room for every other file to grow widens with it
- Compressing the same code into fewer lines: several statements on one line, a wider formatter wrap. The line count drops, the responsibility does not, and only the difficulty of reading goes up
- Adding a re-export-only file to split the file in appearance without moving anything. What was split is the line count; the responsibility stayed in the original file
- Silencing that one file with a suppression directive. The excess is frozen in place with no grounds shown that one responsibility is what it holds

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `oversizedFile` | A file must not carry more code lines than the budget set for it. This file carries {{codeLines}} code lines against a budget of {{maxLines}}. Name the responsibilities it has taken on and move each one into a file named after it. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
