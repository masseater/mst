---
description: "Disallow a named function whose whole body forwards its own parameters unchanged to one other call and declares no type contract of its own, so a caller reaches the function that does the work instead of a name that only stands in front of it"
---

# no-identity-wrapper--call-the-target-directly

<!-- BEGIN GENERATED rule-header -->

Disallow a named function whose whole body forwards its own parameters unchanged to one other call and declares no type contract of its own, so a caller reaches the function that does the work instead of a name that only stands in front of it

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: no
- Shipped in the preset: yes
- Source: [`no-identity-wrapper--call-the-target-directly.ts`](../../src/lint/oxlint/rules/no-identity-wrapper--call-the-target-directly.ts)

<!-- END GENERATED rule-header -->

## Violation

A named function meeting all three of these at once.

1. Its body is one call expression and nothing else
2. That call's arguments stand in the same order, in the same number and under the same names as the function's own parameters
3. It declares no return type contract at its own boundary

"A named function" is limited to two shapes: a `function` declaration, and an assignment to an identifier (`const forward = (input) => target(input);`, `const forward = function (input) { return target(input); };`). Object properties, class methods and callbacks written straight into a call are left out. Not because they cannot be detected, but on purpose — see below.

Two body shapes count. An arrow with an expression body (`(a) => f(a)`), and a block made of one `return` statement (`(a) => { return f(a); }`). With two statements or more, the function is doing something besides forwarding.

Arguments are matched by name. `(a, b) => f(a, b)` matches; `(a, b) => f(b, a)` does not. Spreading a rest parameter (`(...args) => f(...args)`) counts as a match. Zero parameters with zero arguments (`() => start()`) is a match too — it is still a second name for the same call.

The shape of the target makes no difference. An identifier (`f(a)`) and a member reference (`parser.parse(a)`) are reported alike.

### Declaring a return contract passes

Any of these means the function declares at its own boundary what it produces. The value passing straight through is then not reported.

- A return type annotation on the function (`const parse = (input: string): User => read(input);`)
- A type annotation on the binding it is assigned to (`const parse: ParseUser = (input) => read(input);`)
- Type parameters of its own (`const parse = <Parsed>(input) => read(input);`)
- Type arguments on the forwarded call (`const parse = (input) => read<User>(input);`)

Parameter type annotations are not included. Under `noImplicitAny` a parameter annotation is effectively mandatory, so counting it as a declared contract would leave the rule reporting nothing. Only the return-side declaration, which is optional to write, carries a writer's judgment.

This rule does not confirm that the declared type is genuinely narrower than the target's. Reading a type relation needs the type checker's answer, and this rule set sits on a foundation that judges on syntax alone ([EDR 0004](../../../../docs/engineering-decision-logs/0004-shape-the-lint-rule-foundation-around-tooling-limits.md)). So the judgment is "is a return contract written at the boundary", and adding a wide annotation that narrows nothing to clear the report is closed off under forbidden bypasses.

### Re-exporting under another name

**No exemption. As long as it is written as a forwarding function, it is reported.**

This repository holds nothing that structurally guarantees a file is a re-export-only file. `require-re-export-only-files--move-declaration-to-owning-module` is opt-in and receives no `targets` in the base preset, so it checks nothing. There is nowhere for a rule to stand the premise "this file is a surface, so a forwarding function is allowed here". Carve the exception by file name or path, and that exception can be applied to anything at any time.

The proper syntax for publishing under another name already exists.

```ts
export { parseUser } from "./parse-user.ts";
export { parseUser as parse } from "./parse-user.ts";
```

A re-export forwards the definition itself. A forwarding function copies the shape of the definition and creates another function. The route back to the definition, what follows a rename, and what a search for the call finds are all different between the two. With the proper syntax available, there is no reason left to allow a forwarding function.

### Why inline callbacks are left out

`inputs.map((input) => parse(input))` is not reported because the fix would not be correct. `inputs.map(parse)` does not behave the same: `map` hands the callback the element, the index and the array, so behaviour changes as soon as `parse` takes a second parameter. Reporting where "call the target directly" does not hold produces breakage in whoever follows the instruction.

