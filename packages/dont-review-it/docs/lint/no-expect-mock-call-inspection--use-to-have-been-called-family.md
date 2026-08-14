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

A mock's call record appearing as a value in one of two places inside a test declaration file.

1. **The receiver of an assertion.** The receiver of `expect(receiver).<matcher>(...)` reaching a call record
2. **The subject a fixture returns.** The expression a fixture returns reaching a call record

A call record is a "how it was called" property directly under the mock namespace property `mock`. The default set is five: `calls`, `contexts`, `instances`, `invocationCallOrder`, `lastCall`.

No set of matchers is held. The judgment is only whether the receiver reaches a call record. The `toHaveBeenCalled*` family has the mock binding itself as its receiver, so it falls out structurally without needing a set.

### How the walk to a record runs

Where the two adjacent steps of `mock` and a property directly under it appear anywhere in an access chain, it counts as a record. Derived forms stay records however many steps ride on top.

- Index access (`sendMail.mock.calls[0][0]`)
- Length (`sendMail.mock.calls.length`)
- Mapping (`sendMail.mock.calls.map((call) => call[0])`)
- Wrapping in a type assertion, a non-null assertion, parentheses, an optional chain or `await`

Identifiers are followed to the origin of the binding. The conditions and depth of the walk are the same on the assertion side and the fixture side.

- Binding to an intermediate variable
- Extraction by destructuring (`const { calls } = sendMail.mock;`, `const [first] = sendMail.mock.calls;`)
- Extraction of the namespace itself (`const { mock } = sendMail;`)
- Multi-step forwarding (`const record = sendMail.mock; const sent = record.calls;`)
- A binding carrying a default (`const { calls = [] } = sendMail.mock;`, `(sent = []) => ...`)
- Reassignment. The right side of every assignment is read, and one reaching a record is a violation
- A function parameter. The caller's actual argument is followed where the call site resolves statically inside the same file

### Deliberately not widened

| Shape | Why it is left out |
| --- | --- |
| `sendMail.mock.results` / `sendMail.mock.settledResults` | A record of "what it returned". This rule's scope is limited to "how it was called" |
| `expect(sendMail).toHaveBeenCalledWith(...)` | The receiver is the mock binding itself and reaches no record |
| A record taken out purely for control flow | Only two places are read: the assertion's receiver and the subject a fixture returns. Taking it out is not itself a violation. Passing it between fixtures is the same |
| `expect({ calls: sendMail.mock.calls })` | A record wrapped in an object or an array. Only chains and bindings are followed; the walk does not descend inside a literal. That shape falls to another rule on the fixture side |
| A route whose caller settles only at run time | Passing through a function binding swapped by a condition, and a parameter from a caller settled at run time. The caller to follow does not settle statically |
| A rest parameter, spread arguments, a computed property name | The position where actual arguments and parameters are matched does not settle statically. `(...sent) => ...`, `observe(...args)` and `const { [named]: sent } = sendMail.mock;` land here |
| `expect(sendMail.mock)` | A comparison against the namespace itself. No record property appears, and telling it apart by spelling alone would sweep in unrelated `mock` properties |
| Forwarding through a declaration in another file | The runtime offers no cross-file resolution. The tracking is limited to what closes inside one file |

The range is limited to test declaration files: by default, files ending in `.test.ts` or `.test.tsx`.

### The invariant

An assertion claiming "how that function was called" makes that claim through the matcher's name.

The first layer is readability on failure. The `toHaveBeenCalled*` family produces failure messages in the words "how many times" and "with which arguments". Reduce the same check to an array comparison over the call record and the failure becomes a generic equality error over an anonymous array. The reader is left reconstructing what the test was verifying from the code.

The second layer is where the intent sits. Let a fixture return a record and what the fixture returns stops being "the output the subject under test produced" and becomes "an intermediate representation of an observation". The meaning of a fixture breaks, and the other rules that judge on the premise that a fixture returns the subject's output go down with it.

The third layer is how easy it is to evade. Forbid by a set of matchers and the same check continues by moving onto a matcher outside the set — one taking a property path, or a comparison against the namespace itself. Judging on the shape of the receiver alone means moving matchers does not take it off.

### Configuration

| Name | Default | Meaning |
| --- | --- | --- |
| `callRecordMembers` | `["calls", "contexts", "instances", "invocationCallOrder", "lastCall"]` | The set of property names taken as call records |
| `specFileSuffixes` | `[".test.ts", ".test.tsx"]` | The file name suffixes taken as test declaration files |

`callRecordMembers` replaces the default wholesale. Handing it an empty array leaves the default in place. The "what it returned" property names (`results`, `settledResults`) are not in the default; including them would change what this rule is responsible for.

## Fix

On the assertion side, hand the mock binding itself to `expect` and move the intent into the matcher.

- Claiming arguments: `toHaveBeenCalledWith` / `toHaveBeenCalledExactlyOnceWith` / `toHaveBeenLastCalledWith` / `toHaveBeenNthCalledWith`
- Claiming a count: `toHaveBeenCalledTimes` / `toHaveBeenCalledOnce`
- Claiming existence: `toHaveBeenCalled`
- Claiming absence: the same names behind `not`

On the fixture side, return the mock binding itself rather than a record.

```ts
const test = baseTest.extend("sendMail", () => sendMail);
test("addresses the recipient", ({ sendMail }) => {
  expect(sendMail).toHaveBeenCalledWith("a@example.com");
});
```

This fix assumes a shared runner configuration that clears call records before each test (vitest's `clearMocks`). Without clearing, calls accumulate across tests on a live mock and a count assertion breaks depending on execution order. Do not enable this rule alone without that configuration.

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

- **Binding the record to an intermediate variable.** The origin of the binding is followed, so it falls
- **Taking the record or the namespace out by destructuring.** The extracted property name is read, so it falls
- **Inserting multi-step forwarding.** No cap is placed on the number of steps, so it falls
- **Passing it once through a parameter or a reassigned binding.** The caller's actual arguments and the right side of every assignment are followed, so it falls
- **Moving onto another matcher to continue the same check.** No set of matchers is held, so it falls
- **Wrapping the record in an object or an array and returning it from a fixture.** This rule does not report it, which is not the same as allowing it. Reassembling a subject from another value on the fixture side falls to another rule
- **Comparing the namespace itself, as in `expect(sendMail.mock)`.** In a runtime with no type information this cannot be told apart from an unrelated `mock` property, so it is not reported — that is a limit of the detection, not permission. Do not write it as a comparison of call records
- **Moving the record read into a helper in another file.** The tracking closes inside one file so the report clears, but the subject is still a record
- **A suppression directive**

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
