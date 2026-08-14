---
description: "Require every authored path to sit inside a check this repository declares, and every registration row to sit inside the check that consumes it, so a check that opens nothing is reported instead of passing for a check that found nothing"
---

# no-unchecked-authored-path--include-it-in-every-declared-check

<!-- BEGIN GENERATED rule-header -->

Require every authored path to sit inside a check this repository declares, and every registration row to sit inside the check that consumes it, so a check that opens nothing is reported instead of passing for a check that found nothing

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: yes
- Shipped in the preset: yes
- Source: [`no-unchecked-authored-path--include-it-in-every-declared-check.ts`](../../src/lint/oxlint/rules/no-unchecked-authored-path--include-it-in-every-declared-check.ts)

<!-- END GENERATED rule-header -->

## Violation

The ranges the repository's declared checks cover are reconciled against each row of the repository's registers, and wherever either side fires at nothing it is reported. File contents are not read. There are three inputs: the list of authored-surface paths obtained by walking the working tree, the range each check declares in `declaredChecks`, and the rows held by `registries`, `uncheckedDeclarations` and `scopeRegistrations`.

Where `declaredChecks` is empty there is nothing to reconcile against, and this rule reports nothing.

The authored surface is defined by the walk itself. Anything under a directory listed in `unscannedDirectories` (by default `.cache`, `.git`, `coverage`, `dist`, `dist-ssr`, `node_modules`) does not enter the walk, so dependencies, build output and caches are out of scope from the start. That adding an exclusion shrinks the authored surface is intended; a swelling exclusion list is read as a signal that the definition of the authored surface has drifted.

Four kinds of report, distinguished by their opening sentence.

### A hole in the coverage

An authored-surface path entering no check's range and declared read by no check. Reported as `uncheckedAuthoredPath`.

Whether a check opens that path is settled by hitting `coveredPaths` and not hitting `excludedPaths`. The same path entering several checks is no problem: overlap is defence, not a hole.

`uncheckedDeclarations` are the rows declaring "no check reads this", paired as a pattern and a reason. Where a file kind nobody declared appears, a machine cannot settle whether the declaration was forgotten or the inclusion was, so it is reported as a hole in the coverage. A person makes the judgment, and the result stays as a row.

Declarations may be written only as an extension (`**/*.md`, where the last segment is `*.<extension>`) or as a concrete path carrying no wildcard. A form covering a whole directory such as `docs/**` is reported as `broadUncheckedDeclaration`. Allow directory-level declarations and nothing placed in that directory afterwards produces a report, so the declaration exempts not "the kinds standing here now" but whatever gets placed later.

### A registration row that does not reach

A register's row hitting a path that exists, where the check consuming that row (`consumedBy`) opens not one of those paths. Two reports.

- `excludedRegistration`: the check's `excludedPaths` takes that path out. Both the row and the intersecting exclusion are printed
- `unopenedRegistration`: the check's `coveredPaths` never contained that path. Both the row and the range that check opens are printed

Print only one and whether to move the row or drop the exclusion is unsettled. That is why both are printed.

Where a row hits not one path, nothing is reported. A prohibition row firing at nothing is the correct state of "there is nothing to prohibit", and it is distinguishable from a row that does not reach.

### A dead row

A row in `allowances` and a row in `uncheckedDeclarations` matching not one existing file. Reported as `deadRegistration`.

Rows that permit, except or release presume their target exists. Leave the row after the target is gone and an exemption nobody intended revives the next time a file of that name appears. The direction is the reverse of a prohibition row, so the meaning of firing at nothing is reversed too.

Receiver names are read the same way. Where a name given in `consumedBy` or a row's `receivers` matches none of `declaredChecks`, it is reported as `undeclaredReceiver`. A record naming a delegate becomes a delegation only once that receiver exists.

### A gap in a scope registration

`scopeRegistrations` holds the range of a check that runs only inside registered paths. Where a file reachable from a registered file by a relative specifier is not registered, it is reported as `unregisteredScopeReach`. Reach is followed transitively and cycles are cut with a visited set. Both the reaching file and the reached file are printed.

