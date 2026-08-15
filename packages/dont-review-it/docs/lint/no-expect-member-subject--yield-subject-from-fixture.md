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

A subject handed to `expect(...)` that stands two or more steps from the value the test block's callback received. The context itself is 0 steps and a fixture the callback destructures is 1; anything further is one face of a value the fixture handed over.

A member access is one step, a destructuring key is one step, a rest element is none, and a binding inherits its initializer's distance through any number of steps. The report differs by shape: a member written at the assertion, a binding holding one, and a name taken out of a pattern nested in the context.

A table-driven block hands its callback a row rather than the context and is skipped, and `describe` callbacks receive no fixture. `specFileSuffixes` settles which files are specs.

## Fix

Split the fixture so it hands back the value the assertion is about, and assert the binding the callback received as it stands.

Where the compound value is one subject, pin it whole with an exact matcher rather than reading a face out of it.

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

- Receiving the member into a local binding first. Initializers are followed to the end
- Renaming through a nested destructuring of the context. The step count is what is read
- Splitting into an assertion per face. The faces nobody names stay unread
- Moving into a table-driven block to put the context out of reach

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
