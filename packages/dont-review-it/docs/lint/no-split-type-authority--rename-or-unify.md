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

An exported type declaration where the correspondence between name and structure has stopped being one to one. Two forms are read — type aliases and interfaces — and only those standing at a file's top level.

Two shapes are detected, each over a different range.

### One name carrying two structures

Inside one workspace (the smallest unit carrying its own `package.json`), a published type of the same name declared with structures that do not match after normalization. Reported as `splitTypeShape`.

The range closes on the workspace because the same name across packages is normal. In a set of reusable packages, each uses the same word — `Config`, `Options` — for the type at its own entrance. With the namespaces separated, that is not two authorities. One package's public API carrying two structures under one name has no separated namespace, and is a duplicated contract as it stands.

### One structure carrying two names

Across the whole repository, published types whose canonical forms match with the name removed, declared under different names. Reported as `splitTypeName`.

That one takes a wide range and imposes a lower bound on the structure in exchange: three members or more, and at least one member referencing a named type. Only what meets both is reconciled.

### How the canonical form is built

Both shapes use the same normalization. Use different ones and a region appears where one matches and the other does not, and that gap becomes a new place to escape to.

Normalization erases only differences that mean nothing whether written or not.

- The order of members
- The order of a union's alternatives and an intersection's constituents
- The names of type parameters, replaced by position in declaration order
- Whitespace, newlines and separators (never differences to begin with, since the syntax tree is what is read)

What it does not erase is what changes meaning. `readonly` and `?` stay. The names of referenced types stay, so `ReadonlyMap<string, string>` and `ReadonlyMap<string, number>` are different structures.

Only the side reading the name correspondence includes the declaration form (type alias or interface) in the canonical form. Where one name is declared as an interface in one place and a type alias in another, that is one name carrying two declarations and is reported. The side reading the structure correspondence does not include the declaration form: including it would let a match be broken by rewriting an interface as a type alias.

### The range of the index

The index is built from the repository root. The root is settled by walking up from the lint's working directory. Test files and everything under a test directory, build products, fetched dependencies and version control internals are not in the index. The judgment is the same one [no-duplicated-body--import-the-existing-declaration](./no-duplicated-body--import-the-existing-declaration.md) uses.

### The invariant

One contract has exactly one owner.

The first layer is that both shapes are the same breakage seen from different sides. With two structures under one name, a reader who followed the name grabs a structure other than the one they had in mind. With two names over one structure, whoever fixes one finishes without knowing the other with the same structure exists. In both, the type check passes and the tests pass.

The second layer is that this state appears only after exact-match detection has been slipped past. What stops declarations matching in both name and body in this repository is [no-twin-declaration--merge-into-one-owner](./no-twin-declaration--merge-into-one-owner.md), designed to stop "the moment a second authority is born". The state past that moment — after one name is changed or one member is shifted — is deliberately released by that rule. With nobody receiving what it released, the act of breaking a match works as a bypass. To keep a prohibition standing as a prohibition, an eye is placed on what was released.

What a machine cannot settle is "which one is right", not "there are two". This rule reports the fact alone and leaves the choice of where to converge to a person. There is no automatic fix for the same reason.

### Configuration

None. Only whether the rule is on or off is settled by the configuration.

The lower bound is not exposed. With the bound in the configuration, whoever is reported can raise it and move their own declaration outside the condition, making the prohibition negotiable.

There is no exception list either, for the same reason.

### Why the member lower bound is three

Where a type references named types, the most common shape is a carrier holding one key and one payload — `{ messageId, data }`, `{ relativePath, bodies }` — with two members. Two such types sit one member rename apart from matching each other, and that is the layer where coincidental matches first appear. At three members or more, three independent name choices, three annotation choices and the fact that one of them is a named type all coincide, so they do not line up exactly unless one was copied from the other. The bound sits one layer above where coincidence begins.

### What is not detected

