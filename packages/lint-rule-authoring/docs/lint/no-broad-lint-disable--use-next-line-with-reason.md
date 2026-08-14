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

A comment whose first token is a directive that opens a broad suppression. Line comments and block comments alike.

Four spellings are watched:

| Spelling | What it covers |
| --- | --- |
| `eslint-disable` / `oxlint-disable` | Everything up to the matching re-enable, or to the end of the file when there is none |
| `eslint-disable-line` / `oxlint-disable-line` | The whole line the comment sits on |

The judgment is an exact match on the first token: the body of the comment is trimmed, everything up to the first whitespace is taken, and that is compared against the four.

- A comment whose body is whitespace alone carries no first token and is not a directive
- A form with a newline right after the directive name and the rule names on the next line is still detected, because the first token has not changed
- A spelling that merely appears mid-sentence in prose (`// this repository never writes eslint-disable`) does not match the first token and is left alone
- `eslint-disable-next-line` and `oxlint-disable-next-line` are not an exact match and are left alone. The comparison is not a prefix match, so `-next-line` never trips over `-disable`

`eslint-enable` and `oxlint-enable` open no suppression of their own and are not reported. A span wrapped in a disable and enable pair is reported at the disable that opens it.

The report points at the comment. The message carries the spelling of the directive actually used and the next-line spelling that replaces it, so which one was caught and what to write instead can be read off the output alone.

### The invariant

A suppression covering a broad range turns "I wanted this one violation suppressed" into "an indefinite range is permanently exempt". Whoever wrote it was thinking about one line, while every line added inside the open range joins the exemption without anyone noticing.

What was inherited is detected by nothing. The lint passes, the tests hold, and a review sees no more than that a suppression comment is there. However many rules are written, one comment of this shape guts them. Unless the way suppressions are written is itself constrained, "the lint is actually enforcing something" is not a state that can be held.

No option is offered. Whether the rule is on or off is settled by the configuration, and nothing else about the judgment is.

## Fix

Switch to the form that covers the next line alone. Name the rule being suppressed and write, after `--`, why the suppression stands on that line.

```ts
// oxlint-disable-next-line no-console -- the CLI writes its result here
console.log(result);
```

The suppression now covers the one line that raised the violation. The range is closed, so code written later never joins the exemption, and the reason stands beside it, so whoever reads it later can decide whether to keep it or remove it.

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

- **Wrapping a span in a disable and enable pair.** The range is closed, and it changes nothing about code added inside it joining the exemption. Write one suppression per offending line
- **Widening the range because the suppressions feel too many.** Many suppressions are a problem with the code underneath, not with how suppressions are written. Fix the code instead of widening
- **Adding a reason to the `-line` form to get it through.** The judgment does not turn on whether a reason is there. What is wrong is that the range is not narrowed to the offending line
- **Dropping the comment and disabling the range in the lint configuration instead.** Naming files or directories by glob and lowering the severity removes the comment while widening the exemption. Lowering it in the configuration stands only where the configuration file can carry why it was lowered and when it goes back

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
