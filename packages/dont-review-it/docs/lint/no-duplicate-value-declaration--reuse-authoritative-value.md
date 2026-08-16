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
- Bundle: `single-ownership`
- Source: [`no-duplicate-value-declaration--reuse-authoritative-value.ts`](../../src/lint/oxlint/rules/single-ownership/no-duplicate-value-declaration--reuse-authoritative-value.ts)

<!-- END GENERATED rule-header -->

## Violation

A declaration whose name and body both match another value declaration in the repository, where at least one of the two is exported. Bindings, function declarations and class declarations are read, at any depth, and the kind of binding is not part of the body.

Bodies are compared as syntax with positions dropped. Names closed inside the declaration are normalised by order of appearance, so renaming a parameter changes nothing; a name arriving through an import is compared by the module and export it resolves to; property spellings are left as written. Both positions of a matching pair are reported, and test sources are outside the index.

## Fix

Read every position the report lists, settle which module owns the value, export it from there and import it everywhere else. Build the destination before deleting either side.

Choose the owner by whose responsibility the value is, not by which side is exported or written first.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// an exported value another file exports under the same name with the same body is reported
const MANIFEST_FILE_NAME = "package.json";
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Renaming parameters or local bindings. Names closed inside the declaration are normalised
- Rewriting `const` as `let`, or pushing the local declaration inside a function. Neither the binding kind nor the depth is read
- Moving one side into a test file. That the index skips tests is not a place to hide duplication

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
