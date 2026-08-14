---
description: "Disallow a shared setup module or a runner configuration telling one spec from another, so the cleanup and the file system rules keep standing on a setup that hands every spec the same starting state"
---

# no-spec-specific-shared-setup--keep-setup-uniform

<!-- BEGIN GENERATED rule-header -->

Disallow a shared setup module or a runner configuration telling one spec from another, so the cleanup and the file system rules keep standing on a setup that hands every spec the same starting state

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: yes
- Shipped in the preset: yes
- Source: [`no-spec-specific-shared-setup--keep-setup-uniform.ts`](../../src/lint/oxlint/rules/no-spec-specific-shared-setup--keep-setup-uniform.ts)

<!-- END GENERATED rule-header -->

## Violation

Text in a shared setup, or in the runner's configuration, that tells one spec, one test or one file path apart and changes what it does.

This rule means something only together with the rules that forbid text in a spec on the grounds of what a shared setup does. [no-redundant-mock-reset--lift-mocks-into-fixture](./no-redundant-mock-reset--lift-mocks-into-fixture.md) forbids hand-written teardown on the grounds that "the shared configuration always tears down before each test", and [no-local-file-system-mock--use-shared-fs](./no-local-file-system-mock--use-shared-fs.md) forbids a local double on the grounds that "the shared setup rebuilds the area before each test". Both grounds hold only while "it does the same thing to every spec" holds. This rule protects that premise itself.

### What is read

Two things, each with its own way in.

**The shared setup.** The files registered as setup are identified from the runner's configuration, and the modules read from there as values are followed to a closure. Only files inside that closure are checked.

The registration is read from the default export of the `vite.config.*` found by walking the whole repository (the `defineConfig(...)` wrapper is peeled), inside its `test` block. The keys read are `setupFiles` and `globalSetup`, and the same keys in the `test` block of each element of `projects`. The value may be a string or an array of strings, and may be a `const` binding resolvable to one string inside the same file. Where the closure reaches a spec file, it stops there: branching inside a spec is another rule's business.

Where the configuration cannot be derived from the runner's setup, `sharedSetupFiles` names the paths relative to the workspace root. Writing an empty array only returns to derivation; the set cannot be emptied.

**The runner's configuration.** `vite.config.*` itself is checked. Only the inside of the default export's `test` block is read; other regions such as the `lint` block belong to other rules.

### Branching on a value that identifies a test

These spellings are read as values that identify a test. Both a plain identifier reference and a statically readable member name are in scope. A string-literal subscript reads as the same name.

| Spelling | What it names |
| --- | --- |
| `task` / `currentTest` | The running test |
| `suite` / `currentSuite` | The running `describe` |
| `testPath` / `filepath` | The path of the running file |
| `currentTestName` / `testName` / `fullName` | The name of the running test |
| `suiteName` | The `describe`'s name |
| `tags` | The tags on the test |

A branch on the running file's extension reads a path or a name before the extension, so it is caught by a spelling in this table.

The report stands where such a read stands in one of these positions, at the read itself rather than at the branch or the call.

- A branch's condition: the subject of an `if`, a ternary or a `switch`, a `case`'s subject, and both sides of a short-circuit operator
- A call's argument, `new` included. Moving the branch inside a function is the same thing, so it is caught at the argument

A read standing in a `const`'s initializer is not reported; the binding's name inherits the same treatment. That reports the form of moving the value into a variable before branching as the same one violation.

### Matching against a spec's path or directory name

A list of authored spec files is built by walking the whole repository, and the judgment is whether a spelling names any of them. What counts as naming is a spelling containing none of `*`, `?`, `+`, `(`, `)`, `[`, `]`, `{`, `}`, `|`, and which is

- equal to the tail of an authored spec file's path (`src/order.test.ts` / `order.test.ts`), or
- equal to the path of a directory holding authored specs beneath it (`src/legacy`)

A directory may be named only where two or more segments are written. A one-word directory name cannot be settled from the spelling as pointing at specs rather than at an unrelated word.

String literals, template literals with no substitution and regular expression literals are in scope. A regular expression has its escapes and leading and trailing anchors removed before the same judgment, because changing the match to a regular expression or a partial match leaves the spelling.

The report positions are the same two as above, and a spelling in a `const`'s initializer is inherited by the binding name. Packing spec paths into an array and handing it to `includes` elsewhere is reported through that inheritance.

### A runner configuration writing specs out

Where a string naming a spec by the same standard is written inside the `test` block, it is reported. The position makes no difference — an object key or an array element alike. Writing per-environment assignments by spec path, and assigning a different setup by spec path, land here.

### Not violations

| Shape | Why it is left out |
| --- | --- |
| A branch on the run environment | Switching by the runner's environment or per project is not identifying a spec. Where the environment's value is assigned by spec path, though, the configuration doing the assigning is reported |
| Initial state a spec builds itself | Preparing the files and values it needs inside a fixture is the right shape |
| Text holding neither a branch nor a call | Where it does the same thing to every spec, anything may be written in a shared setup |
| A branch in type space, and type arguments | They change no run-time behaviour. Crossing a type node while walking up from the read takes it out of scope. Value-carrying wrappers `as`, `satisfies` and `!` do not count as crossing |
| A branch written on the spec side | Not a question of the shared setup's uniformity. Text inside a spec belongs to other rules |
| A file outside the shared setup's closure | It promises no uniformity. The closure holds the files the runner loads as setup and the modules reachable from them as values |
| Reading a member through a computed subscript | The name cannot be identified. A string-literal subscript is read as a name and is in scope |
| The same spelling written as a property key | Not a read of a value. A computed key is a read of a value and is in scope |
| A pattern covering every spec, and one covering none | `**/*.test.ts` and the setup file's own path are not namings of a spec |

