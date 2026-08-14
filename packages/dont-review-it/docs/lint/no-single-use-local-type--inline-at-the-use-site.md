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
- Shipped in the preset: yes
- Source: [`no-single-use-local-type--inline-at-the-use-site.ts`](../../src/lint/oxlint/rules/no-single-use-local-type--inline-at-the-use-site.ts)

<!-- END GENERATED rule-header -->

## Violation

A type declared at a production TypeScript source's top level, not exported, referenced at most once from inside that same file.

Two declaration forms are read: type aliases and interfaces. Only those standing at the file's top level are in scope. A type declaration placed inside a function or a block is not.

Three things count as a reference — names written in type position.

- A type reference (the `Draft` of `readonly draft: Draft`)
- An interface's `extends` clause
- A class's `implements` clause

`typeof X` points at the value `X` rather than the type declaration `X` and is not counted. The name the declaration itself carries is not counted either.

### A reference to itself

Where a type references itself inside its own body, that reference counts. So a recursive type referenced once from elsewhere reaches two and is not reported. A recursive type cannot be inlined, and this is the intended result.

Where a recursive type is referenced nowhere else, the self-reference alone makes one and it is reported. The fix there is deletion rather than inlining, and that can be carried out.

### Why exported types are not read

This rule counts inside one file. Counting references to an exported type would mean resolving imports across the repository, and counting by name alone mixes it up with a type of the same name in another file. This repository has actually held two differently structured types both named `ParsedSource`.

The line of [EDR 0013](../../../../docs/engineering-decision-logs/0013-draw-the-duplication-line-at-decidability.md) — limit to what can be settled deterministically — is drawn here too. References closing inside one file can be counted by syntax alone.

So adding `export` takes a type out of this rule's scope. That is a hole in the detection, not a fix. It is named under forbidden bypasses.

### The invariant

The reason to name a type is that two or more places have to agree about that shape. A name with nobody to agree with creates indirection without creating agreement. A reader who wants to know the shape has to leave the line being read, travel to the declaration, and come back.

A name also gives a false signal that sharing exists there. Somebody reading "this type must be used elsewhere too" goes looking for the reach of a change when modifying it, and finds nothing.

[EDR 0013](../../../../docs/engineering-decision-logs/0013-draw-the-duplication-line-at-decidability.md) left "a helper used only once" out of the lint as something deterministically decidable that does not hold as a norm. What was counted there was value declarations, most of which were the practice of splitting a long procedure into named steps. Types are different: a type alias does nothing at run time and holds no procedure to split into steps. What is left in a single-use type alias is indirection alone. The record of dividing the judgment on that difference is [EDR 0019](../../../../docs/engineering-decision-logs/0019-name-a-type-only-where-two-places-agree.md).

There is no automatic fix because the fix does not settle on one answer for a reported declaration. Inlining at the use site is the usual one, but with zero references it is deletion, and where the shape really should be shared it is creating a second use site. Which to choose is settled by a person who reads what is around it.

### Configuration

None. There is no per-rule exclusion, no per-file exclusion, and no per-declaration exclusion tag.

### What is not detected

- An exported type. As above: counting is deterministic only when it closes inside one file
- A type declared inside a function or a block. What does not stand at the top level is part of the procedure it sits in
- Value declarations. Neither a constant nor a helper function is reported for being used once. The judgment counted and set aside in [EDR 0013](../../../../docs/engineering-decision-logs/0013-draw-the-duplication-line-at-decidability.md) carries over as it stands
- A type referenced twice or more. As long as the references appear in type position, it is not reported even where they sit together in one function

## Fix

Delete the declaration and write the shape at the use site. Writing it at a function's parameter or return position is the most common shape.

For a declaration carrying type parameters, substitute the arguments for the parameters before writing it at the use site.

With zero references, delete the declaration entirely, `export` and all.

Where the shape really should be shared by two places, what is missing is the second use site. Find the place spelling the same shape separately and have it use this type. The only reason to keep a declaration is a second place actually referencing it, not the prospect of one later.

### Right after following knip's unused-export report

knip lists "an export nothing imports", and following it by dropping the `export` makes that type a non-exported top-level type. Where its references inside its own file number one, it enters this rule's scope at that moment. `knip.ts` carries `includeEntryExports: true`, so this sequence arises each time something is taken out of a barrel.

The two reports do not contradict; they continue one another. knip says "not needed from outside", and this rule says "needed only once inside". Follow them in order and dropping the export and inlining at the use site is one piece of work.

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

- Adding `export` to leave the report. The shape has moved nowhere, and what remains is an exported type no other file imports
- Adding a throwaway declaration that only references the type a second time. The reference count grows and the places that agree do not
- Moving the type to another file and importing it. A shape referenced from one place becomes a shape referenced from one place with one more file
- Per-rule, per-file and per-declaration exclusion tags. None is offered

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
