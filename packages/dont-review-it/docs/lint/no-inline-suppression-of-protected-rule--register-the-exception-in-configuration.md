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
- Shipped in the preset: yes
- Source: [`no-inline-suppression-of-protected-rule--register-the-exception-in-configuration.ts`](../../src/lint/oxlint/rules/no-inline-suppression-of-protected-rule--register-the-exception-in-configuration.ts)

<!-- END GENERATED rule-header -->

## Violation

A rule declared as protected being disabled by a directive written in the code, or silenced by a severity in the configuration. The one place for an exception is a registration on the configuration side; every other way it disappears is reported.

The set of protected rules is settled by `protectedRules` and `unprotected`. The default is the twenty rules protecting "files that must not be placed" and "libraries that must not be reached", this rule included. The default lives on the library side, and what a consumer names is added to it.

Three families are read.

**Suppression directives.** In any file, comments whose opening token belongs to the `eslint-disable` / `oxlint-disable` families are read. The next-line, same-line and whole-file spellings, and the form whose range runs to an `eslint-enable`, all enter through the same way in at the opening comment.

- One naming a protected rule. One report per protected rule named. **It is reported even where grounds are written beside it**
- One naming no rule at all. A suppression naming nothing erases every rule over its range, so it covers the protected set too. One report

Names are matched after the last `/`, so a spelling with `dont-review-it/` and one without name the same rule. What appears in the report is the spelling the rule is registered under.

**The linter's configuration.** Only files whose name starts with `vite.config` and whose extension is `.ts`, `.mts`, `.cts`, `.js`, `.mjs` or `.cjs` are additionally read as configuration. The walk descends to the default-exported expression, and where that is wrapped in a function call, to its first argument. The value of `lint` is unwrapped the same way.

What is read from there is the protected rules written in `rules` and `overrides[].rules` that sit at a level not failing a run. `off`, `allow`, `warn` and numbers below 2 count, and for the `[level, options]` form the head is read, while for a member of a named constant the member name is read as the level.

Exactly one of those passes as an exception: **one placed in an override whose `files` lists complete paths, one per entry.** Any of these means it does not pass.

- A `files` entry containing any of `*`, `?`, `[`, `]`, `{`, `}`. That entry is named in the report
- No `files`, an empty `files`, or a `files` element this rule cannot read. Here the level itself is reported

**Registrations taking a rule out of the protected set.** Each entry in `unprotected` is read. An entry with an empty reason, and an entry naming this rule itself, do not hold as registrations and are reported at the head of the configuration file. **A registration that does not hold takes nothing out of the protected set.** While the report stands, suppressions of that rule keep being reported as before.

Files under a build-output location are read by none of the three families. Excluded by default are anything under `dist`, `coverage`, `node_modules`, `generated` or `__snapshots__`, and files ending in `.d.ts`. The judgment runs on the path relative to the repository root.

### The invariant

The first layer is that a suppression erases the check only where it is written, and the erasure does not appear in the check's output. The report count simply goes to zero, so from the side that added the prohibition, neither the suppression nor its growth can be observed.

The second layer is that a suppression and a configured exception differ completely in visibility. A suppression is one line, and in review only its surroundings are visible, so the judgment stays local. A configured exception appears as a diff in a shared part of the repository, where the judgment is exposed to the whole context. For the same act of "making an exception", the less visible route is always the one chosen. There is nothing to do but close it.

The third layer is that the protected rules themselves say, in their own sections, "write the exception in the configuration". The same sentence appearing over and over is evidence that a layer enforcing that demand is needed. Without one, the demand rests on the writer's goodwill.

Grounds written beside a suppression are not a way out because the second and third layers do not change with them. However well the reason is written, the place it is read stays the surroundings of that line.

A disablement written as a pattern does not pass as an exception because another file created later enters that exception without anybody's judgment. With complete paths listed one per entry, a configuration diff appears each time something enters.

