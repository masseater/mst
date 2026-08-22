import { describe, expect, test } from "vite-plus/test";

import { defaultPresetAdoptionConfig } from "./config.ts";
import { inspectPresetAdoptionConfig } from "./inspect-preset-adoption-config.ts";

const EMPTY_INSPECTION = { disabledDeclarations: [], problems: [] };

const DIRECT_ADOPTION_MESSAGE =
  "The root lint block must be exactly one direct call to dontReviewItPreset.lint through a value import from @mst/dont-review-it, with one object literal argument.";

const UNPROVABLE_CONFIG_MESSAGE =
  "The toolchain configuration must default-export an object literal directly or pass one directly to defineConfig statically imported from vite-plus.";

const SEVERITY_MESSAGE =
  "The severity of dont-review-it/no-reassign--use-spread-or-iife must be statically provable as error, deny, 2, or a statically imported LINT_SEVERITY.ERROR, optionally as the first array element.";

const WARNING_SEVERITY_MESSAGE =
  "The severity of dont-review-it/no-reassign--use-spread-or-iife must fail the lint run. Raise warn or 1 to error, deny, 2, or a statically imported LINT_SEVERITY.ERROR, optionally as the first array element.";

const OWNED_RULE_REDECLARATION_MESSAGE =
  "dont-review-it/no-reassign--use-spread-or-iife is owned by dontReviewItPreset and must not be redeclared with caller severity or options. Delete the declaration and use the preset setting.";