`async` functions and generators are left out for the same reason. `async (a) => f(a)` is not the same function as `f`: a failure thrown synchronously becomes a rejected promise. A generator turns the return contract into a sequence. Neither can be replaced by calling `f` directly.

### The invariant

One behaviour corresponds to one name.

A function that only forwards makes that correspondence one to two. Two names name the same behaviour, and one of them holds nothing.

Three things break for the reader. Reaching the definition takes one more step: looking up the name yields only "there is another name", with the behaviour one layer further on. Searching for the target's name does not turn up calls that went through this function, so working out the reach of a change no longer ends with one search. And the two names can be changed independently, so renaming one leaves the other intact and the correspondence between the names drifts apart in silence.

For the writer, such a function is usually placed as "somewhere to add something later". Until something is added, the place is empty. An empty abstraction does not help when the time comes to add something, because the parameters and the return the addition needs are normally not the one-to-one shape that was put there.

There is, on the other hand, a shape where a value passing straight through does mean something. Where the target's type is wide and that width is not right for this module, placing a binding that declares a narrow type adds vocabulary rather than behaviour. Passing straight through is a question of shape, and what is declared there is a separate question. That is why this rule divides the two by whether a return contract stands at the boundary.

### Configuration

None. Only whether the rule is on or off is settled by the configuration.

## Fix

**Call the target directly.** Replace the calls to the forwarding function with calls to the target and delete the function. However many call sites there are, the replacement is mechanical.

**Where publishing under another name was the point, make it a re-export.**

```ts
export { parse as parseUser } from "./parse.ts";
```

**Where the target's type being too wide was the reason, declare the narrow type.** Write a return type annotation, or a type annotation on the binding. If the declared type is genuinely narrower, that declaration is this module's vocabulary.

```ts
const scopeAt: ScopeLookup = (node) => context.sourceCode.getScope(node);
```

**Where matching a receiver's shape was the reason, repair the target instead.** If the parameters are wrapped because their order or number does not line up, that is a transformation and not forwarding, and this rule does not reach it. Being reported means the shapes already line up.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// an arrow that forwards its only parameter is reported
const parseUser = (input) => parse(input);
```

```ts
// renaming an imported name through a wrapper is reported, not exempted
import { parse } from './parse.ts';
export const parseUser = (input) => parse(input);
```

Code this rule accepts.

```ts
// a return type annotation declares a contract at this boundary
const parseUser = (input: string): User => parse(input);
```

```ts
// re-exporting the name forwards the definition instead of copying its shape
export { parseUser } from './parse-user.ts';
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Adding a return type annotation that narrows nothing to clear the report. Writing `: ReturnType<typeof read>`, or the target's return type verbatim, on `(input) => read(input)` does not change that this function declares nothing. The report clears because this rule does not confirm type relations — the reason it clears is the limit of the check, not the spelling becoming legitimate
- Giving the binding an alias of the target's own type. The count of type alias names goes up and the contract narrows not at all
- Adding a pointless statement to the body to escape the one-statement condition. Nothing besides forwarding is happening, so all that grew is the line count
- Renaming a parameter to escape the name match (turning `(source) => parse(source)` into `(source) => parse(source as string)` and the like). The judgment runs on name equality, so some rewrites clear the report while what the function does stays the same. Adding a type assertion also brings it under `no-double-type-assertion--declare-the-real-type`
- Moving the forwarding function onto an object property or a class method to leave the scope. Only named bindings are read so that the judgment stays inside the range where the fix holds — not because those positions are places it may be written
- Adding `async` to leave the scope. Where the target is synchronous, adding `async` makes callers write `await` and changes how failures travel. Changing the contract only to clear a report is not a reason to keep the function
- A suppression directive

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `identityWrapper` | A named function must not consist of nothing but a call that passes its own parameters through unchanged. Call the target where this function is being called and delete this one. To publish a name from another module, re-export it: \`export { parseUser } from "./parse-user.ts"\`. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads no options. A consumer turns it on or off as a whole.

<!-- END GENERATED runtime -->
