import { describe, expect, test } from "vite-plus/test";

import { noRemovalVerification } from "./no-removal-verification.ts";

describe("no-removal-verification", () => {
  describe("an aliased import in a file absence assertion", () => {
    const it = test.extend("report", () =>
      noRemovalVerification.run({
        repositoryRoot: "/repository",
        baseRevision: "base",
        headRevision: "head",
        files: [
          {
            kind: "deleted",
            beforePath: "src/legacy.ts",
            afterPath: null,
            beforeSource: "export const legacy = true;\n",
            afterSource: null,
            addedLines: [],
            firstAddedLine: null,
          },
          {
            kind: "added",
            beforePath: null,
            afterPath: "src/repository.test.ts",
            beforeSource: null,
            afterSource:
              'import { existsSync as pathExists } from "node:fs";\nimport { expect as verify, test } from "vite-plus/test";\n\ntest("legacy is gone", () => {\n  verify(pathExists("src/legacy.ts")).toBe(false);\n});\n',
            addedLines: [1, 2, 3, 4, 5, 6],
            firstAddedLine: 1,
          },
        ],
      }));

    it("resolves the aliases", ({ report }) => {
      expect(report).toStrictEqual([
        {
          file: "src/repository.test.ts",
          line: 5,
          message:
            'Do not assert that deleted file "src/legacy.ts" remains absent; remove the assertion.',
        },
      ]);
    });
  });

  describe("new assertions that removed named exports are absent", () => {
    const it = test.extend("report", () =>
      noRemovalVerification.run({
        repositoryRoot: "/repository",
        baseRevision: "base",
        headRevision: "head",
        files: [
          {
            kind: "changed",
            beforePath: "src/legacy.ts",
            afterPath: "src/legacy.ts",
            beforeSource:
              "export const current = true;\nexport const legacyMode = true;\nexport const secondLegacyMode = true;\n",
            afterSource: "export const current = true;\n",
            addedLines: [],
            firstAddedLine: null,
          },
          {
            kind: "added",
            beforePath: null,
            afterPath: "src/legacy-api.test.ts",
            beforeSource: null,
            afterSource:
              'import * as legacy from "./legacy.ts";\nimport { expect, test } from "vite-plus/test";\n\ntest("legacy modes are gone", () => {\n  expect(legacy).not.toHaveProperty("secondLegacyMode");\n  expect(legacy).not.toHaveProperty("legacyMode");\n});\n',
            addedLines: [1, 2, 3, 4, 5, 6, 7],
            firstAddedLine: 1,
          },
        ],
      }));

    it("reports every removed export", ({ report }) => {
      expect(report).toStrictEqual([
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
  });

  describe("a new assertion for a removed named re-export", () => {
    const it = test.extend("report", () =>
      noRemovalVerification.run({
        repositoryRoot: "/repository",
        baseRevision: "base",
        headRevision: "head",
        files: [
          {
            kind: "changed",
            beforePath: "src/public.ts",
            afterPath: "src/public.ts",
            beforeSource: 'export { current, legacyMode } from "./implementation.ts";\n',
            afterSource: 'export { current } from "./implementation.ts";\n',
            addedLines: [1],
            firstAddedLine: 1,
          },
          {
            kind: "added",
            beforePath: null,
            afterPath: "src/public-api.test.ts",
            beforeSource: null,
            afterSource:
              'import * as publicApi from "./public.ts";\nimport { expect, test } from "vite-plus/test";\n\ntest("legacy mode is gone", () => {\n  expect(publicApi).not.toHaveProperty("legacyMode");\n});\n',
            addedLines: [1, 2, 3, 4, 5, 6],
            firstAddedLine: 1,
          },
        ],
      }));

    it("reports the re-exporting module", ({ report }) => {
      expect(report).toStrictEqual([
        {
          file: "src/public-api.test.ts",
          line: 5,
          message:
            'Do not assert that removed export "legacyMode" from "src/public.ts" remains absent; remove the assertion.',
        },
      ]);
    });
  });

  describe("a new undefined assertion for a removed named export", () => {
    const it = test.extend("report", () =>
      noRemovalVerification.run({
        repositoryRoot: "/repository",
        baseRevision: "base",
        headRevision: "head",
        files: [
          {
            kind: "changed",
            beforePath: "src/legacy.ts",
            afterPath: "src/legacy.ts",
            beforeSource: "export const current = true;\nexport const legacyMode = true;\n",
            afterSource: "export const current = true;\n",
            addedLines: [],
            firstAddedLine: null,
          },
          {
            kind: "added",
            beforePath: null,
            afterPath: "src/legacy-api.test.ts",
            beforeSource: null,
            afterSource:
              'import * as legacy from "./legacy.ts";\nimport { expect, test } from "vite-plus/test";\n\ntest("legacy mode is gone", () => {\n  expect(legacy.legacyMode).toBeUndefined();\n});\n',
            addedLines: [1, 2, 3, 4, 5, 6],
            firstAddedLine: 1,
          },
        ],
      }));

    it("reports the removed export", ({ report }) => {
      expect(report).toStrictEqual([
        {
          file: "src/legacy-api.test.ts",
          line: 5,
          message:
            'Do not assert that removed export "legacyMode" from "src/legacy.ts" remains absent; remove the assertion.',
        },
      ]);
    });
  });

  describe("an additional assertion beside an existing locator", () => {
    const it = test.extend("report", () => {
      const imports =
        'import * as legacy from "./legacy.ts";\nimport { expect, test } from "vite-plus/test";\n';
      const existingGuard =
        'test.skip("legacy mode is absent", () => {\n  expect(legacy).not.toHaveProperty("legacyMode");\n});\n';
      return noRemovalVerification.run({
        repositoryRoot: "/repository",
        baseRevision: "base",
        headRevision: "head",
        files: [
          {
            kind: "changed",
            beforePath: "src/legacy.ts",
            afterPath: "src/legacy.ts",
            beforeSource: "export const current = true;\nexport const legacyMode = true;\n",
            afterSource: "export const current = true;\n",
            addedLines: [],
            firstAddedLine: null,
          },
          {
            kind: "changed",
            beforePath: "src/legacy-api.test.ts",
            afterPath: "src/legacy-api.test.ts",
            beforeSource: `${imports}\n${existingGuard}`,
            afterSource: `${imports}\ntest("legacy mode is gone", () => {\n  expect(legacy).not.toHaveProperty("legacyMode");\n});\n\n${existingGuard}`,
            addedLines: [4, 5, 6, 7],
            firstAddedLine: 4,
          },
        ],
      });
    });

    it("reports the additional assertion", ({ report }) => {
      expect(report).toStrictEqual([
        {
          file: "src/legacy-api.test.ts",
          line: 5,
          message:
            'Do not assert that removed export "legacyMode" from "src/legacy.ts" remains absent; remove the assertion.',
        },
      ]);
    });
  });

  describe("an assertion whose import changes to the removed export module", () => {
    const it = test.extend("report", () => {
      return noRemovalVerification.run({
        repositoryRoot: "/repository",
        baseRevision: "base",
        headRevision: "head",
        files: [
          {
            kind: "changed",
            beforePath: "src/legacy.ts",
            afterPath: "src/legacy.ts",
            beforeSource: "export const current = true;\nexport const legacyMode = true;\n",
            afterSource: "export const current = true;\n",
            addedLines: [],
            firstAddedLine: null,
          },
          {
            kind: "changed",
            beforePath: "src/legacy-api.test.ts",
            afterPath: "src/legacy-api.test.ts",
            beforeSource:
              'import * as legacy from "./other.ts";\nimport { expect, test } from "vite-plus/test";\n\ntest("legacy mode is absent", () => {\n  expect(legacy).not.toHaveProperty("legacyMode");\n});\n',
            afterSource:
              'import * as legacy from "./legacy.ts";\nimport { expect, test } from "vite-plus/test";\n\ntest("legacy mode is absent", () => {\n  expect(legacy).not.toHaveProperty("legacyMode");\n});\n',
            addedLines: [1],
            firstAddedLine: 1,
          },
        ],
      });
    });

    it("reports the assertion", ({ report }) => {
      expect(report).toStrictEqual([
        {
          file: "src/legacy-api.test.ts",
          line: 5,
          message:
            'Do not assert that removed export "legacyMode" from "src/legacy.ts" remains absent; remove the assertion.',
        },
      ]);
    });
  });

  describe("a deletion without a new absence check", () => {
    const it = test.extend("report", () =>
      noRemovalVerification.run({
        repositoryRoot: "/repository",
        baseRevision: "base",
        headRevision: "head",
        files: [
          {
            kind: "deleted",
            beforePath: "src/legacy.ts",
            afterPath: null,
            beforeSource: "export const legacy = true;\n",
            afterSource: null,
            addedLines: [],
            firstAddedLine: null,
          },
          {
            kind: "added",
            beforePath: null,
            afterPath: "src/current.ts",
            beforeSource: null,
            afterSource: "export const current = true;\n",
            addedLines: [1],
            firstAddedLine: 1,
          },
        ],
      }));

    it("does not report it", ({ report }) => {
      expect(report).toStrictEqual([]);
    });
  });

  describe("an absence check without a matching deletion", () => {
    const it = test.extend("report", () =>
      noRemovalVerification.run({
        repositoryRoot: "/repository",
        baseRevision: "base",
        headRevision: "head",
        files: [
          {
            kind: "added",
            beforePath: null,
            afterPath: "src/repository.test.ts",
            beforeSource: null,
            afterSource:
              'import { existsSync } from "node:fs";\nimport { expect, test } from "vite-plus/test";\n\ntest("legacy is gone", () => {\n  expect(existsSync("src/legacy.ts")).toBe(false);\n});\n',
            addedLines: [1, 2, 3, 4, 5, 6],
            firstAddedLine: 1,
          },
        ],
      }));

    it("does not report it", ({ report }) => {
      expect(report).toStrictEqual([]);
    });
  });

  describe("a positive existence assertion for a deleted file", () => {
    const it = test.extend("report", () =>
      noRemovalVerification.run({
        repositoryRoot: "/repository",
        baseRevision: "base",
        headRevision: "head",
        files: [
          {
            kind: "deleted",
            beforePath: "src/legacy.ts",
            afterPath: null,
            beforeSource: "export const legacy = true;\n",
            afterSource: null,
            addedLines: [],
            firstAddedLine: null,
          },
          {
            kind: "added",
            beforePath: null,
            afterPath: "src/repository.test.ts",
            beforeSource: null,
            afterSource:
              'import { existsSync } from "node:fs";\nimport { expect, test } from "vite-plus/test";\n\ntest("legacy exists", () => {\n  expect(existsSync("src/legacy.ts")).toBe(true);\n});\n',
            addedLines: [1, 2, 3, 4, 5, 6],
            firstAddedLine: 1,
          },
        ],
      }));

    it("does not report it", ({ report }) => {
      expect(report).toStrictEqual([]);
    });
  });

  describe("an existing absence assertion", () => {
    const it = test.extend("report", () =>
      noRemovalVerification.run({
        repositoryRoot: "/repository",
        baseRevision: "base",
        headRevision: "head",
        files: [
          {
            kind: "changed",
            beforePath: "src/legacy.ts",
            afterPath: "src/legacy.ts",
            beforeSource: "export const current = true;\nexport const legacyMode = true;\n",
            afterSource: "export const current = true;\n",
            addedLines: [],
            firstAddedLine: null,
          },
        ],
      }));

    it("does not report it", ({ report }) => {
      expect(report).toStrictEqual([]);
    });
  });

  describe("the same export name imported from another module", () => {
    const it = test.extend("report", () =>
      noRemovalVerification.run({
        repositoryRoot: "/repository",
        baseRevision: "base",
        headRevision: "head",
        files: [
          {
            kind: "changed",
            beforePath: "src/removed-from.ts",
            afterPath: "src/removed-from.ts",
            beforeSource: "export const current = true;\nexport const legacyMode = true;\n",
            afterSource: "export const current = true;\n",
            addedLines: [],
            firstAddedLine: null,
          },
          {
            kind: "added",
            beforePath: null,
            afterPath: "src/other-api.test.ts",
            beforeSource: null,
            afterSource:
              'import * as other from "./other.ts";\nimport { expect, test } from "vite-plus/test";\n\ntest("other module", () => {\n  expect(other).not.toHaveProperty("legacyMode");\n});\n',
            addedLines: [1, 2, 3, 4, 5, 6],
            firstAddedLine: 1,
          },
        ],
      }));

    it("does not correlate it", ({ report }) => {
      expect(report).toStrictEqual([]);
    });
  });

  describe("module paths and export names containing locator separators", () => {
    const it = test.extend("report", () =>
      noRemovalVerification.run({
        repositoryRoot: "/repository",
        baseRevision: "base",
        headRevision: "head",
        files: [
          {
            kind: "changed",
            beforePath: "src/a.ts",
            afterPath: "src/a.ts",
            beforeSource: 'const value = true;\nexport { value as "x.ts#foo" };\n',
            afterSource: "export const current = true;\n",
            addedLines: [1],
            firstAddedLine: 1,
          },
          {
            kind: "added",
            beforePath: null,
            afterPath: "src/collision.test.ts",
            beforeSource: null,
            afterSource:
              'import * as other from "./a.ts#x.ts";\nimport { expect, test } from "vite-plus/test";\n\ntest("other module", () => {\n  expect(other).not.toHaveProperty("foo");\n});\n',
            addedLines: [1, 2, 3, 4, 5, 6],
            firstAddedLine: 1,
          },
        ],
      }));

    it("does not collide them", ({ report }) => {
      expect(report).toStrictEqual([]);
    });
  });

  describe("default and type exports removed from a module", () => {
    const it = test.extend("report", () =>
      noRemovalVerification.run({
        repositoryRoot: "/repository",
        baseRevision: "base",
        headRevision: "head",
        files: [
          {
            kind: "changed",
            beforePath: "src/legacy.ts",
            afterPath: "src/legacy.ts",
            beforeSource:
              "export const current = true;\nexport type Legacy = string;\nexport default true;\n",
            afterSource: "export const current = true;\n",
            addedLines: [],
            firstAddedLine: null,
          },
          {
            kind: "added",
            beforePath: null,
            afterPath: "src/legacy-api.test.ts",
            beforeSource: null,
            afterSource:
              'import * as legacy from "./legacy.ts";\nimport { expect, test } from "vite-plus/test";\n\ntest("non-value exports", () => {\n  expect(legacy).not.toHaveProperty("Legacy");\n  expect(legacy).not.toHaveProperty("default");\n});\n',
            addedLines: [1, 2, 3, 4, 5, 6, 7],
            firstAddedLine: 1,
          },
        ],
      }));

    it("does not treat them as removed value exports", ({ report }) => {
      expect(report).toStrictEqual([]);
    });
  });

  describe("default aliases and default re-exports removed from modules", () => {
    const it = test.extend("report", () =>
      noRemovalVerification.run({
        repositoryRoot: "/repository",
        baseRevision: "base",
        headRevision: "head",
        files: [
          {
            kind: "changed",
            beforePath: "src/alias.ts",
            afterPath: "src/alias.ts",
            beforeSource: 'const value = true;\nexport { value as "default" };\n',
            afterSource: "export const current = true;\n",
            addedLines: [1],
            firstAddedLine: 1,
          },
          {
            kind: "changed",
            beforePath: "src/re-export.ts",
            afterPath: "src/re-export.ts",
            beforeSource: 'export { value as default } from "./implementation.ts";\n',
            afterSource: "export const current = true;\n",
            addedLines: [1],
            firstAddedLine: 1,
          },
          {
            kind: "added",
            beforePath: null,
            afterPath: "src/default-api.test.ts",
            beforeSource: null,
            afterSource:
              'import * as alias from "./alias.ts";\nimport * as reExport from "./re-export.ts";\nimport { expect, test } from "vite-plus/test";\n\ntest("default exports", () => {\n  expect(alias).not.toHaveProperty("default");\n  expect(reExport).not.toHaveProperty("default");\n});\n',
            addedLines: [1, 2, 3, 4, 5, 6, 7, 8],
            firstAddedLine: 1,
          },
        ],
      }));

    it("does not treat them as removed named exports", ({ report }) => {
      expect(report).toStrictEqual([]);
    });
  });

  describe("a renamed file", () => {
    const it = test.extend("report", () =>
      noRemovalVerification.run({
        repositoryRoot: "/repository",
        baseRevision: "base",
        headRevision: "head",
        files: [
          {
            kind: "renamed",
            beforePath: "src/legacy.ts",
            afterPath: "src/current.ts",
            beforeSource: "export const legacy = true;\n",
            afterSource: "export const legacy = true;\n",
            addedLines: [],
            firstAddedLine: null,
          },
          {
            kind: "added",
            beforePath: null,
            afterPath: "src/repository.test.ts",
            beforeSource: null,
            afterSource:
              'import { existsSync } from "node:fs";\nimport { expect, test } from "vite-plus/test";\n\ntest("legacy path is gone", () => {\n  expect(existsSync("src/legacy.ts")).toBe(false);\n});\n',
            addedLines: [1, 2, 3, 4, 5, 6],
            firstAddedLine: 1,
          },
        ],
      }));

    it("does not report it as deleted", ({ report }) => {
      expect(report).toStrictEqual([]);
    });
  });

  describe("a computed property assertion for a removed export", () => {
    const it = test.extend("report", () =>
      noRemovalVerification.run({
        repositoryRoot: "/repository",
        baseRevision: "base",
        headRevision: "head",
        files: [
          {
            kind: "changed",
            beforePath: "src/legacy.ts",
            afterPath: "src/legacy.ts",
            beforeSource: "export const current = true;\nexport const legacyMode = true;\n",
            afterSource: "export const current = true;\n",
            addedLines: [],
            firstAddedLine: null,
          },
          {
            kind: "added",
            beforePath: null,
            afterPath: "src/legacy-api.test.ts",
            beforeSource: null,
            afterSource:
              'import * as legacy from "./legacy.ts";\nimport { expect, test } from "vite-plus/test";\n\ntest("legacy mode is gone", () => {\n  expect(legacy["legacyMode"]).toBeUndefined();\n});\n',
            addedLines: [1, 2, 3, 4, 5, 6],
            firstAddedLine: 1,
          },
        ],
      }));

    it("does not report it", ({ report }) => {
      expect(report).toStrictEqual([]);
    });
  });
});
