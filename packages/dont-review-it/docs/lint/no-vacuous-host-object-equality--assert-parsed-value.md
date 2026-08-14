---
description: "Disallow comparing or recording a host object that keeps its state in internal slots, so an assertion about an HTTP request or response fails once the code stops producing the contract it was written for"
---

# no-vacuous-host-object-equality--assert-parsed-value

<!-- BEGIN GENERATED rule-header -->

Disallow comparing or recording a host object that keeps its state in internal slots, so an assertion about an HTTP request or response fails once the code stops producing the contract it was written for

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: yes
- Shipped in the preset: yes
- Source: [`no-vacuous-host-object-equality--assert-parsed-value.ts`](../../src/lint/oxlint/rules/no-vacuous-host-object-equality--assert-parsed-value.ts)

<!-- END GENERATED rule-header -->

## Violation

An assertion inside a spec file that compares or records a host object holding its state in internal slots. The roster is `Request` and `Response` by default, and the configuration can replace it.

The spec files in range are, by default, those whose names end in `.test.ts` or `.test.tsx`.

Three shapes are detected.

- A **structural comparison** (`toEqual` / `toStrictEqual`) one side of which is a construction of a rostered host object
- A **partial shape walk** (`toMatchObject` and `expect.objectContaining(...)`) whose expected value is a construction of a rostered host object
- A **snapshot whose recorded value is a constructor name and an empty body** (the `Response {}` shape)

Read as a construction: a constructor call such as `new Response(...)`, and the standard static factories building the same value (`Response.json` / `Response.redirect` / `Response.error`). `Request` carries no corresponding static factory.

Derived entry points (`expect.soft` / `expect.poll`), modifiers (`not` / `resolves` / `rejects`), and matcher names written as a statically readable subscript or template literal are all peeled before the root is settled. Type assertions, `satisfies`, non-null assertions, optional chaining and `await` do not change the value, so they are peeled too.

Where the compared value is bound to a name, that name is followed through any number of steps as long as exactly one `const` declaration in this file spells it. A construction reached through a `const`-bound function that returns a single value is followed to that function's returned expression.

### Which host objects are rostered

The test for entering the roster is whether both the structural comparison and the snapshot lose their footing at once. That answer depends on the versions of the runtime and the test runner, so it is measured at the point of adoption. Measured on these versions, only `Request` and `Response` lose both.

| Type | An exact comparison of two values with different contents | What the snapshot keeps |
| --- | --- | --- |
| `Response` | passes | `Response {}` |
| `Request` | passes | `Request {}` |
| `Headers` | falls | `Headers {}` |
| `URLSearchParams` | falls | `URLSearchParams {}` |
| `URL` | falls | the URL spelled out as a string |
| `Blob` | passes | a body carrying a length and a type |
| `FormData` | falls | — |

Where either one still lives, the contract can be pinned without a dedicated matcher, so the type stays off the roster. Adding a new type waits on a measurement showing that both are lost.

### Which declarations count as the runtime's

Under the same name, a class resolving to a declaration the caller wrote carries enumerable state of its own, so the structural comparison falls correctly. A construction is therefore settled by **where the declaration comes from** rather than by its name.

- A name resolving to no binding (a global) is treated as the runtime's
- A name imported from a specifier listed in `runtimeModules` is treated as the runtime's too. Received under an alias, it is judged by the name at the import
- Imported as a namespace (`import * as undici from 'undici'`), a construction through that namespace is treated the same way
- Every other binding — a class declared in the file, an import from inside the repository, an import from a package absent from `runtimeModules` — is treated as the caller's own declaration and is not reported

### Lining up nested positions

Constructions nested inside object literals and array literals are read as well, but only after the corresponding positions on the two sides are lined up. Keys are matched by the same key conversion JavaScript performs, so `{ 1: x }` and `{ '1': x }` land in the same position.

Where the other side's shape already differs, the outer comparison falls on that alone and nothing is reported. A key set that does not match, an array length that does not match, a hole against an element, and a position where only one side is a primitive, a container of another kind, a function or a construction of another constructor all fall here. Once a spread or a key settled at run time makes the corresponding position unsettleable, the lining-up is given up rather than guessed.

