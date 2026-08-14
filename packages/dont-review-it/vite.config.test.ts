import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { loadConfigFromFile } from "vite";
import { describe, expect, it } from "vite-plus/test";

import agenticDocumentsManifest from "../agentic-documents/package.json" with { type: "json" };
import aiNativeManifest from "../ai-native/package.json" with { type: "json" };
import autoDevelopManifest from "../auto-develop/package.json" with { type: "json" };
import lintRuleAuthoringManifest from "../lint-rule-authoring/package.json" with { type: "json" };
import stopAiSlopManifest from "../stop-ai-slop/package.json" with { type: "json" };
import verifiedSpecificationsManifest from "../verified-specifications/package.json" with { type: "json" };
import dontReviewItManifest from "./package.json" with { type: "json" };
import { recordOf } from "./src/dependency-catalog/record-fields.ts";

const REPOSITORY_CHECKS = "@mst/repository-checks";

describe("実 process を所有する package のテスト実行", () => {
  it.each([
    {
      name: "ai-native",
      configPath: fileURLToPath(new URL("../ai-native/vite.config.ts", import.meta.url)),
    },
    {
      name: "auto-develop",
      configPath: fileURLToPath(new URL("../auto-develop/vite.config.ts", import.meta.url)),
    },
    {
      name: "dont-review-it",
      configPath: fileURLToPath(new URL("./vite.config.ts", import.meta.url)),
    },
    {
      name: "stop-ai-slop",
      configPath: fileURLToPath(new URL("../stop-ai-slop/vite.config.ts", import.meta.url)),
    },
  ])("$name の test files を直列に実行する", async ({ configPath }) => {
    const loadedConfig = await loadConfigFromFile(
      { command: "build", mode: "test" },
      configPath,
      dirname(configPath),
      "silent",
    );
    expect(recordOf(recordOf(loadedConfig?.config).test).fileParallelism).toBe(false);
  });
});

const publicationContractOf = ({
  config,
  manifest,
}: {
  readonly config: unknown;
  readonly manifest: unknown;
}) => {
  const manifestRecord = recordOf(manifest);
  const pack = recordOf(recordOf(config).pack);
  const dependencyPacking = recordOf(pack.deps);
  const packExports = recordOf(pack.exports);
  return {
    packEntry: pack.entry,
    packExports:
      typeof packExports.customExports === "function"
        ? { ...packExports, customExports: "function" }
        : pack.exports,
    sourceBin: manifestRecord.bin,
    sourceExports: manifestRecord.exports,
    publishedBin: recordOf(manifestRecord.publishConfig).bin,
    publishedExports: recordOf(manifestRecord.publishConfig).exports,
    bundledPrivateDependency: dependencyPacking.alwaysBundle,
    bundledPrivateDependencyTypes: recordOf(dependencyPacking.dts).alwaysBundle,
    externalPeerDependency: dependencyPacking.neverBundle,
    externalPeerDependencyTypes: recordOf(dependencyPacking.dts).neverBundle,
    runtimePrivateDependency: recordOf(manifestRecord.dependencies)[REPOSITORY_CHECKS],
    developmentPrivateDependency: recordOf(manifestRecord.devDependencies)[REPOSITORY_CHECKS],
    vitePlusPeer: recordOf(manifestRecord.peerDependencies)["vite-plus"],
    nodeEngine: recordOf(manifestRecord.engines).node,
  };
};

