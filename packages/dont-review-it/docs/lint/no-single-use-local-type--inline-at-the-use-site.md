---
description: "Disallow a type declared at the top level of a file without being exported when the file references it at most once, so a name is given to a shape only where more than one place has to agree on it"
---

# no-single-use-local-type--inline-at-the-use-site

<!-- BEGIN GENERATED rule-header -->

Disallow a type declared at the top level of a file without being exported when the file references it at most once, so a name is given to a shape only where more than one place has to agree on it

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: no
- Bundle: `writing`
- Source: [`no-single-use-local-type--inline-at-the-use-site.ts`](../../src/lint/oxlint/rules/writing/no-single-use-local-type--inline-at-the-use-site.ts)

<!-- END GENERATED rule-header -->

## Violation

A type alias or an interface declared at the top level of a file without being exported, which that file references fewer than twice. Type references, interface heritage clauses and class `implements` clauses all count as references. Verification files are not read.

## Fix

Write the shape where it is used and delete the declaration. A name is worth giving to a shape only where more than one place has to agree on it.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a type one declaration names is reported
type Draft = { readonly title: string };
const read = (draft: Draft) => draft.title;
```

```ts
// a type nothing refers to is reported
type Draft = { readonly title: string };
export const read = () => 1;
```

Code this rule accepts.

```ts
// a type two declarations agree on passes
type Draft = { readonly title: string };
const read = (draft: Draft): Draft => draft;
```

```ts
// a type that refers to itself counts that reference, so one use site is enough
type Branch = { readonly children: readonly Branch[] };
const read = (branch: Branch) => branch.children;
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Exporting the type so it leaves the reading. What is published is then a name nothing else uses
- Adding a second reference that restates the first, so the count clears without two places agreeing on anything

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `singleUseLocalType` | A type that this file declares without exporting must not be referenced from fewer than two places in the file. \`{{name}}\` is referenced from {{count}}. Write the shape where it is used and delete the declaration. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads no options. A consumer turns it on or off as a whole.

<!-- END GENERATED runtime -->
