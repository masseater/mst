---
description: "Disallow a fixture factory that stands on the test block spelling, so the name that declares test blocks carries that one role and everything scanning the suite can settle what that name means by reading it"
---

# forbid-it-extend--use-test-extend

<!-- BEGIN GENERATED rule-header -->

Disallow a fixture factory that stands on the test block spelling, so the name that declares test blocks carries that one role and everything scanning the suite can settle what that name means by reading it

- Tool: `oxlint`
- Fixable: yes
- Suggestions: no
- Options: no
- Shipped in the preset: yes
- Source: [`forbid-it-extend--use-test-extend.ts`](../../src/lint/oxlint/rules/forbid-it-extend--use-test-extend.ts)

<!-- END GENERATED rule-header -->

## Violation

A member access whose property name is `extend` and whose base is an identifier resolving to `it`, the spelling that declares test blocks.

The property name is read in the three shapes where what is written is what the property ends up being: a non-computed member (`it.extend`), a string-literal subscript (`it['extend']`), and a template-literal subscript carrying no expression (``it[`extend`]``). Where the name can be read before the run, how it was spelled changes nothing.

The base identifier is resolved by following its binding. There are four places it lands.

| Base | How it resolves |
| --- | --- |
| An identifier with no binding at all | The spelling is the answer; the shared test setup injects the test block API globally |
| A binding imported from the test runner (`import { it } from "vite-plus/test"`) | The imported name |
| The same import taken under another name (`import { it as check }`, and `import { 'it' as check }`) | The name at the import, not the local spelling |
| A rebinding of any of the above (`const check = it`) | Followed through any number of steps |

Whether it is called makes no difference. `const derive = it.extend;`, which only takes the member as a value, is reported. What is handed to `extend` makes no difference either. Only the base identifier is read.

The report stands on the one base identifier. In `it.extend({ a: 1 }).extend({ b: 2 })` the outer `.extend` has a call expression in front of it rather than an identifier, so a chain is reported once, at its root. Whether it sits inside a grouping block is not read.

These are not reported.

- `test.extend(...)`. This is the shape being asked for
- Members of `it` other than `extend` (`it.skip`, `it.each` and the rest of the test block modifiers), and a bare `it(...)`
- `.extend` on an identifier that does not resolve to `it`: one resolving to `test`, a value the suite or a fixture owns, and a form behind a receiver (`runner.it.extend`). A binding whose local spelling alone is `it` (`import { test as it }`) is not a violation either, because the name at the import is `test`
- Access through the private field syntax (`this.#extend()`)
- A subscript that only settles at run time (`it[member]`, ``it[`ext${suffix}`]``). It cannot be said before the run that it names `extend`, so this rule makes no judgment. That shape itself is taken by [no-computed-test-api-member--use-static-member](./no-computed-test-api-member--use-static-member.md)
- A binding whose initializer is not an identifier. Resolution stops there. A binding that received the result of `test.extend(...)` lands here, so naming that binding `it` and writing `it.extend(...)` after it produces no report — the base is still `test`
- An `it` that did not come from the test runner: a parameter, a catch binding, a function name

### The invariant

A name and a role correspond one to one. `it` means the declaration of a test block and nothing else; the base of a fixture factory is carried by `test` alone.

The test runner grows `extend` on both `it` and `test`, so `it.extend(...)` works. Working is the problem. The moment `it` carries both "declares a test block" and "base of a fixture factory", everyone who scans `it` has to carry a branch deciding which one this `it` is. The scanners are the other lint rules that read what is inside an `it` block, the codemods that align spellings, the greps that count the reach of a change, and the IDE's bulk rename.

It breaks in two layers. The first is that the branch does not get written. A scan built on "having found `it`, the next argument is a test name and a callback" misses the one `it.extend` site. A miss does not raise; it shows up as the scan quietly returning an answer one short.

The second is that the miss is not detected. The scanning side cannot tell "could not find the target" from "there was no target". The only person who can notice the count is off is the person who knows `it` has two roles. A state only the knowledgeable read correctly is the same state as one nobody notices, once that knowledge is gone.

Rather than absorbing the ambiguity in every consumer, remove it at the source. Fix the base to `test` and nobody has to write the branch.

### Configuration

None. `it` and `test` are carried by the rule.

Making the spellings configurable splits the setting between this rule, which reads `it` as a base, and the other rules that read `it` as the declaration of a test block. With the setting split, changing a spelling leaves the side that did not follow blind to its target — answering that there is no violation rather than missing one. Make the spellings configurable only once those rules share one setting.

## Fix

Replace the base `it` with `test`. The test runner offers them as the same API, so the replacement does not change behaviour. The binding that receives the result keeps the name `it`, which is what the suite writes its blocks with.

The automatic fix performs this replacement only where replacing is the whole edit. Three conditions.

- It is written as a non-computed member. Where it is written as a subscript, repair the shape first through [no-computed-test-api-member--use-static-member](./no-computed-test-api-member--use-static-member.md) and then replace. Replacing only the base would leave the subscript violation standing
- The base is spelled `it` itself. Rewriting a binding brought in under another name (the `check` of `import { it as check }`) to `test` leaves the import statement that supplied that name dangling, and what to do with it has to be decided. That decision is not a replacement
- `test` reaches that position after the replacement. Where `it` has no binding at all, the test block API is injected globally and `test` reaches just as well. Where `it` was brought in by an import or a local binding, `test` reaches only when a binding for it exists in the same scope

The shape that fails the third condition — a file that imports `it` without importing `test` — gets the report alone, handed to the writer. Replacing there would produce code where `test` is bound nowhere, and the premise that behaviour does not change would break. Import `test` and run the fix again, or rewrite both by hand.

The name of the binding that receives `test.extend(...)` is left alone. Only the base is rewritten, and a binding named `it` is the shape the convention asks for.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// the fixture builder on the test block spelling is reported and rewritten onto the base
it.extend({ subject: async ({}, use) => use(runSut()) });
```

```ts
// a rebinding of the test block spelling is followed to the spelling it came from
const check = it;
check.extend({ a: 1 });
```

Code this rule accepts.

```ts
// the fixture factory standing on test is the shape this rule asks for
const it = test.extend({ subject: async ({}, use) => use(runSut()) });
```

```ts
// a member other than the builder on the test block spelling is left alone
it.each([1, 2])('adds %i', () => {});
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Writing `extend` as a subscript to dodge the name judgment. A subscript readable before the run is read as a name by this rule itself, and one that settles at run time is taken as a shape by `no-computed-test-api-member--use-static-member`
- Binding `it` to another name and writing `.extend` on that. Rebindings are followed through any number of steps
- Taking `it` back as a function parameter and writing `.extend` on the parameter. What the parameter holds is decided by the caller, so this rule stops resolving and no report comes out. Not being detected does not mean it is allowed: the base of the fixture factory is still `it`, and `it` still carries two roles
- Tying `it` to the runner's API through a type annotation alone and writing `.extend` on it. This rule reads only initializers and import sources, so no report comes out, while the two roles hold just the same
- A suppression directive

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `itExtend` | A fixture factory must not stand on \`it\`, the spelling reserved for declaring test blocks. Replace \`{{base}}\` with \`test\` and leave the rest of the chain alone. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads no options. A consumer turns it on or off as a whole.

<!-- END GENERATED runtime -->
