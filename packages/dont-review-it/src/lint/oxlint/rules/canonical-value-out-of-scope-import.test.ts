import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { STRICT_RULE } from "./canonical-literal-rule-test-fixture.ts";

const REPOSITORY_ROOT = join(tmpdir(), `canonical-value-declaration-source-${randomUUID()}`);
const EXTERNAL_AGENTS_ROOT = join(tmpdir(), `canonical-value-local-agents-${randomUUID()}`);
const REFERENCE_TYPE =
  '/// <reference path="../fixtures/status.d.ts" />\nexport type LocalStatus = FixtureStatus;\n';
const REFERENCE_VALUE =
  '/// <reference path="../fixtures/status.d.ts" />\nexport const schema = z.enum(FIXTURE_STATUSES);\n';
const AMBIENT_GLOBAL = "export type LocalStatus = FixtureStatus;\n";
const AMD_NAMED =
  '/// <amd-dependency path="../fixtures/status.ts" name="fixtureStatus" />\nconsume(fixtureStatus.STATUS);\n';
const AMD_SIDE_EFFECT =
  '/// <amd-dependency path="../fixtures/status.ts" />\nconsume("production");\n';
const UNUSED_DECLARATION = "export type LocalStatus = string;\n";
const KNOWN_PRODUCTION_IMPORT = 'import { STATUS } from "./status.ts";\nconsume(STATUS);\n';
const UNKNOWN_DYNAMIC_IMPORT = "declare const source: string;\nvoid import(source);\n";
const PUBLIC_WORKER = 'new Worker("/worker.js", { type: "module" });\n';
const LOCAL_AGENTS_IMPORT =
  'import { VALUES } from "../.local-agents/status.ts";\nexport const value = VALUES[0];\n';
const FILES: Readonly<Record<string, string>> = {
  "fixtures/status.d.ts":
    'type FixtureStatus = "draft" | "published";\ndeclare const FIXTURE_STATUSES: readonly ["draft", "published"];\n',
  "fixtures/status.ts": 'export const STATUS = "draft";\n',
  "fixtures/worker.js": 'globalThis.postMessage("draft");\n',
  "package.json": JSON.stringify({ private: true, workspaces: [] }),
  "src/ambient-global.ts": AMBIENT_GLOBAL,
  "src/amd-named.ts": AMD_NAMED,
  "src/amd-side-effect.ts": AMD_SIDE_EFFECT,
  "src/reference-type.ts": REFERENCE_TYPE,
  "src/reference-value.ts": REFERENCE_VALUE,
  "src/local-agents.ts": LOCAL_AGENTS_IMPORT,
  "src/status.ts": 'export const STATUS = "production";\n',
  "src/unused.ts": UNUSED_DECLARATION,
  "vite.config.ts":
    'export default { publicDir: "fixtures", plugins: [{ name: "dynamic-resolver", resolveId() { return null; } }] };\n',
};

for (const [relativePath, contents] of Object.entries(FILES)) {
  const absolutePath = join(REPOSITORY_ROOT, relativePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, contents, "utf8");
}
mkdirSync(EXTERNAL_AGENTS_ROOT, { recursive: true });
writeFileSync(
  join(EXTERNAL_AGENTS_ROOT, "status.ts"),
  'export const VALUES = ["draft", "published"] as const;\n',
  "utf8",
);
symlinkSync(EXTERNAL_AGENTS_ROOT, join(REPOSITORY_ROOT, ".local-agents"), "dir");
process.once("exit", () => {
  rmSync(REPOSITORY_ROOT, { force: true, recursive: true });
  rmSync(EXTERNAL_AGENTS_ROOT, { force: true, recursive: true });
});

describe("out-of-scope TypeScript declaration sources", () => {
  testLintRule(STRICT_RULE, {
    valid: [
      {
        name: "an unused out-of-scope declaration file does not reject production",
        code: UNUSED_DECLARATION,
        cwd: REPOSITORY_ROOT,
        filename: join(REPOSITORY_ROOT, "src/unused.ts"),
      },
    ],
    invalid: [
      {
        name: "a triple-slash type reference cannot supply a production type",
        code: REFERENCE_TYPE,
        cwd: REPOSITORY_ROOT,
        filename: join(REPOSITORY_ROOT, "src/reference-type.ts"),
        errors: [{ messageId: "productionImportsOutOfScopeSource" }],
      },
      {
        name: "a triple-slash value reference cannot supply a production value",
        code: REFERENCE_VALUE,
        cwd: REPOSITORY_ROOT,
        filename: join(REPOSITORY_ROOT, "src/reference-value.ts"),
        errors: [{ messageId: "productionImportsOutOfScopeSource" }],
      },
      {
        name: "an ambient global cannot hide its out-of-scope declaration source",
        code: AMBIENT_GLOBAL,
        cwd: REPOSITORY_ROOT,
        filename: join(REPOSITORY_ROOT, "src/ambient-global.ts"),
        errors: [{ messageId: "productionImportsOutOfScopeSource" }],
      },
      {
        name: "a named AMD dependency cannot load an out-of-scope source",
        code: AMD_NAMED,
        cwd: REPOSITORY_ROOT,
        filename: join(REPOSITORY_ROOT, "src/amd-named.ts"),
        errors: [{ messageId: "productionImportsOutOfScopeSource" }],
      },
      {
        name: "a side-effect AMD dependency cannot load an out-of-scope source",
        code: AMD_SIDE_EFFECT,
        cwd: REPOSITORY_ROOT,
        filename: join(REPOSITORY_ROOT, "src/amd-side-effect.ts"),
        errors: [{ messageId: "productionImportsOutOfScopeSource" }],
      },
      {
        name: "an open Vite resolver cannot make an existing production resolution trusted",
        code: KNOWN_PRODUCTION_IMPORT,
        cwd: REPOSITORY_ROOT,
        filename: join(REPOSITORY_ROOT, "src/known-production.ts"),
        errors: [{ messageId: "productionImportsOutOfScopeSource" }],
      },
      {
        name: "an unresolved dynamic module specifier is rejected",
        code: UNKNOWN_DYNAMIC_IMPORT,
        cwd: REPOSITORY_ROOT,
        filename: join(REPOSITORY_ROOT, "src/unknown-dynamic.ts"),
        errors: [{ messageId: "productionImportsOutOfScopeSource" }],
      },
      {
        name: "a browser module consumer resolves public URLs through Vite publicDir",
        code: PUBLIC_WORKER,
        cwd: REPOSITORY_ROOT,
        filename: join(REPOSITORY_ROOT, "src/public-worker.ts"),
        errors: [{ messageId: "productionImportsOutOfScopeSource" }],
      },
      {
        name: "a lexical local agents path remains out of scope across a symbolic link",
        code: LOCAL_AGENTS_IMPORT,
        cwd: REPOSITORY_ROOT,
        filename: join(REPOSITORY_ROOT, "src/local-agents.ts"),
        errors: [{ messageId: "productionImportsOutOfScopeSource" }],
      },
    ],
  });
});
