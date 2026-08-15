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
- Bundle: `writing`
- Source: [`forbid-oversized-file--split-by-responsibility.ts`](../../src/lint/oxlint/rules/writing/forbid-oversized-file--split-by-responsibility.ts)

<!-- END GENERATED rule-header -->

## Violation

A file carrying more code lines than its budget. A code line is a line any token spans, so a line holding nothing but a comment is not counted while every line a multi-line token runs through is.

A spec file is measured against `maxSpecLines`, which defaults to 1500, and every other file against `maxLines`, which defaults to 500. Which files count as specs is settled by `specFileSuffixes`.

## Fix

Name the responsibilities the file has taken on and move each into a file named after it.

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

- Splitting into siblings that differ only by a number. `forbid-numbered-sibling-file--name-what-each-file-owns` reports that
- Raising the budget to fit the file. The budget is what makes a seam get used while there is still one seam

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
