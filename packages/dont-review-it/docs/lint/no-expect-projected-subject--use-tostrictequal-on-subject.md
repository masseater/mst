---
description: "Disallow handing an assertion anything other than the bare binding a fixture produced, so one comparison of the whole subject catches a missing field, an added field and a renamed field alike"
---

# no-expect-projected-subject--use-tostrictequal-on-subject

<!-- BEGIN GENERATED rule-header -->

Disallow handing an assertion anything other than the bare binding a fixture produced, so one comparison of the whole subject catches a missing field, an added field and a renamed field alike

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: yes
- Shipped in the preset: yes
- Source: [`no-expect-projected-subject--use-tostrictequal-on-subject.ts`](../../src/lint/oxlint/rules/no-expect-projected-subject--use-tostrictequal-on-subject.ts)

<!-- END GENERATED rule-header -->

## Violation

An assertion in a spec file whose first argument to `expect(...)` is not a bare identifier.

The receiver is limited to what resolves to `expect(...)`, `expect.soft(...)` or `expect.poll(...)`. Whether `not`, `resolves` or `rejects` sits in between is irrelevant. What is judged is the value handed to `expect` — neither the matcher nor the expected value.

Type assertions, non-null assertions, optional chains, parentheses and `await` are peeled before reading. The subject of `expect(await report)` is `report`, treated as a bare identifier.

The report differs by the shape of the value handed over.

- A member expression (`expect(report.total)`) — `projectedSubject`
- An array literal (`expect([report.id, report.total])`) — `bundledSubject`
- A function written on the spot (`expect(() => summarise(entries))`) — `inlineFunctionSubject`
- A string, number or boolean literal, and a template with no substitution (`expect(2)`) — `writtenOutSubject`
- Any other expression: a comparison, a conditional, a logical expression, a template with a substitution, a spread — `derivedSubject`

### Shapes other rules take

These are not non-violations; another rule reports them, so this one does not.

- A call expression, a `new` expression, a tagged template — [no-expect-call-expression--yield-from-fixture](./no-expect-call-expression--yield-from-fixture.md) takes them
- An object literal — the rule forbidding a synthesised subject takes it

Of the shapes that are not a bare identifier, everything except those two is taken by this rule. That is the division that keeps a shape with no owner from arising structurally; this is not "the rule that reads member expressions".

Peeking at a mock's call record (`expect(send.mock.calls)`) is syntactically a member expression, so under this division it lands here. The intent belongs to [no-expect-mock-call-inspection--use-to-have-been-called-family](./no-expect-mock-call-inspection--use-to-have-been-called-family.md), but the report is not held back: the `projectedSubject` message carries the mock-oriented fix (receive the binding itself from the fixture and read it with `toHaveBeenCalledWith`).

### The exception

Sometimes a subject is so large that an exact match hides the intent rather than showing it. In that case only, a snapshot recording the whole root may stand in another `it`, leaving the projecting `it` to name that one point of intent.

Three conditions, all of which must hold for the report to be withheld.

- The projection's root is a binding the test block received from a fixture by destructuring. Receiving it under another name is fine as long as it reaches the same fixture
- An assertion applying a snapshot matcher to that same binding stands in another test block
- Those two test blocks are placed directly in the same sequence of statements

```ts
const test = baseTest.extend("report", () => summarise(entries));

describe("report", () => {
  test("records the whole report", ({ report }) => {
    expect(report).toMatchSnapshot();
  });

  test("marks the total", ({ report }) => {
    expect(report.total).toBe(2);
  });
});
```

"The same sequence of statements" means the body of the `describe` callback where there is one, and directly under the file where there is not. The exception holds in a spec with no `describe` too. A snapshot placed in a parent `describe` or an inner one does not count.

Where the snapshot is recorded makes no difference. Keeping it in an external file and embedding it in the code are treated alike. The exception is settled by the shape of the assertion alone: since the snapshot's subject is a bare identifier, its record copies the whole root, so there is no need to read what is in the record.

### The invariant

The subject of an assertion is the root the fixture returned itself.

A per-field assertion says nothing about anything but that field. `expect(report.total).toBe(2)` being green denies neither that another field was added to `report`, nor that `id` was renamed, nor that the contents of `meta` drifted. Everything that changed outside the projection passes straight through.

It breaks in two layers.

The first is that the unverified region takes up most of the subject. Compare the root once with `toStrictEqual` and a missing field, an added field and a rename all fail. A projection catches none of them.

The second is that not being verified is invisible from the code. A projecting assertion reads to whoever wrote it as "that one point was chosen on purpose", and to a reader as "the other fields must be looked at somewhere else". The state where nowhere looks at them stays green. Adding an assertion per field is the same: the fields nobody named stay unverified to the end.

