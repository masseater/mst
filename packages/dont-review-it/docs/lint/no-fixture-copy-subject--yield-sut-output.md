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
- Bundle: `testing`
- Source: [`no-fixture-copy-subject--yield-sut-output.ts`](../../src/lint/oxlint/rules/testing/no-fixture-copy-subject--yield-sut-output.ts)

<!-- END GENERATED rule-header -->

## Violation

A fixture handing back an object literal in which at least one key name equals the name of the property its value reads. One matching key is enough, and one report per subject object names every key that matched.

The subject and each property value are followed one binding step, landing on a `const` in the fixture body or directly under the file, so writing the object into a binding first, or pairing a shorthand key with a binding, reaches the same judgment. Key names and read names are settled alike from dot notation, string-literal subscripts and templates with no substitution. Methods, accessors, spread-only objects and keys that settle at run time are not read.

## Fix

Hand over the value the code produced as it stands, and write the comparison against the whole subject.

Where only one name was worth copying, that is a demand to narrow the subject: split the fixture, or rework what the code returns.

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

- Interposing a binding between the read and the key. One step is followed on both sides
- Renaming every key but one. One left is enough to report
- Stacking two or more bindings, or pushing the copy behind a call. The value handed over is still a replica

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
