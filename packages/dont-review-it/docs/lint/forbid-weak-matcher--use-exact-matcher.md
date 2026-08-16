---
description: "Disallow a matcher that reads only part of the value or the shape of its subject inside a spec file, so an assertion passes only for a subject that equals what the spec says it must equal"
---

# forbid-weak-matcher--use-exact-matcher

<!-- BEGIN GENERATED rule-header -->

Disallow a matcher that reads only part of the value or the shape of its subject inside a spec file, so an assertion passes only for a subject that equals what the spec says it must equal

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: yes
- Bundle: `testing`
- Source: [`forbid-weak-matcher--use-exact-matcher.ts`](../../src/lint/oxlint/rules/testing/forbid-weak-matcher--use-exact-matcher.ts)

<!-- END GENERATED rule-header -->

## Violation

Three shapes inside a spec file, all read from the matcher name.

- A weak matcher on an assertion chain, which reads a projection of the subject and leaves the rest unverified
- An asymmetric matcher taken off the assertion entry (`expect.objectContaining(...)` and the like), which leaves part of the expected value unwritten inside an expression that still reads as an exact comparison
- A second spelling of an exact comparison, where `toBe` or `toStrictEqual` says the same thing

The report names what the matcher leaves unverified, or the exact spelling to write instead. `allowedMatchers` takes a name out of the vocabulary, and `specFileSuffixes` settles which files are specs.

## Fix

Compare against the value the subject has to equal with `toBe`, or against the structure it has to equal with `toStrictEqual`.

Where the value moves from run to run, put a seam in front of the clock, the random source or the identifier generator and make it deterministic. Keep the comparison exact.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// an asymmetric matcher nested inside an expected structure is reported where it stands
// in order.test.ts
expect(save).toHaveBeenCalledWith({ id: expect.any(Number), spelled: expect.stringContaining('ada') });
```

```ts
// a matcher dedicated to a single value restates the exact comparison
// in order.test.ts
expect(subject).toBeNull();
expect(subject).toBeUndefined();
expect(subject).toBeNaN();
```

Code this rule accepts.

```ts
// comparing the subject with the value it has to equal is the shape this rule keeps
// in order.test.ts
expect(subject).toBe(1);
```

```ts
// comparing the subject with the structure it has to equal is the other shape it keeps
// in order.test.ts
expect(subject).toStrictEqual({ id: 1, spelled: 'ada' });
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Splitting the assertion into one per interesting field. Every field nobody names stays unverified
- Binding the asymmetric matcher to a name or burying it deeper in the expected value. The report lands on the call wherever it is written

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `weakMatcher` | An assertion must not reach its subject through \`{{matcher}}\`. This matcher reads a projection of the subject and leaves unverified {{unverified}}, so the assertion keeps passing after the value it was written for has decayed into a different one. Replace it with \`toBe\` against the value the subject has to equal, or with \`toStrictEqual\` against the structure it has to equal. Put a seam in front of a clock, a random source or a generated identifier, make that value deterministic, and keep the comparison exact. Splitting this assertion into one assertion per interesting field is forbidden as a repair: every field nobody names stays unverified. |
| `weakAsymmetricMatcher` | An expected value must not hand part of itself to \`expect.{{matcher}}(...)\`. This asymmetric matcher leaves unverified {{unverified}} inside an expression that still reads as an exact comparison. Write the value that has to be there. Put a seam in front of a clock, a random source or a generated identifier and make that value deterministic. Binding this call to a name and burying it deeper in the expected value are forbidden as repairs: the report lands on the call wherever it is written. |
| `restatedExactMatcher` | An assertion must not spell an exact comparison as \`{{matcher}}()\`. The two exact matchers \`toBe\` and \`toStrictEqual\` are the whole vocabulary a value assertion has, and a second spelling of one of them forces every reader to carry the knowledge that both mean the same thing. Write \`{{writeInstead}}\`. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
