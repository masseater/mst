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
- Bundle: `testing`
- Source: [`forbid-test-adjacent-file--inline-its-setup-into-the-test.ts`](../../src/lint/oxlint/rules/testing/forbid-test-adjacent-file--inline-its-setup-into-the-test.ts)

<!-- END GENERATED rule-header -->

## Violation

A file whose name carries a test marker the repository does not run. The markers that put a file outside the production scope are `.fixture.`, `.mock.`, `.test.`, `.spec.`, `.stories.` and `.story.`; of those only `.test.` and `.spec.` name files the runner picks up, so a name carrying any of the others is reported on its Program node.

## Fix

Delete the file and declare what it held inside each test that used it. Setup repeated between tests is the state this bundle asks for.

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

- Renaming it to `.test.ts` while nothing in it is a test. The file then joins the suite as a spec with no claims
- Moving it under a directory the production scope already excludes. The content still sits outside every check

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
