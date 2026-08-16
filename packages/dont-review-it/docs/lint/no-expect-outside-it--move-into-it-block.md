---
description: "Disallow an assertion standing anywhere other than inside a test block the runner handed over under the configured spelling, so every assertion a suite runs answers for the behaviour one named block describes"
---

# no-expect-outside-it--move-into-it-block

<!-- BEGIN GENERATED rule-header -->

Disallow an assertion standing anywhere other than inside a test block the runner handed over under the configured spelling, so every assertion a suite runs answers for the behaviour one named block describes

- Tool: `oxlint`
- Fixable: yes
- Suggestions: no
- Options: yes
- Bundle: `testing`
- Source: [`no-expect-outside-it--move-into-it-block.ts`](../../src/lint/oxlint/rules/testing/no-expect-outside-it--move-into-it-block.ts)

<!-- END GENERATED rule-header -->

## Violation

An assertion, or an assertion-count declaration, standing anywhere but inside a test block declared under the canonical spelling. `blockSpelling` settles that spelling and defaults to `it`; hand it the same value as [require-test-block-spelling--use-configured-fn](./require-test-block-spelling--use-configured-fn.md).

The innermost enclosing block carrying a callback is the one read, and the reports divide five ways: a runner block under another spelling, a canonically spelled block declared by a binding the runner never handed over, a grouping block, no enclosing block at all, and a stray assertion count.

A block counts as the runner's when its root is a globally injected `it` or `test` nobody shadowed, a binding imported from the runner under one of those names, or a binding built by applying `.extend(...)` to an imported binding. An automatic fix renames a block's root to the canonical spelling where that rename resolves and collides with nothing.

## Fix

Move the assertion into an `it` block that names the behaviour it checks, and declare the block through the runner's `it` or through a factory derived from `test.extend(...)`.

An assertion count moves into the block whose assertions it counts, or goes away.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// an assertion written straight into a grouping block names no behaviour
describe('sums', () => { expect(sum).toBe(3); });
```

```ts
// an assertion in a helper declared beside the suite stands in no block at all
const check = (total) => { expect(total).toBe(3); };
```

Code this rule accepts.

```ts
// an assertion in the body of the canonical test block is where the rule wants it
it('adds', () => { expect(sum).toBe(3); });
```

```ts
// a fixture factory bound to the canonical spelling declares canonical test blocks
const it = test.extend({ subject: 1 });
it('adds', ({ subject }) => { expect(subject).toBe(1); });
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Folding the assertion into a helper and calling it from the block. It is reported where it is written
- Rebinding the assertion entry, or the canonical spelling, to a name of your own. Both are followed to what they reach
- Declaring the block through a subscript or a name settled at run time

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `foreignTestBlockAssertion` | An assertion must not stand in a test block declared through \`{{written}}\`. Rename the root of that declaration to \`{{required}}\`. |
| `shadowedTestBlockAssertion` | An assertion must not stand in a block declared through a binding of \`{{required}}\` that the test runner never handed over. Declare the block through the \`{{required}}\` the runner injects, or through a fixture derived from it. |
| `groupingBlockAssertion` | An assertion must not stand in the block declared through \`{{written}}\`. Move this assertion into an \`{{required}}\` block that names the behaviour it checks. |
| `detachedAssertion` | An assertion must not stand outside a test block. Move this assertion into the \`{{required}}\` block that names the behaviour it checks. |
| `strayAssertionCount` | An assertion count must not be declared outside a test block. Move this declaration into the \`{{required}}\` block whose assertions it counts, or delete it. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