describe("公開 package の開発時と配布時の入口", () => {
  it.each([
    {
      name: "agentic-documents",
      configPath: fileURLToPath(new URL("../agentic-documents/vite.config.ts", import.meta.url)),
      manifest: agenticDocumentsManifest,
      expected: {
        packEntry: ["src/cli.ts"],
        packExports: {
          devExports: true,
          exclude: ["cli"],
          bin: { "agentic-documents": "src/cli.ts" },
          customExports: { "./package.json": "./package.json" },
        },
        sourceBin: { "agentic-documents": "./src/cli.ts" },
        sourceExports: { "./package.json": "./package.json" },
        publishedBin: { "agentic-documents": "./dist/cli.mjs" },
        publishedExports: { "./package.json": "./package.json" },
        bundledPrivateDependency: [REPOSITORY_CHECKS],
        bundledPrivateDependencyTypes: [REPOSITORY_CHECKS],
        externalPeerDependency: undefined,
        externalPeerDependencyTypes: undefined,
        runtimePrivateDependency: undefined,
        developmentPrivateDependency: "workspace:*",
        vitePlusPeer: undefined,
        nodeEngine: undefined,
      },
    },
    {
      name: "ai-native",
      configPath: fileURLToPath(new URL("../ai-native/vite.config.ts", import.meta.url)),
      manifest: aiNativeManifest,
      expected: {
        packEntry: ["src/throttle/cli.ts", "src/spool/cli.ts"],
        packExports: {
          devExports: true,
          exclude: ["spool/cli", "throttle/cli"],
          bin: {
            spool: "src/spool/cli.ts",
            throttle: "src/throttle/cli.ts",
          },
          customExports: { "./package.json": "./package.json" },
        },
        sourceBin: {
          spool: "./src/spool/cli.ts",
          throttle: "./src/throttle/cli.ts",
        },
        sourceExports: { "./package.json": "./package.json" },
        publishedBin: {
          spool: "./dist/spool/cli.mjs",
          throttle: "./dist/throttle/cli.mjs",
        },
        publishedExports: { "./package.json": "./package.json" },
        bundledPrivateDependency: undefined,
        bundledPrivateDependencyTypes: undefined,
        externalPeerDependency: undefined,
        externalPeerDependencyTypes: undefined,
        runtimePrivateDependency: undefined,
        developmentPrivateDependency: undefined,
        vitePlusPeer: undefined,
        nodeEngine: ">=26.0.0",
      },
    },
    {
      name: "auto-develop",
      configPath: fileURLToPath(new URL("../auto-develop/vite.config.ts", import.meta.url)),
      manifest: autoDevelopManifest,
      expected: {
        packEntry: ["src/cli.ts", "src/server.ts"],
        packExports: {
          devExports: true,
          exclude: ["cli", "server"],
          bin: { "auto-develop": "src/cli.ts" },
          customExports: "function",
        },
        sourceBin: { "auto-develop": "./src/cli.ts" },
        sourceExports: {
          "./server": "./src/server.ts",
          "./package.json": "./package.json",
        },
        publishedBin: { "auto-develop": "./dist/cli.mjs" },
        publishedExports: {
          "./server": "./dist/server.mjs",
          "./package.json": "./package.json",
        },
        bundledPrivateDependency: [REPOSITORY_CHECKS],
        bundledPrivateDependencyTypes: [REPOSITORY_CHECKS],
        externalPeerDependency: undefined,
        externalPeerDependencyTypes: undefined,
        runtimePrivateDependency: undefined,
        developmentPrivateDependency: "workspace:*",
        vitePlusPeer: undefined,
        nodeEngine: ">=26.0.0",
      },
    },
    {
      name: "dont-review-it",
      configPath: fileURLToPath(new URL("./vite.config.ts", import.meta.url)),
      manifest: dontReviewItManifest,
      expected: {
        packEntry: {
          cli: "src/cli.ts",
          index: "src/index.ts",
          plugin: "src/plugin.ts",
          vitest: "src/vitest/standard-io-test.ts",
        },
        packExports: {
          devExports: true,
          exclude: ["cli"],
          bin: { "dont-review-it": "src/cli.ts" },
          customExports: {
            "./package.json": "./package.json",
            "./tsconfig/*": "./tsconfig/*",
          },
        },
        sourceBin: { "dont-review-it": "./src/cli.ts" },
        sourceExports: {
          ".": "./src/index.ts",
          "./plugin": "./src/plugin.ts",
          "./vitest": "./src/vitest/standard-io-test.ts",
          "./package.json": "./package.json",
          "./tsconfig/*": "./tsconfig/*",
        },
        publishedBin: { "dont-review-it": "./dist/cli.mjs" },
        publishedExports: {
          ".": "./dist/index.mjs",
          "./plugin": "./dist/plugin.mjs",
          "./vitest": "./dist/vitest.mjs",
          "./package.json": "./package.json",
          "./tsconfig/*": "./tsconfig/*",
        },
        bundledPrivateDependency: [REPOSITORY_CHECKS],
        bundledPrivateDependencyTypes: [REPOSITORY_CHECKS],
        externalPeerDependency: ["vite-plus"],
        externalPeerDependencyTypes: ["vite-plus"],
        runtimePrivateDependency: undefined,
        developmentPrivateDependency: "workspace:*",
        vitePlusPeer: "catalog:",
        nodeEngine: undefined,
      },
    },
    {
      name: "lint-rule-authoring",
      configPath: fileURLToPath(new URL("../lint-rule-authoring/vite.config.ts", import.meta.url)),
      manifest: lintRuleAuthoringManifest,
      expected: {
        packEntry: ["src/cli.ts", "src/index.ts", "src/plugin.ts"],
        packExports: {
          devExports: true,
          exclude: ["cli"],
          bin: { "lint-rule-authoring": "src/cli.ts" },
          customExports: { "./package.json": "./package.json" },
        },
        sourceBin: { "lint-rule-authoring": "./src/cli.ts" },
        sourceExports: {
          ".": "./src/index.ts",
          "./plugin": "./src/plugin.ts",
          "./package.json": "./package.json",
        },
        publishedBin: { "lint-rule-authoring": "./dist/cli.mjs" },
        publishedExports: {
          ".": "./dist/index.mjs",
          "./plugin": "./dist/plugin.mjs",
          "./package.json": "./package.json",
        },
        bundledPrivateDependency: [REPOSITORY_CHECKS],
        bundledPrivateDependencyTypes: [REPOSITORY_CHECKS],
        externalPeerDependency: undefined,
        externalPeerDependencyTypes: undefined,
        runtimePrivateDependency: undefined,
        developmentPrivateDependency: "workspace:*",
        vitePlusPeer: undefined,
        nodeEngine: undefined,
      },
    },
    {
      name: "stop-ai-slop",
      configPath: fileURLToPath(new URL("../stop-ai-slop/vite.config.ts", import.meta.url)),
      manifest: stopAiSlopManifest,
      expected: {
        packEntry: ["src/cli.ts"],
        packExports: {
          devExports: true,
          exclude: ["cli"],
          bin: { "stop-ai-slop": "src/cli.ts" },
          customExports: { "./package.json": "./package.json" },
        },
        sourceBin: { "stop-ai-slop": "./src/cli.ts" },
        sourceExports: { "./package.json": "./package.json" },
        publishedBin: { "stop-ai-slop": "./dist/cli.mjs" },
        publishedExports: { "./package.json": "./package.json" },
        bundledPrivateDependency: [REPOSITORY_CHECKS],
        bundledPrivateDependencyTypes: [REPOSITORY_CHECKS],
        externalPeerDependency: undefined,
        externalPeerDependencyTypes: undefined,
        runtimePrivateDependency: undefined,
        developmentPrivateDependency: "workspace:*",
        vitePlusPeer: undefined,
        nodeEngine: ">=26.0.0",
      },
    },
    {
      name: "verified-specifications",
      configPath: fileURLToPath(
        new URL("../verified-specifications/vite.config.ts", import.meta.url),
      ),
      manifest: verifiedSpecificationsManifest,
      expected: {
        packEntry: ["src/cli.ts", "src/index.ts"],
        packExports: {
          devExports: true,
          exclude: ["cli"],
          bin: { "verified-specifications": "src/cli.ts" },
          customExports: { "./package.json": "./package.json" },
        },
        sourceBin: { "verified-specifications": "./src/cli.ts" },
        sourceExports: {
          ".": "./src/index.ts",
          "./package.json": "./package.json",
        },
        publishedBin: { "verified-specifications": "./dist/cli.mjs" },
        publishedExports: {
          ".": "./dist/index.mjs",
          "./package.json": "./package.json",
        },
        bundledPrivateDependency: [REPOSITORY_CHECKS],
        bundledPrivateDependencyTypes: [REPOSITORY_CHECKS],
        externalPeerDependency: undefined,
        externalPeerDependencyTypes: undefined,
        runtimePrivateDependency: undefined,
        developmentPrivateDependency: "workspace:*",
        vitePlusPeer: undefined,
        nodeEngine: undefined,
      },
    },
  ])("$name", async ({ configPath, manifest, expected }) => {
    const loadedConfig = await loadConfigFromFile(
      { command: "build", mode: "test" },
      configPath,
      dirname(configPath),
      "silent",
    );
    expect(publicationContractOf({ config: loadedConfig?.config, manifest })).toStrictEqual(
      expected,
    );
  });

  it("keeps the type-only lint-rule-authoring dependency of stop-ai-slop out of runtime", () => {
    expect(
      recordOf(recordOf(stopAiSlopManifest).dependencies)["@mst/lint-rule-authoring"],
    ).toBeUndefined();
    expect(recordOf(recordOf(stopAiSlopManifest).devDependencies)["@mst/lint-rule-authoring"]).toBe(
      "workspace:*",
    );
  });

  it("keeps the auto-develop server subpath stable across development and publication", async () => {
    const configPath = fileURLToPath(new URL("../auto-develop/vite.config.ts", import.meta.url));
    const loadedConfig = await loadConfigFromFile(
      { command: "build", mode: "test" },
      configPath,
      dirname(configPath),
      "silent",
    );
    const customExports = recordOf(
      recordOf(recordOf(loadedConfig?.config).pack).exports,
    ).customExports;
    expect(customExports).toStrictEqual(expect.any(Function));
    const resolveExports = customExports as (
      generatedExports: Readonly<Record<string, unknown>>,
      context: { readonly isPublish: boolean },
    ) => unknown;
    const packageExport = { "./package.json": "./package.json" };
    expect(resolveExports(packageExport, { isPublish: false })).toStrictEqual({
      ...packageExport,
      "./server": "./src/server.ts",
    });
    expect(resolveExports(packageExport, { isPublish: true })).toStrictEqual({
      ...packageExport,
      "./server": "./dist/server.mjs",
    });
  });
});
