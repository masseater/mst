---
description: "Require the lint and fmt blocks of a Vite+ configuration to be what the matching `dontReviewItPreset` function returns, so the rule set, the formatting decisions, and what git is told to ignore all arrive without the caller restating them"
---

# no-unwrapped-toolchain-config--call-the-preset-for-the-block

<!-- BEGIN GENERATED rule-header -->

Require the lint and fmt blocks of a Vite+ configuration to be what the matching `dontReviewItPreset` function returns, so the rule set, the formatting decisions, and what git is told to ignore all arrive without the caller restating them

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: no
- Shipped in the preset: yes
- Source: [`no-unwrapped-toolchain-config--call-the-preset-for-the-block.ts`](../../src/lint/oxlint/rules/no-unwrapped-toolchain-config--call-the-preset-for-the-block.ts)

<!-- END GENERATED rule-header -->

## Violation

A `lint` or `fmt` block, in the object handed to Vite+'s `defineConfig`, whose value is not a call to the preset function matching that block (`dontReviewItPreset.lint(...)` and `dontReviewItPreset.fmt(...)`).

`defineConfig` is identified through the imports. Only names that came in from `vite-plus` are read, so a named import (`import { defineConfig } from "vite-plus"`) and a namespace import (`vitePlus.defineConfig` against `import * as vitePlus from "vite-plus"`) are caught alike. Renaming it locally changes nothing, because the binding is followed. A `defineConfig` from anywhere else is a different function and is not a target.

The preset is identified the same way: only a `dontReviewItPreset` that came in from `@mst/dont-review-it` is accepted. Reaching it through a namespace or under another name is accepted, while a value of the same spelling from another module, some other call such as `Object.freeze(...)`, and handing over a variable by name (`defineConfig({ lint })`) are all refused. Whether a value went through the preset can only be settled from the call written there.

The member being called has to match the block's name. Placing `dontReviewItPreset.lint(...)` on `fmt` did go through the preset while returning a different kind of configuration, so it is reported. A computed member (`dontReviewItPreset["lint"]`) does not settle statically and is not accepted.

A key is read the same whether it is an identifier or a string literal (`"lint"`). Computed keys are out of reach.

A configuration writing neither `lint` nor `fmt` is not reported. A workspace's `vite.config.ts` normally writes only `pack`, and there is no reason to make it add an empty `lint`. What this rule holds is "if you write one, it goes through the preset", not "you must write one".

### The invariant

Two things are held: that the linter and the formatter do not go reading what git said to ignore, and that this repository's rule set and formatting choices arrive without the caller copying them out.

oxlint respects the repository's `.gitignore` and `$GIT_DIR/info/exclude` while walking, and the one thing it does not read is the machine-wide ignore that `core.excludesFile` points at. So an agent's working directory, or a personal scratch space — anything ignored through the local global settings rather than written into the repository — walks straight into the lint targets. The formatter does the same, rewriting the contents of a directory that was supposed to be ignored.

`ignorePatterns` is what closes that gap, but oxlint discards the `ignorePatterns` of a configuration named through `extends` and uses only what the extending side wrote. `rules`, `overrides` and `plugins` are inherited; `ignorePatterns` alone is not. However well the preset is arranged, this list of patterns cannot be handed out through `extends`. It has to be carried by the object handed directly to `defineConfig`.

oxfmt has no `extends` at all, so the formatting choices likewise have to be carried by the object handed directly to `defineConfig`.

The two functions of `dontReviewItPreset` gather everything that only works on a directly handed object and return it: a pattern list built from git's ignore settings (global, then `$GIT_DIR/info/exclude`, then the repository's `.gitignore`, ordered to match gitignore's last-match-wins), the rule set for `lint`, and the formatting choices for `fmt`. There is nothing for the caller to write, and this rule reports only when the call is forgotten.

The gap to close is the one global route, and all three routes are read, because priority between patterns is settled across the routes. Without them in one list, there is no way to express a repository-side `!` cancelling something the global side specified.

Forgetting the preset leaves the lint green. Files that should have been ignored multiply and no rule reaches them, and none of it surfaces as a failure. There is no occasion for a human to notice, so a machine watches.

### What is not a violation

- A configuration carrying neither `lint` nor `fmt`
- An object that never reaches `defineConfig`. A value that merely carries a key named `lint` is not a configuration
- A call to a `defineConfig` imported from anywhere other than `vite-plus`
- A call through a `dontReviewItPreset` imported under another name. The spelling does not matter as long as the binding is the same

### Configuration

None.

## Fix

Wrap the block in the preset function carrying that block's name. Extra rules and settings can be handed to it as arguments.

```ts
import * as dontReviewIt from "@mst/dont-review-it";
import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: dontReviewIt.dontReviewItPreset.fmt(),
  lint: dontReviewIt.dontReviewItPreset.lint({
    rules: {},
  }),
});
```

To write `ignorePatterns` of your own as well, hand them over as they are. The preset only puts the git-derived patterns in front, so the hand-written ones that follow take priority. Adding another preset to `extends` works the same way: what is handed over lines up behind this preset's own.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// both bare blocks are reported separately
import { dontReviewItPreset } from "@mst/dont-review-it";
import { defineConfig } from "vite-plus";
export default defineConfig({ fmt: {}, lint: {} });
```

```ts
// the preset function for the other block does not stand in
import { dontReviewItPreset } from "@mst/dont-review-it";
import { defineConfig } from "vite-plus";
export default defineConfig({ fmt: dontReviewItPreset.lint({}) });
```

Code this rule accepts.

```ts
// both blocks call the preset function that matches them
import { dontReviewItPreset } from "@mst/dont-review-it";
import { defineConfig } from "vite-plus";
export default defineConfig({ fmt: dontReviewItPreset.fmt(), lint: dontReviewItPreset.lint({ rules: {} }) });
```

```ts
// a configuration that declares neither block has nothing to wrap
import { dontReviewItPreset } from "@mst/dont-review-it";
import { defineConfig } from "vite-plus";
export default defineConfig({ pack: { entry: ["src/index.ts"] } });
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Copying out `ignorePatterns` or the rule set by hand instead of calling the preset. It is a copy of one moment and drifts the instant the preset changes, and the lint stays green while it drifts
- Assembling the configuration through some route that does not pass through `defineConfig`, to leave this rule's field of view
- A suppression directive

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `unwrappedLint` | The \`lint\` block handed to Vite+'s \`defineConfig\` must not skip \`dontReviewItPreset.lint\`. Wrap the block, keeping the additions where they are: \`lint: dontReviewItPreset.lint({ rules: { ... } })\`. |
| `unwrappedFmt` | The \`fmt\` block handed to Vite+'s \`defineConfig\` must not skip \`dontReviewItPreset.fmt\`. Wrap the block: \`fmt: dontReviewItPreset.fmt()\`. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads no options. A consumer turns it on or off as a whole.

<!-- END GENERATED runtime -->
