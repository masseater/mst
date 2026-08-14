import { testLintRule } from "@mst/lint-rule-authoring";
import { describe, expect, it } from "vite-plus/test";

import { requireTestAssetsConstants } from "./require-test-assets-constants--move-setup-to-spec.ts";

const ASSETS_FILE = "report.assets.ts";

const SPEC_FILE = "report.test.ts";

const optionsSchema = requireTestAssetsConstants.meta.schema;

describe("dont-review-it/require-test-assets-constants--move-setup-to-spec", () => {
  testLintRule(requireTestAssetsConstants, {
    valid: [
      {
        name: "an assets file holding written-out literals is the shape this rule asks for",
        documented: true,
        filename: ASSETS_FILE,
        code: 'export const REPORT_ID = "a";\nconst COUNT = 2;\nexport const TOTAL = COUNT;',
      },
      {
        name: "an array and an object of literals are written out once their parts are",
        filename: ASSETS_FILE,
        code: 'export const ROWS = [{ id: "a", tags: ["x"] }, { id: "b", tags: [] }];',
      },
      {
        name: "a hole in an array literal writes out an absence",
        filename: ASSETS_FILE,
        code: "export const SLOTS = [1, , 3];",
      },
      {
        name: "a template literal embedding a constant this file declares stays written out",
        filename: ASSETS_FILE,
        code: "const HOST = 'example';\nexport const URL = `https://${HOST}/reports`;",
      },
      {
        name: "a constant this file declares reads as a written-out key",
        filename: ASSETS_FILE,
        code: 'const SLOT = "primary";\nexport const CHOSEN = { [SLOT]: 1 };',
      },
      {
        name: "a satisfies clause and a type assertion wrap a written-out value",
        filename: ASSETS_FILE,
        code: 'export const REPORT = { id: "a" } satisfies { id: string };\nexport const COUNT = 2 as number;',
      },
      {
        name: "a non-null assertion wraps a written-out value",
        filename: ASSETS_FILE,
        code: 'export const REPORT_ID = ("a")!;',
      },
      {
        name: "a sign in front of a number leaves the number written out",
        filename: ASSETS_FILE,
        code: "export const OFFSET = -1;",
      },
      {
        name: "a chain of constants this file declares resolves to written-out data",
        documented: true,
        filename: ASSETS_FILE,
        code: 'const NAME = "a";\nconst ID = NAME;\nexport const REPORT = { id: ID };',
      },
      {
        name: "a file outside the assets vocabulary is never read for this invariant",
        filename: SPEC_FILE,
        code: 'import { summarise } from "./report.ts";\ntest("carries the id", () => {\n  expect(summarise()).toStrictEqual({ id: "a" });\n});',
      },
      {
        name: "a marker the deployment configures replaces the one this rule carries",
        filename: "report.fixtures.ts",
        code: 'export const REPORT_ID = "a";',
        options: [{ assetsNameMarkers: ["fixtures"] }],
      },
      {
        name: "a file carrying the vocabulary this rule replaced is left alone",
        filename: ASSETS_FILE,
        code: 'import { build } from "./builder.ts";\nexport const REPORT = build();',
        options: [{ assetsNameMarkers: ["fixtures"] }],
      },
    ],
    invalid: [
      {
        name: "an import is reported whatever it names",
        documented: true,
        filename: ASSETS_FILE,
        code: 'import { build } from "./builder.ts";\nexport const REPORT_ID = "a";',
        errors: [{ messageId: "assetsImport", data: { specifier: "./builder.ts" } }],
      },
      {
        name: "a type-only import is an import all the same",
        filename: ASSETS_FILE,
        code: 'import type { Report } from "./report.ts";\nexport const REPORT_ID = "a";',
        errors: [{ messageId: "assetsImport", data: { specifier: "./report.ts" } }],
      },
      {
        name: "a named re-export forwards another module",
        filename: ASSETS_FILE,
        code: 'export { REPORT } from "./shared.assets.ts";',
        errors: [{ messageId: "assetsReExport", data: { specifier: "./shared.assets.ts" } }],
      },
      {
        name: "a star re-export forwards another module",
        filename: ASSETS_FILE,
        code: 'export * from "./shared.assets.ts";',
        errors: [{ messageId: "assetsReExport", data: { specifier: "./shared.assets.ts" } }],
      },
      {
        name: "an export list standing apart from the declaration is reported",
        filename: ASSETS_FILE,
        code: 'const REPORT_ID = "a";\nconst COUNT = 2;\nexport { REPORT_ID, COUNT as TOTAL };',
        errors: [{ messageId: "assetsDetachedExport", data: { names: "`REPORT_ID`, `TOTAL`" } }],
      },
      {
        name: "a type alias is reported",
        filename: ASSETS_FILE,
        code: 'type Report = { id: string };\nexport const REPORT: Report = { id: "a" };',
        errors: [{ messageId: "assetsTypeDeclaration", data: { name: "Report" } }],
      },
      {
        name: "an interface is reported, and an exported type alias is reported through its export",
        filename: ASSETS_FILE,
        code: "interface Report {\n  id: string;\n}\nexport type Row = { id: string };",
        errors: [
          { messageId: "assetsTypeDeclaration", data: { name: "Report" } },
          { messageId: "assetsTypeDeclaration", data: { name: "Row" } },
        ],
      },
      {
        name: "a builder function is reported as a declaration this file must not carry",
        filename: ASSETS_FILE,
        code: 'export function buildReport() {\n  return { id: "a" };\n}',
        errors: [
          { messageId: "assetsForeignStatement", data: { shape: "a function declaration" } },
        ],
      },
      {
        name: "a class declaration is reported as a declaration this file must not carry",
        filename: ASSETS_FILE,
        code: "class Report {}",
        errors: [{ messageId: "assetsForeignStatement", data: { shape: "a class declaration" } }],
      },
      {
        name: "a default export is reported as a declaration this file must not carry",
        filename: ASSETS_FILE,
        code: 'export default { id: "a" };',
        errors: [{ messageId: "assetsForeignStatement", data: { shape: "a default export" } }],
      },
      {
        name: "an enum is reported as a declaration this file must not carry",
        filename: ASSETS_FILE,
        code: "enum Slot {\n  Primary,\n}",
        errors: [{ messageId: "assetsForeignStatement", data: { shape: "an enum declaration" } }],
      },
      {
        name: "a statement that runs is reported under the shape this rule falls back to",
        filename: ASSETS_FILE,
        code: 'globalThis.register("report");',
        errors: [{ messageId: "assetsForeignStatement", data: { shape: "a statement that runs" } }],
      },
      {
        name: "a let declaration is reported under the keyword it was written with",
        filename: ASSETS_FILE,
        code: 'let reportId = "a";',
        errors: [{ messageId: "assetsForeignStatement", data: { shape: "a `let` declaration" } }],
      },
      {
        name: "a declaration carrying no value is reported",
        filename: ASSETS_FILE,
        code: "declare const REPORT_ID: string;",
        errors: [
          {
            messageId: "assetsForeignStatement",
            data: { shape: "a `const` declaration carrying no value" },
          },
        ],
      },
      {
        name: "a binding taken apart from another value is reported",
        filename: ASSETS_FILE,
        code: "const { id } = REPORT;",
        errors: [{ messageId: "assetsDestructuredBinding" }],
      },
      {
        name: "a call that generates the value is reported",
        documented: true,
        filename: ASSETS_FILE,
        code: "export const REPORT = buildReport();",
        errors: [{ messageId: "assetsAssembledValue", data: { shape: "a call" } }],
      },
      {
        name: "a constructor call is reported",
        filename: ASSETS_FILE,
        code: 'export const READ_AT = new Date("2026-01-01");',
        errors: [
          {
            messageId: "assetsAssembledValue",
            data: { shape: "a value a constructor builds" },
          },
        ],
      },
      {
        name: "a dynamic import is reported",
        filename: ASSETS_FILE,
        code: 'export const REPORT = import("./report.ts");',
        errors: [{ messageId: "assetsAssembledValue", data: { shape: "an import" } }],
      },
      {
        name: "an awaited value is reported",
        filename: ASSETS_FILE,
        code: "export const REPORT = await loaded;",
        errors: [{ messageId: "assetsAssembledValue", data: { shape: "an awaited value" } }],
      },
      {
        name: "a tagged template is reported",
        filename: ASSETS_FILE,
        code: "export const QUERY = sql`select 1`;",
        errors: [{ messageId: "assetsAssembledValue", data: { shape: "a tagged template" } }],
      },
      {
        name: "a read off another value is reported",
        filename: ASSETS_FILE,
        code: "export const REPORT_ID = REPORTS.first.id;",
        errors: [
          { messageId: "assetsAssembledValue", data: { shape: "a read off another value" } },
        ],
      },
      {
        name: "a function written into the data is reported",
        filename: ASSETS_FILE,
        code: 'export const REPORT = { id: () => "a" };',
        errors: [{ messageId: "assetsAssembledValue", data: { shape: "a function" } }],
      },
      {
        name: "a method written into the data is reported",
        filename: ASSETS_FILE,
        code: 'export const REPORT = {\n  id() {\n    return "a";\n  },\n};',
        errors: [{ messageId: "assetsAssembledValue", data: { shape: "a function" } }],
      },
      {
        name: "a class expression is reported",
        filename: ASSETS_FILE,
        code: "export const Report = class {};",
        errors: [{ messageId: "assetsAssembledValue", data: { shape: "a class" } }],
      },
      {
        name: "a value the caller supplies is reported",
        filename: ASSETS_FILE,
        code: "export const REPORT = this;",
        errors: [
          { messageId: "assetsAssembledValue", data: { shape: "a value the caller supplies" } },
        ],
      },
      {
        name: "an expression the file computes falls back to the shape this rule carries",
        filename: ASSETS_FILE,
        code: "export const TOTAL = 1 + 1;",
        errors: [
          {
            messageId: "assetsAssembledValue",
            data: { shape: "a value this file works out as it loads" },
          },
        ],
      },
      {
        name: "a spread into an object is reported",
        filename: ASSETS_FILE,
        code: 'const BASE = { id: "a" };\nexport const REPORT = { ...BASE, count: 2 };',
        errors: [
          { messageId: "assetsAssembledValue", data: { shape: "a spread of another value" } },
        ],
      },
      {
        name: "a spread into an array is reported",
        filename: ASSETS_FILE,
        code: "const HEAD = [1];\nexport const ROWS = [...HEAD, 2];",
        errors: [
          { messageId: "assetsAssembledValue", data: { shape: "a spread of another value" } },
        ],
      },
      {
        name: "a name nothing in this file declares is reported",
        filename: ASSETS_FILE,
        code: "export const REPORT_ID = readReportId;",
        errors: [
          {
            messageId: "assetsAssembledValue",
            data: { shape: "the name `readReportId`, which this file does not declare" },
          },
        ],
      },
      {
        name: "a name the runtime supplies is reported the same way",
        filename: ASSETS_FILE,
        code: "export const REPORT = undefined;",
        errors: [
          {
            messageId: "assetsAssembledValue",
            data: { shape: "the name `undefined`, which this file does not declare" },
          },
        ],
      },
      {
        name: "a name bound to a call is reported at the reference that reads it",
        filename: ASSETS_FILE,
        code: "const BUILT = buildReport();\nexport const REPORT = BUILT;",
        errors: [
          { messageId: "assetsAssembledValue", data: { shape: "a call" } },
          { messageId: "assetsAssembledValue", data: { shape: "a call" } },
        ],
      },
      {
        name: "a chain of names leading back to itself is reported",
        filename: ASSETS_FILE,
        code: "const FIRST = SECOND;\nconst SECOND = FIRST;",
        errors: [
          {
            messageId: "assetsAssembledValue",
            data: { shape: "a chain of names that leads back to itself" },
          },
          {
            messageId: "assetsAssembledValue",
            data: { shape: "a chain of names that leads back to itself" },
          },
        ],
      },
      {
        name: "a key worked out as the file loads is reported",
        filename: ASSETS_FILE,
        code: "export const CHOSEN = { [slotName()]: 1 };",
        errors: [{ messageId: "assetsAssembledValue", data: { shape: "a call" } }],
      },
      {
        name: "a key naming something this file does not declare is reported",
        filename: ASSETS_FILE,
        code: "export const CHOSEN = { [slot]: 1 };",
        errors: [
          {
            messageId: "assetsAssembledValue",
            data: { shape: "the name `slot`, which this file does not declare" },
          },
        ],
      },
      {
        name: "a template embedding a call is reported",
        filename: ASSETS_FILE,
        code: "export const URL = `https://${host()}/reports`;",
        errors: [{ messageId: "assetsAssembledValue", data: { shape: "a call" } }],
      },
      {
        name: "a call nested in an array of objects is reported at the call",
        filename: ASSETS_FILE,
        code: 'export const ROWS = [{ id: "a" }, { id: buildId() }];',
        errors: [{ messageId: "assetsAssembledValue", data: { shape: "a call" } }],
      },
      {
        name: "a sign in front of a call leaves the call assembled",
        filename: ASSETS_FILE,
        code: "export const OFFSET = -countRows();",
        errors: [{ messageId: "assetsAssembledValue", data: { shape: "a call" } }],
      },
      {
        name: "a marker the deployment adds brings that file under the invariant",
        filename: "report.fixtures.ts",
        code: "export const REPORT = buildReport();",
        options: [{ assetsNameMarkers: ["fixtures"] }],
        errors: [{ messageId: "assetsAssembledValue", data: { shape: "a call" } }],
      },
      {
        name: "one declaration carrying two bindings is reported at the first assembled one",
        filename: ASSETS_FILE,
        code: 'export const REPORT_ID = "a", COUNT = countRows();',
        errors: [{ messageId: "assetsAssembledValue", data: { shape: "a call" } }],
      },
    ],
  });

  it("the options schema declares the assets vocabulary and refuses any other key", () => {
    expect(optionsSchema).toStrictEqual([
      {
        type: "object",
        properties: {
          assetsNameMarkers: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ]);
  });
});
