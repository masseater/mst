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

const it = test
  .extend("runnerConfigurationReadingOfTheConfigurationName", () =>
    isRunnerConfigurationFile("packages/held/vite.config.ts"))
  .extend("runnerConfigurationReadingOfAModuleThatIsNotTheConfiguration", () =>
    isRunnerConfigurationFile("packages/held/vitest.setup.ts"),
  )
  .extend("setupTheRunnerRegistersAndEverythingItReaches", () => {
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
  })
  .extend("setupAProjectBlockRegistersUnderTheRunnerBlock", () => {
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
  })
  .extend("setupReachedThroughACycle", () => {
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
  })
  .extend("setupThatReachesASpecFile", () => {
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
  })
  .extend("setupReadOutOfARunnerBlockThatRegistersNone", () => {
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
  })
  .extend("setupThatReachesOutsideTheWorktree", () => {
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
  })
  .extend("setupReadOutOfAnEntryThatResolvesToNoSinglePath", () => {
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
  })
  .extend("setupReadAfterTheConfigurationLeftTheWorktree", () => {
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
  })
  .extend("setupReadOutOfAConfigurationThatExportsNoRunnerBlock", () => {
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
  })
  .extend("setupReadOutOfAConfigurationWhoseFactoryTakesNoArgument", () => {
    const root = join(FIXTURE_ROOT, "empty-call");
    rmSync(root, { recursive: true, force: true });
    mkdirSync(root, { recursive: true });
    writeFileSync(join(root, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n");
    writeFileSync(join(root, "package.json"), '{ "name": "@fixture/root" }\n');
    writeFileSync(join(root, "vite.config.ts"), "export default defineConfig();\n");
    return sharedSetupFilesUnder({ workspaceRoot: root, declaredEntries: [] });
  })
  .extend("setupReadOutOfAKeySpelledOutAsAString", () => {
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
  })
  .extend("setupNamedByTheDeclaredEntriesOption", () => {
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
  })
  .extend("setupHandedBackAfterTheConfigurationWasReadOnceAlready", () => {
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

describe("isRunnerConfigurationFile", () => {
  it("reads the runner configuration by the name the toolchain gives it", ({
    runnerConfigurationReadingOfTheConfigurationName,
  }) => {
    expect(runnerConfigurationReadingOfTheConfigurationName).toBe(true);
  });

  it("leaves a module that is not the runner configuration alone", ({
    runnerConfigurationReadingOfAModuleThatIsNotTheConfiguration,
  }) => {
    expect(runnerConfigurationReadingOfAModuleThatIsNotTheConfiguration).toBe(false);
  });
});

describe("sharedSetupFilesUnder", () => {
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

  it("takes the setup a project block registers under the runner block", ({
    setupAProjectBlockRegistersUnderTheRunnerBlock,
  }) => {
    expect(setupAProjectBlockRegistersUnderTheRunnerBlock).toStrictEqual(
      new Set([join(FIXTURE_ROOT, "projects", "setup/project.ts")]),
    );
  });

  it("stops at a module the setup reaches through a cycle", ({ setupReachedThroughACycle }) => {
    expect(setupReachedThroughACycle).toStrictEqual(
      new Set([
        join(FIXTURE_ROOT, "cycle", "setup/first.ts"),
        join(FIXTURE_ROOT, "cycle", "setup/second.ts"),
      ]),
    );
  });

  it("leaves a spec file the setup reaches out of the set", ({ setupThatReachesASpecFile }) => {
    expect(setupThatReachesASpecFile).toStrictEqual(
      new Set([join(FIXTURE_ROOT, "reaches-spec", "setup/shared.ts")]),
    );
  });

  it("reads no setup out of a runner block that registers none", ({
    setupReadOutOfARunnerBlockThatRegistersNone,
  }) => {
    expect(setupReadOutOfARunnerBlockThatRegistersNone).toStrictEqual(new Set());
  });

  it("leaves a module the setup reaches outside the worktree out of the set", ({
    setupThatReachesOutsideTheWorktree,
  }) => {
    expect(setupThatReachesOutsideTheWorktree).toStrictEqual(
      new Set([join(FIXTURE_ROOT, "escapes", "setup/shared.ts")]),
    );
  });

  it("reads no setup out of an entry it cannot resolve to one path", ({
    setupReadOutOfAnEntryThatResolvesToNoSinglePath,
  }) => {
    expect(setupReadOutOfAnEntryThatResolvesToNoSinglePath).toStrictEqual(new Set());
  });

  it("reads no setup out of a configuration that left the worktree after the scan", ({
    setupReadAfterTheConfigurationLeftTheWorktree,
  }) => {
    expect(setupReadAfterTheConfigurationLeftTheWorktree).toStrictEqual(new Set());
  });

  it("reads no setup out of a configuration that exports no runner block", ({
    setupReadOutOfAConfigurationThatExportsNoRunnerBlock,
  }) => {
    expect(setupReadOutOfAConfigurationThatExportsNoRunnerBlock).toStrictEqual(new Set());
  });

  it("reads no setup out of a configuration whose factory takes no argument", ({
    setupReadOutOfAConfigurationWhoseFactoryTakesNoArgument,
  }) => {
    expect(setupReadOutOfAConfigurationWhoseFactoryTakesNoArgument).toStrictEqual(new Set());
  });

  it("reads a key the configuration spells out as a string", ({
    setupReadOutOfAKeySpelledOutAsAString,
  }) => {
    expect(setupReadOutOfAKeySpelledOutAsAString).toStrictEqual(
      new Set([join(FIXTURE_ROOT, "spelled-keys", "setup/spelled.ts")]),
    );
  });

  it("takes the files an option names in place of the ones the runner registers", ({
    setupNamedByTheDeclaredEntriesOption,
  }) => {
    expect(setupNamedByTheDeclaredEntriesOption).toStrictEqual(
      new Set([join(FIXTURE_ROOT, "declared", "setup/declared.ts")]),
    );
  });

  it("hands back the set it read the first time it was asked", ({
    setupHandedBackAfterTheConfigurationWasReadOnceAlready,
  }) => {
    expect(setupHandedBackAfterTheConfigurationWasReadOnceAlready).toStrictEqual(
      new Set([join(FIXTURE_ROOT, "remembered", "setup/shared.ts")]),
    );
  });
});
