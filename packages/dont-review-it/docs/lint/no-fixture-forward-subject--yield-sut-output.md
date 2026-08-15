---
description: "Disallow a fixture handing back a binding it was given, a member read off an existing value, or a value derived from a binding it was given, so the subject a fixture owns is the whole output of the code it exercises rather than a narrower view of something that already existed"
---

# no-fixture-forward-subject--yield-sut-output

<!-- BEGIN GENERATED rule-header -->

Disallow a fixture handing back a binding it was given, a member read off an existing value, or a value derived from a binding it was given, so the subject a fixture owns is the whole output of the code it exercises rather than a narrower view of something that already existed

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: yes
- Shipped in the preset: yes
- Source: [`no-fixture-forward-subject--yield-sut-output.ts`](../../src/lint/oxlint/rules/no-fixture-forward-subject--yield-sut-output.ts)

<!-- END GENERATED rule-header -->

## Violation

A fixture handing back something narrower than its own output. The subject is normalised first — wrapper calls named in `handlerScopingWrappers` are peeled and what they return is re-read, then type wrappers, then an identifier is followed to a `const` in the factory body — and the report differs by what is left.

- A binding the factory was given, whether through a destructured dependency or the whole context parameter
- A member expression, whatever its root
- A call carrying a given binding among its arguments, a spread included
- An object or array literal taking a given binding in through a spread

A method call on a binding, and a `new` expression, produce a new value and are not reported.

## Fix

Hand over, whole, the output of the code this fixture ran. Where a projection is what the test needs, read it in the assertion; where the given binding is what you want to look at, have the test name the fixture that owns it.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a dependency handed straight back leaves this fixture stating nothing of its own
// in report.test.ts
const test = baseTest.extend("report", async ({ summarised }) => summarised);
```

```ts
// a member read off a dependency drops the rest of that dependency
// in report.test.ts
const test = baseTest.extend("path", async ({ lockOptions }) => lockOptions.lockPath);
```

Code this rule accepts.

```ts
// a local binding handed back whole carries every field the code produced
// in report.test.ts
const test = baseTest.extend("report", async () => {
  const report = await summarise(entries);
  return report;
});
```

```ts
// a method call on a dependency produces a new value
// in report.test.ts
const test = baseTest.extend("record", async ({ store }) => store.load());
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Putting the projection into a `const` in the factory first. Initializers are followed
- Swapping the binding for `{ ...base }` or `[...base]`. A spread is read as taking it in
- Hiding the projection inside a wrapper named in `handlerScopingWrappers`. Wrappers are peeled before reading

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `forwardedSubject` | A fixture must not hand back a binding it was given. \`{{subject}}\` arrives through the fixture context and leaves this fixture unchanged. Return the output of the code this fixture exercises, and take \`{{subject}}\` apart in the assertion that needs it. |
| `projectedSubject` | A fixture must not hand back a member read off an existing value. \`{{subject}}\` is the whole value that member comes from. Return \`{{subject}}\` itself, rename this fixture and the test parameter after the whole value, and read the member in the assertion. |
| `derivedSubject` | A fixture must not hand back the value of a call built out of a binding it was given. \`{{subject}}\` is passed into that call. Move the call into the fixture that owns \`{{subject}}\`, and return the output of the code this fixture exercises. |
| `spreadSubject` | A fixture must not hand back a literal built by spreading a binding it was given. \`{{subject}}\` is spread into that literal. Return the output of the code this fixture exercises, and take \`{{subject}}\` apart in the assertion that needs it. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
