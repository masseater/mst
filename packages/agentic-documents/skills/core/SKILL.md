---
name: core
description: >
  Write AI-facing normative documents and keep them true with `agentic-documents check`: one `IF: <condition>; THEN <KEYWORD>: <action>` rule per line, one decision keyword per item, `PROHIBIT` as the fixed spelling for a prohibition, reasons on their own nested line, no norms inside tables, no good-and-bad example pairs in one section, a `description` in the frontmatter matching the manifest beside it, `CLAUDE.md` as a symlink to `AGENTS.md`, and generated regions refreshed with `--write`. Load when writing or editing AGENTS.md, when `agentic-documents check` reports, when a reference or heading it names does not resolve, or when a generated region is reported stale.
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

The check guards two faces of the same document. One is that what it says still matches the repository: the references resolve, the workspace list is current, the frontmatter agrees with the manifest. The other is that its norms keep a shape a machine can follow: a condition, one decision, one action. Neither face is sufficient alone — a true document nobody can apply, and an applicable document that is out of date, fail the reader the same way. Rewording a report away is never the fix.

## requires

- **`AGENTS.md` as the real file and `CLAUDE.md` as a symlink to it.** The companion check requires the pair to exist wherever a normative document does, with the companion never a regular file and never pointing anywhere else. A `CLAUDE.md` written as its own copy passes every reader and diverges the first time one of the two is edited.
- **Japanese sentence terminators, unless the defaults are changed.** `sentenceTerminators` is `["。"]` and the contrastive-pair markers are the Japanese and English labels in `src/config.ts`. On an English-only document set the sentence checks find no sentence boundary and stay quiet, so change the defaults rather than reading the silence as a pass.

## Setup

```sh
pnpm exec agentic-documents check --repository-root .
```

The command exits non-zero when any document disagrees with the repository or breaks the notation. Generated regions are rewritten in place with:

```sh
pnpm exec agentic-documents check --write
```

`--write` touches nothing but the generated regions. Every other report is fixed by hand.

## Core Patterns

### Write a norm an agent can execute

One condition, one decision keyword, one action per line. Reasons go on their own nested line.

```markdown
- IF: a rule is added to the preset; THEN
  - MUST: add it at error severity
  - PROHIBIT: demote it to warn without a human decision
    - warn is defined as ignorable, so a warn-born rule enforces nothing
```

The decision keywords are `MUST`, `PROHIBIT`, `SHOULD`, `SHOULD NOT`, and `MAY`. A prohibition is spelled `PROHIBIT` at the head of the item, never `MUST NOT`, so a reader classifies the line from its first token instead of parsing to the negation.

### Keep the frontmatter description in sync

A normative document carries a `description` frontmatter field, and it must equal the `description` of the `package.json` beside it.

```markdown
---
description: AI-facing documents that stay true to the repository and keep a shape machines can follow.
---
```

### Point instead of copying

A norm lives in exactly one document. Others that need it write a pointer to the owning file — `詳細は`, `参照:`, `See `, `Refer to ` — instead of repeating the sentence. Verbatim runs of 40 characters or more shared between two normative documents are reported.

### Number a sequence from one, without gaps

Ordered steps labelled `Phase`, `Step`, `Stage`, `フェーズ`, `ステップ`, or `段階` must run as consecutive integers starting at 1. A sequence that skips a number reads as a step that was deleted rather than one that never existed.

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

A rule inside a table cell has no condition, so a reader must invent one to decide whether it applies — and every reader invents a slightly different one. The check reports every norm-bearing table row.

Source: masseater/mst:packages/agentic-documents/src/checks/no-table.ts

### [HIGH] a reference that resolves to nothing

Wrong:

```markdown
See [the enforcement guide](../../docs/guidelines/enforcment.md#detection).
```

Correct:

```markdown
See [the enforcement guide](../../docs/guidelines/enforcement.md#detection).
```

Links inside a normative document are read by agents that follow them, and a target or heading anchor that does not exist produces no error at read time — the agent simply proceeds without the rule the pointer was standing in for.

Source: masseater/mst:packages/agentic-documents/src/checks/reference-targets.ts

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

A line holding two keywords leaves the binding one ambiguous, so which half is mandatory and which is forbidden depends on how far the reader parses before acting.

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

A contrastive pair teaches the labels rather than the norm, and half the section is a form the document forbids — which is the half a reader copying from it may take. The check reports the pair when both markers appear in one section.

Source: masseater/mst:packages/agentic-documents/src/checks/contrastive-code-pair.ts

### [MEDIUM] a version number written into the prose

Wrong:

```markdown
- IF: pinning the runtime; THEN MUST: use Node 26.7.0
```

Correct:

```markdown
- IF: pinning the runtime; THEN MUST: use the version `devEngines.runtime` declares
```

A version in prose has no mechanism keeping it current, so it stays right until the day the manifest moves and then quietly instructs every reader to install the wrong one.

Source: masseater/mst:packages/agentic-documents/src/checks/version-in-prose.ts

### [MEDIUM] a generated region edited by hand

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

The generator owns the region, so a hand edit is reported as stale on the next run and erased by the next `--write` — with no record that anything was removed.

Source: masseater/mst:packages/agentic-documents/src/run-cli.ts

## Reference

```
what the check reads
frontmatter description       matches the description of the package.json beside it
reference targets             linked files and heading anchors exist
duplicate normative units     no verbatim run of 40+ characters across two documents
companion files               AGENTS.md has a CLAUDE.md symlink pointing at it
workspace list                docs/workspaces.md matches pnpm-workspace.yaml's packages
no table                      no norm written as a table row
single decision keyword       at most one of MUST/PROHIBIT/SHOULD/SHOULD NOT/MAY per item
prohibition spelling          PROHIBIT, never MUST NOT
action is one sentence        the reason is not on the action's line
duplicate condition           the same condition is not repeated at one level
ordered sequence              Phase/Step/Stage labels are consecutive from 1
version in prose              no literal version number in the prose
contrastive code pair         no good-and-bad example pair inside one section

configuration (src/config.ts defaults)
decisionKeywords              MUST, PROHIBIT, SHOULD NOT, SHOULD, MAY
prohibitionKeyword            PROHIBIT
negatedKeywords               MUST NOT
sentenceTerminators           。
duplicateUnitMinimumLength    40
pointerUnitPrefixes           詳細は, 参照:, "See ", "Refer to "
ignoredDirectories            node_modules, .git, dist, coverage, .claude, .local-agents
workspaceList                 docs/workspaces.md, region BEGIN/END GENERATED workspaces
```

## See also

- `packages/dont-review-it/skills/repository-checks` — the code-side checks, run as the same kind of single-entry, non-zero-exit gate.
