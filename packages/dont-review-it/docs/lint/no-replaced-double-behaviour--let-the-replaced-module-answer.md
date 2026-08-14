---
description: "Disallow settling what a double taken from a replaced module hands back, so a replacement records how the code under test called out and never answers in place of the module it stands for"
---

# no-replaced-double-behaviour--let-the-replaced-module-answer

<!-- BEGIN GENERATED rule-header -->

Disallow settling what a double taken from a replaced module hands back, so a replacement records how the code under test called out and never answers in place of the module it stands for

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: yes
- Shipped in the preset: yes
- Source: [`no-replaced-double-behaviour--let-the-replaced-module-answer.ts`](../../src/lint/oxlint/rules/no-replaced-double-behaviour--let-the-replaced-module-answer.ts)

<!-- END GENERATED rule-header -->

## Violation

A call inside a spec file settling the value or the implementation a double from a replaced module returns. The members counted as settings are the `mockReturnValue` family, the `mockResolvedValue` family, the `mockRejectedValue` family, the `mockImplementation` family, `mockReturnThis` and `withImplementation`.

"From a replaced module" is identified by where the binding came from. The setting's receiver is followed, and landing on a name that arrived through an import makes it one of the replaced module's. Three routes are followed.

- The imported name itself (`send.mockReturnValue(1)`)
- A member of the imported name (`mailer.send.mockReturnValue(1)`)
- One going through the call that retypes it at run time (`vi.mocked(send).mockReturnValue(1)`)

Bindings placed in between are followed too. Going through `const double = vi.mocked(send);` reads as the same setting.

A double made on the spot with `vi.fn()` is out of scope. A double the test hands over as an argument is the test's input rather than a replacement, and no real thing has stopped running.

A member settled only at run time (`double[member](1)`) is not read. What was settled cannot be established from the call position, so it is not reported.

### The invariant

A replaced module records how it was called and does not answer.

A module may be replaced because that is an external I/O boundary ([no-non-boundary-double--replace-at-the-external-boundary](./no-non-boundary-double--replace-at-the-external-boundary.md)). Replacing a boundary is for keeping the test from leaving the process, not for letting the test settle what comes back from beyond the boundary.

The moment a return value is settled, what that test reads back is a value it wrote itself. The replaced side never runs, and all that is confirmed is that the settled value equals the expected value. That says nothing about the subject's behaviour. The test goes green, and the verification that vanished meets nobody's eye.

The call record remains. How it was called can be claimed with the `toHaveBeenCalledWith` family, so the route of confirming "what was handed to the boundary" stays open. What closes is only the route where the spec settles "what shall be treated as having come back".

### The boundary with the other rules

| Shape | What reads it |
| --- | --- |
| Whether the target may be replaced | `no-non-boundary-double--replace-at-the-external-boundary` |
| Whether the replacement declaration hands over a factory | [no-vi-mock-factory-behavior--use-spy-true-and-fixture](./no-vi-mock-factory-behavior--use-spy-true-and-fixture.md) |
| Where a double is stood up and where it is settled | [no-module-scope-mock-config--lift-into-fixture](./no-module-scope-mock-config--lift-into-fixture.md) |
| Whether a replaced double answers | This rule |

`no-module-scope-mock-config` reads the **position** of a setting and asks for it to move into a fixture. For a double from a replaced module, this rule reports it where it moved to as well. When both fire, deleting the setting itself clears both.

### Configuration

- `specFileSuffixes` — the suffixes read as spec files

### Not violations

- A double made on the spot with `vi.fn()` and handed to the subject as an argument
- Claims about the call record (the `toHaveBeenCalledWith` family)
- Clearing the call record (`mockClear`). It settles nothing about what is returned
- A file that is not a spec
- A setting with a line-local directive carrying grounds written above it

## Fix

Delete the setting. The replaced module stays a pass-through, and the test claims how it was called and nothing else.

```ts
vi.mock(import("./transport.ts"), { spy: true });

const it = test.extend("theDeliveryOfOneMessage", () => deliver(MESSAGE));

it("hands the message to the transport", ({ theDeliveryOfOneMessage }) => {
  expect(vi.mocked(send)).toHaveBeenCalledWith(MESSAGE);
});
```

Where the test needs a particular value, hand that value in through the subject's arguments rather than from the replaced module. Where it is not in a shape that accepts one, building an injection boundary is a design change on the implementation side, and [how tests are written](../../../../docs/guidelines/tests.md) holds the conditions.

### Where it cannot be written without settling

Sometimes the answer exists only beyond the boundary and cannot be settled from outside. There, leave a directive with grounds on the line above.

```ts
// mock-factory-exemption no-replaced-double-behaviour--let-the-replaced-module-answer -- whether the pipeline started is settled inside the boundary this spec replaces
vi.mocked(startLintTelemetry).mockReturnValue(false);
```

The directive is line-local, and with an empty reason it does not hold as an exception and the directive itself is reported. Write in the reason what cannot be settled from outside. The rule name is written so that one directive does not silence other rules as well.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a return value written on an imported double is reported
// in packages/mailer/src/send.test.ts
import { send } from "./mailer.ts";
send.mockReturnValue(1);
```

```ts
// a setting inside a fixture is reported the same as one outside
// in packages/mailer/src/send.test.ts
import { send } from "./mailer.ts";
const it = test.extend("theSent", () => {
  send.mockReturnValue(1);
  return send;
});
```

Code this rule accepts.

```ts
// a double the spec created itself is a test input and may answer
// in packages/mailer/src/send.test.ts
const send = vi.fn();
send.mockReturnValue(1);
```

```ts
// grounds written above the call carry the exemption
// in packages/mailer/src/send.test.ts
import { send } from "./mailer.ts";
// mock-factory-exemption no-replaced-double-behaviour--let-the-replaced-module-answer -- the transport cannot be made to fail from outside
send.mockRejectedValue(1);
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Moving the setting into a fixture. Position is irrelevant; the replaced double is still answering
- Rebinding the replaced double to another name before settling it. Bindings are followed
- Assembling the member at run time so it cannot be read. The judgment disappears, and the replaced side still does not run
- Placing a directive with no reason. The directive itself is reported
- A suppression directive

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `replacedDoubleBehaviour` | A double taken from a replaced module must not be told what to hand back. \`{{member}}\` settles the answer the replaced module was going to give, so the spec reads back the value it wrote itself and the module it replaced never runs. Delete this call and leave the replacement a pass-through that only records how it was called. |
| `unreasonedExemption` | An exemption comment must not stand without grounds. Write the grounds for this exemption after \`--\`, and name there what this spec cannot reach without settling the answer. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
