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
- Shipped in the preset: yes
- Source: [`no-module-scope-mutable-state--lift-into-fixture.ts`](../../src/lint/oxlint/rules/no-module-scope-mutable-state--lift-into-fixture.ts)

<!-- END GENERATED rule-header -->

## Violation

A binding declared outside a test being written from inside a test, in a test declaration file.

"Inside a test" is these three. The judgment runs on AST containment rather than on how scope looks, and the range is the whole function node, parameters included.

1. A fixture function
2. A test block's callback
3. A setup hook's callback

"Outside a test" means any position contained in none of those three. The module's top level, a `describe` body, a binding receiving a hoisted container (`vi.hoisted`), and a binding taken in from another module all land here.

### The two families counted as writing

| Family | What is read |
| --- | --- |
| Rebinding | Assignment to and update of a binding declared with `let` or `var`. The left side of a destructuring, its defaults and its rest element are read as left sides too |
| Writing the value | Whatever the declaration kind: adding, rewriting or deleting a property of the value the binding points at, and calls to standard methods that change the contents |

The standard methods that change contents are thirteen — `add`, `clear`, `copyWithin`, `delete`, `fill`, `pop`, `push`, `reverse`, `set`, `shift`, `sort`, `splice`, `unshift` — sharing one vocabulary gathering the destructive operations of arrays, `Map` and `Set`. A string-literal subscript and a template-literal subscript with no substitution are read as names, so `entries['push']()` is treated as `entries.push()`. Wrapping in a type assertion, `satisfies`, a non-null assertion or an optional chain is peeled before the judgment.

### Where the report stands

The report stands on the writing side. A declaration is no violation unless it is written to. The declaration's position rides along in the message: a line number for a declaration in the file, and the module specifier it came from for an imported binding.

Where the declaration lives in a module outside the spec and the spec imports and writes to it, the report stands too. The declaration side is followed to write the position, not to bring the declaring module under the discipline.

The range is limited to test declaration files: only files ending in `.test.ts` or `.test.tsx` are read.

### Deliberately not widened

| Shape | Why it is left out |
| --- | --- |
| A read-only reference. A frozen value, a literal constant, a type | There is no write. The declaration's position is not the issue |
| Writing a binding declared inside a fixture | A fixture is re-evaluated for each test, so its instance is not shared between tests |
| Declaring at the top level, initializing at the top level and never touching it again | The writing side is not inside a test. The walk reads only what is written inside a test |
| Creating mocks and settling their behaviour | [no-module-scope-mock-config--lift-into-fixture](./no-module-scope-mock-config--lift-into-fixture.md) takes it. An assignment whose right side reaches the mock namespace is excluded |
| Writes to the file system | [no-local-file-system-mock--use-shared-fs](./no-local-file-system-mock--use-shared-fs.md) takes it. File APIs are not in the destructive-operation vocabulary |
| A write on a receiver that reaches no binding (`openLedger().calls = 1`) | The instance being written is tied to no declaration in this file. What cannot be identified is not swept in |
| A write through `Object.assign` or `Reflect.set` | The target arrives as an argument rather than as the receiver. The walk reads the receiver |
| A write closing inside a file that is not a spec | The code under test or a shared setup writing its own state is not this discipline's concern |

### The invariant

The state a test writes exists for that test alone.

The first layer is sharing. Tests are written assuming they run in parallel both per file and per test block inside one file. A binding placed outside a test is one instance every test in the file touches at once. An element one test pushed, and a property it rewrote, are visible to the next test — and what "the next test" is changes from run to run, so the failure appears in a form that does not reproduce.

The second layer is that this discipline covers the mutable state that is not a mock. Fix the placement of mocks to fixtures and the route for building the same sharing out of a plain object or array is still open. Putting one array in a hoisted container and piling records into it from fixtures contains not one mock creation call, so a placement rule for mocks does not see it. Forbidden in prose alone, that spec keeps passing the checks.

The third layer is that the fix is not a question of declaration kind. Make it `const`, freeze it — the instance is still one. The route that writes the value a binding points at is open regardless of the declaration kind. Only changing where it is placed restores the invariant.

### Configuration

None. Where mutable state is placed is not something a configuration may loosen. The test declaration file suffixes, the mock namespace spelling and the destructive-operation vocabulary are all held fixed by this rule.

## Fix

Move the binding into a fixture and have the fixture return that instance. The test receives it as a parameter.

```ts
const it = test.extend("entries", () => {
  const entries = [];
  entries.push("opening");
  return entries;
});

it("records the entry", ({ entries }) => {
  entries.push("closing");
  expect(entries).toStrictEqual(["opening", "closing"]);
});
```

A counter or a record you want to accumulate across tests carries an intent that does not sit with parallel execution at all. Rework it into a shape that finishes counting inside the test that reads the number.

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

- **Wrapping the binding in an object property and making it `const`.** Writing the contents leaves the sharing exactly as it was, and the family that ignores declaration kind reports it
- **Freezing it and calling the writing prevented.** Freezing only turns it into a run-time failure; the placement is unchanged
- **Interposing a getter or setter to hide the write.** It is read the same as an assignment to a property
- **Putting the instance in a hoisted container and only touching it from the fixture.** The binding receiving the container is outside a test, so writes to it are reported
- **Pushing it out to another module and importing it.** Where a spec writes to an imported binding, the report stands with the source module named in the message
- **Wrapping in a type assertion or a non-null assertion.** Wrappers are peeled before the judgment
- **Writing it as a destructuring or a subscript.** Left-side patterns are followed to their leaves, and statically readable subscripts are read as names
- **A suppression directive.** [no-rule-suppression--fix-the-violation](./no-rule-suppression--fix-the-violation.md) reports it

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
