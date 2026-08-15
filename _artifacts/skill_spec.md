# mst — Skill Spec

mst packages reusable units of repository operation: a lint preset that answers review questions by machine, repository checks that lint cannot express, materials for authoring lint rules, checks for AI-facing documents, specifications extracted from the tests that verify them, command wrappers that bound the host and the caller's context window, and an unattended pull-request loop. All packages are framework-agnostic Node tooling built on the Vite+ toolchain. The shared plumbing package `@mst/repository-checks` is workspace-internal and ships no skills.

## Domains

| Domain | Description | Skills |
| --- | --- | --- |
| enforcing-writing-standards | Wiring machine-enforced answers into a repository | dont-review-it-core |
| gating-the-repository | Running the checks lint cannot express as a single gate | dont-review-it-repository-checks |
| authoring-lint-rules | Writing rules whose enforcement keeps working | lint-rule-authoring-core |
| keeping-documents-true | Keeping AI-facing documents true and machine-followable | agentic-documents-core |
| surfacing-verified-specifications | Declaring claims as spec tests, generating the list | verified-specifications-core |
| wrapping-heavy-commands | Bounding the host's capacity and the caller's context window | ai-native-core |
| answering-pull-requests | Reviewing and responding to a pull request unattended | auto-develop-core |
| stopping-valueless-additions | Reporting code that only restates what the change removed | stop-ai-slop-core |

## Skill Inventory

| Skill | Type | Domain | What it covers | Failure modes |
| --- | --- | --- | --- | --- |
| dont-review-it-core | core | enforcing-writing-standards | dontReviewItPreset, plugin, tsconfig presets, vitest fixture, markdown prose wrapping, wiring probe | 6 |
| dont-review-it-repository-checks | core | gating-the-repository | check CLI, 14 checks, warning convention, workflow checks, shipped-skills check, guard wiring | 7 |
| lint-rule-authoring-core | core | authoring-lint-rules | factory, tester, severity, message discipline, docs pathing, index CLI | 6 |
| agentic-documents-core | core | keeping-documents-true | check CLI, --write, 13 document checks, normative notation, generated regions | 6 |
| verified-specifications-core | core | surfacing-verified-specifications | spec tests, claim naming, tsconfig scope, SPECIFICATIONS.md regeneration | 6 |
| ai-native-core | core | wrapping-heavy-commands | throttle, spool, unabridged hook, telemetry entry | 6 |
| auto-develop-core | core | answering-pull-requests | relay endpoints, reviewer and author runtimes, job lanes, engine prompt | 7 |
| stop-ai-slop-core | core | stopping-valueless-additions | check CLI, comparison range, check registry | 4 |

## Failure Mode Inventory

### dont-review-it-core (6 failure modes)

| # | Mistake | Priority | Source | Cross-skill? |
| --- | --- | --- | --- | --- |
| 1 | ignorePatterns placed in an extended preset | HIGH | gotchas.md | — |
| 2 | lint.plugins written as an addition | HIGH | gotchas.md | lint-rule-authoring-core |
| 3 | print-config diff read as proof of wiring | HIGH | gotchas.md | lint-rule-authoring-core |
| 4 | a GitHub alert written with its body on the next line | HIGH | EDR 0046 | — |
| 5 | standalone tsconfig written from scratch | MEDIUM | docs/lint | — |
| 6 | a second exported config added beside the preset | MEDIUM | AGENTS.md | — |

### dont-review-it-repository-checks (7 failure modes)

| # | Mistake | Priority | Source | Cross-skill? |
| --- | --- | --- | --- | --- |
| 1 | check failure masked to keep a pipeline green | CRITICAL | masked-failure.ts | — |
| 2 | gate workflow narrowed by its own trigger | HIGH | gating-trigger-filter | — |
| 3 | job running on undeclared default permissions | HIGH | declared-permissions | — |
| 4 | published package shipped without its skills | HIGH | shipped-skills.ts | — |
| 5 | published entry point left pointing at source | HIGH | AGENTS.md | — |
| 6 | run block holding a command sequence | MEDIUM | single-command-run.ts | — |
| 7 | internal package left carrying skill wiring | MEDIUM | shipped-skills.ts | — |

