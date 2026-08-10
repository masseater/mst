import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { noUnwrappedToolchainConfig } from "./no-unwrapped-toolchain-config--wrap-with-git-excludes.ts";

const NAMED_IMPORTS =
  'import { withGitExcludes } from "@mst/dont-review-it";\nimport { defineConfig } from "vite-plus";\n';

const NAMESPACE_IMPORTS =
  'import * as dontReviewIt from "@mst/dont-review-it";\nimport * as vitePlus from "vite-plus";\n';

describe("dont-review-it/no-unwrapped-toolchain-config--wrap-with-git-excludes", () => {
  testLintRule(noUnwrappedToolchainConfig, {
    valid: [
      {
        name: "both blocks pass through the wrapper",
        code: `${NAMED_IMPORTS}export default defineConfig({ fmt: withGitExcludes({}), lint: withGitExcludes({ extends: [] }) });`,
      },
      {
        name: "the wrapper reached through a namespace counts",
        code: `${NAMESPACE_IMPORTS}export default vitePlus.defineConfig({ lint: dontReviewIt.withGitExcludes({ extends: [] }) });`,
      },
      {
        name: "a configuration that declares neither block has nothing to wrap",
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
        name: "the wrapper renamed on import is still the wrapper",
        code: 'import { withGitExcludes as excluded } from "@mst/dont-review-it";\nimport { defineConfig } from "vite-plus";\nexport default defineConfig({ lint: excluded({ extends: [] }) });',
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
        name: "some other call in place of the wrapper does not count",
        code: `${NAMED_IMPORTS}export default defineConfig({ lint: Object.freeze({ extends: [] }) });`,
        errors: [{ messageId: "unwrappedLint" }],
      },
      {
        name: "the namespace form is checked the same way",
        code: `${NAMESPACE_IMPORTS}export default vitePlus.defineConfig({ fmt: {} });`,
        errors: [{ messageId: "unwrappedFmt" }],
      },
    ],
  });
});
