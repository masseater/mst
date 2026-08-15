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

A behaviour setter called on a double that reaches a replaced module. The receiver is followed through member paths, through `const` bindings, and through `vi.mocked(...)`, so a view of the module and a name bound to one reach the same judgment.

An exemption comment naming this rule, written directly above the call and carrying grounds after `--`, takes the call out of the report. One written without grounds is itself reported.

## Fix

Delete the call and leave the replacement a pass-through that only records how it was called. Assert the calls with the `toHaveBeenCalled` family.

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

- Binding the double to a name first, or taking it through `vi.mocked(...)`. Both are followed
- Writing the exemption comment without grounds. It is reported until they are written

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
