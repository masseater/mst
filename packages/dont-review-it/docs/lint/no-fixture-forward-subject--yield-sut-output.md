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

For a fixture declaration in a spec file, the value that fixture hands over as the subject is read.

Reading declarations follows the shared fixture-declaration analysis. Both the builder form, which lines a name and a factory up in an `extend` call, and the older form, which puts a factory on each property of an object, are read. In the builder form the subject is the value the factory's `return` hands over; in the older form it is the value handed to the second argument used for passing along. A declaration with no readable factory — a value registered directly as the fixture — carries no subject and is not read.

"A given binding" means a name arriving through the factory's first parameter. Where the first parameter is a destructuring, each name taken out there is one. Where the first parameter is received as a single identifier, that identifier itself is one.

The subject is normalized in this order before it is read.

1. Wrapper calls named in the configuration are peeled, and the value returned by the function in the last argument is re-read as the subject. The wrapper call itself is not the subject. Nested wrappers are peeled repeatedly
2. Type assertions, non-null assertions, optional chains and `await` are peeled
3. Where it is an identifier, the initializer of a `const` in the factory body or inside a wrapper body is followed. The walk stops on returning to the same name

The report differs by the shape of the normalized subject.

- A given binding itself — `forwardedSubject`
- A member expression — `projectedSubject`. The same report stands whether the root is a given binding or a local binding received inside the fixture
- A call carrying a given binding among its arguments — `derivedSubject`. Handing it over as a spread counts as an argument too
- An object literal or an array literal taking a given binding in through a spread — `spreadSubject`

The report stands where the subject was written. Even through a local binding, the report comes out at the position where the fixture hands the value over. What the message names is the root binding, not the declared dependency name. In a fixture receiving the first parameter as one identifier, which dependency is being handed over is not settled, so all that can be named there is that identifier.

### Not violations

- Handing a local binding over as it stands. This is the shape being asked for
- A method call on a local binding. A call produces a new value and so can be a subject
- A method call on a given binding. A subject for the same reason
- An object literal or an array literal naming no given binding
- A `new` expression. Not read even where it takes a given binding as an argument

### Shapes other rules take

- A literal, a `new` expression, and those hidden in a local binding are taken by the rule forbidding a fixture from assembling the subject
- Assembling an object by copying same-named properties off an existing value is taken by the rule forbidding a copied subject
- Making a member expression the subject on the assertion side is taken by [no-expect-projected-subject--use-tostrictequal-on-subject](./no-expect-projected-subject--use-tostrictequal-on-subject.md)

A member projection of a local binding overlaps with the rule forbidding assembly. The duplicate reports share one fix (hand the root over whole), so nothing is narrowed here.

### The invariant

The subject a fixture hands over is the whole of the value that fixture itself has under test.

It breaks in two ways.

The first is that the owner of the contract disappears. Hand over a binding the fixture received, and a test naming that fixture can no longer say what it verifies. The test's parameter gets a new name, but the value was made by the upstream fixture and this one claims nothing. A reader cannot settle "am I looking at the original subject, or at this fixture". A call derived from a given binding is the same: the derivation belongs to the upstream value and is not what this fixture's name points at.

The second is that the verified range narrows outside the test. Hand over only part of the output and the rest becomes invisible to every assertion using that fixture. Writing `expect(response.status)` is forbidden on the assertion side, but have the fixture hand over `response.status` and the assertion receives a bare identifier. The projection that was supposed to be forbidden comes in from the fixture side, and goes green unreported. Only by making projections unbuildable on the fixture side does the assertion-side prohibition close.

A literal taking one in through a spread is not treated apart for the same reason. `{ ...base }` is a literal in shape, but the value's origin is still the given binding, and ownership of the subject does not move.

### Configuration

- `handlerScopingWrappers` — the names of wrapper calls peeled before the subject is read. The default is empty, so there is nothing to peel. Where a wrapper that only creates a handler's scope and returns what the inner function returned is in use, name it here. A name matches both an identifier call and a member call
- `specFileSuffixes` — the suffixes taken as spec files. The default is `.test.ts` and `.test.tsx`

There is no option narrowing the scope to "a straight pass-through of a given binding". What is protected is "the subject is the whole of the fixture's own output", and a pass-through is only one way of breaking it. Allow the narrowing and the same invariant can be broken by moving to a projection or a derived call.

## Fix

Hand over, whole, the output of the code this fixture actually ran.

```ts
const test = baseTest.extend("response", async () => {
  const response = await request();
  return response;
});
```

Where a projection is needed, read it on the assertion side. Where the given binding is what you want to look at whole, have the test name the fixture holding that binding directly.

A member projection is a shape a mechanical replacement would fit: returning the projection to its root could be done automatically. Even so, no automatic fix is offered. Replacing alone leaves the fixture's name, the test's parameter name and the assertion still naming the projection, and the contract has not been restated. Both means of leaving "a restatement is needed" behind — a marker in the code and a suppression directive — are forbidden by this package, so there is no way to avoid leaving a half-rewritten state. To keep a staged automatic fix from producing a half-fixed spec, only the report stands.

A straight pass-through of a given binding and a derived call have no uniquely settled replacement in the first place. Returning the same identifier again does not clear the violation, and a derived call may have had several original values.

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

- Putting the projection into a local binding before handing it over. `const` initializers are followed, so the same report stands
- Wrapping the projection in a type assertion or a non-null assertion. They are peeled before reading
- Hiding the projection inside a wrapper call named in the configuration. Wrappers are peeled before reading
- Swapping a given binding for `{ ...base }` or `[...base]` to change only the shape. A spread is read as taking it in
- Moving a derived call's argument into a local binding first, turning `summarise(entries)` into `summarise(copied)`. Arguments are read as written, so this shape is not reported. Ownership of the subject is still upstream all the same, and the fix is the same
- Taking a wrapper out of `handlerScopingWrappers` to hide the projection. Do not narrow this rule's reading through configuration
- Rewriting the fixture in the older form to leave the check. The older form is read the same way
- A suppression directive

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
