---
description: "Require every lint suppression to apply to the next line alone, so code written later never inherits an exemption nobody chose for it"
---

# no-broad-lint-disable--use-next-line-with-reason

<!-- BEGIN GENERATED rule-header -->

Require every lint suppression to apply to the next line alone, so code written later never inherits an exemption nobody chose for it

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: no
- Shipped in the preset: yes
- Source: [`no-broad-lint-disable--use-next-line-with-reason.ts`](../../src/lint/oxlint/rules/no-broad-lint-disable--use-next-line-with-reason.ts)

<!-- END GENERATED rule-header -->

## Violation

A comment whose first token is `eslint-disable`, `eslint-disable-line`, `oxlint-disable` or `oxlint-disable-line`. The first two cover an open range, the last two cover a whole line, and both reach code nobody had in mind when the suppression was written. The match is on the first token alone, so `-next-line`, `-enable` and a spelling that merely appears in prose are left alone.

## Fix

Write the suppression as the next-line form, name the rule it suppresses, and state the grounds after `--`.

```ts
// oxlint-disable-next-line no-console -- the CLI writes its result here
console.log(result);
```

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a bare oxlint-disable opens the suppression for the rest of the file
// oxlint-disable
const total = 1;
```

```ts
// oxlint-disable-line is reported even when it already carries a reason
console.log(1); // oxlint-disable-line no-console -- the CLI writes its result here
```

Code this rule accepts.

```ts
// the oxlint next-line form with a rule name and a reason is the sanctioned shape
// oxlint-disable-next-line no-console -- the CLI writes its result here
console.log(1);
```

```ts
// prose that names a directive mid sentence is not a directive
// this repository never writes eslint-disable
const total = 1;
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Wrapping a span in a disable and enable pair. The range is still open to code added inside it
- Adding grounds to the `-line` form. The judgment turns on the range, not on whether a reason is there
- Lowering the rule in the lint configuration instead. That widens the exemption rather than narrowing it

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `broadLintDisable` | A \`{{ directive }}\` comment must not stay in the source. Replace it with \`{{ nextLineDirective }}\` on its own line directly above the single line that violates, name there the rule it suppresses, and state the grounds for the suppression after \`--\`. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads no options. A consumer turns it on or off as a whole.

<!-- END GENERATED runtime -->
