---
description: "Disallow asserting the type of an expression that is already the result of a type assertion, so no value arrives at its declared type through a route the type checker was told to stop checking"
---

# no-double-type-assertion--declare-the-real-type

<!-- BEGIN GENERATED rule-header -->

Disallow asserting the type of an expression that is already the result of a type assertion, so no value arrives at its declared type through a route the type checker was told to stop checking

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: no
- Shipped in the preset: yes
- Source: [`no-double-type-assertion--declare-the-real-type.ts`](../../src/lint/oxlint/rules/no-double-type-assertion--declare-the-real-type.ts)

<!-- END GENERATED rule-header -->

## Violation

A type assertion expression whose own target is a type assertion expression. The target is judged with parentheses peeled off.

Two syntaxes count as an assertion.

- `expr as T` (`TSAsExpression`)
- `<T>expr` (`TSTypeAssertion`)

The two are interchangeable, so combinations are not distinguished either. `x as A as B`, `<B>(x as A)`, `<A>x as B` and `(x as A) as B` are all reported as the same violation. Close one spelling only and the other stays as a way out.

What the intermediate type is is not read. Going through `unknown`, going through `any`, and two concrete types side by side are treated alike. Writing `any` at all is closed separately by `typescript/no-explicit-any`, but this rule never changes its judgment on the presence of `any`. Whatever the intermediate type, the meaning of the second assertion is constant: it disables the check on the result of the first.

At three steps or more (`x as A as B as C`), one report stands per step standing on an assertion. The example above produces two. Collapse them into one and, after fixing one, the rest are invisible and whether it is fully fixed cannot be settled.

These are not detected.

| Shape | Why it is not detected |
| --- | --- |
| `x as T` / `<T>x` | A single assertion. The condition where stacking erases the type checker's refusal does not hold |
| `[1, 2] as const` | The target is a literal, not an assertion. Same as a single one |
| `(x satisfies T) as U` | The target is a `satisfies` expression. `satisfies` erases no check, so the first step is alive |
| `x! as T` | The target is a non-null assertion. No claim about a type is stacked |
| `const a = x as T;` across two statements | Each is a single assertion |

On the other hand `[1, 2] as const as number[]` is reported. `as const` alone is out of scope, but the moment another step rides on it, what holds is precisely the state of "the check has been erased by stacking".

There is no exemption by file kind. Test code is treated the same.

### The invariant

Where a value is being treated as some type, the type checker has looked at that correspondence at least once.

A single assertion does not break this. `x as T` passes only where the type of `x` and `T` overlap, and an unrelated pair (`string as number`, say) is refused by the type checker. It is a means of telling the checker what the writer knows, not a means of removing the check itself.

At two steps the property changes. Move to a type overlapping everything — `unknown` or `any` — at the first step, and the second assertion passes whatever it claims. A `string` value can be declared a `Buffer`; a `null` can be declared a `User`. Making the intermediate type concrete changes nothing: even where `A` and `B` do not overlap directly, choosing an `M` overlapping `A` and overlapping `B` builds the route. A two-step assertion is not syntax for conveying the writer's knowledge; it is syntax for evading what the check demands.

It breaks in two layers.

The first is that the declaration and the actual value drift apart. The type written to the right of `as` is treated as that value's type from then on. Where the actual value differs, nowhere holds the knowledge that it differs.

The second is that the drift does not surface on this line. A wrong type declaration first breaks on the side that uses the value. A property reference returns `undefined`, the function it was handed to expects another shape, and the failure happens far from the line where the assertion was written. No mark is left on the line that caused it. The type checker was told "do not look" on this line, so however far the contradiction spreads afterwards, it reports nothing.

So this syntax is not something to judge case by case in review; it is something for a machine to stop. Situations where a two-step assertion is warranted are, in any case, a restatement of "the actual type has not been declared".

### Configuration

None. Only whether the rule is on or off is settled by the configuration.

## Fix

Three routes, depending on what the assertion is trying to claim.

**Where the value's origin is under your control**, write the type at the origin. Repair the function's return type, the variable's declaration or a parameter's type annotation, and the reason for writing an assertion at the call site disappears.

**Where the value really is indeterminate**, make the boundary type `unknown` and narrow from there in one checked step. Write a type guard, or run it through a parser that returns a failure as a value.

```ts
const parseUser = (input: unknown): User | null => (isUser(input) ? input : null);
```

`isUser` is a predicate that actually looks at the value. Where the body of a function carrying the type predicate `input is User` inspects the value, drift between declaration and reality surfaces at the moment of inspection.

**Where an external library's types differ from reality**, express that difference on the type side. Augmenting through `declare module`, spelling out a generic argument, or a type parameter the library already offers will usually express it. Where it cannot be expressed, put exactly one function at the boundary and check from `unknown` inside it. With the boundary in one place, the place to fix when the library is fixed is one place too.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// an assertion routed through unknown is reported
const total = input as unknown as number;
```

```ts
// three stacked assertions report each step that stands on an assertion
const total = input as Loose as Source as Target;
```

Code this rule accepts.

```ts
// a single assertion is still checked by the type checker
const total = input as number;
```

```ts
// an assertion applied to a satisfies expression keeps the checked step
const total = (input satisfies Source) as number;
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Splitting the assertion across two statements (`const raw = x as unknown;` then `const user = raw as User;`). This rule reads expression nesting, so the report clears while the route that erases the check stays exactly as it was. For a reader it is harder to find, by the amount the erased check has scattered across two lines
- Separating the steps with an identity function (`identity(x as A) as B`). One call was inserted; the type route travelled is the same. The inserted function lands on [no-identity-wrapper--call-the-target-directly](./no-identity-wrapper--call-the-target-directly.md)
- Making the intermediate type concrete rather than `unknown` or `any` so it does not look like two steps. This rule does not read the intermediate type, so the report is unchanged
- Inserting `satisfies` to change the look. `satisfies` erases no check, so `(x as A) satisfies B` fails where the types do not line up. Add an `as` to make it pass and it is reported again
- A suppression directive. A two-step assertion is a statement that the type is not known, and anything writable as a suppression reason says the same thing this rule is already pointing at

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `stackedTypeAssertion` | A type assertion must not be applied to an expression that is already a type assertion. Declare the type the value really has: annotate the place the value comes from, narrow it with a guard that inspects the value, or parse it into the target type and let the parse fail on input that does not match. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads no options. A consumer turns it on or off as a whole.

<!-- END GENERATED runtime -->
