import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { noUnwrappedToolchainConfig } from "./no-unwrapped-toolchain-config--call-the-preset-for-the-block.ts";

const NAMED_IMPORTS =
  'import { dontReviewItPreset } from "@mst/dont-review-it";\nimport { defineConfig } from "vite-plus";\n';

const NAMESPACE_IMPORTS =
  'import * as dontReviewIt from "@mst/dont-review-it";\nimport * as vitePlus from "vite-plus";\n';

describe("dont-review-it/no-unwrapped-toolchain-config--call-the-preset-for-the-block", () => {
  testLintRule(noUnwrappedToolchainConfig, {
    valid: [
      {
        name: "both blocks call the preset function that matches them",
        documented: true,
        code: `${NAMED_IMPORTS}export default defineConfig({ fmt: dontReviewItPreset.fmt(), lint: dontReviewItPreset.lint({ rules: {} }) });`,
      },
      {
        name: "the preset reached through a namespace counts",
        code: `${NAMESPACE_IMPORTS}export default vitePlus.defineConfig({ lint: dontReviewIt.dontReviewItPreset.lint({}) });`,
      },
      {
        name: "a configuration that declares neither block has nothing to wrap",
        documented: true,
        code: `${NAMED_IMPORTS}export default defineConfig({ pack: { entry: ["src/index.ts"] } });`,
      },
      {
        name: "an object that never reaches the toolchain factory is not a configuration",
        code: `${NAMED_IMPORTS}const settings = { lint: {}, fmt: {} };\nexport { settings };`,
      },
      {
        name: "a defineConfig from somewhere else is a different function",
        code: 'import { defineConfig } from "some-other-tool";\nexport default defineConfig({ lint: {} });',
      },
      {
        name: "the preset named as a string on import is still the preset",
        code: `import { "dontReviewItPreset" as preset } from "@mst/dont-review-it";\nimport { defineConfig } from "vite-plus";\nexport default defineConfig({ lint: preset.lint({}) });`,
      },
      {
        name: "a default import brings in no named binding to match",
        code: `import dontReviewIt from "@mst/dont-review-it";\nimport { defineConfig } from "vite-plus";\nexport default defineConfig({ pack: {} });`,
      },
      {
        name: "another name imported from the same module is not the preset",
        code: `import { oxlint } from "@mst/dont-review-it";\nimport { defineConfig } from "vite-plus";\nexport default defineConfig({ pack: { entry: [] } });`,
      },
      {
        name: "a factory reached through a computed name is not the toolchain factory",
        code: `${NAMESPACE_IMPORTS}export default vitePlus["defineConfig"]({ lint: {} });`,
      },
      {
        name: "a factory reached through a longer path is not the toolchain factory",
        code: `${NAMESPACE_IMPORTS}export default vitePlus.config.defineConfig({ lint: {} });`,
      },
      {
        name: "a configuration handed no object at all declares no block",
        code: `${NAMED_IMPORTS}export default defineConfig();`,
      },
      {
        name: "a block spread in from elsewhere names no property here",
        code: `${NAMED_IMPORTS}export default defineConfig({ ...base });`,
      },
      {
        name: "a block reached through a computed name cannot be read as a block",
        code: `${NAMED_IMPORTS}export default defineConfig({ [block]: {} });`,
      },
      {
        name: "a block named as a string is read as the block it names",
        code: `${NAMED_IMPORTS}export default defineConfig({ "pack": {} });`,
      },
      {
        name: "the preset renamed on import is still the preset",
        code: 'import { dontReviewItPreset as preset } from "@mst/dont-review-it";\nimport { defineConfig } from "vite-plus";\nexport default defineConfig({ lint: preset.lint({}) });',
      },
    ],
    invalid: [
      {
        name: "a bare lint block is reported",
        code: `${NAMED_IMPORTS}export default defineConfig({ lint: { extends: [] } });`,
        errors: [{ messageId: "unwrappedLint" }],
      },
      {
        name: "a bare fmt block is reported",
        code: `${NAMED_IMPORTS}export default defineConfig({ fmt: {} });`,
        errors: [{ messageId: "unwrappedFmt" }],
      },
      {
        name: "both bare blocks are reported separately",
        documented: true,
        code: `${NAMED_IMPORTS}export default defineConfig({ fmt: {}, lint: {} });`,
        errors: [{ messageId: "unwrappedFmt" }, { messageId: "unwrappedLint" }],
      },
      {
        name: "a quoted key is the same key",
        code: `${NAMED_IMPORTS}export default defineConfig({ "lint": { extends: [] } });`,
        errors: [{ messageId: "unwrappedLint" }],
      },
      {
        name: "a block built elsewhere and handed over by name is not wrapped here",
        code: `${NAMED_IMPORTS}const lint = { extends: [] };\nexport default defineConfig({ lint });`,
        errors: [{ messageId: "unwrappedLint" }],
      },
      {
        name: "some other call in place of the preset does not count",
        code: `${NAMED_IMPORTS}export default defineConfig({ lint: Object.freeze({ extends: [] }) });`,
        errors: [{ messageId: "unwrappedLint" }],
      },
      {
        name: "the namespace form is checked the same way",
        code: `${NAMESPACE_IMPORTS}export default vitePlus.defineConfig({ fmt: {} });`,
        errors: [{ messageId: "unwrappedFmt" }],
      },
      {
        name: "the preset function for the other block does not stand in",
        documented: true,
        code: `${NAMED_IMPORTS}export default defineConfig({ fmt: dontReviewItPreset.lint({}) });`,
        errors: [{ messageId: "unwrappedFmt" }],
      },
      {
        name: "the preset called as a plain function names no block",
        code: `${NAMED_IMPORTS}export default defineConfig({ lint: dontReviewItPreset({}) });`,
        errors: [{ messageId: "unwrappedLint" }],
      },
      {
        name: "a preset member reached through a computed name cannot be read",
        code: `${NAMED_IMPORTS}export default defineConfig({ lint: dontReviewItPreset["lint"]({}) });`,
        errors: [{ messageId: "unwrappedLint" }],
      },
    ],
  });
});
