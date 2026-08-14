import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, onTestFinished, test } from "vite-plus/test";

import { defaultTelemetryWiringConfig } from "./config.ts";
import { runTelemetryWiringChecks } from "./run-telemetry-wiring-checks.ts";

const ONE_WORKSPACE = {
  "package.json": `{ "name": "root" }`,
  "packages/measured/package.json": `{ "name": "measured" }`,
};

describe("runTelemetryWiringChecks", () => {
  describe("a test block that declares the telemetry it runs under", () => {
    const it = test.extend("reportOverATestBlockDeclaringTelemetry", () => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "telemetry-wiring-"));
      onTestFinished(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      for (const [relativePath, writtenSource] of Object.entries({
        ...ONE_WORKSPACE,
        "packages/measured/vite.config.ts": `export default defineConfig({
  test: { experimental: { openTelemetry: { enabled: false } } },
});`,
      })) {
        const writtenPath = join(repositoryRoot, relativePath);
        mkdirSync(dirname(writtenPath), { recursive: true });
        writeFileSync(writtenPath, writtenSource, "utf8");
      }
      return runTelemetryWiringChecks({ repositoryRoot, config: defaultTelemetryWiringConfig });
    });

    it("says nothing about a workspace that declares it", ({
      reportOverATestBlockDeclaringTelemetry,
    }) => {
      expect(reportOverATestBlockDeclaringTelemetry).toStrictEqual({ problems: [], scanned: 2 });
    });
  });

  describe("a test block that declares no telemetry", () => {
    const it = test.extend("reportOverATestBlockDeclaringNoTelemetry", () => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "telemetry-wiring-"));
      onTestFinished(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      for (const [relativePath, writtenSource] of Object.entries({
        ...ONE_WORKSPACE,
        "packages/measured/vite.config.ts": `export default defineConfig({
  test: { coverage: { thresholds: { 100: true } } },
});`,
      })) {
        const writtenPath = join(repositoryRoot, relativePath);
        mkdirSync(dirname(writtenPath), { recursive: true });
        writeFileSync(writtenPath, writtenSource, "utf8");
      }
      return runTelemetryWiringChecks({ repositoryRoot, config: defaultTelemetryWiringConfig });
    });

    it("names the configuration that runs the block unmeasured", ({
      reportOverATestBlockDeclaringNoTelemetry,
    }) => {
      expect(reportOverATestBlockDeclaringNoTelemetry).toStrictEqual({
        problems: [
          {
            file: "packages/measured/vite.config.ts",
            line: 1,
            message:
              "A test block must not run without telemetry, because a workspace nobody measures is indistinguishable from a workspace that is fast. Declare experimental.openTelemetry in this block.",
          },
        ],
        scanned: 2,
      });
    });
  });

  describe("a configuration without a test block", () => {
    const it = test.extend("reportOverAConfigurationWithoutATestBlock", () => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "telemetry-wiring-"));
      onTestFinished(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      for (const [relativePath, writtenSource] of Object.entries({
        ...ONE_WORKSPACE,
        "packages/measured/vite.config.ts": `export default defineConfig({
  pack: { entry: ["src/index.ts"] },
});`,
      })) {
        const writtenPath = join(repositoryRoot, relativePath);
        mkdirSync(dirname(writtenPath), { recursive: true });
        writeFileSync(writtenPath, writtenSource, "utf8");
      }
      return runTelemetryWiringChecks({ repositoryRoot, config: defaultTelemetryWiringConfig });
    });

    it("says nothing about a workspace that spends no time on a test block", ({
      reportOverAConfigurationWithoutATestBlock,
    }) => {
      expect(reportOverAConfigurationWithoutATestBlock).toStrictEqual({
        problems: [],
        scanned: 2,
      });
    });
  });
});
