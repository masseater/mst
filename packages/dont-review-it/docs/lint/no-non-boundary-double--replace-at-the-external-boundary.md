---
description: "Disallow replacing a module that does not own an external I/O boundary itself, so a spec cannot take the code it is supposed to be checking out of the run and call what is left a verification"
---

# no-non-boundary-double--replace-at-the-external-boundary

<!-- BEGIN GENERATED rule-header -->

Disallow replacing a module that does not own an external I/O boundary itself, so a spec cannot take the code it is supposed to be checking out of the run and call what is left a verification

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: yes
- Shipped in the preset: yes
- Source: [`no-non-boundary-double--replace-at-the-external-boundary.ts`](../../src/lint/oxlint/rules/no-non-boundary-double--replace-at-the-external-boundary.ts)

<!-- END GENERATED rule-header -->

## Violation

A module replacement declaration in a spec whose target does not own an external I/O boundary itself. Two reports.

- The target's output is determined by its input. Nothing it reaches leaves the process, so replacing it takes the decision out of the run
- The target reaches the outside only through another module of this repository. Replacing it takes everything between the two out of the run along with the I/O, and the report names the module that owns the boundary

The vocabulary of modules that do reach outside comes from `externalIoModules`, which defaults to the platform's I/O builtins in both their prefixed and unprefixed spellings, and `externalIoPackages`, which defaults to empty. `moduleReplacementMembers` and `specFileSuffixes` settle the rest.

## Fix

Delete the declaration and let the real module answer what the test hands it. Where a boundary genuinely has to be replaced, declare it against the module that owns the boundary.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a module whose output is determined by its input is reported
// in packages/mailer/src/send.test.ts
vi.mock('./compose.ts');
```

```ts
// a module that reaches the outside only through another module is reported
// in packages/mailer/src/send.test.ts
vi.mock('./send.ts');
```

Code this rule accepts.

```ts
// a module that lives outside this repository is a boundary the spec may take
// in packages/mailer/src/send.test.ts
vi.mock('node:child_process');
```

```ts
// a module that owns the boundary itself is the place to replace
// in packages/mailer/src/send.test.ts
vi.mock('./transport.ts');
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Moving the replacement one module further in. Everything between it and the boundary leaves the run
- Adding the target to `externalIoModules` so it reads as a boundary. The vocabulary names what actually leaves the process

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `determinedModuleDouble` | A module replacement must not take a module whose output is determined by its input. Nothing \`{{specifier}}\` reaches leaves this process, so what it returns is decided by what it is handed, and this declaration takes that decision out of the run. Delete the declaration and let the real module answer what the test hands it. |
| `insideBoundaryDouble` | A module replacement must not stand in front of the module that owns the boundary. \`{{specifier}}\` reaches the outside only through \`{{boundary}}\`, so replacing it here takes everything between the two out of the run along with the I/O. Move the declaration to \`{{boundary}}\`, which is the module this repository owns the boundary in, and let the modules in between run. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