Where the destination lies outside the authored surface, nothing is reported: it is not something that can be registered.

### Where the report stands

Reports divide into those carrying a path and those not. Those carrying a path (a coverage hole, a registration row that does not reach, a gap in a scope registration) stand on the workspace owning that path, and come out when that workspace's files are checked. Those carrying no path (a dead row, a receiver that does not exist, a declaration covering a whole directory) stand at the repository root.

### The invariant

What is observed is a violation getting through while every check is green.

The first layer is that the range is settled by configuration, and a check answers "no violation" about a file outside its range. "It was out of range" and "there was no violation" have exactly the same shape in the output, and the information telling them apart does not exist on the check's side.

The second layer is that holes in the range arise from an accumulation of legitimate additions. Several settings decide the range and are updated for different purposes at different times. Ignore patterns are added for speed, exclusion lists for build products. Each addition has a reason on its own, so it does not close by stopping additions. The resulting coverage has to be checked instead.

The third layer is that a design pushing prohibitions out into configuration tables presumes those rows actually hold. Whoever added a row meant to prohibit something, and if that row sits on a check that does not reach, not one report comes out. Without checking the premise, pushing it out is not safety but the appearance of safety.

### Configuration

- `declaredChecks` (an array, default empty): the checks this reconciliation knows about. `name` is the name printed in reports and the name a row may give as a receiver. `coveredPaths` and `excludedPaths` are globs from the repository root, and a path hitting `excludedPaths` is treated as one that check does not open
- `registries` (an array, default empty): the registers. `consumedBy` is the name of the check that reads that register. `rows` are prohibition rows, read for reachability. `allowances` are permission, exception and release rows, read for the existence of matching files. Both kinds require `pattern` and `reason`, and may carry delegate names in `receivers`
- `uncheckedDeclarations` (an array, default empty): the rows declaring no check reads them. `pattern` and `reason` are required
- `scopeRegistrations` (an array, default empty): the range of a check running only inside registered paths. Read for whether every file reachable from `registeredPaths` by a relative specifier is registered
- `unscannedDirectories` (a list of strings, optional): the directory names that do not enter the walk. Naming it **replaces** the default

```jsonc
[
  "error",
  {
    "declaredChecks": [
      { "name": "the type check", "coveredPaths": ["**/*.ts", "**/*.tsx"] },
      {
        "name": "the analyser",
        "coveredPaths": ["**/*.ts", "**/*.tsx"],
        "excludedPaths": ["**/*.d.ts"],
      },
      { "name": "the package manager", "coveredPaths": ["**/package.json"] },
    ],
    "registries": [
      {
        "name": "the forbidden paths",
        "consumedBy": "the analyser",
        "rows": [{ "pattern": "**/*.js", "reason": "sources are authored in TypeScript" }],
        "allowances": [
          {
            "pattern": "tools/vendor/shim.js",
            "reason": "the shim ships as JavaScript",
            "receivers": ["the type check"],
          },
        ],
      },
    ],
    "uncheckedDeclarations": [
      { "pattern": "**/*.yaml", "reason": "the workspace list is read by the package manager" },
    ],
    "scopeRegistrations": [
      { "name": "the bootstrap zone", "registeredPaths": ["tools/bootstrap/**/*.ts"] },
    ],
  },
]
```

Per-row exemptions are not writable in the configuration. An exemption stays as one row of `uncheckedDeclarations` carrying a reason, and is reported as a dead row once its target disappears. Give it a route for silencing reports individually and exemptions stay with neither a reason nor a deadline.

### Where the detection does not reach

- Whether each check is implemented correctly is not read; only that it is in range. A state where a broken implementation reports nothing cannot be told apart by this reconciliation. That is covered by each rule's own tests
- The range of an external tool absent from `declaredChecks` is not in the input. An undeclared check does not exist for this reconciliation
- This rule runs as a rule of the static analyser, so a workspace the analyser opens nothing in has nowhere to place its own report. Reports come out at the repository root and when that workspace is checked
- Scope reach follows only relative specifiers and what resolves through the published entry of a package inside the repository. A specifier assembled at run time is not followed

