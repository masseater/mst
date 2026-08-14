---
description: "Disallow a declaration that another declaration in the repository spells with the same name and the same body, so one concept keeps one owner however small the body is"
---

# no-twin-declaration--merge-into-one-owner

<!-- BEGIN GENERATED rule-header -->

Disallow a declaration that another declaration in the repository spells with the same name and the same body, so one concept keeps one owner however small the body is

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: no
- Shipped in the preset: yes
- Source: [`no-twin-declaration--merge-into-one-owner.ts`](../../src/lint/oxlint/rules/no-twin-declaration--merge-into-one-owner.ts)

<!-- END GENERATED rule-header -->

## Violation

A declaration in a production TypeScript source whose name and body both match another declaration in the repository.

Four top-level shapes are targets:

- Bindings (`const`, `let`, `var`)
- Function declarations
- Type aliases
- Interfaces

How the body is built for matching, and how it is normalised, is the same as in [no-duplicated-body--import-the-existing-declaration](./no-duplicated-body--import-the-existing-declaration.md). Two rules read one index in two different ways.

### Why there is no floor on the size of the body

`no-duplicated-body` does not report a declaration whose body holds fewer than eight AST nodes. Short bodies match by coincidence: `= 1` or `= []` matching in two places says nothing about a behaviour that should be shared.

This rule has no floor. The name matching too is what rules out coincidence. `= "package.json"` standing in two places is a coincidence; `MANIFEST_FILE_NAME = "package.json"` standing in two places means the same concept was written twice.

The three pairs actually found in this repository all had a body of one AST node, a single scalar. `no-duplicated-body`'s floor was letting them through by design.

### Two rules can report the same place

Where the name and the body match and the body holds eight nodes or more, `no-duplicated-body` reports this declaration as well. Both reports are correct at once, and settling on one owner clears both. No machinery suppresses either. No pair met that condition when this was introduced.

### The range of the index

The index is built from the repository root, found by walking up from the directory the lint ran in. Test files and anything under a test directory stay out of it, using the same judgment as [no-strict-canonical-literal-use--use-canonical-import](./no-strict-canonical-literal-use--use-canonical-import.md).

### The invariant

With declarations of the same name in two places, changing one drops nothing. The type check passes and the tests pass. Since the names are the same, a reader looks at one of them and takes it as the definition of that concept. That the other still carries the old value and is reaching different callers does not surface until the two disagree at run time.

Unlike a duplicate that shares only its body, there is almost no room for a person to judge whether these are the same concept. A name is the tag its writer put on a concept, and the tags matching is the writer saying the two places mean the same concept.

No automatic fix is offered, because a machine cannot settle which one is the owner. Choosing the owner is a question of where a responsibility belongs and cannot be derived from spellings.

### What is not detected

- Declarations whose bodies match under different names. [no-duplicated-body--import-the-existing-declaration](./no-duplicated-body--import-the-existing-declaration.md) handles those, conditioned on the size of the body
- Declarations whose names match while their bodies differ. That is one name carrying two meanings, and the fix is renaming rather than merging. The judgment could be made deterministically, but it does not fit this rule's instruction to merge, so it is not included. One such pair (`ParsedSource`) stood in this repository when this was introduced
- Similarity short of an exact match. [EDR 0013](../../../../docs/engineering-decision-logs/0013-draw-the-duplication-line-at-decidability.md) settled not to pursue it
- Declarations not standing at the top level. Anything inside another declaration is part of that procedure

### Configuration

None.

## Fix

Read all the positions in the report, then decide where the concept should be owned. Export it from there and import it everywhere else.

Do not choose the owner by the order in the report, by which was written first, or by which file is shorter. Choose by whose responsibility the concept is.

Where it belongs to neither file, create a new place that owns it. All three pairs found at introduction were of that kind: a constant naming an AST node kind and constants about the package manifest were each moved to a new owner.

Where you judge that the same name really names two different concepts, rename one of them. That still leaves the fact that the bodies matched as well as the names. With a body of eight nodes or more, `no-duplicated-body` keeps reporting it and an owner has to be settled there too.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a declaration the index places past the end of the file is reported on the file
const MANIFEST_FILE_NAME = "package.json";
```

```ts
// a declaration that shares both its name and its body is reported although the body is short
const MANIFEST_FILE_NAME = "package.json";
```

Code this rule accepts.

```ts
// a declaration that shares only its body with another one passes
const PACKAGE_FILE_NAME = "package.json";
```

```ts
// a declaration that shares only its name with another one passes
const MANIFEST_FILE_NAME = "pnpm-workspace.yaml";
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Renaming one to leave the report. The same body still stands in two places
- Adding something meaningless to the body to break the match. As above
- Moving one into a test file. The index not reading tests is not a channel for hiding duplication
- Per-rule exclusions, per-package exclusions, per-declaration exclusion tags. None of them is offered

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `twinDeclaration` | A declaration must not carry both the name and the body of another declaration in this repository. The same declaration stands at {{sites}}. Decide which module owns the concept, export it from there, and import it everywhere else. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads no options. A consumer turns it on or off as a whole.

<!-- END GENERATED runtime -->
