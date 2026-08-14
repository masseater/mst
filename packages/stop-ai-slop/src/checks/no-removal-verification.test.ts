import { describe, expect, it } from "vite-plus/test";

import { noRemovalVerification } from "./no-removal-verification.ts";

import type { ComparisonFile } from "../repository-comparison.ts";

type AddedComparisonFile = Extract<ComparisonFile, { kind: "added" }>;
type ChangedComparisonFile = Extract<ComparisonFile, { kind: "changed" }>;
type DeletedComparisonFile = Extract<ComparisonFile, { kind: "deleted" }>;
type RenamedComparisonFile = Extract<ComparisonFile, { kind: "renamed" }>;

const addedFile = ({
  path,
  source,
  addedLines,
}: Readonly<{
  path: string;
  source: string;
  addedLines: readonly number[];
}>): AddedComparisonFile => ({
  kind: "added",
  beforePath: null,
  afterPath: path,
  beforeSource: null,
  afterSource: source,
  addedLines,
  firstAddedLine: addedLines[0] ?? null,
});

const changedFile = ({
  path,
  beforeSource,
  afterSource,
  addedLines = [],
}: Readonly<{
  path: string;
  beforeSource: string;
  afterSource: string;
  addedLines?: readonly number[];
}>): ChangedComparisonFile => ({
  kind: "changed",
  beforePath: path,
  afterPath: path,
  beforeSource,
  afterSource,
  addedLines,
  firstAddedLine: addedLines[0] ?? null,
});

const deletedFile = (path: string, source: string): DeletedComparisonFile => ({
  kind: "deleted",
  beforePath: path,
  afterPath: null,
  beforeSource: source,
  afterSource: null,
  addedLines: [],
  firstAddedLine: null,
});

const renamedFile = ({
  beforePath,
  afterPath,
  source,
}: Readonly<{
  beforePath: string;
  afterPath: string;
  source: string;
}>): RenamedComparisonFile => ({
  kind: "renamed",
  beforePath,
  afterPath,
  beforeSource: source,
  afterSource: source,
  addedLines: [],
  firstAddedLine: null,
});

const checkComparison = (files: readonly ComparisonFile[]) =>
  noRemovalVerification.run({
    repositoryRoot: "/repository",
    baseRevision: "base",
    headRevision: "head",
    files,
  });

