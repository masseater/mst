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

An assertion in a spec file comparing or recording a host object that keeps its state in internal slots. `hostObjectTypes` holds the roster, `Request` and `Response` by default. Three shapes are read.

- A structural comparison with a construction of a rostered type on either side
- A partial-shape comparison naming such a construction as its expected value
- A snapshot whose recorded value is a constructor name and an empty body, where the subject is statically compatible with that constructor

A construction is a `new` call or one of the standard static factories. What counts as the runtime's own class is settled by where the declaration comes from: a name resolving to no binding, and one imported from a specifier in `runtimeModules`, are the runtime's; a class the file declares or imports from inside the repository is not. Bindings and single-return functions inside the file are followed, and nested positions are lined up before being read.

## Fix

Check the subject through the dedicated matcher, named by `parsedValueMatcher`, and write out every field it reads, including the ones the framework fills in.

```ts
await expect(response).toHaveParsedFields({
  status: 200,
  headers: { "content-type": ["application/json"] },
  body: { id: 1 },
});
```

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

- Rebuilding a record from the host object inside the fixture. The fixture hands back what the code built, and the matcher does the reading
- Loosening to a partial-shape comparison, or switching to a snapshot. Both are in range, and every record comes out the same empty body
- Binding the construction to a name or pushing it behind a function. Both are followed inside this file

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
