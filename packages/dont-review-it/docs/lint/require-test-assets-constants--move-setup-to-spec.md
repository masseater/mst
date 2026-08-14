---
description: "Require an assets file to carry nothing but const declarations of written-out data, so setup cannot leave the spec that owns it under the name of test data"
---

# require-test-assets-constants--move-setup-to-spec

<!-- BEGIN GENERATED rule-header -->

Require an assets file to carry nothing but const declarations of written-out data, so setup cannot leave the spec that owns it under the name of test data

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: yes
- Shipped in the preset: yes
- Source: [`require-test-assets-constants--move-setup-to-spec.ts`](../../src/lint/oxlint/rules/require-test-assets-constants--move-setup-to-spec.ts)

<!-- END GENERATED rule-header -->

## Violation

For each file judged to be an assets file, the shape of the whole file is read. Any top-level statement that is not "a `const` declaration, binding one identifier, whose initialiser is a written-out value" is reported. The declaration may carry `export`.

Whether a file is assets is settled by its name. By default the target is a name of the form `<stem>.assets.<extension>` — a file whose second-to-last dot-separated part is `assets`. One with an empty stem (`assets.ts` itself) is out of range. Directories play no part in the judgment, so it holds the same inside and outside a spec directory.

### What counts as a written-out value

- A literal
- An array literal and an object literal, where the elements and property values are recursively written out
- A template literal, where the embedded expressions are written out
- A written-out value wrapped in a type assertion, a `satisfies`, or a non-null assertion
- A written-out value carrying a unary operator (a negative number, say)
- **An identifier reference to a `const` declared in the same file**, where that `const`'s initialiser is written out

The last is settled by resolving the binding rather than by matching spellings. The `const` directly under the file is looked up by name and its initialiser meets the same judgment. Relays of several steps are followed too, and a chain leading back to itself stops there and is reported. Where a reference cannot be resolved to a written-out value, the report stands **at the reference** rather than at what it resolved to.

### What is reported

| Shape | Report |
| --- | --- |
| An `import` statement (a type-only import included) | `assetsImport` |
| `export ... from` and `export *` | `assetsReExport` |
| An `export { ... }` carrying no declaration | `assetsDetachedExport` |
| A type alias and an interface | `assetsTypeDeclaration` |
| A function, a class, an enum, a `let` / `var`, a declaration holding no value, a statement that runs | `assetsForeignStatement` |
| A declaration binding by destructuring | `assetsDestructuredBinding` |
| A call, a spread, a function expression, a read, a name that cannot be resolved | `assetsAssembledValue` |

`assetsForeignStatement` and `assetsAssembledValue` name in the message what was written there. A shape absent from the list falls back to the general phrasing of "a value this file assembles as it loads". The judgment is settled by **not** falling into the run of written-out shapes rather than by matching the list, so no syntax missing from the list passes through.

One declaration gets one report, standing at the first place found that is not written out. Fix one and the next appears.

### Deliberately not widened

| Shape | Why it is left out |
| --- | --- |
| A file that is not assets | The judgment runs on the file name. The same contents in a spec file are out of range, and the contents of a spec are held by another group |
| Whether the owning spec exists | That belongs to [require-spec-file-for-assets--create-matching-spec](./require-spec-file-for-assets--create-matching-spec.md) |
| Who is reading this assets file | That belongs to [no-cross-spec-assets-import--use-own-assets](./no-cross-spec-assets-import--use-own-assets.md) |
| A reference to a `const` written in another file | Referencing one takes an import, and the import itself is reported, so resolution has no need to reach into the neighbouring file |

### The invariant

The grounds for allowing assets outside the spec were that they are inert data. The moment an `import`, a type declaration or a generating step goes in, they become an executable setup placed outside the spec, and the boundary [no-dry-test-setup--inline-owned-setup](./no-dry-test-setup--inline-owned-setup.md) holds has been bypassed under the name of assets. The line — moving data out is allowed, moving setup out is forbidden — is held at the level of what the file contains.

There is another layer to the breakage. Once assets move to the side that runs, the several specs reading them share the result of one execution. Tests run in parallel by default, so shared mutable state and mock settings leak across spec boundaries. As long as they are inert data, no number of readers of the same value makes it depend on order.

