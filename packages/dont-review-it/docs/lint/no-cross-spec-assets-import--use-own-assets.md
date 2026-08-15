---
description: "Disallow reading a test data file from anywhere but the spec of its own stem in its own directory, so the one spec that owns the data can rewrite it without silently changing what another file expects"
---

# no-cross-spec-assets-import--use-own-assets

<!-- BEGIN GENERATED rule-header -->

Disallow reading a test data file from anywhere but the spec of its own stem in its own directory, so the one spec that owns the data can rewrite it without silently changing what another file expects

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: yes
- Shipped in the preset: yes
- Source: [`no-cross-spec-assets-import--use-own-assets.ts`](../../src/lint/oxlint/rules/no-cross-spec-assets-import--use-own-assets.ts)

<!-- END GENERATED rule-header -->

## Violation

A file coupling to a test data file it does not own. A test data file is one named `<stem>.<marker>.<extension>`, where the marker defaults to `assets`; its owner is the spec of the same stem in the same directory, and nobody else may read it. A test data file is not itself read as a reader.

Static imports, re-exports, type-only forms and a dynamic `import` or `require` whose specifier settles before the run all count as coupling. The judgment runs on where the specifier resolves, so relative paths, workspace package specifiers and tsconfig `paths` reach the same answer, and a chain of re-exports is followed to what it forwards.

`assetsNameMarkers` and `specFileSuffixes` settle the vocabulary; hand them the same values as the other rules that read test data.

## Fix

Create a test data file of your own stem and write the values this file needs into it. Data duplicated between specs is the state this bundle asks for.

Where the reader is not a spec, the value is a production value: give it an owner as a production module and read it from there.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// another spec in the same directory is not the owner
import { rows } from "./order.assets.ts";
```

```ts
// a file that forwards the data is followed through to what it forwards
import { rows } from "./relay.ts";
```

Code this rule accepts.

```ts
// the owner is recognised through a specifier that carries no extension
import { rows } from "./order.assets";
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Placing a forwarding module between the reader and the data. Any number of forwarding layers is followed
- Reaching the file through a path alias or a package specifier. The judgment runs on where it resolves
- Putting a file of the same stem in another directory and calling it your own. Ownership is the directory and the stem together

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `crossSpecAssetsImport` | A spec must not read the test data file of another spec. \`{{specifier}}\` reaches \`{{assetsPath}}\`. Create a test data file of the stem \`{{ownStem}}\` beside this spec and write the values this spec needs into it. |
| `foreignAssetsImport` | A file that owns no test data file must not read one. \`{{specifier}}\` reaches \`{{assetsPath}}\`. Move the values this file needs into a module of its own and read them from there. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
