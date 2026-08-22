import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { defaultPresetAdoptionConfig } from "./config.ts";
import { runPresetAdoptionChecks } from "./run-preset-adoption-checks.ts";

const TWO_WORKSPACES = {
  "package.json": `{ "name": "root" }`,
  "packages/left/package.json": `{ "name": "left" }`,
  "packages/right/package.json": `{ "name": "right" }`,
};

describe("runPresetAdoptionChecks", () => {
  describe("a repository whose root directly adopts the preset and disables nothing", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "preset-adoption-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      for (const [relativePath, writtenSource] of Object.entries({
        ...TWO_WORKSPACES,
        "vite.config.ts": `import { dontReviewItPreset } from "@mst/dont-review-it";
export default { lint: dontReviewItPreset.lint({ rules: {} }) };`,
      })) {
        const writtenPath = join(repositoryRoot, relativePath);
        mkdirSync(dirname(writtenPath), { recursive: true });
        writeFileSync(writtenPath, writtenSource, "utf8");
      }
      return runPresetAdoptionChecks({
        repositoryRoot,
        config: defaultPresetAdoptionConfig,
      });
    });

    it("accepts the adoption and counts both workspaces", ({ report }) => {
      expect(report).toStrictEqual({
        problems: [],
        warnings: [],
        scanned: 2,
        configMissing: false,
      });
    });
  });

  describe("the exact disabled-rule exception recorded by the repository", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "preset-adoption-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      for (const [relativePath, writtenSource] of Object.entries({
        ...TWO_WORKSPACES,
        "packages/ai-native/package.json": `{ "name": "ai-native" }`,
        "packages/lint-rule-authoring/package.json": `{ "name": "lint-rule-authoring" }`,
        "packages/verified-specifications/package.json": `{ "name": "verified-specifications" }`,
        "vite.config.ts": `import {
  dontReviewItPreset as preset,
} from "@mst/dont-review-it";
import { LINT_SEVERITY } from "@mst/lint-rule-authoring";
import { defineConfig } from "vite-plus";

export default defineConfig({
  lint: preset.lint({ overrides: [{
    files: [
      "packages/ai-native/**",
      "packages/lint-rule-authoring/**",
      "packages/verified-specifications/**",
    ],
    rules: {
      "dont-review-it/no-handmade-standard-io-double--use-standard-io-test": LINT_SEVERITY.OFF,
    },
  }] }),
});`,
      })) {
        const writtenPath = join(repositoryRoot, relativePath);
        mkdirSync(dirname(writtenPath), { recursive: true });
        writeFileSync(writtenPath, writtenSource, "utf8");
      }
      return runPresetAdoptionChecks({
        repositoryRoot,
        config: defaultPresetAdoptionConfig,
      });
    });

    it("keeps the exception as warnings for the three named workspaces", ({ report }) => {
      expect(report).toStrictEqual({
        problems: [],
        warnings: [
          {
            file: "vite.config.ts",
            line: 15,
            message:
              "The lint configuration must not leave dont-review-it/no-handmade-standard-io-double--use-standard-io-test switched off for packages/ai-native. Delete the override and repair what it reports, or keep only the exact exception recorded by the repository's engineering decision log.",
          },
          {
            file: "vite.config.ts",
            line: 15,
            message:
              "The lint configuration must not leave dont-review-it/no-handmade-standard-io-double--use-standard-io-test switched off for packages/lint-rule-authoring. Delete the override and repair what it reports, or keep only the exact exception recorded by the repository's engineering decision log.",
          },
          {
            file: "vite.config.ts",
            line: 15,
            message:
              "The lint configuration must not leave dont-review-it/no-handmade-standard-io-double--use-standard-io-test switched off for packages/verified-specifications. Delete the override and repair what it reports, or keep only the exact exception recorded by the repository's engineering decision log.",
          },
        ],
        scanned: 5,
        configMissing: false,
      });
    });
  });

  describe("the exact disabled-rule exception declared twice", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "preset-adoption-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      for (const [relativePath, writtenSource] of Object.entries({
        ...TWO_WORKSPACES,
        "packages/ai-native/package.json": `{ "name": "ai-native" }`,
        "packages/lint-rule-authoring/package.json": `{ "name": "lint-rule-authoring" }`,
        "packages/verified-specifications/package.json": `{ "name": "verified-specifications" }`,
        "vite.config.ts": `import { dontReviewItPreset as preset } from "@mst/dont-review-it";
import { LINT_SEVERITY } from "@mst/lint-rule-authoring";

export default {
  lint: preset.lint({ overrides: [{
    files: [
      "packages/ai-native/**",
      "packages/lint-rule-authoring/**",
      "packages/verified-specifications/**",
    ],
    rules: {
      "dont-review-it/no-handmade-standard-io-double--use-standard-io-test": LINT_SEVERITY.OFF,
    },
  }, {
    files: [
      "packages/ai-native/**",
      "packages/lint-rule-authoring/**",
      "packages/verified-specifications/**",
    ],
    rules: {
      "dont-review-it/no-handmade-standard-io-double--use-standard-io-test": LINT_SEVERITY.OFF,
    },
  }] }),
};`,
      })) {
        const writtenPath = join(repositoryRoot, relativePath);
        mkdirSync(dirname(writtenPath), { recursive: true });
        writeFileSync(writtenPath, writtenSource, "utf8");
      }
      return runPresetAdoptionChecks({
        repositoryRoot,
        config: defaultPresetAdoptionConfig,
      });
    });

    it("turns both copies into problems instead of multiplying the allowed warnings", ({
      report,
    }) => {
      expect(report).toMatchInlineSnapshot(`
        {
          "configMissing": false,
          "problems": [
            {
              "file": "vite.config.ts",
              "line": 12,
              "message": "The lint configuration must not leave dont-review-it/no-handmade-standard-io-double--use-standard-io-test switched off for packages/ai-native. Delete the override and repair what it reports, or keep only the exact exception recorded by the repository's engineering decision log.",
            },
            {
              "file": "vite.config.ts",
              "line": 12,
              "message": "The lint configuration must not leave dont-review-it/no-handmade-standard-io-double--use-standard-io-test switched off for packages/lint-rule-authoring. Delete the override and repair what it reports, or keep only the exact exception recorded by the repository's engineering decision log.",
            },
            {
              "file": "vite.config.ts",
              "line": 12,
              "message": "The lint configuration must not leave dont-review-it/no-handmade-standard-io-double--use-standard-io-test switched off for packages/verified-specifications. Delete the override and repair what it reports, or keep only the exact exception recorded by the repository's engineering decision log.",
            },
            {
              "file": "vite.config.ts",
              "line": 21,
              "message": "The lint configuration must not leave dont-review-it/no-handmade-standard-io-double--use-standard-io-test switched off for packages/ai-native. Delete the override and repair what it reports, or keep only the exact exception recorded by the repository's engineering decision log.",
            },
            {
              "file": "vite.config.ts",
              "line": 21,
              "message": "The lint configuration must not leave dont-review-it/no-handmade-standard-io-double--use-standard-io-test switched off for packages/lint-rule-authoring. Delete the override and repair what it reports, or keep only the exact exception recorded by the repository's engineering decision log.",
            },
            {
              "file": "vite.config.ts",
              "line": 21,
              "message": "The lint configuration must not leave dont-review-it/no-handmade-standard-io-double--use-standard-io-test switched off for packages/verified-specifications. Delete the override and repair what it reports, or keep only the exact exception recorded by the repository's engineering decision log.",
            },
          ],
          "scanned": 5,
          "warnings": [],
        }
      `);
    });
  });

  describe("a different preset rule disabled for every package workspace", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "preset-adoption-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      for (const [relativePath, writtenSource] of Object.entries({
        ...TWO_WORKSPACES,
        "vite.config.ts": `import { dontReviewItPreset } from "@mst/dont-review-it";
export default {
  lint: dontReviewItPreset.lint({ overrides: [{
    files: ["packages/**"],
    rules: { "dont-review-it/no-reassign--use-spread-or-iife": "allow" },
  }] }),
};`,
      })) {
        const writtenPath = join(repositoryRoot, relativePath);
        mkdirSync(dirname(writtenPath), { recursive: true });
        writeFileSync(writtenPath, writtenSource, "utf8");
      }
      return runPresetAdoptionChecks({
        repositoryRoot,
        config: defaultPresetAdoptionConfig,
      });
    });

    it("turns the disabled declaration into a problem for every reached workspace", ({
      report,
    }) => {
      expect(report).toStrictEqual({
        problems: [
          {
            file: "vite.config.ts",
            line: 5,
            message:
              "The lint configuration must not leave dont-review-it/no-reassign--use-spread-or-iife switched off for packages/left. Delete the override and repair what it reports, or keep only the exact exception recorded by the repository's engineering decision log.",
          },
          {
            file: "vite.config.ts",
            line: 5,
            message:
              "The lint configuration must not leave dont-review-it/no-reassign--use-spread-or-iife switched off for packages/right. Delete the override and repair what it reports, or keep only the exact exception recorded by the repository's engineering decision log.",
          },
        ],
        warnings: [],
        scanned: 2,
        configMissing: false,
      });
    });
  });

  describe("a disabled override that excludes the right workspace", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "preset-adoption-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      for (const [relativePath, writtenSource] of Object.entries({
        ...TWO_WORKSPACES,
        "vite.config.ts": `import { dontReviewItPreset } from "@mst/dont-review-it";
export default {
  lint: dontReviewItPreset.lint({ overrides: [{
    files: ["packages/**"],
    excludeFiles: ["packages/right/**"],
    rules: { "dont-review-it/no-reassign--use-spread-or-iife": 0 },
  }] }),
};`,
      })) {
        const writtenPath = join(repositoryRoot, relativePath);
        mkdirSync(dirname(writtenPath), { recursive: true });
        writeFileSync(writtenPath, writtenSource, "utf8");
      }
      return runPresetAdoptionChecks({
        repositoryRoot,
        config: defaultPresetAdoptionConfig,
      });
    });

    it("names only the workspace left after applying the exclusion", ({ report }) => {
      expect(report).toStrictEqual({
        problems: [
          {
            file: "vite.config.ts",
            line: 6,
            message:
              "The lint configuration must not leave dont-review-it/no-reassign--use-spread-or-iife switched off for packages/left. Delete the override and repair what it reports, or keep only the exact exception recorded by the repository's engineering decision log.",
          },
        ],
        warnings: [],
        scanned: 2,
        configMissing: false,
      });
    });
  });

  describe("a disabled override whose literal path reaches no workspace", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "preset-adoption-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      for (const [relativePath, writtenSource] of Object.entries({
        ...TWO_WORKSPACES,
        "vite.config.ts": `import { dontReviewItPreset } from "@mst/dont-review-it";
export default {
  lint: dontReviewItPreset.lint({ overrides: [{
    files: ["packages/missing/**"],
    rules: { "dont-review-it/no-reassign--use-spread-or-iife": "off" },
  }] }),
};`,
      })) {
        const writtenPath = join(repositoryRoot, relativePath);
        mkdirSync(dirname(writtenPath), { recursive: true });
        writeFileSync(writtenPath, writtenSource, "utf8");
      }
      return runPresetAdoptionChecks({
        repositoryRoot,
        config: defaultPresetAdoptionConfig,
      });
    });

    it("names the unreachable path instead of dropping the declaration", ({ report }) => {
      expect(report).toStrictEqual({
        problems: [
          {
            file: "vite.config.ts",
            line: 5,
            message:
              "The lint configuration must not leave dont-review-it/no-reassign--use-spread-or-iife switched off for packages/missing/**. Delete the override and repair what it reports, or keep only the exact exception recorded by the repository's engineering decision log.",
          },
        ],
        warnings: [],
        scanned: 2,
        configMissing: false,
      });
    });
  });

  describe("a preset rule disabled at the root of the lint configuration", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "preset-adoption-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      for (const [relativePath, writtenSource] of Object.entries({
        ...TWO_WORKSPACES,
        "vite.config.ts": `import { dontReviewItPreset } from "@mst/dont-review-it";
export default {
  lint: dontReviewItPreset.lint({
    rules: { "dont-review-it/no-reassign--use-spread-or-iife": "off" },
  }),
};`,
      })) {
        const writtenPath = join(repositoryRoot, relativePath);
        mkdirSync(dirname(writtenPath), { recursive: true });
        writeFileSync(writtenPath, writtenSource, "utf8");
      }
      return runPresetAdoptionChecks({
        repositoryRoot,
        config: defaultPresetAdoptionConfig,
      });
    });

    it("reports the disabled rule against every workspace", ({ report }) => {
      expect(report).toStrictEqual({
        problems: [
          {
            file: "vite.config.ts",
            line: 4,
            message:
              "The lint configuration must not leave dont-review-it/no-reassign--use-spread-or-iife switched off for packages/left. Delete the override and repair what it reports, or keep only the exact exception recorded by the repository's engineering decision log.",
          },
          {
            file: "vite.config.ts",
            line: 4,
            message:
              "The lint configuration must not leave dont-review-it/no-reassign--use-spread-or-iife switched off for packages/right. Delete the override and repair what it reports, or keep only the exact exception recorded by the repository's engineering decision log.",
          },
        ],
        warnings: [],
        scanned: 2,
        configMissing: false,
      });
    });
  });

  describe("a preset rule disabled at the root of a repository without workspaces", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "preset-adoption-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      writeFileSync(
        join(repositoryRoot, "vite.config.ts"),
        `import { dontReviewItPreset } from "@mst/dont-review-it";
export default {
  lint: dontReviewItPreset.lint({
    rules: { "dont-review-it/no-reassign--use-spread-or-iife": "off" },
  }),
};`,
        "utf8",
      );
      return runPresetAdoptionChecks({
        repositoryRoot,
        config: defaultPresetAdoptionConfig,
      });
    });

    it("reports the disabled rule against the repository itself", ({ report }) => {
      expect(report).toStrictEqual({
        problems: [
          {
            file: "vite.config.ts",
            line: 4,
            message:
              "The lint configuration must not leave dont-review-it/no-reassign--use-spread-or-iife switched off for the repository. Delete the override and repair what it reports, or keep only the exact exception recorded by the repository's engineering decision log.",
          },
        ],
        warnings: [],
        scanned: 0,
        configMissing: false,
      });
    });
  });

  describe("a root lint block that does not directly adopt the preset", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "preset-adoption-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      for (const [relativePath, writtenSource] of Object.entries({
        ...TWO_WORKSPACES,
        "vite.config.ts": `export default { lint: {} };`,
      })) {
        const writtenPath = join(repositoryRoot, relativePath);
        mkdirSync(dirname(writtenPath), { recursive: true });
        writeFileSync(writtenPath, writtenSource, "utf8");
      }
      return runPresetAdoptionChecks({
        repositoryRoot,
        config: defaultPresetAdoptionConfig,
      });
    });

    it("turns the missing direct adoption into a problem", ({ report }) => {
      expect(report).toStrictEqual({
        problems: [
          {
            file: "vite.config.ts",
            line: 1,
            message:
              "The root lint block must be exactly one direct call to dontReviewItPreset.lint through a value import from @mst/dont-review-it, with one object literal argument.",
          },
        ],
        warnings: [],
        scanned: 2,
        configMissing: false,
      });
    });
  });

  describe("a direct preset call whose rules block is dynamic", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "preset-adoption-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      for (const [relativePath, writtenSource] of Object.entries({
        ...TWO_WORKSPACES,
        "vite.config.ts": `import { dontReviewItPreset } from "@mst/dont-review-it";
export default { lint: dontReviewItPreset.lint({ rules: sharedRules }) };`,
      })) {
        const writtenPath = join(repositoryRoot, relativePath);
        mkdirSync(dirname(writtenPath), { recursive: true });
        writeFileSync(writtenPath, writtenSource, "utf8");
      }
      return runPresetAdoptionChecks({
        repositoryRoot,
        config: defaultPresetAdoptionConfig,
      });
    });

    it("turns the uninspectable rules block into a problem", ({ report }) => {
      expect(report).toStrictEqual({
        problems: [
          {
            file: "vite.config.ts",
            line: 2,
            message:
              "A rules block that can affect preset-owned rules must be an object literal.",
          },
        ],
        warnings: [],
        scanned: 2,
        configMissing: false,
      });
    });
  });

  describe("the recorded exception with a dynamic excludeFiles value", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "preset-adoption-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      for (const [relativePath, writtenSource] of Object.entries({
        ...TWO_WORKSPACES,
        "packages/ai-native/package.json": `{ "name": "ai-native" }`,
        "packages/lint-rule-authoring/package.json": `{ "name": "lint-rule-authoring" }`,
        "packages/verified-specifications/package.json": `{ "name": "verified-specifications" }`,
        "vite.config.ts": `import { dontReviewItPreset } from "@mst/dont-review-it";
export default {
  lint: dontReviewItPreset.lint({ overrides: [{
    files: [
      "packages/ai-native/**",
      "packages/lint-rule-authoring/**",
      "packages/verified-specifications/**",
    ],
    excludeFiles: sharedExcludes,
    rules: {
      "dont-review-it/no-handmade-standard-io-double--use-standard-io-test": "off",
    },
  }] }),
};`,
      })) {
        const writtenPath = join(repositoryRoot, relativePath);
        mkdirSync(dirname(writtenPath), { recursive: true });
        writeFileSync(writtenPath, writtenSource, "utf8");
      }
      return runPresetAdoptionChecks({
        repositoryRoot,
        config: defaultPresetAdoptionConfig,
      });
    });

    it("fails closed instead of allowing the exception", ({ report }) => {
      expect(report).toStrictEqual({
        problems: [
          {
            file: "vite.config.ts",
            line: 9,
            message:
              "An override containing a disabled preset rule must declare excludeFiles as a literal array so its reach is inspectable.",
          },
          {
            file: "vite.config.ts",
            line: 11,
            message:
              "The lint configuration must not leave dont-review-it/no-handmade-standard-io-double--use-standard-io-test switched off for packages/ai-native. Delete the override and repair what it reports, or keep only the exact exception recorded by the repository's engineering decision log.",
          },
          {
            file: "vite.config.ts",
            line: 11,
            message:
              "The lint configuration must not leave dont-review-it/no-handmade-standard-io-double--use-standard-io-test switched off for packages/lint-rule-authoring. Delete the override and repair what it reports, or keep only the exact exception recorded by the repository's engineering decision log.",
          },
          {
            file: "vite.config.ts",
            line: 11,
            message:
              "The lint configuration must not leave dont-review-it/no-handmade-standard-io-double--use-standard-io-test switched off for packages/verified-specifications. Delete the override and repair what it reports, or keep only the exact exception recorded by the repository's engineering decision log.",
          },
        ],
        warnings: [],
        scanned: 5,
        configMissing: false,
      });
    });
  });

  describe("a disabled declaration whose files value is dynamic", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "preset-adoption-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      for (const [relativePath, writtenSource] of Object.entries({
        ...TWO_WORKSPACES,
        "vite.config.ts": `import { dontReviewItPreset } from "@mst/dont-review-it";
export default {
  lint: dontReviewItPreset.lint({ overrides: [{
    files: sharedFiles,
    rules: { "dont-review-it/no-reassign--use-spread-or-iife": "off" },
  }] }),
};`,
      })) {
        const writtenPath = join(repositoryRoot, relativePath);
        mkdirSync(dirname(writtenPath), { recursive: true });
        writeFileSync(writtenPath, writtenSource, "utf8");
      }
      return runPresetAdoptionChecks({
        repositoryRoot,
        config: defaultPresetAdoptionConfig,
      });
    });

    it("reports the path problem and every workspace the unknown path might reach", ({
      report,
    }) => {
      expect(report).toStrictEqual({
        problems: [
          {
            file: "vite.config.ts",
            line: 4,
            message:
              "An override containing a disabled preset rule must declare files as a literal array so its reach is inspectable.",
          },
          {
            file: "vite.config.ts",
            line: 5,
            message:
              "The lint configuration must not leave dont-review-it/no-reassign--use-spread-or-iife switched off for packages/left. Delete the override and repair what it reports, or keep only the exact exception recorded by the repository's engineering decision log.",
          },
          {
            file: "vite.config.ts",
            line: 5,
            message:
              "The lint configuration must not leave dont-review-it/no-reassign--use-spread-or-iife switched off for packages/right. Delete the override and repair what it reports, or keep only the exact exception recorded by the repository's engineering decision log.",
          },
        ],
        warnings: [],
        scanned: 2,
        configMissing: false,
      });
    });
  });

  describe("caller ignore patterns that reach a repository lint source", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "preset-adoption-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      for (const [relativePath, writtenSource] of Object.entries({
        ...TWO_WORKSPACES,
        "src/order.ts": "export const order = 1;\n",
        "vite.config.ts": `import { dontReviewItPreset } from "@mst/dont-review-it";
export default { lint: dontReviewItPreset.lint({ ignorePatterns: ["src/**"] }) };`,
      })) {
        const writtenPath = join(repositoryRoot, relativePath);
        mkdirSync(dirname(writtenPath), { recursive: true });
        writeFileSync(writtenPath, writtenSource, "utf8");
      }
      return runPresetAdoptionChecks({
        repositoryRoot,
        config: defaultPresetAdoptionConfig,
      });
    });

    it("rejects the pattern at the preset adoption boundary", ({ report }) => {
      expect(report).toStrictEqual({
        problems: [
          {
            file: "vite.config.ts",
            line: 2,
            message:
              "The root lint.ignorePatterns patterns must not remove repository lint source src/order.ts. Delete or narrow the matching pattern.",
          },
        ],
        warnings: [],
        scanned: 2,
        configMissing: false,
      });
    });
  });

  describe("caller ignore patterns outside repository lint sources", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "preset-adoption-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      for (const [relativePath, writtenSource] of Object.entries({
        ...TWO_WORKSPACES,
        "docs/guide.md": "# Guide\n",
        "src/order.ts": "export const order = 1;\n",
        "vite.config.ts": `import { dontReviewItPreset } from "@mst/dont-review-it";
export default { lint: dontReviewItPreset.lint({ ignorePatterns: ["docs/**"] }) };`,
      })) {
        const writtenPath = join(repositoryRoot, relativePath);
        mkdirSync(dirname(writtenPath), { recursive: true });
        writeFileSync(writtenPath, writtenSource, "utf8");
      }
      return runPresetAdoptionChecks({
        repositoryRoot,
        config: defaultPresetAdoptionConfig,
      });
    });

    it("accepts the pattern while preserving lint reach", ({ report }) => {
      expect(report).toStrictEqual({
        problems: [],
        warnings: [],
        scanned: 2,
        configMissing: false,
      });
    });
  });

  describe("native Oxlint self-suppression in a repository lint source", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "preset-adoption-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      for (const [relativePath, writtenSource] of Object.entries({
        ...TWO_WORKSPACES,
        "src/order.ts":
          "// oxlint-disable-next-line dont-review-it/no-inline-suppression-of-protected-rule--register-the-exception-in-configuration\nexport const order = readOrder();\n",
        "vite.config.ts": `import { dontReviewItPreset } from "@mst/dont-review-it";
export default { lint: dontReviewItPreset.lint({}) };`,
      })) {
        const writtenPath = join(repositoryRoot, relativePath);
        mkdirSync(dirname(writtenPath), { recursive: true });
        writeFileSync(writtenPath, writtenSource, "utf8");
      }
      return runPresetAdoptionChecks({
        repositoryRoot,
        config: defaultPresetAdoptionConfig,
      });
    });

    it("reports the directive outside the suppressible lint engine", ({ report }) => {
      expect(report).toStrictEqual({
        problems: [
          {
            file: "src/order.ts",
            line: 1,
            message:
              "A native Oxlint disable directive must not suppress every rule or no-inline-suppression-of-protected-rule--register-the-exception-in-configuration, because that removes the guard that rejects protected-rule suppressions. Delete the directive and register an allowed deviation in configuration.",
          },
        ],
        warnings: [],
        scanned: 2,
        configMissing: false,
      });
    });
  });

  describe("native Oxlint self-suppression in a generated declaration source", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "preset-adoption-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      for (const [relativePath, writtenSource] of Object.entries({
        ...TWO_WORKSPACES,
        "src/generated.d.ts":
          "// oxlint-disable-next-line dont-review-it/no-inline-suppression-of-protected-rule--register-the-exception-in-configuration\nexport declare const order: number;\n",
        "vite.config.ts": `import { dontReviewItPreset } from "@mst/dont-review-it";
export default { lint: dontReviewItPreset.lint({}) };`,
      })) {
        const writtenPath = join(repositoryRoot, relativePath);
        mkdirSync(dirname(writtenPath), { recursive: true });
        writeFileSync(writtenPath, writtenSource, "utf8");
      }
      return runPresetAdoptionChecks({
        repositoryRoot,
        config: defaultPresetAdoptionConfig,
      });
    });

    it("keeps the guard rule's standard generated-path scope", ({ report }) => {
      expect(report).toStrictEqual({
        problems: [],
        warnings: [],
        scanned: 2,
        configMissing: false,
      });
    });
  });

  describe("a repository without a toolchain configuration", () => {
    const it = test.extend("report", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "preset-adoption-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      for (const [relativePath, writtenSource] of Object.entries(TWO_WORKSPACES)) {
        const writtenPath = join(repositoryRoot, relativePath);
        mkdirSync(dirname(writtenPath), { recursive: true });
        writeFileSync(writtenPath, writtenSource, "utf8");
      }
      return runPresetAdoptionChecks({
        repositoryRoot,
        config: defaultPresetAdoptionConfig,
      });
    });

    it("reports nothing and says why the check did not inspect adoption", ({ report }) => {
      expect(report).toStrictEqual({
        problems: [],
        warnings: [],
        scanned: 2,
        configMissing: true,
      });
    });
  });
});
