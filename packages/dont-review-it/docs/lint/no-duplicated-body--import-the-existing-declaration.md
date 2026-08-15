---
description: "Disallow a declaration whose body is spelled exactly as another declaration elsewhere in the repository, so one behaviour keeps one owner instead of drifting between copies"
---

# no-duplicated-body--import-the-existing-declaration

<!-- BEGIN GENERATED rule-header -->

Disallow a declaration whose body is spelled exactly as another declaration elsewhere in the repository, so one behaviour keeps one owner instead of drifting between copies

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: no
- Shipped in the preset: yes
- Source: [`no-duplicated-body--import-the-existing-declaration.ts`](../../src/lint/oxlint/rules/no-duplicated-body--import-the-existing-declaration.ts)

<!-- END GENERATED rule-header -->

## Violation

A top-level declaration whose body is spelled exactly as another declaration's somewhere in the repository. Bindings, function declarations, type aliases and interfaces are read; the declaration's own name is not part of the body, so a copy differing only in name is caught.

Bodies are compared as syntax with positions dropped, so comments and formatting fall away while literals and identifiers are compared as written. A body of fewer than eight AST nodes is not reported, because short bodies match by chance. Test sources are outside the index.

## Fix

Read every position the report lists, settle where the behaviour should be owned, export it from there and import it everywhere else.

Where the bodies match but the responsibilities differ, make one of them a different implementation. Renaming alone does not clear it.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a declaration whose body is spelled the same elsewhere is reported
const twice = (value: number): number => value * 2;
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Adding a statement or a parameter to break the match. The duplication stays and only the report clears
- Moving one side into a test file. That the index skips tests is not a place to hide duplication

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `duplicatedBody` | A declaration must not repeat a body that already exists elsewhere in this repository. The same body is declared at {{sites}}. Decide which module owns the behaviour, export it from there, and import it everywhere else. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads no options. A consumer turns it on or off as a whole.

<!-- END GENERATED runtime -->
