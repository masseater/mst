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
- Bundle: `writing`
- Source: [`no-identity-wrapper--call-the-target-directly.ts`](../../src/lint/oxlint/rules/writing/no-identity-wrapper--call-the-target-directly.ts)

<!-- END GENERATED rule-header -->

## Violation

A named function whose whole body is one call that passes its own parameters through unchanged. A function declaration is read, and so is a function or arrow bound to a `const` whose binding carries no type annotation.

Every parameter has to be a plain identifier or a rest element, and the call's arguments have to be those same names in the same order, with a spread where the rest was. The function is left alone when it declares a contract of its own — a return type, type parameters, or type arguments on the call — and when it is `async` or a generator, and when the callee is one of its own parameters.

## Fix

Call the target where this function is called, and delete this one.

To publish a name from another module, re-export it: `export { parseUser } from "./parse-user.ts";`.

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

- Adding a return type or a type parameter that restates the target's. The wrapper is unchanged and now has a contract to keep in step
- Reordering the arguments or dropping one so the forwarding is no longer exact, while the name still only stands in front of the target

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
