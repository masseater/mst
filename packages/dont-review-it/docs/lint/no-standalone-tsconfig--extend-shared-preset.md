---
description: "Require the tsconfig.json that governs a file to extend one of the shared presets, so compiler ruleOptions are decided in one place instead of being copied into every workspace"
---

# no-standalone-tsconfig--extend-shared-preset

<!-- BEGIN GENERATED rule-header -->

Require the tsconfig.json that governs a file to extend one of the shared presets, so compiler ruleOptions are decided in one place instead of being copied into every workspace

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: yes
- Bundle: `workspace`
- Source: [`no-standalone-tsconfig--extend-shared-preset.ts`](../../src/lint/oxlint/rules/workspace/no-standalone-tsconfig--extend-shared-preset.ts)

<!-- END GENERATED rule-header -->

## Violation

A file whose governing `tsconfig.json` extends none of the shared presets. The nearest configuration is found from the file, its `extends` chain is read, and the report names the path and the preset suffixes that would have satisfied it.

The option is the list of accepted preset suffixes.

## Fix

Replace the compiler options with an `extends` naming the preset that matches how the workspace runs, and keep only what is particular to the workspace, such as `include`.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a tsconfig that writes its own compilerOptions is reported
export const total = 1;
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Extending the preset and then overriding its compiler options back. The decision moves out of the one place again
- Adding a suffix to the accepted list for a configuration that decides its own options

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `standaloneTsconfig` | The tsconfig.json that governs this file must not decide compiler ruleOptions on its own. \`{{tsconfigPath}}\` extends none of {{allowedSuffixes}}. Replace its compilerOptions with an \`extends\` naming the preset that matches how the workspace runs, and keep only what is particular to the workspace, such as \`include\`. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
