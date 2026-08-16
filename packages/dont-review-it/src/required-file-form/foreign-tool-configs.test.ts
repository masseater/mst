import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { defaultRequiredFileFormConfig } from "./config.ts";
import { foreignToolConfigsIn } from "./foreign-tool-configs.ts";

const PACKAGE_ROOT = ".";

describe("foreignToolConfigsIn", () => {
  describe("a package root holding no configuration the type checker misses", () => {
    const it = test.extend("problems", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "foreign-tool-configs-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      writeFileSync(join(repositoryRoot, "vite.config.ts"), "export default {};\n", "utf8");
      return foreignToolConfigsIn({
        repositoryRoot,
        packageRoot: PACKAGE_ROOT,
        config: defaultRequiredFileFormConfig,
      });
    });

    it("says nothing about it", ({ problems }) => {
      expect(problems).toStrictEqual([]);
    });
  });

  describe("a package root holding a configuration in a format the type checker never reads", () => {
    const it = test.extend("problems", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "foreign-tool-configs-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      writeFileSync(join(repositoryRoot, ".oxlintrc.json"), "{}\n", "utf8");
      return foreignToolConfigsIn({
        repositoryRoot,
        packageRoot: PACKAGE_ROOT,
        config: defaultRequiredFileFormConfig,
      });
    });

    it("names the spelling the tool reads instead", ({ problems }) => {
      expect(problems).toStrictEqual([
        {
          file: ".oxlintrc.json",
          line: null,
          message:
            "A configuration for oxlint must not stay in a format the type checker never reads. Move what it declares into vite.config.ts.",
        },
      ]);
    });
  });
});
