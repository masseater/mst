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
- Shipped in the preset: yes
- Source: [`forbid-weak-matcher--use-exact-matcher.ts`](../../src/lint/oxlint/rules/forbid-weak-matcher--use-exact-matcher.ts)

<!-- END GENERATED rule-header -->

## Violation

Three shapes written in a spec file (by default a file ending in `.test.ts` or `.test.tsx`). One report stands at the position of each matcher name.

**A call to a weak matcher.** A matcher from the forbidden set standing at the end of a chain rooted at `expect(...)`.

**A call to an asymmetric matcher.** `expect.<name>(...)`. Whether it sits inside an expected argument is not read; the place it is written is.

**A restatement of an exact comparison.** `toBeNull()`, `toBeUndefined()`, `toBeNaN()` — a comparison against the value itself, spelled another way.

### Settling the root

Only a chain whose root resolves to a call to `expect(...)` is in scope. `not`, `resolves` and `rejects` are peeled before the root is read, so a modifier in between changes nothing. `expect.soft(...)` and `expect.poll(...)` are treated as the same root.

Type assertions, non-null assertions, parentheses, optional chains and `await` are peeled before the judgment, so one wrapper cannot take the detection off.

Property names are resolved only where they settle before the run: an identifier, a string literal, and a template literal carrying no expression. `expect(subject)['toBeTruthy']()` and ``expect(subject)[`toBeTruthy`]()`` resolve to the same name.

### The forbidden set

The set is held by the shared matcher vocabulary (`src/lint/oxlint/lib/spec-syntax/matcher-vocabulary.ts`), and this rule reads it as it stands.

| Family | Names | What stays unverified |
| --- | --- | --- |
| truthiness | `toBeTruthy` / `toBeFalsy` / `toBeDefined` / `toBeNullable` | The value itself, before it collapses into a truth |
| loose-structure | `toEqual` | The difference between an absent property and `undefined`, and the class it came from |
| partial-shape | `toMatchObject` / `toHaveProperty` / `toHaveLength` | Everything the expected side did not name |
| containment | `toContain` / `toContainEqual` / `toMatch` | Everything outside the part that was contained |
| runtime-type | `toBeInstanceOf` / `toBeTypeOf` / `toSatisfy` / `toBeOneOf` | Which of the many values passing that type or predicate this one was |
| magnitude | `toBeGreaterThan` / `toBeGreaterThanOrEqual` / `toBeLessThan` / `toBeLessThanOrEqual` / `toBeCloseTo` | Which of the many numbers past the boundary this one was |
| thrown-value | `toThrow` / `toThrowError` | The thrown value itself |

Each entry carries one sentence naming "the region that stays unverified even when this passes", and that sentence goes into the report as it stands. A name for which that sentence cannot be written does not go into the set, because forbidding a name alone leaves the writer unable to settle what to write instead.

On the asymmetric side: `anything`, `any`, `schemaMatching`, `toSatisfy`, `toBeOneOf`, `objectContaining`, `arrayContaining`, `stringContaining`, `stringMatching`, `closeTo`. Deep inside an object literal or an array literal, nested inside another asymmetric matcher, and bound once to a variable as its initializer — all are hit alike. Depth is not read.

Restatements take only those redundant spellings from the vocabulary whose destination is the exact matcher (`toBe`). An older spelling such as `toBeCalled` → `toHaveBeenCalled()` has a destination that is not an exact comparison, so it falls outside this judgment structurally.

### Deliberately not widened

| Shape | Why it is left out |
| --- | --- |
| `expect(x).toBe(1)` / `expect(x).toStrictEqual({})` | The very shape this rule is trying to keep |
| `expect(save).toHaveBeenCalledWith({ id: 1 })` | A statement about how it was called, not a comparison of values |
| `expect(save).toHaveReturnedWith(1)` | Reading the record of returns. A different owner |
| `expect(x).toMatchSnapshot()` | Matching against a record. Snapshots have their own owner |
| `expect(save).toBeCalled()` | An older spelling of the call-contract family. Aligning spellings is a separate concern |
| `expect(x).toBeSettled()` | A name absent from the forbidden set. Weakness is not inferred from meaning |
| `report.toContain(entry)` | The root is not an `expect` chain. A receiver that merely has a method of the same name is not swept in |
| `runner.soft(x).toBeTruthy()` | Spelled like a derived entry point, but with a receiver that is not `expect` there is no root |
| `makeExpect()(x).toBeTruthy()` | The entry point is returned by another call. The root does not reach an identifier |
| `expect(x)[matcherName]()` | The name settles only at run time. What cannot be resolved is not guessed at |
| `expect(x).toBeTruthy()` outside a spec file | Outside a spec file, `expect` may be a name for anything |

### Where it does not reach

The root is settled from the spelling `expect`. Rebind `expect` to something else inside a spec file and that position is still treated as a root. Conversely an entry point imported under another name is not treated as a root. Once a mechanism for resolving the root from the origin of the binding enters this group's shared foundation, this rule moves onto it.

