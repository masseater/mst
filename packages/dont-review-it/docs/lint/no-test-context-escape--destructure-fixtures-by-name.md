---
description: "Disallow a test callback or a fixture factory holding the test context as anything but a pattern of statically readable fixture names, so the fixtures a test depends on stay listed in its parameter and the rules that read those names keep deciding"
---

# no-test-context-escape--destructure-fixtures-by-name

<!-- BEGIN GENERATED rule-header -->

Disallow a test callback or a fixture factory holding the test context as anything but a pattern of statically readable fixture names, so the fixtures a test depends on stay listed in its parameter and the rules that read those names keep deciding

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: no
- Shipped in the preset: yes
- Source: [`no-test-context-escape--destructure-fixtures-by-name.ts`](../../src/lint/oxlint/rules/no-test-context-escape--destructure-fixtures-by-name.ts)

<!-- END GENERATED rule-header -->

## Violation

A test callback or a fixture factory holding the test context as anything but a pattern of statically readable fixture names. Four reports: the context gathered into a rest binding, bound as a whole, taken through a key written as a subscript, and spread, enumerated, subscripted or handed to another function.

Every rule of this bundle reads the fixture names listed in that pattern, so a context that leaves it takes those rules with it.

## Fix

List the fixtures the test uses as separate static names in an object pattern, and take each one out by name.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// binding the context as one name is reported
it("names a behaviour", (ctx) => {});
```

```ts
// gathering the rest of the context is reported
it("names a behaviour", ({ subject, ...rest }) => {});
```

Code this rule accepts.

```ts
// taking fixtures apart by name passes
it("names a behaviour", ({ subject, options }) => {});
```

```ts
// a rest over a fixture value is not a rest over the context
it("names a behaviour", ({ options: { ...spread } }) => {});
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Binding the whole context and destructuring it on the next line. The parameter no longer lists what the test depends on
- Reaching a fixture through a subscript, or handing the context to a helper

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `restContext` | A test context must not be gathered into a rest binding. List the fixtures this test uses as separate names in the pattern. |
| `wholeContext` | A test context must not be bound as a whole. List the fixtures this test uses in an object pattern, and take each one out by name. |
| `computedContextKey` | A key of a test context pattern must not be written as a subscript. Name the fixture this key stands for as a static key. |
| `traversedContext` | A test context must not be spread, enumerated, subscripted, or handed to another function. List the fixtures \`{{held}}\` stands for in an object pattern, and take each one out by name. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads no options. A consumer turns it on or off as a whole.

<!-- END GENERATED runtime -->
