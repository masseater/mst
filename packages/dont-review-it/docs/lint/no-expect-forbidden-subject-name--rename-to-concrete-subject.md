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
- Bundle: `testing`
- Source: [`no-expect-forbidden-subject-name--rename-to-concrete-subject.ts`](../../src/lint/oxlint/rules/testing/no-expect-forbidden-subject-name--rename-to-concrete-subject.ts)

<!-- END GENERATED rule-header -->

## Violation

An identifier inside the first argument of `expect(...)` whose name matches one of the forbidden-name patterns. Whether a matcher follows is not read, so dropping it does not clear the report.

The walk reads the positions where the value itself stands: a bare identifier, the receiver of a member access or a call, an object's values, an array's elements, a call's arguments, a computed key, a template interpolation, each term of an operator expression, and the expression a thunk returns. A non-computed property key, a non-computed member name and a callee name are labels rather than the subject, and are not read.

`forbiddenSubjectNames` adds patterns to the vocabulary this rule shares with [no-ambiguous-variable-name--rename-to-concrete-noun](./no-ambiguous-variable-name--rename-to-concrete-noun.md); each entry carries one `pattern`, matched case-insensitively against the normalised name, and the anchors it holds settle whether it matches the whole name or part of it.

## Fix

Rename the fixture and the binding it hands over to the concrete value the assertion pins, and let the assertion receive that name.

Where the name points at a bag of unrelated results, split the fixture into one per subject.

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

- Adding a qualifier to the same word (`parsedData`). The normalisation strips it before matching
- Pushing the word into a property key or a member name. Those are unread because the spec did not choose the name there
- Removing a word from the vocabulary to clear one site. That is a judgment about the whole vocabulary

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
