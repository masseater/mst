---
description: "Require every test block declaration to be rooted at one configured spelling, so a scan of the test surface settles what an identifier means without reading the block behind it"
---

# require-test-block-spelling--use-configured-fn

<!-- BEGIN GENERATED rule-header -->

Require every test block declaration to be rooted at one configured spelling, so a scan of the test surface settles what an identifier means without reading the block behind it

- Tool: `oxlint`
- Fixable: yes
- Suggestions: no
- Options: yes
- Shipped in the preset: yes
- Source: [`require-test-block-spelling--use-configured-fn.ts`](../../src/lint/oxlint/rules/require-test-block-spelling--use-configured-fn.ts)

<!-- END GENERATED rule-header -->

## Violation

A test block declaration whose root identifier is not the required spelling. The required spelling is `it` by default.

The root is obtained by following the test block's modifiers recursively. Eleven things count as modifiers — `concurrent`, `each`, `fails`, `for`, `only`, `runIf`, `sequential`, `shuffle`, `skip`, `skipIf`, `todo` — and `extend` is not among them. Both call expressions and tagged templates are read.

The report and the repair land on the root identifier alone. However many modifiers are stacked, it is one report.

The shapes in range.

| Shape | Example |
| --- | --- |
| A bare call | `test("names a behaviour", () => {});` |
| Through a modifier member | `test.skip("names a behaviour", () => {});` |
| Modifiers stacked | `test.skipIf(slow).concurrent("...", fn);` |
| A call on the function a table modifier returns | `test.each(rows)("...", (row) => {});` |
| Its tagged template spelling | ``test.each`a \| b`;`` |
| A declaration taking no callback | `test.todo("names a behaviour");` |
| A subscript whose name is settled statically | `test["skip"]("names a behaviour", () => {});` |
| A declaration nested inside a grouping block | `describe("...", () => { test("...", fn); });` |

Whether the root is "a test block declaration coming from the test runner" is not settled by name alone. The scope is followed and the binding resolved first.

1. An identifier whose binding is not found counts as a test block declaration where it is one of the spellings the runner injects globally (`it` and `test`)
2. A binding importing `it` / `test` from a module listed in `runnerModules`. A renamed import is included
3. A binding initialised with any of the above, or with the result of `.extend(...)`. Rebindings are followed through any number of steps

A binding falling under 2 or 3 is reported where the binding's name is not the required spelling. The `spec(...)` of `import { it as spec } from "vitest";` and the `derived(...)` of `const derived = test.extend({ subject: 1 });` fall here.

### Deliberately not widened

| Shape | Why it is left out |
| --- | --- |
| `test.extend({ subject: 1 })` | It is a fixture factory, not a test block declaration. `extend` is not treated as a modifier, so the root is never reached |
| `it.extend({ subject: 1 })` | As above. Whether `it` may be the base belongs to [forbid-it-extend--use-test-extend](./forbid-it-extend--use-test-extend.md) |
| `it(...)` / `it.skip(...)` / `it["skip"](...)` | Written with the required spelling |
| `test[chosen]("...", fn)` | Which modifier it resolves to is settled only at run time. It is not judged as a name. The shape itself is dropped by [no-computed-test-api-member--use-static-member](./no-computed-test-api-member--use-static-member.md) |
| `suite.test("...", fn)` | A call of a same-named method carrying a receiver |
| `const it = test.extend({ subject: 1 });` | A derived builder bound to the required spelling. The agreed shape |
| `describe(...)` / `import { describe as group }` | A declaration API that is no test block |
| `const run = (test) => { test("...", fn); };` | An identifier bound to a parameter. It resolves to no API of the runner |
| `import { test as spec } from "./helpers.ts";` | An import from a module absent from `runnerModules` |

There is no narrowing by file name. This rule holds no policy about file names, and which files it holds for is settled by the shared lint configuration's glob.

### The invariant

What is held is that names and roles correspond one to one. `it` means the declaration of a test block and nothing else; `test` means the base of a fixture factory and nothing else.

The breakage has two layers.

The first is that whoever walks the suite carries a branch. People are not the only ones walking a suite by machine. Other lint rules, codemods, grep and an IDE's bulk rename all stand on a state where a role is settled by looking at the identifier. The moment two spellings mix, every one of them takes on the cost of "reading both".

The second is that the branch does not get written. Unwritten, one of the spellings escapes the transformation. Having escaped shows up in no shape resembling a failed transformation. The tests stay green and one side stays in the old shape. Whoever notices is the next person who has to touch that old shape.

The spelling-unification rule the test runner's plugin ships cannot be used for this purpose. It counts `test.extend` as a `test`-family call and reports it, colliding head-on with the convention of putting fixture factories on `test.extend`. This rule fills exactly that gap.

### Configuration

| Option | Default | What it settles |
| --- | --- | --- |
| `blockSpelling` | `"it"` | The required spelling |
| `runnerModules` | `["vitest", "vite-plus/test"]` | The import sources treated as the test runner |

Where `blockSpelling` is moved off its default, it has to share the value with the neighbouring rules that identify `it` blocks. Let the settings split and the neighbouring rules lose sight of their subject and go quiet the moment the spelling changes.

## Fix

Replace the root identifier with the required spelling. `it` and `test` are the same API of the runner, so the replacement changes no behaviour.

```ts
it("counts what the parser reached", () => {});
it.skip("counts what the parser reached", () => {});
it.each(rows)("counts what the parser reached", (row) => {});
```

Where it is written with a globally injected spelling, an automatic fix comes with it.

Where the declaration went through a renamed import or a derived builder under another name, level the binding's own name to the required spelling.

```ts
const it = test.extend({ subject: 1 });

it("counts what the parser reached", ({ subject }) => {});
```

That side needs both the declaration and the references rewritten, so no automatic fix is offered.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a bare block declared with the other injected spelling is reported and renamed
test("names a behaviour", () => {});
```

```ts
// a derived builder bound to another name is reported at the binding
const spec = test.extend({ subject: 1 });
spec("names a behaviour", () => {});
```

Code this rule accepts.

```ts
// a block declared with the required spelling is the form this rule asks for
it("names a behaviour", () => {});
```

```ts
// a derived builder bound to the required spelling is the agreed form
const it = test.extend({ subject: 1 });
it("names a behaviour", () => {});
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Rewriting it as a subscript to slip the name judgment (`test[chosen](...)`). It falls out of this rule's judgment, and [no-computed-test-api-member--use-static-member](./no-computed-test-api-member--use-static-member.md) drops the shape
- Receiving it into another name first and declaring from there (`const spec = test;`). A binding's initialiser is followed, so the root does not change
- Going through a derived builder (`const spec = test.extend({ subject: 1 });`). It descends to the base of the `.extend`, so it lands in the same place
- A suppression directive

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `foreignBlockSpelling` | A test block must not be declared through \`{{written}}\`. Rename the root of this declaration to \`{{required}}\`. |
| `foreignBlockBinding` | A test block must not be declared through the binding \`{{written}}\`. Rename that binding to \`{{required}}\` at its declaration and at every reference to it. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
