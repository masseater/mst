---
description: "Disallow a module specifier whose value is decided while the program runs, so every specifier in the source is one string the checks that read specifiers can match"
---

# forbid-unresolvable-module-specifier--write-a-statically-resolvable-specifier

<!-- BEGIN GENERATED rule-header -->

Disallow a module specifier whose value is decided while the program runs, so every specifier in the source is one string the checks that read specifiers can match

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: yes
- Shipped in the preset: yes
- Source: [`forbid-unresolvable-module-specifier--write-a-statically-resolvable-specifier.ts`](../../src/lint/oxlint/rules/forbid-unresolvable-module-specifier--write-a-statically-resolvable-specifier.ts)

<!-- END GENERATED rule-header -->

## Violation

An expression standing in the specifier position of a module request that does not fold to one string before the run.

There are two positions where a specifier can take an expression: dynamic `import(...)` and `require(...)`. Every other route (a static `import` declaration, a named re-export, a wildcard re-export, the import-equals form, an import type reference in type position) can hold nothing but a string literal by grammar, so it is already settled on one string before this check runs. **They are not unread — there is nothing to read.**

These shapes fold, and are not violations.

- A written-out string
- A template literal whose every substitution folds
- A concatenation of strings
- A value bound to a `const` in the same file whose initializer folds. Bindings resolve in declaration order, so a constant assembled below out of a constant bound above folds too

Shapes that do not fold are violations: a value read from a binding, a value arriving as an argument, a property of an object, the return of a call, the result of a conditional expression.

A conditional expression is treated as a violation even where both candidates are written right there. What is protected is "the specifier is settled on one string", not "the candidates are readable". To enumerate candidates, write a request per branch. A request placed on a branch carries one string, so none of them is reported.

Forms that resolve relative to this module's own position are allowed only where they are registered in the table. The default is two — `URL` and `import.meta.resolve` — covering `new URL("./worker.ts", import.meta.url).href` and `import.meta.resolve("./worker.ts")`. **They are allowed only where the head of the form is in the table and at least one of the arguments handed to it folds.** Registering a form declares "this form resolves before the run", but letting through a call that never writes the position out would take the check off by putting one variable inside a registered form.

A file placed at a registered exception path is exempt only while it is covered by a row carrying a reason. A row with no reason is an invalid registration, and the registration itself is reported at the files that row covers. **A row with no reason exempts nothing.**

The report points at the module request itself, and the message carries the expression written in the specifier position as it stands.

### The invariant

Every check that reads specifiers takes the specifier's string as its input. Against a specifier whose value settles only while the program runs, the result of matching is not "did not match" but "could not be judged". In a design that does not make "could not be judged" a violation, that comes out as "no violation".

**From a check's output, a green that matched nothing and a green that could not match at all cannot be told apart.**

Being unable to tell drops the strength of a prohibition down to the level of the writer's goodwill. The detour is one variable inside a template literal, so the stronger the prohibition, the more pressure gathers on the one route still open. A strong prohibition living beside a one-line way out is the worst state of all.

And requests that genuinely have to settle their destination at run time are rare. Where the candidates are closed, they can be written as a literal per branch; where they are not closed, that belongs in a registry rather than in module resolution. Leaving every specifier possibly unreadable is not a trade worth making for a rare request.

### Configuration

```jsonc
[
  "error",
  {
    "staticallyResolvedForms": ["URL", "import.meta.resolve"],
    "exceptions": [{ "path": "apps/*/plugin-host/**", "reason": "the deployment configuration settles the candidates" }],
  },
]
```

`staticallyResolvedForms` lists the heads of forms declared to resolve before the run. The head is the spelling of the call's callee: `URL` for `new URL(...)`, `import.meta.resolve` for `import.meta.resolve(...)`. Omitting it leaves the default two in effect.

`exceptions` is a list of rows pairing a path with a reason. `path` is a glob, and a row whose `reason` is empty is an invalid registration.

This rule holds no setting for narrowing what is checked. Narrowing a range is what the lint configuration's `overrides` expresses; putting the branch in the rule would split the definition of a file kind across two places. The default is the whole repository.

### What this check does not take on

- Which module the folded result resolves to. The folding is this rule's; matching what lies past it belongs to the other checks that read specifiers
- Folding by following a constant declared in another file. Folding closes inside one file. Reach across files belongs to the check whose unit of judgment is the module graph
- Stock-taking of whether an exception row is actually used. Finding registration rows that reach no check route belongs to the check that reconciles the register against the range of targets

## Fix

Enumerate the candidates as branches and write each as a literal. Being able to write the branches means the candidates are closed, and almost everything lands in this shape.

Where the candidates are not closed, move it out of module resolution and into a registry. Import the implementations explicitly, build a table mapping a name to an implementation, and leave only the lookup name settled at run time. A name absent from the table then becomes a failure on the side that read the table, and the set of destinations can be learned by reading the source.

Where you only want to resolve relative to this module's own position, write it in a registered form. Write the position as a literal and take only the base from the module itself.

What may be registered as an exception is only a setup where the set of candidates is settled by external configuration. Write in the row's reason what that external thing is.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a specifier read from a binding is decided while the program runs
export const loaded = import(chosen);
```

```ts
// a specifier chosen by a condition is more than one string
export const loaded = import(wide ? "./wide.ts" : "./narrow.ts");
```

Code this rule accepts.

```ts
// a template filled from a constant of this file folds to one string
const STEM = "reader";
export const loaded = import(`./${STEM}.ts`);
```

```ts
// candidates written as a literal in each branch are each one string at rest
export const load = async (wide: boolean) =>
  wide ? await import("./wide.ts") : await import("./narrow.ts");
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Moving the assembly of the specifier into another function or module so that the request line holds no non-literal expression. That it is assembled where it moved to does not change, and the request there is reported as the same violation
- Silencing it with a suppression comment. Exceptions live in the configuration, not on a line of source
- Rebinding `require` to another name and calling that. Whether something is a request is told from the spelling of the call, so a rebound call is not reported. **Not being reported does not mean it is allowed**
- Registering an exception on the grounds that "it is shorter written that way". An exception holds only where the candidates are settled externally, and the reason is where that external thing goes
- Registering an exception while leaving the reason empty. It grants no exemption, and the registration itself is reported

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `unresolvableModuleSpecifier` | A module specifier must not be an expression decided while the program runs. \`{{written}}\` leaves this request unchecked against the modules this repository refuses. Write one literal specifier in each branch, or import every implementation and pick one by name from a table. Register a specifier that has to stay this way in this rule's \`exceptions\` option with the grounds it stays, never in a suppression comment. |
| `groundlessSpecifierException` | A registered exception must not stand without grounds. \`{{path}}\` carries none. Write what decides the candidates outside this repository into that entry, or delete the entry and write specifiers the source spells out. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
