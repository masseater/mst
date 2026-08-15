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

An imported style sheet defining a class that nothing in the repository spells. Scripts and markup are both read, and the report lists every class the sheet defines that nobody names.

## Fix

Delete each class from the style sheet, or spell it in the markup that needs it.

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

- Assembling the class name at run time so nothing spells it out. The class then reaches the page through a name no search finds

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