### The invariant

A shared test configuration and a shared setup hold no text that tells specific specs, tests or file paths apart and changes what they do.

The first layer is that the branch is invisible from the spec. A spec is written without knowing what is applied to it. Branch in a shared setup per spec and that one spec runs from a different initial state, with the fact written nowhere in the spec.

The second layer is that the branch becomes a way out of the forbidden bypasses. Where a local file system double cannot be written in a spec, adding that spec's own initialization to the shared setup does the same thing. The spec's text stays clean and only the shared abstraction stops being uniform. A rule that reads only specs does not report that route.

The third layer is parallel execution. With initial states differing per spec, which initial state a test runs under depends on the combination being run. The shared configuration's value lies in a uniform guarantee independent of order and target, and one branch destroys it.

### Configuration

`sharedSetupFiles` alone. It names the files treated as shared setup, by paths relative to the workspace root. The default is derivation from the runner's configuration; write it only where derivation is impossible. The closure from a named file is followed the same way.

The shared configuration side cannot be named. The runner's configuration is identified by the name `vite.config.*`, so no room is left to replace it in configuration. That keeps "where the setup registration is read from" and "what the rule itself checks" one and the same file, independent of the setup.

Writing an empty array returns to derivation. A shape that could empty the set would make this option itself a route for turning the rule off.

There is no automatic fix. Which spec's fixture the preparation behind a branch moves into is not settled without reading that spec.

Type information is not needed.

### Where the detection does not reach

A setup registered through a specifier assembled at run time cannot be followed: the specifier's value exists only at run time, so what gets loaded as setup is not settled.

A runner configuration written in JSON or YAML, and an operation passing setup through CLI arguments, do not enter the input. Only the default export of `vite.config.*` is read.

Assembling per-spec settings in a branch placed outside the `test` block is not read. The reconciliation closes inside the `test` block.

A glob covering only part of the specs is reported in neither the runner's configuration nor a shared setup, because it cannot be told from per-project switching by spelling. Only spec paths and directories written out count as an enumeration.

The spellings of values that identify a test are a fixed list. Where the runner starts distributing the same value under another spelling, that spelling is unread until it is added. Conversely, an unrelated object carrying a member of the same spelling is reported. Shared setups are few, and what matters more is that the judgment holds without type information as long as the spelling is readable.

Handing an identifying value to a function does not distinguish whether that function builds initial state or merely records something. Both are reported.

## Fix

Delete the branch and move the preparation that spec needed into a fixture on the spec side. Leave the shared setup holding only the initial state common to every spec.

Where one spec alone needs a special initial state, that is a sign the shared abstraction is insufficient. Rather than adding a branch for that spec, widen the abstraction into the shape right for every spec.

The same holds where the runner's configuration writes specs apart: delete the split and distribute the same configuration to every spec.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a branch on the path of the running spec is reported where it is read
if (expect.getState().testPath === chosen) { seedLegacy(); }
```

```ts
// a branch on the path of an authored spec is reported
if (path === "src/order.test.ts") { seedLegacy(); }
```

Code this rule accepts.

```ts
// a shared setup handing every spec the same starting state passes
beforeEach(() => { resetVolume({ "/tmp/held.json": "{}" }); });
```

```ts
// a shared setup branching on the run environment keeps every spec uniform
if (process.env["CI"] === "true") { widenTimeout(); }
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Moving the branch's condition into an environment variable and assigning that variable per spec. The configuration doing the assigning is reported
- Pushing the branch out of the shared setup into another module and only calling it from the setup. The closure follows the modules it loads
- Changing the match against a spec path into a regular expression or a partial match to hide the spelling. Escapes and anchors are removed before the judgment
- Moving an identifying value into a variable before branching. It is inherited by the binding name and reported
- Moving the branch inside a function and only handing over arguments in the shared setup. It is reported at the argument position
- Turning this rule off through the detector's configuration or a per-file suppression comment. `no-lint-suppression-in-spec--fix-the-violation` and [require-spec-lint-coverage--lint-every-spec-file](./require-spec-lint-coverage--lint-every-spec-file.md) report it

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `specIdentifyingBranch` | A shared setup module must not branch on \`{{spelled}}\`, a value that tells the running spec from the others. Delete that branch and write the setup it guards into a fixture in the spec that needs it. |
| `specIdentifyingArgument` | A shared setup module must not hand \`{{spelled}}\`, a value that tells the running spec from the others, to a function. Delete that argument and write the setup it selects into a fixture in the spec that needs it. |
| `specNamingBranch` | A shared setup module must not branch on \`{{spelled}}\`, a path naming an authored spec. Delete that branch and write the setup it guards into a fixture in that spec. |
| `specNamingArgument` | A shared setup module must not hand \`{{spelled}}\`, a path naming an authored spec, to a function. Delete that argument and write the setup it selects into a fixture in that spec. |
| `specSpecificRunnerSetting` | A runner configuration must not write out \`{{spelled}}\`, a path naming an authored spec, inside the block that configures the run. Delete that entry and give every spec the same setting. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