describe("inspectPresetAdoptionConfig", () => {
  describe("direct adoption written through each supported import and export shape", () => {
    const it = test.extend("inspections", () =>
      [
        `import {
  dontReviewItPreset as adopted,
} from "@mst/dont-review-it";
import { defineConfig as configure } from "vite-plus";
export default configure({ lint: adopted.lint({ rules: {} }) });`,
        `import * as dontReviewIt from "@mst/dont-review-it";
import * as vitePlus from "vite-plus";
export default vitePlus.defineConfig({
  lint: dontReviewIt.dontReviewItPreset.lint({}),
});`,
        `import { dontReviewItPreset } from "@mst/dont-review-it";
export default ({ lint: (dontReviewItPreset.lint(({}))) });`,
      ].map((source) =>
        inspectPresetAdoptionConfig({ source, config: defaultPresetAdoptionConfig }),
      ));

    it("accepts every direct adoption without a problem", ({ inspections }) => {
      expect(inspections).toStrictEqual([EMPTY_INSPECTION, EMPTY_INSPECTION, EMPTY_INSPECTION]);
    });
  });

  describe("preset references that are not direct value imports from the preset module", () => {
    const it = test.extend("inspections", () =>
      [
        `import type { dontReviewItPreset } from "@mst/dont-review-it";
export default { lint: dontReviewItPreset.lint({}) };`,
        `import { type dontReviewItPreset } from "@mst/dont-review-it";
export default { lint: dontReviewItPreset.lint({}) };`,
        `import { dontReviewItPreset } from "another-preset";
export default { lint: dontReviewItPreset.lint({}) };`,
        `const { dontReviewItPreset } = await import("@mst/dont-review-it");
export default { lint: dontReviewItPreset.lint({}) };`,
        `import { dontReviewItPreset } from "@mst/dont-review-it";
const relayed = dontReviewItPreset;
export default { lint: relayed.lint({}) };`,
        `import * as preset from "@mst/dont-review-it";
export default { lint: preset["dontReviewItPreset"].lint({}) };`,
      ].map((source) =>
        inspectPresetAdoptionConfig({ source, config: defaultPresetAdoptionConfig }),
      ));

    it("rejects each indirect reference at the lint value", ({ inspections }) => {
      expect(inspections).toStrictEqual([
        {
          disabledDeclarations: [],
          problems: [{ file: "vite.config.ts", line: 2, message: DIRECT_ADOPTION_MESSAGE }],
        },
        {
          disabledDeclarations: [],
          problems: [{ file: "vite.config.ts", line: 2, message: DIRECT_ADOPTION_MESSAGE }],
        },
        {
          disabledDeclarations: [],
          problems: [{ file: "vite.config.ts", line: 2, message: DIRECT_ADOPTION_MESSAGE }],
        },
        {
          disabledDeclarations: [],
          problems: [{ file: "vite.config.ts", line: 2, message: DIRECT_ADOPTION_MESSAGE }],
        },
        {
          disabledDeclarations: [],
          problems: [{ file: "vite.config.ts", line: 3, message: DIRECT_ADOPTION_MESSAGE }],
        },
        {
          disabledDeclarations: [],
          problems: [{ file: "vite.config.ts", line: 2, message: DIRECT_ADOPTION_MESSAGE }],
        },
      ]);
    });
  });

  describe("lint values that are not one direct preset call with one object argument", () => {
    const it = test.extend("inspections", () =>
      [
        `import { dontReviewItPreset } from "@mst/dont-review-it";
export default { lint: dontReviewItPreset.lint(...sharedLint) };`,
        `import { dontReviewItPreset } from "@mst/dont-review-it";
export default { lint: { rules: {} } };`,
        `import { dontReviewItPreset } from "@mst/dont-review-it";
export default { lint: dontReviewItPreset["lint"]({}) };`,
        `import { dontReviewItPreset } from "@mst/dont-review-it";
export default { lint: dontReviewItPreset.lint() };`,
        `import { dontReviewItPreset } from "@mst/dont-review-it";
export default { lint: dontReviewItPreset.lint(sharedLint) };`,
        `import { dontReviewItPreset } from "@mst/dont-review-it";
export default { lint: dontReviewItPreset.lint({}, {}) };`,
        `import { dontReviewItPreset } from "@mst/dont-review-it";
export default { lint: getPreset().lint({}) };`,
        `import { dontReviewItPreset } from "@mst/dont-review-it";
export default { lint: sharedLint };`,
        `import { dontReviewItPreset } from "@mst/dont-review-it";
const relayed = dontReviewItPreset.lint;
export default { lint: relayed({}) };`,
      ].map((source) =>
        inspectPresetAdoptionConfig({ source, config: defaultPresetAdoptionConfig }),
      ));

    it("rejects every value without following dynamic references", ({ inspections }) => {
      expect(inspections).toStrictEqual([
        {
          disabledDeclarations: [],
          problems: [{ file: "vite.config.ts", line: 2, message: DIRECT_ADOPTION_MESSAGE }],
        },
        {
          disabledDeclarations: [],
          problems: [{ file: "vite.config.ts", line: 2, message: DIRECT_ADOPTION_MESSAGE }],
        },
        {
          disabledDeclarations: [],
          problems: [{ file: "vite.config.ts", line: 2, message: DIRECT_ADOPTION_MESSAGE }],
        },
        {
          disabledDeclarations: [],
          problems: [{ file: "vite.config.ts", line: 2, message: DIRECT_ADOPTION_MESSAGE }],
        },
        {
          disabledDeclarations: [],
          problems: [{ file: "vite.config.ts", line: 2, message: DIRECT_ADOPTION_MESSAGE }],
        },
        {
          disabledDeclarations: [],
          problems: [{ file: "vite.config.ts", line: 2, message: DIRECT_ADOPTION_MESSAGE }],
        },
        {
          disabledDeclarations: [],
          problems: [{ file: "vite.config.ts", line: 2, message: DIRECT_ADOPTION_MESSAGE }],
        },
        {
          disabledDeclarations: [],
          problems: [{ file: "vite.config.ts", line: 2, message: DIRECT_ADOPTION_MESSAGE }],
        },
        {
          disabledDeclarations: [],
          problems: [{ file: "vite.config.ts", line: 3, message: DIRECT_ADOPTION_MESSAGE }],
        },
      ]);
    });
  });

  describe("a root toolchain object that declares lint twice", () => {
    const it = test.extend("inspection", () =>
      inspectPresetAdoptionConfig({
        source: `import { dontReviewItPreset } from "@mst/dont-review-it";
export default {
  lint: dontReviewItPreset.lint({}),
  lint: dontReviewItPreset.lint({}),
};`,
        config: defaultPresetAdoptionConfig,
      }));

    it("rejects the second effective lint value", ({ inspection }) => {
      expect(inspection).toStrictEqual({
        disabledDeclarations: [],
        problems: [
          {
            file: "vite.config.ts",
            line: 4,
            message:
              "The root toolchain configuration must not declare lint more than once because only one effective value can be inspected.",
          },
        ],
      });
    });
  });

  describe("dynamic properties in the lint object and root toolchain object", () => {
    const it = test.extend("inspections", () =>
      [
        `import { dontReviewItPreset } from "@mst/dont-review-it";
export default { lint: dontReviewItPreset.lint({ ...sharedLint }) };`,
        `import { dontReviewItPreset } from "@mst/dont-review-it";
export default { ...sharedConfig, lint: dontReviewItPreset.lint({}) };`,
        `import { dontReviewItPreset } from "@mst/dont-review-it";
export default { lint: dontReviewItPreset.lint({ __proto__: { ignorePatterns: ["**/*"] } }) };`,
      ].map((source) =>
        inspectPresetAdoptionConfig({ source, config: defaultPresetAdoptionConfig }),
      ));

    it("reports the object whose effective properties cannot be known", ({ inspections }) => {
      expect(inspections).toStrictEqual([
        {
          disabledDeclarations: [],
          problems: [
            {
              file: "vite.config.ts",
              line: 2,
              message:
                "The root lint configuration must not contain a spread, computed property, or __proto__ setter because its effective own properties must be statically inspectable.",
            },
          ],
        },
        {
          disabledDeclarations: [],
          problems: [
            {
              file: "vite.config.ts",
              line: 2,
              message:
                "The root toolchain configuration must not contain a spread, computed property, or __proto__ setter because its effective own properties must be statically inspectable.",
            },
          ],
        },
        {
          disabledDeclarations: [],
          problems: [
            {
              file: "vite.config.ts",
              line: 2,
              message:
                "The root lint configuration must not contain a spread, computed property, or __proto__ setter because its effective own properties must be statically inspectable.",
            },
          ],
        },
      ]);
    });
  });

  describe("a root toolchain object without a lint block", () => {
    const it = test.extend("inspection", () =>
      inspectPresetAdoptionConfig({
        source: `import { dontReviewItPreset } from "@mst/dont-review-it";
export default {};`,
        config: defaultPresetAdoptionConfig,
      }));

    it("requires a direct lint adoption", ({ inspection }) => {
      expect(inspection).toStrictEqual({
        disabledDeclarations: [],
        problems: [
          {
            file: "vite.config.ts",
            line: 2,
            message:
              "The root toolchain configuration must declare a lint block that directly calls @mst/dont-review-it's statically imported dontReviewItPreset.lint function.",
          },
        ],
      });
    });
  });

  describe("duplicate rules and overrides fields on the root lint configuration", () => {
    const it = test.extend("inspections", () =>
      [
        `import { dontReviewItPreset } from "@mst/dont-review-it";
export default { lint: dontReviewItPreset.lint({ rules: [], rules: [] }) };`,
        `import { dontReviewItPreset } from "@mst/dont-review-it";
export default { lint: dontReviewItPreset.lint({ overrides: [], overrides: [] }) };`,
      ].map((source) =>
        inspectPresetAdoptionConfig({ source, config: defaultPresetAdoptionConfig }),
      ));

    it("rejects each second effective value", ({ inspections }) => {
      expect(inspections).toStrictEqual([
        {
          disabledDeclarations: [],
          problems: [
            {
              file: "vite.config.ts",
              line: 2,
              message:
                "The root lint configuration must not declare rules more than once because only one effective value can be inspected.",
            },
          ],
        },
        {
          disabledDeclarations: [],
          problems: [
            {
              file: "vite.config.ts",
              line: 2,
              message:
                "The root lint configuration must not declare overrides more than once because only one effective value can be inspected.",
            },
          ],
        },
      ]);
    });
  });

  describe("toolchain configurations whose root object cannot be proved", () => {
    const it = test.extend("inspections", () =>
      [
        `export default sharedConfig;`,
        `const defineConfig = (value) => value;
export default defineConfig({ lint: {} });`,
        `import { defineConfig } from "wrong-tool";
export default defineConfig({ lint: {} });`,
        `import { defineConfig } from "vite-plus";
export default defineConfig(sharedConfig);`,
        `import { defineConfig } from "vite-plus";
export default defineConfig();`,
        `import { defineConfig } from "vite-plus";
export default defineConfig({ lint: {} }, {});`,
        `const configured = {};`,
        `export default function configured() {}`,
        `export default class Config {}`,
        `export default interface Config {}`,
      ].map((source) =>
        inspectPresetAdoptionConfig({ source, config: defaultPresetAdoptionConfig }),
      ));

    it("rejects every configuration at the default-export boundary", ({ inspections }) => {
      expect(inspections).toStrictEqual([
        {
          disabledDeclarations: [],
          problems: [{ file: "vite.config.ts", line: 1, message: UNPROVABLE_CONFIG_MESSAGE }],
        },
        {
          disabledDeclarations: [],
          problems: [{ file: "vite.config.ts", line: 1, message: UNPROVABLE_CONFIG_MESSAGE }],
        },
        {
          disabledDeclarations: [],
          problems: [{ file: "vite.config.ts", line: 1, message: UNPROVABLE_CONFIG_MESSAGE }],
        },
        {
          disabledDeclarations: [],
          problems: [{ file: "vite.config.ts", line: 1, message: UNPROVABLE_CONFIG_MESSAGE }],
        },
        {
          disabledDeclarations: [],
          problems: [{ file: "vite.config.ts", line: 1, message: UNPROVABLE_CONFIG_MESSAGE }],
        },
        {
          disabledDeclarations: [],
          problems: [{ file: "vite.config.ts", line: 1, message: UNPROVABLE_CONFIG_MESSAGE }],
        },
        {
          disabledDeclarations: [],
          problems: [{ file: "vite.config.ts", line: 1, message: UNPROVABLE_CONFIG_MESSAGE }],
        },
        {
          disabledDeclarations: [],
          problems: [{ file: "vite.config.ts", line: 1, message: UNPROVABLE_CONFIG_MESSAGE }],
        },
        {
          disabledDeclarations: [],
          problems: [{ file: "vite.config.ts", line: 1, message: UNPROVABLE_CONFIG_MESSAGE }],
        },
        {
          disabledDeclarations: [],
          problems: [{ file: "vite.config.ts", line: 1, message: UNPROVABLE_CONFIG_MESSAGE }],
        },
      ]);
    });
  });

  describe("a malformed toolchain configuration", () => {
    const it = test.extend("inspection", () =>
      inspectPresetAdoptionConfig({
        source: `export default { lint: {`,
        config: defaultPresetAdoptionConfig,
      }));

    it("reports the parser failure before inspecting adoption", ({ inspection }) => {
      expect(inspection).toStrictEqual({
        disabledDeclarations: [],
        problems: [
          {
            file: "vite.config.ts",
            line: 1,
            message:
              "The toolchain configuration must parse before preset adoption can be inspected: Expected `}` but found `EOF`",
          },
        ],
      });
    });
  });

  describe("each spelling that disables a preset rule", () => {
    const it = test.extend("inspections", () =>
      [
        `"off"`,
        `"allow"`,
        `0`,
        `["off", {}]`,
        `["allow"]`,
        `[0, { option: true }]`,
        `LINT_SEVERITY.OFF`,
        `[LINT_SEVERITY.OFF, {}]`,
      ].map((severity) =>
        inspectPresetAdoptionConfig({
          source: `import {
  dontReviewItPreset as adopted,
} from "@mst/dont-review-it";
import { defineConfig as configure } from "vite-plus";
import { LINT_SEVERITY } from "@mst/lint-rule-authoring";

export default configure({
  lint: adopted.lint({ rules: { "dont-review-it/no-reassign--use-spread-or-iife": ${severity} } }),
});`,
          config: defaultPresetAdoptionConfig,
        }),
      ));

    it("records every spelling as the same disabled declaration", ({ inspections }) => {
      expect(inspections).toStrictEqual([
        {
          disabledDeclarations: [
            {
              ruleId: "dont-review-it/no-reassign--use-spread-or-iife",
              line: 8,
              filePatterns: [],
              excludeFilePatterns: [],
              pathReachInspectable: true,
            },
          ],
          problems: [],
        },
        {
          disabledDeclarations: [
            {
              ruleId: "dont-review-it/no-reassign--use-spread-or-iife",
              line: 8,
              filePatterns: [],
              excludeFilePatterns: [],
              pathReachInspectable: true,
            },
          ],
          problems: [],
        },
        {
          disabledDeclarations: [
            {
              ruleId: "dont-review-it/no-reassign--use-spread-or-iife",
              line: 8,
              filePatterns: [],
              excludeFilePatterns: [],
              pathReachInspectable: true,
            },
          ],
          problems: [],
        },
        {
          disabledDeclarations: [
            {
              ruleId: "dont-review-it/no-reassign--use-spread-or-iife",
              line: 8,
              filePatterns: [],
              excludeFilePatterns: [],
              pathReachInspectable: true,
            },
          ],
          problems: [],
        },
        {
          disabledDeclarations: [
            {
              ruleId: "dont-review-it/no-reassign--use-spread-or-iife",
              line: 8,
              filePatterns: [],
              excludeFilePatterns: [],
              pathReachInspectable: true,
            },
          ],
          problems: [],
        },
        {
          disabledDeclarations: [
            {
              ruleId: "dont-review-it/no-reassign--use-spread-or-iife",
              line: 8,
              filePatterns: [],
              excludeFilePatterns: [],
              pathReachInspectable: true,
            },
          ],
          problems: [],
        },
        {
          disabledDeclarations: [
            {
              ruleId: "dont-review-it/no-reassign--use-spread-or-iife",
              line: 8,
              filePatterns: [],
              excludeFilePatterns: [],
              pathReachInspectable: true,
            },
          ],
          problems: [],
        },
        {
          disabledDeclarations: [
            {
              ruleId: "dont-review-it/no-reassign--use-spread-or-iife",
              line: 8,
              filePatterns: [],
              excludeFilePatterns: [],
              pathReachInspectable: true,
            },
          ],
          problems: [],
        },
      ]);
    });
  });

  describe("each spelling that keeps a preset rule blocking", () => {
    const it = test.extend("inspections", () =>
      [
        `"error"`,
        `"deny"`,
        `2`,
        `["error", {}]`,
        `["deny", {}]`,
        `[2, {}]`,
        `LINT_SEVERITY.ERROR`,
        `[LINT_SEVERITY.ERROR, {}]`,
      ].map((severity) =>
        inspectPresetAdoptionConfig({
          source: `import {
  dontReviewItPreset as adopted,
} from "@mst/dont-review-it";
import { defineConfig as configure } from "vite-plus";
import { LINT_SEVERITY } from "@mst/lint-rule-authoring";

export default configure({
  lint: adopted.lint({ rules: { "dont-review-it/no-reassign--use-spread-or-iife": ${severity} } }),
});`,
          config: defaultPresetAdoptionConfig,
        }),
      ));

    it("rejects every caller redeclaration even when its severity is blocking", ({ inspections }) => {
      expect(inspections).toStrictEqual([
        ...Array.from({ length: 8 }, () => ({
          disabledDeclarations: [],
          problems: [
            { file: "vite.config.ts", line: 8, message: OWNED_RULE_REDECLARATION_MESSAGE },
          ],
        })),
      ]);
    });
  });

  describe("each spelling that leaves a preset rule at warning level", () => {
    const it = test.extend("inspections", () =>
      [
        `"warn"`,
        `1`,
        `["warn", {}]`,
        `[1, {}]`,
        `LINT_SEVERITY.WARN`,
        `[LINT_SEVERITY.WARN, {}]`,
      ].map((severity) =>
        inspectPresetAdoptionConfig({
          source: `import {
  dontReviewItPreset as adopted,
} from "@mst/dont-review-it";
import { defineConfig as configure } from "vite-plus";
import { LINT_SEVERITY } from "@mst/lint-rule-authoring";

export default configure({
  lint: adopted.lint({ rules: { "dont-review-it/no-reassign--use-spread-or-iife": ${severity} } }),
});`,
          config: defaultPresetAdoptionConfig,
        }),
      ));

    it("reports every warning spelling as non-blocking", ({ inspections }) => {
      expect(inspections).toStrictEqual([
        {
          disabledDeclarations: [],
          problems: [{ file: "vite.config.ts", line: 8, message: WARNING_SEVERITY_MESSAGE }],
        },
        {
          disabledDeclarations: [],
          problems: [{ file: "vite.config.ts", line: 8, message: WARNING_SEVERITY_MESSAGE }],
        },
        {
          disabledDeclarations: [],
          problems: [{ file: "vite.config.ts", line: 8, message: WARNING_SEVERITY_MESSAGE }],
        },
        {
          disabledDeclarations: [],
          problems: [{ file: "vite.config.ts", line: 8, message: WARNING_SEVERITY_MESSAGE }],
        },
        {
          disabledDeclarations: [],
          problems: [{ file: "vite.config.ts", line: 8, message: WARNING_SEVERITY_MESSAGE }],
        },
        {
          disabledDeclarations: [],
          problems: [{ file: "vite.config.ts", line: 8, message: WARNING_SEVERITY_MESSAGE }],
        },
      ]);
    });
  });

  describe("canonical severity references through supported value import shapes", () => {
    const it = test.extend("verdicts", () =>
      [
        `import { dontReviewItPreset } from "@mst/dont-review-it";
import { LINT_SEVERITY as LEVEL } from "@mst/lint-rule-authoring";
export default { lint: dontReviewItPreset.lint({ rules: {
  "dont-review-it/no-reassign--use-spread-or-iife": LEVEL.OFF,
} }) };`,
        `import { dontReviewItPreset } from "@mst/dont-review-it";
import { LINT_SEVERITY as LEVEL } from "@mst/lint-rule-authoring";
export default { lint: dontReviewItPreset.lint({ rules: {
  "dont-review-it/no-reassign--use-spread-or-iife": [LEVEL.ERROR, {}],
} }) };`,
        `import { dontReviewItPreset } from "@mst/dont-review-it";
import * as lintRuleAuthoring from "@mst/lint-rule-authoring";
export default { lint: dontReviewItPreset.lint({ rules: {
  "dont-review-it/no-reassign--use-spread-or-iife": lintRuleAuthoring.LINT_SEVERITY.OFF,
} }) };`,
        `import { dontReviewItPreset } from "@mst/dont-review-it";
import * as lintRuleAuthoring from "@mst/lint-rule-authoring";
export default { lint: dontReviewItPreset.lint({ rules: {
  "dont-review-it/no-reassign--use-spread-or-iife": [lintRuleAuthoring.LINT_SEVERITY.ERROR, {}],
} }) };`,
      ]
        .map((source) =>
          inspectPresetAdoptionConfig({ source, config: defaultPresetAdoptionConfig }),
        )
        .map((inspection) => ({
          disabledRuleIds: inspection.disabledDeclarations.map((declaration) => declaration.ruleId),
          problemMessages: inspection.problems.map((problem) => problem.message),
        })));

    it("accepts named aliases, namespaces, and their first array elements", ({ verdicts }) => {
      expect(verdicts).toStrictEqual([
        {
          disabledRuleIds: ["dont-review-it/no-reassign--use-spread-or-iife"],
          problemMessages: [],
        },
        { disabledRuleIds: [], problemMessages: [OWNED_RULE_REDECLARATION_MESSAGE] },
        {
          disabledRuleIds: ["dont-review-it/no-reassign--use-spread-or-iife"],
          problemMessages: [],
        },
        { disabledRuleIds: [], problemMessages: [OWNED_RULE_REDECLARATION_MESSAGE] },
      ]);
    });
  });

  describe("severity members without a proven canonical value import", () => {
    const sources = [
      `const fake = { ERROR: "off" };
import { dontReviewItPreset } from "@mst/dont-review-it";
export default { lint: dontReviewItPreset.lint({ rules: {
  "dont-review-it/no-reassign--use-spread-or-iife": fake.ERROR,
} }) };`,
      `const fake = { OFF: "error" };
import { dontReviewItPreset } from "@mst/dont-review-it";
export default { lint: dontReviewItPreset.lint({ rules: {
  "dont-review-it/no-reassign--use-spread-or-iife": fake.OFF,
} }) };`,
      `import { dontReviewItPreset } from "@mst/dont-review-it";
import { LINT_SEVERITY } from "another-module";
export default { lint: dontReviewItPreset.lint({ rules: {
  "dont-review-it/no-reassign--use-spread-or-iife": LINT_SEVERITY.OFF,
} }) };`,
      `import { dontReviewItPreset } from "@mst/dont-review-it";
import type { LINT_SEVERITY } from "@mst/lint-rule-authoring";
export default { lint: dontReviewItPreset.lint({ rules: {
  "dont-review-it/no-reassign--use-spread-or-iife": LINT_SEVERITY.OFF,
} }) };`,
      `import { dontReviewItPreset } from "@mst/dont-review-it";
import { type LINT_SEVERITY } from "@mst/lint-rule-authoring";
export default { lint: dontReviewItPreset.lint({ rules: {
  "dont-review-it/no-reassign--use-spread-or-iife": LINT_SEVERITY.OFF,
} }) };`,
      `import { dontReviewItPreset } from "@mst/dont-review-it";
const { LINT_SEVERITY } = await import("@mst/lint-rule-authoring");
export default { lint: dontReviewItPreset.lint({ rules: {
  "dont-review-it/no-reassign--use-spread-or-iife": LINT_SEVERITY.OFF,
} }) };`,
      `import { dontReviewItPreset } from "@mst/dont-review-it";
import { LINT_SEVERITY } from "@mst/lint-rule-authoring";
const relayed = LINT_SEVERITY;
export default { lint: dontReviewItPreset.lint({ rules: {
  "dont-review-it/no-reassign--use-spread-or-iife": relayed.OFF,
} }) };`,
      `import { dontReviewItPreset } from "@mst/dont-review-it";
import { LINT_SEVERITY } from "@mst/lint-rule-authoring";
export default { lint: dontReviewItPreset.lint({ rules: {
  "dont-review-it/no-reassign--use-spread-or-iife": LINT_SEVERITY["OFF"],
} }) };`,
      `import { dontReviewItPreset } from "@mst/dont-review-it";
import { LINT_SEVERITY } from "@mst/lint-rule-authoring";
export default { lint: dontReviewItPreset.lint({ rules: {
  "dont-review-it/no-reassign--use-spread-or-iife": LINT_SEVERITY.UNKNOWN,
} }) };`,
      `import { dontReviewItPreset } from "@mst/dont-review-it";
export default { lint: dontReviewItPreset.lint({ rules: {
  "dont-review-it/no-reassign--use-spread-or-iife": [...severities],
} }) };`,
    ];
    const it = test.extend("verdicts", () =>
      sources
        .map((source) =>
          inspectPresetAdoptionConfig({ source, config: defaultPresetAdoptionConfig }),
        )
        .map((inspection) => ({
          disabledDeclarations: inspection.disabledDeclarations,
          problemMessages: inspection.problems.map((problem) => problem.message),
        })));

    it("rejects fake, indirect, computed, spread, and otherwise unproven members", ({
      verdicts,
    }) => {
      expect(verdicts).toStrictEqual(
        sources.map(() => ({ disabledDeclarations: [], problemMessages: [SEVERITY_MESSAGE] })),
      );
    });
  });

  describe("a rule outside the base presets switched off", () => {
    const it = test.extend("inspection", () =>
      inspectPresetAdoptionConfig({
        source: `import { dontReviewItPreset } from "@mst/dont-review-it";
export default { lint: dontReviewItPreset.lint({
  rules: { "vite-plus/prefer-vite-plus-imports": "off" },
}) };`,
        config: defaultPresetAdoptionConfig,
      }));

    it("leaves the caller-owned rule out of preset adoption inspection", ({ inspection }) => {
      expect(inspection).toStrictEqual(EMPTY_INSPECTION);
    });
  });

  describe("uninspectable rules blocks, names, and severities", () => {
    const it = test.extend("inspections", () =>
      [
        `rules: sharedRules`,
        `rules: { ...sharedRules }`,
        `rules: { [ruleId]: "off" }`,
        `rules: { "dont-review-it/no-reassign--use-spread-or-iife": severity }`,
        `rules: { "dont-review-it/no-reassign--use-spread-or-iife": [] }`,
        `rules: { "dont-review-it/no-reassign--use-spread-or-iife": [severity] }`,
        `rules: { "dont-review-it/no-reassign--use-spread-or-iife": "invalid" }`,
      ].map((lint) =>
        inspectPresetAdoptionConfig({
          source: `import {
  dontReviewItPreset as adopted,
} from "@mst/dont-review-it";
import { defineConfig as configure } from "vite-plus";
import { LINT_SEVERITY } from "@mst/lint-rule-authoring";

export default configure({
  lint: adopted.lint({ ${lint} }),
});`,
          config: defaultPresetAdoptionConfig,
        }),
      ));

    it("fails closed at each unreadable boundary", ({ inspections }) => {
      expect(inspections).toStrictEqual([
        {
          disabledDeclarations: [],
          problems: [
            {
              file: "vite.config.ts",
              line: 8,
              message:
                "A rules block that can affect preset-owned rules must be an object literal.",
            },
          ],
        },
        {
          disabledDeclarations: [],
          problems: [
            {
              file: "vite.config.ts",
              line: 8,
              message:
                "A rules block must not contain a spread, computed rule name, or __proto__ setter because preset-owned rules must be statically inspectable.",
            },
          ],
        },
        {
          disabledDeclarations: [],
          problems: [
            {
              file: "vite.config.ts",
              line: 8,
              message:
                "A rules block must not contain a spread, computed rule name, or __proto__ setter because preset-owned rules must be statically inspectable.",
            },
          ],
        },
        {
          disabledDeclarations: [],
          problems: [{ file: "vite.config.ts", line: 8, message: SEVERITY_MESSAGE }],
        },
        {
          disabledDeclarations: [],
          problems: [{ file: "vite.config.ts", line: 8, message: SEVERITY_MESSAGE }],
        },
        {
          disabledDeclarations: [],
          problems: [{ file: "vite.config.ts", line: 8, message: SEVERITY_MESSAGE }],
        },
        {
          disabledDeclarations: [],
          problems: [{ file: "vite.config.ts", line: 8, message: SEVERITY_MESSAGE }],
        },
      ]);
    });
  });

  describe("a preset rule declared twice in one rules block", () => {
    const it = test.extend("inspection", () =>
      inspectPresetAdoptionConfig({
        source: `import {
  dontReviewItPreset as adopted,
} from "@mst/dont-review-it";
import { defineConfig as configure } from "vite-plus";

export default configure({
  lint: adopted.lint({ rules: {
    "dont-review-it/no-reassign--use-spread-or-iife": "error",
    "dont-review-it/no-reassign--use-spread-or-iife": "off",
  } }),
});`,
        config: defaultPresetAdoptionConfig,
      }));

    it("rejects the second declaration", ({ inspection }) => {
      expect(inspection).toStrictEqual({
        disabledDeclarations: [],
        problems: [
          {
            file: "vite.config.ts",
            line: 9,
            message:
              "A preset-owned rule must not be declared more than once in the same rules block.",
          },
        ],
      });
    });
  });

  describe("a disabled override with literal include and exclude paths", () => {
    const it = test.extend("inspection", () =>
      inspectPresetAdoptionConfig({
        source: `import {
  dontReviewItPreset as adopted,
} from "@mst/dont-review-it";
import { defineConfig as configure } from "vite-plus";

export default configure({
  lint: adopted.lint({ overrides: [{
    files: ["packages/**"],
    excludeFiles: ["packages/right/**"],
    rules: { "dont-review-it/no-reassign--use-spread-or-iife": ["allow", {}] },
  }] }),
});`,
        config: defaultPresetAdoptionConfig,
      }));

    it("records both sides of the override reach", ({ inspection }) => {
      expect(inspection).toStrictEqual({
        disabledDeclarations: [
          {
            ruleId: "dont-review-it/no-reassign--use-spread-or-iife",
            line: 10,
            filePatterns: ["packages/**"],
            excludeFilePatterns: ["packages/right/**"],
            pathReachInspectable: true,
          },
        ],
        problems: [],
      });
    });
  });

  describe("each dynamic or malformed disabled override shape", () => {
    const it = test.extend("inspections", () =>
      [
        `overrides: sharedOverrides`,
        `overrides: [...sharedOverrides]`,
        `overrides: [sharedOverride]`,
        `overrides: [{ ...sharedOverride }]`,
        `overrides: [{ files: sharedFiles, rules: { "dont-review-it/no-reassign--use-spread-or-iife": "off" } }]`,
        `overrides: [{ files: [pattern], rules: { "dont-review-it/no-reassign--use-spread-or-iife": "off" } }]`,
        `overrides: [{ files: [42], rules: { "dont-review-it/no-reassign--use-spread-or-iife": "off" } }]`,
        `overrides: [{ files: [pattern, "packages/**"], rules: { "dont-review-it/no-reassign--use-spread-or-iife": "off" } }]`,
        `overrides: [{ files: [,], rules: { "dont-review-it/no-reassign--use-spread-or-iife": "off" } }]`,
        `overrides: [{
  files: ["packages/**"],
  files: ["packages/other/**"],
  rules: { "dont-review-it/no-reassign--use-spread-or-iife": "off" },
}]`,
        `overrides: [{ rules: { "dont-review-it/no-reassign--use-spread-or-iife": "off" } }]`,
        `overrides: [{ files: [], excludeFiles: sharedFiles, rules: { "dont-review-it/no-reassign--use-spread-or-iife": "off" } }]`,
        `overrides: [,]`,
      ].map((lint) =>
        inspectPresetAdoptionConfig({
          source: `import {
  dontReviewItPreset as adopted,
} from "@mst/dont-review-it";
import { defineConfig as configure } from "vite-plus";
import { LINT_SEVERITY } from "@mst/lint-rule-authoring";

export default configure({
  lint: adopted.lint({ ${lint} }),
});`,
          config: defaultPresetAdoptionConfig,
        }),
      ));

    it("fails closed while preserving every known disabled declaration", ({ inspections }) => {
      expect(inspections).toStrictEqual([
        {
          disabledDeclarations: [],
          problems: [
            {
              file: "vite.config.ts",
              line: 8,
              message:
                "The root lint.overrides value must be a literal array so disabled preset rules cannot hide in dynamic configuration.",
            },
          ],
        },
        {
          disabledDeclarations: [],
          problems: [
            {
              file: "vite.config.ts",
              line: 8,
              message:
                "The root lint.overrides array must contain only object literals and must not contain spreads.",
            },
          ],
        },
        {
          disabledDeclarations: [],
          problems: [
            {
              file: "vite.config.ts",
              line: 8,
              message: "Every root lint.overrides entry must be an object literal.",
            },
          ],
        },
        {
          disabledDeclarations: [],
          problems: [
            {
              file: "vite.config.ts",
              line: 8,
              message:
                "A lint override must not contain a spread, computed property, or __proto__ setter because its effective own properties must be statically inspectable.",
            },
          ],
        },
        {
          disabledDeclarations: [
            {
              ruleId: "dont-review-it/no-reassign--use-spread-or-iife",
              line: 8,
              filePatterns: [],
              excludeFilePatterns: [],
              pathReachInspectable: false,
            },
          ],
          problems: [
            {
              file: "vite.config.ts",
              line: 8,
              message:
                "An override containing a disabled preset rule must declare files as a literal array so its reach is inspectable.",
            },
          ],
        },
        {
          disabledDeclarations: [
            {
              ruleId: "dont-review-it/no-reassign--use-spread-or-iife",
              line: 8,
              filePatterns: [],
              excludeFilePatterns: [],
              pathReachInspectable: false,
            },
          ],
          problems: [
            {
              file: "vite.config.ts",
              line: 8,
              message:
                "Every files entry on an override containing a disabled preset rule must be a string literal.",
            },
          ],
        },
        {
          disabledDeclarations: [
            {
              ruleId: "dont-review-it/no-reassign--use-spread-or-iife",
              line: 8,
              filePatterns: [],
              excludeFilePatterns: [],
              pathReachInspectable: false,
            },
          ],
          problems: [
            {
              file: "vite.config.ts",
              line: 8,
              message:
                "Every files entry on an override containing a disabled preset rule must be a string literal.",
            },
          ],
        },
        {
          disabledDeclarations: [
            {
              ruleId: "dont-review-it/no-reassign--use-spread-or-iife",
              line: 8,
              filePatterns: [],
              excludeFilePatterns: [],
              pathReachInspectable: false,
            },
          ],
          problems: [
            {
              file: "vite.config.ts",
              line: 8,
              message:
                "Every files entry on an override containing a disabled preset rule must be a string literal.",
            },
          ],
        },
        {
          disabledDeclarations: [
            {
              ruleId: "dont-review-it/no-reassign--use-spread-or-iife",
              line: 8,
              filePatterns: [],
              excludeFilePatterns: [],
              pathReachInspectable: false,
            },
          ],
          problems: [
            {
              file: "vite.config.ts",
              line: 8,
              message:
                "Every files entry on an override containing a disabled preset rule must be a string literal.",
            },
          ],
        },
        {
          disabledDeclarations: [
            {
              ruleId: "dont-review-it/no-reassign--use-spread-or-iife",
              line: 11,
              filePatterns: [],
              excludeFilePatterns: [],
              pathReachInspectable: false,
            },
          ],
          problems: [
            {
              file: "vite.config.ts",
              line: 10,
              message:
                "An override containing a disabled preset rule must not declare files more than once because only one effective value can be inspected.",
            },
          ],
        },
        {
          disabledDeclarations: [
            {
              ruleId: "dont-review-it/no-reassign--use-spread-or-iife",
              line: 8,
              filePatterns: [],
              excludeFilePatterns: [],
              pathReachInspectable: false,
            },
          ],
          problems: [
            {
              file: "vite.config.ts",
              line: 8,
              message:
                "An override containing a disabled preset rule must declare files as a literal array so its reach is inspectable.",
            },
          ],
        },
        {
          disabledDeclarations: [
            {
              ruleId: "dont-review-it/no-reassign--use-spread-or-iife",
              line: 8,
              filePatterns: [],
              excludeFilePatterns: [],
              pathReachInspectable: false,
            },
          ],
          problems: [
            {
              file: "vite.config.ts",
              line: 8,
              message:
                "An override containing a disabled preset rule must declare excludeFiles as a literal array so its reach is inspectable.",
            },
          ],
        },
        {
          disabledDeclarations: [],
          problems: [
            {
              file: "vite.config.ts",
              line: 8,
              message:
                "The root lint.overrides array must contain only object literals and must not contain spreads.",
            },
          ],
        },
      ]);
    });
  });

  describe("a known disabled declaration whose override path cannot be inspected", () => {
    const it = test.extend("inspection", () =>
      inspectPresetAdoptionConfig({
        source: `import {
  dontReviewItPreset as adopted,
} from "@mst/dont-review-it";
import { defineConfig as configure } from "vite-plus";

export default configure({
  lint: adopted.lint({ overrides: [{
    files: sharedFiles,
    rules: { "dont-review-it/no-reassign--use-spread-or-iife": "off" },
  }] }),
});`,
        config: defaultPresetAdoptionConfig,
      }));

    it("keeps the declaration and marks its path reach uninspectable", ({ inspection }) => {
      expect(inspection).toStrictEqual({
        disabledDeclarations: [
          {
            ruleId: "dont-review-it/no-reassign--use-spread-or-iife",
            line: 9,
            filePatterns: [],
            excludeFilePatterns: [],
            pathReachInspectable: false,
          },
        ],
        problems: [
          {
            file: "vite.config.ts",
            line: 8,
            message:
              "An override containing a disabled preset rule must declare files as a literal array so its reach is inspectable.",
          },
        ],
      });
    });
  });

  describe("a static override without a rules field", () => {
    const it = test.extend("inspection", () =>
      inspectPresetAdoptionConfig({
        source: `import { dontReviewItPreset } from "@mst/dont-review-it";
export default {
  lint: dontReviewItPreset.lint({ overrides: [{ files: ["packages/**"] }] }),
};`,
        config: defaultPresetAdoptionConfig,
      }));

    it("leaves the override out of disabled-rule inspection", ({ inspection }) => {
      expect(inspection).toStrictEqual(EMPTY_INSPECTION);
    });
  });

  describe("caller-owned extends on the preset argument", () => {
    const it = test.extend("inspection", () =>
      inspectPresetAdoptionConfig({
        source: `import { dontReviewItPreset } from "@mst/dont-review-it";
export default {
  lint: dontReviewItPreset.lint({ extends: [{ overrides: [{
    files: ["**"],
    rules: { "dont-review-it/no-reassign--use-spread-or-iife": "off" },
  }] }] }),
};`,
        config: defaultPresetAdoptionConfig,
      }));

    it("rejects the property before an opaque override can weaken a preset rule", ({
      inspection,
    }) => {
      expect(inspection).toStrictEqual({
        disabledDeclarations: [],
        problems: [
          {
            file: "vite.config.ts",
            line: 3,
            message:
              "The root lint configuration must not declare extends; pass additions directly so preset rules cannot be weakened by an opaque extended override.",
          },
        ],
      });
    });
  });

  describe("literal caller ignore patterns", () => {
    const it = test.extend("inspection", () =>
      inspectPresetAdoptionConfig({
        source: `import { dontReviewItPreset } from "@mst/dont-review-it";
export default {
  lint: dontReviewItPreset.lint({ ignorePatterns: ["docs/**", "!docs/examples/**"] }),
};`,
        config: defaultPresetAdoptionConfig,
      }));

    it("carries the patterns for repository reach inspection", ({ inspection }) => {
      expect(inspection).toStrictEqual({
        disabledDeclarations: [],
        ignorePatterns: { line: 3, patterns: ["docs/**", "!docs/examples/**"] },
        problems: [],
      });
    });
  });

  describe("dynamic caller ignore patterns", () => {
    const it = test.extend("inspections", () =>
      [
        "ignorePatterns: sharedPatterns",
        'ignorePatterns: ["docs/**", ...morePatterns]',
        'ignorePatterns: ["docs/**", selectedPattern]',
      ].map((lintProperty) =>
        inspectPresetAdoptionConfig({
          source: `import { dontReviewItPreset } from "@mst/dont-review-it";
export default { lint: dontReviewItPreset.lint({ ${lintProperty} }) };`,
          config: defaultPresetAdoptionConfig,
        }),
      ));

    it("rejects each value whose reach cannot be proven", ({ inspections }) => {
      expect(inspections).toStrictEqual([
        {
          disabledDeclarations: [],
          problems: [
            {
              file: "vite.config.ts",
              line: 2,
              message:
                "The root lint.ignorePatterns value must be a literal array so lint reach can be proven.",
            },
          ],
        },
        {
          disabledDeclarations: [],
          problems: [
            {
              file: "vite.config.ts",
              line: 2,
              message:
                "Every root lint.ignorePatterns entry must be a string literal so lint reach can be proven.",
            },
          ],
        },
        {
          disabledDeclarations: [],
          problems: [
            {
              file: "vite.config.ts",
              line: 2,
              message:
                "Every root lint.ignorePatterns entry must be a string literal so lint reach can be proven.",
            },
          ],
        },
      ]);
    });
  });
});