- **Declarations sharing a name whose canonical forms also match.** What this rule reads is a correspondence that has stopped being one to one, so matching pairs are out of scope. Ones matching down to the spelling are received by [no-twin-declaration--merge-into-one-owner](./no-twin-declaration--merge-into-one-owner.md)
- **Same-named interfaces written apart in one file.** That is the language's declaration merging, not two authorities. The index gathers the same name in the same file into one type and treats the combined members as one structure
- **A declaration inside `declare module` augmenting an external module's types.** It does not stand at a file's top level and does not enter the index
- **Same-named published types in separate workspaces.** Outside the range where the name correspondence is read
- **A structure of fewer than three members, or one referencing no named type.** Matching by coincidence is the ordinary case there
- **A declaration derived from the other.** A declaration built by transforming the other with type operations is one authority with a derivation written beside it. Pairs referencing each other's names are excluded from reconciliation
- **A local type that is not exported.** What is not referenced from outside the file claims no contract
- **A re-export with no declaration.** That is exactly the fix this rule recommends
- **Duplicate values.** A constant, a function or a block of work standing in two places belongs to [no-duplicated-body--import-the-existing-declaration](./no-duplicated-body--import-the-existing-declaration.md) and [no-twin-declaration--merge-into-one-owner](./no-twin-declaration--merge-into-one-owner.md)

### Two rules can report the same place

Of the pairs where one structure carries two names, those whose declaration bodies match exactly as syntax trees and whose bodies hold eight AST nodes or more are reported by `no-duplicated-body--import-the-existing-declaration` too. Both reports are right at once, and settling on one authority clears both. No trick is built in to suppress one.

What this rule additionally receives are the differences normalization absorbs: a different member order, a different order of union alternatives, differently named type parameters, one being an interface and the other a type alias. None of those matches as a syntax tree, so that rule lets them past.

### The state nobody currently receives

A pair sharing a name whose canonical forms match while the spellings differ — members merely reordered, type parameters merely renamed — is reported by no rule. This rule excludes pairs whose canonical forms match, and the existing rules read syntax tree equality and come off on the ordering difference.

That is not a miss on this rule's part but the absence of a receiver. What would receive it is a rule reading "published types of the same name match exactly after normalization", and this repository holds none. Until one arrives, a person finds this shape.

## Fix

Read both places in the report before settling whether the two are the same concept. Settle that and the fix settles too.

### Where one name carries two structures

- **They were different concepts** → split the names. Have both name what they point at, not just one. Change only one and what remains occupies the general name
- **They were the same concept** → see which side's convenience produced the structural difference, and converge on the structure of the module owning the contract. The converged state matches in name and structure, and from there `no-twin-declaration--merge-into-one-owner` says the rest: gather them into one

### Where one structure carries two names

- **They were the same concept** → settle one authority, delete the other, and import the authority. Which is the authority is settled by which module owns the contract that type expresses — not whichever was written first, nor whichever appeared first in the report
- **They were different concepts** → express the difference on the type side. Give it a distinguishing member, or rewrite one as derived from the other. Do not leave a state where the structure is the same and only the name differs

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a type whose name carries another shape in the workspace is reported
export type Shape = { readonly a: string; readonly b: number; readonly c: Named };
```

```ts
// a type whose structure carries another name in the repository is reported
export type Shape = { readonly a: string; readonly b: number; readonly c: Named };
```

Code this rule accepts.

```ts
// a test file is never linted, so it is never reported
export type Shape = { readonly a: string; readonly b: number; readonly c: Named };
```

```ts
// a type declared twice with one shape is left to the rule that reads exact matches
export type Shape = { readonly a: string; readonly b: number; readonly c: Named };
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- **Adding an unused member to shift the structure.** The shifted result hits neither shape, and that the two declarations express the same thing is unchanged
- **Reordering members, reordering union alternatives, renaming type parameters.** Normalization absorbs all of them, so the match does not come off
- **Rewriting an interface as a type alias.** The side reading the structure correspondence does not read the declaration form
- **Adding a meaningless suffix to make another name.** One structure carrying two names stays exactly as it was
- **Stopping the publication while providing another route reachable from the referencing side.** Withdrawing publication is right only where the type really is not going outside
- **Per-rule, per-package and per-declaration exclusions.** None is offered. Writing "this name may carry two structures" in configuration is justifying a duplicated authority through configuration

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
