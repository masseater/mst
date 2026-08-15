---
description: "Disallow a fixture factory that stands on the test block spelling, so the name that declares test blocks carries that one role and everything scanning the suite can settle what that name means by reading it"
---

# forbid-it-extend--use-test-extend

<!-- BEGIN GENERATED rule-header -->

Disallow a fixture factory that stands on the test block spelling, so the name that declares test blocks carries that one role and everything scanning the suite can settle what that name means by reading it

- Tool: `oxlint`
- Fixable: yes
- Suggestions: no
- Options: no
- Bundle: `testing`
- Source: [`forbid-it-extend--use-test-extend.ts`](../../src/lint/oxlint/rules/testing/forbid-it-extend--use-test-extend.ts)

<!-- END GENERATED rule-header -->

## Violation

An `extend` member call whose base is a binding that reaches the test block spelling `it`. The base is followed through imports and through `const` bindings that hold another identifier, so an alias and a rebinding reach the same judgment.

An automatic fix replaces the base with `test` where the base is written out as `it` and that rename resolves in the same scope.

## Fix

Build fixture factories on `test` and leave `it` for declaring test blocks.

```ts
const it = test.extend("report", () => summarise(entries));
```

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// the fixture builder on the test block spelling is reported and rewritten onto the base
it.extend({ subject: async ({}, use) => use(runSut()) });
```

```ts
// a rebinding of the test block spelling is followed to the spelling it came from
const check = it;
check.extend({ a: 1 });
```

Code this rule accepts.

```ts
// the fixture factory standing on test is the shape this rule asks for
const it = test.extend({ subject: async ({}, use) => use(runSut()) });
```

```ts
// a member other than the builder on the test block spelling is left alone
it.each([1, 2])('adds %i', () => {});
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Importing `it` under another name and extending that. The binding is followed to what it imports
- Binding `it` to a `const` first and extending the new name. `const` chains are followed

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `itExtend` | A fixture factory must not stand on \`it\`, the spelling reserved for declaring test blocks. Replace \`{{base}}\` with \`test\` and leave the rest of the chain alone. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads no options. A consumer turns it on or off as a whole.

<!-- END GENERATED runtime -->
