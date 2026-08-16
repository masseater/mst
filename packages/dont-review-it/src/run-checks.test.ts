import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { runChecks } from "./run-checks.ts";

const ADOPTING_ONE_BUNDLE = `export default defineConfig({
  lint: dontReviewItPreset.lint({ bundles: ["testing"] }),
});
`;

describe("runChecks", () => {
  describe("a repository naming one bundle", () => {
    const it = test.extend("skippedChecks", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "run-checks-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      writeFileSync(join(repositoryRoot, "vite.config.ts"), ADOPTING_ONE_BUNDLE, "utf8");
      return runChecks(repositoryRoot)
        .outcomes.filter((ranCheck) => ranCheck.skippedReason === "bundle not adopted")
        .map((ranCheck) => ranCheck.check);
    });

    it("leaves every check of a bundle it never named unrun", ({ skippedChecks }) => {
      expect(skippedChecks).toStrictEqual([
        "entry-composition",
        "canonical-values",
        "equivalent-concepts",
        "duplicated-bodies",
        "workflow-definitions",
        "action-updates",
        "lint-rule-index",
        "lint-rule-docs",
        "dependency-declarations",
        "required-file-form",
        "preset-adoption",
        "telemetry-wiring",
        "shippable-packages",
        "intent-skills",
      ]);
    });
  });

  describe("a repository whose toolchain configuration names no bundle", () => {
    const it = test.extend("skippedChecks", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "run-checks-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      writeFileSync(
        join(repositoryRoot, "vite.config.ts"),
        `export default defineConfig({ lint: dontReviewItPreset.lint({}) });\n`,
        "utf8",
      );
      return runChecks(repositoryRoot)
        .outcomes.filter((ranCheck) => ranCheck.skippedReason === "bundle not adopted")
        .map((ranCheck) => ranCheck.check);
    });

    it("leaves no check unrun", ({ skippedChecks }) => {
      expect(skippedChecks).toStrictEqual([]);
    });
  });

  describe("a repository carrying the files every check looks for", () => {
    const it = test.extend("skippedChecks", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "run-checks-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, ".github/workflows"), { recursive: true });
      writeFileSync(join(repositoryRoot, "package.json"), `{ "name": "root" }\n`, "utf8");
      writeFileSync(
        join(repositoryRoot, "pnpm-workspace.yaml"),
        "packages:\n  - packages/*\n",
        "utf8",
      );
      writeFileSync(
        join(repositoryRoot, ".github/workflows/ci.yml"),
        "name: ci\non: push\n",
        "utf8",
      );
      writeFileSync(
        join(repositoryRoot, "vite.config.ts"),
        `export default defineConfig({ lint: dontReviewItPreset.lint({ bundles: "all" }) });\n`,
        "utf8",
      );
      return runChecks(repositoryRoot)
        .outcomes.filter((ranCheck) => ranCheck.skippedReason !== null)
        .map((ranCheck) => ranCheck.check);
    });

    it("leaves no check unrun for want of what it reads", ({ skippedChecks }) => {
      expect(skippedChecks).toStrictEqual([]);
    });
  });

  describe("a repository whose workspace definition does not parse", () => {
    const it = test.extend("skippedChecks", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "run-checks-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      writeFileSync(join(repositoryRoot, "pnpm-workspace.yaml"), "packages:\n  - [\n", "utf8");
      return runChecks(repositoryRoot)
        .outcomes.filter(
          (ranCheck) => ranCheck.skippedReason === "workspace definition does not parse",
        )
        .map((ranCheck) => ranCheck.check);
    });

    it("leaves the checks that read it unrun", ({ skippedChecks }) => {
      expect(skippedChecks).toStrictEqual(["lint-rule-index", "lint-rule-docs"]);
    });
  });

  describe("a repository naming no bundle at all", () => {
    const it = test.extend("skippedChecks", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "run-checks-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      return runChecks(repositoryRoot)
        .outcomes.filter((ranCheck) => ranCheck.skippedReason === "bundle not adopted")
        .map((ranCheck) => ranCheck.check);
    });

    it("leaves no check unrun", ({ skippedChecks }) => {
      expect(skippedChecks).toStrictEqual([]);
    });
  });
});
