---
description: "Disallow a spec standing up its own file system double or naming the in-memory implementation behind the standard API, so every spec reads and writes through one abstraction that the shared setup rebuilds before each test"
---

# no-local-file-system-mock--use-shared-fs

<!-- BEGIN GENERATED rule-header -->

Disallow a spec standing up its own file system double or naming the in-memory implementation behind the standard API, so every spec reads and writes through one abstraction that the shared setup rebuilds before each test

- Tool: `oxlint`
- Fixable: yes
- Suggestions: no
- Options: yes
- Shipped in the preset: yes
- Source: [`no-local-file-system-mock--use-shared-fs.ts`](../../src/lint/oxlint/rules/no-local-file-system-mock--use-shared-fs.ts)

<!-- END GENERATED rule-header -->

## Violation

This rule holds only together with the shared test configuration. Before enabling it, both of these must be in place.

- The file system module's specifiers, across the prefixed and unprefixed spellings and the synchronous and promise flavours, all resolve to one shared in-memory implementation
- A shared setup rebuilds that area before each test and prepares whatever initial state is needed

Enable the rule alone without those two and a spec is left with neither a means of replacement nor a means of teardown. What the rule forbids is "a spec holding one of its own", not "nobody holding one".

Only spec files are in scope. They are settled by the file name suffix; the default is `.test.ts` and `.test.tsx`, replaceable through `specFileSuffixes`. Whether an implementation package depends on an in-memory file system is none of this rule's business, so the range closes on specs.

Three families are read.

### A replacement declaration against a file system module

Replacement declarations are `mock` and `doMock` on the runner's mock namespace. The namespace is settled by a plain spelling match and, additionally, by following bindings to their declaration inside the same file. An import taken under another name, a reference put through a constant first, and a globally injected setup are all treated the same. Member names are read from a string-literal subscript and a template-literal subscript with no interpolation as well.

Binding the replacement method itself to a `const` and calling that is treated as the original method call, where the binding's source is followable inside the same file. A binding taken out by destructuring is not followed.

The string specifier readable statically from the first argument is taken, and the report stands where it is one of these four.

| Specifier | Origin |
| --- | --- |
| `fs` | Unprefixed, synchronous |
| `fs/promises` | Unprefixed, promise |
| `node:fs` | Prefixed, synchronous |
| `node:fs/promises` | Prefixed, promise |

The specifier may be a string literal, a template literal with no interpolation, a `const` binding resolvable to one string literal inside the same file, or any of those placed inside a dynamic import.

Only where the second argument's options carry the wrap-the-real-thing setting `spy` as a true literal is a different message reported. The wrapping form lets the real file system implementation through alive, so it walks past the shared in-memory abstraction. The reason differs, so the message does. Everything else — handing over a factory, other options, a false wrap setting, a non-literal wrap setting, a single argument — is reported as setting up a local double.

### A replacement declaration whose specifier cannot be read statically

Where an expression settling only at run time is handed as the specifier, whether that replacement targets the file system cannot be judged. Overlook it on the grounds that it cannot be judged and this rule is evaded by moving the specifier into a variable. So identifying the target is given up, and **writing a replacement declaration with a specifier that cannot be read statically** is itself reported as a third message.

There are no false positives. Replacement declarations are hoisted and evaluated before loading, so no legitimate use exists for handing over a specifier assembled at run time. A specifier held in a rewritable binding (`let` / `var`), and one taken out by destructuring, fall into this family.

### Taking the in-memory implementation in as a value

A spec taking in, as a value, the in-memory file system package the shared setup uses internally is reported. Both the package name itself and subpaths under it are read. Three positions are read.

- A static `import` declaration
- A synchronous read call (`require`)
- A dynamic import whose specifier is readable statically

Which package it is follows the shared setup's choice, so `inMemoryFileSystemPackages` must be derived from the same one place as the shared configuration. The default is `memfs`.

### Not violations

| Shape | Why it is left out |
| --- | --- |
| A type-only import | Nothing happens at run time. It is no coupling to an implementation detail |
| A replacement declaration against a module other than the file system | Only where the specifier is readable statically and is none of the four |
| A call that is not a replacement declaration | Installing a spy, a plain function call of the same name, a method on an object that reaches no mock namespace when its binding is followed, a method behind a property walk, a private identifier |
| A call through a computed subscript | The member's name cannot be read. A string-literal subscript is read as a name and is in scope |
| Using the language's standard file system API as it stands | This is the right shape |
| A dynamic import assembling its specifier at run time | The value settles only at run time, so whether it names the in-memory implementation is not settled |

The last two are information this reading does not hold rather than a convenience of the implementation. Unlike a replacement declaration, a dynamic import cannot be reported wholesale as "a read with an unreadable specifier": a spec computing a specifier to verify lazy-loading behaviour is legitimate. Not reaching does not mean it is allowed, so they are named in the forbidden bypasses section.

### The invariant

A spec uses the file system through the language's standard API as it stands, and does not know who has cut that off from a real disk.

In an environment where the shared configuration holds that resolution and that teardown, a spec setting up a double of its own breaks in three ways.

First, the shared abstraction and the spec-local double become two things to maintain, and their real behaviour diverges. Second, a local double sits outside the shared setup's per-test initialization, so file state carries over between tests. Third, taking the in-memory implementation in directly couples the spec to an implementation detail the shared setup hides, so replacing the shared side breaks the spec.

