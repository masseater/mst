---
description: "Disallow an import list whose order does not follow origin then specifier, so what a file depends on is read off the block boundaries instead of every specifier"
---

# no-unordered-import--group-by-origin-then-sort-by-specifier

<!-- BEGIN GENERATED rule-header -->

Disallow an import list whose order does not follow origin then specifier, so what a file depends on is read off the block boundaries instead of every specifier

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: no
- Shipped in the preset: yes
- Source: [`no-unordered-import--group-by-origin-then-sort-by-specifier.ts`](../../src/lint/oxlint/rules/no-unordered-import--group-by-origin-then-sort-by-specifier.ts)

<!-- END GENERATED rule-header -->

## Violation

An import list whose order does not follow origin, then specifier. The origins run in this order: the runtime's built-ins, the installed packages, this repository, then the type-only imports.

Four reports: an import of one origin sitting after a later origin, an import out of specifier order inside its own block, two blocks meeting with no blank line between them, and a blank line splitting one block.

## Fix

Put each import in the block its origin belongs to, sort each block by specifier, and separate the blocks with exactly one blank line.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// an installed package placed above a runtime built-in is reported
import { memoize } from "es-toolkit";

import { join } from "node:path";
```

```ts
// two blocks written without a blank line between them are reported
import { join } from "node:path";
import { memoize } from "es-toolkit";
```

Code this rule accepts.

```ts
// the four origins in order, each block separated by one blank line
import { join } from "node:path";

import { memoize } from "es-toolkit";

import { report } from "./report.ts";

import type { Entry } from "./entry.ts";
```

```ts
// a side-effect import carries no bindings and is left where its evaluation order puts it
import "./style.css";
import heroImage from "./assets/hero.png";
import { report } from "./report.ts";
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Splitting one origin across two blocks so each block reads as sorted
- Reaching a package through a relative specifier to move it into another block

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `originOutOfOrder` | An import of {{origin}} must not sit after an import of {{precedingOrigin}}. Move it up into an order that runs the runtime built-ins, the installed packages, this repository, then the type-only imports. |
| `specifierOutOfOrder` | \`{{specifier}}\` must not sit after \`{{precedingSpecifier}}\` inside the same block. Sort the block by specifier. |
| `missingBlankLineBetweenOrigins` | An import of {{origin}} must not sit directly under an import of {{precedingOrigin}}. Put one blank line between the two blocks. |
| `blankLineInsideOrigin` | A blank line must not split the imports of {{origin}}. Delete the blank line. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads no options. A consumer turns it on or off as a whole.

<!-- END GENERATED runtime -->
