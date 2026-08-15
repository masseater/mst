---
description: "Disallow a module replacement declaration from carrying a factory, so what a replaced module hands back is declared by the fixture of the test that reads it instead of being fixed once for every test in the file"
---

# no-vi-mock-factory-behavior--use-spy-true-and-fixture

<!-- BEGIN GENERATED rule-header -->

Disallow a module replacement declaration from carrying a factory, so what a replaced module hands back is declared by the fixture of the test that reads it instead of being fixed once for every test in the file

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: yes
- Shipped in the preset: yes
- Source: [`no-vi-mock-factory-behavior--use-spy-true-and-fixture.ts`](../../src/lint/oxlint/rules/no-vi-mock-factory-behavior--use-spy-true-and-fixture.ts)

<!-- END GENERATED rule-header -->

## Violation

A module replacement declaration carrying a factory. Two reports: the factory being there at all, and the factory's body settling what a mock hands back through a behaviour setter. What the factory fixes holds for every test in the file, while what a replaced module answers belongs to the fixture of the test that reads it.

An exemption comment naming this rule, written above the declaration with grounds after `--`, takes it out of the report; one written without grounds is itself reported. `builtinModulePrefixes` settles which specifiers count as the platform's.

## Fix

Pass `{ spy: true }` as the second argument and let the replaced module answer, so the replacement records how it was called and settles nothing. Where a test needs a particular answer, declare it in that test's fixture.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a factory that returns a container is reported
vi.mock("./module.ts", () => ({ read: vi.fn() }));
```

```ts
// settling what a mock hands back is reported beside the shape
vi.mock("./module.ts", () => ({ read: vi.fn().mockReturnValue(1) }));
```

Code this rule accepts.

```ts
// handing the wrapping option over passes
vi.mock("./module.ts", { spy: true });
```

```ts
// a factory that returns an empty object passes
vi.mock("./module.ts", () => ({}));
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Keeping the factory and returning values from a helper it calls. The body still settles the answer
- Writing the exemption comment without grounds. It is reported until they are written

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `factoryShape` | A module replacement declaration must not hand over a factory. Pass \`{ spy: true }\` as the second argument and let the replaced module answer, so the replacement records how it was called and settles nothing. |
| `factoryBehaviour` | The body of a module replacement factory must not settle what a mock hands back. Delete every return value, resolved value, rejected value and implementation written here, and leave the replacement a pass-through that only records how it was called. |
| `unreasonedExemption` | An exemption comment must not stand without grounds. Write the grounds for this exemption after \`--\`, and name there the boundary this spec replaces by hand. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
