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
- Shipped in the preset: yes
- Source: [`no-unchecked-cast--parse-at-boundary.ts`](../../src/lint/oxlint/rules/no-unchecked-cast--parse-at-boundary.ts)

<!-- END GENERATED rule-header -->

## Violation

A position where a value declared `any` or `unknown` is made to claim a concrete type. There are three ways of making that claim.

**Claiming it by assertion.** Both `expr as T` (`TSAsExpression`) and `<T>expr` (`TSTypeAssertion`) are read. Reported when the operand is `any` or `unknown` and `T` is a concrete type. The operand is stripped of parentheses, `!` and optional chaining before the judgment. It may go through a name: a `const held = loose;` in between is followed to the declaration on the other side.

**Claiming it by annotation.** Three positions are read — a variable declaration, a class field, and a function's return type — and reported when the annotated type is concrete and the value handed over is `any`. `unknown` is not read in this position because the type checker itself refuses an assignment from `unknown`; the rewrite of dropping an assertion and moving to an annotation only passes on the `any` side.

**Claiming it by type predicate.** A function whose return type is a type predicate (`value is T`, `asserts value is T`, `asserts value`) is reported when its body never once reads the parameter being judged. Whether it read it is settled by whether one reference resolving to that parameter stands inside the body's range.

The operand's type is settled from the annotations this file writes. This rule runs in the layer that reads syntax only, so declared annotations and the chain of bindings reaching an annotation are the whole of the material.

### Deliberately not widened

| Shape | Why it is left out |
| --- | --- |
| An assertion on a value carrying a concrete type | The compatibility step is working. It only tells the checker what the writer knows |
| An assertion whose target type is `any` or `unknown` | No concrete claim is made. The condition for a bypass is not met |
| `as const` | It names no type |
| An operand that is itself an assertion | That range belongs to [no-double-type-assertion--declare-the-real-type](./no-double-type-assertion--declare-the-real-type.md) |
| A value a checking or parsing function returned | The concrete type came from a return type, not an assertion |
| A declaration carrying a predicate and no body (`declare`, a type alias, an interface) | There is no body to read |
| `this is T` | The thing being judged is not a parameter |

Type declaration files, and the file groups that deliberately write inconsistent types, are taken out of the lint target by whoever deploys it. The rule holds no exclusion of its own. This matches how `no-double-type-assertion--declare-the-real-type` is handled.

### The invariant

What is held is that where a value claims a concrete type, that type was handed over by a procedure that read the value.

`any` and `unknown` are the types treated as compatible with every target type. Once a value is in one of them, one assertion is enough for the type checker's compatibility step to stop working. What [no-double-type-assertion--declare-the-real-type](./no-double-type-assertion--declare-the-real-type.md) closes is the nested two-step, but the two-step reaches the same result in other shapes.

- Split into two statements. `const raw: unknown = read();` then `const row = raw as Row;`
- Move it inside a helper. Take an `unknown` parameter, assert to a concrete type, return
- The upstream is already `any`, so a single assertion is enough
- Drop the assertion and move the value into a binding annotated with the concrete type

The nested shape leaves each of these, and what stays the same is code that looks as if the value's shape were guaranteed when it is not. Close only the nesting and un-nesting becomes the rewrite that clears the report, which drops the discipline to a matter of style.

Type predicates are handled separately for the same reason. A type predicate is the syntax for "obtain a type as the result of reading a value", but where the body never reads the parameter it only pretends to read, and the value's shape was never confirmed. A name claiming a check is not a check.

### Configuration

None. Only whether the rule is on or off is settled by the configuration.

### Where the detection does not reach

Not being reported does not mean being allowed.

- The value's `any` comes from a library's return type, an import, or the inference of a call rather than this file's annotation. `JSON.parse(text) as Config` is that shape. Parsing at the boundary is placed by the writer
- A destructuring declaration annotated with a concrete type receives an `any` value
- A type predicate's body reads the parameter but does not use what it read in the judgment
- An `any` value is handed as an argument to a function declaring a concrete parameter. The claim's position becomes the caller's argument, which is none of the three positions

To widen this range in a layer holding type information, `typescript/no-unsafe-type-assertion` and `typescript/no-unsafe-assignment` exist as a separate discipline. They report narrowing from concrete to concrete and assertions whose target is `any`, so their range does not coincide with this rule's.

## Fix

Parse it or check it at the boundary where the value enters the program.

Put a value arriving from outside through a schema validation, a checking function carrying a type predicate, or a parsing function, and receive the concrete type as that function's return type. Always give it a route to take when the check fails. In this repository, reading the options a lint rule receives takes that shape.

```ts
const maxLinesFrom = (options: Readonly<Options>): number => {
  const [first] = options;
  if (typeof first !== "object" || first === null || Array.isArray(first)) {
    return DEFAULT_MAX_LINES;
  }
  const { maxLines } = first;
  return typeof maxLines === "number" ? maxLines : DEFAULT_MAX_LINES;
};
```

Instead of making a setting handed in from outside claim to be a `number`, it confirms the value's shape and settles what to return when it could not be confirmed. The caller receives the concrete type as a return value, so there is no reason to write an assertion.

Where a type predicate is written, the body reads the parameter.

```ts
export const isAstFields = (held: unknown): held is AstFields =>
  typeof held === "object" && held !== null && !Array.isArray(held);
```

Where a value inside the process has become `any`, fix the upstream making that type. Fix the function's return type, the variable's declaration, or the parameter's annotation, and the reason to write an assertion downstream disappears.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

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

- Passing through a type predicate that only pretends to check. A function returning true without reading its parameter is a name claiming a check. That shape is reported
- Loosening the target type. Dropping to a type with every property made optional is still a concrete claim, and the same judgment reports it
- Dropping the assertion and moving the value into a binding whose annotation is the concrete type. A claim made by annotation meets the same judgment
- A suppression directive. What can be written as a reason for suppression is the same thing as the fact that an `any` value is claiming a concrete type

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