### lint-rule-authoring-core (6 failure modes)

| #   | Mistake                                      | Priority | Source     | Cross-skill?        |
| --- | -------------------------------------------- | -------- | ---------- | ------------------- |
| 1   | ParenthesizedExpression branch written       | HIGH     | gotchas.md | —                   |
| 2   | report message carrying a reason or a branch | HIGH     | AGENTS.md  | —                   |
| 3   | new rule confirmed by print-config diff      | HIGH     | gotchas.md | dont-review-it-core |
| 4   | a schema handed over from another module     | MEDIUM   | gotchas.md | —                   |
| 5   | rule added at warn severity                  | MEDIUM   | CLAUDE.md  | —                   |
| 6   | rule test isolated in a test directory       | MEDIUM   | AGENTS.md  | —                   |

### agentic-documents-core (6 failure modes)

| # | Mistake | Priority | Source | Cross-skill? |
| --- | --- | --- | --- | --- |
| 1 | norms written as table rows | HIGH | no-table.ts | — |
| 2 | a reference that resolves to nothing | HIGH | reference-targets.ts | — |
| 3 | two decision keywords on one line | MEDIUM | single-decision-keyword.ts | — |
| 4 | good and bad examples placed as a pair | MEDIUM | contrastive-code-pair.ts | — |
| 5 | a version number written into the prose | MEDIUM | version-in-prose.ts | — |
| 6 | generated region edited by hand | MEDIUM | run-cli.ts | — |

### verified-specifications-core (6 failure modes)

| #   | Mistake                                     | Priority | Source            | Cross-skill? |
| --- | ------------------------------------------- | -------- | ----------------- | ------------ |
| 1   | SPECIFICATIONS.md edited by hand            | HIGH     | AGENTS.md         | —            |
| 2   | spec workspace tsconfig narrowed by include | HIGH     | AGENTS.md         | —            |
| 3   | claim written with a computed name          | MEDIUM   | extract/claims.ts | —            |
| 4   | a runner narrowed through a member          | MEDIUM   | extract/claims.ts | —            |
| 5   | coverage exercise placed in specs/          | MEDIUM   | AGENTS.md         | —            |
| 6   | a subject left with no claims under it      | MEDIUM   | extract/claims.ts | —            |

### ai-native-core (6 failure modes)

| # | Mistake | Priority | Source | Cross-skill? |
| --- | --- | --- | --- | --- |
| 1 | wrappers composed with spool on the outside | HIGH | AGENTS.md | — |
| 2 | throttle nested inside the command it wraps | HIGH | throttle/usage.ts | — |
| 3 | an interactive command wrapped with spool | HIGH | AGENTS.md | — |
| 4 | a wrapper failure read as the child's exit code | MEDIUM | spool/run-spool.ts | — |
| 5 | telemetry provider requested more than once | MEDIUM | telemetry/telemetry.ts | — |
| 6 | unabridged expected to see inside a nested shell | MEDIUM | find-slicing-commands.ts | — |

### auto-develop-core (7 failure modes)

| # | Mistake | Priority | Source | Cross-skill? |
| --- | --- | --- | --- | --- |
| 1 | the GitHub token presented to a subscriber endpoint | CRITICAL | relay-credential.spec.ts | — |
| 2 | the pull request diff put into the engine prompt | HIGH | engine-session.spec.ts | — |
| 3 | a live repository run started without --dry-run | HIGH | cli/runtime-command.ts | — |
| 4 | the queue snapshot read back after a restart | HIGH | job-lane.spec.ts | — |
| 5 | a pull-request filter that parses to nothing | HIGH | cli/runtime-command.ts | — |
| 6 | the same number given to both pull-request filters | MEDIUM | job-lane.spec.ts | — |
| 7 | an environment address written as a constant | MEDIUM | AGENTS.md | — |

