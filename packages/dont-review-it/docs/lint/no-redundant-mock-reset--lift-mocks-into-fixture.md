---
description: "Disallow clearing, resetting, restoring or releasing mock state by hand, so the state a test starts from is decided by one shared runner configuration instead of by cleanup calls spread across the specs"
---

# no-redundant-mock-reset--lift-mocks-into-fixture

<!-- BEGIN GENERATED rule-header -->

Disallow clearing, resetting, restoring or releasing mock state by hand, so the state a test starts from is decided by one shared runner configuration instead of by cleanup calls spread across the specs

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: yes
- Shipped in the preset: yes
- Source: [`no-redundant-mock-reset--lift-mocks-into-fixture.ts`](../../src/lint/oxlint/rules/no-redundant-mock-reset--lift-mocks-into-fixture.ts)

<!-- END GENERATED rule-header -->

## Violation

Text returning a mock's state to what it was before the test. The judgment runs on the name of the method called, in four families.

1. **Teardown of one mock.** Clearing the call record, resetting the implementation, restoring the original. By default `mockClear` / `mockReset` / `mockRestore`. The receiver is not read
2. **Bulk teardown of mocks.** Clearing, resetting or restoring every mock, on the mock namespace. By default `clearAllMocks` / `resetAllMocks` / `restoreAllMocks`
3. **Bulk release of stubs.** Restoring globals and environment variables in bulk, on the mock namespace. By default `unstubAllEnvs` / `unstubAllGlobals`
4. **Taking a teardown method as a value.** Writing the reference without calling it: binding it to a variable, storing it in an array or an object, handing it over as an argument, taking it out by destructuring

Where it is written makes no difference. At the module's top level, in a fixture body, in an `it` body, inside a setup hook — all the same violation. Making no place where it is allowed is this rule's point, and for that reason whether the file is a test declaration file is not read either. The range is settled by the detector's configuration.

### How the namespace and method names are read

Only the bulk families (2 and 3) read the receiver. The receiver's binding is followed inside the same file, and the report stands only where it lands on the mock namespace.

- A plain identifier spelled `vi`
- An import taken under another name (`import { vi as runner } from "vitest"`, `import { "vi" as runner } from "vitest"`)
- A binding the namespace was put into (`const runner = vi`, `let runner; runner = vi`)

Method names are read from property names, and from string-literal and substitution-free template-literal subscripts. The receiver is read with type assertions, parentheses, non-null assertions and optional chains peeled off.

### A computed subscript

A subscript whose name cannot be read is reported only where the receiver reaches the mock namespace or a mock. The runtime holds no type information, so "is a mock" is settled by following bindings. Namespace following is as above, and a mock is settled by whether it reaches a call to the namespace's creation APIs (`fn` / `mocked` / `spyOn`).

That condition exists so that no state is left where replacing a subscript with a variable escapes families 1 to 3, and what the message asks for is "write the member name out".

### Deliberately not widened

| Shape | Why it is left out |
| --- | --- |
| `vi.stubEnv(...)` / `vi.stubGlobal(...)` | The replacement itself. What is forbidden is the release, not the replacement. Put the replacement in the fixture that needs it |
| `sendMail.mockReturnValue(...)` | Settling a mock's behaviour. Another rule reads where that is written; this one reads teardown alone |
| `typeof sendMail.mockClear` | It does not run. A member of the same name written in a type annotation is a different syntax and does not appear either |
| `super.mockClear()` / `this.#mockClear()` | A member through a parent class and a private member. The same spelling is a different thing |
| `recorder.clearAllMocks()` where `recorder` reaches no namespace | The bulk families follow the receiver to the namespace. An unrelated object that happens to carry a member of the same name falls out |
| `recorder[named]()` where `recorder` reaches neither the namespace nor a mock | Neither the subscript's value nor the target can be identified |
| A subscript on a mock received as a fixture parameter | The caller is settled at run time, so being a mock cannot be settled statically |
| `runner.vi` through `import * as runner from "vitest"` | The namespace is identified by following identifier bindings alone. Namespace imports are not followed |
| A binding through a declaration in another file | The tracking is limited to what closes inside one file |

The per-mock families (1, and the per-mock side of 4) read no receiver at all. A non-mock object carrying a member of the same spelling is reported. That over-detection is intended: what matters more is that the judgment holds without type information as long as the name is readable.

### The shared configuration it presumes

This rule holds only together with the test runner's shared configuration taking over the teardown. In vitest that is four settings.

| Setting | What happens before each test |
| --- | --- |
| `clearMocks` | Every mock's call record is cleared |
| `restoreMocks` | The original implementation a spy replaced is restored |
| `unstubGlobals` | Globals replaced through `vi.stubGlobal` are put back |
| `unstubEnvs` | Environment variables replaced through `vi.stubEnv` are put back |

Put the four in first, confirm they are in effect, and only then enable this rule. Reverse the order and every spec whose teardown was deleted breaks at once. Matching the set of files this rule applies to with the set of files those settings hold for is the configuration side's job; the rule does not narrow its own range.