Where the other side is an identifier, a member path or the result of a call — something nothing static can be said about — the corresponding position is treated as open and the report stands.

### How a snapshot is read

A recorded value is read from three places: an inline record from its argument, an external record from `__snapshots__/<spec file name>.snap`, and a file record from the path it names. Resolving the entry an external record answers to shares the machinery with the other rules that read snapshot spelling.

Entry numbers are handed out in the order the snapshot matchers run inside a test block. Inline records and file records consume the same numbers, so they are counted. Where a block's title is settled only at run time, or where a loop or a branch leaves the call order unsettled, no entry is looked up and the rule stays quiet.

The subject is read too, not only the recorded text. Any value carrying no enumerable properties serialises to the same empty body, so where the subject is statically incompatible with the recorded constructor the report is dropped. A written-out value, a construction of another constructor, and a construction of a same-named class the caller declared all fall here.

### Deliberately not widened

| Shape | Why it is left out |
| --- | --- |
| `expect(subject).toBe(new Response('a'))` | An identity comparison never holds between two constructions. It is not vacuous but always falling |
| `expect(list).toContain(new Response('a'))` | Matchers reading reference or membership can fall correctly. A weak matcher belongs to [forbid-weak-matcher--use-exact-matcher](./forbid-weak-matcher--use-exact-matcher.md) |
| `{ ...new Response('a') }` | There are no enumerable own properties, so the spread's result is a plain empty object |
| A snapshot argument carrying an interpolation | It is not a recorded value. An empty inline record with no value filled in is the same |
| A constructor name settled at run time | It names nothing statically. That shape falls to [no-computed-callee-name--write-name-literally](./no-computed-callee-name--write-name-literally.md) |
| A binding declared in another file | Following bindings stays inside this file |

### The invariant

What is held is that an assertion about a value standing for an HTTP request or response falls when the code stops meeting that contract.

The first layer is what these types expose. Their state sits in internal slots, and not one enumerable own property comes out. The test runner's structural comparison walks own enumerable properties and the prototype, so two values with entirely different contents match as "the same empty surface". The snapshot serialiser lands, for the same reason, on a constructor name and an empty body. For these types, then, both a structural comparison and a snapshot are assertions checking nothing.

The second layer is that this reaches no other signal. Coverage counts the path as run, so a test that never falls cannot be told from one that genuinely passes. The number of assertions moves, the number of tests moves, and green moves. The only thing that does not move is the one that should have fallen when something broke.

### Configuration

| Name | Default | What it settles |
| --- | --- | --- |
| `hostObjectTypes` | `["Request", "Response"]` | The names of the host objects in range |
| `runtimeModules` | `["undici"]` | The import specifiers treated as re-exporting the runtime's implementation |
| `parsedValueMatcher` | `"toHaveParsedFields"` | The matcher name the report names as the repair |
| `specFileSuffixes` | `[".test.ts", ".test.tsx"]` | The file name endings this check applies to |

`hostObjectTypes` must be handed the same value as the rule forbidding a fixture from reading a host object apart. Keep it in two places and a type in range on the comparison side falls out of range on the fixture side. `specFileSuffixes` must be handed the same value as the other rules of the bundle.

## Fix

Check the subject through the dedicated matcher. The matcher reads the observable surface out of the internal slots, and the test writes out what was read.

```ts
const test = baseTest.extend("response", () => handle(new Request("https://example.test/orders")));

test("answers with the order", async ({ response }) => {
  await expect(response).toHaveParsedFields({
    status: 200,
    headers: { "content-type": ["application/json"] },
    body: { id: 1 },
  });
});
```

The matcher's name is replaceable through the `parsedValueMatcher` option, and the report names whatever that option holds.

The matcher carries a contract of its own. Ship it apart from the rule and the existing spelling is forbidden while the only alternative does not exist.

