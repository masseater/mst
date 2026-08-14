---
description: "Disallow a module replacement declaration from carrying a factory, so what a replaced module hands back is declared by the fixture of the test that reads it instead of being fixed once for every test in the file"
---

# no-vi-mock-factory-behavior--use-spy-true-and-fixture

<!-- BEGIN GENERATED rule-header -->

Disallow a module replacement declaration from carrying a factory, so what a replaced module hands back is declared by the fixture of the test that reads it instead of being fixed once for every test in the file

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: yes
- Shipped in the preset: yes
- Source: [`no-vi-mock-factory-behavior--use-spy-true-and-fixture.ts`](../../src/lint/oxlint/rules/no-vi-mock-factory-behavior--use-spy-true-and-fixture.ts)

<!-- END GENERATED rule-header -->

## Violation

A module replacement declaration — a `mock` call on the mock namespace — handed a factory (an arrow function or a function expression) as its second argument.

Two independent conditions decide it. Both report on the factory itself, and the messages are separate. Condition 1 asks about the shape, "may a factory be written here at all". Condition 2 asks about the contents, "what may be written in the body". Only condition 1 carries exemptions.

### Condition 1: a violation of the shape (`factoryShape`)

A factory meeting all of these is reported.

- The second argument is a function
- That factory returns something other than an empty object alone. A body carrying no `return`, a `return` handing back no value, and a body of side effects alone all count
- The first argument's specifier does not, as a statically readable string, begin with a builtin module prefix (`node:` by default)
- The run of comments immediately above the declaration carries no exemption comment with grounds

### Condition 2: a violation of the contents (`factoryBehaviour`)

A factory whose body holds any of these is reported. There is not one exemption. A declaration naming a builtin module, a declaration carrying an exemption comment, and a declaration returning an empty object alone are all reported.

- A call to a behaviour-settling method. Ten of them — `mockReturnValue`, `mockReturnValueOnce`, `mockResolvedValue`, `mockResolvedValueOnce`, `mockRejectedValue`, `mockRejectedValueOnce`, `mockImplementation`, `mockImplementationOnce`, `withImplementation` and `mockReturnThis` — taken from the mock API of the test runner in use. The receiver is not read; the method name alone settles it
- An argument handed to a mock creation call (`fn` on the namespace). A creation carrying no argument only builds a container, so it stays out of range
- A call to a binding imported from outside the spec, or an expression handing that binding straight back

Condition 2 does not read the return value. A body that finishes creating and settling before returning an empty object would, under a judgment reading the return value alone, fall into condition 1's exemption and into the permitted region of the placement rule — a route neither rule looks at.

"Not one exemption" means condition 1's exemptions (the builtin module prefix and the exemption comment) do not carry over to condition 2. The limits of identification itself apply to condition 2 just the same. A call written in the factory body through a computed subscript (`double[chosen](1)`) leaves the method name unreadable, so condition 2 does not report it either. Catching a name settled at run time here would require resolving types, and this rule uses no type information. The route of hiding the replacement declaration itself behind a subscript is closed, though, and a string literal subscript is read as a name.

However many behaviours stand in one factory, `factoryBehaviour` reports once. The two conditions are independent, so both may stand on the same factory.

### The exemption comment

An exemption is confined to a line-local comment. It goes in the run of comments immediately above the declaration, opens with the token `mock-factory-exemption`, names this rule, and writes concrete grounds after `--`.

```ts
// mock-factory-exemption no-vi-mock-factory-behavior--use-spy-true-and-fixture -- this unit test replaces the child module boundary on purpose
vi.mock("./child.ts", () => ({ read: vi.fn() }));
```

The separator is a `--` with whitespace on both sides. The rule name itself holds a `--`, so cutting at the first one would misread the grounds. A comment with empty grounds stands as no exemption: the comment itself is reported as `unreasonedExemption` and condition 1 is reported alongside it. Other line-local directives may be stacked in the same comment run.

What an exemption lifts is condition 1 alone. Behaviour written in the body of an exempted declaration is reported by condition 2.

### Deliberately not widened

| Shape | Why it is left out |
| --- | --- |
| A declaration carrying no second argument | It declares structure alone, which is the right shape |
| A second argument that is an options object | Handing over `{ spy: true }`, the recommended shape, falls here |
| A factory returning an empty object alone | It settles no behaviour at load time. Neither condition reports it |
| A factory that only builds containers and returns them | Condition 1 reports it; condition 2 does not |
| A call through a computed subscript | The name cannot be identified. A string literal subscript is read as a name and stays in range |
| A replacement call that is not hoisted | A spelling other than `mock` runs a route evaluated per test, which the placement rule owns |
| A declaration whose second argument is an identifier that is no function | Condition 1 requires the second argument to be a function. Receiving a factory from another module is not judged |
| A computed subscript in a factory body | The method name cannot be read. It sits outside what can be caught without type information |
| A replacement of the file system module | The recommended shape runs the other way. [no-local-file-system-mock--use-shared-fs](./no-local-file-system-mock--use-shared-fs.md) forbids the replacement itself |

There is no narrowing by file kind. Which files this rule holds for is settled by the shared lint configuration's glob.

