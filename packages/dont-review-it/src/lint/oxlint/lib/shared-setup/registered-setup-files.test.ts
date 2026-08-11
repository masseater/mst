import { mkdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vite-plus/test";

import {
  UNSCANNED_DIRECTORY_NAMES,
  worktreeFilePathsUnder,
} from "../repository-scan/worktree-files.ts";
import { isRunnerConfigurationFile, sharedSetupFilesUnder } from "./registered-setup-files.ts";

const fixtureDir = join(realpathSync(tmpdir()), "dont-review-it-registered-setup-files");
rmSync(fixtureDir, { recursive: true, force: true });

const writeFixture = (name: string, source: string): string => {
  const path = join(fixtureDir, name);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, source);
  return path;
};

const writeRepository = (name: string, held: Readonly<Record<string, string>>): string => {
  writeFixture(`${name}/pnpm-workspace.yaml`, "packages:\n  - packages/*\n");
  writeFixture(`${name}/package.json`, '{ "name": "@fixture/root" }\n');
  for (const [path, source] of Object.entries(held)) writeFixture(`${name}/${path}`, source);
  return join(fixtureDir, name);
};

const configHolding = (block: string): string =>
  `import { defineConfig } from "vite-plus";\n\nexport default defineConfig({ test: ${block} });\n`;

const derivedUnder = (workspaceRoot: string): readonly string[] =>
  [...sharedSetupFilesUnder({ workspaceRoot, declaredEntries: [] })].toSorted();

describe("isRunnerConfigurationFile", () => {
  it("reads the runner configuration by the name the toolchain gives it", () => {
    expect(isRunnerConfigurationFile("packages/held/vite.config.ts")).toBe(true);
  });

  it("leaves a module that is not the runner configuration alone", () => {
    expect(isRunnerConfigurationFile("packages/held/vitest.setup.ts")).toBe(false);
  });
});

