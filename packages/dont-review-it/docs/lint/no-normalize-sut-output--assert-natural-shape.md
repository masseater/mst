---
description: "Disallow reshaping the value a fixture hands back, so an assertion is written against the shape the code under test produced rather than the shape the spec tidied it into"
---

# no-normalize-sut-output--assert-natural-shape

<!-- BEGIN GENERATED rule-header -->

Disallow reshaping the value a fixture hands back, so an assertion is written against the shape the code under test produced rather than the shape the spec tidied it into

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: yes
- Bundle: `testing`
- Source: [`no-normalize-sut-output--assert-natural-shape.ts`](../../src/lint/oxlint/rules/testing/no-normalize-sut-output--assert-natural-shape.ts)

<!-- END GENERATED rule-header -->

## Violation

A fixture reshaping the value the code under test produced before handing it back. Two shapes are reported.

- A normalizing operation standing on the way out: a method from the vocabulary, `Object.assign`, or a function named in `normalizingFunctions`. The walk reads the parts of the returned expression, follows `const` bindings in the factory body and in the file, and steps into a called function declared in the same file; where it came through a name, the report points at that name
- A destructive write made inside the factory, before the subject is handed over, to a binding the subject resolves to: a property assignment, a `delete`, `Object.assign` onto it, or a destructive method call

## Fix

Return the produced value untouched and state the claim in the assertion instead: give each element its own `it`, assert that each expected element belongs to the collection, or wrap both sides in a set before comparing.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// ordering the produced collection reshapes it on the way out
// in report.test.ts
const test = baseTest.extend("rows", () => summarise(input).sort());
```

```ts
// ordering the binding in place rewrites the value before it is handed back
// in report.test.ts
const test = baseTest.extend("rows", () => {
  const produced = summarise(input);
  produced.sort();
  return produced;
});
```

Code this rule accepts.

```ts
// a fixture that hands back the call under test hands back what the code produced
// in report.test.ts
const test = baseTest.extend("rows", () => summarise(input));
```

```ts
// an operation another module writes inside its own body is that module's own shape
import { ordered } from "./shape.ts";
const test = baseTest.extend("rows", () => ordered(summarise(input)));
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Putting the normalizing call behind a `const` or a local function. Both are followed inside this file
- Rewriting the value in place before returning it rather than deriving a new one. The write is reported on its own

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `normalizedSubject` | A fixture must not reshape the value the code under test produced before handing it back. \`{{operation}}\` reshapes it on the way out. Return the produced value untouched, and state the claim about order, duplication or formatting in the assertion itself: give each element its own \`it\`, assert that each expected element belongs to the collection, or wrap both sides in a set before comparing them. |
| `normalizedBehindName` | A fixture must not reshape the value the code under test produced before handing it back. \`{{name}}\` reaches \`{{operation}}\` on the way out. Return the produced value untouched, and state the claim about order, duplication or formatting in the assertion itself: give each element its own \`it\`, assert that each expected element belongs to the collection, or wrap both sides in a set before comparing them. |
| `mutatedSubject` | A fixture must not write over the value the code under test produced before handing it back. {{operation}} rewrites \`{{subject}}\` on the way out. Keep the produced value untouched, and state what this rewriting was preparing for in the assertion itself. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