The namespace is identified by the shared definition (`src/lint/oxlint/lib/spec-syntax/mock-namespace.ts`). Besides a bare identifier spelling that matches, a binding is followed to its declaration inside the same file, and a declaration landing on the mock namespace counts as a match. An aliased import, a reference taken into a variable first, and a reference through a namespace import are all handled the same way.

The first item of condition 2 does not read the receiver, so an object that is no mock but carries a method of the same name is reported. That is deliberate over-detection, chosen so the judgment holds without type information wherever a name is readable. For the same reason, calling the creation entry point imported directly instead of through the namespace is reported as a call to an outside binding. Creation is written through the namespace.

### The invariant

What is held is that a replacement declaration written at module scope carries the declaration of structure alone — which module is replaced. What the replacement hands back is declared inside the fixture that test receives.

A factory handed to a replacement declaration is evaluated once, when the file is loaded. The implementation written there becomes one instance implicitly shared by every test in that file. To learn what a given test's mock actually returns, a reader has to go back to the top of the file, away from where the test is written. Under the assumption that tests run in parallel by file and by `it`, a shared setting changes its result according to which test runs next. Failures appear in a form that does not reproduce.

Keep it to a declaration of structure and hand over the wrapping option, and the original module is loaded while each export becomes a spy. The per-test result can be declared inside the fixture, and the declaration sits next to the test using it.

Exemptions are confined to condition 1 because the inside of an exempted region is a blank in the discipline. Even for a module that cannot take the wrapping shape, the factory is still evaluated once at load time. "It cannot be wrapped" is grounds for exempting the shape; it is no grounds for allowing shared behaviour.

Building a container carrying no behaviour in the body, on the other hand, does not contradict the invariant. The container is built once at load time, but the shared setting clears call records and implementations before each test, so it holds no state carried between tests. This rule stands together with that shared setting being in place.

### Configuration

| Name | Default | What it settles |
| --- | --- | --- |
| `builtinModulePrefixes` | `["node:"]` | The module specifier prefixes falling into condition 1's exemption |

`builtinModulePrefixes` replaces rather than adds. Handed an empty array, the default stays.

The exemption holds only where the prefix is statically readable. A builtin module written without its prefix, and a specifier assembled at run time, are both reported by condition 1. Widening the exemption side loosens the discipline, so it is not levelled up to. A legitimate case passes through the exemption comment.

The vocabulary of behaviour-settling methods, the spelling of the creation call, the spelling of the replacement declaration and the spelling of the namespace are not movable by configuration. They are vocabulary shared with the other rules of this group, and splitting them in configuration leaves one side losing sight of its subject and going quiet.

## Fix

Keep the declaration to structure and hand over the wrapping option.

```ts
vi.mock("./reader.ts", { spy: true });
```

Declare the per-test result inside the fixture that test receives, in a "this once" form. Where the test verifies a call, the fixture hands back the result of taking the mock, and the test receives it as a parameter.

Even for a declaration falling into the shape exemption, such as a shim for a builtin module, what may be written in the body is containers alone. Containers are built in the body, and behaviour is settled by the fixture.

```ts
vi.mock("node:fs", () => ({ readFileSync: vi.fn() }));
```

There is no automatic fix. Deleting the factory requires deciding where the behaviour written there is to go, and only the writer can settle whether it was a container-only factory or behaviour that belongs in a fixture.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a factory that returns a container is reported
vi.mock("./module.ts", () => ({ read: vi.fn() }));
```

```ts
// settling what a mock hands back is reported beside the shape
vi.mock("./module.ts", () => ({ read: vi.fn().mockReturnValue(1) }));
```

Code this rule accepts.

```ts
// handing the wrapping option over passes
vi.mock("./module.ts", { spy: true });
```

```ts
// a factory that returns an empty object passes
vi.mock("./module.ts", () => ({}));
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Turning the rule off in the detector's configuration, or turning it off for a file. Exemptions stay line-local. [no-rule-suppression--fix-the-violation](./no-rule-suppression--fix-the-violation.md) reports that
- Placing an exemption comment without writing grounds. It stands as no exemption, and the comment itself is reported
- Writing per-test behaviour in the factory body under an exemption comment. What an exemption lifts is condition 1 alone
- Pushing the factory's contents into another module to take them out of sight. A body calling a binding imported from outside the spec, or handing it straight back, is reported by condition 2
- Finishing the creating and settling in the body before returning an empty object. Condition 2 does not read the return value
- Changing the spelling to hide the declaration — aliasing the namespace, taking it into a variable, writing it as a string literal subscript. The shared identification follows bindings

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `factoryShape` | A module replacement declaration must not hand over a factory. Pass \`{ spy: true }\` as the second argument and let the replaced module answer, so the replacement records how it was called and settles nothing. |
| `factoryBehaviour` | The body of a module replacement factory must not settle what a mock hands back. Delete every return value, resolved value, rejected value and implementation written here, and leave the replacement a pass-through that only records how it was called. |
| `unreasonedExemption` | An exemption comment must not stand without grounds. Write the grounds for this exemption after \`--\`, and name there the boundary this spec replaces by hand. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
