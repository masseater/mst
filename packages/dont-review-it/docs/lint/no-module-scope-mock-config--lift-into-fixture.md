---
description: "Disallow creating a mock or settling what it does anywhere but a module replacement factory and the body of a fixture, so the instance a test reads was stood up and settled for that test alone"
---

# no-module-scope-mock-config--lift-into-fixture

<!-- BEGIN GENERATED rule-header -->

Disallow creating a mock or settling what it does anywhere but a module replacement factory and the body of a fixture, so the instance a test reads was stood up and settled for that test alone

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: yes
- Shipped in the preset: yes
- Source: [`no-module-scope-mock-config--lift-into-fixture.ts`](../../src/lint/oxlint/rules/no-module-scope-mock-config--lift-into-fixture.ts)

<!-- END GENERATED rule-header -->

## Violation

A call that stands a mock up, or a call that settles what a mock does, written outside the two permitted areas inside a test declaration file.

There are only two permitted areas.

1. Inside a factory handed to a module replacement declaration (by default `vi.mock` / `vi.doMock`)
2. Inside the body of a fixture function

The judgment runs on AST containment rather than on how scope looks. So the module's top level, a `describe` body, the inside of a hoisted container (`vi.hoisted`) and an `it` body are none of them permitted areas.

### The three families in scope

| Family | What is read |
| --- | --- |
| Calls that stand a mock up | `fn` / `mocked` / `spyOn` on the mock namespace. The namespace is identified by following bindings |
| Calls that settle behaviour | Calls to behaviour-setting method names. The receiver is not read; the method name settles it |
| Calls through a subscript | A call through a subscript whose name cannot be read statically, where the receiver reaches a mock or the namespace |

The method names treated as behaviour-setting are taken from the public API of vitest 4's `MockInstance`: `mockImplementation`, `mockImplementationOnce`, `withImplementation`, `mockReturnThis`, `mockReturnValue`, `mockReturnValueOnce`, `mockResolvedValue`, `mockResolvedValueOnce`, `mockRejectedValue`, `mockRejectedValueOnce`, `mockThrow`, `mockThrowOnce` — twelve in all.

### How the namespace and the receiver are read

- **The namespace.** Beyond a plain identifier spelling match, bindings are followed to their declaration inside the same file, and a declaration landing on the namespace counts as a match. An import taken under another name (`import { vi as runner }`), a re-binding into a variable (`const runner = vi`), and access through a whole-module import (`runner.vi` from `import * as runner`) all give the same judgment. A globally injected setup and an explicit-import setup read the same
- **Method names.** Besides property names, a string-literal subscript and a template-literal subscript with no substitution are read as names. `vi['fn']()` is treated as `vi.fn()`, and a template-literal subscript the same
- **The receiver.** Wrapping in a type assertion, `satisfies`, a non-null assertion, an optional chain or `await` is peeled before the judgment
- **Chains.** Settling right after standing up (`vi.fn().mockReturnValue(1)`) is reported once, at the outer call. The inner creation call is not reported twice. A form with a property in between (`vi.mocked(mailer).send.mockResolvedValue(1)`) is likewise one report

### Identifying the fixture area

The method name `extend` alone does not make a permitted area. The receiver's chain is followed to its root, and only where that root is a test block binding (`test` / `it`, their aliased imports, or bindings derived from them through `extend`) does it count as a fixture call. The inside of an argument to an unrelated API carrying a method of the same name is not a permitted area.

What is permitted is only the body of the fixture function itself. The inside of an options object handed to `extend` does not land in the permitted area.

The range is limited to test declaration files: by default, files ending in `.test.ts` or `.test.tsx`.

### Deliberately not widened

| Shape | Why it is left out |
| --- | --- |
| Teardown such as `sendMail.mockClear()` or `vi.clearAllMocks()` | [no-redundant-mock-reset--lift-mocks-into-fixture](./no-redundant-mock-reset--lift-mocks-into-fixture.md) takes it. That one enforces not writing it at all rather than where it is written |
| A computed subscript whose receiver reaches neither a mock nor the namespace | Neither the name nor the target can be identified. This keeps subscript access on unrelated objects from being swept in |
| A method call on a private identifier | The same name is a different thing |
| The inside of a module replacement declaration's factory | Always permitted by this rule. Whether behaviour may be written in that factory is judged by [no-vi-mock-factory-behavior--use-spy-true-and-fixture](./no-vi-mock-factory-behavior--use-spy-true-and-fixture.md) |
| Taking a reference without calling it (`const build = vi.fn;`) | Calls are what is read. Where the extracted reference is called is judged at that call |

One consequence of settling behaviour-setting by name alone is that a non-mock object carrying a method of the same name is reported. That over-detection is intended: what matters more is that the judgment holds without type information as long as the name is readable. Something standing in for type information is used only in the subscript family, and there the opposite applies — only what reaches a mock or the namespace is reported, avoiding false positives.

### The invariant

The mock a test reads was stood up for that test and configured for that test.

The first layer is sharing. A mock stood up at module scope is one instance every test in the file touches. A return value one test settled stays for the next, and the call record accumulates. Tests are written assuming they run in parallel both per file and per `it` inside one file, so what "the next test" is changes from run to run. The failure appears in a form that does not reproduce, and reading the failing test's own text does not give the cause.

