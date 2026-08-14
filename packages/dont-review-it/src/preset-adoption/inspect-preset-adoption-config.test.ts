import { describe, expect, test } from "vite-plus/test";

import { defaultPresetAdoptionConfig } from "./config.ts";
import { inspectPresetAdoptionConfig } from "./inspect-preset-adoption-config.ts";

const config = defaultPresetAdoptionConfig;

const inspectionOf = (source: string) => inspectPresetAdoptionConfig({ source, config });

const configHolding = (lint: string): string => `import {
  oxlint as adopted,
  withGitExcludes as wrap,
} from "@mst/dont-review-it";
import { defineConfig as configure } from "vite-plus";
import { oxlint as companion } from "another-preset";

export default configure({ lint: wrap({ extends: [companion, adopted], ${lint} }) });`;

const disabledDeclarationsIn = (source: string) => inspectionOf(source).disabledDeclarations;

describe("inspectPresetAdoptionConfig", () => {
  test("accepts a named alias imported from the preset module exactly once", () => {
    const inspection = inspectionOf(configHolding("rules: {}"));

    expect(inspection.problems).toStrictEqual([]);
  });

  test("accepts namespace references for the config factory, lint wrapper, and preset", () => {
    const inspection = inspectionOf(`import * as dontReviewIt from "@mst/dont-review-it";
import * as vitePlus from "vite-plus";
export default vitePlus.defineConfig({
  lint: dontReviewIt.withGitExcludes({ extends: [dontReviewIt.oxlint] }),
});`);

    expect(inspection.problems).toStrictEqual([]);
  });

  test("accepts a raw default-exported config and raw lint object", () => {
    const inspection = inspectionOf(`import { oxlint } from "@mst/dont-review-it";
export default ({ lint: ({ extends: [(oxlint)] }) });`);

    expect(inspection.problems).toStrictEqual([]);
  });

  test.each([
    {
      name: "type-only import",
      source: `import type { oxlint } from "@mst/dont-review-it";
export default { lint: { extends: [oxlint] } };`,
    },
    {
      name: "inline type-only import",
      source: `import { type oxlint } from "@mst/dont-review-it";
export default { lint: { extends: [oxlint] } };`,
    },
    {
      name: "same export from the wrong module",
      source: `import { oxlint } from "another-preset";
export default { lint: { extends: [oxlint] } };`,
    },
    {
      name: "dynamic import",
      source: `const { oxlint } = await import("@mst/dont-review-it");
export default { lint: { extends: [oxlint] } };`,
    },
    {
      name: "local relay",
      source: `import { oxlint } from "@mst/dont-review-it";
const relayed = oxlint;
export default { lint: { extends: [relayed] } };`,
    },
    {
      name: "computed namespace member",
      source: `import * as preset from "@mst/dont-review-it";
export default { lint: { extends: [preset["oxlint"]] } };`,
    },
  ])("rejects $name instead of treating it as direct adoption", ({ source }) => {
    expect(inspectionOf(source).problems).not.toHaveLength(0);
  });

  test("rejects a spread whose preset reference count is dynamic", () => {
    const inspection = inspectionOf(`import { oxlint } from "@mst/dont-review-it";
import { other } from "another-preset";
export default { lint: { extends: [oxlint, ...other] } };`);

    expect(inspection.problems.map((problem) => problem.message).join("\n")).toContain(
      "must not contain a spread",
    );
  });

  test.each([
    `import { oxlint } from "@mst/dont-review-it";
export default { lint: { rules: {} } };`,
    `import { oxlint } from "@mst/dont-review-it";
export default { lint: { extends: oxlint } };`,
    `import { oxlint } from "@mst/dont-review-it";
export default { lint: { extends: [oxlint], extends: [oxlint] } };`,
    `import { oxlint } from "@mst/dont-review-it";
export default { lint: { extends: [, oxlint] } };`,
    `import { oxlint } from "@mst/dont-review-it";
export default { lint: { extends: [getPreset().oxlint, oxlint] } };`,
    `import { oxlint } from "@mst/dont-review-it";
export default { lint: { extends: [local.oxlint, oxlint] } };`,
  ])("rejects another uninspectable root lint.extends shape", (source) => {
    expect(inspectionOf(source).problems).not.toHaveLength(0);
  });

  test("rejects duplicate direct preset references", () => {
    const inspection = inspectionOf(`import { oxlint } from "@mst/dont-review-it";
export default { lint: { extends: [oxlint, oxlint] } };`);

    expect(inspection.problems.map((problem) => problem.message).join("\n")).toContain("found 2");
  });

  test("reports a dynamic root lint object once", () => {
    const inspection = inspectionOf(configHolding("...sharedLint"));

    expect(inspection.problems).toHaveLength(1);
    expect(inspection.problems[0]?.message).toContain("spread or computed property");
  });

  test("reports a dynamic root toolchain object", () => {
    const inspection = inspectionOf(`import { oxlint } from "@mst/dont-review-it";
export default { ...sharedConfig, lint: { extends: [oxlint] } };`);

    expect(inspection.problems[0]?.message).toContain("spread or computed property");
  });

  test("reports the missing root lint block", () => {
    const inspection = inspectionOf(`import { oxlint } from "@mst/dont-review-it";
export default {};`);

    expect(inspection.problems[0]?.message).toContain("must declare a lint block");
  });

  test.each(["rules", "overrides"])("reports duplicate root lint %s fields", (field) => {
    const inspection = inspectionOf(configHolding(`${field}: [], ${field}: []`));

    expect(inspection.problems.map((problem) => problem.message).join("\n")).toContain(
      `must not declare ${field} more than once`,
    );
  });

  test.each([
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
  ])("rejects a toolchain config whose root object cannot be proved", (source) => {
    expect(inspectionOf(source).problems[0]?.message).toContain(
      "must default-export an object literal directly",
    );
  });

  test.each([
    `import { oxlint } from "@mst/dont-review-it";
export default { lint: sharedLint };`,
    `import { oxlint, withGitExcludes } from "@mst/dont-review-it";
export default { lint: withGitExcludes(sharedLint) };`,
    `import { oxlint } from "@mst/dont-review-it";
const withGitExcludes = (value) => value;
export default { lint: withGitExcludes({ extends: [oxlint] }) };`,
    `import { oxlint, withGitExcludes } from "@mst/dont-review-it";
export default { lint: withGitExcludes(...sharedLint) };`,
  ])("rejects a lint block whose object cannot be proved", (source) => {
    expect(inspectionOf(source).problems[0]?.message).toContain(
      "The root lint block must be an object literal",
    );
  });

  test.each([
    { severity: `"off"`, expectedLine: 8 },
    { severity: `"allow"`, expectedLine: 8 },
    { severity: `0`, expectedLine: 8 },
    { severity: `["off", {}]`, expectedLine: 8 },
    { severity: `["allow"]`, expectedLine: 8 },
    { severity: `[0, { option: true }]`, expectedLine: 8 },
  ])("finds disabled severity $severity", ({ severity, expectedLine }) => {
    const declarations = disabledDeclarationsIn(
      configHolding(`rules: { "dont-review-it/no-reassign--use-spread-or-iife": ${severity} }`),
    );

    expect(declarations).toStrictEqual([
      {
        ruleId: "dont-review-it/no-reassign--use-spread-or-iife",
        line: expectedLine,
        filePatterns: [],
        excludeFilePatterns: [],
        pathReachInspectable: true,
      },
    ]);
  });

  test.each([`"warn"`, `"error"`, `"deny"`, `1`, `2`, `["error", {}]`])(
    "does not call enabled severity %s disabled",
    (severity) => {
      expect(
        disabledDeclarationsIn(
          configHolding(`rules: { "dont-review-it/no-reassign--use-spread-or-iife": ${severity} }`),
        ),
      ).toStrictEqual([]);
    },
  );

  test("ignores a disabled rule outside the preset", () => {
    expect(
      disabledDeclarationsIn(configHolding(`rules: { "vitest/consistent-test-filename": "off" }`)),
    ).toStrictEqual([]);
  });

  test.each([
    `rules: sharedRules`,
    `rules: { ...sharedRules }`,
    `rules: { [ruleId]: "off" }`,
    `rules: { "dont-review-it/no-reassign--use-spread-or-iife": severity }`,
    `rules: { "dont-review-it/no-reassign--use-spread-or-iife": [] }`,
    `rules: { "dont-review-it/no-reassign--use-spread-or-iife": [severity] }`,
    `rules: { "dont-review-it/no-reassign--use-spread-or-iife": "invalid" }`,
  ])("reports an uninspectable rule declaration in %s", (rules) => {
    expect(inspectionOf(configHolding(rules)).problems).not.toHaveLength(0);
  });

  test("reports a duplicate preset rule declaration", () => {
    const inspection = inspectionOf(
      configHolding(`rules: {
        "dont-review-it/no-reassign--use-spread-or-iife": "error",
        "dont-review-it/no-reassign--use-spread-or-iife": "off",
      }`),
    );

    expect(inspection.problems[0]?.message).toContain("must not be declared more than once");
  });

  test("records include and exclude paths for a disabled override", () => {
    const declarations = disabledDeclarationsIn(
      configHolding(`overrides: [{
        files: ["packages/**"],
        excludeFiles: ["packages/right/**"],
        rules: { "dont-review-it/no-reassign--use-spread-or-iife": ["allow", {}] },
      }]`),
    );

    expect(declarations).toStrictEqual([
      {
        ruleId: "dont-review-it/no-reassign--use-spread-or-iife",
        line: 11,
        filePatterns: ["packages/**"],
        excludeFilePatterns: ["packages/right/**"],
        pathReachInspectable: true,
      },
    ]);
  });

  test.each([
    `overrides: sharedOverrides`,
    `overrides: [...sharedOverrides]`,
    `overrides: [sharedOverride]`,
    `overrides: [{ ...sharedOverride }]`,
    `overrides: [{ files: sharedFiles, rules: { "dont-review-it/rule": "off" } }]`,
    `overrides: [{ files: [pattern], rules: { "dont-review-it/rule": "off" } }]`,
    `overrides: [{ files: [42], rules: { "dont-review-it/rule": "off" } }]`,
    `overrides: [{ files: [pattern, "packages/**"], rules: { "dont-review-it/rule": "off" } }]`,
    `overrides: [{ files: [,], rules: { "dont-review-it/rule": "off" } }]`,
    `overrides: [{
      files: ["packages/**"],
      files: ["packages/other/**"],
      rules: { "dont-review-it/rule": "off" },
    }]`,
    `overrides: [{ rules: { "dont-review-it/rule": "off" } }]`,
    `overrides: [{ files: [], excludeFiles: sharedFiles, rules: { "dont-review-it/rule": "off" } }]`,
    `overrides: [,]`,
  ])("reports an uninspectable disabled override in %s", (overrides) => {
    expect(inspectionOf(configHolding(overrides)).problems).not.toHaveLength(0);
  });

  test("keeps a known disabled declaration when its override path cannot be inspected", () => {
    const inspection = inspectionOf(
      configHolding(`overrides: [{
        files: sharedFiles,
        rules: { "dont-review-it/no-reassign--use-spread-or-iife": "off" },
      }]`),
    );

    expect(inspection.disabledDeclarations).toHaveLength(1);
    expect(inspection.problems).not.toHaveLength(0);
  });

  test("leaves a static override with no rules out of disabled-rule inspection", () => {
    expect(
      inspectionOf(configHolding(`overrides: [{ files: ["packages/**"] }]`)).problems,
    ).toStrictEqual([]);
  });

  test("reports a malformed toolchain configuration before inspecting adoption", () => {
    const inspection = inspectionOf(`export default { lint: {`);

    expect(inspection.problems[0]?.message).toContain("must parse");
  });
});
