---
description: "Require every fixture to be declared as its own builder call whose type is inferred from what the factory returns, so the shape a test destructures is the shape the factory produces rather than a hand-written copy that drifts away from it"
---

# require-vitest-extend-builder--infer-fixture-type

<!-- BEGIN GENERATED rule-header -->

Require every fixture to be declared as its own builder call whose type is inferred from what the factory returns, so the shape a test destructures is the shape the factory produces rather than a hand-written copy that drifts away from it

- Tool: `oxlint`
- Fixable: yes
- Suggestions: no
- Options: no
- Bundle: `testing`
- Source: [`require-vitest-extend-builder--infer-fixture-type.ts`](../../src/lint/oxlint/rules/testing/require-vitest-extend-builder--infer-fixture-type.ts)

<!-- END GENERATED rule-header -->

## Violation

A fixture declared by handing an object of fixtures to the builder, and a builder call carrying a written-out type argument. Both leave the shape a test destructures written by hand rather than read off what the factory returns.

An automatic fix rewrites the declaration into one builder call per fixture, and deletes a written-out type argument.

## Fix

Declare each fixture as its own builder call naming the fixture and then its factory, and let the fixture type be read off what that factory returns.

```ts
const test = baseTest
  .extend("report", () => summarise(entries))
  .extend("stem", () => specStemOf("report.test.ts", SUFFIXES));
```

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// an object of fixtures becomes one builder call carrying the factory
const test = baseTest.extend({ report: async ({}, use) => { await use(summarise()); } });
```

```ts
// a written out type argument beside a named fixture is reported on its own
baseTest.extend<{ report: Report }>("report", () => summarise());
```

Code this rule accepts.

```ts
// a fixture named beside its factory reads its type off what the factory returns
const test = baseTest.extend("report", () => summarise());
```

```ts
// a scoped fixture takes its options between the name and the factory
const test = baseTest.extend("db", { scope: "file" }, () => openDb());
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Writing the fixture type out as a type argument. The hand-written shape drifts from the factory
- Keeping the object form and annotating the binding instead

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `objectFixtureDeclaration` | A fixture must not be declared by handing an object of fixtures to the builder. Declare each fixture as its own builder call naming the fixture and then its factory, so the fixture type is read off what that factory returns. |
| `handWrittenFixtureType` | A fixture builder call must not carry a written out type argument. Delete \`{{written}}\` and let each fixture type be read off what its own factory returns. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads no options. A consumer turns it on or off as a whole.

<!-- END GENERATED runtime -->
