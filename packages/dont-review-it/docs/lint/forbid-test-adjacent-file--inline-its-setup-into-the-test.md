---
description: "Disallow a file whose name carries a test marker other than the two the repository runs, so no file can leave the production scope by the way it is spelled"
---

# forbid-test-adjacent-file--inline-its-setup-into-the-test

<!-- BEGIN GENERATED rule-header -->

Disallow a file whose name carries a test marker other than the two the repository runs, so no file can leave the production scope by the way it is spelled

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: no
- Shipped in the preset: yes
- Source: [`forbid-test-adjacent-file--inline-its-setup-into-the-test.ts`](../../src/lint/oxlint/rules/forbid-test-adjacent-file--inline-its-setup-into-the-test.ts)

<!-- END GENERATED rule-header -->

## Violation

A file whose name carries a marker that puts it outside the production scope while being neither of the two the repository actually runs, `.test.` and `.spec.`.

The markers are `.fixture.`, `.mock.`, `.test.`, `.spec.`, `.stories.` and `.story.`, and each may carry any number of further words separated by `.` or `-`. A file matching one of them is taken to be something other than a production source: the two rules that read finite value vocabularies hold it out of reach, and so does the rule that reads duplicated declaration bodies.

Of those, only the ones ending in `.test.<extension>` or `.spec.<extension>` are tests. Everything else is reported. `order.test-fixture.ts` matches `.test.` and so leaves the production scope, while it is not spelled as a test, and it is reported here.

Directory names are not read. `fixtures/order.ts` is out of this rule's reach.

### The invariant

What settles whether a file is in the production scope is its name. Spell a file like a test and it leaves the lint's reach and becomes hard for `knip` to see. With both happening at once, a place that cannot meet the guidelines can be created out of a spelling alone.

`canonical-values.test-fixture.ts` was once placed exactly that way in this repository. `.test-fixture.` matches the out-of-production judgment and misses the is-a-test judgment: a name landing in the gap between two classifiers, where a shared helper for tests sat without being checked by anything.

There are two places for tests and no others. What holds coverage up goes beside its source as `<source name>.test.ts`; what holds a specification up goes directly under the package as `specs/<feature>.spec.ts`. Any other spelling either adds a third place or dodges a check.

No option is offered. Widening the accepted spellings through configuration would hand back the very channel — leaving the scope by spelling — that this rule closes.

## Fix

Delete the reported file and declare what it held inside each test that uses it.

Test setup is allowed to look alike across tests. Not sharing it keeps tests from coupling, so rewriting one never stops another from running. Only writing the same test in several places is forbidden, by [no-duplicated-test--delete-the-copy](./no-duplicated-test--delete-the-copy.md).

Where the contents were needed as production code, drop the test marker from the name and place it as a production source. It comes under the lint from that point on.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a test marker carrying a further suffix is reported
// in /repository/src/order.test-fixture.ts
export const total = 1;
```

```ts
// a fixture spelling is reported
// in /repository/src/order.fixture.ts
export const total = 1;
```

Code this rule accepts.

```ts
// the test spelling the runner picks up passes
// in /repository/src/order.test.ts
export const total = 1;
```

```ts
// a directory named after tests leaves the file name alone
// in /repository/fixtures/order.ts
export const total = 1;
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Hunting for another gap between the classifiers by changing the spelling. `.test-helper.` and `.spec-support.` are reported the same way
- Naming the directory `__fixtures__` or `fixtures` to keep the marker out of the file name. The out-of-scope judgment by directory still stands, and what is placed there is reported by [no-detached-test-file--move-beside-source](./no-detached-test-file--move-beside-source.md)
- Adding an exclusion to the `knip` configuration to silence the unused report alone. A place that nothing checks is still there

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `testAdjacentFile` | A file name must not carry a test marker other than \`.test.\` or \`.spec.\`. Delete \`{{fileName}}\` and declare what it holds inside each test that uses it. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads no options. A consumer turns it on or off as a whole.

<!-- END GENERATED runtime -->
