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
- Bundle: `testing`
- Source: [`require-test-assets-constants--move-setup-to-spec.ts`](../../src/lint/oxlint/rules/testing/require-test-assets-constants--move-setup-to-spec.ts)

<!-- END GENERATED rule-header -->

## Violation

An assets file carrying anything but `const` declarations of written-out data. Seven reports: an import, a re-export, an export statement standing away from its declaration, a type declaration, any other statement, a declaration binding a pattern, and a declaration holding a value assembled as the file loads.

`assetsNameMarkers` settles which files are read as test data.

## Fix

Write the data out as `const` declarations, each carrying its own `export`. Move the work behind an import, a type, or an assembled value into the fixture of the spec that owns the file.

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

- Assembling the value from parts as the file loads. That work belongs to the fixture
- Destructuring another value to declare the names here
- Re-exporting another module so the data arrives from elsewhere

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
