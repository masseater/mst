---
description: "Disallow a binding named by one of the ambiguous-name patterns, so the name says what the binding holds instead of sending a reader upstream to the assignment"
---

# no-ambiguous-variable-name--rename-to-concrete-noun

<!-- BEGIN GENERATED rule-header -->

Disallow a binding named by one of the ambiguous-name patterns, so the name says what the binding holds instead of sending a reader upstream to the assignment

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: yes
- Bundle: `writing`
- Source: [`no-ambiguous-variable-name--rename-to-concrete-noun.ts`](../../src/lint/oxlint/rules/writing/no-ambiguous-variable-name--rename-to-concrete-noun.ts)

<!-- END GENERATED rule-header -->

## Violation

A binding whose name matches one of the ambiguous-name patterns. Variable declarators, destructuring bindings that rename, array pattern elements, function parameters and class fields are all read; a shorthand destructuring, a computed field key and a field carrying `override` are not, because the name there is not the writer's to choose.

Before matching, a name is normalised: trailing digits and leading qualifiers such as `the`, `raw` or `current` are dropped. The default vocabulary lives in the rule, the option adds patterns to it, and matching ignores case. The same vocabulary is read at assertion subjects by [no-expect-forbidden-subject-name--rename-to-concrete-subject](./no-expect-forbidden-subject-name--rename-to-concrete-subject.md).

## Fix

Rename the binding to a noun that names the value itself: the parsed config, the rendered fragment, the fetched record, the caught error.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a compound name ending in a bag word is reported on the name itself
const parseResult = parse(source);
```

```ts
// a decoration in front of a forbidden word does not rescue the name
const theData = load();
```

Code this rule accepts.

```ts
// an object pattern takes its names from the shape it destructures
const { data } = payload;
```

```ts
// a name that merely contains a forbidden word still names its subject
const interval = 30;
const defaultValue = 0;
const metadata = read();
const resultCount = 3;
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Adding a qualifier or a digit to the same word (`theData`, `data2`). Both are stripped before matching
- Moving the name into a property key and destructuring it as shorthand. The value is still bound under a name that says nothing

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `ambiguousVariableName` | The name \`{{name}}\` must not be used as a binding name. Rename it to a noun that names the value itself: the parsed config, the rendered fragment, the fetched record, the caught error. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