### The invariant

Teardown of mock state between tests is done in one place, by the shared test configuration.

The first layer is that hand-written teardown duplicates those settings. Duplication alone does little harm. The problem is where it feels *not* duplicated: a test that breaks when the teardown is deleted shows that mock state shared beyond the test boundary exists. The teardown call is a symptom rather than the cause, and what needs fixing is where the mock is placed.

The second layer is parallel execution. Tests are written assuming they run in parallel both per file and per `it` inside one file. Which teardown runs before and after which test depends on execution order, so on a premise where the order is not stable, independence grounded in hand-written teardown does not hold. Only the shared configuration's uniform guarantee — "before every test, always" — is independent of order.

The third layer is that admitting even one place where teardown may be written turns the discipline into an argument about places. The moment "the end of a fixture is fine" or "a setup hook is fine" is settled, a mock placed at module scope survives on those grounds. Reading no place at all fixes the fix to one thing: delete it.

### Configuration

| Name | Default | Meaning |
| --- | --- | --- |
| `mockNamespace` | `"vi"` | The identifier spelling read as the mock namespace |
| `perMockResetMembers` | `["mockClear", "mockReset", "mockRestore"]` | The member names taken as teardown of one mock |
| `bulkResetMembers` | `["clearAllMocks", "resetAllMocks", "restoreAllMocks"]` | The member names taken as bulk mock teardown |
| `bulkStubReleaseMembers` | `["unstubAllEnvs", "unstubAllGlobals"]` | The member names taken as bulk stub release |

Each member-name set replaces its default wholesale. Handing over an empty array leaves the default in place. The contents are derived from the test runner's public API; change runners and all four are revisited.

## Fix

Delete it first. If the tests pass with it gone, that is the proof it was duplication.

Where deleting makes them fail, rework the mock placed at module scope into a fixture returning the binding. A fixture is re-evaluated for each test so the configuration is applied each time, and the shared configuration clears each time, so no teardown is needed.

```ts
const test = baseTest.extend("sendMail", () => {
  const sendMail = vi.fn();
  sendMail.mockReturnValue("id");
  return sendMail;
});

test("addresses the recipient", ({ sendMail }) => {
  expect(sendMail).toHaveBeenCalledWith("a@example.com");
});
```

Restoring a real object's replaced method is the shared configuration's job too, so the restore call at the end of a fixture is deleted. Put a global or environment variable replacement inside the fixture that needs it, and do not write the release.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// the call record of one mock cleared by hand
// in send-mail.test.ts
const sendMail = vi.fn();
sendMail.mockClear();
```

```ts
// every mock cleared at once by hand
// in send-mail.test.ts
vi.clearAllMocks();
```

Code this rule accepts.

```ts
// a fixture handing a mock binding to the test carries no cleanup of its own
// in send-mail.test.ts
const test = baseTest.extend("sendMail", () => vi.fn());
test("addresses the recipient", ({ sendMail }) => {
  expect(sendMail).toHaveBeenCalledWith("a@example.com");
});
```

```ts
// putting a global in place is not the release of one
// in send-mail.test.ts
const test = baseTest.extend("clock", () => {
  vi.stubGlobal("Date", frozenClock);
  return frozenClock;
});
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- **Binding the method to another name and calling that.** The extraction itself is reported by family 4
- **Taking the method out by destructuring.** In a declaration or an assignment, the pattern's key is read, so it falls
- **Stuffing the reference into an array or an object and calling it elsewhere.** The calling side is not followed; the report stands where it was taken out
- **Loosening the type before calling.** A type assertion on the receiver is peeled before the judgment
- **Calling through a subscript.** String-literal and template-literal subscripts are read as names, and a subscript whose name cannot be read is reported where the receiver reaches the namespace or a mock
- **Importing the namespace under another name.** Bindings are followed, so it falls
- **Moving the teardown into a helper in another file.** The tracking closes inside one file so the report clears, and state still remains beyond the test boundary. Do not write it
- **A suppression directive**

Nothing other than deleting is accepted.

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `perMockReset` | Clearing, resetting or restoring a mock by hand is forbidden. Delete this \`{{member}}\` call and move the mock into a fixture that hands its binding to the test. |
| `bulkMockReset` | Clearing, resetting or restoring every mock by hand is forbidden. Delete this \`{{member}}\` call and move each mock into a fixture that hands its binding to the test. |
| `bulkStubRelease` | Releasing stubbed globals or environment variables by hand is forbidden. Delete this \`{{member}}\` call and move each stub into the fixture that needs it. |
| `resetTakenAsValue` | Taking \`{{member}}\` as a value is forbidden. Delete the reference and move the mock into a fixture that hands its binding to the test. |
| `computedMockMember` | Reaching a member of a mock or of the mock namespace through a computed key is forbidden. Write the member name out at this call site. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
