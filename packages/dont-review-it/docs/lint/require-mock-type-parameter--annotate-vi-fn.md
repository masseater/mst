---
description: "Require every mock function creation to carry a type parameter that pins the call signature of the dependency it stands in for, so a mock drifting from that dependency is caught by the type checker instead of passing every assertion in the suite"
---

# require-mock-type-parameter--annotate-vi-fn

<!-- BEGIN GENERATED rule-header -->

Require every mock function creation to carry a type parameter that pins the call signature of the dependency it stands in for, so a mock drifting from that dependency is caught by the type checker instead of passing every assertion in the suite

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: yes
- Shipped in the preset: yes
- Source: [`require-mock-type-parameter--annotate-vi-fn.ts`](../../src/lint/oxlint/rules/require-mock-type-parameter--annotate-vi-fn.ts)

<!-- END GENERATED rule-header -->

## Violation

A mock function creation call (`vi.fn(...)` by default) falling into either of these.

1. **A creation carrying no type argument.** Handing an implementation over as an argument makes no difference
2. **A creation whose type argument pins no call signature at all**

Whether a type argument is there is read from the creation call node itself. Where the creation carries one, no number of behaviour-settling methods chained after it is reported. Where it carries none, however many stages follow, the report comes out at the creation call.

### How the mock namespace is settled

Calling a member spelled `fn` is not on its own enough. The receiver is resolved to its binding, and only a binding landing on one of these counts as the mock namespace.

- A `vi` bound nowhere. The shape the test runner injects globally falls here
- The local name of an import that took `vi` in. `import { vi as mocker }` and the quoted-export form `import { "vi" as mocker }` are the same
- A member of a namespace that took the whole module in — following `vitest.vi` from `import * as vitest`
- A chain of bindings landing on any of the above. No limit is placed on the number of steps

Member names are treated as the same name across every statically readable spelling: dot notation, a string literal subscript, and a template literal subscript carrying no interpolation are not distinguished.

### Types that pin no call signature

| Shape | What it leaves unpinned |
| --- | --- |
| The builtin catch-all type itself | The arguments and the return, all of it |
| A type name listed in `unconstrainedTypeNames` | `Function`, the default, leaves both the argument list and the return |
| A function type whose return type is open | The return. The caller may use it as anything without a check |
| A function type whose only parameter is a rest one typed as omitted, as an open type, as a bracketed list of an open type, or as the readonly version of those | The number of arguments and the type of each |

### Deliberately not widened

| Shape | Why it is left out |
| --- | --- |
| `vi.spyOn(...)` / `vi.mocked(...)` | The signature is derived from the real declaration. There is no room to write a type argument, and the invariant is already met structurally |
| The whole chain running off a typed creation | The type argument is read from the creation call node. This is the shape the upstream rule of the same kind misreports |
| An `fn` call whose receiver resolves to something that is no mock namespace | Judge by spelling alone and a same-named method on an unrelated object gets swept in |
| A creation whose callee name is settled only at run time | It cannot be read as a name. That shape falls to [no-computed-callee-name--write-name-literally](./no-computed-callee-name--write-name-literally.md) |
| A function type returning `unknown` | The caller cannot use the value without narrowing. It is no shape the type check passes over in silence |
| A function type whose rest parameter is a tuple | The position and type of each argument are pinned |
| A function type carrying a named parameter before the rest | The leading argument is pinned. Where the real dependency is variadic, this shape is the correct copy |
| A function type called by a type name | What the name stands for is invisible from the syntax. A form called by name is treated as pinning |
| A creation called after taking the namespace apart with a destructuring | Only aliases of the namespace itself are followed, not members taken out of it |

The range is not narrowed by file name. In a shared test helper placed outside a test declaration file, the room for a mock to drift from the real thing is the same.

### The invariant

What is held is that a mock function is typed with the call signature of the dependency it stands in for.