### stop-ai-slop-core (4 failure modes)

| # | Mistake | Priority | Source | Cross-skill? |
| --- | --- | --- | --- | --- |
| 1 | absence assertion added by the change that removed it | HIGH | AGENTS.md | — |
| 2 | the assertion reshaped until the locator is lost | MEDIUM | AGENTS.md | — |
| 3 | revisions guessed instead of resolved | MEDIUM | comparison-range.ts | — |
| 4 | a new check published as its own subcommand | MEDIUM | AGENTS.md | — |

## Tensions

| Tension | Skills | Agent implication |
| --- | --- | --- |
| enforcement breadth vs unique fixes | dont-review-it-core ↔ lint-rule-authoring-core | writes rules for judgment calls; reports reopen the debate |
| message brevity vs explanation | lint-rule-authoring-core ↔ agentic-documents-core | folds reasons into messages, or leaves reasoning nowhere |
| single gate vs per-tool entries | dont-review-it-repository-checks ↔ agentic-documents-core | wires a new check as a second entry that can be forgotten |
| bounded parallelism vs a visible run | ai-native-core ↔ dont-review-it-repository-checks | wraps the gate so its own queue announcements land in the log |

## Cross-References

| From | To | Reason |
| --- | --- | --- |
| dont-review-it-core | lint-rule-authoring-core | adding a rule touches preset and factory together |
| dont-review-it-repository-checks | dont-review-it-core | the CLI covers what the preset cannot express |
| agentic-documents-core | dont-review-it-repository-checks | same single-entry, nonzero-exit gate discipline |
| stop-ai-slop-core | dont-review-it-repository-checks | same single-entry, nonzero-exit gate discipline |
| ai-native-core | dont-review-it-repository-checks | the gate is the command the wrappers wrap |
| ai-native-core | lint-rule-authoring-core | rule duration is exported through this telemetry entry |

## Subsystems & Reference Candidates

| Skill                            | Subsystems | Reference candidates                         |
| -------------------------------- | ---------- | -------------------------------------------- |
| dont-review-it-core              | —          | 112 lint rules (docs/lint/ is the authority) |
| dont-review-it-repository-checks | —          | 14 checks the one command runs               |
| lint-rule-authoring-core         | —          | —                                            |
| agentic-documents-core           | —          | 13 document checks                           |
| verified-specifications-core     | —          | —                                            |
| ai-native-core                   | —          | —                                            |
| auto-develop-core                | —          | —                                            |
| stop-ai-slop-core                | —          | —                                            |

## Remaining Gaps

| Skill | Question | Status |
| --- | --- | --- |
| dont-review-it-core | External consumers before 1.0? Vite+ assumed or plain oxlint? | open |
| dont-review-it-core | Per-rule reference files, or docs/lint/ stays the authority? | open |
| dont-review-it-repository-checks | Exemption list for the shipped-skills check, or unconditional? | open |
| lint-rule-authoring-core | Agent mistakes the maintainer corrects that no document names | open |
| auto-develop-core | Is the relay expected to run outside this repository before 1.0? | open |

## Recommended Skill File Structure

- **Core skills:** one per published package, plus dont-review-it-repository-checks as a second skill of `@mst/dont-review-it`
- **Framework skills:** none — every package is framework-agnostic
- **Lifecycle skills:** none — no quickstart or go-live material in docs
- **Composition skills:** none — the only assumed companion is the Vite+ toolchain itself
- **Reference files:** none initially; docs/lint/ and the package AGENTS.md files remain the single authorities the skills point at

## Composition Opportunities

| Library   | Integration points                          | Composition skill needed?           |
| --------- | ------------------------------------------- | ----------------------------------- |
| vite-plus | vite.config.ts lint/fmt blocks, vp commands | no — covered inside each core skill |
