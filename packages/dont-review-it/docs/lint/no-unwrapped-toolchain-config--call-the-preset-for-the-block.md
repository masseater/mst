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

A `lint` or `fmt` block handed to Vite+'s `defineConfig` that is not what the matching preset function returns. Written directly, the block restates the rule set, the formatting decisions and what git is told to ignore, and each restatement drifts on its own.

## Fix

Wrap the block in the preset function for it, keeping the additions where they are.

```ts
export default defineConfig({
  lint: dontReviewItPreset.lint({ rules: { "no-console": "error" } }),
  fmt: dontReviewItPreset.fmt(),
});
```

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

- Spreading the preset's result into a literal instead of calling it for the block. What the preset adds later never arrives
- Building the block elsewhere and handing over the binding

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