It also does not reach an asymmetric matcher bound to a constant in another file. Inside the same file, the binding's initializer is the `expect.<name>(...)` call itself, so it is hit at the declaration.

### The invariant

If an assertion passed, the value and the shape are as expected — the whole of them.

A weak matcher does not meet that, because what it reads is a projection of the subject. A matcher that reads only truth passes even when the intended value regresses into another value. A partial-object match passes even when unintended fields appear, so an object carrying a value that must not leave passes straight through. A substring match passes with extra text before and after.

It breaks in two layers.

The first is what the assertion is not claiming. What `toBeTruthy` claims is "it was something that collapses to true", not what the case name says — "it returns this value". The check the name claims is not performed.

The second is that not performing it shows up as green. The meaning of green thins from "the value the code produced matched the expected value and shape exactly" to "part of it matched". And the thinning does not appear in any report. What a person sees is the count that passed, not how much each assertion fixed. That a case which should fail does not is noticed when the tests are reread after production broke.

Once the meaning thins, what the other rules of this bundle protect lapses with it. Tighten where the subject comes from, tighten the fixture's preparation — if the last step may pass on "part of it matched", none of the tightening reaches the meaning of green.

The objection "there is a reason it cannot be exact" usually points at a dynamic value: a clock, a random number, a generated id. That is a reason to build a seam, not to loosen a matcher. Loosening a matcher is not a cheap move; it is replacing the assertion with a different one.

### Configuration

`allowedMatchers` (a list of strings, default `[]`) takes the matcher names to leave out of reports. It excludes by name, so it holds alike for weak matchers, asymmetric matchers and restatements.

```jsonc
["error", { "allowedMatchers": ["toContain"] }]
```

`specFileSuffixes` (a list of strings, default `[".test.ts", ".test.tsx"]`) takes the suffixes of the files this rule reads. Rules that read spec files share one range, so change it across every rule reading that range rather than this one alone.

```jsonc
["error", { "specFileSuffixes": [".spec.ts"] }]
```

Unknown keys are refused by the schema (`additionalProperties: false`).

The forbidden set itself cannot be replaced by configuration. Allow a replacement and a name lacking the required "what stays unverified" sentence enters the set, and that sentence drops out of the report. A report that lost the sentence can say only "this is weak", leaving the writer unable to choose a replacement. Only the narrowing direction is open, as `allowedMatchers`.

## Fix

**For one primitive, or for identity, compare against the value itself.**

```ts
expect(specStemOf("src/order.test.ts", DEFAULT_SPEC_FILE_SUFFIXES)).toBe("order");
```

**For a structure, compare the subject as it stands with an exact match.** Write on the expected side the whole of what the code has to return.

```ts
expect(specFileSuffixesFrom([{ specFileSuffixes: [".spec.ts", ".spec.tsx"] }])).toStrictEqual([
  ".spec.ts",
  ".spec.tsx",
]);
```

**Where a dynamic value is in the way, build a seam for that value.** Take the clock as a parameter, make the id generator replaceable, fix the random seed. Make it deterministic, then compare exactly. Even where a value flowing in from an external dependency has to be narrowed, keep the rest of the subject exact.

**For an exception, compare the thrown value itself.** What `toThrow` with a string claims is "the message contains that string", not "the message equals that string". It passes with anything attached before or after.

**Return a restatement to its canonical spelling.** `toBeNull()` becomes `toBe(null)`, `toBeUndefined()` becomes `toBe(undefined)`, `toBeNaN()` becomes `toBe(Number.NaN)`. The destination is carried in the report.

There is no automatic fix. The destination is settled uniquely only for the three restatements; for the rest, the writer has to settle what should be compared. An assertion that cannot be settled is either deleted, or the behaviour to check is settled first.

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

- Binding an asymmetric matcher to a name and using that. The binding's initializer is the call, so it is hit at the declaration
- Burying an asymmetric matcher deep in an object or an array so the expected value looks exact. Depth is not read, so it is hit
- Splitting a partial match into several assertions, one per field you care about. The fields nobody named stay unverified, so all that happened is that a weak assertion got fragmented. Per-field assertions also land on [no-expect-projected-subject--use-tostrictequal-on-subject](./no-expect-projected-subject--use-tostrictequal-on-subject.md)
- Assembling the subject inside `expect` to make it exact. Producing the subject inside `expect` is forbidden by [no-expect-call-expression--yield-from-fixture](./no-expect-call-expression--yield-from-fixture.md). The subject comes from the fixture
- Projecting a member inside `expect` to make it exact. The same `no-expect-projected-subject--use-tostrictequal-on-subject` owns that
- Moving onto a matcher outside the forbidden set. Register a weak matcher of your own and rename it, and the unverified region is unchanged as long as what is being compared is the same
- Adding a name to `allowedMatchers` to let the assertion in front of you through. One site's convenience moves the definition of "what counts as weak in this repository", and it holds for every other assertion
- Shifting the spec file suffix to move out of range
- A suppression directive

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
