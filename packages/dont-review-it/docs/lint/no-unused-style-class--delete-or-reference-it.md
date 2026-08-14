---
description: "Disallow a style sheet class that no script and no markup in the repository spells, so the style sheet keeps only the classes that reach the rendered page"
---

# no-unused-style-class--delete-or-reference-it

<!-- BEGIN GENERATED rule-header -->

Disallow a style sheet class that no script and no markup in the repository spells, so the style sheet keeps only the classes that reach the rendered page

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: no
- Shipped in the preset: yes
- Source: [`no-unused-style-class--delete-or-reference-it.ts`](../../src/lint/oxlint/rules/no-unused-style-class--delete-or-reference-it.ts)

<!-- END GENERATED rule-header -->

## Violation

A class defined by a style sheet imported from TypeScript whose name is spelled in no script and no markup anywhere in the repository.

The report stands on the statement importing the style sheet rather than on the style sheet. oxlint never visits a style sheet, so no report position can be placed inside the CSS. The import statement is what puts that style sheet on the page, so that is the address.

### Reading the class definitions

Comments, quoted strings and `url(...)` are masked out of the style sheet, and only the spellings standing in front of an opening `{` are read as selectors. Anything opening with `@` is the head of an at-rule and is not read; the contents of an at-rule are. Masking preserves the lines, so the line numbers in a report match the lines of the original style sheet.

Declaration values end at `;`, so decimals such as `0.1` and `1.5px` never stand in selector position. The `.png` in `url(./hero.png)` and the `.ghost` in `content: ".ghost"` go unread for the same reason.

A name appearing in several selectors counts as one class.

### The range of the index

The index is built from the repository root, found by walking up from the directory the lint ran in.

`.css` is read as the defining side. `.js`, `.jsx`, `.ts`, `.tsx` and their `.c` / `.m` spellings, plus `.html` and `.svg`, are read as the referencing side.

Test files join the referencing side. [no-duplicated-body--import-the-existing-declaration](./no-duplicated-body--import-the-existing-declaration.md) and [no-twin-declaration--merge-into-one-owner](./no-twin-declaration--merge-into-one-owner.md) hold tests out of their index; this rule does not. There, including tests would make them a hiding place for duplication; here, removing referencing sources only pushes toward false reports.

### Deciding that something is referenced

A class name is taken as referenced when it appears anywhere in the text of a file on the referencing side, as a substring. Whether it sits in an attribute, inside a string, or as part of an identifier makes no difference.

On top of that, every prefix formed by cutting the class name at its hyphens is treated the same way: for `ui-primary`, `ui-` appearing is enough. That keeps a spelling like `` `ui-${kind}` ``, where a class name is assembled out of a prefix and an interpolation, from being deleted for the spellings failing to line up.

The referencing texts are joined before matching, with newlines at the seams. Class names carry no newline, so two files cannot lend each other their ends to form a name.

The judgment errs toward missing violations. An unreferenced class whose name happens to be buried inside some other spelling is not reported. Failing to delete a style is cheaper than wrongly directing somebody to delete one.

### The invariant

An unused class is indistinguishable from a used one to a reader. Somebody reading a style sheet takes the appearance written there to be showing up somewhere. With things that never show mixed in, they end up inferring the design from appearance rules that never reach a screen.

The drift spreads quietly. Removing a class from markup makes the style sheet say nothing. The type check, the tests and the build all pass. The class left behind looks, to whoever touches it next, like something still in use.

No automatic fix is offered, because a machine cannot settle whether deleting or adding a reference is right. The appearance whoever wrote the class intended may simply not have reached the markup yet.

### What is not detected

- A style sheet imported from no script. There is no report position, so nothing is said
- A class standing only in markup that no style sheet defines. A misspelling is not something this rule can tell
- Id selectors, element selectors and custom properties. Names other than classes are not read
- A class whose name is buried as a substring inside some other spelling. That follows from erring toward missing violations, and is not permission

## Fix

Read the classes listed in the report one at a time, at their lines in the style sheet.

Where the appearance is no longer wanted, delete it from the style sheet. Where it sits inside a nested selector, check whether the outer one is left empty.

Where the appearance is still wanted, spell it from the markup that needs it. Where a class name is assembled and handed over somewhere, line the assembly's prefix up with the class name.

Where the style sheet itself is no longer wanted, delete the import with it.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// an import of a style sheet that defines a class nothing spells is reported
import "./style.css";
```

Code this rule accepts.

```ts
// an import of a module the index holds no unused class for is left alone
import { setupCounter } from "./counter.ts";
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Writing the class name in a comment or a document to produce the spelling. Only scripts and markup are read as the referencing side so it has no effect, and rewriting things to give it effect is forbidden
- Placing a reference nothing uses in the code to produce the spelling. The class stays dead and only the report goes away
- Loading the style sheet through a `link` tag or another style sheet's `@import` instead of importing it, to remove the report position
- Shortening the class name until it is buried inside an existing spelling
- Per-rule exclusions, per-package exclusions, per-class exclusion tags. None of them is offered

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `unusedStyleClass` | An imported style sheet must not define a class that nothing in this repository spells. \`{{styleSheet}}\` defines {{classes}}. Delete each of them from the style sheet, or spell each in the markup that needs it. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads no options. A consumer turns it on or off as a whole.

<!-- END GENERATED runtime -->
