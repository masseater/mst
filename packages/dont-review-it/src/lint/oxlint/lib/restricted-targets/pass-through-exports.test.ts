import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { astFieldsOf, statementsOf } from "../setup-modules/coupling-edges.ts";
import { passThroughExportsIn } from "./pass-through-exports.ts";

import type { AstFields } from "../ast-node.ts";

const forwardsIn = (
  sourceText: string,
): readonly {
  readonly specifier: string;
  readonly exported: string | null;
  readonly exposed: string;
}[] => {
  const program = astFieldsOf(parseSync("relay.ts", sourceText).program);
  if (program === null) throw new Error(`nothing was parsed from: ${sourceText}`);
  return passThroughExportsIn<AstFields>(statementsOf(program)).map(
    ({ specifier, exported, exposed }) => ({ specifier, exported, exposed }),
  );
};

describe("restricted-targets/pass-through-exports", () => {
  test("a re-export naming an export puts that name on this module's surface", () => {
    expect(forwardsIn('export { readFile } from "retired-lib";')).toStrictEqual([
      { specifier: "retired-lib", exported: "readFile", exposed: "readFile" },
    ]);
  });

  test("a re-export renaming an export carries the same binding under the new name", () => {
    expect(forwardsIn('export { readFile as read } from "retired-lib";')).toStrictEqual([
      { specifier: "retired-lib", exported: "readFile", exposed: "read" },
    ]);
  });

  test("a star re-export puts the whole surface through", () => {
    expect(forwardsIn('export * from "retired-lib";')).toStrictEqual([
      { specifier: "retired-lib", exported: null, exposed: "*" },
    ]);
  });

  test("a namespace re-export puts the whole surface through under a name", () => {
    expect(forwardsIn('export * as retired from "retired-lib";')).toStrictEqual([
      { specifier: "retired-lib", exported: null, exposed: "retired" },
    ]);
  });

  test("exporting an imported binding is the same forward written in two statements", () => {
    expect(
      forwardsIn('import { readFile } from "retired-lib";\nexport { readFile };'),
    ).toStrictEqual([{ specifier: "retired-lib", exported: "readFile", exposed: "readFile" }]);
  });

  test("renaming an imported binding on the way out changes nothing", () => {
    expect(
      forwardsIn('import { readFile } from "retired-lib";\nexport { readFile as read };'),
    ).toStrictEqual([{ specifier: "retired-lib", exported: "readFile", exposed: "read" }]);
  });

  test("exporting an imported namespace puts the whole surface through", () => {
    expect(
      forwardsIn('import * as retired from "retired-lib";\nexport { retired };'),
    ).toStrictEqual([{ specifier: "retired-lib", exported: null, exposed: "retired" }]);
  });

  test("exporting an imported default binding carries the default export out", () => {
    expect(forwardsIn('import retired from "retired-lib";\nexport default retired;')).toStrictEqual(
      [{ specifier: "retired-lib", exported: "default", exposed: "default" }],
    );
  });

  test("a required binding exported again is a forward as much as an import is", () => {
    expect(
      forwardsIn('import retired = require("retired-lib");\nexport { retired };'),
    ).toStrictEqual([{ specifier: "retired-lib", exported: null, exposed: "retired" }]);
  });

  test("an exposed name written as a string names the same surface an identifier would", () => {
    expect(forwardsIn('export { readFile as "read me" } from "retired-lib";')).toStrictEqual([
      { specifier: "retired-lib", exported: "readFile", exposed: "read me" },
    ]);
  });

  test("an imported name written as a string names the same export an identifier would", () => {
    expect(
      forwardsIn('import { "readFile" as readFile } from "retired-lib";\nexport { readFile };'),
    ).toStrictEqual([{ specifier: "retired-lib", exported: "readFile", exposed: "readFile" }]);
  });

  test("an assignment naming something already in scope is no forward", () => {
    expect(forwardsIn("import inner = outer.inner;\nexport { inner };")).toStrictEqual([]);
  });

  test("a binding this module declared itself is no forward once exported by name", () => {
    expect(forwardsIn("const total = 1;\nexport { total };")).toStrictEqual([]);
  });

  test("a default export naming a binding this module declared itself is no forward", () => {
    expect(forwardsIn("const total = 1;\nexport default total;")).toStrictEqual([]);
  });

  test("a declaration this module writes itself is no forward", () => {
    expect(forwardsIn("export const total = 1;")).toStrictEqual([]);
  });

  test("a binding this module computed from an import is no forward", () => {
    expect(
      forwardsIn(
        'import { readFile } from "retired-lib";\nexport const read = (path: string) => readFile(path);',
      ),
    ).toStrictEqual([]);
  });

  test("an import that is never exported again is no forward", () => {
    expect(forwardsIn('import { readFile } from "retired-lib";\nvoid readFile;')).toStrictEqual([]);
  });

  test("a default export of a value this module built is no forward", () => {
    expect(forwardsIn("export default 1;")).toStrictEqual([]);
  });

  test("a statement that is not a node is no forward", () => {
    expect(passThroughExportsIn([null])).toStrictEqual([]);
  });

  test("an import holding no module to name is no forward", () => {
    expect(passThroughExportsIn([{ type: "ImportDeclaration" }])).toStrictEqual([]);
  });

  test("an import holding nothing it brought in is no forward", () => {
    expect(
      passThroughExportsIn([{ type: "ImportDeclaration", source: { value: "retired-lib" } }]),
    ).toStrictEqual([]);
  });

  test("an import binding holding no local name is no forward", () => {
    expect(
      passThroughExportsIn([
        {
          type: "ImportDeclaration",
          source: { value: "retired-lib" },
          specifiers: [{ type: "ImportSpecifier" }],
        },
      ]),
    ).toStrictEqual([]);
  });

  test("an import assignment holding nothing to require is no forward", () => {
    expect(
      passThroughExportsIn([
        {
          type: "TSImportEqualsDeclaration",
          moduleReference: { type: "TSExternalModuleReference" },
        },
      ]),
    ).toStrictEqual([]);
  });

  test("a star re-export holding no module to name is no forward", () => {
    expect(passThroughExportsIn([{ type: "ExportAllDeclaration" }])).toStrictEqual([]);
  });

  test("a re-export holding no exposed name is no forward", () => {
    expect(
      passThroughExportsIn([
        {
          type: "ExportNamedDeclaration",
          source: { value: "retired-lib" },
          specifiers: [{ type: "ExportSpecifier", exported: {} }],
        },
      ]),
    ).toStrictEqual([]);
  });

  test("an export binding holding no local name is no forward", () => {
    expect(
      passThroughExportsIn([
        {
          type: "ExportNamedDeclaration",
          specifiers: [{ type: "ExportSpecifier", exported: { type: "Identifier", name: "read" } }],
        },
      ]),
    ).toStrictEqual([]);
  });

  test("a default export holding an identifier with no name is no forward", () => {
    expect(
      passThroughExportsIn([
        { type: "ExportDefaultDeclaration", declaration: { type: "Identifier" } },
      ]),
    ).toStrictEqual([]);
  });
});