The first layer is the type check's silence. A creation with no type argument is typed as "takes any arguments, returns who knows what". Let the argument list or the return drift from the real dependency and the type check says nothing.

The second layer is the implicit contract a mock holds with the real thing. Tests are assembled on the assumption of the mock's behaviour, so where the contract lies, every local assertion stays green and only production takes the other branch. A type argument is what hands the call-signature part of reconciling a test double against the real thing over to the type check.

The third layer is the escape of meeting the form alone. Writing a type argument is not the goal. Write a catch-all type and the type argument slot is filled while not one piece of information reaches the type check. So the contents are read too.

### Relation to the upstream rule of the same kind

The upstream `vitest/require-mock-type-parameters` reads the same invariant. Turn both on and the upstream misreports on the chain running off a typed creation, on top of two reports landing on the same creation. Where this rule is turned on, the upstream is turned off in the shared configuration. Take only one side and both break: upstream alone leaves the misreports standing, and adding this rule while keeping upstream gives doubled reports.

### Configuration

| Name | Default | Meaning |
| --- | --- | --- |
| `mockNamespaceSpellings` | `["vi"]` | The spellings counted as the namespace of the mock API |
| `mockFactoryMembers` | `["fn"]` | The member names that create a mock function |
| `unconstrainedTypeNames` | `["Function"]` | The type names counted as pinning no call signature |

Each replaces its default wholesale. Handed an empty array, the default stays.

What may go into `mockFactoryMembers` is creations whose signature is not derived from the real declaration. Put in a means of wrapping an existing function, or of promoting a real one to a mock type, and calls with no room for a type argument end up reported.

### Where the detection does not reach

Not being reported does not mean being allowed.

- An open type hidden behind a type alias. Naming an open function type and writing that name as the type argument is not reported, because the contents of a type alias are not followed. Add the alias's name to `unconstrainedTypeNames`, or write the signature directly
- A creation made after taking the namespace apart with a destructuring. Members taken out are not followed, so the report clears while the mock stays untyped
- An import from a namespace re-exported under another spelling. The judgment uses the export name written in the import statement and does not read inside the file it came from
- A rest parameter list written with a generic spelling. Only a bracketed list is read, so the same meaning written with a generic type name is not reported
- A creation moved into a helper in another file. Binding resolution stays inside one file

## Fix

Write the dependency's call signature straight into the type argument. To mock the binding resolution this repository publishes from `src/lint/oxlint/lib/resolved-bindings.ts`, copy that declaration's arguments and return as they stand.

```ts
const resolveBinding = vi.fn<(scope: Scope | null, name: string) => Variable | null>();
```

Written this way, a test using the mock falls at the type check the moment the real declaration takes one more argument or changes its return.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a creation without a type parameter is reported
const send = vi.fn();
```

```ts
// a type parameter naming the catch all callable type pins nothing
const send = vi.fn<Function>();
```

Code this rule accepts.

```ts
// a creation carrying the call signature of the dependency is typed
const send = vi.fn<(recipient: string) => Promise<void>>();
```

```ts
// spying on an existing function derives the signature from the real member
const send = vi.spyOn(mailer, 'send');
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- **Skipping the type argument and annotating the variable that receives the mock instead.** What is checked is the creation call itself; an annotation does not clear the report
- **Writing a catch-all type as the type argument to meet the form.** The contents are read, so it falls
- **Turning this rule off wholesale on the grounds of the upstream rule's misreports.** Avoiding those misreports is already handled by turning the upstream off
- **A suppression directive**

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `untypedMockCreation` | A mock function must not be created without a type parameter naming the call signature it stands in for. Write the call signature of the real dependency as the type parameter of the creation call. |
| `unconstrainedMockTypeParameter` | The type parameter of a mock function creation must not leave the call signature open. Replace \`{{written}}\` with the call signature of the real dependency: name the type of every parameter and the type of the returned value. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
