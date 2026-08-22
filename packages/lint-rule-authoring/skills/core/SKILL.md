---
name: core
description: >
  Author a custom oxlint rule with @mst/lint-rule-authoring: createWorkspaceLintRule factory, testLintRule tester, LINT_SEVERITY vocabulary, report-message discipline, and the docs-file pathing the factory appends. Load when writing or changing a lint rule, writing its report messages, testing it, or registering it in a preset.
metadata:
  type: core
  library: "@mst/lint-rule-authoring"
  library_version: "0.0.0"
sources:
  - "masseater/mst:packages/lint-rule-authoring/src/run-cli.ts"
  - "masseater/mst:packages/lint-rule-authoring/src/create-workspace-lint-rule.ts"
  - "masseater/mst:packages/lint-rule-authoring/src/rule-tester.ts"
  - "masseater/mst:packages/lint-rule-authoring/AGENTS.md"
---

# @mst/lint-rule-authoring — author a lint rule

A rule is one unit made of three files that stay together: the implementation, its test beside it, and its prose document under `docs/lint/`. The factory wires the three: it fills `meta.docs.url` from the workspace path and rule name, and appends the repository-relative docs path to every report message. The author never writes that path.

Regenerate every declared rule index after adding, deleting, or renaming a rule:

```sh
vp exec lint-rule-authoring check --write --repository-root .
```

## Setup

Each workspace declares its factory alias once, in `src/create-rule.ts`:

```ts
import { createWorkspaceLintRule } from "@mst/lint-rule-authoring";

export const createDontReviewItRule = createWorkspaceLintRule({
  workspaceDir: "packages/dont-review-it",
});
```

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

The rule name doubles as its file name and its docs file name: `src/lint/oxlint/rules/<name>.ts` and `docs/lint/<name>.md`.

### Write the report message

A message is the prohibition and the imperative fix, in English, nothing else. State the prohibition with `must not` or `is forbidden`, then start the fix with an imperative verb. The reasoning, the case analysis, and the examples live in the docs file; the factory appends its path to the message.

### Test the rule beside it

```ts
import { testLintRule } from "@mst/lint-rule-authoring";

import { noDefaultExport } from "./no-default-export--use-named-export.ts";

testLintRule(noDefaultExport, {
  valid: [{ name: "named export", code: "export const parseConfig = 1" }],
  invalid: [
    {
      name: "default export",
      code: "export default 1",
      errors: [{ messageId: "defaultExport" }],
    },
  ],
});
```

The file sits in the same directory as the rule, named `<rule-file>.test.ts`. The valid side must include the boundaries the rule is likely to misfire on; every invalid case names its expected messageId.

### Register the rule at error severity

```ts
import { LINT_SEVERITY } from "@mst/lint-rule-authoring";

rules: {
  ["dont-review-it/" + noDefaultExport.name]: LINT_SEVERITY.ERROR,
},
```

Fix every violation the new rule reports before merging it. Demoting to warn is a decision a human makes, never a default.

## Common Mistakes

### [HIGH] ParenthesizedExpression branch written in a rule

Wrong:

```ts
const unwrapped = (node) => (node.type === "ParenthesizedExpression" ? node.expression : node);
```

Correct:

```ts
const objectLiteralOf = (node) => (node.type === "ObjectExpression" ? node : null);
```

oxlint strips parentheses before handing the AST to js plugins, so the branch is unreachable; the type only mentions the node because the AST definition is shared with `oxc-parser`, where it does appear.

Source: masseater/mst:.claude/rules/ai-generated/gotchas.md

### [HIGH] report message carrying a reason or a branch

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

A reason pushes the fix instruction out of the first line, and a conditional fix returns the decision to the reader; both belong in the docs file the factory already points at.

Source: masseater/mst:packages/lint-rule-authoring/AGENTS.md

### [HIGH] new rule confirmed by print-config diff

Wrong:

```sh
vp lint --print-config | grep my-new-rule
```

Correct:

```sh
echo "export default 1" > src/wiring-probe.ts
vp lint src/wiring-probe.ts
rm src/wiring-probe.ts
```

`--print-config` never lists js plugin rules, so the diff around adding one is always empty; only a violating probe file proves the rule fires.

Source: masseater/mst:.claude/rules/ai-generated/gotchas.md

### [MEDIUM] rule added at warn severity

Wrong:

```ts
rules: { "dont-review-it/my-new-rule": "warn" },
```

Correct:

```ts
rules: { "dont-review-it/my-new-rule": LINT_SEVERITY.ERROR },
```

warn is defined as ignorable without asking a human, so a rule introduced at warn enforces nothing from its first day.

Source: masseater/mst:CLAUDE.md

### [MEDIUM] rule test isolated in a test directory

Wrong:

```text
tests/no-default-export.spec.ts
```

Correct:

```text
src/lint/oxlint/rules/no-default-export--use-named-export.ts
src/lint/oxlint/rules/no-default-export--use-named-export.test.ts
```

A test detached from its rule stops moving with it, and the placement rules report both the directory and the `.spec.ts` suffix.

Source: masseater/mst:packages/lint-rule-authoring/AGENTS.md

## See also

- `packages/dont-review-it/skills/core` — the preset that registers rules built with this factory, and how to verify the wiring.
