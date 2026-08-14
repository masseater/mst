---
description: "Disallow an assertion standing anywhere other than inside a test block the runner handed over under the configured spelling, so every assertion a suite runs answers for the behaviour one named block describes"
---

# no-expect-outside-it--move-into-it-block

<!-- BEGIN GENERATED rule-header -->

Disallow an assertion standing anywhere other than inside a test block the runner handed over under the configured spelling, so every assertion a suite runs answers for the behaviour one named block describes

- Tool: `oxlint`
- Fixable: yes
- Suggestions: no
- Options: yes
- Shipped in the preset: yes
- Source: [`no-expect-outside-it--move-into-it-block.ts`](../../src/lint/oxlint/rules/no-expect-outside-it--move-into-it-block.ts)

<!-- END GENERATED rule-header -->

## Violation

The first test block found walking up from an `expect(...)` not being declared under the canonical spelling. The canonical spelling defaults to `it`. An `expect(...)` with no enclosing test block at all is detected the same way, and so is an assertion-count declaration (`expect.assertions(n)` / `expect.hasAssertions()`) standing outside a test block.

What is read as a starting point is the assertion entry call itself; whether a matcher follows is not read. A form going through a derived receiver (`expect.soft(...)` / `expect.poll(...)`) is read as the same starting point. Being an entry is not settled by spelling alone: a binding imported from the test runner under another name, and a binding rebound to the entry inside the file, are read as the same entry. A namespace member call taking neither a subject nor an assertion count (`expect.extend(...)` and the like) is not a starting point.

Test blocks are recognized by shape. A call whose first argument is a string literal or a template literal and which is handed a function somewhere in its arguments is a test block, and the identifier at the root of its callee is read as the spelling. The root is obtained by following the same list of modifiers as [require-test-block-spelling--use-configured-fn](./require-test-block-spelling--use-configured-fn.md), so `it.skip(...)` and `it.each(rows)(...)` resolve to `it`. Even under the canonical spelling, where that identifier names a binding that does not reach the test runner it is not treated as a test block.

Where several blocks enclose the assertion, the innermost one carrying a callback is read.

Reports divide into five.

| Report | What is happening |
| --- | --- |
| `foreignTestBlockAssertion` | A test block from the test runner, spelled other than canonically |
| `shadowedTestBlockAssertion` | Canonically spelled, but declared by a binding that does not reach the test runner |
| `groupingBlockAssertion` | A block not from the test runner (`describe` and the like) |
| `detachedAssertion` | No enclosing test block |
| `strayAssertionCount` | An assertion-count declaration standing outside a test block |

"From the test runner" is not settled by a list of names. It is settled from three roots, following bindings derived from them through `.extend(...)`.

1. A globally injected `it` / `test` whose name nobody in the file has taken
2. A binding imported from the test runner's module under the spelling `it` or `test`
3. A binding built by applying `.extend(...)` to an imported binding

A `test.extend(...)` factory, whose binding name is arbitrary, enters through 1 and 2. Rebind the same name to another value inside the file and that name stops reaching the test runner. Importing `it` from a module that is not the test runner and declaring a block with it **as it stands** does not reach either.

Only the spellings `it` and `test` are taken from the test runner's module. Take `describe` too and an assertion standing directly under a grouping block would count as being inside a test block.

Point 3 answers the fact that this runtime cannot read a declaration behind an import. A shared fixture factory sits in another file, and a spec imports it and stacks `.extend(...)` on it. Whether the base reaches the runner cannot be known without following the import, and treating what cannot be followed as a violation would drop every spec written to the convention. What cannot be read is not a violation. Using an imported binding directly as a block without `.extend(...)` in between does not fall under 3. Naming a function of your own `it` (`const it = buildRunner()`) does not either, because it is not an `.extend(...)` call.

Shapes in scope.