The second layer is how reproducibility is built. Placed inside a fixture, the test receives the mock with the configuration it asked for already applied. A fixture is re-evaluated for each test, so the configuration is re-applied per test. Together with the shared configuration clearing call records before each test, the state stops depending on execution order.

The third layer is that a spec reads on its own. Where learning what a mock returns means going back to the head of the file, a spec cannot be read as a specification. Forbidding configuration in an `it` body is the same reason inverted: let preparation into an `it` and what that test verifies is buried among lines that are not assertions.

### Configuration

| Name | Default | Meaning |
| --- | --- | --- |
| `mockNamespaceSpellings` | `["vi"]` | The spellings identified as the mock namespace |
| `mockCreationMembers` | `["fn", "mocked", "spyOn"]` | The namespace members that stand a mock up |
| `mockBehaviorMembers` | The twelve taken from vitest 4's `MockInstance` (above) | The method names that settle behaviour |
| `moduleReplacementMembers` | `["mock", "doMock"]` | The namespace members whose factory interior becomes a permitted area |
| `specFileSuffixes` | `[".test.ts", ".test.tsx"]` | The suffixes taken as test declaration files |

Each replaces its default wholesale. Handing over an empty array leaves the default in place. Teardown method names are not in the default of `mockBehaviorMembers`; including them would change what this rule is responsible for and produce duplicate reports with `no-redundant-mock-reset--lift-mocks-into-fixture`.

## Fix

Move the calls that stand a mock up and settle its behaviour into a fixture body, and have that fixture return the mock's binding. The test receives it as a parameter and writes assertions alone.

```ts
const test = baseTest.extend("report", () => {
  const summarise = vi.fn();
  summarise.mockReturnValue({ id: "a", total: 2 });
  return summarise;
});
```

Keep a module replacement declaration to declaring structure, and settle per-test results inside the fixture. What may be written in a replacement declaration's factory is judged separately by `no-vi-mock-factory-behavior--use-spy-true-and-fixture`.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a mock built at module scope is one instance every test in the file shares
// in mailer.test.ts
const sendMail = vi.fn();
```

```ts
// a setting written in the body of a test block buries what the test verifies
// in mailer.test.ts
it('accepts the address', () => {
  sendMail.mockReturnValue(1);
  expect(sendMail).toHaveBeenCalled();
});
```

Code this rule accepts.

```ts
// a mock built inside the fixture that hands it back is the shape this rule keeps
// in mailer.test.ts
const it = test.extend('sendMail', () => vi.fn());
```

```ts
// what the mock does, settled inside the fixture body, is applied for each test on its own
// in mailer.test.ts
const it = test.extend('sendMail', () => {
  const sendMail = vi.fn();
  sendMail.mockResolvedValue({ accepted: 1 });
  return sendMail;
});
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- **Putting the instance in a hoisted container and only touching it from the fixture.** That the instance is shared does not change. A hoisted container is not a permitted area, so a creation call written there is reported. Putting a non-mock instance at module scope and rewriting it from tests is reported by [no-module-scope-mutable-state--lift-into-fixture](./no-module-scope-mutable-state--lift-into-fixture.md)
- **Avoiding detection with subscript access.** String-literal and substitution-free template-literal subscripts are read as names. A subscript whose name cannot be read is reported too where the receiver reaches a mock or the namespace
- **Importing the namespace under another name, or re-binding it into a variable.** Bindings are followed to their declaration, so it falls
- **Loosening the type before placing it as the receiver.** Type assertions, `satisfies` and non-null assertions are peeled before the judgment
- **Moving the configuration down into an `it` body.** That only moves the placement problem into another forbidden area, and it is reported as the same violation
- **Writing it in the argument of another API carrying a method named `extend`.** The receiver's chain is followed to its root, so what does not reach a test block binding is not a permitted area
- **Writing it in the options object handed to `extend`.** What is permitted is the fixture function's body alone
- **A suppression directive.** [no-rule-suppression--fix-the-violation](./no-rule-suppression--fix-the-violation.md) reports it

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `mockCreationOutsideFixture` | A mock must not be stood up outside a fixture. Move \`{{member}}\` into the body of the fixture the test takes its subject from, return the mock binding from there, and let the test block receive it as a parameter. Only the factory of a module replacement declaration and the body of a fixture function may hold this call. Parking the instance in a hoisted container, importing the mock namespace under another name, reaching the member through a subscript, and dropping the call into the body of the test block are each reported the same way. |
| `mockBehaviorOutsideFixture` | What a mock does must not be settled outside a fixture. Move \`{{member}}\` into the body of the fixture that returns the mock, leaving every test to run with the setting applied for it alone. Only the factory of a module replacement declaration and the body of a fixture function may hold this call. Moving the call into the body of the test block, behind a renamed binding, and behind a subscript are each reported the same way, and clearing or restoring the mock afterwards is not the answer either: the shared runner configuration owns that. |
| `subscriptedMockWriting` | A method reached on a mock through a subscript that only settles at run time must not be called outside a fixture. Write the member out by name and move the call into the body of the fixture that returns the mock. Only the factory of a module replacement declaration and the body of a fixture function may hold this call. A subscript spelled out in full is read as the member it names, so moving that spelling into a binding changes nothing. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
