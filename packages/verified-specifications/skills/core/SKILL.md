---
name: core
description: >
  Write specification tests with @mst/verified-specifications: declare
  behavior claims in specs/<feature>.spec.ts with a string-literal top-level
  describe and it sentences, keep coverage tests separate as
  <source>.test.ts, and regenerate SPECIFICATIONS.md with
  verified-specifications check --write. Load when writing a spec test,
  when SPECIFICATIONS.md is reported stale, or when deciding whether a test
  is a specification claim or a coverage test.
metadata:
  type: core
  library: "@mst/verified-specifications"
  library_version: "0.0.0"
sources:
  - "masseater/mst:packages/verified-specifications/src/run-cli.ts"
  - "masseater/mst:packages/verified-specifications/AGENTS.md"
---

# @mst/verified-specifications — write specification tests

The source of truth for a specification is the specification test. The
check extracts every claim from `specs/*.spec.ts` and generates each
workspace's `SPECIFICATIONS.md`, so a human can read what the AI believes
the code promises and catch a wrong interpretation in a PR diff.

## Setup

```sh
pnpm exec verified-specifications check --repository-root .
```

Regenerate every `SPECIFICATIONS.md` from the tests:

```sh
pnpm exec verified-specifications check --write
```

## Core Patterns

### Declare a behavior claim

A claim lives in `specs/<feature>.spec.ts` at the package root. The
top-level `describe` names the subject; each `it` directly under it is one
claim sentence, written in Japanese for the reader of the generated list.

```ts
import { describe, expect, it } from "vite-plus/test";

import { runChecks } from "../src/run-checks.ts";

describe("規範文書の検査", () => {
  it("規範が表の行として書かれていれば報告する", async () => {
    const problems = await runChecks({ repositoryRoot: fixtureRoot, write: false });
    expect(problems).not.toStrictEqual([]);
  });
});
```

Claims describe behavior visible to the package's user — one level outside
unit tests, inside e2e.

### Decide which kind of test to write

If the test failing would mean a specification was violated, it is a
specification test and belongs in `specs/`. If it only exists to walk a
branch for the coverage floor, it is a coverage test and belongs beside its
source as `<source>.test.ts`.

## Common Mistakes

### [HIGH] SPECIFICATIONS.md edited by hand

Wrong:

```markdown
<!-- SPECIFICATIONS.md -->

- 規範が表の行として書かれていれば報告する（手で追記）
```

Correct:

```sh
pnpm exec verified-specifications check --write
```

The list is generated from the tests; a hand edit disagrees with the
extraction on the next check and the next `--write` erases it.

Source: masseater/mst:packages/verified-specifications/AGENTS.md

### [MEDIUM] claim written with a computed name

Wrong:

```ts
const subject = "規範文書の検査";
describe(subject, () => {
  it(`${subject}は表を報告する`, () => {});
});
```

Correct:

```ts
describe("規範文書の検査", () => {
  it("規範が表の行として書かれていれば報告する", () => {});
});
```

The extractor reads string literals; a computed name cannot be read and
the structure check reports it.

Source: masseater/mst:packages/verified-specifications/src/run-cli.ts

### [MEDIUM] coverage exercise placed in specs/

Wrong:

```text
specs/read-json-file.spec.ts
```

Correct:

```text
src/read-json-file.test.ts
```

An execution that is not a claim dilutes the generated list a human reads;
internal-module details are not specifications.

Source: masseater/mst:packages/verified-specifications/AGENTS.md

### [MEDIUM] spec workspace tsconfig narrowed by include

Wrong:

```json
{
  "extends": "@mst/dont-review-it/tsconfig/library.json",
  "include": ["src"]
}
```

Correct:

```json
{
  "extends": "@mst/dont-review-it/tsconfig/library.json"
}
```

Narrowing `include` silently drops `specs/` from type checking, so the
check stays green while the claims rot; the tsconfig check reports the
narrowing keys in a workspace that holds spec tests.

Source: masseater/mst:packages/verified-specifications/AGENTS.md

## See also

- `packages/dont-review-it/skills/repository-checks` — the same
  single-entry, nonzero-exit gate discipline; guard runs both CLIs.