| Shape | Example |
| --- | --- |
| A test block under another spelling | `test("adds", () => { expect(sum).toBe(3); });` |
| A test block from a factory bound to another name | the `spec("adds", fn)` of `const spec = test.extend({});` |
| Directly under a grouping block | `describe("sums", () => { expect(sum).toBe(3); });` |
| A hook | `beforeEach(() => { expect(sum).toBe(3); });` |
| The body of a module-scope helper | `const assertTotal = (total) => { expect(total).toBe(3); };` |
| The body of a fixture factory | `test.extend({ subject: async (c, use) => { expect(seed).toBe(1); ... } })` |
| A derived receiver used outside an `it` | `expect.soft(sum).toBe(3);` |
| An assertion entry bound to another name | the `check(sum).toBe(3)` of `import { expect as check } from "vite-plus/test";` |
| A non-runner binding claiming the canonical spelling | the `it("adds", fn)` of `const it = buildRunner();` |
| An assertion-count declaration outside a test block | `describe("sums", () => { expect.assertions(2); });` |

There is no narrowing by file name. An assertion written in a helper file a spec imports is in scope too, and which files this holds for is settled by the shared lint configuration's glob.

### Deliberately not widened

| Shape | Why it is left out |
| --- | --- |
| `it.skip(...)` / `it.each(rows)(...)` / `it.skipIf(slow).concurrent(...)` | Modifier and curried forms whose root resolves to the canonical spelling |
| `it("adds", () => { rows.forEach((row) => { expect(row).toBe(1); }); });` | A callback that is not for tests does not end the walk; the test block above it is read |
| `it("adds", () => { expect(sum); });` | The position is right. That it claims nothing belongs to `no-matcherless-expect--assert-with-matcher` |
| `it("adds", () => { const parsed = parse(raw); expect(parsed).toBe(3); });` | Keeping the `it` body to claims alone belongs to [require-it-only-expect--move-setup-into-fixture](./require-it-only-expect--move-setup-into-fixture.md) |
| `test("adds", () => {});` | There is no assertion, so no question of position. The spelling itself belongs to `require-test-block-spelling--use-configured-fn` |
| `expect.extend({ toBeReport });` / `expect.setState({});` | Namespace member calls taking neither a subject nor an assertion count |
| `test("adds", () => { expect.hasAssertions(); });` | The count declaration stands inside a test block. The spelling belongs to `require-test-block-spelling--use-configured-fn` |
| `runner.expect(sum).toBe(3);` | An entry through a namespace import; the root does not resolve to an identifier |
| `it(1, () => { ... })` / `suite.test("adds", fn)` | Not readable as a test block by shape, or by the root of the callee. Treated as having no enclosure |

This rule reads position only, not the spelling itself. Aligning `test` to `it` belongs to `require-test-block-spelling--use-configured-fn`, which leaves the fixture-definition side of `test.extend(...)` alone.

### The invariant

Assertions are placed inside `it` and nowhere else.

Hold that and the structure of the suite can be read by a machine. Every claim about behaviour sits under a named `it`, so a failure always corresponds to a described behaviour. The reader restores which contract broke by reading the title of the block that failed.

It breaks in two layers.

The first is that the attribution of a failure disappears. An assertion placed directly under a `describe` or in the body of a helper fails without the title saying which claim about behaviour broke. The reader starts by walking the stack to find the caller.

The second is that the premises of the neighbouring rules collapse. The rule keeping the `it` body to assertions alone, the rule counting assertions inside an `it`, the rule reading the subject's name — all stand on the premise "reading `it` is enough for assertion analysis". Move an assertion into a helper function and everyone who placed that premise loses sight of the target and goes quiet. Going quiet takes no form in any report. So this rule matters less for itself than as ground for the others.

The rule of the same kind offered by a test-runner plugin cannot serve this purpose: it cannot recognize a binding derived from `test.extend(...)` as a test block, so it drops code written to the convention. That upstream rule is kept out of the shared configuration and this one is used instead. So that no shape upstream catches is left uncaught here, the entry's aliases, assertion-count declarations, and non-runner bindings claiming the canonical spelling are all inside the detection range.

### Configuration

| Option | Default | What it settles |
| --- | --- | --- |
| `blockSpelling` | `"it"` | The canonical spelling |

There is no option listing modules that ship shared fixture factories. A listing form picks up only imports written with a package specifier and misses the same factory imported by a relative path from inside the same package. Standing on the `.extend(...)` call reads both spellings alike.

