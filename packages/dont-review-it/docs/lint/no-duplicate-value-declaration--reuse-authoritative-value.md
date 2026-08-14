---
description: "Disallow a constant, function, or class declared under a name another declaration in the repository binds to the same body, so one value keeps one owner instead of drifting between copies"
---

# no-duplicate-value-declaration--reuse-authoritative-value

<!-- BEGIN GENERATED rule-header -->

Disallow a constant, function, or class declared under a name another declaration in the repository binds to the same body, so one value keeps one owner instead of drifting between copies

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: no
- Shipped in the preset: yes
- Source: [`no-duplicate-value-declaration--reuse-authoritative-value.ts`](../../src/lint/oxlint/rules/no-duplicate-value-declaration--reuse-authoritative-value.ts)

<!-- END GENERATED rule-header -->

## Violation

A declaration in a production TypeScript source whose name and body both match another value declaration in the repository, where at least one of the two is exported.

The targets are named values, in three shapes.

- A binding (`const` / `let` / `var`), with its type annotation and initializer as the body
- A function declaration, with its type parameters, parameters, return type, body, and whether it is `async` or a generator as the body
- A class declaration, with its type parameters, superclass, `implements` clause and body as the body

The kind of binding is not part of the body. Rewriting `const` as `let` does not take the match off.

The depth a declaration stands at is not read. Declarations at the top level and declarations inside a function or a block go into the same index. Depth is ignored so that pushing a local declaration of the same name and body as a published one down inside a function does not take it out of detection just by adding distance.

### The pair needs an exported side

Even with two declarations of the same name and body, nothing is reported where neither is exported. A declaration nothing outside the file references is not claiming authority over that name, and short names taking the same shape in separate places happens ordinarily.

Because of that condition, no lower bound is placed on the size of the body. A one-line constant and a helper of a few lines alike are not coincidence once the name matches too.

### How the match is settled

The body is turned into an AST, and the structure with position information dropped is stringified and compared. On top of that, names are handled in two groups.

- Names closed inside the declaration (parameters, local bindings, inner function and class names, type parameters) are replaced by a symbol in order of appearance. Changing a parameter name does not change behaviour, so a difference in spelling must not take the match off
- Names open outside the declaration keep their spelling. Where such a name comes from an import in this file, though, it is compared by what it resolves to (the module the relative specifier resolves to, and the name taken out of that module) rather than by spelling. Import under an alias and, as long as it points at the same thing, it still matches

Property spellings are left out of the name replacement. `{ id }` and `{ id: held }` have the same body even where `held` is the binding's alias. Conversely `.size` and `.length` are different bodies.

Comments and whitespace are dropped. String and number literals keep their spelling.

### The range of the index

The index is built from the repository root. The root is settled by walking up from the lint's working directory. Run the lint from a package directory and it sees the same index as running it from the whole repository.

Test files, and everything under a test directory, are not in the index. The judgment is the same one [no-duplicated-body--import-the-existing-declaration](./no-duplicated-body--import-the-existing-declaration.md) uses.

A matching pair is reported at both positions. A machine cannot settle which is authoritative, so reporting only one and implicitly making the other correct is not done.

### Two shapes of report

The message differs between a reported declaration that is itself exported and one that is not exported while its counterpart is. The latter includes the fact that a reader of that file does not reach the published declaration. Told only a name and a position, a reader concludes "these are different things" and heads for a suppression.

### The invariant

With a value of the same name in two places, fixing one drops nothing. Type checking passes and the tests pass.

A value differs from a type in two ways. One is that it runs, so the two that diverged are live at the same time; which behaviour appears is settled by which one the caller grabbed, and that difference stays without becoming an exception or a test failure. The other is that it is small; detection that looks at blocks of lines takes blocks of a certain size, so a short constant or a helper of a few lines slips underneath. With nothing catching what slipped under, "small enough to miss" becomes the effective discipline. Being small is not a reason duplication is allowed.

