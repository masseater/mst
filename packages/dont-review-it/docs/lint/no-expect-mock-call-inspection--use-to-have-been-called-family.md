---
description: "Disallow reading the call record of a mock as a value, in the subject of an assertion or in what a fixture hands back, so a claim about how a function was called is stated by the matcher that names it"
---

# no-expect-mock-call-inspection--use-to-have-been-called-family

<!-- BEGIN GENERATED rule-header -->

Disallow reading the call record of a mock as a value, in the subject of an assertion or in what a fixture hands back, so a claim about how a function was called is stated by the matcher that names it

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: yes
- Shipped in the preset: yes
- Source: [`no-expect-mock-call-inspection--use-to-have-been-called-family.ts`](../../src/lint/oxlint/rules/no-expect-mock-call-inspection--use-to-have-been-called-family.ts)

<!-- END GENERATED rule-header -->

## Violation

A mock's call record standing as a value in either of two places inside a spec file: the receiver of an assertion, and the subject a fixture returns. A call record is a property directly under the mock namespace `mock` whose name is one of `callRecordMembers`, which defaults to `calls`, `contexts`, `instances`, `invocationCallOrder` and `lastCall`.

No set of matchers is held; only the receiver is read, so the `toHaveBeenCalled` family falls out structurally. Derived forms stay records however many steps ride on top, and identifiers are followed to their origin through intermediate bindings, destructurings, reassignments and a parameter whose call site resolves inside the file. The record's "what it returned" properties are outside this rule.

## Fix

Hand the mock binding itself to `expect` and put the claim in the matcher that names it: `toHaveBeenCalledWith` for the arguments, `toHaveBeenCalledTimes` for the count, `toHaveBeenCalled` for the call, and the same names behind `not` for its absence.

On the fixture side, return the mock binding rather than a record.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// the recorded calls compared as a value
// in send-mail.test.ts
const sendMail = vi.fn();
test("records the send", () => {
  expect(sendMail.mock.calls).toStrictEqual([["a@example.com"]]);
});
```

```ts
// a fixture handing the record back as its subject
// in send-mail.test.ts
const sendMail = vi.fn();
const test = baseTest.extend("sent", () => sendMail.mock.calls);
```

Code this rule accepts.

```ts
// the arguments a mock was called with, claimed by the matcher that names them
// in send-mail.test.ts
test("addresses the recipient", ({ sendMail }) => {
  expect(sendMail).toHaveBeenCalledWith("a@example.com");
});
```

```ts
// a fixture handing the mock binding itself back is the shape this rule asks for
// in send-mail.test.ts
const sendMail = vi.fn();
const test = baseTest.extend("sendMail", () => sendMail);
test("addresses the recipient", ({ sendMail }) => {
  expect(sendMail).toHaveBeenCalledWith("a@example.com");
});
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Binding the record, destructuring it, or forwarding it through several names. Each is followed back to the record
- Moving onto another matcher. No set of matchers is held
- Wrapping the record in an object or an array on the fixture side. This rule does not report it, and another rule takes the reassembled subject

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `inspectedCallRecord` | The call record of a mock must not be the subject of an assertion. Pass the mock itself to \`expect\` and put the claim in the matcher that names it: \`toHaveBeenCalledWith\` or \`toHaveBeenCalledExactlyOnceWith\` for the arguments, \`toHaveBeenCalledTimes\` or \`toHaveBeenCalledOnce\` for the count, \`toHaveBeenCalled\` for the call itself, and the same names behind \`not\` for the absence of a call. \`{{matcher}}\` is receiving that record. Names bound to the record, destructurings, parameters, reassignments and other matchers carrying the same comparison are forbidden detours; each is followed back to the record. |
| `fixtureYieldsCallRecord` | A fixture must not hand back the call record of a mock. Return the mock binding itself and leave the claim to \`toHaveBeenCalledWith\`, \`toHaveBeenCalledTimes\` or \`toHaveBeenCalled\` in the assertion. The fixture \`{{fixture}}\` is handing that record back. Names bound in the factory, destructurings, parameters and reassignments between the mock and the value handed back are forbidden detours; each is followed back to the record. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
