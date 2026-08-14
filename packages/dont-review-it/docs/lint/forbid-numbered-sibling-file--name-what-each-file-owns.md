---
description: "Disallow splitting a file into siblings distinguished only by a number, so every file name states the responsibility that file owns"
---

# forbid-numbered-sibling-file--name-what-each-file-owns

<!-- BEGIN GENERATED rule-header -->

Disallow splitting a file into siblings distinguished only by a number, so every file name states the responsibility that file owns

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: no
- Shipped in the preset: yes
- Source: [`forbid-numbered-sibling-file--name-what-each-file-owns.ts`](../../src/lint/oxlint/rules/forbid-numbered-sibling-file--name-what-each-file-owns.ts)

<!-- END GENERATED rule-header -->

## Violation

A linted file whose name ends in a separator followed by digits, with its counterpart standing in the same directory. Both halves are reported, so splitting something in two raises two reports.

The name is judged on what stands before the first dot. What is read of `parser-1.test.ts` is `parser-1`; the chain of suffixes is left out. The oversized-file rule names splitting a test file by number (`foo-1.test.ts`, `foo-2.test.ts`) as the first of its forbidden bypasses, and reading only up to the first dot keeps that shape from passing through.

Two characters count as separators: the hyphen and the underscore. Digits following a word with no separator (`oauth2`, `base64`, `http2`) are not targets. Digits in that position are part of the word, not the order of a split.

A counterpart is either of these, in the same directory:

- The same prefix followed by different digits (`order-2.ts` against `order-1.ts`)
- The prefix with the separator dropped (`handler.ts` against `handler-1.ts`)

A file carrying the same name is not a counterpart. `widget-1.test.ts` beside `widget-1.ts` is that file's test, not the other half of a split. A different prefix is not a counterpart either, so `alpha-1.ts` and `beta-2.ts` living together are not reported.

One report is raised per file, covering the whole file (the Program node), because there is no line to point at inside it.

The directory listing is asked of the file system, and the answer is remembered for as long as the process lives. Creating or deleting a counterpart mid-run does not change that process's answer; the next run does.

### What is not detected

**A split by one character after the separator.** `grid-x.ts` and `grid-y.ts` are not reported. One character in that position can legitimately name an axis or a dimension, and the syntax alone cannot tell that from a number in disguise. Escaping by swapping digits for letters is treated as a bypass, below.

**A numbered name with no counterpart.** `report-1.ts` standing alone is not reported. What this rule watches is the trace of a split, not whether a name is good.

**Numbering on identifiers.** `handleA` / `handleB` and `step1` / `step2` are out of reach. This is a discipline about file boundaries, while those are about naming, and another rule carries names. One rule judging both would mean loosening one loosens the other with it.

**The contents of the files.** Whether two files really carry one responsibility is not read. A machine has no way to count responsibilities, so this stops at the name as a proxy. Passing means "this rule has nothing to say", not "this is fine".

### The invariant

[forbid-oversized-file--split-by-responsibility](./forbid-oversized-file--split-by-responsibility.md) pushes a file over its budget to be split. The cheapest way for whoever was pushed to get back under it is cutting the contents in half and numbering them. The line count certainly falls, and the responsibilities do not move an inch.

That state is invisible to the oversized-file rule: both halves are under the budget, so from that rule's angle it looks solved. This is why its document names the shape as the first of its forbidden bypasses — but naming it was all that happened, and no machine was watching.

Once a rule carrying a budget exists, the shortest route out from under that budget has to be closed at the same time, or the budget stops being a device that makes responsibilities be recounted and becomes a device that makes numbers be added.

A number being worthless as a name is why this rule watches numbers alone. Somebody reading `order-1` and `order-2` cannot decide from the names which one carries the behaviour they are after. They open both to find out, which is more reading than the single file before the split.

### Configuration

None. Whether the rule is on or off is settled by the configuration, and nothing else about the judgment is.

Which files it targets is not left to the consumer, because this norm does not depend on how a deployment is arranged. In any directory, siblings that differ only by a number have names that are not doing any work. Requiring a target list would leave the rule silently inert in a repository that forgot to write one.

## Fix

State in the name what each of the two files owns. Where you can state it, rename them to that. Each file after a split has to have a name that describes what it owns, and other modules have to import it for that reason.

Where trying to state it produces only one name, the split produced nothing. Put the two back into one file, then reduce what the file does. If putting them back runs into the line budget, recounting responsibilities from there is the right order, and splitting by number does not stand in for it.

In test files, reducing the number of scenarios is also a correct fix. Drop verification that confirms the same thing twice through two entrances.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// two files that differ only by an ordinal are one responsibility in two places
export const total = 1;
```

```ts
// the ordinal is found before the suffix chain, so numbered test files are caught
export const total = 1;
```

Code this rule accepts.

```ts
// digits attached to a word without a separator carry meaning of their own
export const total = 1;
```

```ts
// a single letter after the separator can name an axis, so it is left to review
export const total = 1;
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Swapping the digits for a single letter (`order-a.ts`, `order-b.ts`). The syntax does not stop it, and nothing has changed about names that do not describe what they own. It is a violation under the guidelines and is rejected in review
- Swapping the digits for ordinal words (`order-first.ts`, `order-second.ts`). A violation for the same reason
- Moving one half into another directory so they no longer live together. Only the directory listing is read, so the report clears, while one responsibility scattered across two places has got worse
- Attaching the digits to the word to remove the separator (`order1.ts`, `order2.ts`). This rule requires a separator, so the report clears. That is a signal that the judgment leans too hard on the separator: fix the judgment rather than the escape
- Adding a re-export-only file for the appearance of a split without moving anything. Only the name was split; the responsibility stayed in the original file
- Silencing that one file with a suppression directive. The split gets pinned in place with no grounds given for the responsibilities being two

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `numberedSiblingFile` | Splitting a file into siblings that differ only by a number is forbidden. \`{{sibling}}\` sits in this directory under the same name with a different number. List what each file owns and rename each file after what it owns. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads no options. A consumer turns it on or off as a whole.

<!-- END GENERATED runtime -->
