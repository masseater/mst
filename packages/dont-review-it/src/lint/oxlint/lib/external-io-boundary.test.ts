import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

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

const IMPORTING_FILE = "packages/mailer/src/send.test.ts";

describe("external-io-boundary", () => {
  const workspaceTest = test.extend("workspaceRoot", ({}, { onCleanup }) => {
    const workspaceRoot = realpathSync(mkdtempSync(join(tmpdir(), "external-io-boundary-")));
    onCleanup(() => {
      rmSync(workspaceRoot, { recursive: true, force: true });
    });

    for (const [relativePath, writtenContent] of Object.entries(WORKSPACE_FILES)) {
      const writtenFile = join(workspaceRoot, relativePath);
      mkdirSync(dirname(writtenFile), { recursive: true });
      writeFileSync(writtenFile, writtenContent);
    }
    for (const [linkPath, linkedDirectory] of Object.entries(LINKED_PACKAGES)) {
      const link = join(workspaceRoot, linkPath);
      mkdirSync(dirname(link), { recursive: true });
      symlinkSync(join(workspaceRoot, linkedDirectory), link);
    }
    return workspaceRoot;
  });

  describe("a module this repository does not hold", () => {
    const it = workspaceTest.extend("replacementOfAnUnheldModule", ({ workspaceRoot }) =>
      replacedModuleAt({
        specifier: "node:fs",
        fromFile: join(workspaceRoot, IMPORTING_FILE),
        vocabulary: VOCABULARY,
      }),
    );

    it("is a boundary of its own", ({ replacementOfAnUnheldModule }) => {
      expect(replacementOfAnUnheldModule).toStrictEqual({ kind: "outsideTheRepository" });
    });
  });

  describe("a module that reaches a named module", () => {
    const it = workspaceTest.extend(
      "replacementOfAModuleReachingANamedModule",
      ({ workspaceRoot }) =>
        replacedModuleAt({
          specifier: "./transport.ts",
          fromFile: join(workspaceRoot, IMPORTING_FILE),
          vocabulary: VOCABULARY,
        }),
    );

    it("owns the boundary itself", ({ replacementOfAModuleReachingANamedModule }) => {
      expect(replacementOfAModuleReachingANamedModule).toStrictEqual({ kind: "ownsExternalIo" });
    });
  });

  describe("a module that reaches a named package", () => {
    const it = workspaceTest.extend(
      "replacementOfAModuleReachingANamedPackage",
      ({ workspaceRoot }) =>
        replacedModuleAt({
          specifier: "./client.ts",
          fromFile: join(workspaceRoot, IMPORTING_FILE),
          vocabulary: VOCABULARY,
        }),
    );

    it("owns the boundary the same way a named module does", ({
      replacementOfAModuleReachingANamedPackage,
    }) => {
      expect(replacementOfAModuleReachingANamedPackage).toStrictEqual({ kind: "ownsExternalIo" });
    });
  });

  describe("a module that reaches the outside through another one", () => {
    const it = workspaceTest.extend(
      "replacementOfAModuleOneStepInFrontOfTheBoundary",
      ({ workspaceRoot }) =>
        replacedModuleAt({
          specifier: "./send.ts",
          fromFile: join(workspaceRoot, IMPORTING_FILE),
          vocabulary: VOCABULARY,
        }),
    );

    it("stands in front of the module that holds the boundary", ({
      replacementOfAModuleOneStepInFrontOfTheBoundary,
    }) => {
      expect(replacementOfAModuleOneStepInFrontOfTheBoundary).toStrictEqual({
        kind: "behindOwnModules",
        boundary: "packages/mailer/src/transport.ts",
      });
    });
  });

  describe("a module two steps in front of the boundary", () => {
    const it = workspaceTest.extend(
      "replacementOfAModuleTwoStepsInFrontOfTheBoundary",
      ({ workspaceRoot }) =>
        replacedModuleAt({
          specifier: "./queue.ts",
          fromFile: join(workspaceRoot, IMPORTING_FILE),
          vocabulary: VOCABULARY,
        }),
    );

    it("is read the same way as one step in front", ({
      replacementOfAModuleTwoStepsInFrontOfTheBoundary,
    }) => {
      expect(replacementOfAModuleTwoStepsInFrontOfTheBoundary).toStrictEqual({
        kind: "behindOwnModules",
        boundary: "packages/mailer/src/transport.ts",
      });
    });
  });

  describe("a module that reaches nothing outside", () => {
    const it = workspaceTest.extend(
      "replacementOfAModuleReachingNothingOutside",
      ({ workspaceRoot }) =>
        replacedModuleAt({
          specifier: "./compose.ts",
          fromFile: join(workspaceRoot, IMPORTING_FILE),
          vocabulary: VOCABULARY,
        }),
    );

    it("is determined by what it is handed", ({ replacementOfAModuleReachingNothingOutside }) => {
      expect(replacementOfAModuleReachingNothingOutside).toStrictEqual({
        kind: "determinedByItsInput",
      });
    });
  });

  describe("a package named by its own name", () => {
    const it = workspaceTest.extend("replacementOfAPackageNamedByItsOwnName", ({ workspaceRoot }) =>
      replacedModuleAt({
        specifier: "@fixture/mailer",
        fromFile: join(workspaceRoot, IMPORTING_FILE),
        vocabulary: VOCABULARY,
      }),
    );

    it("is read through the entries it publishes", ({ replacementOfAPackageNamedByItsOwnName }) => {
      expect(replacementOfAPackageNamedByItsOwnName).toStrictEqual({
        kind: "behindOwnModules",
        boundary: "packages/mailer/src/transport.ts",
      });
    });
  });

  describe("a package whose published entry is absent", () => {
    const it = workspaceTest.extend("replacementOfAPackageWithAnAbsentEntry", ({ workspaceRoot }) =>
      replacedModuleAt({
        specifier: "@fixture/silent",
        fromFile: join(workspaceRoot, IMPORTING_FILE),
        vocabulary: VOCABULARY,
      }),
    );

    it("reaches nothing", ({ replacementOfAPackageWithAnAbsentEntry }) => {
      expect(replacementOfAPackageWithAnAbsentEntry).toStrictEqual({
        kind: "determinedByItsInput",
      });
    });
  });
});
