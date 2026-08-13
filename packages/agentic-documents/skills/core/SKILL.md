---
name: core
description: >
  Write AI-facing normative documents (AGENTS.md and companions) in the condition-action notation and keep them true with the agentic-documents check CLI: IF/THEN rules, one decision keyword per line, fixed prohibition spelling, no norm tables, no contrastive example pairs, and generated regions refreshed with --write. Load when writing or editing AGENTS.md/CLAUDE.md, when agentic-documents check reports, or when a generated region is stale.
metadata:
  type: core
  library: "@mst/agentic-documents"
  library_version: "0.0.0"
sources:
  - "masseater/mst:packages/agentic-documents/src/run-cli.ts"
  - "masseater/mst:packages/agentic-documents/src/config.ts"
  - "masseater/mst:packages/agentic-documents/AGENTS.md"
---

# @mst/agentic-documents — write and check agent-facing documents

The check guards two faces of a document: that its content matches the repository, and that its norms keep a machine-followable condition-action shape. Rewording a report away is never the fix; the fix is making the document true or making the norm decidable.

## Setup

```sh
pnpm exec agentic-documents check --repository-root .
```

The command exits nonzero when any document disagrees with the repository or breaks the notation. Generated regions are rewritten in place with:

```sh
pnpm exec agentic-documents check --write
```

## Core Patterns

### Write a norm an agent can execute

One condition, one decision keyword, one action per line. Reasons go on their own nested line.

```markdown
- IF: a rule is added to the preset; THEN
  - MUST: add it at error severity
  - PROHIBIT: demote it to warn without a human decision
    - warn is defined as ignorable, so a warn-born rule enforces nothing
```

The decision keywords are `MUST`, `PROHIBIT`, `SHOULD`, `SHOULD NOT`, `MAY`. Prohibitions are spelled `PROHIBIT` at the head of the item, never `MUST NOT`, so a reader can classify the line from its first token.

### Keep the frontmatter description in sync

A normative document carries a `description` frontmatter field, and it must equal the `description` of the `package.json` beside it.

```markdown
---
description: AI-facing documents that stay true to the repository and keep a shape machines can follow.
---
```

### Point instead of copying

A norm lives in exactly one document. Other documents that need it write a pointer to the owning file instead of repeating the sentence; verbatim copies across normative documents are reported.

## Common Mistakes

### [HIGH] norms written as table rows

Wrong:

```markdown
| Rule       | Meaning              |
| ---------- | -------------------- |
| no-default | avoid default export |
```

Correct:

```markdown
- IF: a value is about to be exported as `default`; THEN PROHIBIT: export it under that name
```

A rule inside a table cell has no condition-action shape, so a reader must guess when it applies; the check reports every norm-bearing table row.

Source: masseater/mst:packages/agentic-documents/src/checks/no-table.ts

### [MEDIUM] two decision keywords on one line

Wrong:

```markdown
- IF: adding a rule; THEN MUST: add it at error and PROHIBIT: demote it to warn
```

Correct:

```markdown
- IF: adding a rule; THEN
  - MUST: add it at error
  - PROHIBIT: demote it to warn
```

A line holding two keywords leaves the binding one ambiguous, so each keyword gets its own sub-item.

Source: masseater/mst:packages/agentic-documents/src/checks/single-decision-keyword.ts

### [MEDIUM] good and bad examples placed as a pair

Wrong:

```markdown
悪い例: `const x = 1` 良い例: `const lineCount = 1`
```

Correct:

```markdown
`const lineCount = 1`
```

A contrastive pair teaches the labels instead of the norm, and the check reports the pair when both markers appear in one section; show only the form that satisfies the rule.

Source: masseater/mst:packages/agentic-documents/src/checks/contrastive-code-pair.ts

### [MEDIUM] generated region edited by hand

Wrong:

```markdown
<!-- BEGIN GENERATED workspaces -->

- packages/my-manual-edit

<!-- END GENERATED workspaces -->
```

Correct:

```sh
pnpm exec agentic-documents check --write
```

The generator owns the region, so a hand edit is reported as stale on the next run and the next `--write` erases it.

Source: masseater/mst:packages/agentic-documents/src/run-cli.ts

## See also

- `packages/dont-review-it/skills/repository-checks` — the same single-entry, nonzero-exit gate discipline for the code-side checks.
