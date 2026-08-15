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

A spec standing up its own file system double, or naming the in-memory implementation the shared setup hides. Three families are read.

- A replacement declaration (`vi.mock` / `vi.doMock` by default) against `fs`, `fs/promises`, `node:fs` or `node:fs/promises`. The namespace and the member are followed through imports, aliases and `const` bindings, and a string-literal subscript is read as a name. Asking for the original to be wrapped with `spy: true` gets a message of its own, because the real disk stays alive
- A replacement declaration whose specifier cannot be read before the run. Declarations are hoisted, so a specifier settled at run time can never be the module it replaces
- Taking the in-memory package in as a value, through a static import, a `require`, or a dynamic import with a readable specifier. Type-only imports carry nothing at run time and are left alone

`mockNamespace`, `moduleReplacementMembers`, `fileSystemModules`, `inMemoryFileSystemPackages` and `specFileSuffixes` settle the vocabulary; derive the last two from the same place as the shared configuration. This rule holds only where that shared configuration puts one in-memory implementation behind those specifiers and rebuilds it before each test.

## Fix

Delete the local replacement and prepare the test's files through the standard file system API before calling the subject.

An automatic fix removes a replacement declaration standing as a lone statement with a readable specifier and one argument; the other shapes need a decision and are left to you.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// asking for the real implementation to be wrapped walks past the shared abstraction
// in mailer.test.ts
vi.mock('node:fs', { spy: true });
vi.mock('fs', { 'spy': true });
```

```ts
// importing the in-memory implementation binds the spec to a choice the shared setup owns
// in mailer.test.ts
import { Volume } from 'memfs';
import memfs from 'memfs';
import 'memfs';
import { Volume as Held, type IFs } from 'memfs';
import { Volume as Sub } from 'memfs/lib/volume';
```

Code this rule accepts.

```ts
// the standard file system API used as it stands is the shape this rule keeps
// in mailer.test.ts
import { writeFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
writeFileSync('/inbox/note.txt', 'body');
await writeFile('/inbox/other.txt', 'body');
```

```ts
// a type-only import binds no value at run time
// in mailer.test.ts
import type { IFs } from 'memfs';
import { type Volume } from 'memfs';
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Adding `spy: true` to call it not mocked. The real disk stays in place
- Moving the specifier into a binding, or spelling the member as a string subscript. Both are read
- Reaching the member through a computed subscript, or destructuring the replacement method. Detection stops while the replacement still happens

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
