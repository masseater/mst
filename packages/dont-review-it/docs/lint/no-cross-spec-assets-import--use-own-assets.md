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

A file in the repository coupling to a test data file that is not its own.

Whether a file is test data is settled by its name: the shape `<stem>.<marker>.<extension>`, where the marker is `assets` by default. What the extension is makes no difference, so `order.assets.ts` and `order.assets.json` are treated alike. The stem may carry dots of its own (the stem of `vite.config.assets.ts` is `vite.config`).

There is exactly one owner: **the spec file of the same stem in the same directory**. The owner of `order.assets.ts` is the `order.test.ts` beside it. A spec of the same stem in another directory is not the owner. This definition is shared with `require-spec-file-for-assets--create-matching-spec`, which carries "there is always an owner" while this one carries "nobody but the owner reads it".

Readers are not limited to specs. A production module, a script, a tool's configuration file — coupling from anywhere is reported. The invariant held is "nobody but the owner reads it", not "no other spec reads it", so the judgment does not turn on what kind of reader it is.

### What counts as coupling

- An `import` declaration, including a side-effect import binding nothing
- A named re-export (`export ... from`) and a star re-export (`export * from`)
- A type-only `import` or `export`. Carrying no value changes nothing about being tied to that file's shape
- A dynamic `import` or `require` whose module specifier is settled before the run. Where the specifier is a literal, a string bound to a `const` in the same file, or a template literal assembled from static parts alone, it is treated like an `import` declaration

The report stands on the statement or expression writing that coupling.

### How specifiers are resolved

The judgment is made on where a specifier resolves rather than on how it is spelled. Watching relative specifiers alone would let one layer of aliasing reach data outside the owner.

- Relative specifiers. Forms with no extension, forms omitting `index`, and forms spelled with a built extension (`.js`, `.mjs`, `.cjs`) all resolve to the file that exists
- Package specifiers. `node_modules` is walked upward from the reader's position to a package inside the workspace. Subpaths declared through `exports` and deep paths that bypass the declaration are both followed
- tsconfig `paths`. The `tsconfig.json` nearest the reader is read, and where it declares nothing, what it `extends` through a relative specifier is followed. Where several wildcard declarations match, the one with the longest leading match is taken

Where a specifier resolves to a forwarding file, what that file re-exports is followed, and reaching test data is reported. Any number of forwarding layers is followed.

### The invariant

With exactly one reader, that spec is free to rework its own test data. Adding a value or changing the shape reaches no further than that one file.

The moment a second reader appears, that property is gone. Fixing the data for one side quietly changes the other's expected values, the change is invisible from the editing side, and the breakage is noticed when an unrelated test fails. What was the owning spec then cannot touch its own data without checking the other tests. The problems shared setup brings arrive intact, and "it is only data" exempts none of them.

Test data was allowed outside the spec because large static data in the spec body makes the contract unreadable, not so it could be reused across tests. This rule separates putting it outside from sharing it.

Readers being unrestricted follows for the same reason: where a production module reads test data, that data has stopped being a value tests may freely rewrite.

### Where detection does not reach

- Only re-exports are followed as forwarding. A file that imports test data and redeclares it under another name is itself reported as a reader that is not the owner, and it stops there. Readers are not traced further back
- A specifier going through a subpath a package's `exports` declared with a wildcard (the `"./data/*"` shape) cannot be followed, because which file it lands on is not expanded. Subpaths carrying no wildcard, and deep paths that bypass the declaration, are followed
- Installed packages are resolved by real path, following symbolic links. Where the repository itself sits under a symbolic link, coupling through a package specifier cannot be followed
- Subpath imports opening with `#` are not resolved
- A dynamic `import` whose specifier is settled only at run time, taking a variable or a string assembled while running, cannot be reported. Which file it couples to is settled only by a run-time value. Not being detected does not mean that spelling is allowed

### Configuration

- `assetsNameMarkers` (optional, a list of strings): the marker a test data file's name carries. Defaults to `assets`, and naming it **replaces** the default. `require-spec-file-for-assets--create-matching-spec` and `require-test-assets-constants--move-setup-to-spec` read the same vocabulary, so hand all three the same value
- `specFileSuffixes` (optional, a list of strings): the spec file suffixes. Defaults to `.test.ts` and `.test.tsx`, and naming it replaces the default. Who the owner is, and which shape the report is phrased in, follow from this vocabulary

```jsonc
["error", { "assetsNameMarkers": ["assets"], "specFileSuffixes": [".spec.ts"] }]
```

There is no setting for permitting particular non-owner readers. Making exceptions writable as configuration would create a route where whoever received a report adds an exception instead of making their own data, and shared test data comes back through it.

## Fix

Create a test data file of your own stem and write the values you need there. Data being duplicated across tests is the correct state in this bundle, not something to reduce. Where the values are small, write them straight into the spec without a file.

Where the reader is not a spec, the value is a production value. Take it out of the test data, settle an owner for it as a production module, and read it from there.

Where the report came through a forwarding file, there are two places to fix. The forwarding file is itself reported as a reader that is not the owner, so delete the forwarding and let each reader hold its own data.

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
// the spec of the same stem in the same directory owns the test data it reads
import { rows } from "./order.assets.ts";
```

```ts
// the owner is recognised through a specifier that carries no extension
import { rows } from "./order.assets";
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Making a shared test data file and reading it from several specs. What is watched is somebody other than the owner reading it, not how many readers there are
- Rewriting it as a dynamic `import` or `require`. As long as the specifier is settled before the run, it is reported as the same coupling
- Placing a forwarding file that re-exports another stem's test data. Any number of forwarding layers is followed
- Reading it through a path alias or a package specifier. The judgment is made on where it resolves, not how it is spelled
- Placing a test data file of the same stem in another directory and claiming it as your own. Ownership is settled by the directory and the stem together
- Assuming it is out of reach because the reader is not a spec. What kind of reader it is does not matter
- Silencing it with a suppression directive

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
