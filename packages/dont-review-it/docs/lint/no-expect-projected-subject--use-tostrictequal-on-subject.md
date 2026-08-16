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
- Bundle: `testing`
- Source: [`no-expect-projected-subject--use-tostrictequal-on-subject.ts`](../../src/lint/oxlint/rules/testing/no-expect-projected-subject--use-tostrictequal-on-subject.ts)

<!-- END GENERATED rule-header -->

## Violation

Anything but a bare identifier handed to `expect(...)` in a spec file, with wrappers peeled first. The report differs by what is left: a member read, a list built inside the assertion, a function written there, a value spelled out in the spec, and any other expression evaluated there. A call, a `new` expression, an object literal and a tagged template belong to other rules of this bundle and are not reported here.

One exemption: where another block among the same siblings pins the whole fixture value with a snapshot matcher, a member read off that same fixture inside a different block passes. `snapshotMatchers` replaces the matcher vocabulary that exemption reads.

## Fix

Assert the whole binding a fixture handed back with `toStrictEqual`, so a missing field, an added field and a renamed field all fail.

Pin a mock by having its fixture hand the mock binding back and stating the calls with `toHaveBeenCalledWith`.

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

- Bundling the parts into an array or an object at the assertion. Everything nobody bundles stays unread
- Splitting into an assertion per field. The fields nobody names stay unread
- Reading the member inside the fixture instead. Another rule of this bundle takes the narrowed subject there

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
