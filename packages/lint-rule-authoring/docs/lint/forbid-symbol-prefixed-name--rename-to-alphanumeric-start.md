---
description: "Require every directory and file name on the path of a linted file to start with a letter or a digit, so nothing sits where a glob walk never reaches it"
---

# forbid-symbol-prefixed-name--rename-to-alphanumeric-start

<!-- BEGIN GENERATED rule-header -->

Require every directory and file name on the path of a linted file to start with a letter or a digit, so nothing sits where a glob walk never reaches it

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: yes
- Shipped in the preset: yes
- Source: [`forbid-symbol-prefixed-name--rename-to-alphanumeric-start.ts`](../../src/lint/oxlint/rules/forbid-symbol-prefixed-name--rename-to-alphanumeric-start.ts)

<!-- END GENERATED rule-header -->

## Violation

A segment of the checked file's path that does not start with an alphanumeric character (`a-z`, `A-Z`, `0-9`). Directory names and file names are read alike.

The path is taken relative to the working directory the lint started from. In `_internal/helper.ts` the target is `_internal`; in `src/@entry.ts` it is `@entry.ts`. Files outside the working directory — those whose relative path carries `..` — are not judged, because a path outside the repository is not under the writer's control.

The judgment allows rather than forbids. The only condition is that the first character be `[A-Za-z0-9]`, rather than a list of forbidden openings such as `_`, `-` and `.`. A list would leave whatever it failed to enumerate (`~`, `@`, `+`, `!`, full-width symbols, emoji) passing straight through.

A name opening with a dot is a violation like any other symbol. Names a tool requires as a convention, such as `.github` and `.storybook`, pass by being written into the allow list below. Letting every dotted name through would mean one directory named `.internal/` is enough to leave the checked set, with that move leaving no trace in a configuration diff.

The first character is checked against ASCII alphanumerics alone, so a name opening with Japanese or an accented letter is reported as well.

Where one path carries several offending segments, each is reported in the order it appears. The same name appearing twice on one path is folded into one report (`packages/_shared/_shared/index.ts` raises one), because naming the same name twice tells a reader nothing more.

The report points at the file's Program node. It is not a violation with a position, but a violation about where the file has been placed.

Because the lint runs per file, a directory holding no file of a linted extension — a place for images or data alone — is not detected even when it opens with a symbol.

### The invariant

The names of files and directories decide, by themselves, whether they get found. A name opening with a symbol slips past a glob's walk, and what was placed there stays unchecked. The lint, the type check and the test collection all pass through a stage that gathers targets first. Something not picked up at that stage is reached by none of the rules that follow, however many there are.

What makes it awkward is that the miss never surfaces as a failure. A file that was not checked is indistinguishable from a file with no violations. Everything stays green while the unchecked territory grows.

Worse, the miss works as a method as well as an accident. To leave a rule's reach, add one symbol to the front of a directory name. The way around sits one rename away, and as a diff it looks like nothing but a rename, so a review does not stop it. Made mechanical, such a name cannot exist without an operation that does leave a diff and does go through review: adding a line to the allow list.

### Configuration

`allowedNames` (a list of strings, empty by default) is the only option. Names listed there are not violations even when they open with a symbol.

- The match is against the whole path segment, never a substring. Allowing `_ui` does not let `_ui-legacy` through
- `*` stands for a run of characters of any length, including none. Regular expressions are not accepted, both to avoid building a regular expression out of a configuration value and to keep the expressive power narrow enough that an over-broad allowance is hard to write
- Case is significant. Allowing `_ui` does not let `_UI` through
- An entry cannot carry `/`; the schema refuses it with `^[^/]+$`. Allowance is per path segment, not per subtree
- An allowance covers that one name and does not propagate downward. Allowing `_ui` leaves `_legacy` in `_ui/_legacy/index.ts` a violation. Propagating would turn an allowed name into the entrance to an unchecked territory

Axes such as allowing particular symbols, a depth limit, or switching which extensions are targeted are deliberately absent. Each one added makes it harder to trace which setting caused something not to be detected, and raises the total number of ways around.

## Fix

Rename the offending segment to something starting with an alphanumeric: `_internal` to `internal`, `@entry.ts` to `entry.ts`. As long as the first character is alphanumeric, symbols may appear after it (`user-profile.ts`, `v2_adapter.ts`).

Where the motive for the symbol was marking something as internal, express that through the module's published surface rather than its name. Leaving it out of the package's `exports`, or not re-exporting it from the public entry, draws the same distinction without leaving the walk.

Where the motive was noting that something is temporary, do not put it in the repository. A draft in progress belongs somewhere like `.local-agents/`, where being hidden from the walk is the intent.

### Adding an exception

The allow list is for names a framework or a tool requires as a specification, and nothing else. The test is whether renaming it to start with an alphanumeric breaks the functionality. If it breaks, allow it; if not, fix it by renaming.

Put the allowance in the configuration owned by whoever owns the files carrying that name. Adding it to the shared configuration turns one framework's circumstances into a loosening for everything. Write down alongside it which framework or tool requires the name, so that "why is this allowed" does not have to be researched again later.

```jsonc
["error", { "allowedNames": [".storybook", ".*rc"] }]
```

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a directory name starting with an underscore is reported
// in packages/lint-rule-authoring/_internal/helper.ts
const total = 1;
```

```ts
// an allowed name does not carry the allowance down to the names under it
// in packages/_ui/_legacy/index.ts
const total = 1;
```

Code this rule accepts.

```ts
// every segment of a nested path starts with a letter
// in packages/lint-rule-authoring/src/lint/oxlint/rules/some-rule.ts
const total = 1;
```

```ts
// a name the deployment listed is allowed to start with a symbol
// in .config/tooling/setup.ts
const total = 1;
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Renaming to another symbol-prefixed name to escape another rule's reach (`_fixtures/` to `~fixtures/`). The new name is the same violation, and escaping is what this rule watches for
- Adding a name to the allow list on the grounds of a category you invented — "internal", "private", "scratch space". No framework requires it, so renaming solves it
- Moving the file under a hidden directory to leave the walk. Every check including this one stops reaching it, which is not a fix
- Silencing this one rule with a suppression directive. The report is per file so one line removes it, and removing it changes nothing about that directory slipping past other tools' globs. It may be removed only when the name has been fixed

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `symbolPrefixedSegment` | A directory or file name must not start with anything other than a letter or a digit. The name \`{{segment}}\`, on the path \`{{path}}\`, starts with something else. Rename that one name to start with a letter or a digit. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