- **Every field required, every field exactly matched.** Make one optional and a field nobody wrote passes unchecked, which reopens the hole this rule closed. Empty values are written out too
- **Headers match the subject's header set with nothing over and nothing short.** What the framework adds by itself is written out as well. Where one field appears several times, it is observed as an array in the order of repetition
- **A JSON body is compared in a form normalised by key order alone.** The sort is stable, and duplicate keys keep the order they were written in. The spelling of numbers, duplicate keys and the spelling of escapes are preserved. A body that is not valid JSON is compared as the raw text it is
- **A body distinguishes "absent" from "empty".** A response carrying no body slot and a response carrying an empty body both read as an empty string as text, so the slot is read first

A value that differs from run to run (a generated id, a commit hash) is asserted through the expression that produced it.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a construction on either side is compared against whatever the other side holds
// in order.test.ts
expect(subject).toStrictEqual(new Response('a'));
expect(subject).toEqual(new Response('a'));
expect(new Response('a')).toStrictEqual(subject);
expect(new Response('a')).toStrictEqual();
expect().toStrictEqual(new Response('a'));
expect(read()).toStrictEqual(new Response('a'));
expect(order.body).toStrictEqual(new Response('a'));
expect(subject).toStrictEqual(new Request('https://example.test/'));
```

```ts
// a record holding a constructor name and an empty body pins nothing
// in order.test.ts
expect(subject).toMatchInlineSnapshot(`Response {}`);
expect(subject).toMatchInlineSnapshot(`Request {}`);
expect(subject).toMatchInlineSnapshot('Response {}');
expect(subject).toMatchInlineSnapshot({ id: expect.any(Number) }, `Response {}`);
expect.soft(subject).toMatchInlineSnapshot(`Response {}`);
```

Code this rule accepts.

```ts
// reading the observable surface through the dedicated matcher is the shape this rule keeps
// in order.test.ts
expect(response).toHaveParsedFields({ status: 200, headers: {}, body: { id: 1 } });
expect(order).toStrictEqual({ id: 1, lines: [] });
```

```ts
// matchers that can still fall belong to whoever owns their family
// in order.test.ts
expect(responses).toContain(new Response('a'));
expect(responses).toContainEqual(new Response('a'));
expect(responses).toStrictEqual(expect.arrayContaining([new Response('a')]));
expect(subject).toBe(new Response('a'));
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- **Rebuilding a record from the host object inside a fixture.** Projecting members, reassembling through a call, and reading the body out into plain values before returning all fall under this prohibition. A fixture hands back what the code under test built, and leaves the reading to the matcher
- **Loosening to `toMatchObject` or `expect.objectContaining(...)`.** Vacuity involving a host object is taken by this rule whatever the matcher is spelled as
- **Switching to a snapshot.** An inline record, an external record and a file record all come out as the same empty body
- **Deleting the record and taking it again.** The next record is the same empty body
- **Binding the construction to a name, or pushing it behind a function.** Bindings and single-return functions are followed inside this file
- **Settling the callee's name at run time.** [no-computed-callee-name--write-name-literally](./no-computed-callee-name--write-name-literally.md) drops that
- **A suppression directive**

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `vacuousStructuralEquality` | A structural comparison must not stand a \`{{hostType}}\` construction against a value that may be another one. Assert the parsed value: hand the subject the fixture returned to \`{{matcher}}\` and write out every field it reads, including the ones the framework fills in. Reading the body inside the fixture and comparing the plain value it yields is forbidden as a repair. |
| `vacuousPartialShape` | A partial-shape comparison must not name a \`{{hostType}}\` construction as its expected value. Assert the parsed value: hand the subject the fixture returned to \`{{matcher}}\` and write out every field it reads, including the ones the framework fills in. Narrowing the comparison to a single field is forbidden as a repair. |
| `vacuousSnapshotRecord` | A snapshot must not stand in for an assertion about a \`{{hostType}}\`. The record \`{{record}}\` holds a constructor name and an empty body. Assert the parsed value: hand the subject the fixture returned to \`{{matcher}}\` and write out every field it reads, including the ones the framework fills in. Re-recording the snapshot is forbidden as a repair. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
