---
description: "Disallow a test writing to a binding declared outside every fixture, test block and setup hook, so the state a test changes belongs to that test alone rather than to the whole file"
---

# no-module-scope-mutable-state--lift-into-fixture

<!-- BEGIN GENERATED rule-header -->

Disallow a test writing to a binding declared outside every fixture, test block and setup hook, so the state a test changes belongs to that test alone rather than to the whole file

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: no
- Bundle: `testing`
- Source: [`no-module-scope-mutable-state--lift-into-fixture.ts`](../../src/lint/oxlint/rules/testing/no-module-scope-mutable-state--lift-into-fixture.ts)

<!-- END GENERATED rule-header -->

## Violation

A write, made from inside a fixture, a test block or a setup hook, to a binding declared outside all of them. Three shapes are reported: rebinding a name declared with `let` or `var`, writing into or deleting a property of a shared value, and calling a destructive operation on one. The report names where the binding was declared, including the module it was imported from.

An assignment whose right-hand side stands on the mock namespace is not read, because the runner owns that instance.

## Fix

Move the declaration into the body of the fixture the test takes its subject from and return it, so every test receives its own through a parameter.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a module scope let reassigned from the test block is one counter for the whole file
// in ledger.test.ts
let calls = 0;
it('counts the call', () => {
  calls = calls + 1;
  expect(calls).toBe(1);
});
```

```ts
// wrapping the counter in a const object keeps the single instance the file shares
// in ledger.test.ts
const held = { calls: 0 };
it('counts the call', () => {
  held.calls += 1;
  expect(held.calls).toBe(1);
});
```

Code this rule accepts.

```ts
// state built inside the fixture and handed back is the shape this rule keeps
// in ledger.test.ts
const it = test.extend('entries', () => {
  const entries = [];
  entries.push('opening');
  return entries;
});
```

```ts
// a module scope value that tests only read is not shared state anybody writes
// in ledger.test.ts
const opening = ['a', 'b'];
it('counts what it was given', () => {
  expect(!opening.length).toBe(false);
});
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Declaring the binding `const`, or freezing the value. The single instance is unchanged; freezing only moves the failure to run time
- Packing the state into an object, or hiding the write behind a setter
- Moving the declaration into another module. The sharing stands exactly where it was

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `sharedBindingRebound` | A binding declared outside every test must not be reassigned from inside one. \`{{name}}\` is declared at {{origin}}, and the whole file shares the single instance it names: what this test leaves behind is what the next test starts from, in an order that changes from run to run. Move the declaration into the body of the fixture the test takes its subject from and return it, leaving every test to receive its own through a parameter. Declaring it \`const\`, packing it into an object, hiding the write behind a setter, and moving the declaration into another module all keep the single instance and are reported the same way. A count meant to add up across tests belongs inside the one test that reads the number. |
| `sharedValueWritten` | A value declared outside every test must not be written into from inside one. \`{{name}}\` is declared at {{origin}}, and every test in this file reads and writes the one value it names: a property this test adds, replaces or deletes is still there for the next test, in an order that changes from run to run. Move the declaration into the body of the fixture the test takes its subject from and return it, leaving every test to receive its own through a parameter. \`const\` on the declaration does not stop this write, freezing the value only turns it into a failure at run time, and moving the declaration into another module leaves the sharing exactly where it stood. |
| `sharedValueChangedByCall` | \`{{member}}\` must not be called on a value declared outside every test. \`{{name}}\` is declared at {{origin}}, and the elements or entries this call adds, removes or reorders stay in the one value the whole file shares: the next test starts from whatever this test left behind, in an order that changes from run to run. Move the declaration into the body of the fixture the test takes its subject from and return it, leaving every test to receive its own through a parameter. Declaring it \`const\` and freezing it both keep the single instance; build the value this test needs inside the fixture instead. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads no options. A consumer turns it on or off as a whole.

<!-- END GENERATED runtime -->
