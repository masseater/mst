---
description: "Disallow silencing a protected rule from a comment in the source or from a severity the lint configuration lowers, so an exception to one of these rules stands as one registered entry carrying the grounds somebody wrote for it"
---

# no-inline-suppression-of-protected-rule--register-the-exception-in-configuration

<!-- BEGIN GENERATED rule-header -->

Disallow silencing a protected rule from a comment in the source or from a severity the lint configuration lowers, so an exception to one of these rules stands as one registered entry carrying the grounds somebody wrote for it

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: yes
- Bundle: `governance`
- Source: [`no-inline-suppression-of-protected-rule--register-the-exception-in-configuration.ts`](../../src/lint/oxlint/rules/governance/no-inline-suppression-of-protected-rule--register-the-exception-in-configuration.ts)

<!-- END GENERATED rule-header -->

## Violation

A protected rule silenced anywhere but a registered exception. Three families are read.

- A suppression comment naming a protected rule, reported once per rule named, grounds or no grounds. One naming no rule covers the whole protected set and is reported once
- A protected rule held in the lint configuration at a level that does not fail a run. Exactly one shape passes: an override whose `files` lists complete paths, one per entry. A pattern among them, an absent or unreadable `files`, and the level standing outside an override are each reported
- An `unprotected` entry that carries no reason, or that names this rule itself. Such an entry takes nothing out of the protected set

`protectedRules` adds to the rule's own list, `generatedPaths` adds to the build-output locations skipped, and `suppressionSpellings` adds directive spellings read as covering a whole file. Only the repository's `vite.config` file is read as configuration.

## Fix

Rewrite the code the rule reports. Where an exception is genuinely needed, add an override listing the complete path of every file it covers and lower the rule there, or take the rule out of the protected set with an `unprotected` entry stating the grounds.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a next-line suppression naming a protected rule is reported
// oxlint-disable-next-line forbid-target-file--delete-or-relocate
export const total = 1;
```

```ts
// grounds do not make a suppression of a protected rule acceptable
// oxlint-disable-next-line forbid-target-file--delete-or-relocate -- the generator writes this file
export const total = 1;
```

Code this rule accepts.

```ts
// re-enabling a rule is not a suppression
// oxlint-enable forbid-target-file--delete-or-relocate
export const total = 1;
```

```ts
// a suppression naming only rules outside the protected set is another rule's business
// oxlint-disable-next-line no-console -- the bootstrap has no logger yet
console.log(1);
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Writing grounds beside the suppression. Against a protected rule neither scope nor grounds passes
- Writing the exception's `files` as a pattern, so files added later enter it silently
- Moving the file to a path treated as build output. Only the destination looks like build output

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `namedSuppression` | A \`{{spelling}}\` comment must not name \`{{ruleName}}\`, a rule this package protects. Rewrite the code that rule reports, or register the exception in the lint configuration together with the grounds for it. |
| `blanketSuppression` | A \`{{spelling}}\` comment that names no rule covers every rule this package protects, and must not stand in the source. Rewrite the code those rules report, or register the exception in the lint configuration together with the grounds for it. |
| `weakenedProtectedRule` | A lint configuration must not hold \`{{ruleName}}\`, a rule this package protects, at \`{{severity}}\`. Set it to \`error\`, or move the exception into an override that lists the complete path of every file it covers together with the grounds for it. |
| `patternScopedException` | An override holding \`{{ruleName}}\` at \`{{severity}}\` must not take its scope from the pattern \`{{pattern}}\`. Replace that pattern with the complete path of every file this exception covers. |
| `groundlessDeviation` | A deviation must not take \`{{ruleName}}\` out of the protected list without grounds. Write into that entry what makes the rule an exception, or delete the entry. |
| `selfDeviation` | A deviation must not take \`{{ruleName}}\` out of the protected list. Delete that entry and rewrite the code this rule reports. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
