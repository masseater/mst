---
description: "Disallow an external snapshot whose recorded value fits within the shared inline budget, so where a recorded value lives follows from its size rather than from the taste of whoever wrote the assertion"
---

# no-undersized-external-snapshot--use-inline-snapshot

<!-- BEGIN GENERATED rule-header -->

Disallow an external snapshot whose recorded value fits within the shared inline budget, so where a recorded value lives follows from its size rather than from the taste of whoever wrote the assertion

- Tool: `oxlint`
- Fixable: yes
- Suggestions: no
- Options: yes
- Shipped in the preset: yes
- Source: [`no-undersized-external-snapshot--use-inline-snapshot.ts`](../../src/lint/oxlint/rules/no-undersized-external-snapshot--use-inline-snapshot.ts)

<!-- END GENERATED rule-header -->

## Violation

A call to a matcher that records an external snapshot, where the recorded value it corresponds to holds no more content lines than the shared budget. The budget is 12 lines by default.

Three matchers are in scope: `toMatchSnapshot`, `toThrowErrorMatchingSnapshot` and `matchSnapshot`. Each writes an entry into a record file on disk (`__snapshots__/<spec file name>.snap`).

### How the recorded value is looked up

A key in the record file is the titles of the enclosing blocks strung together with `>`, followed by a running number. For a call handed a snapshot hint, the hint enters as one more title stage just before the number.

```
exports[`outer > names a behaviour 1`] = `"alpha"`;
exports[`outer > names a behaviour > the hint 1`] = `"beta"`;
```

The running number counts every matcher the test runner passes snapshot state through. Inline records and file records advance the same counter, so an inline record standing earlier in the same test pushes the number of a later external record along by that much.

```ts
it("names a behaviour", () => {
  expect(first).toMatchInlineSnapshot(`"first"`);
  expect(subject).toMatchSnapshot();
});
```

That `toMatchSnapshot` looks up `outer > names a behaviour 2`. A hinted call carries its own run of keys, so it shares no numbering with an unhinted call.

### How titles are read

A block is recognised by its shape rather than by the name it is called on. A call whose first argument is a statically readable string and whose last argument is a function counts as one title stage. A grouping block and a test block have the same shape, so both enter the key by the same rule. A declaration carrying modifiers keeps that shape.

A table-driven declaration (`.each` / `.for`) is resolved by building each case's title, when the table is an array literal and every case is made of statically readable values. These are the substitutions available.

| Substitution | What it stands for |
| --- | --- |
| `%s` | The case's value as written (a string without quotes) |
| `%d` | The case's number |
| `%i` | The case's number truncated to an integer |
| `%#` | The case index counted from zero |
| `%$` | The case index counted from one |
| `%%` | One `%` |
| `$name` | A value the object case carries (a string with quotes) |

### A call that cannot be resolved

These shapes leave the recorded value unmeasurable, so the fact that it cannot be measured is itself reported.

| Shape | Example |
| --- | --- |
| A title built from a value settled at run time | ``it(`names ${behaviour}`, fn)`` |
| A table settled at run time | `it.each(rows)("scalar %s", fn)` |
| A hint settled at run time | `expect(subject).toMatchSnapshot(chosenHint)` |
| A call standing inside a loop | `for (const value of rows) { ... }` |
| A call standing inside a branch | `if (ready) { ... }` |
| A call standing inside a nested callback | `rows.forEach((value) => { ... })` |

In a loop, a branch and a nested callback, the order on the page does not match the order at run time. A call standing after one of those inside the same test is reported as well, because its number is no longer settled.

### Deliberately not widened

| Shape | Why it is left out |
| --- | --- |
| A spec carrying no record file yet | There is nothing to measure |
| A resolved key the record file does not hold | There is nothing to measure |
| An external record larger than the budget | That is the right place for it |
| An inline record | That belongs to [no-oversized-inline-snapshot--use-external-snapshot](./no-oversized-inline-snapshot--use-external-snapshot.md) |
| A file record (`toMatchFileSnapshot`) | It holds no entry in the record file. It only advances the number |
| A call enclosed by no test block | No key stands. That belongs to [no-expect-outside-it--move-into-it-block](./no-expect-outside-it--move-into-it-block.md) |
| A table-driven declaration only some of whose cases are recorded | Sizes cannot be compared until every case is there |
| A table-driven declaration whose substitutions or values fall outside the table above | The title cannot be built. That is this rule's range falling short, not the writer's spelling |

Whether a snapshot may be used at all is not read here. That belongs to [no-scalar-snapshot--assert-exact-value](./no-scalar-snapshot--assert-exact-value.md) and [require-non-snapshot-assertion--assert-behavior-explicitly](./require-non-snapshot-assertion--assert-behavior-explicitly.md); this rule only settles where a value already decided on goes.