describe("sharedSetupFilesUnder", () => {
  it("takes every module the runner registers as setup and everything they reach", () => {
    const root = writeRepository("registered", {
      "vite.config.ts": configHolding(
        `{ setupFiles: ["./setup/shared.setup.ts"], globalSetup: "setup/global.ts" }`,
      ),
      "setup/shared.setup.ts": 'import "./reached.ts";\n',
      "setup/reached.ts": "export const seeded = 1;\n",
      "setup/global.ts": "export const started = 1;\n",
      "setup/unreached.ts": "export const idle = 1;\n",
    });

    expect(derivedUnder(root)).toStrictEqual([
      join(root, "setup/global.ts"),
      join(root, "setup/reached.ts"),
      join(root, "setup/shared.setup.ts"),
    ]);
  });

  it("takes the setup a project block registers under the runner block", () => {
    const root = writeRepository("projects", {
      "vite.config.ts": configHolding(
        `{ projects: [{ test: { setupFiles: "./setup/project.ts" } }, { root: "./packages/held" }, "./packages/held"] }`,
      ),
      "setup/project.ts": "export const seeded = 1;\n",
    });

    expect(derivedUnder(root)).toStrictEqual([join(root, "setup/project.ts")]);
  });

  it("stops at a module the setup reaches through a cycle", () => {
    const root = writeRepository("cycle", {
      "vite.config.ts": configHolding(`{ setupFiles: ["./setup/first.ts"] }`),
      "setup/first.ts": 'import "./second.ts";\n',
      "setup/second.ts": 'import "./first.ts";\n',
    });

    expect(derivedUnder(root)).toStrictEqual([
      join(root, "setup/first.ts"),
      join(root, "setup/second.ts"),
    ]);
  });

  it("leaves a spec file the setup reaches out of the set", () => {
    const root = writeRepository("reaches-spec", {
      "vite.config.ts": configHolding(`{ setupFiles: ["setup/shared.ts"] }`),
      "setup/shared.ts": 'import "./held.test.ts";\n',
      "setup/held.test.ts": "export const asserted = 1;\n",
    });

    expect(derivedUnder(root)).toStrictEqual([join(root, "setup/shared.ts")]);
  });

  it("reads no setup out of a runner block that registers none", () => {
    const root = writeRepository("bare", {
      "vite.config.ts": configHolding(
        `{ coverage: { thresholds: { 100: true } }, projects: "./packages/held" }`,
      ),
      "setup/idle.ts": "export const idle = 1;\n",
    });

    expect(derivedUnder(root)).toStrictEqual([]);
  });

  it("leaves a module the setup reaches outside the worktree out of the set", () => {
    writeFixture("outside.ts", "export const held = 1;\n");
    const root = writeRepository("escapes", {
      "vite.config.ts": configHolding(`{ setupFiles: ["./setup/shared.ts"] }`),
      "setup/shared.ts": 'import "../../outside.ts";\n',
    });

    expect(derivedUnder(root)).toStrictEqual([join(root, "setup/shared.ts")]);
  });

  it("reads no setup out of an entry it cannot resolve to one path", () => {
    const root = writeRepository("unreadable", {
      "vite.config.ts": configHolding(
        `{ setupFiles: [chosenSetup, "./setup/missing.ts"], globalSetup: { held: 1 } }`,
      ),
    });

    expect(derivedUnder(root)).toStrictEqual([]);
  });

  it("reads no setup out of a configuration that left the worktree after the scan", () => {
    const root = writeRepository("vanished", {
      "vite.config.ts": configHolding(`{ setupFiles: ["./setup/shared.ts"] }`),
      "setup/shared.ts": "export const seeded = 1;\n",
    });
    worktreeFilePathsUnder({ root, unscannedDirectoryNames: UNSCANNED_DIRECTORY_NAMES });
    rmSync(join(root, "vite.config.ts"));

    expect(derivedUnder(root)).toStrictEqual([]);
  });

  it("reads no setup out of a configuration that exports no runner block", () => {
    const root = writeRepository("no-export", {
      "vite.config.ts": "export const held = { test: { setupFiles: [] } };\n",
      "vite.config.mts": "export default 1;\n",
      "vite.config.cts": "export default defineConfig({ lint: { rules: {} } });\n",
    });

    expect(derivedUnder(root)).toStrictEqual([]);
  });

  it("reads no setup out of a configuration whose factory takes no argument", () => {
    const root = writeRepository("empty-call", {
      "vite.config.ts": "export default defineConfig();\n",
    });

    expect(derivedUnder(root)).toStrictEqual([]);
  });

  it("reads a key the configuration spells out as a string", () => {
    const root = writeRepository("spelled-keys", {
      "vite.config.ts": configHolding(
        `{ "setupFiles": ["./setup/spelled.ts"], [chosenKey]: "./setup/computed.ts", 0: "./setup/numbered.ts", ...held }`,
      ),
      "setup/spelled.ts": "export const seeded = 1;\n",
      "setup/computed.ts": "export const idle = 1;\n",
      "setup/numbered.ts": "export const idle = 1;\n",
    });

    expect(derivedUnder(root)).toStrictEqual([join(root, "setup/spelled.ts")]);
  });

  it("takes the files an option names in place of the ones the runner registers", () => {
    const root = writeRepository("declared", {
      "vite.config.ts": configHolding(`{ setupFiles: ["./setup/registered.ts"] }`),
      "setup/registered.ts": "export const seeded = 1;\n",
      "setup/declared.ts": "export const seeded = 2;\n",
    });

    const declared = sharedSetupFilesUnder({
      workspaceRoot: root,
      declaredEntries: ["setup/declared.ts"],
    });
    expect([...declared]).toStrictEqual([join(root, "setup/declared.ts")]);
  });

  it("hands back the set it read the first time it was asked", () => {
    const root = writeRepository("remembered", {
      "vite.config.ts": configHolding(`{ setupFiles: ["./setup/shared.ts"] }`),
      "setup/shared.ts": "export const seeded = 1;\n",
    });

    expect(derivedUnder(root)).toStrictEqual(derivedUnder(root));
  });
});
