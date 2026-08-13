import { mkdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import {
  UNSCANNED_DIRECTORY_NAMES,
  worktreeFilePathsUnder,
} from "../repository-scan/worktree-files.ts";
import { isRunnerConfigurationFile, sharedSetupFilesUnder } from "./registered-setup-files.ts";

const FIXTURE_ROOT = join(realpathSync(tmpdir()), "dont-review-it-registered-setup-files");

describe("isRunnerConfigurationFile", () => {
  describe("a module carrying the name the toolchain gives the runner configuration", () => {
    const it = test.extend("runnerConfigurationReadingOfTheConfigurationName", () =>
      isRunnerConfigurationFile("packages/held/vite.config.ts"));

    it("reads it as the runner configuration", ({
      runnerConfigurationReadingOfTheConfigurationName,
    }) => {
      expect(runnerConfigurationReadingOfTheConfigurationName).toBe(true);
    });
  });

  describe("a module that is not the runner configuration", () => {
    const it = test.extend("runnerConfigurationReadingOfAModuleThatIsNotTheConfiguration", () =>
      isRunnerConfigurationFile("packages/held/vitest.setup.ts"));

    it("leaves it alone", ({ runnerConfigurationReadingOfAModuleThatIsNotTheConfiguration }) => {
      expect(runnerConfigurationReadingOfAModuleThatIsNotTheConfiguration).toBe(false);
    });
  });
});

describe("sharedSetupFilesUnder", () => {
  describe("a runner block that registers setup modules", () => {
    const it = test.extend("setupTheRunnerRegistersAndEverythingItReaches", () => {
      const root = join(FIXTURE_ROOT, "registered");
      rmSync(root, { recursive: true, force: true });
      mkdirSync(join(root, "setup"), { recursive: true });
      writeFileSync(join(root, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n");
      writeFileSync(join(root, "package.json"), '{ "name": "@fixture/root" }\n');
      writeFileSync(
        join(root, "vite.config.ts"),
        'import { defineConfig } from "vite-plus";\n\nexport default defineConfig({ test: { setupFiles: ["./setup/shared.setup.ts"], globalSetup: "setup/global.ts" } });\n',
      );
      writeFileSync(join(root, "setup/shared.setup.ts"), 'import "./reached.ts";\n');
      writeFileSync(join(root, "setup/reached.ts"), "export const seeded = 1;\n");
      writeFileSync(join(root, "setup/global.ts"), "export const started = 1;\n");
      writeFileSync(join(root, "setup/unreached.ts"), "export const idle = 1;\n");
      return sharedSetupFilesUnder({ workspaceRoot: root, declaredEntries: [] });
    });

    it("takes every module the runner registers as setup and everything they reach", ({
      setupTheRunnerRegistersAndEverythingItReaches,
    }) => {
      expect(setupTheRunnerRegistersAndEverythingItReaches).toStrictEqual(
        new Set([
          join(FIXTURE_ROOT, "registered", "setup/global.ts"),
          join(FIXTURE_ROOT, "registered", "setup/reached.ts"),
          join(FIXTURE_ROOT, "registered", "setup/shared.setup.ts"),
        ]),
      );
    });
  });

  describe("a project block standing under the runner block", () => {
    const it = test.extend("setupAProjectBlockRegistersUnderTheRunnerBlock", () => {
      const root = join(FIXTURE_ROOT, "projects");
      rmSync(root, { recursive: true, force: true });
      mkdirSync(join(root, "setup"), { recursive: true });
      writeFileSync(join(root, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n");
      writeFileSync(join(root, "package.json"), '{ "name": "@fixture/root" }\n');
      writeFileSync(
        join(root, "vite.config.ts"),
        'import { defineConfig } from "vite-plus";\n\nexport default defineConfig({ test: { projects: [{ test: { setupFiles: "./setup/project.ts" } }, { root: "./packages/held" }, "./packages/held"] } });\n',
      );
      writeFileSync(join(root, "setup/project.ts"), "export const seeded = 1;\n");
      return sharedSetupFilesUnder({ workspaceRoot: root, declaredEntries: [] });
    });

    it("takes the setup that project block registers", ({
      setupAProjectBlockRegistersUnderTheRunnerBlock,
    }) => {
      expect(setupAProjectBlockRegistersUnderTheRunnerBlock).toStrictEqual(
        new Set([join(FIXTURE_ROOT, "projects", "setup/project.ts")]),
      );
    });
  });

  describe("setup modules that reach each other in a cycle", () => {
    const it = test.extend("setupReachedThroughACycle", () => {
      const root = join(FIXTURE_ROOT, "cycle");
      rmSync(root, { recursive: true, force: true });
      mkdirSync(join(root, "setup"), { recursive: true });
      writeFileSync(join(root, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n");
      writeFileSync(join(root, "package.json"), '{ "name": "@fixture/root" }\n');
      writeFileSync(
        join(root, "vite.config.ts"),
        'import { defineConfig } from "vite-plus";\n\nexport default defineConfig({ test: { setupFiles: ["./setup/first.ts"] } });\n',
      );
      writeFileSync(join(root, "setup/first.ts"), 'import "./second.ts";\n');
      writeFileSync(join(root, "setup/second.ts"), 'import "./first.ts";\n');
      return sharedSetupFilesUnder({ workspaceRoot: root, declaredEntries: [] });
    });

    it("stops at the module it has already taken", ({ setupReachedThroughACycle }) => {
      expect(setupReachedThroughACycle).toStrictEqual(
        new Set([
          join(FIXTURE_ROOT, "cycle", "setup/first.ts"),
          join(FIXTURE_ROOT, "cycle", "setup/second.ts"),
        ]),
      );
    });
  });

  describe("a setup module that reaches a spec file", () => {
    const it = test.extend("setupThatReachesASpecFile", () => {
      const root = join(FIXTURE_ROOT, "reaches-spec");
      rmSync(root, { recursive: true, force: true });
      mkdirSync(join(root, "setup"), { recursive: true });
      writeFileSync(join(root, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n");
      writeFileSync(join(root, "package.json"), '{ "name": "@fixture/root" }\n');
      writeFileSync(
        join(root, "vite.config.ts"),
        'import { defineConfig } from "vite-plus";\n\nexport default defineConfig({ test: { setupFiles: ["setup/shared.ts"] } });\n',
      );
      writeFileSync(join(root, "setup/shared.ts"), 'import "./held.test.ts";\n');
      writeFileSync(join(root, "setup/held.test.ts"), "export const asserted = 1;\n");
      return sharedSetupFilesUnder({ workspaceRoot: root, declaredEntries: [] });
    });

    it("leaves that spec file out of the set", ({ setupThatReachesASpecFile }) => {
      expect(setupThatReachesASpecFile).toStrictEqual(
        new Set([join(FIXTURE_ROOT, "reaches-spec", "setup/shared.ts")]),
      );
    });
  });

  describe("a runner block that registers no setup", () => {
    const it = test.extend("setupReadOutOfARunnerBlockThatRegistersNone", () => {
      const root = join(FIXTURE_ROOT, "bare");
      rmSync(root, { recursive: true, force: true });
      mkdirSync(join(root, "setup"), { recursive: true });
      writeFileSync(join(root, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n");
      writeFileSync(join(root, "package.json"), '{ "name": "@fixture/root" }\n');
      writeFileSync(
        join(root, "vite.config.ts"),
        'import { defineConfig } from "vite-plus";\n\nexport default defineConfig({ test: { coverage: { thresholds: { 100: true } }, projects: "./packages/held" } });\n',
      );
      writeFileSync(join(root, "setup/idle.ts"), "export const idle = 1;\n");
      return sharedSetupFilesUnder({ workspaceRoot: root, declaredEntries: [] });
    });

    it("reads no setup out of it", ({ setupReadOutOfARunnerBlockThatRegistersNone }) => {
      expect(setupReadOutOfARunnerBlockThatRegistersNone).toStrictEqual(new Set());
    });
  });

  describe("a setup module that reaches outside the worktree", () => {
    const it = test.extend("setupThatReachesOutsideTheWorktree", () => {
      const root = join(FIXTURE_ROOT, "escapes");
      rmSync(root, { recursive: true, force: true });
      mkdirSync(join(root, "setup"), { recursive: true });
      writeFileSync(join(FIXTURE_ROOT, "outside.ts"), "export const held = 1;\n");
      writeFileSync(join(root, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n");
      writeFileSync(join(root, "package.json"), '{ "name": "@fixture/root" }\n');
      writeFileSync(
        join(root, "vite.config.ts"),
        'import { defineConfig } from "vite-plus";\n\nexport default defineConfig({ test: { setupFiles: ["./setup/shared.ts"] } });\n',
      );
      writeFileSync(join(root, "setup/shared.ts"), 'import "../../outside.ts";\n');
      return sharedSetupFilesUnder({ workspaceRoot: root, declaredEntries: [] });
    });

    it("leaves the module beyond the worktree out of the set", ({
      setupThatReachesOutsideTheWorktree,
    }) => {
      expect(setupThatReachesOutsideTheWorktree).toStrictEqual(
        new Set([join(FIXTURE_ROOT, "escapes", "setup/shared.ts")]),
      );
    });
  });

  describe("an entry that resolves to no single path", () => {
    const it = test.extend("setupReadOutOfAnEntryThatResolvesToNoSinglePath", () => {
      const root = join(FIXTURE_ROOT, "unreadable");
      rmSync(root, { recursive: true, force: true });
      mkdirSync(root, { recursive: true });
      writeFileSync(join(root, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n");
      writeFileSync(join(root, "package.json"), '{ "name": "@fixture/root" }\n');
      writeFileSync(
        join(root, "vite.config.ts"),
        'import { defineConfig } from "vite-plus";\n\nexport default defineConfig({ test: { setupFiles: [chosenSetup, "./setup/missing.ts"], globalSetup: { held: 1 } } });\n',
      );
      return sharedSetupFilesUnder({ workspaceRoot: root, declaredEntries: [] });
    });

    it("reads no setup out of it", ({ setupReadOutOfAnEntryThatResolvesToNoSinglePath }) => {
      expect(setupReadOutOfAnEntryThatResolvesToNoSinglePath).toStrictEqual(new Set());
    });
  });

  describe("a configuration that left the worktree after the scan", () => {
    const it = test.extend("setupReadAfterTheConfigurationLeftTheWorktree", () => {
      const root = join(FIXTURE_ROOT, "vanished");
      rmSync(root, { recursive: true, force: true });
      mkdirSync(join(root, "setup"), { recursive: true });
      writeFileSync(join(root, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n");
      writeFileSync(join(root, "package.json"), '{ "name": "@fixture/root" }\n');
      writeFileSync(
        join(root, "vite.config.ts"),
        'import { defineConfig } from "vite-plus";\n\nexport default defineConfig({ test: { setupFiles: ["./setup/shared.ts"] } });\n',
      );
      writeFileSync(join(root, "setup/shared.ts"), "export const seeded = 1;\n");
      worktreeFilePathsUnder({ root, unscannedDirectoryNames: UNSCANNED_DIRECTORY_NAMES });
      rmSync(join(root, "vite.config.ts"));
      return sharedSetupFilesUnder({ workspaceRoot: root, declaredEntries: [] });
    });

    it("reads no setup out of it", ({ setupReadAfterTheConfigurationLeftTheWorktree }) => {
      expect(setupReadAfterTheConfigurationLeftTheWorktree).toStrictEqual(new Set());
    });
  });

  describe("a configuration that exports no runner block", () => {
    const it = test.extend("setupReadOutOfAConfigurationThatExportsNoRunnerBlock", () => {
      const root = join(FIXTURE_ROOT, "no-export");
      rmSync(root, { recursive: true, force: true });
      mkdirSync(root, { recursive: true });
      writeFileSync(join(root, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n");
      writeFileSync(join(root, "package.json"), '{ "name": "@fixture/root" }\n');
      writeFileSync(
        join(root, "vite.config.ts"),
        "export const held = { test: { setupFiles: [] } };\n",
      );
      writeFileSync(join(root, "vite.config.mts"), "export default 1;\n");
      writeFileSync(
        join(root, "vite.config.cts"),
        "export default defineConfig({ lint: { rules: {} } });\n",
      );
      return sharedSetupFilesUnder({ workspaceRoot: root, declaredEntries: [] });
    });

    it("reads no setup out of it", ({ setupReadOutOfAConfigurationThatExportsNoRunnerBlock }) => {
      expect(setupReadOutOfAConfigurationThatExportsNoRunnerBlock).toStrictEqual(new Set());
    });
  });

  describe("a configuration whose factory takes no argument", () => {
    const it = test.extend("setupReadOutOfAConfigurationWhoseFactoryTakesNoArgument", () => {
      const root = join(FIXTURE_ROOT, "empty-call");
      rmSync(root, { recursive: true, force: true });
      mkdirSync(root, { recursive: true });
      writeFileSync(join(root, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n");
      writeFileSync(join(root, "package.json"), '{ "name": "@fixture/root" }\n');
      writeFileSync(join(root, "vite.config.ts"), "export default defineConfig();\n");
      return sharedSetupFilesUnder({ workspaceRoot: root, declaredEntries: [] });
    });

    it("reads no setup out of it", ({
      setupReadOutOfAConfigurationWhoseFactoryTakesNoArgument,
    }) => {
      expect(setupReadOutOfAConfigurationWhoseFactoryTakesNoArgument).toStrictEqual(new Set());
    });
  });

  describe("a runner block whose keys are spelled out as strings", () => {
    const it = test.extend("setupReadOutOfAKeySpelledOutAsAString", () => {
      const root = join(FIXTURE_ROOT, "spelled-keys");
      rmSync(root, { recursive: true, force: true });
      mkdirSync(join(root, "setup"), { recursive: true });
      writeFileSync(join(root, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n");
      writeFileSync(join(root, "package.json"), '{ "name": "@fixture/root" }\n');
      writeFileSync(
        join(root, "vite.config.ts"),
        'import { defineConfig } from "vite-plus";\n\nexport default defineConfig({ test: { "setupFiles": ["./setup/spelled.ts"], [chosenKey]: "./setup/computed.ts", 0: "./setup/numbered.ts", ...held } });\n',
      );
      writeFileSync(join(root, "setup/spelled.ts"), "export const seeded = 1;\n");
      writeFileSync(join(root, "setup/computed.ts"), "export const idle = 1;\n");
      writeFileSync(join(root, "setup/numbered.ts"), "export const idle = 1;\n");
      return sharedSetupFilesUnder({ workspaceRoot: root, declaredEntries: [] });
    });

    it("reads the key spelled out as a string and no other", ({
      setupReadOutOfAKeySpelledOutAsAString,
    }) => {
      expect(setupReadOutOfAKeySpelledOutAsAString).toStrictEqual(
        new Set([join(FIXTURE_ROOT, "spelled-keys", "setup/spelled.ts")]),
      );
    });
  });

  describe("an option naming the setup files itself", () => {
    const it = test.extend("setupNamedByTheDeclaredEntriesOption", () => {
      const root = join(FIXTURE_ROOT, "declared");
      rmSync(root, { recursive: true, force: true });
      mkdirSync(join(root, "setup"), { recursive: true });
      writeFileSync(join(root, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n");
      writeFileSync(join(root, "package.json"), '{ "name": "@fixture/root" }\n');
      writeFileSync(
        join(root, "vite.config.ts"),
        'import { defineConfig } from "vite-plus";\n\nexport default defineConfig({ test: { setupFiles: ["./setup/registered.ts"] } });\n',
      );
      writeFileSync(join(root, "setup/registered.ts"), "export const seeded = 1;\n");
      writeFileSync(join(root, "setup/declared.ts"), "export const seeded = 2;\n");
      return sharedSetupFilesUnder({
        workspaceRoot: root,
        declaredEntries: ["setup/declared.ts"],
      });
    });

    it("takes the files it names in place of the ones the runner registers", ({
      setupNamedByTheDeclaredEntriesOption,
    }) => {
      expect(setupNamedByTheDeclaredEntriesOption).toStrictEqual(
        new Set([join(FIXTURE_ROOT, "declared", "setup/declared.ts")]),
      );
    });
  });

  describe("a configuration already read once before it left the worktree", () => {
    const it = test.extend("setupHandedBackAfterTheConfigurationWasReadOnceAlready", () => {
      const root = join(FIXTURE_ROOT, "remembered");
      rmSync(root, { recursive: true, force: true });
      mkdirSync(join(root, "setup"), { recursive: true });
      writeFileSync(join(root, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n");
      writeFileSync(join(root, "package.json"), '{ "name": "@fixture/root" }\n');
      writeFileSync(
        join(root, "vite.config.ts"),
        'import { defineConfig } from "vite-plus";\n\nexport default defineConfig({ test: { setupFiles: ["./setup/shared.ts"] } });\n',
      );
      writeFileSync(join(root, "setup/shared.ts"), "export const seeded = 1;\n");
      sharedSetupFilesUnder({ workspaceRoot: root, declaredEntries: [] });
      rmSync(join(root, "vite.config.ts"));
      return sharedSetupFilesUnder({ workspaceRoot: root, declaredEntries: [] });
    });

    it("hands back the set it read the first time", ({
      setupHandedBackAfterTheConfigurationWasReadOnceAlready,
    }) => {
      expect(setupHandedBackAfterTheConfigurationWasReadOnceAlready).toStrictEqual(
        new Set([join(FIXTURE_ROOT, "remembered", "setup/shared.ts")]),
      );
    });
  });
});
