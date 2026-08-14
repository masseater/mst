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
- Shipped in the preset: yes
- Source: [`no-computed-test-api-member--use-static-member.ts`](../../src/lint/oxlint/rules/no-computed-test-api-member--use-static-member.ts)

<!-- END GENERATED rule-header -->

## Violation

A member access written as a subscript (a `MemberExpression` that is `computed`) whose chain has one of these at its root:

- The root of a test block declaration coming from the test runner
- `test.extend(...)` and the chain growing out of it
- The `expect` binding that is the entrance to assertions, and the chain of matchers following its call

The root is settled by descending from the left of the subscript through `object`, `callee` and a tagged template's `tag` until an identifier is reached. The descent consults no table of modifier or matcher names, so a name outside the vocabulary standing in the middle, or a middle step that is itself a subscript, never loses the root. What is being detected is a shape rather than a name, so this rule does not depend on how "the set of names treated as test block modifiers" gets settled.

The judgment of the root rides on the shared binding tracking (`src/lint/oxlint/lib/spec-syntax/test-block-declarations.ts`): `testBlockBindings()` on the test block side and `assertionEntryBindings()` on the assertion entrance side, both tracking the same way:

- The globally injected spellings (`it` and `test` for test blocks, `expect` for the assertion entrance)
- Bindings importing those spellings, renamed imports included
- Local bindings initialised from either of the above, or from the result of `test.extend(...)`. Rebinding from binding to binding is followed to any depth

Whether it is called makes no difference. Taking the member as a value (`const held = it['skip'];`) is the same violation. Two subscripts in one chain raise two reports, each standing at its own subscript. Reports are raised after the file's bindings have all been read, so a subscript written above the declaration of the binding it stands on gives the same result.

Whether the subscript's name can be read statically is not a condition of detection. Where it can, the spelling rules and `forbid-it-extend--use-test-extend` resolve it as a name and report on top of this, and that is correct: a violation of the shape and a violation of the name are different defects.

### What is deliberately left out of reach

| Shape | Why it is not a target |
| --- | --- |
| `it.skip`, `test.extend`, `expect(...).toBe` | Not subscripts. The name as written is the final property name |
| `runSut()[key]` | A subscript into the output of the code under test. The chain's root is not a test API |
| `rows[0]` | An array element access. As above |
| `runner.it[member]` | The root does not resolve to an identifier. A structure bringing the test API in through a namespace import means rebuilding the shared definition |
| `this.#skip` | Private field syntax is not a subscript |
| `describe[member]` | Grouping blocks are not among the test APIs this rule watches |
| A subscript after `const held = expect.soft;` | The binding tracking follows rebinding of identifiers and derivation through `extend`, and a binding that took a member out does not reach the root |

No filtering by file kind is done. Which files this rule reaches is settled by the glob in the shared lint configuration.

### The invariant

For member accesses on the test block API and on `expect`, the name written in the code is the final property name.

The first layer is the ground the other rules of this bundle stand on. The spelling rules, `forbid-it-extend--use-test-extend` and `no-vitest-context-expect--import-expect-from-vitest` all hold their invariants by deciding which API is being called under which name. A subscript moves the entrance of that decision one step away. With a string literal the name is still readable, and reading it would mean every rule carrying its own branch for resolving subscripts, which undoes the reason the judgment was put in one place.

The second layer is what happens when the name is settled only at run time. With a variable or an expression as the subscript, no rule can settle what that step does. A rule that cannot settle it does not miss the violation — it answers that there is no violation. No report and no violation become indistinguishable, and green stops being evidence.

So chasing the resolution was abandoned and the shape itself is forbidden. Remove the room for a name to be settled at run time and the other rules can run on the premise that the names written are all there is. Writing a modifier or a matcher as a subscript is never necessary in test code, so forbidding it costs nothing.

### Configuration

None. Whether the rule is on or off is settled by the configuration, and nothing else about the judgment is.

No setting expresses an exception allowing subscripts. Such a setting would itself become the route by which a configuration value decides which members may be written as subscripts, moving "settle the name at run time" somewhere else rather than removing it.

## Fix

Rewrite the subscript as a static member access. What this repository's tests already do is the fixed shape.

```ts
it.each(rows)("adds %i", (row) => {});
expect(runSut()).toStrictEqual({ total: 1 });
```

Where the subscript is a string literal, or a template literal carrying no expression, and the name can be written as an identifier, an automatic fix is offered. The replacement touches the subscript alone and needs nothing from the writer's intent. A form linked with `?.` keeps its `?.`.

Where a variable or an expression was the subscript, or where the name cannot be written as an identifier, no automatic fix is offered. Which modifier or matcher was intended has to be written into the code, and that decision belongs to the writer.

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

- Rebinding the test block or `expect` into another variable first and writing the subscript there. The binding tracking follows rebinding to any depth, so the root and the judgment are unchanged
- Rewriting a string literal subscript as a template literal subscript carrying no expression. Both are read the same way
- Turning the subscript into an expression to escape the judgment on the name. It merely stops being readable as a name, and this rule fails the shape
- Mixing a subscript into the middle of a chain carrying modifiers. The judgment holds at any step of the chain
- Silencing it with a suppression directive. This shape is a discipline over the whole suite and does not come off for one file's convenience

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
