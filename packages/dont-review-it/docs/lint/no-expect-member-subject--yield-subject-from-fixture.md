---
description: "Disallow handing an assertion a member reached off the value a fixture handed over, so the faces of that value the spec never names cannot pass unread"
---

# no-expect-member-subject--yield-subject-from-fixture

<!-- BEGIN GENERATED rule-header -->

Disallow handing an assertion a member reached off the value a fixture handed over, so the faces of that value the spec never names cannot pass unread

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: yes
- Shipped in the preset: yes
- Source: [`no-expect-member-subject--yield-subject-from-fixture.ts`](../../src/lint/oxlint/rules/no-expect-member-subject--yield-subject-from-fixture.ts)

<!-- END GENERATED rule-header -->

## Violation

For an `expect(...)` in a spec file, the subject placed in the first argument is read. `expect.soft(...)` and `expect.poll(...)` are treated as the same way in. Whether a matcher follows is not read: `expect(report.id);` with the matcher dropped is read as the same subject in the same position.

The files in scope are settled by the file name suffix. The default is `.test.ts` and `.test.tsx`, replaceable through `specFileSuffixes`.

The subject is read with type assertions, `satisfies`, non-null assertions, parentheses, optional chains and `await` peeled off. `not`, `resolves` and `rejects` do not move the subject's position and are irrelevant.

The judgment runs on the distance from the value the test block's callback receives.

| Distance | What it names | Judgment |
| --- | --- | --- |
| 0 | The test context itself (`(context) => ...`) | Not reported |
| 1 | A value the fixture returned (the `report` of `({ report }) => ...`) | Not reported |
| 2 or more | One face of a value the fixture returned | Reported |

Distance accumulates like this.

- A member access is one step. Dot notation, bracket notation and an index are alike, and a form whose key settles at run time (`report[key]`) counts as the same one step
- A destructuring key is one step. The `report` of `({ report })` is 1; the `id` of `({ report: { id } })` is 2. Renaming, and writing a default, do not change the count
- A rest (`...rest`) is zero steps. The `rest` of `({ report, ...rest })` stands at the same distance as the context, so `rest.report` is a value the fixture returned rather than a face
- A binding inherits its initializer's distance. The `id` of `const id = report.id` is 2, and the `held` of `const held = report` is 1. A chain of bindings is followed to the end

Reports divide into three: a member written at the assertion, a binding holding a member handed over, and a name received through a nested destructuring of the context. The opening of the fix differs between them.

### Deliberately not widened

| Shape | Why it is left out |
| --- | --- |
| Handing over the value the fixture returned itself | This is the shape being asked for |
| A name destructured from a top-level key of the context | A fixture's name, not a face |
| A member access appearing in a matcher's argument | The expected value is what the spec writes. Only the first argument of `expect(...)` is read |
| Handing over a compound value whole | As long as it is matched whole, no unchecked face is left |
| A member access on a value that does not reach a fixture | A constant imported from another file, a constant the spec wrote out, and a binding receiving the result of a call land here |
| A binding with no initializer | The distance cannot be followed. What cannot be followed is not treated as a violation |
| A table-driven block (`each` / `for`) | The first argument the callback receives is a row rather than the context. The row's shape follows the caller's table |
| The parameter of a `describe` callback | A grouping block hands over no fixture |

The last two are also holes in the detection. Where a table-driven block receives the context in another parameter, this reading cannot follow the distance. Not reaching does not mean it is allowed, so they are named in the forbidden bypasses section.

That the subject is a member access not reaching a fixture is, for this rule, simply out of scope. Whether the subject is the root itself is read by another rule from the subject's shape alone.

### The invariant

The subject of `expect(...)` is the value the fixture returned itself.

Where the fixture returns that spec's subject, the test block can assert on the value it received as it stands. Having to take a member out to reach what you want to check means what the fixture returns is not the subject but a container holding it.

Take one face out of a container and compare it, and the faces you did not take stay unverified and green. It does not fail when a field is added, when one is renamed, or when another face's value drifts. Adding an assertion per face is the same: the faces nobody named stay unverified to the end.

