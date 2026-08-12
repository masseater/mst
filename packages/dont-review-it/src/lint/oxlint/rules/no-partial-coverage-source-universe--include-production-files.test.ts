import { testLintRule } from "@mst/lint-rule-authoring";
import { describe, expect, test } from "vite-plus/test";

import { noPartialCoverageSourceUniverse } from "./no-partial-coverage-source-universe--include-production-files.ts";

const configFor = (coverage: string): string =>
  `import { defineConfig } from "vite-plus";\nexport default defineConfig({ test: { coverage: ${coverage} } });\n`;

describe("dont-review-it/no-partial-coverage-source-universe--include-production-files", () => {
  testLintRule(noPartialCoverageSourceUniverse, {
    valid: [
      {
        name: "the production source root is included explicitly",
        code: configFor(`{ include: ["src/**/*.{js,cjs,mjs,jsx,ts,cts,mts,tsx}"] }`),
        filename: "vite.config.ts",
      },
      {
        name: "a repository can declare its own production roots through the rule option",
        code: configFor(`{ include: ["lib/**/*.ts", "app/**/*.tsx"] }`),
        filename: "vitest.config.ts",
        options: [{ include: ["lib/**/*.ts", "app/**/*.tsx"] }],
      },
      {
        name: "extra roots do not remove the required production root",
        code: configFor(
          `{ include: ["src/**/*.{js,cjs,mjs,jsx,ts,cts,mts,tsx}", "scripts/**/*.ts"] }`,
        ),
        filename: "vite.config.mts",
      },
      {
        name: "a direct static default object declares the same closed universe",
        code: `export default { test: { coverage: { include: ["src/**/*.{js,cjs,mjs,jsx,ts,cts,mts,tsx}"] } } };`,
        filename: "vite.config.ts",
      },
      {
        name: "an aliased Vite Plus defineConfig import is the authentic factory binding",
        code: `import { defineConfig as config } from "vite-plus";\nexport default config({ test: { coverage: { include: ["src/**/*.{js,cjs,mjs,jsx,ts,cts,mts,tsx}"] } } });`,
        filename: "vite.config.js",
      },
      {
        name: "a Vite namespace defineConfig call is an authentic factory binding",
        code: `import * as vite from "vite";\nexport default vite.defineConfig({ test: { coverage: { include: ["src/**/*.{js,cjs,mjs,jsx,ts,cts,mts,tsx}"] } } });`,
        filename: "vite.config.mjs",
      },
      {
        name: "an aliased Vite defineConfig import is an authentic factory binding",
        code: `import { defineConfig as config } from "vite";\nexport default config({ test: { coverage: { include: ["src/**/*.{js,cjs,mjs,jsx,ts,cts,mts,tsx}"] } } });`,
        filename: "vite.config.ts",
      },
      {
        name: "a Vite Plus namespace defineConfig call is an authentic factory binding",
        code: `import * as vitePlus from "vite-plus";\nexport default vitePlus.defineConfig({ test: { coverage: { include: ["src/**/*.{js,cjs,mjs,jsx,ts,cts,mts,tsx}"] } } });`,
        filename: "vite.config.ts",
      },
      {
        name: "a Vitest defineConfig import is an authentic test config factory",
        code: `import { defineConfig as config } from "vitest/config";\nexport default config({ test: { coverage: { include: ["src/**/*.{js,cjs,mjs,jsx,ts,cts,mts,tsx}"] } } });`,
        filename: "vitest.config.ts",
      },
      {
        name: "a Vitest namespace defineConfig call is an authentic test config factory",
        code: `import * as vitest from "vitest/config";\nexport default vitest.defineConfig({ test: { coverage: { include: ["src/**/*.{js,cjs,mjs,jsx,ts,cts,mts,tsx}"] } } });`,
        filename: "vitest.config.mts",
      },
      {
        name: "TypeScript expression wrappers preserve a static config",
        code: `import { defineConfig } from "vite-plus";\nexport default (defineConfig(({ test: { coverage: ({ include: (["src/**/*.{js,cjs,mjs,jsx,ts,cts,mts,tsx}"] as string[]) } as Coverage) } } satisfies Config)) satisfies Config);`,
        filename: "vite.config.ts",
      },
      {
        name: "non-null and angle assertions preserve a static config",
        code: `export default (<Config>{ test: { coverage: (<Coverage>{ include: (<string[]>["src/**/*.{js,cjs,mjs,jsx,ts,cts,mts,tsx}"]) }) } })!;`,
        filename: "vite.config.ts",
      },
      {
        name: "an as assertion preserves a static default export",
        code: `export default ({ test: { coverage: { include: ["src/**/*.{js,cjs,mjs,jsx,ts,cts,mts,tsx}"] } } } as Config);`,
        filename: "vite.config.ts",
      },
      {
        name: "a static non-test Vite task does not create a second test entrypoint",
        code: `import { defineConfig } from "vite-plus";\nexport default defineConfig({ run: { tasks: { build: { command: "vp build" } } }, test: { coverage: { include: ["src/**/*.{js,cjs,mjs,jsx,ts,cts,mts,tsx}"] } } });`,
        filename: "vite.config.ts",
      },
      {
        name: "an empty rule option keeps the default production root",
        code: configFor(`{ include: ["src/**/*.{js,cjs,mjs,jsx,ts,cts,mts,tsx}"] }`),
        filename: "vite.config.ts",
        options: [{}],
      },
      {
        name: "a file outside the test config boundary is not inspected",
        code: "export default { test: { coverage: {} } };\n",
        filename: "src/config.ts",
      },
      {
        name: "an unrelated tool config is not a test coverage config",
        code: "export default { rules: {} };\n",
        filename: "eslint.config.ts",
      },
      {
        name: "an arbitrary config object cannot be selected by a guarded test command",
        code: `export default { test: { coverage: {} } };`,
        filename: "arbitrary.config.ts",
      },
      {
        name: "an authentic config factory outside the canonical filename is not selected",
        code: `import { defineConfig } from "vite-plus";\nexport default defineConfig({ test: { coverage: {} } });`,
        filename: "arbitrary.ts",
      },
      {
        name: "a type-only defineConfig import does not turn a source file into a config",
        code: `import type { defineConfig } from "vite-plus";\nexport type Factory = typeof defineConfig;`,
        filename: "src/factory.ts",
      },
      {
        name: "an unused defineConfig value import does not turn a source file into a config",
        code: `import { defineConfig } from "vite-plus";\nexport const factory = defineConfig;`,
        filename: "src/factory.ts",
      },
      {
        name: "a type-only Vitest defineConfig import does not turn a source file into a config",
        code: `import type { defineConfig } from "vitest/config";\nexport type Factory = typeof defineConfig;`,
        filename: "src/factory.ts",
      },
    ],
    invalid: [
      {
        name: "coverage without an include pattern omits unimported source",
        code: configFor("{ thresholds: { 100: true, perFile: true } }"),
        filename: "vite.config.ts",
        errors: [{ messageId: "missingProductionSourcePattern" }],
        output: configFor(
          `{ thresholds: { 100: true, perFile: true }, include: ["src/**/*.{js,cjs,mjs,jsx,ts,cts,mts,tsx}"] }`,
        ),
      },
      {
        name: "an empty include array receives the required production root",
        code: configFor("{ include: [] }"),
        filename: "vite.config.ts",
        errors: [{ messageId: "missingProductionSourcePattern" }],
        output: configFor(`{ include: ["src/**/*.{js,cjs,mjs,jsx,ts,cts,mts,tsx}"] }`),
      },
      {
        name: "an empty coverage object receives every configured production root",
        code: configFor("{}"),
        filename: "vite.config.ts",
        options: [{ include: ["lib/**/*.ts", "app/**/*.tsx"] }],
        errors: [
          { messageId: "missingProductionSourcePattern" },
          { messageId: "missingProductionSourcePattern" },
        ],
        output: configFor(`{include: ["lib/**/*.ts", "app/**/*.tsx"]}`),
      },
      {
        name: "a static config without coverage reports every required source root",
        code: `import { defineConfig } from "vite-plus";\nexport default defineConfig({});\n`,
        filename: "vite.config.ts",
        options: [{ include: ["lib/**/*.ts", "app/**/*.tsx"] }],
        errors: [
          { messageId: "missingProductionSourcePattern" },
          { messageId: "missingProductionSourcePattern" },
        ],
        output: null,
      },
      {
        name: "a dynamic include cannot prove which source files are measured",
        code: `const sourceFiles = ["src/**/*.ts"];\n${configFor("{ include: sourceFiles }")}`,
        filename: "vitest.config.ts",
        errors: [{ messageId: "dynamicCoverageConfiguration" }],
        output: null,
      },
      {
        name: "non-string array entries leave the effective source universe dynamic",
        code: `const sourcePattern = "src/**/*.ts";\n${configFor("{ include: [sourcePattern, 42] }")}`,
        filename: "vitest.config.ts",
        errors: [{ messageId: "dynamicCoverageConfiguration" }],
        output: null,
      },
      {
        name: "spread and empty include entries leave the effective source universe dynamic",
        code: `const patterns = ["src/**/*.ts"];\n${configFor("{ include: [...patterns, ,] }")}`,
        filename: "vitest.config.ts",
        errors: [{ messageId: "dynamicCoverageConfiguration" }],
        output: null,
      },
      {
        name: "each missing configured root is reported",
        code: configFor(`{ include: ["lib/**/*.ts"] }`),
        filename: "vite.config.mts",
        options: [{ include: ["lib/**/*.ts", "app/**/*.tsx"] }],
        errors: [{ messageId: "missingProductionSourcePattern" }],
        output: configFor(`{ include: ["lib/**/*.ts", "app/**/*.tsx"] }`),
      },
      {
        name: "an explicit exclusion can remove a production file from the denominator",
        code: configFor(
          `{ include: ["src/**/*.{js,cjs,mjs,jsx,ts,cts,mts,tsx}"], exclude: ["src/generated.ts"] }`,
        ),
        filename: "vite.config.ts",
        errors: [{ messageId: "excludedCoverageSource" }],
        output: null,
      },
      {
        name: "a negated include can subtract a file from an otherwise complete root",
        code: configFor(
          `{ include: ["src/**/*.{js,cjs,mjs,jsx,ts,cts,mts,tsx}", "!src/uncovered.ts"] }`,
        ),
        filename: "vite.config.ts",
        errors: [{ messageId: "negatedCoveragePattern" }],
        output: null,
      },
      {
        name: "a coverage spread can override include or introduce an exclusion",
        code: `const shared = {};\n${configFor(
          `{ include: ["src/**/*.{js,cjs,mjs,jsx,ts,cts,mts,tsx}"], ...shared }`,
        )}`,
        filename: "vite.config.ts",
        errors: [{ messageId: "dynamicCoverageConfiguration" }],
        output: null,
      },
      {
        name: "a computed coverage property can override the declared source universe",
        code: `const key = "exclude";\n${configFor(
          `{ include: ["src/**/*.{js,cjs,mjs,jsx,ts,cts,mts,tsx}"], [key]: ["src/uncovered.ts"] }`,
        )}`,
        filename: "vite.config.ts",
        errors: [{ messageId: "dynamicCoverageConfiguration" }],
        output: null,
      },
      {
        name: "a merge call can replace a complete source universe after it is inspected",
        code: `import { mergeConfig } from "vite-plus";\nconst override = {};\nexport default mergeConfig({ test: { coverage: { include: ["src/**/*.{js,cjs,mjs,jsx,ts,cts,mts,tsx}"] } } }, override);`,
        filename: "vite.config.ts",
        errors: [{ messageId: "dynamicCoverageConfiguration" }],
        output: null,
      },
      {
        name: "a CommonJS cjs config is directed to the inspectable ESM form",
        code: `module.exports = { test: { coverage: { include: ["src/**/*.{js,cjs,mjs,jsx,ts,cts,mts,tsx}"] } } };`,
        filename: "vite.config.cjs",
        errors: [{ messageId: "commonJsTestConfig" }],
        output: null,
      },
      {
        name: "a CommonJS js config cannot bypass the ESM resolver",
        code: `module["exports"] = { test: { coverage: { include: ["src/**/*.{js,cjs,mjs,jsx,ts,cts,mts,tsx}"] } } };`,
        filename: "vitest.config.js",
        errors: [{ messageId: "commonJsTestConfig" }],
        output: null,
      },
      {
        name: "a dot-property CommonJS js config gets the same ESM repair",
        code: `module.exports = { test: { coverage: { include: ["src/**/*.{js,cjs,mjs,jsx,ts,cts,mts,tsx}"] } } };`,
        filename: "vite.config.js",
        errors: [{ messageId: "commonJsTestConfig" }],
        output: null,
      },
      {
        name: "a dynamic module export spelling is not mistaken for inspectable ESM",
        code: `const key = "exports";\nmodule[key] = { test: { coverage: { include: ["src/**/*.{js,cjs,mjs,jsx,ts,cts,mts,tsx}"] } } };`,
        filename: "vite.config.js",
        errors: [{ messageId: "dynamicCoverageConfiguration" }],
        output: null,
      },
      {
        name: "a Vite test task cannot bypass the package script coverage guard",
        code: `import { defineConfig } from "vite-plus";\nexport default defineConfig({ run: { tasks: { test: { command: "vp test --coverage=false" } } }, test: { coverage: { include: ["src/**/*.{js,cjs,mjs,jsx,ts,cts,mts,tsx}"] } } });`,
        filename: "vite.config.ts",
        errors: [{ messageId: "testTaskBypassesCoverageGuard" }],
        output: null,
      },
      {
        name: "a variable Vite task map cannot hide a test entrypoint",
        code: `import { defineConfig } from "vite-plus";\nconst tasks = {};\nexport default defineConfig({ run: { tasks }, test: { coverage: { include: ["src/**/*.{js,cjs,mjs,jsx,ts,cts,mts,tsx}"] } } });`,
        filename: "vite.config.ts",
        errors: [{ messageId: "dynamicTestTaskConfiguration" }],
        output: null,
      },
      {
        name: "a spread Vite task map cannot hide a test entrypoint",
        code: `import { defineConfig } from "vite-plus";\nconst tasks = {};\nexport default defineConfig({ run: { tasks: { ...tasks } }, test: { coverage: { include: ["src/**/*.{js,cjs,mjs,jsx,ts,cts,mts,tsx}"] } } });`,
        filename: "vite.config.ts",
        errors: [{ messageId: "dynamicTestTaskConfiguration" }],
        output: null,
      },
      {
        name: "a local function named defineConfig is not trusted as the Vite Plus factory",
        code: `const defineConfig = (config) => ({});\nexport default defineConfig({ test: { coverage: { include: ["src/**/*.{js,cjs,mjs,jsx,ts,cts,mts,tsx}"] } } });`,
        filename: "vite.config.ts",
        errors: [{ messageId: "dynamicCoverageConfiguration" }],
        output: null,
      },
      {
        name: "a defineConfig spelling imported from another module is not trusted",
        code: `import { defineConfig } from "other-tool";\nexport default defineConfig({ test: { coverage: { include: ["src/**/*.{js,cjs,mjs,jsx,ts,cts,mts,tsx}"] } } });`,
        filename: "vite.config.ts",
        errors: [{ messageId: "dynamicCoverageConfiguration" }],
        output: null,
      },
      {
        name: "a computed namespace factory call is not accepted as the canonical binding",
        code: `import * as vite from "vite";\nexport default vite["defineConfig"]({ test: { coverage: { include: ["src/**/*.{js,cjs,mjs,jsx,ts,cts,mts,tsx}"] } } });`,
        filename: "vite.config.ts",
        errors: [{ messageId: "dynamicCoverageConfiguration" }],
        output: null,
      },
      {
        name: "a root spread can replace the complete test configuration",
        code: `import { defineConfig } from "vite-plus";\nconst shared = {};\nexport default defineConfig({ test: { coverage: { include: ["src/**/*.{js,cjs,mjs,jsx,ts,cts,mts,tsx}"] } }, ...shared });`,
        filename: "vite.config.ts",
        errors: [{ messageId: "dynamicCoverageConfiguration" }],
        output: null,
      },
      {
        name: "a variable test configuration can replace the coverage object",
        code: `import { defineConfig } from "vite-plus";\nconst testConfig = {};\nexport default defineConfig({ test: testConfig });`,
        filename: "vite.config.ts",
        errors: [{ messageId: "dynamicCoverageConfiguration" }],
        output: null,
      },
      {
        name: "a spread test object can replace the coverage configuration",
        code: `import { defineConfig } from "vite-plus";\nconst shared = {};\nexport default defineConfig({ test: { coverage: { include: ["src/**/*.{js,cjs,mjs,jsx,ts,cts,mts,tsx}"] }, ...shared } });`,
        filename: "vite.config.ts",
        errors: [{ messageId: "dynamicCoverageConfiguration" }],
        output: null,
      },
      {
        name: "defineConfig with more than one argument has an uninspected override",
        code: `import { defineConfig } from "vite-plus";\nexport default defineConfig({}, {});`,
        filename: "vite.config.ts",
        errors: [{ messageId: "dynamicCoverageConfiguration" }],
        output: null,
      },
      {
        name: "defineConfig with a variable argument leaves the object uninspected",
        code: `import { defineConfig } from "vite-plus";\nconst config = {};\nexport default defineConfig(config);`,
        filename: "vite.config.ts",
        errors: [{ messageId: "dynamicCoverageConfiguration" }],
        output: null,
      },
      {
        name: "a test config without a default export leaves the object uninspected",
        code: `export const config = {};`,
        filename: "vite.config.ts",
        errors: [{ messageId: "dynamicCoverageConfiguration" }],
        output: null,
      },
      {
        name: "an unreadable test config leaves the production universe unproven",
        code: "const config = { test: { coverage: {} } };\nexport default config;\n",
        filename: "vite.config.ts",
        errors: [{ messageId: "dynamicCoverageConfiguration" }],
        output: null,
      },
    ],
  });

  test("the option schema refuses empty and negated required patterns", () => {
    expect(noPartialCoverageSourceUniverse.meta.schema).toStrictEqual([
      {
        type: "object",
        properties: {
          include: {
            type: "array",
            items: { type: "string", minLength: 1, pattern: "^[^!]" },
            minItems: 1,
            uniqueItems: true,
          },
        },
        additionalProperties: false,
      },
    ]);
  });
});
