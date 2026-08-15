---
description: "Disallow an exported type whose name carries a second shape inside its workspace, or whose non-trivial shape carries a second name inside the repository, so a name and a structure keep pointing at each other one to one"
---

# no-split-type-authority--rename-or-unify

<!-- BEGIN GENERATED rule-header -->

Disallow an exported type whose name carries a second shape inside its workspace, or whose non-trivial shape carries a second name inside the repository, so a name and a structure keep pointing at each other one to one

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: no
- Shipped in the preset: yes
- Source: [`no-split-type-authority--rename-or-unify.ts`](../../src/lint/oxlint/rules/no-split-type-authority--rename-or-unify.ts)

<!-- END GENERATED rule-header -->

## Violation

An exported type whose name and shape stop pointing at each other one to one. Two reports, both judged against an index built over the repository.

- One name standing for two shapes: the same exported name declared with a different shape elsewhere in the same workspace
- One shape standing for two names: a non-trivial structure this repository also declares under another name

The report lists the other sites.

## Fix

Read both declarations and decide whether they name one concept. Land on a single shape for the name, or on a separate name for each shape; keep one declaration to import everywhere, or put the difference between the two into the types.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a type whose name carries another shape in the workspace is reported
export type Shape = { readonly a: string; readonly b: number; readonly c: Named };
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Shifting one shape until the two stop matching. The split stands and now the two also disagree
- Adding a member to break the structural match while both names still stand for the same thing

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `SPLIT_SHAPE_MESSAGE_ID` | One name must not stand for two shapes. \`{{name}}\` is also declared with a different shape at {{sites}} of this workspace. Read both declarations, decide whether they name one concept, and land on a single shape for \`{{name}}\` or on a separate name for each shape. Shifting one shape until the two stop matching leaves the split standing. |
| `SPLIT_NAME_MESSAGE_ID` | One shape must not stand for two names. \`{{name}}\` repeats a structure this repository also declares at {{sites}}. Read both declarations, decide whether they name one concept, and keep a single declaration to import everywhere or put the difference between them into the types. Adding a member until the two stop matching leaves the split standing. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads no options. A consumer turns it on or off as a whole.

<!-- END GENERATED runtime -->
