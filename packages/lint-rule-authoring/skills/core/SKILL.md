---
name: core
description: >
  Author a custom oxlint rule with @mst/lint-rule-authoring: `createWorkspaceLintRule` fills `meta.docs.url` and appends the docs path to every report message, `testLintRule` runs the rule over named valid and invalid snippets, `LINT_SEVERITY` names the severities, `meta.docs.shipped` declares whether a preset carries the rule, and `lint-rule-authoring check --write` reconciles each workspace's `docs/lint/index.md` and `docs/lint/<rule>.md` against the rules under the manifest's `lintRules` directories. Load when writing or changing a rule, wording its report messages, testing it, registering it in a preset, or fixing a reported rule index or rule document.
metadata:
  type: core
  library: "@mst/lint-rule-authoring"
  library_version: "0.0.0"
sources:
  - "masseater/mst:packages/lint-rule-authoring/src/create-workspace-lint-rule.ts"
  - "masseater/mst:packages/lint-rule-authoring/src/rule-tester.ts"
  - "masseater/mst:packages/lint-rule-authoring/src/run-cli.ts"
  - "masseater/mst:packages/lint-rule-authoring/AGENTS.md"
---

# @mst/lint-rule-authoring — author a lint rule

A rule is one unit made of three files that stay together: the implementation, its test beside it, and its prose document under `docs/lint/`. The factory wires them. It fills `meta.docs.url` from the workspace path and the rule name, and appends the repository-relative docs path to the end of every report message, so the author never writes that path anywhere.

## requires

- **A `lintRules` array in the workspace manifest.** `lint-rule-authoring check` discovers rules only under the directories each `package.json` declares there. A workspace that ships rules without declaring the directory is not scanned, and the reconciliation reports nothing — a silent pass, not a clean one.

```json
{
  "lintRules": ["src/lint/oxlint/rules"]
}
```

## Setup

Declare the workspace's factory alias once, in `src/create-rule.ts`:

```ts
import { createWorkspaceLintRule } from "@mst/lint-rule-authoring";

export const createDontReviewItRule = createWorkspaceLintRule({
  workspaceDir: "packages/dont-review-it",
});
```

Register the rules in the workspace's oxlint plugin entry, and point `jsPlugins` at it:

```ts
import { noDefaultExport } from "./lint/oxlint/rules/no-default-export--use-named-export.ts";

import type { Plugin } from "@oxlint/plugins";

const plugin: Plugin = {
  meta: { name: "dont-review-it" },
  rules: { [noDefaultExport.name]: noDefaultExport },
};

export default plugin;
```

The plugin name becomes the prefix of every rule ID, so it is the package name without its scope.

## Core Patterns

### Define a rule through the factory

```ts
import { createDontReviewItRule } from "../../../create-rule.ts";

export const noDefaultExport = createDontReviewItRule({
  name: "no-default-export--use-named-export",
  meta: {
    type: "problem",
    docs: {
      description: "Disallow every export whose outward name is `default`",
      relatedGuidelines: [],
    },
    messages: {
      defaultExport:
        "A module must not put a value out under the name `default`. Name the value and export the name: `export const parseConfig = ...`.",
    },
    schema: [],
  },
  create: (context) => ({
    ExportDefaultDeclaration(node) {
      context.report({ node, messageId: "defaultExport" });
    },
  }),
});
```

The rule name doubles as both file names: `src/lint/oxlint/rules/<name>.ts` and `docs/lint/<name>.md`.

### Write the report message as a prohibition and a fix

State the prohibition with `must not` or `is forbidden`, then start the fix with an imperative verb, in English, and stop. The reasoning, the case analysis, and the examples belong in the docs file whose path the factory already appends. A reason folded into the message pushes the fix instruction past the point a reader stops.

### Test the rule beside it

```ts
import { testLintRule } from "@mst/lint-rule-authoring";

import { noDefaultExport } from "./no-default-export--use-named-export.ts";

testLintRule(noDefaultExport, {
  valid: [{ name: "named export", code: "export const parseConfig = 1", documented: true }],
  invalid: [
    {
      name: "default export",
      code: "export default 1",
      errors: [{ messageId: "defaultExport" }],
      documented: true,
    },
  ],
});
```

The file sits in the rule's own directory as `<rule-file>.test.ts`. Every snippet is named; the valid side carries the boundaries the rule is likely to misfire on; each invalid case names the message ID it expects. `documented: true` marks the snippets the rule document's generated example region is built from — a rule with no marked snippet gets an empty region and the check fails.

### Declare whether a preset carries the rule

```ts
docs: {
  description: "Disallow ...",
  relatedGuidelines: [],
  shipped: false,
},
```

The index reads rule implementations, never presets, so a rule left out of the preset without `shipped: false` is listed as one that ships.

### Register the rule at error severity

```ts
import { LINT_SEVERITY } from "@mst/lint-rule-authoring";

rules: {
  [`dont-review-it/${noDefaultExport.name}`]: LINT_SEVERITY.ERROR,
},
```

Fix every violation the new rule reports before merging it. Demoting to warn is a decision a human makes, never a default.