A local declaration sharing a name with a published one is especially bad because of how name resolution works. The referencing side grabs the nearer one. A local declaration silently hides the published one, so a different thing runs while a reader still sees "same name, same thing". The hiding itself leaves no trace on the code.

There is no automatic fix because a machine cannot settle which is the owner. Being exported is a hint about the candidate, not a decision. Choosing an owner is a question of where responsibility sits, and it cannot be derived from spellings.

### Configuration

None. There is no setting for excluding a particular name as "this one may exist twice". Justify a second owner in the configuration and the divergence proceeds at the same speed.

### What is not detected

- A pair of the same name and body where neither is exported. Only the published side claims authority
- Declarations that differ in name and match only in body. [no-duplicated-body--import-the-existing-declaration](./no-duplicated-body--import-the-existing-declaration.md) takes that, conditioned on the size of the body
- Declarations whose names match and whose bodies differ. That is one name carrying two meanings, and the fix is a rename rather than a merge. It does not fit this rule's instruction (converge on one), so it is left out
- Type declarations. Type aliases and interfaces are not this rule's targets
- Re-exports. Passing an existing value through without a declaration is exactly the fix this rule asks for
- A default export carrying no name. This rule reads by name, so there is nothing to hold it. The default export itself is forbidden separately by [no-default-export--use-named-export](./no-default-export--use-named-export.md)
- A destructuring binding that does not settle on one name. `const { first, second } = split();` does not go into the index
- A declaration built by referencing the other. A derivation does not match in body, so the condition does not hold
- Declarations that mean the same thing and are written differently. The judgment is equality after normalization, not equivalence as values

## Fix

Read every position listed in the report, then settle which module should own the fact that value stands for. Export from there and import everywhere else.

Do not reverse the order of removal. Build the destination before deleting. A fix that only deletes one side cuts references.

For a local redeclaration, delete it and put an import in its place. The side that was hiding disappears, so references reach the one that remains.

When choosing the owner, do not choose by the order they appear in the report, do not choose the one written first, and do not choose the exported one unconditionally. Choose by whose responsibility that value is.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// an exported value another file exports under the same name with the same body is reported
const MANIFEST_FILE_NAME = "package.json";
```

<!-- END GENERATED examples -->

The subject of this rule is the values declared across the repository rather than the source in front of you alone, so the code above is the file the report stands on, and what settles the judgment is what the other files declare.

### Forbidden bypasses (do not do this)

- Renaming one of them. That produces a state of different names with matching bodies, and where the body is large enough [no-duplicated-body--import-the-existing-declaration](./no-duplicated-body--import-the-existing-declaration.md) keeps reporting it
- Renaming parameters or local bindings. Names closed inside the declaration are normalized by position, so the match does not come off
- Re-importing the function being called under another name. Imported names are compared by what they resolve to, so the match does not come off
- Rewriting `const` as `let`. The kind of binding is not part of the body
- Pushing the local declaration inside a function to add distance. The index does not read the depth of a declaration
- Moving one side into a test file. That the index does not read tests is not a mouth for hiding duplication
- Adding meaningless text to the body to break the match. The duplication stays and only the report clears
- Silencing it by disabling the lint

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `duplicateValueDeclaration` | A value must not be declared under a name that another declaration in this repository binds to the same body. \`{{name}}\` stands with the same body at {{sites}}. Decide which module owns the value, export it from there, and import it at every other place before those declarations go away. Renaming one side, or respelling its body, leaves two owners standing. |
| `hiddenExportedValue` | A value must not be re-declared under a name this repository already exports. \`{{name}}\` is exported with the same body at {{sites}}, so this declaration hides that one from every reader of this file. Decide which of the two modules owns the value, export it from there, and import it here before this declaration goes away. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads no options. A consumer turns it on or off as a whole.

<!-- END GENERATED runtime -->