The second matters most under parallel execution. Tests are written assuming they run in parallel both per file and per `it` inside one file. The file system is broad mutable state every test in that file touches at once, and carried over uninitialized, results depend on execution order. Which test runs next can change from run to run, so the failure appears in a form that does not reproduce.

The wrapping form gets its own message for the same reason. It reads as "not mocked", but with the real implementation alive, writes land on a face no initialization in the shared setup reaches.

### Configuration

| Name | Default | What it lines up with |
| --- | --- | --- |
| `mockNamespace` | `vi` | The mock namespace of the test runner in use |
| `moduleReplacementMembers` | `doMock` / `mock` | The spellings of that runner's replacement declarations |
| `fileSystemModules` | `fs` / `fs/promises` / `node:fs` / `node:fs/promises` | The specifiers the shared configuration aliases |
| `inMemoryFileSystemPackages` | `memfs` | The package the shared configuration chose as those specifiers' target |
| `specFileSuffixes` | `.test.ts` / `.test.tsx` | The range shared with the other rules of this bundle |

`fileSystemModules` and `inMemoryFileSystemPackages` appear in the configuration because they mean nothing unless they match the shared configuration's contents. Make what the shared configuration aliases the detection target as it stands, and derive both from the same one place. Handing over an empty array returns to the default.

The spelling of the wrap-the-real-thing setting (`spy`) is not exposed in the configuration. Respell it and the wrapping form is still reported as a local double, so making it removable is no way out — it would only add one more thing to reconcile against the shared configuration.

## Fix

Delete the local replacement declaration and prepare the test's files through the standard API before calling the target. The body of the test is what it was before the shared configuration arrived.

```ts
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vite-plus/test";

import { nearestTsconfigExtends } from "./nearest-tsconfig.ts";

describe("nearestTsconfigExtends", () => {
  it("reads a single extends entry as a list of one", () => {
    mkdirSync("/workspace/single", { recursive: true });
    writeFileSync("/workspace/single/tsconfig.json", '{ "extends": "./preset.json" }\n');

    expect(nearestTsconfigExtends("/workspace/single/index.ts")?.specifiers).toStrictEqual([
      "./preset.json",
    ]);
  });
});
```

The automatic fix covers only a replacement declaration written as a lone statement with a statically readable specifier and one argument. A form with a factory, one with a wrap setting, one whose specifier cannot be read statically, and taking the in-memory implementation in are not fixed automatically. Each needs a decision about moving the intent to the shared abstraction or to dependency injection on the production side, and a mechanical deletion would change the meaning.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// asking for the real implementation to be wrapped walks past the shared abstraction
// in mailer.test.ts
vi.mock('node:fs', { spy: true });
vi.mock('fs', { 'spy': true });
```

Code this rule accepts.

```ts
// a type-only import binds no value at run time
// in mailer.test.ts
import type { IFs } from 'memfs';
import { type Volume } from 'memfs';
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Adding the wrap setting to call it "not mocked". The real implementation stays alive and walks past the shared abstraction
- Taking the in-memory implementation in directly and operating its area from the spec
- Moving the specifier into a constant. A `const` inside the same file is followed to one string literal, so the report does not clear
- Assembling the specifier at run time and handing it to a replacement declaration. An unreadable specifier is itself reported
- Writing the member as a string subscript. A string-literal subscript is read as a name
- Rebinding the replacement method to another name and calling that. `const` bindings are followed, so the report does not clear
- Writing the member as a computed subscript. It disappears from this reading, and the replacement still happens
- Taking the replacement method out by destructuring and calling that. It disappears from this reading, and the replacement still happens
- Assembling the specifier at run time to load the in-memory implementation dynamically. It disappears from this reading, and the coupling to an implementation detail is unchanged
- Pushing the replacement, or the in-memory import, into a helper file carrying no spec suffix. This reading looks at spec files only
- Adding special handling for this spec to the shared setup. The shared setup has to stay one place invisible from a spec
- Emptying the vocabulary by removing names from `fileSystemModules` or `inMemoryFileSystemPackages`
- A suppression directive

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `localFileSystemDouble` | A spec must not stand up its own file system double. Delete this \`{{member}}\` declaration for \`{{specifier}}\` and create whatever files the test needs through the standard file system API before calling the subject. The shared test setup already puts an in-memory implementation behind that specifier and rebuilds it before each test, so a double declared here is a second implementation that drifts from the shared one and carries file state across tests running beside it. Handing a factory, moving the specifier into a binding, and spelling the member out as a string subscript are all read as this same declaration. |
| `wrappedFileSystemModule` | A file system replacement must not keep the real implementation. Delete this \`{{member}}\` declaration for \`{{specifier}}\` instead of asking for the original to be wrapped. Wrapping leaves the real disk in place, so the spec walks straight past the in-memory implementation the shared setup put behind that specifier and writes to a surface no per-test rebuild reaches. Create the files the test needs through the standard file system API and call the subject. |
| `unreadableModuleSpecifier` | A module replacement declaration must not take a target that only settles at run time. Write the module out as a string literal at this \`{{member}}\` call. The declaration is hoisted above the imports and evaluated before any of them, so a specifier assembled at run time cannot be the module it replaces, and a target nobody can read cannot be held against the file system modules the shared setup owns. |
| `inMemoryFileSystemTaken` | A spec must not take the in-memory file system implementation as a value. Drop this reach for \`{{specifier}}\` and go through the standard file system API instead. Which implementation stands behind that API is the shared setup's to choose and the spec's not to see: naming it here ties the spec to a choice that will change under it, and the region reached this way sits outside the rebuild the shared setup runs before each test. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
