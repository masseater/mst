---
description: "Disallow a fixture handing back a subject assembled by reading same-named properties off another value, so an assertion compares the shape the code under test produced instead of a hand-written copy that goes stale on its own"
---

# no-fixture-copy-subject--yield-sut-output

<!-- BEGIN GENERATED rule-header -->

Disallow a fixture handing back a subject assembled by reading same-named properties off another value, so an assertion compares the shape the code under test produced instead of a hand-written copy that goes stale on its own

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: yes
- Shipped in the preset: yes
- Source: [`no-fixture-copy-subject--yield-sut-output.ts`](../../src/lint/oxlint/rules/no-fixture-copy-subject--yield-sut-output.ts)

<!-- END GENERATED rule-header -->

## Violation

For a fixture declaration in a spec file, how the object it hands over as the subject was assembled is read.

The files in scope are settled by the file name suffix. The default is `.test.ts` and `.test.tsx`, replaceable through `specFileSuffixes`.

Three positions are read: the expression reaching the `return` of the builder form `test.extend("name", factory)`, the first argument reaching `use` in the object form `test.extend({ name: (context, use) => use(subject) })`, and the value itself where a value rather than a function was handed over directly. `expect.extend(...)` shares the spelling but declares no fixture and falls out structurally.

### What counts as a copy

Where the subject resolves to an object literal, its properties are read one by one. Where even one of them has **a key name equal to the name of the property its value reads**, that object is reported as a copy. One report stands per subject object, naming every key that matched.

Both the subject itself and each property's value are followed one binding step. The step lands on a `const` in the fixture body and on a `const` directly under the file. So these are all read as one and the same shape.

- A literal written on the spot: `() => ({ total: source.total })`
- Put into a binding before handing over: `const copied = { total: source.total }; return copied;`
- Shorthand paired with a binding: `const total = source.total; return { total };`
- A binding named apart from the key: `const held = source.total; return { total: held };`

Names are read the same way on the key side and the read side. Dot notation, a string-literal key or subscript, and a template literal with no interpolation are treated as the same name. Parentheses, `await`, non-null assertions, optional chains and type assertions around the read are peeled before reading.

One matching key is enough to report because what makes something a copy is not "was all of it copied" but "is there a place tracing the original's shape". With one matching key, that one name is fixed to the original value's spelling, and there is a place that quietly goes stale when the original moves.

### Overlap with the neighbouring rule

An object literal written on the spot is, even when it contains same-named copies, still a shape the fixture assembled. [no-fixture-construct-in-use--yield-sut-output](./no-fixture-construct-in-use--yield-sut-output.md) may report it at the same time. The fix for an object containing same-named copies is held by this rule, so on receiving both reports, taking this rule's fix clears them both.

### Deliberately not widened

| Shape | Why it is left out |
| --- | --- |
| An object whose every property is named apart from the original | There is no place tracing the original's shape. That the fixture is assembling at all is taken by `no-fixture-construct-in-use--yield-sut-output` |
| Methods, and `get` / `set` | Name equality alone does not make a copy. What the body returns is not settled until it runs |
| An object built only out of spreads | There is no property to enumerate. Inline construction is taken by construct, and a spread of a fixture dependency by [no-fixture-forward-subject--yield-sut-output](./no-fixture-forward-subject--yield-sut-output.md) |
| Placing a destructured dependency straight onto a same-named key | The value is not shaped like a read. Forward takes it as a pass-through |
| A key or a subscript that settles only at run time | It cannot be read as a name |
| A read lying two or more binding steps away | The walk takes one step only |
| A copy handed over as the return of a call | The inside of the callee is not read |

The last two are information this reading does not hold rather than a convenience of the implementation. Not reaching does not mean it is allowed, so they are named in the forbidden bypasses section.

### The invariant

The object a fixture hands over as the subject is the shape the code actually produced.

An object reassembled by copying same-named properties is a hand-made replica of the original shape. When the original gains a field, is renamed, or loses one, the replica stays quietly in the shape it was written in. What the `it` compares is the replica, so the drift does not fail the assertion. What the test claims is "the shape I copied equals the expected value I wrote", and it says nothing about the shape the code produces.

There is one more layer. The moment a replica is interposed, that assertion moves toward never failing on a change to the code. A test that does not fail cannot be told apart from a passing test by any signal collected, because coverage sees only that execution reached it.

### Configuration

`specFileSuffixes`. The default is `.test.ts` and `.test.tsx`, sharing one range with the other rules of this bundle.

There is no setting for allowing individual copies. Make an exception expressible in configuration and a route opens where whoever received a report adds an exception instead of fixing it.

## Fix

Hand over the value the code produced as it stands, and write the comparison against the whole subject.

```ts
const test = baseTest.extend("declarations", () => moduleDeclarationsOf("report.test.ts", []));

test("carries the file it read and no declaration from an empty body", ({ declarations }) => {
  expect(declarations).toStrictEqual({
    filename: "report.test.ts",
    initializerByName: new Map(),
    importedByName: new Map(),
    localNameByExported: new Map(),
    forwardedByExported: new Map(),
    forwardedSpecifiers: [],
  });
});
```

Where a genuinely different subject is needed, build it in a shape that does not trace the original. Where only one name is worth copying, that is a demand to narrow the subject, so split the fixture or rework the value the code returns.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// an object written as the arrow body copies the shape it reads from
// in report.test.ts
const it = test.extend('report', () => ({ total: source.total }));
```

```ts
// renaming every key but one leaves the copy in place
// in report.test.ts
const it = test.extend('report', () => ({ count: source.entries, total: source.total }));
```

Code this rule accepts.

```ts
// a fixture handing back what the code under test produced carries its shape unchanged
// in report.test.ts
const it = test.extend('report', () => summarise(entries));
```

```ts
// an object whose every key is spelled apart from the value it reads is not a copy of a shape
// in report.test.ts
const it = test.extend('report', () => ({ count: source.total, at: source.recordedAt }));
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Interposing a binding to hide the copy. The subject and each property value are followed one step, so a `const` in the fixture body and a `const` directly under the file do not pass through
- Leaving one key and renaming all the rest, then claiming it is a different thing. One left is enough to report
- Moving the copy into the argument of `expect(...)`. [no-expect-synthetic-subject--yield-from-fixture](./no-expect-synthetic-subject--yield-from-fixture.md) takes it
- Stacking two or more bindings to put distance between the read and the key. It disappears from this reading, but the value handed over is still a replica
- Pushing the copy into another function and handing over that call's return. The callee is not read so the report clears, but the value handed over is still a replica
- Rewriting the key or the read into a form that settles only at run time. It merely stops being readable as a name; it is still a replica
- A suppression directive

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `copiedSubject` | A fixture must not hand back a subject assembled by reading same-named properties off another value. \`{{fixture}}\` reads {{properties}} into keys spelled the same way. Return the value the code under test produced, whole, and read the parts an assertion needs in the \`it\` body. Holding the copy in a binding before handing it back, and renaming every key but one, are reported all the same. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
