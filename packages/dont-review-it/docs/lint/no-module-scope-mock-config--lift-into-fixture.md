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

Standing up a mock, or settling what it does, anywhere but two places: the factory of a module replacement declaration, and the body of a fixture function.

Three reports. Creating a mock through a creation member on the runner namespace, settling behaviour through a behaviour member on a value that reaches a mock, and calling a member reached through a subscript that only settles at run time. Where several such calls are chained, only the outermost is reported.

The namespace is followed through imports, aliases and `const` bindings, and a string-literal subscript is read as the member it names. `mockNamespaceSpellings`, `mockCreationMembers`, `mockBehaviorMembers`, `moduleReplacementMembers` and `specFileSuffixes` settle the vocabulary.

## Fix

Move the call into the body of the fixture the test takes its subject from, return the mock binding from there, and let the test block receive it as a parameter.

Do not clear or restore the mock afterwards; the shared runner configuration owns that.

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

- Parking the instance in a hoisted container, or importing the namespace under another name. Both are followed
- Reaching the member through a subscript. A spelled-out subscript is read as the member, and one that settles at run time is reported on its own
- Dropping the call into the body of the test block. Only a replacement factory and a fixture body may hold it

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
