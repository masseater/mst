import { describe, expect, test } from "vite-plus/test";

import { adoptedBundlesIn } from "./adopted-bundles.ts";

const TOOLCHAIN_CONFIG_FILE_NAME = "vite.config.ts";

const EVERY_BUNDLE_CONFIG = `export default defineConfig({ lint: preset.lint({ bundles: "all" }) });`;

const NO_BUNDLE_CONFIG = `export default defineConfig({ lint: preset.lint({ bundles: "none" }) });`;

const NAMED_BUNDLES_CONFIG = `export default defineConfig({
  lint: preset.lint({ bundles: ["testing", "made-up", "toolchain"] }),
});`;

const UNDECLARED_BUNDLES_CONFIG = `export default defineConfig({ lint: preset.lint({}) });`;

describe("adoptedBundlesIn", () => {
  describe("a configuration asking for every bundle", () => {
    const it = test.extend("adoptedBundles", () =>
      adoptedBundlesIn({
        source: EVERY_BUNDLE_CONFIG,
        toolchainConfigFileName: TOOLCHAIN_CONFIG_FILE_NAME,
      }));

    it("names every bundle the package declares", ({ adoptedBundles }) => {
      expect(adoptedBundles).toStrictEqual([
        "governance",
        "writing",
        "testing",
        "single-ownership",
        "mutation-and-failure",
        "toolchain",
        "publishing",
        "ci",
      ]);
    });
  });

  describe("a configuration whose selection is a written out word of its own", () => {
    const it = test.extend("adoptedBundles", () =>
      adoptedBundlesIn({
        source: NO_BUNDLE_CONFIG,
        toolchainConfigFileName: TOOLCHAIN_CONFIG_FILE_NAME,
      }));

    it("names no bundle at all", ({ adoptedBundles }) => {
      expect(adoptedBundles).toStrictEqual([]);
    });
  });

  describe("a configuration naming bundles, one of them undeclared", () => {
    const it = test.extend("adoptedBundles", () =>
      adoptedBundlesIn({
        source: NAMED_BUNDLES_CONFIG,
        toolchainConfigFileName: TOOLCHAIN_CONFIG_FILE_NAME,
      }));

    it("keeps the declared ones and drops the rest", ({ adoptedBundles }) => {
      expect(adoptedBundles).toStrictEqual(["testing", "toolchain"]);
    });
  });

  describe("a configuration that names no bundle at all", () => {
    const it = test.extend("adoptedBundles", () =>
      adoptedBundlesIn({
        source: UNDECLARED_BUNDLES_CONFIG,
        toolchainConfigFileName: TOOLCHAIN_CONFIG_FILE_NAME,
      }));

    it("hands back nothing, leaving the caller to run every check", ({ adoptedBundles }) => {
      expect(adoptedBundles).toBe(null);
    });
  });
});
