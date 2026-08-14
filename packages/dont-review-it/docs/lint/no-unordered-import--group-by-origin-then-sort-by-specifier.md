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

The run of import declarations at the head of a file, read against two rules.

**The order of the origin blocks.** Imports fall into four blocks by origin, standing in this order:

1. Built into the runtime (specifiers opening with `node:`)
2. Installed packages (specifiers that are not relative)
3. Modules inside this repository (specifiers opening with `.`)
4. Type-only imports (those written as `import type`)

Exactly one blank line or more stands between blocks, and none inside a block. A blank line is judged by the gap between the line where the previous declaration ends and the line where this one begins, so an import folded across several lines does not move the boundary.

**The order inside a block.** Specifiers are sorted ascending as lowercased strings. The type-only block sorts by origin first (built-in, then installed, then this repository) and by specifier within that, so the ordering the origins give the value imports is kept inside the type block as well.

Modules above this directory (`../`) and beside it (`./`) are not separate blocks. Sorting by specifier puts `../` before `./` anyway, so the order falls out of the string comparison.

An import carrying no bindings — `import "./style.css";` for its side effect — is left out of the ordering check. The order it is evaluated in carries meaning of its own, and reordering it would change what happens.

### The invariant

What a file reaches out to can be told without reading the specifiers one at a time.

The first layer is the cost of reading. With origins mixed together, telling whether the file depends on the runtime, on external packages, or stays inside the repository takes reading every specifier. With the blocks separated, looking at where the boundaries fall is enough. The difference is small in one file, and checking which way dependencies run is something a reader does over and over, so it adds up by the count.

The second layer is the cost that shows up in the history. With no settled order, where an import gets added varies by writer. Two people adding the same line in two places leaves both after a merge. The duplicate is syntactically fine, and neither the type check nor the run says anything, so it is noticed by whoever reads next. With one settled order, the same import lands on the same line and surfaces as a conflict at merge time.

The value of this rule, then, looks like readability and is really about closing a route by which the same thing gets into two places. The blank lines are part of the rule for the same reason: if the boundaries move by writer, so do the blocks.

### Configuration

None. Whether the rule is on or off is settled by the configuration, and nothing else about the judgment is.

The blocks and their order are not settable, because the value of this invariant lies in the same origin standing in the same position in every file. If each workspace could pick a different order, a reader would have to check that order every time they opened a file, and the premise that looking at the boundaries is enough would be gone.

## Fix

Split by origin, put one blank line between the blocks, and sort inside each block by specifier.

```ts
import { join } from "node:path";

import { memoize } from "es-toolkit";

import { report } from "./report.ts";

import type { ESTree } from "@oxlint/plugins";
```

The rule offers no automatic fix of its own, and there is no need to fix it by hand: `vp fmt` is configured to emit exactly this order, so `vp check --fix` and the pre-commit hook do it. The settings live in `fmt.sortImports` in `vite.config.ts` and emit the origin blocks, the ascending order inside them and the blank lines between them in the same shape this rule reads.

Reordering will not change evaluation order. Imports carrying no bindings do not move, because oxfmt's `sortSideEffects` is off by default, and this rule does not read them either.

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

- Routing the specifier through a re-export module under another name to fake its origin. The ordering check passes while the direction of the dependency is unchanged
- Rewriting it as a form that binds nothing, to leave the check. Imports without bindings are out of reach to preserve evaluation order, not as a way around
- Dropping the import into a dynamic import inside a function to remove it from the head. When it loads changes, and static analysis stops being able to follow the dependency
- Disabling the lint at the site

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
