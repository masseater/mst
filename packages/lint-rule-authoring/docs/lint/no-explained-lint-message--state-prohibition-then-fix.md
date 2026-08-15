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

A string in the `messages` of a property named `meta` that also carries `docs`. Code spans and `{{ }}` placeholders are masked out, and what is left is read on eight points: no outright prohibition (`must not` / `is forbidden`), no sentence opening with an imperative verb from the list this rule holds, a reason connective, a conditional word, a phrase offering a way around the rule, a hand-written `.md` pointer, a character outside printable ASCII, and a text identical to `meta.docs.description`. The last three are read on the raw message rather than the masked one.

## Fix

State the prohibition outright, then the repair in the imperative, and nothing else. The reason, the case split and the ways around belong to the sections of this document.

```ts
messages: {
  detachedTestFile:
    "A test file must not sit apart from the source it tests. Move this file into the directory of the source it tests and name it after that source.",
},
```

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

- Rewriting the reason as a condition. Both belong in the document
- Hiding prose inside a code span. The masking is there for the code a message quotes
- Splitting the prohibition and the repair across two messages. Reports are read one at a time

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