describe("no-removal-verification", () => {
  it("resolves aliased imports in a file absence assertion", () => {
    const aliasReport = checkComparison([
      deletedFile("src/legacy.ts", "export const legacy = true;\n"),
      addedFile({
        path: "src/repository.test.ts",
        source:
          'import { existsSync as pathExists } from "node:fs";\nimport { expect as verify, test } from "vite-plus/test";\n\ntest("legacy is gone", () => {\n  verify(pathExists("src/legacy.ts")).toBe(false);\n});\n',
        addedLines: [1, 2, 3, 4, 5, 6],
      }),
    ]);

    expect(aliasReport).toStrictEqual([
      {
        file: "src/repository.test.ts",
        line: 5,
        message:
          'Do not assert that deleted file "src/legacy.ts" remains absent; remove the assertion.',
      },
    ]);
  });

  it("reports a newly added assertion that a removed named export is absent", () => {
    const exportAssertionReport = checkComparison([
      changedFile({
        path: "src/legacy.ts",
        beforeSource:
          "export const current = true;\nexport const legacyMode = true;\nexport const secondLegacyMode = true;\n",
        afterSource: "export const current = true;\n",
      }),
      addedFile({
        path: "src/legacy-api.test.ts",
        source:
          'import * as legacy from "./legacy.ts";\nimport { expect, test } from "vite-plus/test";\n\ntest("legacy modes are gone", () => {\n  expect(legacy).not.toHaveProperty("secondLegacyMode");\n  expect(legacy).not.toHaveProperty("legacyMode");\n});\n',
        addedLines: [1, 2, 3, 4, 5, 6, 7],
      }),
    ]);

    expect(exportAssertionReport).toStrictEqual([
      {
        file: "src/legacy-api.test.ts",
        line: 5,
        message:
          'Do not assert that removed export "secondLegacyMode" from "src/legacy.ts" remains absent; remove the assertion.',
      },
      {
        file: "src/legacy-api.test.ts",
        line: 6,
        message:
          'Do not assert that removed export "legacyMode" from "src/legacy.ts" remains absent; remove the assertion.',
      },
    ]);
  });

  it("reports a newly added assertion for a removed named re-export", () => {
    const reExportReport = checkComparison([
      changedFile({
        path: "src/public.ts",
        beforeSource: 'export { current, legacyMode } from "./implementation.ts";\n',
        afterSource: 'export { current } from "./implementation.ts";\n',
        addedLines: [1],
      }),
      addedFile({
        path: "src/public-api.test.ts",
        source:
          'import * as publicApi from "./public.ts";\nimport { expect, test } from "vite-plus/test";\n\ntest("legacy mode is gone", () => {\n  expect(publicApi).not.toHaveProperty("legacyMode");\n});\n',
        addedLines: [1, 2, 3, 4, 5, 6],
      }),
    ]);

    expect(reExportReport).toStrictEqual([
      {
        file: "src/public-api.test.ts",
        line: 5,
        message:
          'Do not assert that removed export "legacyMode" from "src/public.ts" remains absent; remove the assertion.',
      },
    ]);
  });

  it("reports a newly added undefined assertion for a removed named export", () => {
    const exportAssertionReport = checkComparison([
      changedFile({
        path: "src/legacy.ts",
        beforeSource: "export const current = true;\nexport const legacyMode = true;\n",
        afterSource: "export const current = true;\n",
      }),
      addedFile({
        path: "src/legacy-api.test.ts",
        source:
          'import * as legacy from "./legacy.ts";\nimport { expect, test } from "vite-plus/test";\n\ntest("legacy mode is gone", () => {\n  expect(legacy.legacyMode).toBeUndefined();\n});\n',
        addedLines: [1, 2, 3, 4, 5, 6],
      }),
    ]);

    expect(exportAssertionReport).toStrictEqual([
      {
        file: "src/legacy-api.test.ts",
        line: 5,
        message:
          'Do not assert that removed export "legacyMode" from "src/legacy.ts" remains absent; remove the assertion.',
      },
    ]);
  });

  it("reports an additional assertion when the same locator already existed", () => {
    const imports =
      'import * as legacy from "./legacy.ts";\nimport { expect, test } from "vite-plus/test";\n';
    const existingGuard =
      'test.skip("legacy mode is absent", () => {\n  expect(legacy).not.toHaveProperty("legacyMode");\n});\n';
    const exportAssertionReport = checkComparison([
      changedFile({
        path: "src/legacy.ts",
        beforeSource: "export const current = true;\nexport const legacyMode = true;\n",
        afterSource: "export const current = true;\n",
      }),
      changedFile({
        path: "src/legacy-api.test.ts",
        beforeSource: `${imports}\n${existingGuard}`,
        afterSource: `${imports}\ntest("legacy mode is gone", () => {\n  expect(legacy).not.toHaveProperty("legacyMode");\n});\n\n${existingGuard}`,
        addedLines: [4, 5, 6, 7],
      }),
    ]);

    expect(exportAssertionReport).toStrictEqual([
      {
        file: "src/legacy-api.test.ts",
        line: 5,
        message:
          'Do not assert that removed export "legacyMode" from "src/legacy.ts" remains absent; remove the assertion.',
      },
    ]);
  });

  it("reports an assertion whose import changes to the removed export module", () => {
    const assertion =
      'import * as legacy from "./other.ts";\nimport { expect, test } from "vite-plus/test";\n\ntest("legacy mode is absent", () => {\n  expect(legacy).not.toHaveProperty("legacyMode");\n});\n';
    const importChangeReport = checkComparison([
      changedFile({
        path: "src/legacy.ts",
        beforeSource: "export const current = true;\nexport const legacyMode = true;\n",
        afterSource: "export const current = true;\n",
      }),
      changedFile({
        path: "src/legacy-api.test.ts",
        beforeSource: assertion,
        afterSource: assertion.replace("./other.ts", "./legacy.ts"),
        addedLines: [1],
      }),
    ]);

    expect(importChangeReport).toStrictEqual([
      {
        file: "src/legacy-api.test.ts",
        line: 5,
        message:
          'Do not assert that removed export "legacyMode" from "src/legacy.ts" remains absent; remove the assertion.',
      },
    ]);
  });

  it("does not report deletion without a new absence check", () => {
    expect(
      checkComparison([
        deletedFile("src/legacy.ts", "export const legacy = true;\n"),
        addedFile({
          path: "src/current.ts",
          source: "export const current = true;\n",
          addedLines: [1],
        }),
      ]),
    ).toStrictEqual([]);
  });

  it("does not report an absence check without a matching deletion", () => {
    expect(
      checkComparison([
        addedFile({
          path: "src/repository.test.ts",
          source:
            'import { existsSync } from "node:fs";\nimport { expect, test } from "vite-plus/test";\n\ntest("legacy is gone", () => {\n  expect(existsSync("src/legacy.ts")).toBe(false);\n});\n',
          addedLines: [1, 2, 3, 4, 5, 6],
        }),
      ]),
    ).toStrictEqual([]);
  });

  it("does not report a positive existence assertion", () => {
    expect(
      checkComparison([
        deletedFile("src/legacy.ts", "export const legacy = true;\n"),
        addedFile({
          path: "src/repository.test.ts",
          source:
            'import { existsSync } from "node:fs";\nimport { expect, test } from "vite-plus/test";\n\ntest("legacy exists", () => {\n  expect(existsSync("src/legacy.ts")).toBe(true);\n});\n',
          addedLines: [1, 2, 3, 4, 5, 6],
        }),
      ]),
    ).toStrictEqual([]);
  });

  it("does not report an existing absence assertion", () => {
    expect(
      checkComparison([
        changedFile({
          path: "src/legacy.ts",
          beforeSource: "export const current = true;\nexport const legacyMode = true;\n",
          afterSource: "export const current = true;\n",
        }),
      ]),
    ).toStrictEqual([]);
  });

  it("does not correlate the same export name from another module", () => {
    expect(
      checkComparison([
        changedFile({
          path: "src/removed-from.ts",
          beforeSource: "export const current = true;\nexport const legacyMode = true;\n",
          afterSource: "export const current = true;\n",
        }),
        addedFile({
          path: "src/other-api.test.ts",
          source:
            'import * as other from "./other.ts";\nimport { expect, test } from "vite-plus/test";\n\ntest("other module", () => {\n  expect(other).not.toHaveProperty("legacyMode");\n});\n',
          addedLines: [1, 2, 3, 4, 5, 6],
        }),
      ]),
    ).toStrictEqual([]);
  });

  it("does not collide module paths and export names containing locator separators", () => {
    expect(
      checkComparison([
        changedFile({
          path: "src/a.ts",
          beforeSource: 'const value = true;\nexport { value as "x.ts#foo" };\n',
          afterSource: "export const current = true;\n",
          addedLines: [1],
        }),
        addedFile({
          path: "src/collision.test.ts",
          source:
            'import * as other from "./a.ts#x.ts";\nimport { expect, test } from "vite-plus/test";\n\ntest("other module", () => {\n  expect(other).not.toHaveProperty("foo");\n});\n',
          addedLines: [1, 2, 3, 4, 5, 6],
        }),
      ]),
    ).toStrictEqual([]);
  });

  it("does not treat default or type exports as removed value exports", () => {
    expect(
      checkComparison([
        changedFile({
          path: "src/legacy.ts",
          beforeSource:
            "export const current = true;\nexport type Legacy = string;\nexport default true;\n",
          afterSource: "export const current = true;\n",
        }),
        addedFile({
          path: "src/legacy-api.test.ts",
          source:
            'import * as legacy from "./legacy.ts";\nimport { expect, test } from "vite-plus/test";\n\ntest("non-value exports", () => {\n  expect(legacy).not.toHaveProperty("Legacy");\n  expect(legacy).not.toHaveProperty("default");\n});\n',
          addedLines: [1, 2, 3, 4, 5, 6, 7],
        }),
      ]),
    ).toStrictEqual([]);
  });

  it("does not treat default aliases or default re-exports as removed named exports", () => {
    expect(
      checkComparison([
        changedFile({
          path: "src/alias.ts",
          beforeSource: 'const value = true;\nexport { value as "default" };\n',
          afterSource: "export const current = true;\n",
          addedLines: [1],
        }),
        changedFile({
          path: "src/re-export.ts",
          beforeSource: 'export { value as default } from "./implementation.ts";\n',
          afterSource: "export const current = true;\n",
          addedLines: [1],
        }),
        addedFile({
          path: "src/default-api.test.ts",
          source:
            'import * as alias from "./alias.ts";\nimport * as reExport from "./re-export.ts";\nimport { expect, test } from "vite-plus/test";\n\ntest("default exports", () => {\n  expect(alias).not.toHaveProperty("default");\n  expect(reExport).not.toHaveProperty("default");\n});\n',
          addedLines: [1, 2, 3, 4, 5, 6, 7, 8],
        }),
      ]),
    ).toStrictEqual([]);
  });

  it("does not report a renamed file as deleted", () => {
    const source = "export const legacy = true;\n";
    expect(
      checkComparison([
        renamedFile({
          beforePath: "src/legacy.ts",
          afterPath: "src/current.ts",
          source,
        }),
        addedFile({
          path: "src/repository.test.ts",
          source:
            'import { existsSync } from "node:fs";\nimport { expect, test } from "vite-plus/test";\n\ntest("legacy path is gone", () => {\n  expect(existsSync("src/legacy.ts")).toBe(false);\n});\n',
          addedLines: [1, 2, 3, 4, 5, 6],
        }),
      ]),
    ).toStrictEqual([]);
  });

  it("does not report a computed property assertion", () => {
    expect(
      checkComparison([
        changedFile({
          path: "src/legacy.ts",
          beforeSource: "export const current = true;\nexport const legacyMode = true;\n",
          afterSource: "export const current = true;\n",
        }),
        addedFile({
          path: "src/legacy-api.test.ts",
          source:
            'import * as legacy from "./legacy.ts";\nimport { expect, test } from "vite-plus/test";\n\ntest("legacy mode is gone", () => {\n  expect(legacy["legacyMode"]).toBeUndefined();\n});\n',
          addedLines: [1, 2, 3, 4, 5, 6],
        }),
      ]),
    ).toStrictEqual([]);
  });
});