### The invariant

What is held is that a recorded value is readable beside the assertion that pins it.

A recorded value sitting in an external file is invisible from the assertion. Where the value is small, that separation buys nothing. Reading the `it` block alone tells nobody what is being checked, and the reader ends up opening the record file and matching keys by hand. That matching is not a burden on people only: a key is made of strung-together titles and a running number, so changing one word of a title severs the correspondence.

The cost in the other direction is carried by [no-oversized-inline-snapshot--use-external-snapshot](./no-oversized-inline-snapshot--use-external-snapshot.md). With two rules holding one budget between them, where a value goes becomes a function of its size alone, and the writer's judgment stops entering into it. The budget is a single constant working in both directions, so neither side can be loosened on its own.

### Configuration

| Option | Default | What it settles |
| --- | --- | --- |
| `maxLines` | `12` | The number of lines up to which a recorded value stays inline |
| `specFileSuffixes` | `[".test.ts", ".test.tsx"]` | The file name endings counted as a spec |

`maxLines` must carry the same value as [no-oversized-inline-snapshot--use-external-snapshot](./no-oversized-inline-snapshot--use-external-snapshot.md). Let the two read different values and a recorded value that is a violation in either place becomes expressible, and an automatic fix bounces between the two without settling.

The boundary leans to the inline side. A recorded value exactly at the budget stays inline, and external placement starts one line above it.

Where the budget is moved off its default, hand both rules the same value in the shared lint configuration.

## Fix

Replace the matcher with its inline spelling and run the tests with snapshots updated. The value is written in beside the assertion, and the external entry that is no longer wanted is dropped by that update.

```ts
it("names a behaviour", () => {
  expect(subject).toMatchInlineSnapshot();
});
```

`toThrowErrorMatchingSnapshot` is replaced with `toThrowErrorMatchingInlineSnapshot`.

What the automatic fix does reaches as far as replacing the matcher. Where a hint was handed over, the hint is dropped with it, because an inline record carries no key. Moving the value itself is the snapshot update that follows.

In a table-driven declaration, recorded values that differ case by case do not fit into one inline record. Split it into a test block per case, then make each one an inline record. No automatic fix is offered for that shape.

For a call reported as unresolvable, write the title and the hint as literals, and lift the call out of the loop, the branch or the nested callback.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a record inside the budget is reported and moved to an inline record
describe("outer", () => {
  it("names a behaviour", () => {
    expect(subject).toMatchSnapshot();
  });
});
```

```ts
// an inline record ahead of it shifts which entry the call is measured against
describe("outer", () => {
  it("names a behaviour", () => {
    expect(first).toMatchInlineSnapshot(`"first"`);
    expect(subject).toMatchSnapshot();
  });
});
```

Code this rule accepts.

```ts
// a record past the budget is already in the right place
describe("outer", () => {
  it("names a behaviour", () => {
expect(subject).toMatchSnapshot();
  });
});
```

```ts
// an inline record is the other rule's subject
describe("outer", () => {
  it("names a behaviour", () => {
expect(subject).toMatchInlineSnapshot(`"alpha"`);
  });
});
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Lowering the budget to justify leaving a value outside. The budget works in both directions, so neither side can be loosened alone
- Building the title at run time so the call cannot be resolved. Being unresolvable is itself what gets reported
- Settling the hint at run time so the call cannot be resolved. As above
- Moving the call into a loop or a nested callback to hide its position. As above
- Silencing it with a suppression directive

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `undersizedExternalSnapshot` | A recorded value of {{recordedLines}} lines must not sit in an external snapshot file against a shared budget of {{maxLines}} lines for a value that belongs beside its assertion. Replace \`{{matcher}}\` with \`{{inlineSpelling}}\`, drop any snapshot hint, and rerun the suite with snapshot updating turned on to carry the value at \`{{key}}\` into this spec. |
| `undersizedTableDrivenSnapshot` | A recorded value of {{recordedLines}} lines must not sit in an external snapshot file against a shared budget of {{maxLines}} lines for a value that belongs beside its assertion. Split this table-driven declaration into one test block per case, replace \`{{matcher}}\` with \`{{inlineSpelling}}\` in each block, and rerun the suite with snapshot updating turned on to carry the values at \`{{key}}\` into this spec. |
| `unresolvableExternalSnapshot` | An external snapshot must not be recorded under a key that cannot be spelled out from this spec alone. Write every enclosing title as a literal string, write the snapshot hint as a literal string, and lift this call out of the loop, branch or nested callback that hides its position among the recorded values. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
