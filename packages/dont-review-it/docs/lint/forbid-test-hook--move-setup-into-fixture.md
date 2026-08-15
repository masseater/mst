---
description: "Disallow a spec file naming a test hook, so every subject an assertion reads is born in the fixture the test block asked for"
---

# forbid-test-hook--move-setup-into-fixture

<!-- BEGIN GENERATED rule-header -->

Disallow a spec file naming a test hook, so every subject an assertion reads is born in the fixture the test block asked for

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: yes
- Shipped in the preset: yes
- Source: [`forbid-test-hook--move-setup-into-fixture.ts`](../../src/lint/oxlint/rules/forbid-test-hook--move-setup-into-fixture.ts)

<!-- END GENERATED rule-header -->

## Violation

A spec file naming a test hook, in any of four ways.

- A hook the runner injects globally, referenced under its own name
- A hook imported from the runner, including under a binding renamed any number of times
- A hook reached through a namespace import (`runner.beforeEach`)
- A call into a module of this repository that reaches a hook itself

`hookNames` replaces the vocabulary of hook spellings, and `specFileSuffixes` settles which files are specs.

## Fix

Move the preparation the hook carried into the fixture the test block asks for, and let the fixture hand the subject back.

Delete the cleanup rather than moving it. The shared runner configuration restores state between tests.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a hook the runner injects is reported where it is named
// in order.test.ts
beforeEach(() => {
  seed();
});
```

```ts
// a hook hidden in a helper declared in this spec is reported inside that helper
// in order.test.ts
const install = () => {
  beforeEach(() => {
    seed();
  });
};
install();
```

Code this rule accepts.

```ts
// a spec that leaves preparation to its fixture names no hook
// in order.test.ts
const check = test.extend({ order: async ({}, use) => { await use(build()); } });
check('totals the lines', ({ order }) => {
  expect(order).toBe(3);
});
```

```ts
// a name the spec declares itself is not the runner hook it shadows
// in order.test.ts
const beforeEach = (run) => {
  run();
};
beforeEach(() => {
  seed();
});
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Binding the hook to another name. Alias chains are followed
- Taking the hook off a namespace import. The member is read
- Pushing the hook into a module the spec calls. The callee is followed into the module that declares it

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `testHook` | A spec file must not name the test hook \`{{hook}}\`. Every other check in this bundle starts from the subject a fixture hands to the test block, and preparation parked in a hook is born off that path, leaving a mirrored expected value, a projected subject and an inspected mock record unexamined. Move the preparation this hook carries into the fixture and have the fixture hand the subject back to the test block. Delete the cleanup it carries; the shared runner configuration already restores every test. |
| `aliasedTestHook` | A spec file must not name the test hook \`{{hook}}\` under a binding of its own. A renamed hook still prepares the subject off the path every other check in this bundle reads, the one running from a fixture to the test block that consumes it. Move the preparation this hook carries into the fixture, have the fixture hand the subject back to the test block, and delete this binding together with the hook. Cleanup stays unwritten; the shared runner configuration already restores every test. |
| `namespaceTestHook` | A spec file must not reach the test hook \`{{hook}}\` through the runner namespace. A hook taken off the namespace prepares the subject off the path every other check in this bundle reads, the one running from a fixture to the test block that consumes it. Move the preparation this hook carries into the fixture and have the fixture hand the subject back to the test block. Delete the cleanup it carries; the shared runner configuration already restores every test. |
| `testHookThroughCallee` | A spec file must not reach a test hook, and the call to \`{{through}}\` reaches one in the module that declares it. A hook hidden behind a call still prepares the subject off the path every other check in this bundle reads, the one running from a fixture to the test block that consumes it. Inline the preparation that module carries into the fixture and have the fixture hand the subject back to the test block. Delete the cleanup it carries; the shared runner configuration already restores every test. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