There is a second point, about the relationship with the rule that judges by name. The rule reading the subject's name is placed as a proxy for finding "a bag with several results in it" from the name. Whether a compound value is one subject or a bag is a question of what the value means and appears in neither the type nor the syntax — but using a bag as a bag, making a member path of a compound value the subject, does appear in the syntax. Closing it on the usage side without judging meaning leaves no room for changing only the name evasively while the contents stay a bag.

### Configuration

`specFileSuffixes` alone. The default is `.test.ts` and `.test.tsx`, shared as one range with the rules that read subjects.

There is no setting for excluding individual cases. Make one mouth for excluding and moving the face there becomes a way past this rule.

## Fix

Split the fixture per face and assert on the value the test block received as it stands.

```ts
const test = baseTest.extend("reading", () =>
  destructuredBindingsOf(parameterIn("({ report, ...rest }) => rest")).map((binding) => ({
    name: binding.name.name,
    depth: binding.depth,
  })),
);

test("names what is left of the same value", ({ reading }) => {
  expect(reading).toStrictEqual([
    { name: "report", depth: 1 },
    { name: "rest", depth: 0 },
  ]);
});
```

Where the compound value is one subject, pin it whole with an exact match. Do not leave the fields you did not write unverified.

The same holds for taking a collection's element out by index: split the fixture per element, or pin the collection whole. Where pinning whole is impractical because of size, that is a sign the fixture is not returning a subject, so solve it by splitting the fixture.

Read the observable face of a host object with the matcher dedicated to it. Do not peek at a member as a value.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a member written in the assertion names one face of the fixture value
// in report.test.ts
test("carries the id", ({ report }) => {
  expect(report.id).toBe("a");
});
```

```ts
// a pattern nested in the context takes a face out of the fixture value
// in report.test.ts
test("carries the id", ({ report: { id } }) => {
  expect(id).toBe("a");
});
```

Code this rule accepts.

```ts
// the value a fixture handed over is the subject this rule asks for
// in report.test.ts
test("carries the id", ({ report }) => {
  expect(report).toStrictEqual({ id: "a" });
});
```

```ts
// the rest of the context holds fixtures rather than faces of one
// in report.test.ts
test("carries the id", ({ input, ...rest }) => {
  expect(rest.report).toStrictEqual({ id: "a" });
});
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Receiving the member into a local binding inside the test block and handing that over. Initializers are followed, so it falls as the same violation
- Routing through several bindings to put distance between it and the initializer. Rebindings are followed to the end
- Renaming through a nested destructuring of the context to make a member path look like a fixture's name. The judgment runs on the step count at the point of introduction
- Pushing the member extraction back into the fixture. A fixture returning another value, or a member of one, passed through or projected falls to another rule
- Dropping the matcher to leave only `expect(subject);`. The starting point is the `expect(...)` call itself
- Wrapping in a type assertion, a non-null assertion, parentheses or `await` to change the look. They are peeled
- Inserting `not`, `resolves` or `rejects`. The subject's position does not move
- Splitting into an assertion per face to name more fields. The faces you did not name stay, and all that grows is the number of reports
- Moving into a table-driven block and receiving the context in the second parameter or later. The distance becomes unfollowable so the report clears, but the subject being a face is unchanged
- A suppression directive

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `memberSubject` | The subject of an assertion must not be a member reached off the value a fixture handed over. \`{{subject}}\` names one face of that value, and every face left unnamed here passes unread. Split the fixture into one fixture per face, or assert the whole value the fixture hands over with an exact matcher. Pushing the member read into the fixture leaves the same narrowed subject standing. |
| `boundMemberSubject` | The subject of an assertion must not be a binding that holds a member reached off the value a fixture handed over. \`{{subject}}\` arrives at that member through the bindings this spec declares, and every face left unnamed here passes unread. Split the fixture into one fixture per face, or assert the whole value the fixture hands over with an exact matcher. |
| `destructuredMemberSubject` | The subject of an assertion must not be a binding taken out of a pattern nested inside the test context. \`{{subject}}\` names one face of the value a fixture handed over, and every face left unnamed here passes unread. Take the fixture value whole in the callback parameter, and split the fixture into one fixture per face or assert the whole value with an exact matcher. Renaming the binding in the pattern leaves the face it names unchanged. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
