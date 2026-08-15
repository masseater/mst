---
description: "Require every test block declaration to be rooted at one configured spelling, so a scan of the test surface settles what an identifier means without reading the block behind it"
---

# require-test-block-spelling--use-configured-fn

<!-- BEGIN GENERATED rule-header -->

Require every test block declaration to be rooted at one configured spelling, so a scan of the test surface settles what an identifier means without reading the block behind it

- Tool: `oxlint`
- Fixable: yes
- Suggestions: no
- Options: yes
- Bundle: `testing`
- Source: [`require-test-block-spelling--use-configured-fn.ts`](../../src/lint/oxlint/rules/testing/require-test-block-spelling--use-configured-fn.ts)

<!-- END GENERATED rule-header -->

## Violation

A test block declaration whose root is not the configured spelling. Two reports: the root written out as another name, and the root standing on a binding declared under another name. `blockSpelling` settles the canonical spelling and `runnerModules` names the modules a binding may come from; modifiers and curried forms are followed to the root.

An automatic fix renames the root, or the binding and its references, where that rename resolves and collides with nothing.

Hand `blockSpelling` the same value as [no-expect-outside-it--move-into-it-block](./no-expect-outside-it--move-into-it-block.md), which reads the same spelling from the other side.

## Fix

Rename the root of the declaration to the canonical spelling, and rename a fixture factory binding at its declaration and at every reference.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a bare block declared with the other injected spelling is reported and renamed
test("names a behaviour", () => {});
```

```ts
// a derived builder bound to another name is reported at the binding
const spec = test.extend({ subject: 1 });
spec("names a behaviour", () => {});
```

Code this rule accepts.

```ts
// a block declared with the required spelling is the form this rule asks for
it("names a behaviour", () => {});
```

```ts
// a derived builder bound to the required spelling is the agreed form
const it = test.extend({ subject: 1 });
it("names a behaviour", () => {});
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Declaring the block through a subscript or a name settled at run time, so no root can be read
- Importing the runner's block under another name and declaring through that

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `foreignBlockSpelling` | A test block must not be declared through \`{{written}}\`. Rename the root of this declaration to \`{{required}}\`. |
| `foreignBlockBinding` | A test block must not be declared through the binding \`{{written}}\`. Rename that binding to \`{{required}}\` at its declaration and at every reference to it. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