Shapes where the subject is not the root share this property beyond projection. An array assembled on the spot, a function written on the spot, and a literal written out in the spec all make "a value the test made" the subject rather than "a value the code produced". They are the same violation on the one point that the root did not come from the fixture, and they break the same invariant.

### Configuration

- `snapshotMatchers` — the names of snapshot matchers accepted as grounds for the exception. The default is the test runner's full set of snapshot matchers (`toMatchSnapshot`, `toMatchInlineSnapshot`, `toMatchFileSnapshot`, `matchSnapshot`, `toThrowErrorMatchingSnapshot`, `toThrowErrorMatchingInlineSnapshot`). Handing it an empty array removes the exception itself
- `specFileSuffixes` — the suffixes taken as spec files. The default is `.test.ts` and `.test.tsx`

There is no option narrowing the scope to "projections only". What is protected is "the subject is the root itself", and projection is only its most common breach. Allow the narrowing and the same invariant can be broken by moving to another shape.

## Fix

Pin the root itself with an exact match.

```ts
test("summarises the entries", ({ report }) => {
  expect(report).toStrictEqual({ id: "a", total: 2, meta: { source: "orders" } });
});
```

Where the subject was made on the spot, move the making into the fixture and hand the returned binding to the assertion. To read an exception, have the fixture return a thunk taking no arguments and have the `it` hand over that thunk's identifier.

To verify a mock or a function binding, have the fixture return that binding itself and read how it was called with the `toHaveBeenCalled*` family. Do not peek at the call record as a value.

Only where the subject is so large that an exact match hides the intent, add a snapshot `it` in the same sequence. The order is: pin the root with a snapshot first, then name the intended behaviour with a projection. Replacing a projection with another projection is not a fix.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a field read off the binding leaves every other field of it unpinned
// in report.test.ts
const test = baseTest.extend("report", () => summarise());
test("marks the total", ({ report }) => {
  expect(report.total).toBe(2);
});
```

```ts
// fields bundled into a list are still fields picked one by one
// in report.test.ts
const test = baseTest.extend("report", () => summarise());
test("carries both fields", ({ report }) => {
  expect([report.id, report.total]).toStrictEqual(["a", 2]);
});
```

Code this rule accepts.

```ts
// the bare binding a fixture handed back is the subject the rule asks for
// in report.test.ts
const test = baseTest.extend("report", () => summarise());
test("carries both fields", ({ report }) => {
  expect(report).toStrictEqual({ id: "a", total: 2 });
});
```

```ts
// a projection standing beside a snapshot of the same fixture under the same describe
// in report.test.ts
const test = baseTest.extend("report", () => summarise());
describe("report", () => {
  test("records the whole report", ({ report }) => {
    expect(report).toMatchSnapshot();
  });
  test("marks the total", ({ report }) => {
    expect(report.total).toBe(2);
  });
});
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Bundling projections into an array or an object literal to make it an exact match. It falls the moment the subject is not the root (an object literal falls to the rule forbidding a synthesised subject)
- Splitting into a projecting assertion per field you care about. The unverified fields stay, and all that grows is the number of reports
- Pushing the projection into the fixture so the fixture returns `report.total`. A fixture projecting the subject under test's output is forbidden by another rule
- Adding an unrelated snapshot beside the projection to satisfy the exception's conditions without verifying the root. The exception holds because "a snapshot recording that whole root exists". A snapshot of another binding, and a snapshot of a binding that did not come from a fixture, do not count
- Placing the projecting `it` and the snapshot `it` in separate `describe`s. Only blocks placed directly in the same sequence are read
- Wrapping in a type assertion or an optional chain. They are peeled before reading
- A suppression directive

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `projectedSubject` | The subject of an assertion must not be a member read off the binding a fixture handed back. Assert the whole binding with \`toStrictEqual\`. Pin a mock by having its fixture hand the mock binding itself back and stating the calls with \`toHaveBeenCalledWith\`. |
| `bundledSubject` | The subject of an assertion must not be a list built inside the assertion out of the parts of a binding. Assert the whole binding a fixture handed back with \`toStrictEqual\`. |
| `inlineFunctionSubject` | The subject of an assertion must not be a function written inside the assertion. Move that function into a fixture and hand the assertion the binding the fixture returns. |
| `writtenOutSubject` | The subject of an assertion must not be a value spelled out in the spec. Bind the value the code under test produced in a fixture and assert that binding. |
| `derivedSubject` | The subject of an assertion must not be an expression evaluated inside the assertion. Move that expression into a fixture and hand the assertion the binding the fixture returns. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