### Configuration

- `protectedRules` (a list of strings, optional): rule names **added** to the protected set. The twenty defaults remain
- `unprotected` (a list of `{ rule, reason }`, optional): registrations taking a rule out of the protected set. An entry with an empty `reason`, and an entry naming this rule itself, do not hold as registrations and are reported
- `generatedPaths` (a list of strings, optional): the places skipped as build output. Written as globs against paths relative to the repository root. Added to the default
- `suppressionSpellings` (a list of strings, optional): suppression directive spellings added to the defaults. Added spellings are read as holding over the whole file

```jsonc
[
  "error",
  {
    "unprotected": [
      {
        "rule": "forbid-tracked-path--untrack-and-ignore",
        "reason": "a separate CI job holds the tracking judgment",
      },
    ],
  },
]
```

There is no list of "rules that may be suppressed". Hold one and whether a suppression is allowed returns to a per-rule judgment.

### Where the detection does not reach

A configuration reached through `extends`, a level given as a CLI argument, and an operation that never starts the linter are invisible from reading `vite.config` alone. The report about registrations that do not hold also has no position, and so does not come out, where this rule's configuration is not written in `vite.config`.

Configuration written in JSON or YAML, and the suppression forms written there, do not enter this rule's input. Holding the same invariant on those hosts needs a separate receiver.

Suppression spellings the analyser adds in future are not detected until they are added to `suppressionSpellings`. That lag is invisible to every other check, so **treat the list of suppression forms as something to revisit when the analyser's version is raised.**

Which rules are protected is written by a person. The default is twenty, and taking one out needs a release entry carrying a reason.

### Its relationship with no-silent-suppression--fix-or-justify-inline

[no-silent-suppression--fix-or-justify-inline](./no-silent-suppression--fix-or-justify-inline.md) forbids the reports of the rule group protecting "no declaration stands in two places" from disappearing silently, and leaves a line-scoped suppression carrying grounds as a way out. What this rule reads is whether a suppression is permissible at all. Against a protected rule, neither line scope nor grounds passes.

One rule sits in both sets (`forbid-target-file--delete-or-relocate`). A line-scoped suppression of it carrying grounds passes the former and is stopped here. The overlap is intended, and the stricter one is the conclusion.

`no-broad-lint-disable--use-next-line-with-reason` in [@mst/lint-rule-authoring](../../../lint-rule-authoring/src/lint/oxlint/rules/no-broad-lint-disable--use-next-line-with-reason.ts) reports the spelling of any suppression holding wider than a line, whatever the rule. All three can fire on one comment.

## Fix

Fix it. That is the first option.

Where there is a reason it cannot be fixed, register the exception in the configuration and write the reason. Two shapes of registration.

To except that one file, add an entry to `overrides`, list the complete path of each target file in `files`, and lower the protected rule's level there. Do not write it as a pattern covering the workspace or a directory.

To take the rule out of the protected set, add an entry to `unprotected` with the reason in `reason`. Writing what makes that rule different from the others, and what would have to happen for that circumstance to disappear, is enough. An entry with no reason does not hold as a registration, and the target stays protected.

This rule itself cannot be taken out through `unprotected`. An entry trying to is reported, and the protection remains.

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

- Silencing a whole range with a suppression that names no rule. Omit the names thinking only named prohibitions are detected, and everything the range covers becomes the target of the report
- Taking a row out of the protected list without writing a reason. A release entry with an empty reason is not treated as a registration
- Moving the file carrying the suppression to a path treated as build output. Only the destination looks like build output; not one line of code has been fixed
- Writing an exception's `files` as a pattern so that files added later enter the exception silently
- Escaping the level or `files` into a variable outside the configuration file. Where the expression cannot be read, this rule does not accept it as an exception and reports the level itself
- Deleting a protected rule's name from `protectedRules`. The default does not shrink from what a consumer names, so shrinking it appears in the diff as a release entry

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