### Reconcile the index and the documents

```sh
pnpm exec lint-rule-authoring check --write
```

Without `--write` it reports what is missing, unmarked, stale, or still carrying the text a seeded document was written with, and exits non-zero. With `--write` it seeds the absent documents and regenerates every generated region.

Two documents are regenerated per workspace. `docs/lint/index.md` is the in-repository index, and — when the workspace also has `skills/core/SKILL.md` — `skills/core/references/lint-rules.md` is the copy that ships inside the package. The shipped one exists because `docs/` stays in the repository: an installed copy has no other statement of what the rules reject, so its table links each rule to its document on GitHub rather than to a relative path.

## Common Mistakes

### [HIGH] a ParenthesizedExpression branch written in a rule

Wrong:

```ts
const unwrapped = (node) => (node.type === "ParenthesizedExpression" ? node.expression : node);
```

Correct:

```ts
const objectLiteralOf = (node) => (node.type === "ObjectExpression" ? node : null);
```

oxlint strips parentheses before handing the AST to JS plugins, so the branch is never entered; the node type appears in the types only because the AST definition is shared with `oxc-parser`, where it does occur, and coverage of an unreachable branch reads as an untested one.

Source: masseater/mst:.claude/rules/ai-generated/gotchas.md

### [HIGH] a report message carrying a reason or a branch

Wrong:

```ts
messages: {
  defaultExport:
    "Default exports hurt refactoring, so avoid them; use a named export, or keep the default if a framework requires it.",
},
```

Correct:

```ts
messages: {
  defaultExport:
    "A module must not put a value out under the name `default`. Name the value and export the name: `export const parseConfig = ...`.",
},
```

The reason pushes the fix instruction out of the first line and the conditional hands the decision back to the reader, so the report reopens the question the rule was written to close — and the lint still passes once the code is changed either way.

Source: masseater/mst:packages/lint-rule-authoring/AGENTS.md

### [HIGH] a new rule confirmed by a print-config diff

Wrong:

```sh
vp lint --print-config
```

Correct:

```sh
echo "export default 1" > src/wiring-probe.ts
vp lint src/wiring-probe.ts
rm src/wiring-probe.ts
```

`--print-config` resolves built-in rules only and never lists a rule that arrives through a `jsPlugins` entry, so the diff around adding one is always empty and an unwired plugin looks exactly like a wired one.

Source: masseater/mst:.claude/rules/ai-generated/gotchas.md

### [MEDIUM] a schema handed over from another module

Wrong:

```ts
import { CATALOG_ENTRY_SCHEMA } from "./catalog-entry-schema.ts";

schema: CATALOG_ENTRY_SCHEMA,
```

Correct:

```ts
schema: [{ type: "object", properties: { intentionalRanges: { type: "array" } } }],
```

The index extracts facts by parsing the rule's own file, so a schema referenced by identifier cannot be counted and the rule is published in `docs/lint/index.md` as one that takes no options — while it goes on reading them.

Source: masseater/mst:.claude/rules/ai-generated/gotchas.md

### [MEDIUM] a rule added at warn severity

Wrong:

```ts
rules: { "dont-review-it/my-new-rule": "warn" },
```

Correct:

```ts
rules: { "dont-review-it/my-new-rule": LINT_SEVERITY.ERROR },
```

warn is defined as the severity a reader may ignore without asking anyone, so a rule introduced at warn enforces nothing from its first day while appearing in every listing as an active rule.

Source: masseater/mst:CLAUDE.md

### [MEDIUM] a rule test isolated in a test directory

Wrong:

```text
tests/no-default-export.spec.ts
```

Correct:

```text
src/lint/oxlint/rules/no-default-export--use-named-export.ts
src/lint/oxlint/rules/no-default-export--use-named-export.test.ts
```

A test detached from its rule stops moving with it, and the document's example region is built from the marked snippets in the file beside the rule — from anywhere else they are simply not found.

Source: masseater/mst:packages/lint-rule-authoring/AGENTS.md

## Reference

```
@mst/lint-rule-authoring         createWorkspaceLintRule, testLintRule, LINT_SEVERITY,
                                 measureStage, lintRuleIndexProblems, lintRuleDocProblems,
                                 firstToken, matchesGlobSegment, oxlint
@mst/lint-rule-authoring/plugin  the oxlint jsPlugins entry holding this package's own rules
lint-rule-authoring check        [--write] [--repository-root <path>]
docs/lint/index.md               generated index, in the repository
skills/core/references/          generated rule reference, shipped in the package
  lint-rules.md

meta.docs.description            one line; the index heading
meta.docs.relatedGuidelines      the normative documents the rule enforces
meta.docs.shipped                false when a preset deliberately leaves the rule out
meta.docs.url                    written by the factory; never by the author
meta.schema                      an inline array literal, or the index cannot read it
```

Rule duration is exported as OpenTelemetry metrics only when the environment asks for measurement; the factory wraps every visitor either way.

## See also

- `packages/dont-review-it/skills/core` — the preset that registers rules built with this factory, and how to prove the wiring with a violating probe.
