---
description: "Disallow naming the subject of an assertion by one of the configured forbidden-name patterns, so a reader settles what the assertion pins from the assertion alone rather than from the fixture behind it"
---

# no-expect-forbidden-subject-name--rename-to-concrete-subject

<!-- BEGIN GENERATED rule-header -->

Disallow naming the subject of an assertion by one of the configured forbidden-name patterns, so a reader settles what the assertion pins from the assertion alone rather than from the fixture behind it

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: yes
- Shipped in the preset: yes
- Source: [`no-expect-forbidden-subject-name--rename-to-concrete-subject.ts`](../../src/lint/oxlint/rules/no-expect-forbidden-subject-name--rename-to-concrete-subject.ts)

<!-- END GENERATED rule-header -->

## Violation

For an `expect(...)` call in a spec file, the names of the identifiers appearing inside the first argument are read. Where a name matches any of the configured forbidden patterns, the report stands at that identifier.

The starting point is the `expect(...)` call itself; whether a matcher was called is not read. A form where no assertion was completed, such as `expect(data);`, is in scope, so that dropping the matcher is not a way out of the name check. Only the name is read here — what the matcher claims is not.

`expect.soft(...)` and `expect.poll(...)` are read as the same starting point. Member spellings are read in any notation that settles before the run, so `expect["soft"](...)` is treated the same. A namespace utility call such as `expect.assertions(2)` is not a derived receiver and falls out structurally.

The files in scope are settled by the file name suffix. The default is `.test.ts` and `.test.tsx`, replaceable through `specFileSuffixes`.

The first argument is walked. Type assertions, `satisfies`, non-null assertions, optional chains and `await` are peeled before reading. Where the walk goes and where it does not:

| Position | Example | Read |
| --- | --- | --- |
| A bare identifier | `expect(data)` | Yes |
| The receiver of a member access | `expect(result.id)` | The receiver |
| A computed member key | `expect(report[data])` | Yes |
| An object's values and spreads | `expect({ id: data })` | Yes |
| A computed property key | `expect({ [data]: 1 })` | Yes |
| An array element | `expect([data])` | Yes |
| An argument of a call or `new` | `expect(normalise(data))` | Yes |
| The receiver of a call | `expect(result.at(0))` | The receiver |
| A template interpolation | ``expect(`${data}`)`` | Yes |
| Each term of a conditional, logical, binary or unary expression | `expect(data ?? fallback)` | Yes |
| The expression a thunk returns | `expect.poll(() => data)` | Yes |
| A non-computed property key | `expect({ data: response })` | No |
| A non-computed member name | `expect(response.result)` | No |
| The name of a callee or a tag | `expect(toResult(response))` | No |

A computed key is read because it is an expression evaluated at run time. A non-computed key and a member name are labels rather than the name of the value the assertion receives. A callee name is the same: what appears there is the name of a procedure, not the subject. That a call happens inside `expect` at all is taken by [no-expect-call-expression--yield-from-fixture](./no-expect-call-expression--yield-from-fixture.md).

Matching ignores case. With no anchor in the pattern it becomes a suffix match, so a compound word such as `parseResult` falls too.

### The invariant

The subject's name is the strongest available clue to what an assertion pins down. Where the name is generic, the assertion stops saying what it verifies and the reader has to work backwards from the fixture to find what the name points at.

The cause of a generic name is usually not the naming but something earlier: typically the fixture returning a value bundling several results instead of one concrete subject. The structural side is taken by other rules. Taking a member out of a compound value the fixture returned and making it the subject falls to [no-expect-projected-subject--use-tostrictequal-on-subject](./no-expect-projected-subject--use-tostrictequal-on-subject.md); assembling a value inside the `it` before handing it over falls to [require-it-only-expect--move-setup-into-fixture](./require-it-only-expect--move-setup-into-fixture.md).

