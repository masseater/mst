import { testLintRule } from "@mst/lint-rule-authoring";
import { describe, expect, test } from "vite-plus/test";

import { requireReExportOnlyFiles } from "./require-re-export-only-files--move-declaration-to-owning-module.ts";

const listedAsSurface = [{ targets: ["index.ts"] }];

describe("dont-review-it/require-re-export-only-files--move-declaration-to-owning-module", () => {
  testLintRule(requireReExportOnlyFiles, {
    valid: [
      {
        name: "with no listing from the deployment nothing is a re-export only file",
        code: "export const total = 1;",
        filename: "src/index.ts",
      },
      {
        name: "a file the listing does not name owns its declarations",
        code: "export const total = 1;",
        filename: "src/total.ts",
        options: listedAsSurface,
      },
      {
        name: "a name that merely ends with a listed name is not the listed file",
        code: "export const total = 1;",
        filename: "src/print-index.ts",
        options: listedAsSurface,
      },
      {
        name: "a listed pattern is matched at segment boundaries",
        code: "export const total = 1;",
        filename: "src/data-models/index.ts",
        options: [{ targets: ["models/index.ts"] }],
      },
      {
        name: "a named re-export names the module that owns the declaration",
        code: 'export { total } from "./total.ts";',
        filename: "src/index.ts",
        options: listedAsSurface,
      },
      {
        name: "a type only re-export names the module that owns the type",
        code: 'export type { Total } from "./total.ts";',
        filename: "src/index.ts",
        options: listedAsSurface,
      },
      {
        name: "a star re-export names the module it forwards",
        code: 'export * from "./total.ts";',
        filename: "src/index.ts",
        options: listedAsSurface,
      },
      {
        name: "a namespaced star re-export names the module it forwards",
        code: 'export * as total from "./total.ts";',
        filename: "src/index.ts",
        options: listedAsSurface,
      },
      {
        name: "a renamed default re-export names the module that owns the declaration",
        code: 'export { default as total } from "./total.ts";',
        filename: "src/index.ts",
        options: listedAsSurface,
      },
      {
        name: "several re-exports stand together in any order",
        code: 'export * from "./sum.ts";\nexport { total } from "./total.ts";\nexport type { Total } from "./total.ts";',
        filename: "src/index.ts",
        options: listedAsSurface,
      },
      {
        name: "a file the exclusions name is left alone even though the listing covers it",
        code: "export const total = 1;",
        filename: "src/generated/index.ts",
        options: [{ targets: ["**/index.ts"], exclude: ["generated/index.ts"] }],
      },
      {
        name: "a listing whose tail matches nothing on the path leaves the file alone",
        code: "export const total = 1;",
        filename: "src/index.ts",
        options: [{ targets: ["**/surface.ts"] }],
      },
      {
        name: "a pattern anchored to the working directory names one file and not its namesakes",
        code: "export const total = 1;",
        filename: "packages/other/src/index.ts",
        options: [{ targets: ["./packages/repository-checks/src/index.ts"] }],
      },
    ],
    invalid: [
      {
        name: "an exported declaration on a listed file is reported",
        code: 'export const total = 1;\nexport * from "./sum.ts";',
        filename: "src/index.ts",
        options: listedAsSurface,
        errors: [{ messageId: "extraStatement" }],
      },
      {
        name: "a declaration that is not exported is reported",
        code: 'const total = 1;\nexport * from "./sum.ts";',
        filename: "src/index.ts",
        options: listedAsSurface,
        errors: [{ messageId: "extraStatement" }],
      },
      {
        name: "a function declaration is reported",
        code: 'export function total() {\n  return 1;\n}\nexport * from "./sum.ts";',
        filename: "src/index.ts",
        options: listedAsSurface,
        errors: [{ messageId: "extraStatement" }],
      },
      {
        name: "a type alias is reported",
        code: 'export type Total = number;\nexport * from "./sum.ts";',
        filename: "src/index.ts",
        options: listedAsSurface,
        errors: [{ messageId: "extraStatement" }],
      },
      {
        name: "a default export is reported",
        code: 'export default { total: 1 };\nexport * from "./sum.ts";',
        filename: "src/index.ts",
        options: listedAsSurface,
        errors: [{ messageId: "extraStatement" }],
      },
      {
        name: "a statement that runs on import is reported",
        code: 'registerAll();\nexport * from "./sum.ts";',
        filename: "src/index.ts",
        options: listedAsSurface,
        errors: [{ messageId: "extraStatement" }],
      },
      {
        name: "a directive prologue is reported",
        code: '"use client";\nexport * from "./total.ts";',
        filename: "src/index.ts",
        options: listedAsSurface,
        errors: [{ messageId: "extraStatement" }],
      },
      {
        name: "a side effect import is reported",
        code: 'import "./register-all.ts";\nexport * from "./sum.ts";',
        filename: "src/index.ts",
        options: listedAsSurface,
        errors: [{ messageId: "extraStatement" }],
      },
      {
        name: "an import paired with a source-less export is reported on both statements",
        code: 'import { total } from "./total.ts";\nexport { total };\nexport * from "./sum.ts";',
        filename: "src/index.ts",
        options: listedAsSurface,
        errors: [{ messageId: "extraStatement" }, { messageId: "extraStatement" }],
      },
      {
        name: "only the statement that is not a re-export is reported",
        code: 'export { total } from "./total.ts";\nexport const sum = 2;\nexport * from "./count.ts";',
        filename: "src/index.ts",
        options: listedAsSurface,
        errors: [{ messageId: "extraStatement" }],
      },
      {
        name: "a file holding only declarations is reported for the declaration and for having no surface",
        code: "export const total = 1;",
        filename: "src/index.ts",
        options: listedAsSurface,
        errors: [{ messageId: "missingReExport" }, { messageId: "extraStatement" }],
      },
      {
        name: "an empty listed file is reported for having no surface at all",
        code: "",
        filename: "src/index.ts",
        options: listedAsSurface,
        errors: [{ messageId: "missingReExport" }],
      },
      {
        name: "a two step re-export leaves the file with no direct re-export",
        code: 'import { total } from "./total.ts";\nexport { total };',
        filename: "src/index.ts",
        options: listedAsSurface,
        errors: [
          { messageId: "missingReExport" },
          { messageId: "extraStatement" },
          { messageId: "extraStatement" },
        ],
      },
      {
        name: "a listed pattern reaches through a working directory sitting in the middle of the path",
        code: "export const total = 1;",
        filename: "/tmp/build-cache/.staging/packages/repository-checks/src/index.ts",
        options: [{ targets: ["repository-checks/src/index.ts"] }],
        errors: [{ messageId: "missingReExport" }, { messageId: "extraStatement" }],
      },
      {
        name: "a double star in a listed pattern spans any number of directories",
        code: "export const total = 1;",
        filename: "packages/repository-checks/src/lint/oxlint/index.ts",
        options: [{ targets: ["packages/**/index.ts"] }],
        errors: [{ messageId: "missingReExport" }, { messageId: "extraStatement" }],
      },
      {
        name: "a star in a listed pattern stays inside one segment",
        code: "export const total = 1;",
        filename: "src/public-api.ts",
        options: [{ targets: ["src/public-*.ts"] }],
        errors: [{ messageId: "missingReExport" }, { messageId: "extraStatement" }],
      },
      {
        name: "a pattern anchored to the working directory names the file it resolves to",
        code: "export const total = 1;",
        filename: "packages/repository-checks/src/index.ts",
        options: [{ targets: ["./packages/repository-checks/src/index.ts"] }],
        errors: [{ messageId: "missingReExport" }, { messageId: "extraStatement" }],
      },
    ],
  });

  test("the options schema demands a listing and refuses any other key", () => {
    expect(requireReExportOnlyFiles.meta.schema).toStrictEqual([
      {
        type: "object",
        properties: {
          targets: { type: "array", items: { type: "string" }, minItems: 1 },
          exclude: { type: "array", items: { type: "string" } },
        },
        required: ["targets"],
        additionalProperties: false,
      },
    ]);
  });
});
