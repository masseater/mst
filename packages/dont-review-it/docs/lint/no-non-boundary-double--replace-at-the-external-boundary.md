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

A module replacement written in a spec file (`vi.mock` and `vi.doMock`) whose target is a module of this repository and where that module itself holds no external I/O.

The target is identified by resolving the specifier. Written as a string literal, a template literal or `import("...")`, it is read as the same specifier and resolved from the spec file's position. A specifier that does not resolve — a node built-in, or a package in `node_modules` — lies outside this repository and is the boundary itself, so it is not reported. A specifier written as a workspace package name is read against the entry that package publishes.

For a resolvable target, the specifiers that module imports are read. Importing a specifier in the external I/O vocabulary **directly** means that module holds a boundary. Not reported.

Where it does not hold one directly, imports are followed transitively from there.

- Where the walk reaches no module holding a boundary, it is a module whose output is settled by its input (`determinedModuleDouble`)
- Where the walk reaches a module holding a boundary, the target stands in front of the boundary (`insideBoundaryDouble`). The message names that module's position

The external I/O vocabulary splits in two. Node built-ins are settled by name, so the rule holds them as a default. Packages in `node_modules` cannot be walked into, so a consumer lists their names in `externalIoPackages`. That is the only place a person declares anything.

### The boundary with the other rules

The rules reading whether a replacement is permissible divide across three, each reading something different.

| Shape | What reads it |
| --- | --- |
| Replacing the file system per spec | [no-local-file-system-mock--use-shared-fs](./no-local-file-system-mock--use-shared-fs.md) |
| Building a standard I/O double per spec | [no-handmade-standard-io-double--use-standard-io-test](./no-handmade-standard-io-double--use-standard-io-test.md) |
| Writing behaviour into a replaced module | [no-vi-mock-factory-behavior--use-spy-true-and-fixture](./no-vi-mock-factory-behavior--use-spy-true-and-fixture.md) |
| Whether the target may be replaced at all | This rule |

The `node:fs` and standard I/O the first two handle lie outside this repository and are, from this rule's view, the boundary itself, so they are not reported. A state where two rules report the same violation in different words is not built.

### Where the judgment does not reach

- `vi.spyOn(object, "member")` targets an object rather than a module, so this analysis does not apply
- A specifier assembled at run time cannot be read. That is closed by [forbid-unresolvable-module-specifier--write-a-statically-resolvable-specifier](./forbid-unresolvable-module-specifier--write-a-statically-resolvable-specifier.md)
- Identification across re-exports has limits. No type information is used; only specifier resolution and a file's imports are read

### The invariant

What may be replaced is only the region that test was claiming nothing about in the first place. [How tests are written](../../../../docs/guidelines/tests.md) states this as two prohibitions: do not replace an in-process dependency whose output is settled by its input, and where a failure of an external process or a communication fault has to be created, keep the replacement at that same external boundary rather than stepping inside it.

The norm existed with no layer enforcing it. A per-boundary rule teaches "how to handle that boundary correctly"; no layer read "may this target be replaced at all".

About whatever was replaced, the test claims nothing. A test that replaced a module whose output is settled by its input has taken what it could have verified out of the run itself and submitted the remainder as evidence. A test that replaced in front of a boundary has, on top of that, taken the modules between the target and the boundary out of the run too. Neither turns red. The tests pass, and the vanished range meets nobody's eye.

### Why it is settled by reach rather than by declaration

A shape declaring "the list of targets that may be replaced" as configuration and reconciling against it is available. It is not taken. That is not a judgment but a relocated declaration, and nobody verifies whether the list is right. Being in the list becomes the grounds, so the moment a module is added, it may be replaced.

Settle it by reach and the grounds sit in the code. Whether a module holds external I/O is settled by what it imports, and rewriting the imports changes the judgment. All a person declares is the names of `node_modules` packages, and that is the minimum declaration following from the fact that they cannot be walked into.

### Configuration

- `externalIoModules` — the built-in modules holding external I/O. The default lines up the ways in for the file system, the process, the network, the clock and randomness, and holds both the `node:`-prefixed and unprefixed spellings
- `externalIoPackages` — the `node_modules` package names holding external I/O. The default is empty; a consumer lists them. A specifier with a subpath (`undici/fetch`) counts as the same package where its leading part is listed here
- `moduleReplacementMembers` — the member spellings read as a module replacement
- `specFileSuffixes` — the suffixes read as spec files

### Not violations

- Node built-ins and `node_modules` packages. They lie outside this repository and are the boundary
- A module directly importing external I/O
- A replacement written in a file that is not a spec
- A specifier that cannot be read statically

## Fix

**Where it was a module whose output is settled by its input.** Delete the replacement declaration and call the real thing. Where the test wants to prepare a value, hand that value to the target as an argument. Where it is not in a shape that accepts one, building an injection boundary is a design change on the implementation side, and "how much of the real thing to keep" in [how tests are written](../../../../docs/guidelines/tests.md) holds the conditions for it.

**Where it was in front of the boundary.** Move the declaration to the module the message names. That is the module holding external I/O in this repository.

```ts
// reported: send.ts leaves only through transport.ts
vi.mock(import("./send.ts"), { spy: true });

// passes: transport.ts imports node:fs directly
vi.mock(import("./transport.ts"), { spy: true });
```

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

- Adding one external I/O import to the target you want to replace so it looks like a boundary. The boundary's position is settled by imports so the judgment changes, but whether that import is needed by the implementation is a separate question
- Listing packages that hold no external I/O in `externalIoPackages`. That vocabulary is where "packages that cannot be walked into and that leave the process" are written
- A suppression directive

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
