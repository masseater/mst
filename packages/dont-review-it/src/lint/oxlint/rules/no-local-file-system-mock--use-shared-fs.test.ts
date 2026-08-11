import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { noLocalFileSystemMock } from "./no-local-file-system-mock--use-shared-fs.ts";

const SPEC_FILE = "mailer.test.ts";

const SOURCE_FILE = "mailer.ts";

const LOCAL_DOUBLE = { messageId: "localFileSystemDouble" };

const WRAPPED = { messageId: "wrappedFileSystemModule" };

const UNREADABLE = { messageId: "unreadableModuleSpecifier" };

const IN_MEMORY = { messageId: "inMemoryFileSystemTaken" };

describe("dont-review-it/no-local-file-system-mock--use-shared-fs", () => {
  testLintRule(noLocalFileSystemMock, {
    valid: [
      {
        name: "the standard file system API used as it stands is the shape this rule keeps",
        filename: SPEC_FILE,
        code: [
          "import { writeFileSync } from 'node:fs';",
          "import { writeFile } from 'node:fs/promises';",
          "writeFileSync('/inbox/note.txt', 'body');",
          "await writeFile('/inbox/other.txt', 'body');",
        ].join("\n"),
      },
      {
        name: "a replacement declaration for a module outside the file system is another rule's concern",
        filename: SPEC_FILE,
        code: "vi.mock('./mailer.ts');\nvi.mock('./sender.ts', () => ({ send: vi.fn() }));",
      },
      {
        name: "a call that declares no module replacement is left alone",
        filename: SPEC_FILE,
        code: [
          "vi.spyOn(mailer, 'send');",
          "vi.mocked(sendMail);",
          "mock('node:fs');",
          "helpers.vi.mock('node:fs');",
          "vi[member]('node:fs');",
          "vi[`mo${suffix}`]('node:fs');",
        ].join("\n"),
      },
      {
        name: "a private member is out of reach of this reading",
        filename: SPEC_FILE,
        code: "class Suite { #mock(target) { return target; } run() { return this.#mock('node:fs'); } }",
      },
      {
        name: "a receiver that never reaches the runner namespace declares nothing about a module",
        filename: SPEC_FILE,
        code: [
          "const declare = (vi) => vi.mock('node:fs');",
          "const builder = buildRunner();",
          "builder.mock('node:fs');",
        ].join("\n"),
      },
      {
        name: "a binding left without an initializer reaches no namespace",
        filename: SPEC_FILE,
        code: "let vi;\nvi.mock('node:fs');\nlet declare;\ndeclare('node:fs');",
      },
      {
        name: "a chain of bindings that points back at itself reaches no namespace",
        filename: SPEC_FILE,
        code: [
          "const first = second;",
          "const second = first;",
          "first.mock('node:fs');",
          "first('node:fs');",
        ].join("\n"),
      },
      {
        name: "a member bound from a receiver that is no namespace stays outside this reading",
        filename: SPEC_FILE,
        code: [
          "const declare = helpers.mock;",
          "const opened = openRunner();",
          "declare('node:fs');",
          "opened('node:fs');",
          "openRunner()('node:fs');",
        ].join("\n"),
      },
      {
        name: "a type-only import binds no value at run time",
        filename: SPEC_FILE,
        code: "import type { IFs } from 'memfs';\nimport { type Volume } from 'memfs';",
      },
      {
        name: "a package outside the in-memory implementation is not this rule's concern",
        filename: SPEC_FILE,
        code: "import { createFsFromVolume } from 'unionfs';\nimport { Volume } from 'memfs-extra';",
      },
      {
        name: "a module read whose specifier is assembled at run time names nothing this rule can read",
        filename: SPEC_FILE,
        code: [
          "const imported = await import(specifierFor(name));",
          "const read = require(specifierFor(name));",
        ].join("\n"),
      },
      {
        name: "a read that is not the synchronous module read this rule looks for is left alone",
        filename: SPEC_FILE,
        code: [
          "const mailer = require('./mailer.ts');",
          "const reached = loader.require('memfs');",
          "const loaded = load('memfs');",
        ].join("\n"),
      },
      {
        name: "a file outside the spec suffixes is outside the reach of this rule",
        filename: SOURCE_FILE,
        code: "import { Volume } from 'memfs';\nvi.mock('node:fs');",
      },
      {
        name: "a spec suffix the configuration replaced moves the reach with it",
        filename: SPEC_FILE,
        options: [{ specFileSuffixes: [".spec.ts"] }],
        code: "vi.mock('node:fs');",
      },
      {
        name: "a namespace spelling the configuration replaced no longer matches the runner",
        filename: SPEC_FILE,
        options: [{ mockNamespace: "runner" }],
        code: "vi.mock('node:fs');",
      },
      {
        name: "a replacement member the configuration dropped is no longer read as a declaration",
        filename: SPEC_FILE,
        options: [{ moduleReplacementMembers: ["doMock"] }],
        code: "vi.mock('node:fs');",
      },
      {
        name: "a file system module the configuration dropped is no longer held against the shared setup",
        filename: SPEC_FILE,
        options: [{ fileSystemModules: ["node:fs"] }],
        code: "vi.mock('fs');",
      },
      {
        name: "an in-memory package the configuration replaced leaves the previous one alone",
        filename: SPEC_FILE,
        options: [{ inMemoryFileSystemPackages: ["fake-fs"] }],
        code: "import { Volume } from 'memfs';",
      },
    ],
    invalid: [
      {
        name: "every spelling of the file system module names a double the spec stood up on its own",
        filename: SPEC_FILE,
        code: [
          "vi.mock('fs');",
          "vi.mock('fs/promises');",
          "vi.mock('node:fs');",
          "vi.mock('node:fs/promises');",
        ].join("\n"),
        output: "\n\n\n",
        errors: [LOCAL_DOUBLE, LOCAL_DOUBLE, LOCAL_DOUBLE, LOCAL_DOUBLE],
      },
      {
        name: "the deferred flavour, a template specifier, a subscripted member and a dynamic import all name the same declaration",
        filename: SPEC_FILE,
        code: [
          "vi.doMock('node:fs');",
          "vi.mock(`node:fs`);",
          "vi['mock']('node:fs');",
          "vi.mock(import('node:fs'));",
        ].join("\n"),
        output: "\n\n\n",
        errors: [LOCAL_DOUBLE, LOCAL_DOUBLE, LOCAL_DOUBLE, LOCAL_DOUBLE],
      },
      {
        name: "a specifier moved through constants is read to the end of the chain",
        filename: SPEC_FILE,
        code: [
          "const target = 'node:fs';",
          "const first = 'fs/promises';",
          "const second = first;",
          "vi.mock(target);",
          "vi.mock(second);",
        ].join("\n"),
        output:
          "const target = 'node:fs';\nconst first = 'fs/promises';\nconst second = first;\n\n",
        errors: [LOCAL_DOUBLE, LOCAL_DOUBLE],
      },
      {
        name: "an import of the runner namespace under another name still reaches it",
        filename: SPEC_FILE,
        code: [
          "import { vi as runner } from 'vitest';",
          "const derived = runner;",
          "runner.mock('node:fs');",
          "derived.mock('fs');",
        ].join("\n"),
        output: "import { vi as runner } from 'vitest';\nconst derived = runner;\n\n",
        errors: [LOCAL_DOUBLE, LOCAL_DOUBLE],
      },
      {
        name: "a declaration bound to a name and called through it is the same declaration",
        filename: SPEC_FILE,
        code: "const declare = vi.mock;\ndeclare('node:fs');",
        output: "const declare = vi.mock;\n",
        errors: [LOCAL_DOUBLE],
      },
      {
        name: "an import written with a string module export name resolves the same way",
        filename: SPEC_FILE,
        code: "import { 'vi' as runner } from 'vitest';\nrunner.mock('node:fs');",
        output: "import { 'vi' as runner } from 'vitest';\n",
        errors: [LOCAL_DOUBLE],
      },
      {
        name: "a declaration this rule leaves standing is reported without a rewrite",
        filename: SPEC_FILE,
        code: [
          "vi.mock('node:fs', () => ({ writeFileSync: vi.fn() }));",
          "vi.mock('node:fs', { partial: true });",
          "vi.mock('node:fs', { spy: wanted });",
          "vi.mock('node:fs', { spy: false });",
          "vi.mock('node:fs', { ...shared });",
          "vi.mock('node:fs', ...rest);",
          "const declared = vi.mock('node:fs');",
        ].join("\n"),
        errors: [
          LOCAL_DOUBLE,
          LOCAL_DOUBLE,
          LOCAL_DOUBLE,
          LOCAL_DOUBLE,
          LOCAL_DOUBLE,
          LOCAL_DOUBLE,
          LOCAL_DOUBLE,
        ],
      },
      {
        name: "asking for the real implementation to be wrapped walks past the shared abstraction",
        filename: SPEC_FILE,
        code: "vi.mock('node:fs', { spy: true });\nvi.mock('fs', { 'spy': true });",
        errors: [WRAPPED, WRAPPED],
      },
      {
        name: "a declaration whose target only settles at run time cannot name the module it replaces",
        filename: SPEC_FILE,
        code: [
          "vi.mock(specifierFor('fs'));",
          "vi.mock(unbound);",
          "vi.mock();",
          "vi.mock(...specifiers);",
        ].join("\n"),
        errors: [UNREADABLE, UNREADABLE, UNREADABLE, UNREADABLE],
      },
      {
        name: "a target held in a binding this rule cannot read through is the same defect",
        filename: SPEC_FILE,
        code: [
          "let written = 'node:fs';",
          "const [taken] = specifiers;",
          "let empty;",
          "const first = second;",
          "const second = first;",
          "vi.mock(written);",
          "vi.mock(taken);",
          "vi.mock(empty);",
          "vi.mock(first);",
        ].join("\n"),
        errors: [UNREADABLE, UNREADABLE, UNREADABLE, UNREADABLE],
      },
      {
        name: "importing the in-memory implementation binds the spec to a choice the shared setup owns",
        filename: SPEC_FILE,
        code: [
          "import { Volume } from 'memfs';",
          "import memfs from 'memfs';",
          "import 'memfs';",
          "import { Volume as Held, type IFs } from 'memfs';",
          "import { Volume as Sub } from 'memfs/lib/volume';",
        ].join("\n"),
        errors: [IN_MEMORY, IN_MEMORY, IN_MEMORY, IN_MEMORY, IN_MEMORY],
      },
      {
        name: "reading the in-memory implementation at run time reaches it just the same",
        filename: SPEC_FILE,
        code: [
          "const target = 'memfs';",
          "const loaded = await import('memfs');",
          "const held = await import(target);",
          "const read = require('memfs');",
        ].join("\n"),
        errors: [IN_MEMORY, IN_MEMORY, IN_MEMORY],
      },
      {
        name: "a namespace spelling the configuration replaced is followed to the new spelling",
        filename: SPEC_FILE,
        options: [{ mockNamespace: "runner" }],
        code: "runner.mock('node:fs');",
        output: "",
        errors: [LOCAL_DOUBLE],
      },
      {
        name: "a namespace spelling the configuration emptied falls back to the one built in",
        filename: SPEC_FILE,
        options: [{ mockNamespace: "" }],
        code: "vi.mock('node:fs');",
        output: "",
        errors: [LOCAL_DOUBLE],
      },
      {
        name: "a replacement member the configuration added is read as a declaration",
        filename: SPEC_FILE,
        options: [{ moduleReplacementMembers: ["replaceModule"] }],
        code: "vi.replaceModule('node:fs');",
        output: "",
        errors: [LOCAL_DOUBLE],
      },
      {
        name: "a replacement vocabulary the configuration emptied falls back to the one built in",
        filename: SPEC_FILE,
        options: [{ moduleReplacementMembers: [] }],
        code: "vi.mock('node:fs');",
        output: "",
        errors: [LOCAL_DOUBLE],
      },
      {
        name: "a file system module the configuration added is held against the shared setup",
        filename: SPEC_FILE,
        options: [{ fileSystemModules: ["node:fs/glob"] }],
        code: "vi.mock('node:fs/glob');",
        output: "",
        errors: [LOCAL_DOUBLE],
      },
      {
        name: "an in-memory package the configuration named is reached the same way",
        filename: SPEC_FILE,
        options: [{ inMemoryFileSystemPackages: ["fake-fs"] }],
        code: "import { Volume } from 'fake-fs';",
        errors: [IN_MEMORY],
      },
      {
        name: "an in-memory vocabulary the configuration emptied falls back to the one built in",
        filename: SPEC_FILE,
        options: [{ inMemoryFileSystemPackages: [] }],
        code: "import { Volume } from 'memfs';",
        errors: [IN_MEMORY],
      },
      {
        name: "replacing the file system with the in-memory implementation is reported on both counts",
        filename: SPEC_FILE,
        code: "vi.mock('node:fs', async () => import('memfs'));",
        errors: [LOCAL_DOUBLE, IN_MEMORY],
      },
    ],
  });
});
