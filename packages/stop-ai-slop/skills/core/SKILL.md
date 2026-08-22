---
name: core
description: >
  Stop absence checks that only fossilize a removal, with @mst/stop-ai-slop: run stop-ai-slop check to compare the change on its way into the integration branch and report every assertion that was added in the same change that deleted its subject. Load when a check reports a removal verification, when adding a check to the registry, or when deciding which two revisions the comparison should use.
metadata:
  type: core
  library: "@mst/stop-ai-slop"
  library_version: "0.0.0"
sources:
  - "masseater/mst:packages/stop-ai-slop/src/comparison-range.ts"
  - "masseater/mst:packages/stop-ai-slop/AGENTS.md"
---

# @mst/stop-ai-slop — stop the checks that only restate a removal

A change that deletes a file or an export sometimes gains a test that pins the absence of what it just deleted. Read on its own, that assertion is indistinguishable from an ordinary negative one, so the check reads the change instead: it reports an absence assertion only when the same change removed its subject.

## Setup

```sh
vp exec stop-ai-slop check
```

Without revisions the command compares the change on its way into the integration branch: the branch being merged while a merge is in progress, and the history since it left `origin/main` otherwise.

Name both ends when the comparison is something else:

```sh
vp exec stop-ai-slop check --base <revision> --head <revision>
```

## Core Patterns

### Delete an export without pinning its absence

Delete the export and the code that used it. Nothing else is required; the deletion itself is the record.

```ts
// src/legacy.ts
export const current = true;
```

### Add a check to the registry

A new check is a `SlopCheck` registered in `src/check-registry.ts`. The order of the list is the order the checks run and the first order of the output. No new subcommand is added for it.

```ts
export const CHECKS: readonly SlopCheck[] = [noRemovalVerification];
```

## Common Mistakes

### [HIGH] absence assertion added with the deletion

Wrong:

```ts
import * as legacy from "./legacy.ts";

expect(legacy).not.toHaveProperty("legacyMode");
```

Correct:

```ts
import { current } from "./legacy.ts";

expect(current).toBe(true);
```

The assertion can only fail if someone re-adds the export the same change removed, and the surface is already machine-enforced elsewhere. Delete the assertion instead of keeping a test that restates the deletion.

Source: masseater/mst:packages/stop-ai-slop/AGENTS.md

### [MEDIUM] suppressing a report instead of removing the assertion

Wrong:

```ts
expect(legacy).not.toHaveProperty(String("legacyMode"));
```

Correct:

```ts
// the assertion is gone
```

Reshaping the assertion until the locator cannot be recovered removes the report, not the problem. The command has no allowlist, severity, or ignore option for this reason.

Source: masseater/mst:packages/stop-ai-slop/AGENTS.md

### [MEDIUM] comparing revisions the caller guessed

Wrong:

```sh
pnpm exec stop-ai-slop check --base HEAD~1 --head HEAD
```

Correct:

```sh
vp exec stop-ai-slop check
```

`HEAD~1` is the previous commit, not the point the change left the integration branch, so a branch with more than one commit reports only its last step. Let the command resolve the range, or name a merge base.

Source: masseater/mst:packages/stop-ai-slop/src/comparison-range.ts

## See also

- `packages/dont-review-it/skills/repository-checks` — the same single-entry, nonzero-exit gate discipline; guard runs both CLIs.
