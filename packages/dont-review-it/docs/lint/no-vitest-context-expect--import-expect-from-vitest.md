---
description: "Disallow reading `expect` out of the context a test block hands its callback, so every assertion in the suite runs through the one `expect` the file imported from the test runner"
---

# no-vitest-context-expect--import-expect-from-vitest

<!-- BEGIN GENERATED rule-header -->

Disallow reading `expect` out of the context a test block hands its callback, so every assertion in the suite runs through the one `expect` the file imported from the test runner

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: no
- Shipped in the preset: yes
- Source: [`no-vitest-context-expect--import-expect-from-vitest.ts`](../../src/lint/oxlint/rules/no-vitest-context-expect--import-expect-from-vitest.ts)

<!-- END GENERATED rule-header -->

## Violation

Two shapes of taking `expect` out of the context, in the callback handed to a test block declaration.

The destructuring shape is an object pattern in the callback's first parameter carrying a key named `expect`. A key written as an identifier and one written as a string literal are the same, and renaming it changes nothing about the fact that it was taken out, so it is a target. A pattern carrying only a default (`({ expect } = {})`) is the same.

The member shape is a non-computed `.expect` on the identifier a callback received the context as, anywhere inside that callback. The judgment is not confined to the innermost callback: as long as the name was bound by an outer test callback, it is a target however many non-test functions such as an array traversal's callback stand in between, and inside a nested test block as well.

What counts as a test block declaration is settled in one place (`src/lint/oxlint/lib/spec-syntax/test-block-declarations.ts`). A call is a declaration when its root is any of these:

- A globally injected test block spelling (`it`, `test`)
- A binding importing a test block spelling, renamed imports included
- A local binding initialised from either of the above, or from the result of `test.extend(...)`. Rebinding from binding to binding is followed to any depth

The root is followed past modifier members (`skip`, `each` and the rest), table-driven calls and tagged templates, so this rule stands on its own even over code that violates the spelling rules.

The callbacks are every argument to the declaration that is a function. Options between the name and the callback, or a timeout after the callback, never cause a mix-up by position. Where the function is wrapped in a call, it is peeled to the function handed to that call.

### What is deliberately left out of reach

| Shape | Why it is not a target |
| --- | --- |
| `({ expect, ...rest })` | A destructuring carrying a rest is failed as a shape by `no-test-context-escape--destructure-fixtures-by-name` |
| `({ ["expect"]: assert })` | A computed key in a destructuring belongs to the same rule |
| `ctx["expect"]` | A subscript into the context, likewise. Settling a name at run time is failed by the rule watching that shape itself |
| The first parameter of a fixture factory | Not the callback of a test block declaration. The fixture's own context is watched by the rule above |
| The callback of a grouping block | Not a test block declaration |
| A namespace route such as `runner.it(...)` | The shared definition cannot resolve the root down to an identifier. A structure that brings the test API in through a namespace import means rebuilding that shared definition |
| A binding that is a test block API by type alone | The judgment runs on syntax; no type information is used |

No filtering by file kind is done. Which files this rule reaches is settled by the glob in the shared lint configuration.

### The invariant

There is one entrance to an assertion: the `expect` imported statically from the test runner.

The first layer is types. A custom matcher's type extension applies to the type of the imported `expect`. With a context-borne `expect` mixed in, tests where the extension applies and tests where it does not stand side by side in one suite, and which is which cannot be told without reading how the call site was written. Types not lining up does not surface until a run, so a writer can carry on under the premise that a matcher must be available.

The second layer is searching and renaming. Whatever mechanically tallies what a suite claims and where stands on `expect` being an imported binding. Without that premise the tally has to decide, every time, whether the identifier `expect` is the test runner's — and that decision is the same work these rules already do, written again. A context-borne `expect` falls through that net, and the tests that fall through show up in the tally as tests carrying no assertion. A miscount never turns red, so only the decisions trusting the tally drift, quietly.

This rule stands together with the configuration. It presumes a shared setup file registers the custom matchers against the imported `expect`, and only with that registration can "every test has the same matcher set and the same types" be said.

### Configuration

None. Whether the rule is on or off is settled by the configuration, and nothing else about the judgment is.

The canonical test block spellings and the test runner's vocabulary live in the rule itself. Letting a configuration move what counts as a test block would split the vocabulary from the other rules of this bundle, leaving one of them silently blind to its targets.

## Fix

Import `expect` from the test runner and leave only the fixtures actually used in the callback's parameter. What this repository's tests already do is the fixed shape.

```ts
import { parseSync } from "oxc-parser";
import { expect, test } from "vite-plus/test";
```

The fix is no different where the tests are declared through a renamed import or a builder derived from `test.extend(...)`. Whatever the declaration is spelled as, only where `expect` comes from moves to an import.

No automatic fix is offered, because fixing it requires adding an import statement and does not fit into replacing one token.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// taking expect out of the context is reported
it("names a behaviour", ({ expect }) => {
  expect(runSut()).toBe(1);
});
```

```ts
// reaching expect through the context binding is reported
it("names a behaviour", (ctx) => {
  ctx.expect(runSut()).toBe(1);
});
```

Code this rule accepts.

```ts
// asserting through the imported binding passes
import { expect } from "vitest";
it("names a behaviour", ({ subject }) => {
  expect(subject).toBe(1);
});
```

```ts
// taking fixtures apart by name passes
it("names a behaviour", ({ subject, options }) => {});
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Gathering into a rest and calling `expect` through that alias. It stops appearing as a destructuring key, and `no-test-context-escape--destructure-fixtures-by-name` fails the rest itself
- Walking the context's properties at run time to pull out something equivalent. As above
- Writing `ctx["expect"]` as a subscript. The judgment on the name falls away, and the same rule fails a subscript into the context
- Rebinding the context and reading `.expect` off the new name (`const inner = ctx;`). This rule reads only the name the callback bound, so the report clears. Use the context under the name it was received as
- Handing out a thin function wrapping `expect` as a fixture and destructuring that fixture in the test. Only the key's name changed, and the entrance to an assertion is still not an imported binding
- Silencing it with a suppression directive. The entrance to assertions is a discipline over the whole suite and does not come off for one file's convenience

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `destructuredContextExpect` | A test callback must not take \`expect\` out of the test context. Import \`expect\` from the test runner and leave the callback parameter holding only the fixtures this test uses. |
| `reachedContextExpect` | A test callback must not reach \`expect\` through the test context. Import \`expect\` from the test runner and call that binding. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads no options. A consumer turns it on or off as a whole.

<!-- END GENERATED runtime -->
