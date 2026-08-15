---
name: core
description: >
  Stop absence checks that only fossilize a removal, with @mst/stop-ai-slop: `stop-ai-slop check` compares the change on its way into the integration branch — the staged merge result during a merge, the history since `origin/main` otherwise — and reports every assertion added by the same change that deleted its subject. `--base` and `--head` name the ends explicitly and `--repository-root` picks the repository. Load when a report names a removal verification, when adding a check to `src/check-registry.ts`, when deciding which two revisions the comparison should use, or when the command reports nothing because no comparison could be resolved.
metadata:
  type: core
  library: "@mst/stop-ai-slop"
  library_version: "0.0.0"
sources:
  - "masseater/mst:packages/stop-ai-slop/src/comparison-range.ts"
  - "masseater/mst:packages/stop-ai-slop/src/check-registry.ts"
  - "masseater/mst:packages/stop-ai-slop/AGENTS.md"
---

# @mst/stop-ai-slop — stop the checks that only restate a removal

A change that deletes a file or an export sometimes gains a test pinning the absence of what it just deleted. Read on its own, that assertion is indistinguishable from an ordinary negative one — which is why the check reads the change instead of the file, and reports an absence assertion only when the same change removed its subject.

Only facts that are decidable from the two revisions are in scope. The commit message, the request that prompted the change, and any resemblance between names are not consulted.

## requires

- **A resolvable comparison.** Without `--base` and `--head`, the range comes from `MERGE_HEAD` while a merge is in progress, and otherwise from the merge base of `origin/main` and `HEAD`. In a repository with no `origin/main` and no merge underway there is nothing to compare, so run it where the integration branch is fetched or name both ends yourself.
- **Git readable from the process.** A failure to read the parser, git, a revision, or a source is reported as a usage error and stops the run; an unreadable change is never counted as a clean one.

## Setup

```sh
pnpm exec stop-ai-slop check
```

Without revisions the command compares the change on its way into the integration branch: during a merge, the merge base of `HEAD` and `MERGE_HEAD` against the staged result; otherwise the merge base of `origin/main` and `HEAD` against `HEAD`.

Name both ends when the comparison is something else:

```sh
pnpm exec stop-ai-slop check --base <revision> --head <revision>
```

Wire it into the one script CI and the hooks already call, beside the other gates:

```json
{
  "scripts": {
    "guard": "vp check && vp run -r test --coverage && vp exec stop-ai-slop check"
  }
}
```

## Core Patterns

### Delete an export without pinning its absence

Delete the export and the code that used it. The deletion is the record; nothing else is required.

```ts
// src/legacy.ts
export const current = true;
```

### Add a check to the registry

A new check is a `SlopCheck` — an `id` and a `run` that takes the comparison and returns problems — added to the ordered list in `src/check-registry.ts`. The list order is the order the checks run and the first order of the output. No subcommand is added for it.

```ts
export const CHECKS: readonly SlopCheck[] = [noRemovalVerification, myNewCheck];
```

### Relate a removal to an addition through a static locator

A new check reports only when it can tie something the change removed to something the change added, by a locator both sides recover from the source text. When the locator cannot be fully recovered, the check stays silent rather than matching on a name — two modules can share a name, and so can a name and a string in a sentence.

## Common Mistakes

### [HIGH] an absence assertion added with the deletion

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

The assertion can only fail if someone re-adds the export the same change removed, so it passes forever while reading, to every later reviewer, as a rule the codebase depends on.

Source: masseater/mst:packages/stop-ai-slop/AGENTS.md

### [MEDIUM] a report suppressed by reshaping the assertion

Wrong:

```ts
expect(legacy).not.toHaveProperty(String("legacyMode"));
```

Correct:

```ts
// the assertion is deleted
```

Hiding the name behind an expression the locator cannot recover removes the report, not the assertion — and the command has no allowlist, severity, or ignore option precisely so that this is the only way to make one disappear without deleting anything.

Source: masseater/mst:packages/stop-ai-slop/AGENTS.md

### [MEDIUM] revisions guessed instead of resolved

Wrong:

```sh
pnpm exec stop-ai-slop check --base HEAD~1 --head HEAD
```

Correct:

```sh
pnpm exec stop-ai-slop check
```

`HEAD~1` is the previous commit, not the point the change left the integration branch, so a branch with more than one commit is examined over its last step only — the run succeeds, reports nothing, and every earlier commit's additions go unread.

Source: masseater/mst:packages/stop-ai-slop/src/comparison-range.ts

### [MEDIUM] a new check published as its own subcommand

Wrong:

```ts
defineCommand({ subCommands: { check, "check-removals": checkRemovals } });
```

Correct:

```ts
export const CHECKS: readonly SlopCheck[] = [noRemovalVerification, checkRemovals];
```

`check` is the only entry, and it runs the registry in definition order; a check reachable only through a second subcommand exists without running until every caller has been updated to name it — and nobody is told that they should.

Source: masseater/mst:packages/stop-ai-slop/AGENTS.md

## Reference

```
stop-ai-slop check           the only command; runs every registered check in definition order
--base <revision>            revision before the change; requires --head
--head <revision>            revision after the change; requires --base
--repository-root <path>     defaults to the current working directory

default range, merge in progress    merge-base(HEAD, MERGE_HEAD) .. the staged tree
default range, otherwise            merge-base(origin/main, HEAD) .. HEAD
exit                                non-zero as soon as one problem is reported
```

There is no allowlist, no severity, and no ignore option. A construct that misfires is removed from what the check detects, keeping the decidable boundary narrow instead of adding a way to wave a report through.

## See also

- `packages/dont-review-it/skills/repository-checks` — the same single-entry, non-zero-exit gate discipline; a guard run calls both CLIs.
