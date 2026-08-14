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

A name resolving to one of the runner's setup and teardown hooks (`beforeEach`, `afterEach`, `beforeAll`, `afterAll`) appearing inside a spec file.

The judgment runs on where the binding came from, not on matching spellings. A setup using global injection, one bringing them in with `import { beforeEach } from "vitest"`, and one renaming them with `import { beforeEach as before }` are all the same violation.

Where it stands makes no difference: straight under the file, inside a `describe`, inside a nested `describe`, inside a helper function declared in the spec file — all the same.

The shape of the call makes no difference either. The report stands the moment an identifier resolving to a hook appears. Putting them in an array and looping, calling one only under a condition, and importing one without ever calling it are all reported, because the identifier appeared. Read the call shape alone and, under global injection, no binding is left, so moving the identifier one step into a variable erases the trail.

There are four shapes of report.

| messageId | Where it stands | What is happening |
| --- | --- | --- |
| `testHook` | The identifier resolving to a hook | A hook's name appears in the spec file |
| `aliasedTestHook` | The name a hook was bound to, and its references | A hook is being rebound to another name |
| `namespaceTestHook` | The member expression through the namespace | A hook is being taken out of the runner's namespace import |
| `testHookThroughCallee` | The call expression written in the spec file | Its target reaches a hook inside the module it is declared in |

For a name a hook was bound to, the source identifier, the declaration of the bound name and each reference to it are reported separately. An imported form reports the position of the binding and the position of each reference. Every position where a hook appeared is something to rewrite, so one report stands per position.

Rebinding is followed the same way for a hook itself and for a namespace. A name rebound as `const before = beforeEach`, and the `hooks.beforeEach` behind `const hooks = runner`, are followed through bindings with no cap on the number of steps and reach the same violation. Stop at a step count and stepping one past it takes the detection off.

`testHookThroughCallee` stands where the spec file calls a name it imported and the declaration in the module that name resolves to reaches a hook. The routes followed are: that module importing a hook, that module calling a globally injected hook as it stands, and that module going through the declaration of yet another module. The walk remembers visited modules and stops, so a cycle terminates.

### Deliberately not widened

| Shape | Why it is left out |
| --- | --- |
| The shared runner configuration file | The range is settled by `specFileSuffixes`. A configuration file does not carry that suffix, so no named exclusion is held for it |
| Preparation and teardown written in a fixture's body | A fixture does not call hooks. What is written around `use` is the fixture mechanism itself, not a hook call |
| A name of the same spelling the spec file declares itself | That name does not resolve to a runner hook. The injected hook is shadowed and cannot be called |
| A member on a receiver that is not the runner's namespace | Where the receiver of `harness.beforeEach(...)` is not a namespace import, it does not resolve to a hook |
| The target module taking a hook out of a namespace import | Target resolution runs on per-name import bindings. A namespace import does not appear in the list of bindings, so this route does not reach |
| The target module calling a hook at its top level | No call is left on the spec file's side. A shared harness that installs hooks through an import side effect sits outside this detection |
| A file that is not a spec file | The range is settled by `specFileSuffixes` |

The last two are places this detection does not reach, not shapes that are allowed. A separate discipline stands against moving setup a spec owns into a shared harness at all.

### The invariant

No hook that prepares or tears a test down appears in a spec file. Preparation is held by the fixture and teardown by the shared runner configuration. Seen from a test block, the subject comes from nowhere but the fixture.

Three reasons.

First. [require-it-only-expect--move-setup-into-fixture](./require-it-only-expect--move-setup-into-fixture.md) closes only the shape "write the preparation in the test block's body". Leave hooks open and the preparation escapes there. Where it escapes is a position visible neither from the test block nor from the fixture, and the other detections in this bundle — whether the expected value mirrors the subject's construction, whether the subject is a bare identifier, whether a mock's call record is being read as a value — all start from "the subject the fixture returned", so the starting point itself is lost. Without forbidding hooks the discipline reduces to "do not write it in the test block", and the strength of the verification does not come back.

Second. Hooks create a dependence on execution order. Preparation riding on an implicit order settled by declaration order and nesting breaks as soon as the test blocks are reordered or a `describe` is added. It breaks as "an unrelated test block you did not touch fails", which takes time to trace. A fixture is evaluated per test block and carries no such dependence.

Third. Teardown is held by the shared runner configuration, so teardown written in a hook is doubled. Which one is in effect cannot be read from the code, and neither can whether one of them may be deleted.

### Configuration

| Name | Default | What it settles |
| --- | --- | --- |
| `hookNames` | `["afterAll", "afterEach", "beforeAll", "beforeEach"]` | The names treated as hooks |
| `specFileSuffixes` | `[".test.ts", ".test.tsx"]` | The suffixes of the files this rule applies to |

`hookNames` replaces rather than adds. What the default carries is the four covering before each test, after each test, before the whole file and after the whole file — every setup and teardown hook the runner offers. The API for registering teardown from inside a test block (the one called when the running test finishes) is not listed here, because writing it in the test block's body is taken by `require-it-only-expect--move-setup-into-fixture`.

`specFileSuffixes` is the same across the nine rules of this bundle. Give this rule a range of its own and changing the range leaves one side firing at nothing.

## Fix

Move the preparation that ran before each test into the fixture and return the subject. A fixture is evaluated per test block, so the "redo it for every test" property the hook carried stays exactly as it was.

Preparation that ran once for the whole suite goes out to the shared runner configuration, or is not needed at all. Where that collides with the norm against moving setup a spec owns into a shared harness, fall on the side of not needing it.

Do not write teardown. Per-test clearing and restoring is held by the shared runner configuration, and individual teardown calls are forbidden by another rule.

The rule tests in this repository already take that division. One case handed to `testLintRule` — code, filename, options, expected reports — stands as a declaration, and what stays inside the test block is the comparison alone. Cases needing a temporary file are written out from declarations at the head of the file rather than from a hook.

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

- Binding a hook to another name and calling that. The origin of the binding is read, so it falls
- Hiding the hook call in a helper function inside the spec file. The identifier appears inside the helper, so it falls
- Hiding the hook call in a helper function in another module. The target is followed, so it falls
- Calling the hook through a run-time branch or an array. The report stands on an identifier resolving to a hook appearing, not on the shape of the call, so it falls
- Taking the hook out of the runner's namespace import. The namespace binding is read, so it falls
- Rebinding the runner's namespace to another name and taking the hook out of that. Bindings are followed with no cap on the number of steps, so it falls
- Putting the preparation back in the test block's body. That lands on `require-it-only-expect--move-setup-into-fixture`
- A suppression directive

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
