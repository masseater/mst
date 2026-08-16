---
description: "Disallow handing a concrete type to a value the source declares as `any` or `unknown`, so every concrete type a value carries reached it through a step that read the value"
---

# no-unchecked-cast--parse-at-boundary

<!-- BEGIN GENERATED rule-header -->

Disallow handing a concrete type to a value the source declares as `any` or `unknown`, so every concrete type a value carries reached it through a step that read the value

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: no
- Bundle: `writing`
- Source: [`no-unchecked-cast--parse-at-boundary.ts`](../../src/lint/oxlint/rules/writing/no-unchecked-cast--parse-at-boundary.ts)

<!-- END GENERATED rule-header -->

## Violation

A concrete type handed to a value the source declares as `any` or `unknown`, in three shapes: an assertion placing a concrete type on such a value, an annotation doing the same to a value declared `any`, and a type predicate whose body never reads the parameter it claims to narrow.

## Fix

Parse the value at the boundary it enters through and take the concrete type from the return type of that parse. Where a predicate stands, read the parameter in the body and return what that reading settles.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// an any value handed a named type by assertion is reported
const loose: any = read();
const row = loose as Row;
```

```ts
// a predicate whose body never reads the parameter is reported
const isRow = (value: unknown): value is Row => true;
```

Code this rule accepts.

```ts
// an assertion on a value with a declared shape keeps the compatibility step
const input: string = read();
const total = input as number;
```

```ts
// a value a parse hands back is bound to the type that parse returns
const row: Row = parseRow(given);
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Moving the assertion behind an annotation, or the annotation behind an assertion. Both shapes are read
- Writing a predicate whose body returns a constant. It claims a narrowing nothing looked at

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `uncheckedCast` | A value declared \`{{looseType}}\` must not be handed a concrete type by assertion. Parse \`{{claimed}}\` at the boundary it enters through and take the concrete type from the return type of that parse. |
| `uncheckedTypeClaim` | A value declared \`any\` must not be handed a concrete type by annotation. Parse \`{{claimed}}\` at the boundary it enters through and take the concrete type from the return type of that parse. |
| `unexaminedTypePredicate` | A type predicate must not stand on a body that leaves \`{{parameter}}\` unread. Read \`{{parameter}}\` in the body and return what that reading settles. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads no options. A consumer turns it on or off as a whole.

<!-- END GENERATED runtime -->
