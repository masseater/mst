---
description: "Require every lint message to carry a prohibition and an imperative repair direction and nothing else, so the first thing a reader meets is the action that clears the report"
---

# no-explained-lint-message--state-prohibition-then-fix

<!-- BEGIN GENERATED rule-header -->

Require every lint message to carry a prohibition and an imperative repair direction and nothing else, so the first thing a reader meets is the action that clears the report

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: no
- Shipped in the preset: yes
- Source: [`no-explained-lint-message--state-prohibition-then-fix.ts`](../../src/lint/oxlint/rules/no-explained-lint-message--state-prohibition-then-fix.ts)

<!-- END GENERATED rule-header -->

## Violation

Object literals carrying `docs` and `messages` directly are read; a rule definition's `meta` takes that shape. Among the values of that `messages`, string literals and template literals are checked.

Before the check, code spans (the ranges enclosed in backticks) and interpolations (the `{{ }}` placeholders, and a template literal's expressions) are masked out of the text. The prose that remains is read on eight points.

- No outright prohibition
- No imperative repair direction
- A connective introducing a reason is there
- A conditional word is there
- A turn of phrase recommending a way out is there
- A pointer to the document is written by hand
- A character outside printable ASCII is there
- The text is identical to `meta.docs.description`

The vocabulary is held by this rule.

- Outright prohibition: `must not` / `is forbidden` / `are forbidden`
- Reason connectives: `because` / `since` / `so that` / `therefore` / `which means` / `as a result`
- Conditional words: `if` / `when` / `unless` / `whenever` / `once` / `otherwise`
- Ways out: turns of phrase recommending suppression, disabling, adding an exemption, or deferring
- Imperative verbs: the list of verbs that may open a repair direction

The imperative judgment cuts the text into sentences and asks whether the first word of any sentence is in the list of imperative verbs. Wanting to write with a verb absent from the list, add that verb to the list. The list is owned by this rule, so the place to add it is one spot in this rule's source.

### Deliberately not widened

| Shape | Why it is left out |
| --- | --- |
| An object carrying only one of `docs` and `messages` | It is no rule `meta` |
| A message whose value is no string | The text is settled at run time, so it cannot be read statically |

The report stands on the message's definition itself. For a reason, a condition or a way out, the word that caught is carried into the report.

### The invariant

What is held is that the report alone settles the next move.

The first layer is where a report is read. A report is the first repair direction the violator reads. Fold a reason into it and the repair direction moves to the back of the paragraph. The reader, having read the prohibiting sentence, is put off by the length and starts looking for another means before reaching the repair. What actually gets chosen is the shortest operation that clears the report — that is, suppression.

The second layer is where the reason belongs. Write the reason both in the message and in the document and only one of them gets updated, and they go stale separately. This package holds "the authority for an explanation sits in one place" as an invariant, so the prose is held by the `docs/lint/` document alone. The pointer at the end of a message is appended by the factory, so the document is always reachable from a report.

The third layer is what happens once a condition is written. Give the repair direction a case split and the judgment of which branch applies goes back to the reader. Unable to judge, they choose no branch and the report stays. Where the repair splits enough to need a case split, that is a quantity for the document to carry, not for one line of report.

### Configuration

None. Only whether the rule is on or off is settled by the configuration.

The vocabulary is not made replaceable by configuration. Make it replaceable and what counts as a prohibition changes per workspace, and the very premise that report texts share one shape falls apart.

## Fix

State the prohibition outright, then state the repair in the imperative. Move the reason, the case split and the forbidden bypasses into the corresponding sections of this document.

```ts
messages: {
  detachedTestFile:
    "A test file must not sit apart from the source it tests. Move this file into the directory of the source it tests and name it after that source.",
},
```

What the earlier text carried — that the path is the only thing tying the pair together, and what to do where nothing owns the behaviour any more — belongs to the "Violation" and "Fix" sections of the document, not to the report.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a because clause argues for the rule
const rule = createRule({ name: "a-rule", meta: { docs: { description: "Disallow a default export" }, messages: { defaultExport: "A module must not use a default export, because every importing file then invents a name. Name the value and export the name." } } });
```

```ts
// a message that stops at the prohibition names no repair
const rule = createRule({ name: "a-rule", meta: { docs: { description: "Disallow a default export" }, messages: { defaultExport: "A module must not put a value out under the name default." } } });
```

Code this rule accepts.

```ts
// a prohibition followed by an imperative repair direction is the sanctioned shape
const rule = createRule({ name: "a-rule", meta: { docs: { description: "Disallow a default export" }, messages: { defaultExport: "A module must not put a value out under the name default. Name the value and export the name." } } });
```

```ts
// a condition word inside a code span is part of the quoted code, not a branch
const rule = createRule({ name: "a-rule", meta: { docs: { description: "Disallow a bare conditional" }, messages: { bareConditional: "A statement must not be written as `if (ready) run();`. Move the branch into its own block." } } });
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- **Rewriting the reason as a conditional word.** Turning "why" into "in which case" leaves the report carrying something other than a repair direction. Both move to the document
- **Putting the reason inside a code span to mask it.** The masking is there for the code a message quotes. It is no place to hide prose
- **Shortening `meta.docs.description` to slip the identical-text detection.** What is detected is a text that is nothing but a copy of the description. Trim the description and the text still carries no repair direction
- **Splitting the message in two, one carrying the prohibition and the other the repair.** Reports are read one at a time, so each one needs both the prohibition and the repair
- **Dropping the repair direction to make the report shorter.** What may be dropped is the reason and the case split, not the repair direction

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `missingProhibition` | Lint message \`{{messageId}}\` must not leave the rejected pattern unmarked. Add \`must not\` or \`is forbidden\` to the sentence that names that pattern. |
| `missingFixDirection` | Lint message \`{{messageId}}\` must not stop at the prohibition. Add a sentence that opens with an imperative verb and names the repair. |
| `rationaleStatement` | Lint message \`{{messageId}}\` must not argue for the rule. Delete \`{{phrase}}\` and the clause it opens, and leave the prohibition and the repair direction standing. |
| `conditionStatement` | Lint message \`{{messageId}}\` must not make the repair conditional. Delete \`{{phrase}}\` and the branch it opens, and state one repair direction. |
| `escapeHatchPhrase` | Lint message \`{{messageId}}\` must not offer a way around the rule. Delete \`{{phrase}}\` and the passage it belongs to. |
| `handWrittenDocPointer` | Lint message \`{{messageId}}\` must not carry a hand-written document pointer. Delete the pointer and build this rule through the workspace lint-rule factory. |
| `nonEnglishMessage` | Lint message \`{{messageId}}\` must not carry characters outside printable ASCII. Rewrite the whole message in English. |
| `descriptionEcho` | Lint message \`{{messageId}}\` must not repeat \`meta.docs.description\`. Rewrite the message as a prohibition followed by a repair direction. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads no options. A consumer turns it on or off as a whole.

<!-- END GENERATED runtime -->
