---
name: core
description: >
  Write specification tests with @mst/verified-specifications: declare behavior claims in `specs/<feature>.spec.ts` with a string-literal top-level `describe` and one `it` per claim, keep coverage exercises out of `specs/` as `<source>.test.ts` beside their source, leave the workspace tsconfig unnarrowed so `specs/` stays type-checked, and regenerate every `SPECIFICATIONS.md` with `verified-specifications check --write`. Load when writing a spec test, when a SPECIFICATIONS.md is reported stale or orphaned, when a claim is reported for a computed name or a narrowed `describe.each` / `it.only`, or when deciding whether a test is a specification claim or a coverage test.
metadata:
  type: core
  library: "@mst/verified-specifications"
  library_version: "0.0.0"
sources:
  - "masseater/mst:packages/verified-specifications/src/run-cli.ts"
  - "masseater/mst:packages/verified-specifications/src/extract/claims.ts"
  - "masseater/mst:packages/verified-specifications/AGENTS.md"
---

# @mst/verified-specifications — write specification tests

The source of truth for a specification is the specification test. The check parses every `specs/*.spec.ts`, extracts the claims, and generates each workspace's `SPECIFICATIONS.md` from them — so a human reads what the tests actually verify, and catches a wrong interpretation as a diff in a pull request rather than by reading the implementation.

Because the list is assembled without running the tests, everything it needs must be readable from the source text alone.

## requires

- **Claims written where the reader will read them.** The extractor takes the string literals as they are and puts them straight into the generated list; it has no opinion about their language. Whoever reviews `SPECIFICATIONS.md` decides that — this repository writes them in Japanese.

## Setup

```sh
pnpm exec verified-specifications check --repository-root .
```

The command reports every place where the structure cannot be read or a `SPECIFICATIONS.md` disagrees with the tests, and exits non-zero. Regenerate the documents from the tests with:

```sh
pnpm exec verified-specifications check --write
```

`--write` also deletes a `SPECIFICATIONS.md` whose `specs/` directory is gone, because a list nothing verifies goes on promising behavior.

## Core Patterns

### Declare a behavior claim

A claim lives in `specs/<feature>.spec.ts` at the package root — one flat directory, matched as `specs/*.spec.{ts,tsx}`. The top-level `describe` names the subject; each `it` directly under it is one claim sentence.

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

Claims describe behavior a user of the package can see — one level outside a unit test, inside an end-to-end test.

### Decide which kind of test you are writing

If the test failing would mean a specification was violated, it is a specification test and belongs in `specs/`. If it exists to walk a branch for the coverage floor, it is a coverage test and belongs beside its source as `<source>.test.ts`. Every execution placed in `specs/` becomes a line a human reads as a promise.

### Keep `specs/` inside the type check

```json
{
  "extends": "@mst/dont-review-it/tsconfig/library.json"
}
```

A workspace holding spec tests must not narrow its tsconfig with `include`, `files`, or `exclude`. The check reports the narrowing keys by name.

## Common Mistakes

### [HIGH] SPECIFICATIONS.md edited by hand

Wrong:

```markdown
- 規範が表の行として書かれていれば報告する（手で追記）
```

Correct:

```sh
pnpm exec verified-specifications check --write
```

The list is rendered from the tests and compared as whole text, so a hand-written line is reported stale on the next check and erased by the next `--write` — and until then it reads exactly like a claim something verifies.

Source: masseater/mst:packages/verified-specifications/AGENTS.md

### [HIGH] a spec workspace tsconfig narrowed by include

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

Narrowing `include` drops `specs/` from type checking without removing it from the test run, so the claims keep appearing in the generated list while the code they call is free to change shape underneath them.

Source: masseater/mst:packages/verified-specifications/AGENTS.md

### [MEDIUM] a claim written with a computed name

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

The extractor reads string literals from the source text and never runs the file, so a computed name resolves to nothing it can put in the list — the test still passes, and the claim it verifies is simply absent from what the human reviews.

Source: masseater/mst:packages/verified-specifications/src/extract/claims.ts

### [MEDIUM] a runner narrowed through a member

Wrong:

```ts
describe("規範文書の検査", () => {
  it.each(["表", "見出し"])("%s を報告する", () => {});
});
```

Correct:

```ts
describe("規範文書の検査", () => {
  it("規範が表の行として書かれていれば報告する", () => {});
  it("規範が見出しとして書かれていれば報告する", () => {});
});
```

`each`, `skip`, and `only` make the claim run in variants or not at all, and neither reads as one plain sentence about the subject; the check reports any `describe` or `it` reached through a member.

Source: masseater/mst:packages/verified-specifications/src/extract/claims.ts

### [MEDIUM] a coverage exercise placed in specs/

Wrong:

```text
specs/read-json-file.spec.ts
```

Correct:

```text
src/read-json-file.test.ts
```

An execution that is not a claim still becomes a bullet in the generated list, so the document a human reviews for the promises the package makes fills up with internal module details that no user can observe.

Source: masseater/mst:packages/verified-specifications/AGENTS.md

### [MEDIUM] a subject left with no claims under it

Wrong:

```ts
describe("規範文書の検査", () => {
  beforeEach(() => {
    resetFixtures();
  });
});
```

Correct:

```ts
describe("規範文書の検査", () => {
  it("規範が表の行として書かれていれば報告する", () => {});
});
```

A `describe` with no `it` under it renders as a heading with nothing beneath, which reads as a subject whose claims were lost rather than one that was never written.

Source: masseater/mst:packages/verified-specifications/src/extract/claims.ts

## Reference

```
what the check reads
specs/*.spec.{ts,tsx}    the only files scanned, flat under the package root
parse                    the file must parse as TypeScript; it is never executed
top-level describe       a spec file without one is reported
subject name             a plain string literal, first argument of describe
claim name               a plain string literal, first argument of it
it, not test             test is reported with the instruction to replace it
plain runners            describe.each / it.skip / it.only are reported
non-empty subjects       a describe with no it under it is reported
tsconfig scope           include / files / exclude in a workspace holding specs
SPECIFICATIONS.md        compared as whole text against the render; --write rewrites it
orphan document          a SPECIFICATIONS.md with no specs/ left; --write deletes it
```

## See also

- `packages/dont-review-it/skills/core` — the preset that switches the test-file spelling to `.spec.ts` inside `specs/` and lifts the source-adjacency requirement there.
- `packages/dont-review-it/skills/repository-checks` — the same single-entry, non-zero-exit gate discipline; a guard run calls both CLIs.
