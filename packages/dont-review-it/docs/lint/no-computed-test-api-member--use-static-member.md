---
description: "Disallow reaching a member of the test block API or the assertion entry through a subscript, so every rule reading the suite settles what a call means from the name the source spells out"
---

# no-computed-test-api-member--use-static-member

<!-- BEGIN GENERATED rule-header -->

Disallow reaching a member of the test block API or the assertion entry through a subscript, so every rule reading the suite settles what a call means from the name the source spells out

- Tool: `oxlint`
- Fixable: yes
- Suggestions: no
- Options: no
- Bundle: `testing`
- Source: [`no-computed-test-api-member--use-static-member.ts`](../../src/lint/oxlint/rules/testing/no-computed-test-api-member--use-static-member.ts)

<!-- END GENERATED rule-header -->

## Violation

A computed member access whose chain roots at a test block name or at the assertion entry. The root is followed through members, calls and tagged templates, so `test["each"](rows)("adds", fn)` and `expect(subject)["not"].toBe(1)` are both read.

Where the subscript spells a name the source settles, the report carries it and an automatic fix rewrites the access as a static member. Where the name settles only while the program runs, the report says so and no fix is offered.

## Fix

Write the member out as a static member.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a modifier written out as a subscript is reported and rewritten as a static member
it['skip']('adds', () => {});
```

```ts
// a matcher settled at run time is reported without a rewrite
expect(runSut())[matcher]({ total: 1 });
```

Code this rule accepts.

```ts
// a modifier written as a static member is the shape this rule asks for
it.skip('adds', () => {});
```

```ts
// a subscript on a value the suite owns is outside this rule
it('adds', () => {
  expect(runSut()[key]).toBe(1);
});
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Moving the member name into a variable. That is the shape no rule can read at all
- Reaching the same member through a helper that takes the name as an argument

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `spelledSubscript` | A member of the test block API or the assertion entry must not be reached through a subscript. This one spells \`{{member}}\`. Write it as a static member. |
| `unreadableSubscript` | A member of the test block API or the assertion entry must not be reached through a subscript. This one settles its name while the program runs, and no rule can read the member it stands for. Write the member you mean as a static member. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads no options. A consumer turns it on or off as a whole.

<!-- END GENERATED runtime -->
