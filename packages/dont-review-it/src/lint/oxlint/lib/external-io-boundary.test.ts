import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, onTestFinished, test } from "vite-plus/test";

import { replacedModuleAt } from "./external-io-boundary.ts";

const WORKSPACE_FILES: Readonly<Record<string, string>> = {
  "pnpm-workspace.yaml": "packages:\n  - packages/*\n",
  "packages/mailer/package.json": JSON.stringify({
    name: "@fixture/mailer",
    exports: { ".": "./src/index.ts" },
  }),
  "packages/mailer/src/index.ts": 'export * from "./transport.ts";\n',
  "packages/mailer/src/transport.ts":
    'import { writeFileSync } from "node:fs";\nexport const deliver = (path: string): void => writeFileSync(path, "");\n',
  "packages/mailer/src/send.ts":
    'import { deliver } from "./transport.ts";\nexport const send = (path: string): void => deliver(path);\n',
  "packages/mailer/src/queue.ts":
    'import { send } from "./send.ts";\nexport const queue = (path: string): void => send(path);\n',
  "packages/mailer/src/compose.ts":
    'import { join } from "node:path";\nexport const compose = (a: string, b: string): string => join(a, b);\n',
  "packages/mailer/src/client.ts":
    'import { fetch } from "undici/fetch";\nexport const ask = async (url: string) => fetch(url);\n',
  "packages/silent/package.json": JSON.stringify({
    name: "@fixture/silent",
    exports: { ".": "./src/absent.ts" },
  }),
};

const LINKED_PACKAGES: Readonly<Record<string, string>> = {
  "node_modules/@fixture/mailer": "packages/mailer",
  "node_modules/@fixture/silent": "packages/silent",
};

const VOCABULARY = {
  modules: new Set(["node:fs"]),
  packages: new Set(["undici"]),
};

const workspaceRoot = (): string => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "external-io-boundary-")));
  onTestFinished(() => {
    rmSync(root, { recursive: true, force: true });
  });

  for (const [relativePath, writtenContent] of Object.entries(WORKSPACE_FILES)) {
    const path = join(root, relativePath);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, writtenContent);
  }
  for (const [linkPath, linkedDirectory] of Object.entries(LINKED_PACKAGES)) {
    const link = join(root, linkPath);
    mkdirSync(dirname(link), { recursive: true });
    symlinkSync(join(root, linkedDirectory), link);
  }
  return root;
};

const replacedFrom = (specifier: string) =>
  replacedModuleAt({
    specifier,
    fromFile: join(workspaceRoot(), "packages/mailer/src/send.test.ts"),
    vocabulary: VOCABULARY,
  });

describe("external-io-boundary", () => {
  test("a module this repository does not hold is a boundary of its own", () => {
    expect(replacedFrom("node:fs")).toStrictEqual({ kind: "outsideTheRepository" });
  });

  test("a module that reaches a named module itself owns the boundary", () => {
    expect(replacedFrom("./transport.ts")).toStrictEqual({ kind: "ownsExternalIo" });
  });

  test("a module that reaches a named package itself owns the boundary", () => {
    expect(replacedFrom("./client.ts")).toStrictEqual({ kind: "ownsExternalIo" });
  });

  test("a module that reaches the outside through another one stands in front of it", () => {
    expect(replacedFrom("./send.ts")).toStrictEqual({
      kind: "behindOwnModules",
      boundary: "packages/mailer/src/transport.ts",
    });
  });

  test("a module two steps in front of the boundary is read the same way as one", () => {
    expect(replacedFrom("./queue.ts")).toStrictEqual({
      kind: "behindOwnModules",
      boundary: "packages/mailer/src/transport.ts",
    });
  });

  test("a module that reaches nothing outside is determined by what it is handed", () => {
    expect(replacedFrom("./compose.ts")).toStrictEqual({ kind: "determinedByItsInput" });
  });

  test("a package named by its own name is read through the entries it publishes", () => {
    expect(replacedFrom("@fixture/mailer")).toStrictEqual({
      kind: "behindOwnModules",
      boundary: "packages/mailer/src/transport.ts",
    });
  });

  test("a package whose published entry is absent reaches nothing", () => {
    expect(replacedFrom("@fixture/silent")).toStrictEqual({ kind: "determinedByItsInput" });
  });
});
