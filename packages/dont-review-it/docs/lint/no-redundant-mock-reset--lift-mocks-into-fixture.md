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

Clearing, resetting, restoring or releasing mock state by hand. Five reports: a per-mock member (`mockClear`, `mockReset`, `mockRestore`) called on a value that reaches a mock; a bulk member (`clearAllMocks`, `resetAllMocks`, `restoreAllMocks`) and a bulk stub release (`unstubAllEnvs`, `unstubAllGlobals`) called on the mock namespace; one of those members taken as a value rather than called; and a member of a mock or of the namespace reached through a computed key.

The namespace and the mock are followed through imports and bindings. `mockNamespace`, `perMockResetMembers`, `bulkResetMembers` and `bulkStubReleaseMembers` settle the vocabulary.

## Fix

Delete the call and move the mock into a fixture that hands its binding to the test. What state a test starts from is settled once, by the shared runner configuration.

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

- Taking the member as a value and calling it elsewhere. The reference itself is reported
- Reaching it through a computed key. That shape is reported on its own
- Renaming the namespace on import. The binding is followed

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