Resolving bindings is done because the origin of a value can otherwise be hidden behind a name. Let a value settled only at run time be received into a name first and the claim "it is an identifier reference, so it is static" go through, and this judgment becomes a matter of form alone. That is why a name declared nowhere, and a global the runtime supplies (`undefined` and `NaN` included), do not count as written out. To express the absence of a value, write `null` or leave the property out.

### Configuration

- `assetsNameMarkers` (an array of strings, optional): the markers of names counted as assets. The default is the single `assets`, and naming it **replaces** the default. An entry is matched exactly against the second-to-last dot-separated part of the file name

```jsonc
["error", { "assetsNameMarkers": ["assets", "fixtures"] }]
```

This vocabulary is shared by the three rules that read assets. Give one of them a different spelling and the demand on the owner and the demand on the contents fall on different sets of files, so where the marker is changed all three take the same value.

There is no setting permitting individual exceptions. Where there are grounds for making one assets file executable, it is no longer assets but setup, and its place is inside the owning spec.

### Where the detection does not reach

This rule reads only the files oxlint visited. Where an assets file matching the naming convention sits outside the analysis, this syntax check does not run. Deriving the target set from the convention so that every assets file in the repository is visited is a duty of whoever wires this rule up, not of the rule body. As long as [no-cross-spec-assets-import--use-own-assets](./no-cross-spec-assets-import--use-own-assets.md) delegates the case of "the assets file is itself the writer" to this rule, a hole remains in that delegation until the wiring is done.

## Fix

Move the `import`, the types, the builders and the file system operations into the fixture of the spec that owns those assets. Leave literals alone in the assets file. Where a type annotation is wanted, the type is written by the spec that reads it.

Publishing takes only the shape of an `export` on the declaration. Declaring first and publishing together with `export { ... }` puts the declaration and the publication apart, making "what is in this file" a thing read in two places, so it is reported.

To keep a generated value as it stands, write the generated result out. Where it is too large to write out, it is past the size that belongs in assets and is a thing for the spec's fixture to assemble.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// an import is reported whatever it names
// in report.assets.ts
import { build } from "./builder.ts";
export const REPORT_ID = "a";
```

```ts
// a call that generates the value is reported
// in report.assets.ts
export const REPORT = buildReport();
```

Code this rule accepts.

```ts
// an assets file holding written-out literals is the shape this rule asks for
// in report.assets.ts
export const REPORT_ID = "a";
const COUNT = 2;
export const TOTAL = COUNT;
```

```ts
// a chain of constants this file declares resolves to written-out data
// in report.assets.ts
const NAME = "a";
const ID = NAME;
export const REPORT = { id: ID };
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Pushing the generating step into another file and importing it from the assets. The import itself is forbidden
- Naming the file something other than assets and placing it in a spec directory. [require-spec-or-assets-only-in-spec-directory--move-out-or-inline](./require-spec-or-assets-only-in-spec-directory--move-out-or-inline.md) reports it as a third kind of file
- Instead of writing the generated value out by hand, moving the generating step into production code outside the spec and importing it. It is forbidden all the same as an import from the assets
- Taking that assets file out of the analysis. The target set follows from the file naming convention
- Receiving a generated value through a global or a name supplied from outside and claiming it is written out because it is an identifier reference. A name whose binding cannot be resolved does not count as written out
- Relaying a name through several steps to push the origin further away. Relays are followed to the end
- A suppression directive

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `assetsImport` | An assets file must not import anything. This file imports \`{{specifier}}\`. Move the work behind that import into the fixture of the spec that owns this file. |
| `assetsReExport` | An assets file must not forward another module. This statement re-exports from \`{{specifier}}\`. Delete it and write out the data this file holds. |
| `assetsDetachedExport` | An assets file must not publish a name away from its declaration. This statement exports {{names}}. Write \`export\` on each declaration and delete this statement. |
| `assetsTypeDeclaration` | An assets file must not declare a type. This file declares \`{{name}}\`. Move the type to the spec that reads this file and keep the data here written out. |
| `assetsForeignStatement` | An assets file must not carry anything but a \`const\` declaration of written-out data. This file carries {{shape}}. Move it into the fixture of the spec that owns this file. |
| `assetsDestructuredBinding` | An assets file must not bind a pattern. This declaration takes its names out of another value. Declare each value on a \`const\` of its own and write that value out. |
| `assetsAssembledValue` | An assets file must not hold a value assembled as the file loads. This declaration holds {{shape}}. Move that work into the fixture of the spec that owns this file and write the settled value out here. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
