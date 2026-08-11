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
});
