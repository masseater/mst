# mst — Skill Spec

mst packages reusable units of repository operation: a lint preset that answers review questions by machine, repository checks that lint cannot express, materials for authoring lint rules, and checks for AI-facing documents. All packages are framework-agnostic Node tooling built on the Vite+ toolchain. The shared plumbing package `@mst/utils` is workspace-internal and ships no skills.

## Domains

| Domain | Description | Skills |
| --- | --- | --- |
| enforcing-writing-standards | Wiring machine-enforced answers into a repository | dont-review-it-core |
| gating-the-repository | Running the checks lint cannot express as a single gate | dont-review-it-repository-checks |
| authoring-lint-rules | Writing rules whose enforcement keeps working | lint-rule-authoring-core |
| keeping-documents-true | Keeping AI-facing documents true and machine-followable | agentic-documents-core |
| surfacing-verified-specifications | Declaring claims as spec tests, generating the list | verified-specifications-core |

## Skill Inventory

| Skill | Type | Domain | What it covers | Failure modes |
| --- | --- | --- | --- | --- |
| dont-review-it-core | core | enforcing-writing-standards | preset, withGitExcludes, plugin, tsconfig presets, wiring probe | 4 |
| dont-review-it-repository-checks | core | gating-the-repository | check CLI, workflow checks, shipped-skills check, guard wiring | 6 |
| lint-rule-authoring-core | core | authoring-lint-rules | factory, tester, severity, message discipline, docs pathing | 5 |
| agentic-documents-core | core | keeping-documents-true | check CLI, --write, normative notation, generated regions | 4 |
| verified-specifications-core | core | surfacing-verified-specifications | spec tests, claim naming, SPECIFICATIONS.md regeneration | 4 |

## Failure Mode Inventory

### dont-review-it-core (4 failure modes)

| # | Mistake | Priority | Source | Cross-skill? |
| --- | --- | --- | --- | --- |
| 1 | ignorePatterns placed in an extended preset | HIGH | gotchas.md | — |
| 2 | lint.plugins written as an addition | HIGH | gotchas.md | lint-rule-authoring-core |
| 3 | print-config diff read as proof of wiring | HIGH | gotchas.md | lint-rule-authoring-core |
| 4 | standalone tsconfig written from scratch | MEDIUM | docs/lint | — |

### dont-review-it-repository-checks (6 failure modes)

| # | Mistake | Priority | Source | Cross-skill? |
| --- | --- | --- | --- | --- |
| 1 | check failure masked to keep a pipeline green | CRITICAL | masked-failure.ts | — |
| 2 | gate workflow narrowed by its own trigger | HIGH | gating-trigger-filter | — |
| 3 | run block holding a command sequence | MEDIUM | single-command-run.ts | — |
| 4 | job running on undeclared default permissions | HIGH | declared-permissions | — |
| 5 | published package shipped without its skills | HIGH | shipped-skills.ts | — |
| 6 | internal package left carrying skill wiring | MEDIUM | shipped-skills.ts | — |

### lint-rule-authoring-core (5 failure modes)

| #   | Mistake                                      | Priority | Source     | Cross-skill?        |
| --- | -------------------------------------------- | -------- | ---------- | ------------------- |
| 1   | ParenthesizedExpression branch written       | HIGH     | gotchas.md | —                   |
| 2   | report message carrying a reason or a branch | HIGH     | AGENTS.md  | —                   |
| 3   | new rule confirmed by print-config diff      | HIGH     | gotchas.md | dont-review-it-core |
| 4   | rule added at warn severity                  | MEDIUM   | CLAUDE.md  | —                   |
| 5   | rule test isolated in a test directory       | MEDIUM   | AGENTS.md  | —                   |

### agentic-documents-core (4 failure modes)

| # | Mistake | Priority | Source | Cross-skill? |
| --- | --- | --- | --- | --- |
| 1 | norms written as table rows | HIGH | no-table.ts | — |
| 2 | two decision keywords on one line | MEDIUM | single-decision-keyword.ts | — |
| 3 | good and bad examples placed as a pair | MEDIUM | contrastive-code-pair.ts | — |
| 4 | generated region edited by hand | MEDIUM | run-cli.ts | — |

### verified-specifications-core (4 failure modes)

| #   | Mistake                                     | Priority | Source     | Cross-skill? |
| --- | ------------------------------------------- | -------- | ---------- | ------------ |
| 1   | SPECIFICATIONS.md edited by hand            | HIGH     | AGENTS.md  | —            |
| 2   | claim written with a computed name          | MEDIUM   | run-cli.ts | —            |
| 3   | coverage exercise placed in specs/          | MEDIUM   | AGENTS.md  | —            |
| 4   | spec workspace tsconfig narrowed by include | MEDIUM   | AGENTS.md  | —            |

## Tensions

| Tension | Skills | Agent implication |
| --- | --- | --- |
| enforcement breadth vs unique fixes | dont-review-it-core ↔ lint-rule-authoring-core | writes rules for judgment calls; reports reopen the debate |
| message brevity vs explanation | lint-rule-authoring-core ↔ agentic-documents-core | folds reasons into messages, or leaves reasoning nowhere |
| single gate vs per-tool entries | dont-review-it-repository-checks ↔ agentic-documents-core | wires a new check as a second entry that can be forgotten |

## Cross-References

| From | To | Reason |
| --- | --- | --- |
| dont-review-it-core | lint-rule-authoring-core | adding a rule touches preset and factory together |
| dont-review-it-repository-checks | dont-review-it-core | the CLI covers what the preset cannot express |
| agentic-documents-core | dont-review-it-repository-checks | same single-entry, nonzero-exit gate discipline |

## Subsystems & Reference Candidates

| Skill                            | Subsystems | Reference candidates                        |
| -------------------------------- | ---------- | ------------------------------------------- |
| dont-review-it-core              | —          | 29 lint rules (docs/lint/ is the authority) |
| dont-review-it-repository-checks | —          | —                                           |
| lint-rule-authoring-core         | —          | —                                           |
| agentic-documents-core           | —          | 13 document checks                          |

## Remaining Gaps

| Skill | Question | Status |
| --- | --- | --- |
| dont-review-it-core | External consumers before 1.0? Vite+ assumed or plain oxlint? | open |
| dont-review-it-core | Per-rule reference files, or docs/lint/ stays the authority? | open |
| dont-review-it-repository-checks | Exemption list for the shipped-skills check, or unconditional? | open |
| lint-rule-authoring-core | Agent mistakes the maintainer corrects that no document names | open |

## Recommended Skill File Structure

- **Core skills:** dont-review-it-core, dont-review-it-repository-checks, lint-rule-authoring-core, agentic-documents-core, verified-specifications-core
- **Framework skills:** none — every package is framework-agnostic
- **Lifecycle skills:** none — no quickstart or go-live material in docs
- **Composition skills:** none — the only assumed companion is the Vite+ toolchain itself
- **Reference files:** none initially; docs/lint/ and the package AGENTS.md files remain the single authorities the skills point at

## Composition Opportunities

| Library   | Integration points                          | Composition skill needed?           |
| --------- | ------------------------------------------- | ----------------------------------- |
| vite-plus | vite.config.ts lint/fmt blocks, vp commands | no — covered inside each core skill |
