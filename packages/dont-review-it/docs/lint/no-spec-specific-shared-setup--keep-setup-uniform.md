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
- Bundle: `testing`
- Source: [`no-spec-specific-shared-setup--keep-setup-uniform.ts`](../../src/lint/oxlint/rules/testing/no-spec-specific-shared-setup--keep-setup-uniform.ts)

<!-- END GENERATED rule-header -->

## Violation

Read in two places: the files registered in `sharedSetupFiles`, and the runner configuration.

In a shared setup file, a value that tells the running spec from the others, and a path naming an authored spec, are each reported where they steer the setup — as the test of a branch, or as an argument handed to a function. A name bound to such a value is followed, so renaming it changes nothing.

In the runner configuration, a path naming an authored spec written out inside the block that configures the run is reported.

## Fix

Delete the branch, the argument or the entry, and write the setup it selected into a fixture in the spec that needs it. Every spec gets the same starting state.

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

- Binding the identifying value to a name first. Bindings are followed
- Assembling the spec path from parts. What is read is the path a literal or a template settles

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