## Fix

For a coverage hole, put that path into some check's range. Where it cannot go in, declare "no check reads this" by extension or by a concrete path, and write a reason on the row.

For a registration row that does not reach, move the row into a register consumed by a check that opens the target path, or drop that check's exclusion. Which to choose is settled by whether the path may be opened to the check.

Delete a dead row. Where what the row protected moved to another path, point the pattern at the destination. For a receiver that does not exist, add it to `declaredChecks`, or delete the delegation record and take the responsibility back.

For a gap in a scope registration, add the reached side to the registration, or cut the coupling doing the reaching.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// an authored path no declared check opens
export const shipped = true;

```

```ts
// a declaration of paths no check reads that covers a whole directory
export const shipped = true;

```

Code this rule accepts.

```ts
// every authored path sits inside a check, and two checks may open the same path
export const shipped = true;

```

```ts
// an extension declared as read by no check is not a hole
export const shipped = true;

```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Covering a whole directory with a "no check reads this" declaration. Declarations are written by extension or by a concrete path
- Moving a path into `unscannedDirectories` to clear a coverage hole. It only distorts the definition of the authored surface; the file is still authored
- Deleting a registration row that does not reach, just to clear the report. What it wanted to prohibit remains, so deleting the row deletes the prohibition
- Changing only the extension into a form that falls inside a check's range while the contents stay unreadable to it. Being in range and being checked are different, so this shape makes a coverage hole look gone while nothing changed
- Silencing it with a suppression directive

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `UNCHECKED_AUTHORED_PATH_MESSAGE_ID` | An authored path must not sit outside every check this repository declares. \`{{authoredPath}}\` is opened by none of {{declaredChecks}}. Add it to the paths one of those checks opens, or declare its extension among the paths no check reads and write the reason on that declaration. |
| `BROAD_UNCHECKED_DECLARATION_MESSAGE_ID` | A declaration of paths no check reads must not cover a whole directory. \`{{pattern}}\` names a directory rather than an extension or a single path. Split it into the extensions carried under that directory, or name each path this repository leaves unread. |
| `EXCLUDED_REGISTRATION_MESSAGE_ID` | A registration row must not aim at paths the check that consumes it leaves out. Row \`{{pattern}}\` of {{registry}} matches \`{{matchedPath}}\`, and \`{{check}}\` leaves that path out through {{exclusion}}. Move the row to a registry that a check reading those paths consumes, or take that exclusion out of \`{{check}}\`. |
| `UNOPENED_REGISTRATION_MESSAGE_ID` | A registration row must not aim at paths the check that consumes it never opens. Row \`{{pattern}}\` of {{registry}} matches \`{{matchedPath}}\`, and \`{{check}}\` opens only {{coveredPaths}}. Move the row to a registry that a check reading those paths consumes, or add that path to the paths \`{{check}}\` opens. |
| `DEAD_REGISTRATION_MESSAGE_ID` | A row that allows an exception must not stand for files this repository does not hold. Row \`{{pattern}}\` of {{registry}} matches no authored path, and it states: {{reason}}. Delete the row, or move the pattern to the path that took the exception over. |
| `UNDECLARED_RECEIVER_MESSAGE_ID` | A record must not name a receiver this repository does not declare. {{record}} names \`{{receiver}}\`, and the declared checks are {{declaredChecks}}. Declare that receiver among them, or delete the record and take the duty back. |
| `UNREGISTERED_SCOPE_REACH_MESSAGE_ID` | A file that a registered file reaches must not stay outside the scope registration. \`{{reachingPath}}\` reaches \`{{reachedPath}}\`, and the registration for \`{{scope}}\` leaves it out. Register the reached path in that scope, or delete the coupling that reaches it. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