`blockSpelling` must carry the same value as the option of the same name on `require-test-block-spelling--use-configured-fn`. Split the settings and this rule drops a test block the spelling rule called canonical.

Where the canonical spelling is changed to a name the test runner does not inject globally, no automatic fix is offered. The binding it would be replaced with cannot be guaranteed to resolve at that position, so only the report stands.

## Fix

For a test block declared under another spelling, replace the root identifier with the canonical spelling. Where it is written with a globally injected spelling, an automatic fix comes with it.

```ts
it("adds", () => {
  expect(sum).toBe(3);
});
```

For a fixture factory bound to another name, align the binding name and its references to the canonical spelling.

```ts
const it = test.extend({ subject: async (context, use) => use(1) });

it("adds through the factory", ({ subject }) => {
  expect(subject).toBe(1);
});
```

That one comes with an automatic fix too, except in these cases, where only the report stands.

| Shape | Why no automatic fix |
| --- | --- |
| `const spec = it.extend({});` | Renaming would make the declaration reference itself. The ground belongs to [forbid-it-extend--use-test-extend](./forbid-it-extend--use-test-extend.md) |
| `const base = it.extend({}); const spec = base.extend({});` | The root of the derivation reaches the canonical spelling, so the same holds |
| A canonical binding already in the same scope | Renaming would collide with the declaration |
| `export const spec = test.extend({});` | Renaming would break references outside this file. Renaming closes inside one file |
| `import { it as check } from "vite-plus/test";` | Renaming an imported binding belongs to the spelling rule |

An assertion written directly under a `describe` is moved into an `it` by hand. Leave the shared setup factory shared and bind only the concrete test factory to the canonical spelling. Stacking `extend` step by step is fine as it is.

For a non-runner binding claiming the canonical spelling, delete that binding and redeclare the block with the test runner's `it`, or with a factory derived from `test.extend(...)`. An assertion-count declaration standing outside a test block is moved into the `it` that runs the assertions it counts, or deleted.

For an assertion entry bound to another name, use the entry under the spelling `expect`. Renaming the entry changes nothing about how the subject is read, so there is no reason to rename it.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// an assertion written straight into a grouping block names no behaviour
describe('sums', () => { expect(sum).toBe(3); });
```

```ts
// an assertion in a helper declared beside the suite stands in no block at all
const check = (total) => { expect(total).toBe(3); };
```

Code this rule accepts.

```ts
// an assertion in the body of the canonical test block is where the rule wants it
it('adds', () => { expect(sum).toBe(3); });
```

```ts
// a fixture factory bound to the canonical spelling declares canonical test blocks
const it = test.extend({ subject: 1 });
it('adds', ({ subject }) => { expect(subject).toBe(1); });
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Moving the assertion into a file outside the spec to avoid the report. Imported files are in scope too, so it is not an escape
- Folding the assertion into a helper function and calling it from `it`. It is reported at the declaration's position
- Declaring the test block through a subscript or a name settled at run time to leave the root judgment
- Rebinding the assertion entry to another name to leave the starting-point judgment
- Rebinding the canonical spelling to a function of your own to pose as the runner's test block
- A suppression directive

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `foreignTestBlockAssertion` | An assertion must not stand in a test block declared through \`{{written}}\`. Rename the root of that declaration to \`{{required}}\`. |
| `shadowedTestBlockAssertion` | An assertion must not stand in a block declared through a binding of \`{{required}}\` that the test runner never handed over. Declare the block through the \`{{required}}\` the runner injects, or through a fixture derived from it. |
| `groupingBlockAssertion` | An assertion must not stand in the block declared through \`{{written}}\`. Move this assertion into an \`{{required}}\` block that names the behaviour it checks. |
| `detachedAssertion` | An assertion must not stand outside a test block. Move this assertion into the \`{{required}}\` block that names the behaviour it checks. |
| `strayAssertionCount` | An assertion count must not be declared outside a test block. Move this declaration into the \`{{required}}\` block whose assertions it counts, or delete it. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