What is left after those is a compound value pinned whole with an exact match. That shape has no unchecked face, so none of the other rules fires. Yet the reader is told nothing about what the assertion claims. That is what this rule takes: readability itself, rather than standing proxy for a structural problem.

"Is this compound value one subject, or a bag with unrelated results in it" is a question of what the value means, and it appears in neither the type nor the syntax. The detection holds without settling that, because the only harm left from not settling it is that the name tells the reader nothing.

### Configuration

`forbiddenSubjectNames` and `specFileSuffixes`.

```ts
[{ forbiddenSubjectNames: [{ pattern: "^data$" }, { pattern: "result$" }] }];
```

Each item of `forbiddenSubjectNames` is an object carrying exactly one `pattern`, a regular expression source string without delimiters, matched against identifier names. The presence of anchors settles how it matches: `^data$` matches only where the whole identifier is `data`, while `result$` also matches a compound word ending in that word. Keys other than `pattern` are refused by the schema.

`forbiddenSubjectNames` only adds to the default vocabulary; the default cannot be removed. With no configuration passed, the check runs on the default vocabulary. The vocabulary lives in `FORBIDDEN_AMBIGUOUS_NAMES` in `src/lint/oxlint/lib/forbidden-ambiguous-names.ts`, and [no-ambiguous-variable-name--rename-to-concrete-noun](./no-ambiguous-variable-name--rename-to-concrete-noun.md), which reads declaration positions, reads the same list — so adding a word touches one place. Split the vocabulary in two and the same name starts passing at a declaration and failing at an assertion, or the reverse. The normalization that strips a name's decorations before matching is shared between both rules too.

`specFileSuffixes` settles the range of files in scope. The default is `.test.ts` and `.test.tsx`, shared with the other rules that read specs.

## Fix

Rename the fixture to the name of the concrete subject it returns, and let the assertion receive that binding.

```ts
const test = baseTest.extend("stem", () =>
  specStemOf("report.test.ts", DEFAULT_SPEC_FILE_SUFFIXES),
);

test("drops the suffix from the file name", ({ stem }) => {
  expect(stem).toBe("report");
});
```

Where the name points at a bag, renaming is not enough. Break the bag up into a fixture per subject and have the `it` assert each subject directly. Where several candidate names come up and none can be settled on, that fixture is doing several jobs.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a container word handed to an assertion is reported on the name itself
// in report.test.ts
expect(data).toBe(1);
```

```ts
// a compound name ending in a bag word is reported
// in report.test.ts
expect(parseResult).toStrictEqual({ id: "a" });
```

Code this rule accepts.

```ts
// a subject named after the artefact it holds is read as a subject
// in report.test.ts
expect(fetchedReport).toStrictEqual({ status: 200 });
expect(renderedText).toBe("ok");
```

```ts
// a property key is a label rather than the subject
// in report.test.ts
expect({ data: fetchedReport }).toStrictEqual({ data: 1 });
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Changing only the name evasively while the contents stay a value with several results in it (turning `data` into `parsedData`). The match comes off, and the state where the assertion says nothing about what it pins is unchanged
- Binding under a forbidden word and moving it to a concrete name just before the assertion. The declaration it moved to is read by `no-ambiguous-variable-name--rename-to-concrete-noun` with the same vocabulary
- Pushing the forbidden word out into a property key or a member name. Those are unread because the spec did not choose the name there, not because they are free space for generic names
- Dropping the matcher to leave only `expect(data);`. The starting point is the `expect(...)` call, so it does not come off
- Removing a word from the vocabulary to clear one violation. The vocabulary is configuration and can be changed, but that is a judgment about the whole vocabulary — "this word does talk about the subject" — not an operation for letting one site through
- A suppression directive

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `forbiddenSubjectName` | The subject of an assertion must not be named \`{{name}}\`. Rename the fixture and the binding it hands over to the concrete value this assertion pins. Split a fixture that hands over a bag of separate results into one fixture per subject. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
